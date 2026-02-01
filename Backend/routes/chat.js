const express = require('express');
const router = express.Router();
const Node = require('../models/Node');
const Edge = require('../models/Edge');
const { generateResponse } = require('../services/aiService');

// Helper for 3D positioning
const calculatePosition = (basePos) => {
    const spread = 5;
    return {
        x: basePos.x + (Math.random() - 0.5) * spread,
        y: basePos.y + (Math.random() - 0.5) * spread,
        z: basePos.z + (Math.random() - 0.5) * spread
    };
};

router.post('/', async (req, res) => {
    const { projectId, message, parentNodeId } = req.body;
    console.log(`[Chat Request] Project: ${projectId}, Message: "${message}"`);

    try {
        // 1. Find parent node position (or default)
        let parentPos = { x: 0, y: 0, z: 0 };
        if (parentNodeId) {
            const parent = await Node.findById(parentNodeId);
            if (parent) parentPos = parent.position;
        }

        // 2. Check if it's the first message (for Title Generation)
        const nodeCount = await Node.countDocuments({ projectId });
        const isFirstMessage = (nodeCount === 0);

        // 3. Call AI Service
        console.log(`[AI Interaction] Generating response for: "${message}" (First: ${isFirstMessage})...`);
        const aiData = await generateResponse(message, isFirstMessage);

        // 4. Update Project Title if generated
        let projectTitle = null;
        if (isFirstMessage && aiData.title) {
            projectTitle = aiData.title;
            const Project = require('../models/Project');
            console.log(`[Project] Updating Title for ${projectId} to: "${projectTitle}"`);
            // Ensure DB update
            await Project.findByIdAndUpdate(projectId, { name: projectTitle, updatedAt: Date.now() }, { new: true });
        }

        // 5. Create Single Node
        const newNode = new Node({
            projectId,
            question: message,
            answer: aiData.answer,
            keywords: aiData.keywords || [],
            importance: aiData.importance || 'Satellite',
            topicSummary: aiData.topicSummary,
            position: calculatePosition(parentPos)
        });
        await newNode.save();

        // 6. Create Edge
        let newEdge = null;
        if (parentNodeId) {
            const edgeType = (aiData.importance === 'Alpha') ? 'solid' : 'default'; // Simply distinguishing visual style

            newEdge = new Edge({
                projectId,
                source: parentNodeId,
                target: newNode._id,
                type: edgeType
            });
            await newEdge.save();
        }

        res.json({
            node: newNode,
            edge: newEdge,
            projectTitle: projectTitle // Return new title to frontend
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
