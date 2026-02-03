const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) console.log(`[AI Configuration] No API Key found.`);

const genAI = new GoogleGenerativeAI(apiKey || 'INVALID_KEY_PLACEHOLDER');

const model = genAI.getGenerativeModel({
    model: "gemma-3-27b-it",
});

const embeddingModel = genAI.getGenerativeModel({
    model: "text-embedding-004"
});

// --- SIDERA CONFIGURATION ---
const SideraConfig = {
    IS: { // Importance Scoring
        weights: { info: 0.5, struct: 0.3, func: 0.2 },
        percentiles: { p5: 0.90, p4: 0.80, p3: 0.50, p2: 0.20 } // Top 10% = 5, Top 20% = 4, etc.
    },
    Connect: { // Edge Generation
        explicit: {
            window: 15,
            threshold: 0.70, // ReplyScore Threshold
            limit: 1 // Top-1 only
        },
        implicit: {
            window: 50,
            threshold: 0.45, // TopicScore Threshold
            limit: 2, // Top-2
            decayLambda: 50 // Time decay constant
        }
    }
};

// --- HELPER METRICS (Heuristics) ---
function calculateImportanceMetrics(text, role) {
    if (!text) return 0;

    // (A) Info Score: Facts, Numbers, Proper Nouns, Length
    const numberCount = (text.match(/\d+/g) || []).length;
    const quoteCount = (text.match(/"[^"]*"/g) || []).length;
    const lengthScore = Math.min(text.length / 500, 1); // Cap at 500 chars
    const hasSpecialChars = /[A-Z0-9$€£%]/.test(text) ? 0.2 : 0; // Heuristic for specific info
    const infoScore = Math.min((numberCount * 0.1) + (quoteCount * 0.2) + lengthScore + hasSpecialChars, 1);

    // (B) Func Score: Speech Acts
    const funcPatterns = {
        decision: /(결정|확정|합의|결론|Action|제안|동의)/i,
        question: /\?|까\?|나요\?/,
        request: /(부탁|요청|해주세요)/
    };
    let funcScore = 0.3; // Base
    if (funcPatterns.decision.test(text)) funcScore += 0.4;
    if (funcPatterns.question.test(text)) funcScore += 0.2;
    if (funcPatterns.request.test(text)) funcScore += 0.2;
    funcScore = Math.min(funcScore, 1);

    // (C) Struct Score: Centrality / Reference
    // For real-time new nodes, we approximate by "Reference Density" (Are we quoting or linking?)
    // In batch refactor, this can be PageRank.
    const refCount = (text.match(/@|#|이전|아까/g) || []).length;
    const structScore = Math.min(0.2 + (refCount * 0.2), 1);

    // Weighted Sum
    const finalScore = (infoScore * SideraConfig.IS.weights.info) +
        (structScore * SideraConfig.IS.weights.struct) +
        (funcScore * SideraConfig.IS.weights.func);

    return parseFloat(finalScore.toFixed(3));
}

function calculateStarRating(score, scoreHistory = []) {
    // Dynamic Percentile Mapping
    if (scoreHistory.length < 10) {
        // Fallback for cold start: absolute thresholds
        if (score >= 0.8) return 5;
        if (score >= 0.6) return 4;
        if (score >= 0.4) return 3;
        if (score >= 0.2) return 2;
        return 1;
    }

    // Sort logic for percentiles (Higher is better)
    const sorted = [...scoreHistory].sort((a, b) => a - b);
    const getPercentileVal = (p) => sorted[Math.floor(sorted.length * p)];

    // Calculate Cutoffs
    const p90 = getPercentileVal(0.90); // Top 10%
    const p80 = getPercentileVal(0.80); // Top 20%
    const p50 = getPercentileVal(0.50); // Top 50%
    const p20 = getPercentileVal(0.20); // Top 80%

    if (score >= p90) return 5;
    if (score >= p80) return 4;
    if (score >= p50) return 3;
    if (score >= p20) return 2;
    return 1;
}

// --- CORE AI SERVICES ---

async function getEmbedding(text) {
    if (!apiKey || !text) return null;
    try {
        const result = await embeddingModel.embedContent(text);
        return result.embedding.values;
    } catch (error) {
        console.error("[Embedding Error]", error);
        return null;
    }
}

async function generateResponse(prompt, context = "", settings = {}) {
    try {
        if (!apiKey) return { answer: "API Key Missing", summary: "Error", keywords: [], importance: 1 };

        // Prompt modified to REMOVE scoring instruction (now handled in code)
        const fullPrompt = `
      You are Sidera, a wise astronomical guide.
      [Context] ${context || "None"}

      Task:
      1. Analyze user input and provide a helpful response in **Korean**.
      2. Extract 1-3 short noun keywords (Korean).
      3. Summarize the interaction in one Korean sentence.

      User Input: "${prompt}"
      
      Respond STRICTLY in JSON:
      {
        "answer": "Response...",
        "summary": "Summary...",
        "keywords": ["kw1", "kw2"]
      }
    `;

        const generationConfig = {
            temperature: settings.temperature || 0.7,
            maxOutputTokens: settings.maxTokens || 1000,
        };

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
            generationConfig
        });
        const response = await result.response;
        const text = response.text();

        let parsed;
        try {
            parsed = JSON.parse(text.replace(/```json\n|\n```|```/g, ''));
        } catch (e) {
            // Simple repair attempt
            const answerMatch = text.match(/"answer"\s*:\s*"([^"]*)/s);
            parsed = {
                answer: answerMatch ? answerMatch[1] : text.replace(/[\{\}]/g, '').substring(0, 200),
                summary: "Interaction",
                keywords: []
            };
        }

        // --- SIDERA-IS LOGIC APPLICATION ---
        // Calculate raw score (0-1)
        const rawScore = calculateImportanceMetrics(parsed.answer + " " + prompt, "assistant");

        // Note: The caller (chat.js) must call calculateStarRating with history
        // Here we just return the RAW score and a provisional rating (absolute)
        parsed.importanceScore = rawScore;
        parsed.importance = calculateStarRating(rawScore, []); // Provisional

        return parsed;

    } catch (error) {
        console.error("AI Generation Error:", error);
        return { answer: "Error", summary: "Error", keywords: [], importance: 1, importanceScore: 0 };
    }
}

async function generateTitle(text) {
    // ... existing logic ...
    if (!apiKey || !text) return "Sidera";
    try {
        const result = await model.generateContent(`Generate 3-5 word Korean title for: "${text}". No quotes.`);
        return result.response.text().trim();
    } catch (e) { return "New Conversation"; }
}

module.exports = {
    generateResponse,
    getEmbedding,
    generateTitle,
    SideraConfig,
    calculateImportanceMetrics,
    calculateStarRating
};
