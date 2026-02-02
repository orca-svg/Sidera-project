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

module.exports = router;
