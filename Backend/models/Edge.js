const mongoose = require('mongoose');

const edgeSchema = new mongoose.Schema({
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    source: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Node',
        required: true
    },
    target: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Node',
        required: true
    },
    type: {
        type: String,
        enum: ['temporal', 'explicit', 'implicit'],
        default: 'temporal'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Edge', edgeSchema);
