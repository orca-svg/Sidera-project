const express = require('express');
const router = express.Router();
const Edge = require('../models/Edge');

// Create an edge
router.post('/', async (req, res) => {
    const edge = new Edge({
        projectId: req.body.projectId,
        source: req.body.source,
        target: req.body.target,
        type: req.body.type
    });

    try {
        const newEdge = await edge.save();
        res.status(201).json(newEdge);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Get edges by project ID
router.get('/:projectId', async (req, res) => {
    try {
        const edges = await Edge.find({ projectId: req.params.projectId });
        res.json(edges);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
