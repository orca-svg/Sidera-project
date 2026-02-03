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
        // E. Sidera-Connect: Added 'branch' and 'related'
        enum: ['temporal', 'explicit', 'implicit', 'branch', 'related'],
        default: 'branch'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Edge', edgeSchema);
