const express = require('express');
const router = express.Router();
const Node = require('../models/Node');
const Edge = require('../models/Edge');
const Project = require('../models/Project'); // Added Project model
const aiService = require('../services/aiService');

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

const authMiddleware = require('../middleware/auth');

// Apply Auth Middleware
router.use(authMiddleware);

// --- 2. Chat Endpoint ---
router.post('/', async (req, res) => {
    try {
        const { message, projectId, settings, isGuest, history } = req.body;
        console.log(`[Chat Request] ${isGuest ? '[GUEST]' : ''} Message: "${message}"`);

        // Security Check for Persistent Mode
        if (!isGuest) {
            if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

            // Verify Project Ownership
            const project = await Project.findOne({ _id: projectId, userId: req.user._id });
            if (!project) {
                return res.status(403).json({ error: 'Forbidden: You do not own this project' });
            }
        }

        // --- GUEST MODE: VOLATILE (NO DB SAVE) ---
        if (isGuest) {
            // 1. Build Context from Client History
            // History expected format: [{ question: "...", answer: "..." }, ...]
            const recentContext = history
                ? history.slice(-3).map(n => `User: ${n.question}\nAI: ${n.answer}`).join('\n')
                : "";
            const finalContext = `[RECENT CHAT]\n${recentContext}`;

            // 2. Generate Response
            const aiResponse = await aiService.generateResponse(message, finalContext, settings);

            // 3. Return Ephemeral Node
            // We mock the ID and positions since we don't save.
            const lastNode = history && history.length > 0 ? history[history.length - 1] : null;

            let newPosition = { x: 0, y: 0, z: 0 };
            if (lastNode && lastNode.position) {
                // Simple random walk for Guest
                const distance = 5 + Math.random() * 5;
                const theta = Math.random() * 2 * Math.PI;
                newPosition = {
                    x: lastNode.position.x + distance * Math.cos(theta),
                    y: lastNode.position.y + distance * Math.sin(theta),
                    z: lastNode.position.z + (Math.random() - 0.5) * 4
                };
            }

            const ephemeralNode = {
                _id: 'guest-' + Date.now(), // Fake ID
                projectId: 'guest-session',
                question: message,
                answer: aiResponse.answer,
                keywords: aiResponse.keywords,
                importance: aiResponse.importance,
                summary: aiResponse.summary,
                position: newPosition,
                createdAt: new Date().toISOString()
            };

            // Return immediately without saving
            return res.status(200).json({
                node: ephemeralNode,
                edges: [], // No persistent edges for guests
                projectTitle: history && history.length === 0 ? "Guest Exploration" : null
            });
        }

        // --- NORMAL MODE (DB PERSISTENCE) ---
        console.log(`[Chat Request] Message: "${message}" | Settings:`, settings);

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
        const actualLastNode = recentNodes.length > 0 ? recentNodes[0] : null; // Define here for context usage
        const count = await Node.countDocuments({ projectId }); // Need count for title generation

        // recentNodes is [Latest, Prev, PrevPrev]. Reverse for Context String order.
        const recentContext = [...recentNodes].reverse().map(n => `User: ${n.question}\nAI: ${n.answer}`).join('\n');

        const finalContext = (relevantContext ? `[CORE MEMORY]\n${relevantContext}\n\n` : "") + `[RECENT CHAT]\n${recentContext}`;

        const aiResponse = await aiService.generateResponse(message, finalContext, settings);

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

        // Position Logic: Relative to Last Node (Persistent Constellation)
        let newPosition = { x: 0, y: 0, z: 0 };

        if (actualLastNode && actualLastNode.position) {
            // Random direction in 3D or 2D plane
            const theta = Math.random() * 2 * Math.PI; // Angle on XY plane
            const phi = (Math.random() - 0.5) * Math.PI; // Elevation (optional for 3D looseness)

            // Distance between 5 and 10
            const distance = 5 + Math.random() * 5;

            newPosition = {
                x: actualLastNode.position.x + distance * Math.cos(theta),
                y: actualLastNode.position.y + distance * Math.sin(theta),
                z: actualLastNode.position.z + (Math.random() - 0.5) * 4 // Creating some depth variation
            };
        }

        newNode.position = newPosition;

        const savedNode = await newNode.save();

        // E. Sidera-Connect: Hybrid Edge Logic
        const newEdges = [];

        // 1. Temporal Edge (Backbone) - Always link to immediate predecessor ($t-1$)
        if (actualLastNode) {
            const temporalEdge = new Edge({
                projectId,
                source: actualLastNode._id,
                target: savedNode._id,
                type: 'temporal'
            });
            await temporalEdge.save();
            newEdges.push(temporalEdge);
        }

        // 2. Semantic Edges (Explicit / Implicit)
        if (newNode.summaryEmbedding && newNode.summaryEmbedding.length > 0) {
            // Fetch potential candidates (Top 50 recent nodes to keep it fast)
            const recentNodes = await Node.find({ projectId, _id: { $ne: savedNode._id } })
                .sort({ createdAt: -1 })
                .limit(50)
                .select('summaryEmbedding question answer date');

            const candidates = recentNodes.map(n => ({
                node: n,
                score: cosineSimilarity(newNode.summaryEmbedding, n.summaryEmbedding)
            })).filter(c => c.node._id.toString() !== actualLastNode?._id.toString()); // Exclude t-1 (already temporal)

            // Sort by score
            candidates.sort((a, b) => b.score - a.score);

            let explicitCount = 0;
            let implicitCount = 0;

            for (const cand of candidates) {
                // Max Constraints
                if (explicitCount >= 1 && implicitCount >= 2) break;

                if (cand.score >= 0.85 && explicitCount < 1) {
                    // Explicit Edge (Direct Thread)
                    const edge = new Edge({
                        projectId,
                        source: cand.node._id,
                        target: savedNode._id,
                        type: 'explicit'
                    });
                    await edge.save();
                    newEdges.push(edge);
                    explicitCount++;
                    console.log(`[Link] Explicit Edge to "${cand.node.question.substring(0, 20)}..." (Score: ${cand.score.toFixed(2)})`);
                }
                else if (cand.score >= 0.65 && explicitCount + implicitCount < 3) {
                    // Implicit Edge (Contextual)
                    const edge = new Edge({
                        projectId,
                        source: cand.node._id,
                        target: savedNode._id,
                        type: 'implicit'
                    });
                    await edge.save();
                    newEdges.push(edge);
                    implicitCount++;
                    console.log(`[Link] Implicit Edge to "${cand.node.question.substring(0, 20)}..." (Score: ${cand.score.toFixed(2)})`);
                }
            }
        }

        // F. Auto-Rename Project (if first message or default name)
        let projectTitle = null;
        if (count === 0) {
            projectTitle = await aiService.generateTitle(message);
            await Project.findByIdAndUpdate(projectId, { name: projectTitle });
            console.log(`[Project] Auto-renamed to: "${projectTitle}"`);
        }

        // Return Data
        res.status(201).json({
            node: savedNode,
            edges: newEdges,
            projectTitle // Return the new title if generated
        });

    } catch (err) {
        console.error("Chat Error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
