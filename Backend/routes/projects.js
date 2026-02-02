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

// Auto-Rename Project (AI Trigger)
router.patch('/:id/auto-rename', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

        const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
        if (!project) return res.status(404).json({ message: 'Project not found' });

        // Fetch first few messages to generate a title
        const nodes = await Node.find({ projectId: req.params.id }).sort({ createdAt: 1 }).limit(5);
        if (nodes.length === 0) return res.status(400).json({ message: 'Not enough context to rename' });

        const context = nodes.map(n => `Q: ${n.question}\nA: ${n.answer}`).join('\n');
        const aiService = require('../services/aiService'); // Lazy load
        const newTitle = await aiService.generateTitle(context);

        project.name = newTitle;
        await project.save();

        res.json({ title: newTitle });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get Project Summary
router.get('/:id/summary', async (req, res) => {
    try {
        // Auth check (allow public if isPublic is implemented, otherwise strict)
        // For now strict owner check as per current logic
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

        const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
        if (!project) return res.status(404).json({ message: 'Project not found' });

        const nodes = await Node.find({ projectId: req.params.id }).sort({ createdAt: 1 });

        // Simple concatenation strategy for now
        const summaryText = nodes.map(n => `[${n.topicSummary || 'Point'}]: ${n.question} -> ${n.summary}`).join('\n\n');

        res.json({ summary: summaryText });
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

// Rename project
router.put('/:id', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

        const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
        if (!project) return res.status(404).json({ message: 'Project not found' });

        if (req.body.name) project.name = req.body.name;
        // Also allow updating viewState
        if (req.body.viewState) project.viewState = req.body.viewState;
        if (req.body.hasOwnProperty('isPublic')) project.isPublic = req.body.isPublic;

        project.updatedAt = Date.now();
        const updatedProject = await project.save();
        res.json(updatedProject);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete project (Cascade)
router.delete('/:id', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

        const project = await Project.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!project) return res.status(404).json({ message: 'Project not found' });

        // Cascade Delete: Remove all associated Nodes and Edges
        await Node.deleteMany({ projectId: req.params.id });
        await Edge.deleteMany({ projectId: req.params.id });

        res.json({ message: 'Project and all related data deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update View State (Camera Position)
router.post('/:id/view-state', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

        const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
        if (!project) return res.status(404).json({ message: 'Project not found' });

        // Expect body: { x, y, z, zoom }
        if (req.body.viewState) {
            project.viewState = { ...project.viewState, ...req.body.viewState };
            await project.save();
            res.json(project.viewState);
        } else {
            res.status(400).json({ message: 'Missing viewState data' });
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Toggle Project Sharing (Public/Private)
router.patch('/:id/share', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

        const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
        if (!project) return res.status(404).json({ message: 'Project not found' });

        // Toggle or set explicitly
        if (typeof req.body.isPublic === 'boolean') {
            project.isPublic = req.body.isPublic;
        } else {
            project.isPublic = !project.isPublic;
        }

        await project.save();
        res.json({ isPublic: project.isPublic });
    } catch (err) {
        res.status(500).json({ message: err.message });
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
