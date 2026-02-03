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
        // Docs: 5★=Top 10%, 4★=Top 20%, 3★=Top 50%, 2★=Top 80%, 1★=Bottom 20%
        percentiles: { p5: 0.90, p4: 0.80, p3: 0.50, p2: 0.20 },
        // Boost factor for first node and important content
        boostMultiplier: 1.5
    },
    Connect: { // Edge Generation
        explicit: {
            window: 15,
            threshold: 0.55, // Lowered from 0.70 for more explicit connections
            limit: 2 // Top-2 matches
        },
        implicit: {
            window: 50,
            threshold: 0.35, // Lowered from 0.45 for more implicit connections
            limit: 3, // Top-3
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
    const lengthScore = Math.min(text.length / 300, 1); // Lowered from 500 for more sensitivity
    const hasSpecialChars = /[A-Z0-9$€£%]/.test(text) ? 0.2 : 0;
    const hasKoreanContent = /[가-힣]{10,}/.test(text) ? 0.3 : 0; // Korean content bonus
    const infoScore = Math.min((numberCount * 0.15) + (quoteCount * 0.25) + lengthScore + hasSpecialChars + hasKoreanContent, 1);

    // (B) Func Score: Speech Acts - More generous detection
    const funcPatterns = {
        decision: /(결정|확정|합의|결론|Action|제안|동의|해야|됩니다|입니다)/i,
        question: /\?|까\?|나요\?|왜|무엇|어떻게|어디|누가|언제/,
        request: /(부탁|요청|해주세요|해줘|알려)/,
        explanation: /(때문|이유|원리|방법|과정)/
    };
    let funcScore = 0.4; // Higher base
    if (funcPatterns.decision.test(text)) funcScore += 0.35;
    if (funcPatterns.question.test(text)) funcScore += 0.25;
    if (funcPatterns.request.test(text)) funcScore += 0.15;
    if (funcPatterns.explanation.test(text)) funcScore += 0.2;
    funcScore = Math.min(funcScore, 1);

    // (C) Struct Score: Centrality / Reference
    const refCount = (text.match(/@|#|이전|아까|앞서|관련/g) || []).length;
    const structScore = Math.min(0.3 + (refCount * 0.2), 1); // Higher base

    // Weighted Sum with boost
    let finalScore = (infoScore * SideraConfig.IS.weights.info) +
        (structScore * SideraConfig.IS.weights.struct) +
        (funcScore * SideraConfig.IS.weights.func);

    // Apply minimum floor for non-trivial content
    if (text.length > 50) {
        finalScore = Math.max(finalScore, 0.35); // Minimum score for substantial content
    }

    return parseFloat(Math.min(finalScore, 1).toFixed(3));
}

function calculateStarRating(score, scoreHistory = [], rootScore = null) {
    // 0. Root Anchor Calibration
    // The root score (first conversation) sets the "quality bar" for the entire project
    // High rootScore → higher thresholds for 5 stars
    // Low rootScore → lower thresholds (easier to get high stars)

    const effectiveHistory = [...scoreHistory];

    // 1. Cold Start Handling with Root Anchor Calibration
    if (effectiveHistory.length < 3) {
        // Very early conversations - use root-calibrated absolute thresholds
        if (rootScore !== null && rootScore > 0) {
            // Calculate thresholds based on rootScore as the "quality bar"
            // If rootScore is high (0.8+), set high bar. If low (0.4), set low bar.
            const calibrationFactor = rootScore; // 0.0 ~ 1.0

            // Threshold adjustment: higher rootScore = higher thresholds
            const t5 = 0.5 + (calibrationFactor * 0.35); // Range: 0.50 ~ 0.85
            const t4 = 0.4 + (calibrationFactor * 0.25); // Range: 0.40 ~ 0.65
            const t3 = 0.25 + (calibrationFactor * 0.15); // Range: 0.25 ~ 0.40
            const t2 = 0.1 + (calibrationFactor * 0.1);  // Range: 0.10 ~ 0.20

            if (score >= t5) return 5;
            if (score >= t4) return 4;
            if (score >= t3) return 3;
            if (score >= t2) return 2;
            return 1;
        }

        // No root score yet - use default generous thresholds
        if (score >= 0.5) return 5;
        if (score >= 0.35) return 4;
        if (score >= 0.25) return 3;
        if (score >= 0.15) return 2;
        return 1;
    }

    // 2. Inject Root Anchor into Distribution (weighted presence)
    if (rootScore !== null && rootScore > 0) {
        // Add root score multiple times to influence the distribution
        const weight = Math.max(3, Math.floor(effectiveHistory.length * 0.3)); // 3 ~ 30% of history size
        for (let i = 0; i < weight; i++) effectiveHistory.push(rootScore);
    }

    // 3. Percentile-based Mapping (for established conversations)
    const sorted = effectiveHistory.sort((a, b) => a - b);
    const getPercentileVal = (p) => sorted[Math.floor(sorted.length * p)] || 0;

    // Calculate Cutoffs based on docs: 5★=Top10%, 4★=Top20%, 3★=Top50%, 2★=Top80%
    const p90 = getPercentileVal(0.90);
    const p80 = getPercentileVal(0.80);
    const p50 = getPercentileVal(0.50);
    const p20 = getPercentileVal(0.20);

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

        // Prompt modified to include short summaries for UI display
        const fullPrompt = `
      You are Sidera, a wise astronomical guide.
      [Context] ${context || "None"}

      Task:
      1. Analyze user input and provide a helpful response in **Korean**.
      2. Extract 1-3 short noun keywords (Korean).
      3. Summarize the interaction in one Korean sentence.
      4. Create a very short title (max 10 Korean characters) for sidebar display.
      5. Create a star label (max 15 Korean characters, preferably 2 words) for constellation view.

      User Input: "${prompt}"
      
      Respond STRICTLY in JSON:
      {
        "answer": "Response...",
        "summary": "Full summary sentence...",
        "keywords": ["kw1", "kw2"],
        "shortTitle": "초간결제목",
        "starLabel": "별 라벨"
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
