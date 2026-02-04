const express = require('express');
const router = express.Router();
const Node = require('../models/Node');

// Search Nodes (Keyword / Content)
// Must be BEFORE /:projectId to avoid routing conflict
router.get('/search', async (req, res) => {
    try {
        const { query, projectId } = req.query;
        if (!query || !projectId) {
            return res.status(400).json({ message: 'Missing query or projectId' });
        }

        const nodes = await Node.find({
            projectId: projectId,
            $or: [
                { shortTitle: { $regex: query, $options: 'i' } },
                { topicSummary: { $regex: query, $options: 'i' } },
                { starLabel: { $regex: query, $options: 'i' } },
                { question: { $regex: query, $options: 'i' } },
                { answer: { $regex: query, $options: 'i' } },
                { keywords: { $regex: query, $options: 'i' } },
                { summary: { $regex: query, $options: 'i' } }
            ]
        }).limit(20);

        res.json(nodes);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Create a node
router.post('/', async (req, res) => {
    const node = new Node({
        projectId: req.body.projectId,
        type: req.body.type,
        content: req.body.content,
        position: req.body.position
    });

    try {
        const newNode = await node.save();
        res.status(201).json(newNode);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Update a node
router.put('/:id', async (req, res) => {
    try {
        const node = await Node.findById(req.params.id);
        if (!node) return res.status(404).json({ message: 'Node not found' });

        if (req.body.content) node.content = req.body.content;
        if (req.body.position) node.position = req.body.position;
        if (req.body.type) node.type = req.body.type;

        const updatedNode = await node.save();
        res.json(updatedNode);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Get nodes by project ID
router.get('/:projectId', async (req, res) => {
    try {
        console.log(`[Nodes] Fetching for Project: ${req.params.projectId}`);
        const nodes = await Node.find({ projectId: req.params.projectId });
        console.log(`[Nodes] Found ${nodes.length} nodes for project ${req.params.projectId}`);
        res.json(nodes);
    } catch (err) {
        console.error("[Nodes] Error:", err);
        res.status(500).json({ message: err.message });
    }
});

// Delete a node
router.delete('/:id', async (req, res) => {
    try {
        const node = await Node.findByIdAndDelete(req.params.id);
        if (!node) return res.status(404).json({ message: 'Node not found' });

        // Allow cleanup of connected edges if desired?
        // For now, loose edges might remain, or we can clean them up.
        // Let's clean them up to be safe.
        await require('../models/Edge').deleteMany({
            $or: [{ source: req.params.id }, { target: req.params.id }]
        });

        res.json({ message: 'Node deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Toggle Bookmark
router.patch('/:id/bookmark', async (req, res) => {
    try {
        const node = await Node.findById(req.params.id);
        if (!node) return res.status(404).json({ message: 'Node not found' });

        // Toggle or set explicitly
        if (typeof req.body.isBookmarked === 'boolean') {
            node.isBookmarked = req.body.isBookmarked;
        } else {
            node.isBookmarked = !node.isBookmarked;
        }

        await node.save();
        res.json({ isBookmarked: node.isBookmarked });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
