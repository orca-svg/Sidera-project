const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) console.log(`[AI Configuration] No API Key found.`);

const genAI = new GoogleGenerativeAI(apiKey || 'INVALID_KEY_PLACEHOLDER');

const model = genAI.getGenerativeModel({
    model: "gemma-3-27b-it",
});

// User Request: Consolidate to ONLY gemma-3-27b-it + embeddings
// We reuse the main model instance for verification to stick to the requested stack.
const verificationModel = model;

const embeddingModel = genAI.getGenerativeModel({
    model: "gemini-embedding-001"
});

// Helper: Retry with Exponential Backoff for 503 Errors
async function retryWithBackoff(fn, retries = 3, delay = 2000) {
    try {
        return await fn();
    } catch (err) {
        if (retries > 0 && (err.message.includes('503') || err.message.includes('overloaded'))) {
            console.warn(`[AI Service] 503 Overloaded. Retrying in ${delay}ms... (${retries} left)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryWithBackoff(fn, retries - 1, delay * 2);
        }
        throw err;
    }
}

async function getEmbedding(text) {
    try {
        if (!text || typeof text !== 'string') return [];
        // Use retry for embeddings too
        const result = await retryWithBackoff(() => embeddingModel.embedContent(text));
        return result.embedding.values;
    } catch (error) {
        console.error("Error generating embedding:", error);
        return [];
    }
}

/**
 * Generate a response using Google Gemini (with Retries)
 */
/**
 * Generate a response using Google Gemini (with Retries & Prompt Engineering)
 */
async function generateResponse(prompt, context = "", settings = {}) {
    try {
        if (!apiKey) return { answer: "API Key Missing", summary: "Error", keywords: [], importance: 1 };

        // Prompt modified to include short summaries for UI display
        const fullPrompt = `
      You are Sidera, a wise and helpful AI assistant.
      While you appreciate astronomical metaphors and a calm, starry tone, **you must answer ALL user questions** regardless of the topic (e.g., food, music, daily life, coding).
      Do NOT refuse to answer non-astronomical questions. Be knowledgeable and witty.

      [Context] ${context || "None"}

      Task:
      1. Analyze user input and provide a helpful response in **Korean** (key: "answer").
      2. **English Topic (Vector Key)**: Extract core entities and categories as a comma-separated list. 
         - Format: "Entity1, Entity2, Category"
         - Rule: NO sentences. NO verbs. NO "User asked about".
         - Example: "Day6, JYP Entertainment, K-pop Band" (Good)
         - Example: "SQL, Database, Query Language" (Good)
         - Example: "Food recommendations, KAIST area, Bakery" (Good for local query)
      3. **Short Title (UI)**: A very short Korean title (max 10 chars) for the sidebar/star label. (key: "shortTitle")
      4. **Summary (Memory)**: Summarize the KEY FACTS from your answer in one Korean sentence.
         - Rule: Do NOT start with "User asked..." or "The user wants...". Just state the fact.
         - Example: "Day6는 JYP 소속의 4인조 밴드이다."
      5. **Importance**: Rate the semantic depth/importance (0.0 to 1.0) and Star Count (1-5).
         - Note: The first message in a project is always the Anchor (1.0/5★), but please evaluate this normally as well.

      User Input: "${prompt}"
      
      Respond STRICTLY in JSON:
      {
        "answer": "...",
        "englishTopic": "Entity1, Entity2, Category", 
        "shortTitle": "...",
        "summary": "...",
        "importanceScore": 0.0-1.0,
        "importance": 1-5
      }
    `;

        const generationConfig = {
            temperature: settings.temperature || 0.7,
            maxOutputTokens: settings.maxTokens || 1000,
        };

        const result = await retryWithBackoff(() => model.generateContent({
            contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
            generationConfig
        }));
        const response = await result.response;
        const text = response.text();

        let parsed;
        try {
            // Robust check for JSON block
            const jsonBlock = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
            const rawJson = jsonBlock ? jsonBlock[1] || jsonBlock[0] : text;
            parsed = JSON.parse(rawJson);
        } catch (e) {
            console.error("JSON Parsing Failed, using fallback. Raw text:", text);
            parsed = {
                answer: text.replace(/```json[\s\S]*```/g, '').substring(0, 500),
                summary: "Interaction",
                topicSummary: "Topic",
                shortTitle: "New Chat",
                keywords: [],
                starLabel: "Star"
            };
        }

        // --- STRICT SANITIZATION ---
        if (typeof parsed.topicSummary !== 'string') parsed.topicSummary = "Topic";
        if (parsed.topicSummary.length > 40) parsed.topicSummary = parsed.topicSummary.substring(0, 40);

        if (typeof parsed.shortTitle !== 'string') parsed.shortTitle = "Chat";
        if (parsed.shortTitle.length > 20) parsed.shortTitle = parsed.shortTitle.substring(0, 20);

        if (typeof parsed.starLabel !== 'string') parsed.starLabel = "Star";
        if (parsed.starLabel.length > 20) parsed.starLabel = parsed.starLabel.substring(0, 20);

        if (!Array.isArray(parsed.keywords)) parsed.keywords = [];
        parsed.keywords = parsed.keywords.slice(0, 5).map(k => String(k).substring(0, 15));

        // Ensure numeric importance
        let rawScore = parseFloat(parsed.importanceScore);
        if (isNaN(rawScore)) rawScore = 0.5;
        parsed.importanceScore = rawScore;
        const SideraConfig = require('./aiService').SideraConfig || { IS: { percentiles: { p5: 0.9, p4: 0.8, p3: 0.5, p2: 0.2 } } };
        // Simple star calc directly if config issues
        if (rawScore >= 0.9) parsed.importance = 5;
        else if (rawScore >= 0.8) parsed.importance = 4;
        else if (rawScore >= 0.5) parsed.importance = 3;
        else if (rawScore >= 0.2) parsed.importance = 2;
        else parsed.importance = 1;

        return parsed;

    } catch (error) {
        console.error("Error generating response:", error);
        return { answer: "Error: Service Unavailable or Overloaded.", summary: "Error", keywords: [], importance: 1 };
    }
}

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
            threshold: 0.829, // Lowered from 0.88 to capture "Singer" <-> "TV Show" (Score ~0.83)
            limit: 2 // Top-2 matches
        },
        implicit: {
            window: 50,
            threshold: 0.78, // Raised from 0.65
            limit: 3, // Top-3
            decayLambda: 50 // Time decay constant
        }
    }
};

// --- HELPER METRICS (Heuristics) ---
function calculateImportanceMetrics(text, role) {
    if (!text) return 0;
    // ...

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
        // DEBUG LOG
        console.log(`[Embedding Input] "${text.substring(0, 40)}..." (len: ${text.length})`);

        // Specify taskType for better separation
        const result = await embeddingModel.embedContent({
            content: { role: "user", parts: [{ text }] },
            taskType: "SEMANTIC_SIMILARITY"
        });
        return result.embedding.values;
    } catch (error) {
        console.error("[Embedding Error]", error);
        return null;
    }
}

// NEW: Translate and Embed (Fix for Korean Vector Collapse)
async function getEnglishEmbedding(text) {
    if (!apiKey || !text) return null;
    try {
        // 1. Translate
        // Use a separate prompt just for translation to avoid context pollution
        const translationResult = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: `Translate the following Korean text to English for technical classification. Return ONLY the English text, no explanations.\n\nText: "${text}"` }] }]
        });
        const englishText = translationResult.response.text().trim();
        console.log(`[Translation] "${text.substring(0, 15)}..." -> "${englishText.substring(0, 30)}..."`);

        // 2. Embed
        return await getEmbedding(englishText);
    } catch (error) {
        console.error("[English Embedding Error]", error);
        return null; // Fallback
    }
}



async function generateTitle(text) {
    // ...
}

// NEW: Translate and Embed (Fix for Korean Vector Collapse)
async function getEnglishEmbedding(text) {
    if (!apiKey || !text) return null;
    try {
        // 1. Translate
        const translationResult = await retryWithBackoff(() => verificationModel.generateContent({
            contents: [{ role: "user", parts: [{ text: `Translate the following Korean text to English for technical classification. Return ONLY the English text.\n\nText: "${text}"` }] }]
        }));
        const englishText = translationResult.response.text().trim();
        console.log(`[Translation] "${text.substring(0, 15)}..." -> "${englishText.substring(0, 30)}..."`);

        // 2. Embed
        return await getEmbedding(englishText);
    } catch (error) {
        console.error("[English Embedding Error]", error);
        return null; // Fallback or handle error
    }
}

// NEW: Verify Relevance with LLM (Gatekeeper)
async function checkTopicRelevance(newTopic, candidates) {
    // candidates: [{ id: '...', topic: '...' }]
    if (!candidates || candidates.length === 0) return {};

    const candidateList = candidates.map((c, i) => `${i + 1}. ${c.topic} (ID: ${c.id})`).join('\n');
    const prompt = `
    Analyze the semantic relationship between the Main Topic and the Candidate Topics.
    Determine if they are conceptually related (True) or unrelated (False).
    
    Main Topic: "${newTopic}"
    
    Candidates:
    ${candidateList}
    
    Rules:
    - Return "true" only if they share a specific context (e.g., Singer & Song, University & Food nearby, Tech & Tech).
    - Return "false" if they are only vaguely related or completely different (e.g., Band vs SQL, Food vs Database).
    - Be strict. False positives are worse than false negatives.
    
    Respond STRICTLY in JSON format:
    {
        "results": [
            { "id": "candidate_id", "related": true, "reason": "Reason..." },
            ...
        ]
    }
    `;

    try {
        const result = await retryWithBackoff(() => verificationModel.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }]
            // generationConfig: { responseMimeType: "application/json" } // REMOVED: Incompatible with some models
        }));

        let text = result.response.text();
        // Manual cleanup for JSON markdown
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const json = JSON.parse(text);

        // Convert to Map for easy lookup
        const lookup = {};
        if (json.results && Array.isArray(json.results)) {
            json.results.forEach(r => {
                lookup[r.id] = r;
            });
        }
        return lookup;
    } catch (e) {
        console.error("[Relevance Check Error]", e);
        return {}; // Return empty means no verification (or fail safe open? maybe fail safe closed currently)
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
    calculateStarRating,
    getEnglishEmbedding,
    checkTopicRelevance // Exported
};
