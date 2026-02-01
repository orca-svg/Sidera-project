const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' }); // Adjust path to reach .env in Backend root
const Node = require('../models/Node');
const aiService = require('../services/aiService');

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sidera')
    .then(() => console.log('Connected to MongoDB for Migration'))
    .catch(err => console.error('MongoDB connection error:', err));

async function migrate() {
    try {
        console.log("Starting Migration: Backfilling Embeddings...");

        // Find nodes where embeddings are missing
        const nodes = await Node.find({
            $or: [
                { summaryEmbedding: { $size: 0 } },
                { fullEmbedding: { $size: 0 } },
                { summaryEmbedding: { $exists: false } },
                { fullEmbedding: { $exists: false } }
            ]
        });

        console.log(`Found ${nodes.length} nodes to migrate.`);

        for (const [index, node] of nodes.entries()) {
            if (!node.question) {
                console.log(`[${index + 1}/${nodes.length}] Skipping corrupted node (missing question).`);
                continue;
            }
            console.log(`[${index + 1}/${nodes.length}] Processing Node: "${node.question.substring(0, 30)}..."`);

            let modified = false;

            // 1. Generate Summary if missing
            if (!node.summary) {
                console.log(`   -> Generative Summary...`);
                // Quick hack: ask AI to summarize
                const summaryPrompt = `Summarize this Q&A in one sentence (Subject+Action+Result): "${node.question}" -> "${node.answer}"`;
                // We'll reuse generateResponse but we need a 'raw' text generation. 
                // Since generateResponse returns JSON, let's try to extract just the summary from a specific call 
                // OR just use the question as a fallback summary for speed if this is too heavy.
                // Let's allow aiService.generateResponse to handle it, but we need to tweak it or just use a new simple function.
                // Actually, let's just use the question + first sentence of answer as a fallback summary to save tokens/time for now, 
                // OR strictly use the Embedding of the Question+Answer for everything if summary is hard.

                // Better approach: Let's trust getEmbedding works on text. 
                // If summary is missing, let's just use the Question as the summary for now. 
                // It's "good enough" for legacy data.
                node.summary = node.question;
                modified = true;
            }

            // 2. Generate Summary Embedding
            if (!node.summaryEmbedding || node.summaryEmbedding.length === 0) {
                // console.log(`   -> Generating Summary Embedding...`);
                const emb = await aiService.getEmbedding(node.summary);
                if (emb) {
                    node.summaryEmbedding = emb;
                    modified = true;
                }
                // Rate limit protection (simple pause)
                await new Promise(r => setTimeout(r, 200));
            }

            // 3. Generate Full Embedding
            if (!node.fullEmbedding || node.fullEmbedding.length === 0) {
                // console.log(`   -> Generating Full Embedding...`);
                const fullText = `Q: ${node.question}\nA: ${node.answer}`;
                const emb = await aiService.getEmbedding(fullText);
                if (emb) {
                    node.fullEmbedding = emb;
                    modified = true;
                }
                await new Promise(r => setTimeout(r, 200));
            }

            if (modified) {
                await node.save();
                console.log(`   -> Saved.`);
            } else {
                console.log(`   -> No changes needed.`);
            }
        }

        console.log("Migration Complete!");
        process.exit(0);

    } catch (error) {
        console.error("Migration Error:", error);
        process.exit(1);
    }
}

// Give a moment for DB connection
setTimeout(migrate, 1000);
