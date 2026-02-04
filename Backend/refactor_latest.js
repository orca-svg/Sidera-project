const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });
const Node = require('./models/Node');
const Edge = require('./models/Edge');
const Project = require('./models/Project');
const { SideraConfig, calculateImportanceMetrics, calculateStarRating } = require('./services/aiService');

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/sidera";

// Cosine Similarity Helper (Duplicated for standalone safety or imported if moved to utils)
function cosineSim(vecA, vecB) {
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

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");

    // 1. Find Latest Project
    const project = await Project.findOne().sort({ updatedAt: -1 });
    if (!project) {
      console.log("No projects found.");
      process.exit(0);
    }
    const projectId = project._id;
    console.log(`Refactoring Project: "${project.name}" (${projectId})`);

    // 2. Fetch all nodes
    const nodes = await Node.find({ projectId }).sort({ createdAt: 1 });
    console.log(`Processing ${nodes.length} nodes...`);

    // 3. Sidera-IS v2: Recalculate Node Importance Retroactively
    console.log("--- Updating Node Importance (Sidera-IS v2) ---");
    const nodeScores = [];
    const rootNode = nodes.length > 0 ? nodes[0] : null; // Assume sorted by createdAt logic above

    // Pass 1: Calculate Raw Scores
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const text = (node.answer || "") + " " + (node.question || "");

      let rawScore = 0;

      if (i === 0) {
        // Root Anchor Logic
        const isProperQuestion = node.question && node.question.length > 5 && (/\?|까\?|나요\?|왜|무엇|어떻게/i.test(node.question));
        if (isProperQuestion) {
          rawScore = 1.0;
          console.log(`  [Root Anchor] Node ${i} boosted to 1.0`);
        } else {
          rawScore = calculateImportanceMetrics(text, 'assistant');
        }
      } else {
        // Subsequent Node Logic (Standard Heuristics)
        rawScore = calculateImportanceMetrics(text, 'assistant');
      }

      node.importanceScore = rawScore; // Save raw
      nodeScores.push(rawScore);
    }

    // Determine Root Score for Percentile Shift
    const rootScore = (nodes.length > 0 && nodes[0].importanceScore) ? nodes[0].importanceScore : null;

    // Pass 2: Calculate Stars based on Distribution & Save
    for (const node of nodes) {
      const oldImport = node.importance;
      // Pass rootScore to adjust percentiles
      const newImport = calculateStarRating(node.importanceScore, nodeScores, rootScore);
      node.importance = newImport;
      await node.save();
      if (oldImport !== newImport) {
        // console.log(`  [Star Update] Node ${node._id}: ${oldImport} -> ${newImport}`);
      }
    }
    console.log("Node importance updated.");


    // 4. Sidera-Connect: Regenerate Edges
    console.log("--- Regenerating Edges (Sidera-Connect) ---");
    await Edge.deleteMany({ projectId });
    console.log("Cleared old edges.");

    const newEdges = [];

    for (let i = 0; i < nodes.length; i++) {
      const currentNode = nodes[i];
      const prevNode = i > 0 ? nodes[i - 1] : null;

      // A. Temporal Edge (Backbone)
      if (prevNode) {
        newEdges.push(new Edge({
          projectId,
          source: prevNode._id,
          target: currentNode._id,
          type: 'temporal'
        }));
      }

      // B. Semantic Edges
      if (currentNode.summaryEmbedding && currentNode.summaryEmbedding.length > 0) {
        const startIndex = Math.max(0, i - 50);
        const candidates = nodes.slice(startIndex, i).map((n, idx) => {
          const globalIndex = startIndex + idx;
          const timeDiff = Math.abs(i - globalIndex);
          const sim = cosineSim(currentNode.summaryEmbedding, n.summaryEmbedding);

          // Reply Score
          const replyDecay = Math.exp(-timeDiff / 20);
          const replyScore = sim * replyDecay;

          // Topic Score
          const topicDecay = Math.exp(-timeDiff / SideraConfig.Connect.implicit.decayLambda);
          const topicScore = sim * topicDecay;

          return { node: n, replyScore, topicScore, globalIndex };
        });

        // EXPLICIT (Top-1)
        const explicitCandidates = candidates
          .filter(c => c.replyScore >= SideraConfig.Connect.explicit.threshold)
          .sort((a, b) => b.replyScore - a.replyScore)
          .slice(0, SideraConfig.Connect.explicit.limit);

        for (const cand of explicitCandidates) {
          const candId = cand.node._id.toString();
          const isPrevNode = prevNode && (candId === prevNode._id.toString());

          if (isPrevNode) {
            // Upgrade Temporal
            const tIndex = newEdges.findIndex(e => e.type === 'temporal' && e.target.toString() === currentNode._id.toString());
            if (tIndex !== -1) {
              newEdges[tIndex].type = 'explicit';
              console.log(`  [Upgrade] Node ${i} <-> ${cand.globalIndex} (Explicit)`);
            }
          } else {
            newEdges.push(new Edge({
              projectId,
              source: candId,
              target: currentNode._id,
              type: 'explicit'
            }));
            console.log(`  [New Explicit] Node ${i} <-> ${cand.globalIndex}`);
          }
        }

        // IMPLICIT (Top-2)
        // Filter duplicates (already linked by temporal or explicit)
        const linkedSources = newEdges
          .filter(e => e.target.toString() === currentNode._id.toString())
          .map(e => e.source.toString());

        const implicitCandidates = candidates
          .filter(c => !linkedSources.includes(c.node._id.toString()))
          .filter(c => c.topicScore >= SideraConfig.Connect.implicit.threshold)
          .sort((a, b) => b.topicScore - a.topicScore)
          .slice(0, SideraConfig.Connect.implicit.limit);

        for (const cand of implicitCandidates) {
          newEdges.push(new Edge({
            projectId,
            source: cand.node._id,
            target: currentNode._id,
            type: 'implicit'
          }));
          console.log(`  [New Implicit] Node ${i} <-> ${cand.globalIndex}`);
        }
      }
    }

    if (newEdges.length > 0) {
      await Edge.insertMany(newEdges);
    }
    console.log(`Done! Created ${newEdges.length} edges.`);

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
