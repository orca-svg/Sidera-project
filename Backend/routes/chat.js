const express = require('express');
const router = express.Router();
const Node = require('../models/Node');
const Edge = require('../models/Edge');
const aiService = require('../services/aiService'); // Import entire module

// --- 1. Cosine Similarity Helper ---
function cosineSimilarity(vecA, vecB) {
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

// --- 2. Chat Endpoint ---
router.post('/', async (req, res) => {
    try {
        const { message, projectId } = req.body;
        console.log(`[Chat Request] Message: "${message}"`);

        // A. Generate Embedding for User Question
        const questionEmbedding = await aiService.getEmbedding(message);

        // B. Hierarchical Retrieval (RAG)
        let relevantContext = "";
        let bestMatchNode = null;
        let bestMatchScore = 0;

        if (questionEmbedding) {
            // Fetch all nodes with embeddings from this project
            const allNodes = await Node.find({ projectId }).select('summary summaryEmbedding fullEmbedding question answer');

            // Level 1: Filter by Topic (Summary)
            const topicCandidates = allNodes
                .map(n => ({
                    node: n,
                    score: cosineSimilarity(questionEmbedding, n.summaryEmbedding)
                }))
                .filter(item => item.score > 0.4) // Filter unrelated topics
                .sort((a, b) => b.score - a.score)
                .slice(0, 5); // Take top 5 topics

            if (topicCandidates.length > 0) {
                // Level 2: Pinpoint Detail (Full Content)
                // Re-calculate against full embedding for these candidates
                const detailMatches = topicCandidates.map(c => ({
                    node: c.node,
                    score: cosineSimilarity(questionEmbedding, c.fullEmbedding)
                })).sort((a, b) => b.score - a.score);
                bestMatchNode = detailMatches[0].node;
                bestMatchScore = detailMatches[0].score;

                if (bestMatchScore > 0.6) {
                    console.log(`[RAG] Found core memory: "${bestMatchNode.summary}" (Score: ${bestMatchScore.toFixed(2)})`);
                    relevantContext = `User previously asked: "${bestMatchNode.question}"\nAI Answered: "${bestMatchNode.answer}"\nSummary: ${bestMatchNode.summary}`;
                }
            }
        }

        // C. Generate Content (with Context)
        const recentNodes = await Node.find({ projectId }).sort({ createdAt: -1 }).limit(3);
        // recentNodes is [Latest, Prev, PrevPrev]. Reverse for Context String order.
        const recentContext = [...recentNodes].reverse().map(n => `User: ${n.question}\nAI: ${n.answer}`).join('\n');

        const finalContext = (relevantContext ? `[CORE MEMORY]\n${relevantContext}\n\n` : "") + `[RECENT CHAT]\n${recentContext}`;

        const aiResponse = await aiService.generateResponse(message, finalContext);

        // D. Create New Node
        const newNode = new Node({
            projectId,
            question: message,
            answer: aiResponse.answer,
            keywords: aiResponse.keywords,
            importance: aiResponse.importance,
            summary: aiResponse.summary
        });

        // Generate Embeddings for the new node
        newNode.summaryEmbedding = await aiService.getEmbedding(newNode.summary);
        newNode.fullEmbedding = await aiService.getEmbedding(newNode.question + " " + newNode.answer);

        // Position Logic (Simple Spiral for now)
        const count = await Node.countDocuments({ projectId });
        const angle = count * 0.5;
        const radius = 5 + (count * 0.2);
        newNode.position = {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
            z: (Math.random() - 0.5) * 2
        };

        const savedNode = await newNode.save();

        // E. Smart Edges (Constellation Logic)
        const newEdges = [];

        // Rule 1: Always check immediate continuity
        const actualLastNode = recentNodes.length > 0 ? recentNodes[0] : null;

        let linked = false;

        // Continuity Link (to Last Node)
        if (actualLastNode) {
            if (actualLastNode.summaryEmbedding && cosineSimilarity(newNode.summaryEmbedding, actualLastNode.summaryEmbedding) > 0.5) {
                const edge = new Edge({
                    projectId,
                    source: actualLastNode._id,
                    target: savedNode._id,
                    type: 'solid' // Flow
                });
                await edge.save();
                newEdges.push(edge);
                linked = true;
                console.log(`[Link] Connected to Last Node (Flow)`);
            }
        }

        // Branching Link (if not linked to last, or strong recall found)
        if (!linked && bestMatchNode && bestMatchScore > 0.7 && bestMatchNode.id !== actualLastNode?.id) {
            const edge = new Edge({
                projectId,
                source: bestMatchNode._id,
                target: savedNode._id,
                type: 'dashed' // Recall/Branch
            });
            await edge.save();
            newEdges.push(edge);
            console.log(`[Link] Branching from Memory: ${bestMatchNode.summary}`);
        }

        // Return Data
        res.status(201).json({
            node: savedNode,
            edges: newEdges
        });

    } catch (err) {
        console.error("Chat Error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
