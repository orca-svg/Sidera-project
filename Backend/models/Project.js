const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        default: 'Untitled Universe'
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    viewState: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 },
        z: { type: Number, default: 0 },
        zoom: { type: Number, default: 10 }
    },
    isPublic: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['active', 'completed'],
        default: 'active'
    },
    completedAt: {
        type: Date,
        default: null
    },
    constellationName: {
        type: String,
        default: null
    },
    constellationImageUrl: {
        type: String,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Project', projectSchema);
