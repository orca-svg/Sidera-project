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

// --- 3. Context Retrieval (History Chain) ---
router.get('/context/:nodeId', async (req, res) => {
    try {
        const targetNode = await Node.findById(req.params.nodeId);
        if (!targetNode) return res.status(404).json({ error: 'Node not found' });

        // Build chain backwards using 'temporal' edges
        const chain = [targetNode];
        let currentNode = targetNode;

        // Limit depth to avoid infinite loops (though temporal should be acyclic)
        for (let i = 0; i < 20; i++) {
            const edge = await Edge.findOne({
                target: currentNode._id,
                type: 'temporal'
            });

            if (!edge) break; // Start of chain found

            const prevNode = await Node.findById(edge.source);
            if (!prevNode) break;

            chain.unshift(prevNode); // Prepend to maintain chronological order
            currentNode = prevNode;
        }

        res.json({ context: chain });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 2. Chat Endpoint ---
router.post('/', async (req, res) => {
    let projectTitle = null;
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
            const { SideraConfig } = aiService; // Ensure this is available

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
                // Calculate Scores
                const scoredCandidates = history.map((n, index) => {
                    const sim = cosineSimilarity(summaryEmbedding, n.summaryEmbedding);
                    const timeDiff = Math.abs((history.length - 1) - index); // Approx distance from end

                    // Reply Score
                    const replyDecay = Math.exp(-timeDiff / 20);
                    const replyScore = sim * replyDecay;

                    // Topic Score
                    const topicDecay = Math.exp(-timeDiff / SideraConfig.Connect.implicit.decayLambda);
                    const topicScore = sim * topicDecay;

                    return { node: n, replyScore, topicScore };
                }).filter(c => (c.node.id || c.node._id) !== (lastNode?.id || lastNode?._id));

                const candidates = scoredCandidates.sort((a, b) => b.replyScore - a.replyScore); // Sort by reply score primarily

                let explicitCount = 0;
                let implicitCount = 0;

                for (const cand of candidates) {
                    if (explicitCount + implicitCount >= 5) break;

                    const candId = cand.node.id || cand.node._id;
                    const isLastNode = lastNode && (candId === (lastNode.id || lastNode._id));

                    let chosenType = null;
                    // Use SideraConfig Thresholds
                    if (cand.replyScore >= SideraConfig.Connect.explicit.threshold && explicitCount < SideraConfig.Connect.explicit.limit) {
                        chosenType = 'explicit';
                        explicitCount++;
                    } else if (cand.topicScore >= SideraConfig.Connect.implicit.threshold && explicitCount + implicitCount < 5) { // reusing 5 max total for safety
                        chosenType = 'implicit';
                        implicitCount++;
                    }

                    if (chosenType) {
                        if (isLastNode) {
                            // UPGRADE Temporal Edge
                            const existingEdge = newEdges.find(e => e.source === candId && e.target === ephemeralNode.id);
                            if (existingEdge) {
                                existingEdge.type = chosenType; // Upgrade visual priority
                                console.log(`[Guest] Upgraded Temporal Edge to ${chosenType} (Score: ${cand.replyScore.toFixed(2)})`);
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

        // D. Create New Node Instance (Initial)
        // STRICT SANITIZATION for topicSummary to prevent layout breaks
        let cleanTopicSummary = aiResponse.topicSummary;
        if (!cleanTopicSummary || cleanTopicSummary.length > 30) cleanTopicSummary = aiResponse.shortTitle;
        if (!cleanTopicSummary || cleanTopicSummary.length > 30) cleanTopicSummary = (aiResponse.keywords && aiResponse.keywords[0]) || "Topic";
        if (cleanTopicSummary && cleanTopicSummary.length > 30) cleanTopicSummary = cleanTopicSummary.substring(0, 30) + "..";

        const newNode = new Node({
            projectId,
            question: message,
            answer: aiResponse.answer,
            keywords: aiResponse.keywords,
            importance: 3, // Temporary, will be updated by Sidera-IS
            importanceScore: 0,
            summary: aiResponse.summary,
            topicSummary: cleanTopicSummary,
            shortTitle: aiResponse.shortTitle || (aiResponse.keywords && aiResponse.keywords[0]) || "",
            starLabel: aiResponse.starLabel || aiResponse.shortTitle || ""
        });

        // Generate Embeddings for the new node
        newNode.summaryEmbedding = await aiService.getEmbedding(newNode.summary);
        newNode.fullEmbedding = await aiService.getEmbedding(newNode.question + " " + newNode.answer);

        // --- SIDERA-IS v2.1: Weighted Anchor Logic ---
        let finalImportanceScore = aiResponse.importanceScore; // Default to provisional

        // 1. Fetch Root Node (First Node)
        const rootNode = await Node.findOne({ projectId }).sort({ createdAt: 1 });
        let rootScore = null;

        // 2. Check for Error/Failed Response
        const answerText = (newNode.answer || "").toLowerCase();
        const isError = /error|failed|응답.*못|답변.*못/.test(answerText) ||
            answerText.length < 10; // Very short answers likely errors

        if (isError) {
            // Error case: No stars
            finalImportanceScore = 0;
            newNode.importance = 0;
            newNode.importanceScore = 0;
            console.log("[Sidera-IS] Error/Failed response detected - No stars");
        } else if (!rootNode && count === 0) {
            // CASE A: FIRST NODE (The Anchor) - Always 5 stars unless error
            finalImportanceScore = 1.0; // Max Score
            rootScore = 1.0; // Self-reference for first node
            newNode.importance = 5; // Direct assignment
            newNode.importanceScore = 1.0;
            console.log("[Sidera-IS] First Node: Always 5 stars");
        } else {
            // CASE B: SUBSEQUENT NODES (Standard Heuristics)
            const text = (newNode.answer || "") + " " + (newNode.question || "");
            finalImportanceScore = aiService.calculateImportanceMetrics(text, "assistant");

            if (rootNode) {
                rootScore = rootNode.importanceScore;
            }

            // 3. Finalize Star Rating (Dynamic Percentiles with Weighted Anchor)
            const projectNodes = await Node.find({ projectId }).select('importanceScore');
            const scores = projectNodes.map(n => n.importanceScore || 0);
            scores.push(finalImportanceScore);

            // Pass 'rootScore' to adjust percentiles
            const finalStarRating = aiService.calculateStarRating(finalImportanceScore, scores, rootScore);

            newNode.importance = finalStarRating;
            newNode.importanceScore = finalImportanceScore;
        }
        // ----------------------------------------------

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

        // Auto-update project title from first conversation's topicSummary
        if (!rootNode) {
            // This is the first node - update project title
            const Project = require('../models/Project');
            const currentProject = await Project.findById(projectId);

            // Only overwrite if it's a default title
            const currentName = currentProject.name || currentProject.title; // Safe fallback
            const isDefaultTitle = !currentName ||
                currentName === 'New Project' ||
                currentName === '새 프로젝트' ||
                currentName === 'New Conversation'; // Match frontend default

            if (isDefaultTitle) {
                // Determine best title with strict length limit (max 30 chars)
                // Match DEV branch: Prioritize "Title" (shortTitle) over "Topic Summary"
                let title = aiResponse.shortTitle;

                // If shortTitle is missing, try topicSummary
                if (!title || title.length > 30) {
                    title = aiResponse.topicSummary;
                }

                // If still too long or missing, try keywords or fallback to question
                if (!title || title.length > 30) {
                    title = (aiResponse.keywords && aiResponse.keywords[0]) || newNode.question?.substring(0, 20);
                }

                // Final safety truncation
                if (title && title.length > 30) {
                    title = title.substring(0, 30) + "...";
                }

                if (title) {
                    await Project.findByIdAndUpdate(projectId, { name: title, lastUpdated: new Date() });
                    projectTitle = title; // Capture for response
                    console.log(`[Project] Auto-updated name to: ${title}`);
                }
            } else {
                console.log(`[Project] Title is user-customized ('${currentProject.title}'), skipping auto-update.`);
            }
        }

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
                .select('summaryEmbedding question answer date importanceScore topicSummary');

            // Calculate Scores for ALL candidates
            const scoredCandidates = history.map((cand, index) => {
                const sim = cosineSimilarity(newNode.summaryEmbedding, cand.summaryEmbedding);

                // DEBUG LOG: Check why score is high
                if (sim > 0.5) {
                    console.log(`[Similarity Check] New: "${newNode.topicSummary}" vs Cand: "${cand.topicSummary || 'Unknown'}" (ID: ${cand._id})`);
                    console.log(`[Similarity Check] Score: ${sim.toFixed(4)}`);
                }

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

            // 3. Select EXPLICIT Edge - Based on HIGH semantic similarity (docs: 0.75+)
            // If semantic similarity is high, the topics are strongly related (e.g., 블랙홀 ↔ 화이트홀 = 우주)
            const SEMANTIC_EXPLICIT_THRESHOLD = 0.75; // Raised to 0.75 to prevent unrelated connections

            const explicitCandidates = scoredCandidates
                .filter(c => {
                    const rawSim = cosineSimilarity(newNode.summaryEmbedding, c.node.summaryEmbedding);
                    return rawSim >= SEMANTIC_EXPLICIT_THRESHOLD; // High semantic similarity = explicit edge
                })
                .sort((a, b) => b.topicScore - a.topicScore) // Sort by topicScore for best matches
                .slice(0, SideraConfig.Connect.explicit.limit); // Top-2 matches

            for (const cand of explicitCandidates) {
                const candId = cand.node._id.toString();
                const isLastNode = actualLastNode && (candId === actualLastNode._id.toString());
                const rawSim = cosineSimilarity(newNode.summaryEmbedding, cand.node.summaryEmbedding);

                if (isLastNode) {
                    // Upgrade Temporal
                    const tEdge = newEdges.find(e => e.type === 'temporal');
                    if (tEdge) {
                        tEdge.type = 'explicit';
                        await tEdge.save();
                        console.log(`[Connect] Upgraded Temporal -> Explicit (Similarity: ${rawSim.toFixed(3)})`);
                    }
                } else {
                    const edge = new Edge({ projectId, source: candId, target: savedNode._id, type: 'explicit' });
                    await edge.save();
                    newEdges.push(edge);
                    console.log(`[Connect] New Explicit Edge (Similarity: ${rawSim.toFixed(3)})`);
                }
            }

            // 4. Select IMPLICIT Edges - Lower semantic similarity but still related
            const connectedIds = newEdges.map(e => e.source.toString()); // temporal/explicit sources
            const SEMANTIC_IMPLICIT_THRESHOLD = 0.35;

            const implicitCandidates = scoredCandidates
                .filter(c => !connectedIds.includes(c.node._id.toString())) // Don't duplicate
                .filter(c => {
                    const rawSim = cosineSimilarity(newNode.summaryEmbedding, c.node.summaryEmbedding);
                    return rawSim >= SEMANTIC_IMPLICIT_THRESHOLD && rawSim < SEMANTIC_EXPLICIT_THRESHOLD;
                })
                .sort((a, b) => b.topicScore - a.topicScore)
                .slice(0, SideraConfig.Connect.implicit.limit); // Top-3

            for (const cand of implicitCandidates) {
                const rawSim = cosineSimilarity(newNode.summaryEmbedding, cand.node.summaryEmbedding);
                const edge = new Edge({ projectId, source: cand.node._id, target: savedNode._id, type: 'implicit' });
                await edge.save();
                newEdges.push(edge);
                console.log(`[Connect] New Implicit Edge (Similarity: ${rawSim.toFixed(3)})`);
            }
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
