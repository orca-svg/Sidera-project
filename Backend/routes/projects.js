const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const Node = require('../models/Node');
const Edge = require('../models/Edge');
const authMiddleware = require('../middleware/auth');

// Apply Auth Middleware to ALL routes in this router
router.use(authMiddleware);

// Get all projects for current user
router.get('/', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

        const projects = await Project.find({ userId: req.user._id }).sort({ updatedAt: -1 });
        res.json(projects);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Create new project
router.post('/', async (req, res) => {
    // Note: Guests shouldn't hit this, but if they do, req.user is undefined -> 401
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const project = new Project({
        name: req.body.name || 'New Constellation',
        userId: req.user._id
    });

    try {
        const newProject = await project.save();
        res.status(201).json(newProject);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Get single project (ensure ownership)
router.get('/:id', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

        const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
        if (!project) return res.status(404).json({ message: 'Project not found' });

        const nodes = await Node.find({ projectId: req.params.id });
        const edges = await Edge.find({ projectId: req.params.id });

        res.json({
            project,
            nodes,
            edges
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// --- REFACTORING TOOL: Recalculate Edges for Project ---
router.post('/:id/refresh-edges', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

        const projectId = req.params.id;
        // Verify Ownership
        const project = await Project.findOne({ _id: projectId, userId: req.user._id });
        if (!project) return res.status(404).json({ message: 'Project not found' });

        // 1. Delete ALL existing edges
        await Edge.deleteMany({ projectId });

        // 2. Fetch all nodes sorted by creation time
        const nodes = await Node.find({ projectId }).sort({ createdAt: 1 });
        const newEdges = [];

        // Helper function for Cosine Similarity (duplicated from chat.js to disable dependency here)
        function cosineSim(vecA, vecB) {
            if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
            let dotProduct = 0;
            let magnitudeA = 0;
            let magnitudeB = 0;
            for (let i = 0; i < vecA.length; i++) {
                dotProduct += vecA[i] * vecB[i];
                magnitudeA += vecA[i] * vecA[i];
                magnitudeB += vecB[i] * vecB[i];
            }
            magnitudeA = Math.sqrt(magnitudeA);
            magnitudeB = Math.sqrt(magnitudeB);
            return (magnitudeA && magnitudeB) ? dotProduct / (magnitudeA * magnitudeB) : 0;
        }

        // 3. Re-generate Edges Node by Node
        for (let i = 0; i < nodes.length; i++) {
            const currentNode = nodes[i];
            const prevNode = i > 0 ? nodes[i - 1] : null;

            // A. Temporal Edge (Base)
            if (prevNode) {
                const temporalEdge = new Edge({
                    projectId,
                    source: prevNode._id,
                    target: currentNode._id,
                    type: 'temporal'
                });
                newEdges.push(temporalEdge);
            }

            // B. Semantic Edges (Look back at previous 50 nodes)
            if (currentNode.summaryEmbedding && currentNode.summaryEmbedding.length > 0) {
                // Get previous nodes (up to 50)
                const startIndex = Math.max(0, i - 50);
                const candidates = nodes.slice(startIndex, i).map(n => ({
                    node: n,
                    score: cosineSim(currentNode.summaryEmbedding, n.summaryEmbedding)
                })); // Allow prevNode as candidate

                candidates.sort((a, b) => b.score - a.score);

                let explicitCount = 0;
                let implicitCount = 0;

                for (const cand of candidates) {
                    if (explicitCount + implicitCount >= 5) break;

                    const candId = cand.node._id.toString();
                    const isPrevNode = prevNode && (candId === prevNode._id.toString());

                    let chosenType = null;
                    // Stricter Threshold (0.92) & Max 2 Explicit
                    if (cand.score >= 0.92 && explicitCount < 2) {
                        chosenType = 'explicit';
                        explicitCount++;
                    } else if (cand.score >= 0.65 && explicitCount + implicitCount < 5) {
                        chosenType = 'implicit';
                        implicitCount++;
                    }

                    if (chosenType) {
                        if (isPrevNode) {
                            // UPGRADE Temporal Edge
                            const existingEdgeIdx = newEdges.findIndex(e =>
                                e.source.toString() === candId &&
                                e.target.toString() === currentNode._id.toString()
                            );
                            if (existingEdgeIdx !== -1) {
                                newEdges[existingEdgeIdx].type = chosenType;
                            }
                        } else {
                            // Create New Edge
                            newEdges.push(new Edge({
                                projectId,
                                source: candId,
                                target: currentNode._id,
                                type: chosenType
                            }));
                        }
                    }
                }
            }
        }

        // 4. Save All New Edges
        await Edge.insertMany(newEdges);

        console.log(`[Refactor] Regenerated ${newEdges.length} edges for project ${projectId}`);
        res.json({ message: `Successfully regenerated ${newEdges.length} edges`, count: newEdges.length });

    } catch (err) {
        console.error("Refactor Error:", err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
