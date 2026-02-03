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

// --- Position Helper (handles array [x,y,z] or object {x,y,z}) ---
function getPos(node) {
    if (!node || !node.position) return null;
    if (Array.isArray(node.position)) {
        return { x: node.position[0] || 0, y: node.position[1] || 0, z: node.position[2] || 0 };
    }
    if (typeof node.position.x === 'number') return node.position;
    return null;
}

// --- Similarity-based Position Calculation ---
function calculatePosition(newEmbedding, existingNodes) {
    // existingNodes: [{ position: {x,y,z}, summaryEmbedding: [...] }]
    const scored = existingNodes
        .filter(n => n.summaryEmbedding && n.position)
        .map(n => ({
            position: n.position,
            similarity: cosineSimilarity(newEmbedding, n.summaryEmbedding)
        }));

    if (scored.length === 0) return { x: 0, y: 0, z: 0 };

    // Weighted centroid (nodes with higher similarity pull harder)
    let weightSum = 0, wx = 0, wy = 0, wz = 0;
    for (const s of scored) {
        const w = Math.max(0, s.similarity);
        wx += s.position.x * w;
        wy += s.position.y * w;
        wz += s.position.z * w;
        weightSum += w;
    }

    if (weightSum === 0) {
        // No positive similarity — place randomly away from origin
        const theta = Math.random() * 2 * Math.PI;
        return { x: 10 * Math.cos(theta), y: 10 * Math.sin(theta), z: (Math.random() - 0.5) * 4 };
    }

    const cx = wx / weightSum;
    const cy = wy / weightSum;
    const cz = wz / weightSum;

    // Distance inversely proportional to max similarity
    // High similarity → closer (3~5), Low similarity → farther (8~15)
    const maxSim = Math.max(...scored.map(s => s.similarity));
    const distance = 3 + (1 - maxSim) * 12;

    const theta = Math.random() * 2 * Math.PI;
    const phi = (Math.random() - 0.5) * Math.PI * 0.6;

    return {
        x: cx + distance * Math.cos(theta) * Math.cos(phi),
        y: cy + distance * Math.sin(theta) * Math.cos(phi),
        z: cz + distance * Math.sin(phi) * 2
    };
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
            const recentContext = history
                ? history.slice(-3).map(n => `User: ${n.question}\nAI: ${n.answer}`).join('\n')
                : "";
            const finalContext = `[RECENT CHAT]\n${recentContext}`;

            // 2. Generate Response
            const aiResponse = await aiService.generateResponse(message, finalContext, settings);

            // 3. Generate Embeddings (Needed for Edges)
            const summaryEmbedding = await aiService.getEmbedding(aiResponse.summary);
            // const fullEmbedding = await aiService.getEmbedding(message + " " + aiResponse.answer); // Optional for Guest

            // 4. Calculate Position (Similarity-based)
            const lastNode = history && history.length > 0 ? history[history.length - 1] : null;

            let newPosition = { x: 0, y: 0, z: 0 };
            if (summaryEmbedding && history && history.length > 0) {
                // Convert history positions from arrays to objects
                const existingNodes = history.map(n => ({
                    position: getPos(n),
                    summaryEmbedding: n.summaryEmbedding
                })).filter(n => n.position && n.summaryEmbedding);

                if (existingNodes.length > 0) {
                    newPosition = calculatePosition(summaryEmbedding, existingNodes);
                }
            }

            const ephemeralNode = {
                id: 'guest-' + Date.now(), // Frontend uses 'id' usually, check if mapped to _id
                _id: 'guest-' + Date.now(),
                projectId: 'guest-session',
                question: message,
                answer: aiResponse.answer,
                keywords: aiResponse.keywords,
                importance: aiResponse.importance,
                summary: aiResponse.summary,
                summaryEmbedding: summaryEmbedding, // Include for client-side debugging if needed
                position: newPosition,
                createdAt: new Date().toISOString()
            };

            // 5. Generate Ephemeral Edges (Sidera-Connect)
            const newEdges = [];

            // A. Temporal Edge
            if (lastNode) {
                newEdges.push({
                    id: 'edge-temp-' + Date.now(),
                    source: lastNode.id || lastNode._id,
                    target: ephemeralNode.id,
                    type: 'temporal'
                });
            }

            // B. Semantic Edges (Against History)
            if (summaryEmbedding && history && history.length > 0) {
                const candidates = history.map(n => ({
                    node: n,
                    score: cosineSimilarity(summaryEmbedding, n.summaryEmbedding)
                })).filter(c => (c.node.id || c.node._id) !== (lastNode?.id || lastNode?._id));

                candidates.sort((a, b) => b.score - a.score);

                let explicitCount = 0;
                let implicitCount = 0;

                for (const cand of candidates) {
                    // Total Max Constraints (e.g. 5) to prevent hairball, but allow multiple explicit
                    if (explicitCount + implicitCount >= 5) break;

                    const candId = cand.node.id || cand.node._id;
                    const isLastNode = lastNode && (candId === (lastNode.id || lastNode._id));

                    let chosenType = null;
                    if (cand.score >= 0.89) {
                        chosenType = 'explicit';
                        explicitCount++;
                    } else if (cand.score >= 0.65 && explicitCount + implicitCount < 5) {
                        chosenType = 'implicit';
                        implicitCount++;
                    }

                    if (chosenType) {
                        if (isLastNode) {
                            // UPGRADE Temporal Edge
                            const existingEdge = newEdges.find(e => e.source === candId && e.target === ephemeralNode.id);
                            if (existingEdge) {
                                existingEdge.type = chosenType; // Upgrade visual priority
                                console.log(`[Guest] Upgraded Temporal Edge to ${chosenType} (Score: ${cand.score.toFixed(2)})`);
                            }
                        } else {
                            newEdges.push({
                                id: `edge-${chosenType.substr(0, 3)}-` + Date.now() + Math.random(),
                                source: candId,
                                target: ephemeralNode.id,
                                type: chosenType
                            });
                        }
                    }
                }
            }

            // Return immediately without saving
            return res.status(200).json({
                node: ephemeralNode,
                edges: newEdges,
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
        // 1. Fetch Distribution for Sidera-IS (Dynamic Percentiles)
        const projectNodes = await Node.find({ projectId }).select('importanceScore');
        const scores = projectNodes.map(n => n.importanceScore || 0);

        // 2. Finalize Importance (Star Rating 1-5)
        const finalStarRating = aiService.calculateStarRating(aiResponse.importanceScore, scores);

        const newNode = new Node({
            projectId,
            question: message,
            answer: aiResponse.answer,
            keywords: aiResponse.keywords,
            importance: finalStarRating,
            importanceScore: aiResponse.importanceScore, // Save raw score for future stats
            summary: aiResponse.summary
        });

        // Generate Embeddings for the new node
        newNode.summaryEmbedding = await aiService.getEmbedding(newNode.summary);
        newNode.fullEmbedding = await aiService.getEmbedding(newNode.question + " " + newNode.answer);

        // Position Logic: Similarity-based (Sidera Constellation)
        let newPosition = { x: 0, y: 0, z: 0 };

        if (newNode.summaryEmbedding) {
            const allNodesForPos = await Node.find({ projectId, _id: { $ne: newNode._id } })
                .select('position summaryEmbedding');

            if (allNodesForPos.length > 0) {
                newPosition = calculatePosition(newNode.summaryEmbedding, allNodesForPos);
            }
        }

        newNode.position = newPosition;

        const savedNode = await newNode.save();

        // E. Sidera-Connect: Advanced Edge Logic (ReplyScore vs TopicScore)
        const newEdges = [];
        const { SideraConfig } = aiService;

        // 1. Temporal Edge (Backbone)
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

        // 2. Determine Candidates & Scores
        if (newNode.summaryEmbedding && newNode.summaryEmbedding.length > 0) {
            const history = await Node.find({ projectId, _id: { $ne: savedNode._id } })
                .sort({ createdAt: -1 })
                .limit(50)
                .select('summaryEmbedding question answer date importanceScore');

            // Calculate Scores for ALL candidates
            const scoredCandidates = history.map((cand, index) => {
                const sim = cosineSimilarity(newNode.summaryEmbedding, cand.summaryEmbedding);
                const timeDiff = Math.abs(index); // Just use index as proxy for 'turn distance'

                // (A) Reply Score (Short-term focus)
                const isRecent = timeDiff <= SideraConfig.Connect.explicit.window; // 15 turns
                const replyDecay = Math.exp(-timeDiff / 20);
                let replyScore = sim * replyDecay;

                // (B) Topic Score (Long-term context)
                const topicDecay = Math.exp(-timeDiff / SideraConfig.Connect.implicit.decayLambda);
                let topicScore = sim * topicDecay;

                return { node: cand, replyScore, topicScore, index };
            });

            // 3. Select EXPLICIT Edge (Top-1)
            const explicitCandidates = scoredCandidates
                .filter(c => c.replyScore >= SideraConfig.Connect.explicit.threshold)
                .sort((a, b) => b.replyScore - a.replyScore)
                .slice(0, SideraConfig.Connect.explicit.limit); // Top-1

            for (const cand of explicitCandidates) {
                const candId = cand.node._id.toString();
                const isLastNode = actualLastNode && (candId === actualLastNode._id.toString());

                if (isLastNode) {
                    // Upgrade Temporal
                    const tEdge = newEdges.find(e => e.type === 'temporal');
                    if (tEdge) {
                        tEdge.type = 'explicit';
                        await tEdge.save();
                        console.log(`[Connect] Upgraded Temporal -> Explicit (Score: ${cand.replyScore.toFixed(3)})`);
                    }
                } else {
                    const edge = new Edge({ projectId, source: candId, target: savedNode._id, type: 'explicit' });
                    await edge.save();
                    newEdges.push(edge);
                    console.log(`[Connect] New Explicit Edge (Score: ${cand.replyScore.toFixed(3)})`);
                }
            }

            // 4. Select IMPLICIT Edges (Top-2)
            const connectedIds = newEdges.map(e => e.source.toString()); // temporal/explicit sources

            const implicitCandidates = scoredCandidates
                .filter(c => !connectedIds.includes(c.node._id.toString())) // Don't duplicate
                .filter(c => c.topicScore >= SideraConfig.Connect.implicit.threshold)
                .sort((a, b) => b.topicScore - a.topicScore)
                .slice(0, SideraConfig.Connect.implicit.limit); // Top-2

            for (const cand of implicitCandidates) {
                const edge = new Edge({ projectId, source: cand.node._id, target: savedNode._id, type: 'implicit' });
                await edge.save();
                newEdges.push(edge);
                console.log(`[Connect] New Implicit Edge (Score: ${cand.topicScore.toFixed(3)})`);
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
        console.error("Chat Error:", err.message, err.stack);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
