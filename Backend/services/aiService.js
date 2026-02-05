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

// --- HUGGING FACE INFERENCE API ---
const HF_TOKEN = process.env.IMAGE_HUGGING_FACE_API || process.env.HUGGING_FACE_TOKEN;

/**
 * Generate a Mythical Constellation Image using Star Coordinates
 * @param {Array} starPositions - Array of {x, y, z, label} objects representing star positions
 * @param {string} topic - The constellation name/topic
 * @returns {string|null} - The generated image as base64
 */
async function generateMythicalImage(starPositions, topic) {
    if (!HF_TOKEN) {
        console.warn("[AI] No HuggingFace Token found. Skipping image generation.");
        return null;
    }

    try {
        // Step 1: Analyze constellation shape using Gemini
        let shapeDescription = topic;
        try {
            // Normalize coordinates to 2D for shape analysis
            const coords = starPositions.map(p => `(${Math.round(p.x)}, ${Math.round(p.y)})`).join(', ');

            const shapePrompt = `You are analyzing a constellation made of ${starPositions.length} stars.
The star coordinates are: ${coords}

The constellation is named "${topic}".

Based on these coordinates AND the name, describe WHAT OBJECT this constellation represents.
CRITICAL: Return a SINGULAR NOUN phrase (e.g., "a cherry" NOT "cherries").
Focus on the visual shape that these connected points would form.
Respond ONLY with the object description in English, nothing else.

Example outputs: "a single soaring eagle", "a singular old radio", "one spiral galaxy", "a single coffee cup"`;

            const shapeResult = await model.generateContent(shapePrompt);
            shapeDescription = shapeResult.response.text().trim() || topic;
            console.log(`[AI] Shape analysis: "${topic}" with ${starPositions.length} stars → "${shapeDescription}"`);
        } catch (shapeErr) {
            console.warn(`[AI] Shape analysis failed: ${shapeErr.message}`);
        }

        console.log(`[AI] Generating image for "${shapeDescription}" via FLUX.1...`);

        // Use FLUX.1-schnell via HF Router (Better at following "single object" constant)
        const endpoint = "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell";

        // FLUX Prompt: Very direct, no negative prompt needed usually
        const prompt = `A single ${shapeDescription}, minimalist glowing icon style, centered on pure black background. Vector art, clean lines, simple silhouette, no background, high contrast. One object only.`;

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${HF_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: {
                    // FLUX doesn't strictly need negative_prompt like SDXL
                    num_inference_steps: 4
                }
            }),
        });

        if (!response.ok) {
            // Handle loading state (503)
            if (response.status === 503) {
                console.warn("[AI] HF Model Loading, retrying in 20s...");
                await new Promise(r => setTimeout(r, 20000)); // Wait 20s for cold boot
                return generateMythicalImage(starPositions, topic); // Retry once
            }
            const errorText = await response.text();
            throw new Error(`HF API Error: ${response.status} - ${errorText}`);
        }

        const checkBlob = await response.blob();
        const arrayBuffer = await checkBlob.arrayBuffer();
        let imageBuffer = Buffer.from(arrayBuffer);

        console.log(`[AI] Generated base image for "${topic}" (${imageBuffer.length} bytes)`);

        // Step 2: Remove background using BRIA RMBG-1.4 (fallback from 2.0)
        try {
            console.log(`[AI] Removing background...`);
            const rmbgEndpoint = "https://router.huggingface.co/hf-inference/models/briaai/RMBG-1.4";

            const rmbgResponse = await fetch(rmbgEndpoint, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${HF_TOKEN}`,
                    "Content-Type": "application/octet-stream",
                },
                body: imageBuffer,
            });

            if (rmbgResponse.ok) {
                const rmbgBlob = await rmbgResponse.blob();
                const rmbgArrayBuffer = await rmbgBlob.arrayBuffer();
                imageBuffer = Buffer.from(rmbgArrayBuffer);
                console.log(`[AI] Background removed successfully (${imageBuffer.length} bytes)`);
            } else {
                console.warn(`[AI] Background removal failed (${rmbgResponse.status}), using additive blend fallback`);
            }
        } catch (rmbgErr) {
            console.warn(`[AI] Background removal error: ${rmbgErr.message}`);
        }

        // Return as PNG with potential transparency
        return `data:image/png;base64,${imageBuffer.toString('base64')}`;

    } catch (error) {
        console.error("[AI] Mythical Image Generation Failed:", error.message);
        return null;
    }
}

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
        // CRITICAL: Use taskType to prevent false positive similarity (e.g., "baseball" vs "physics")
        // Without taskType, unrelated topics may produce inflated similarity scores
        const result = await retryWithBackoff(() => embeddingModel.embedContent({
            content: { parts: [{ text: text }] },
            taskType: "SEMANTIC_SIMILARITY"  // Required for proper topic discrimination
        }));
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
      1. **Analyze User Intent** (Classification):
         - **Conceptual Inquiry**: Asking for definitions, origins, core principles (e.g., "What is love?", "Define Redux"). -> **5 Stars (0.9-1.0)**
         - **Strategic/Deep Dive**: Asking for methods, comparisons, complex "How-to" (e.g., "How to optimize?", "Vue vs React"). -> **4 Stars (0.7-0.9)**
         - **Contextual/Operational**: Fact-checking, status checks, code snippets (e.g., "Is it raining?", "Show code"). -> **3 Stars (0.5-0.7)**
         - **Phatic/Trivial**: Greetings, short reactions, simple acknowledge (e.g., "Hi", "Ok", "Thanks"). -> **1-2 Stars (0.1-0.4)**

      2. Provide a helpful response in **Korean** (key: "answer").
      
      3. **English Topic (Vector Key)**: Extract core entities and categories.
         - Format: "Entity1, Entity2, Category"
 
      4. **Short Title (UI)**: A very short Korean title (max 10 chars). (key: "shortTitle")
      
      5. **Summary (Memory)**: Summarize KEY FACTS in one Korean sentence.

      User Input: "${prompt}"
      
      Respond STRICTLY in JSON:
      {
        "answer": "...",
        "questionType": "Conceptual|Strategic|Contextual|Phatic",
        "englishTopic": "...", 
        "shortTitle": "...",
        "summary": "...",
        "importanceScore": 0.0-1.0
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

        // Ensure numeric importance from LLM
        let rawScore = parseFloat(parsed.importanceScore);
        if (isNaN(rawScore)) rawScore = 0.5;

        // --- APPLY HEURISTICS (Sidera-Intent) ---
        // Calculate heuristic score based on regex patterns (Question Type)
        const heuristicScore = calculateImportanceMetrics(prompt, "user");

        // Final Score = Max(LLM Score, Heuristic Score)
        // This ensures that if heuristics detect a "Critical Question" (0.85+), it overrides a low LLM score.
        parsed.importanceScore = Math.max(rawScore, heuristicScore);

        console.log(`[Importance] Text: "${prompt.substring(0, 20)}..." | LLM: ${rawScore} | Heuristic: ${heuristicScore} | Final: ${parsed.importanceScore}`);

        // Star calculation is now handled purely by visualizer based on score distribution
        // But we provide a default mapping for direct UI usage if needed
        const finalScore = parsed.importanceScore; // Use the MAX value

        if (finalScore >= 0.9) parsed.importance = 5;
        else if (finalScore >= 0.7) parsed.importance = 4;
        else if (finalScore >= 0.5) parsed.importance = 3;
        else if (finalScore >= 0.2) parsed.importance = 2;
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
// --- HELPER METRICS (Heuristics for Sidera-Intent) ---
function calculateImportanceMetrics(text, role) {
    if (!text) return 0;

    // 0. Phatic (Greeting/Trivial) Detection - PENALIZE
    const phaticPatterns = /(^안녕|^하이|^헬로|^ㅋㅋ|^ㅎㅎ|^ㅇㅇ|^오케이|^알겠어$|^고마워$|^감사$)/i;
    if (phaticPatterns.test(text.trim())) {
        return 0.15; // Very low score for greetings/reactions
    }

    // 1. Inquiry Depth Score (Question Quality)
    const inquiryPatterns = {
        // Extended: Added colloquial "뭐", academic terms
        concept: /(정의|무엇|뭐야|뭔가|뭐지|뭔데|뜻|의미|유래|기원|원리|방정식|이론|법칙|개념|Definition|What is|Explain)/i,
        strategy: /(방법|어떻게|전략|효율|비교|차이|최적화|설계|구현|How to|Compare|Strategy|Optimize)/i,
        context: /(확인|상태|코드|보여|줘|언제|누가|어디|Check|Status|Show)/i
    };

    let inquiryScore = 0.3; // Base
    if (inquiryPatterns.concept.test(text)) inquiryScore = 0.85;     // Conceptual = High
    else if (inquiryPatterns.strategy.test(text)) inquiryScore = 0.7; // Strategic = Medium-High
    else if (inquiryPatterns.context.test(text)) inquiryScore = 0.5;  // Contextual = Medium

    // 2. Academic/Term Bonus (Boost for technical language)
    const academicTerms = /(물리|수학|화학|생물|역학|양자|상대성|슈뢰딩거|아인슈타인|뉴턴|알고리즘|자료구조|데이터베이스)/i;
    if (academicTerms.test(text)) inquiryScore = Math.min(inquiryScore + 0.15, 1.0);

    // 3. Info Density (Supporting Metric) - Reduced weight
    const lengthScore = Math.min(text.length / 500, 1);
    const hasSpecialChars = /[A-Z0-9$€£%]/.test(text) ? 0.1 : 0;
    const infoScore = (lengthScore * 0.7) + (hasSpecialChars * 0.3);

    // 4. Structural Utility
    const refCount = (text.match(/@|#|이전|앞서/g) || []).length;
    const structScore = Math.min(refCount * 0.2, 0.4);

    // Final Weighted Sum
    // Intent (70%) + Info (20%) + Structure (10%)
    let finalScore = (inquiryScore * 0.7) + (infoScore * 0.2) + (structScore * 0.1);

    // Cap at 1.0
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
    checkTopicRelevance, // Exported
    generateMythicalImage
};
