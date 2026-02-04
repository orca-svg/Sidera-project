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

        // A. Generate Embedding for User Question (English Translation)
        const questionEmbedding = await aiService.getEnglishEmbedding(message);

        // B. Hierarchical Retrieval (RAG)
        let relevantContext = "";
        let bestMatchNode = null;
        let bestMatchScore = 0;

        if (questionEmbedding) {
            // Fetch all nodes with embeddings from this project
            const allNodes = await Node.find({ projectId }).select('summary summaryEmbedding fullEmbedding question answer');
            console.log(`[RAG-DEBUG] Found ${allNodes.length} nodes in DB for Project ${projectId}`);

            // Level 1: Filter by Topic (Summary)
            const topicCandidates = allNodes
                .map(n => {
                    const sim = cosineSimilarity(questionEmbedding, n.summaryEmbedding);
                    // Check if embedding exists
                    if (!n.summaryEmbedding || n.summaryEmbedding.length === 0) {
                        console.log(`[RAG-DEBUG] Node "${n.summary.substring(0, 10)}..." has NO embedding.`);
                        return { node: n, score: 0 };
                    }
                    return { node: n, score: sim };
                })
                // LOGGING FOR USER
                .map(item => {
                    // LOG ALL SCORES regardless of value
                    console.log(`[RAG-SIM] Score: ${item.score.toFixed(4)} | Summary: "${item.node.summary.substring(0, 30)}..."`);
                    return item;
                })
                .filter(item => item.score > 0.5) // Filter unrelated topics (Increased from 0.4)
                .sort((a, b) => b.score - a.score)
                .slice(0, 5); // Take top 5 topics

            if (topicCandidates.length > 0) {
                // ... (Level 2 logic) ...
                // Level 2: Pinpoint Detail (Full Content)
                // Re-calculate against full embedding for these candidates
                const detailMatches = topicCandidates.map(c => ({
                    node: c.node,
                    score: cosineSimilarity(questionEmbedding, c.fullEmbedding)
                })).sort((a, b) => b.score - a.score);
                bestMatchNode = detailMatches[0].node;
                bestMatchScore = detailMatches[0].score;

                if (bestMatchScore > 0.6) {
                    console.log(`[RAG-MATCH] Found core memory: "${bestMatchNode.summary}" (Score: ${bestMatchScore.toFixed(2)})`);
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

        // Log the Full Response for Debugging
        console.log("\n--- [AI RESPONSE DEBUG] ---");
        console.log(JSON.stringify(aiResponse, null, 2));
        console.log("---------------------------\n");

        // D. Create New Node Instance (Initial)
        // D. Create New Node Instance (Initial)
        // Use shortTitle as the primary label
        let cleanShortTitle = aiResponse.shortTitle || "Topic";

        const newNode = new Node({
            projectId,
            question: message,
            answer: aiResponse.answer,
            keywords: [], // Removed from AI, empty array
            importance: 3, // Provisional
            importanceScore: 0,
            summary: aiResponse.summary,
            topicSummary: cleanShortTitle, // Map shortTitle to topicSummary for compatibility
            shortTitle: cleanShortTitle,
            starLabel: cleanShortTitle // Map shortTitle to starLabel
        });

        // Generate Embeddings for the new node (Using English Topic)
        // 1. Summary Embedding: Use the AI-provided English Topic if available
        if (aiResponse.englishTopic && aiResponse.englishTopic !== "Topic") {
            console.log(`[Embedding] Using AI-generated English Topic: "${aiResponse.englishTopic}"`);
            newNode.summaryEmbedding = await aiService.getEmbedding(aiResponse.englishTopic);
        } else {
            console.log(`[Embedding] English Topic missing, translating summary...`);
            newNode.summaryEmbedding = await aiService.getEnglishEmbedding(newNode.summary);
        }

        // 2. Full Embedding: Use translation of Q+A
        newNode.fullEmbedding = await aiService.getEnglishEmbedding(newNode.question + " " + newNode.answer);

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
            // Error case: Minimum stars
            finalImportanceScore = 0;
            newNode.importance = 1; // FIX: Minimum allowed value is 1
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

        // --- 1. IMMEDIATE RESPONSE (User Experience First) ---
        // Return the node immediately so the user sees the answer/star.
        // Edges will be calculated in background and appear on next refresh/poll.
        res.status(201).json({
            node: savedNode,
            edges: [], // Edges not ready yet
            projectTitle // Return the new title if generated
        });

        // --- 2. BACKGROUND PROCESS: CONNECT (Fire and Forget) ---
        (async () => {
            try {
                // Auto-update project title from first conversation's topicSummary (Logic from Remote)
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
                        // Determine best title (max 30 chars)
                        // Use shortTitle directly as it is now the primary label
                        let title = aiResponse.shortTitle;

                        if (!title || title.length > 30) {
                            title = newNode.question?.substring(0, 20);
                        }

                        // Final safety truncation
                        if (title && title.length > 30) {
                            title = title.substring(0, 30) + "...";
                        }

                        if (title) {
                            await Project.findByIdAndUpdate(projectId, { name: title, lastUpdated: new Date() });
                            // projectTitle = title; // No need to capture for response, already sent
                            console.log(`[Project] Auto-updated name to: ${title}`);
                        }
                    } else {
                        console.log(`[Project] Title is user-customized ('${currentProject.title}'), skipping auto-update.`);
                    }
                } // End of if (!rootNode)

                // E. Sidera-Connect: Hybrid Tree + Cluster Logic

                // 1. Branch Edge (Tree Structure) - Still fast, could do here
                // Connect to parentId ONLY if provided (User explicitly replied)
                const parentId = req.body.parentId || null;
                const newEdges = []; // This will store edges created in background, not returned to client
                const { SideraConfig } = aiService;

                if (parentId) {
                    const branchEdge = new Edge({
                        projectId,
                        source: parentId,
                        target: savedNode._id,
                        type: 'branch'
                    });
                    await branchEdge.save();
                    newEdges.push(branchEdge); // Save to DB

                    // Also update the node's parentId
                    savedNode.parentId = parentId;
                    await savedNode.save();
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
                        const timeDiff = Math.abs(index);

                        // (A) Reply Score
                        const isRecent = timeDiff <= SideraConfig.Connect.explicit.window;
                        const replyDecay = Math.exp(-timeDiff / 20);
                        let replyScore = sim * replyDecay;

                        // (B) Topic Score
                        const topicDecay = Math.exp(-timeDiff / SideraConfig.Connect.implicit.decayLambda);
                        let topicScore = sim * topicDecay;

                        return { node: cand, replyScore, topicScore, index };
                    });

                    // 3. AI Verification Step
                    // Strategy: Widen the net (Score > 0.60, Top 15)
                    const potentialMatches = scoredCandidates
                        .filter(c => c.replyScore > 0.60)
                        .slice(0, 15);

                    let verifiedIds = new Set();

                    if (potentialMatches.length > 0) {
                        const candidatesForAI = potentialMatches.map(c => ({
                            id: c.node._id.toString(),
                            topic: c.node.topicSummary || c.node.summary
                        }));

                        console.log(`[Background] Verifying ${potentialMatches.length} candidates for "${newNode.topicSummary}"...`);
                        const verificationResults = await aiService.checkTopicRelevance(newNode.topicSummary, candidatesForAI);

                        potentialMatches.forEach(c => {
                            const id = c.node._id.toString();
                            const res = verificationResults[id];
                            if (res && res.related) {
                                verifiedIds.add(id);
                                console.log(`  [Verified] MATCH: "${c.node.topicSummary}" (Reason: ${res.reason})`);
                            } else {
                                // console.log(`  [Verified] REJECT: "${c.node.topicSummary}"`);
                            }
                        });
                    }

                    // 4. Select EXPLICIT Edges (> 0.82)
                    const SEMANTIC_EXPLICIT_THRESHOLD = 0.82;

                    const explicitCandidates = scoredCandidates
                        .filter(c => verifiedIds.has(c.node._id.toString())) // Verified Only
                        .filter(c => cosineSimilarity(newNode.summaryEmbedding, c.node.summaryEmbedding) >= SEMANTIC_EXPLICIT_THRESHOLD)
                        .sort((a, b) => b.topicScore - a.topicScore)
                        .slice(0, SideraConfig.Connect.explicit.limit);

                    for (let i = 0; i < explicitCandidates.length; i++) {
                        const cand = explicitCandidates[i];
                        const candId = cand.node._id.toString();
                        const rawSim = cosineSimilarity(newNode.summaryEmbedding, cand.node.summaryEmbedding);

                        // Check existing
                        const existingEdge = await Edge.findOne({ source: candId, target: savedNode._id });

                        if (existingEdge) {
                            existingEdge.type = 'explicit';
                            await existingEdge.save();
                            console.log(`[Connect] Upgraded Edge -> Explicit (${rawSim.toFixed(3)})`);
                        } else {
                            const edge = new Edge({ projectId, source: candId, target: savedNode._id, type: 'explicit' });
                            await edge.save();
                            console.log(`[Connect] New Explicit Edge (${rawSim.toFixed(3)})`);
                        }

                        if (i === 0 && !savedNode.parentId) {
                            savedNode.parentId = candId;
                            await savedNode.save();
                        }
                    }

                    // 5. Select IMPLICIT Edges (< 0.82)
                    // Logic Update: Any Verified connection below 0.82 is Implicit (Floor is effectively 0.60 from pre-filter)

                    const explicitIds = explicitCandidates.map(c => c.node._id.toString());

                    const implicitCandidates = scoredCandidates
                        .filter(c => !explicitIds.includes(c.node._id.toString())) // Not already explicit
                        .filter(c => verifiedIds.has(c.node._id.toString())) // Verified Only
                        .filter(c => {
                            const rawSim = cosineSimilarity(newNode.summaryEmbedding, c.node.summaryEmbedding);
                            return rawSim < SEMANTIC_EXPLICIT_THRESHOLD; // Only upper bound check
                        })
                        .sort((a, b) => b.topicScore - a.topicScore)
                        .slice(0, SideraConfig.Connect.implicit.limit);

                    for (const cand of implicitCandidates) {
                        const rawSim = cosineSimilarity(newNode.summaryEmbedding, cand.node.summaryEmbedding);

                        // Check existing to avoid dups
                        const existing = await Edge.findOne({ source: cand.node._id, target: savedNode._id });
                        if (!existing) {
                            const edge = new Edge({ projectId, source: cand.node._id, target: savedNode._id, type: 'implicit' });
                            await edge.save();
                            console.log(`[Connect] New Implicit Edge (${rawSim.toFixed(3)})`);
                        }
                    }
                }
                console.log("[Background] Connection processing complete.");

            } catch (bgError) {
                console.error("[Background Error]", bgError);
            }
        })(); // End Background IIFE

    } catch (err) {
        console.error("Chat Error:", err.message, err.stack);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
