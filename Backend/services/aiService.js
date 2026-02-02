const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const apiKey = process.env.GOOGLE_API_KEY;
console.log(`[AI Configuration] API Key Status: ${apiKey ? 'Present' : 'Missing'}`);
if (!apiKey) {
    console.log(`[AI Configuration] No API Key found in process.env.GOOGLE_API_KEY`);
}

// Fallback safety: If no key, don't crash immediately, but the first call will fail.
const genAI = new GoogleGenerativeAI(apiKey || 'INVALID_KEY_PLACEHOLDER');

const model = genAI.getGenerativeModel({
    model: "gemma-3-27b-it",
    // generationConfig: { responseMimeType: "application/json" } 
});

const embeddingModel = genAI.getGenerativeModel({
    model: "text-embedding-004"
});

async function getEmbedding(text) {
    if (!apiKey || !text) return null;
    try {
        const result = await embeddingModel.embedContent(text);
        return result.embedding.values; // Array of numbers
    } catch (error) {
        console.error("[Embedding Error]", error);
        return null; // Fail gracefully
    }
}

async function generateResponse(prompt, context = "", settings = {}) {
    try {
        if (!apiKey) {
            console.error("[AI Generation Error] No API Key available.");
            return {
                answer: "I cannot think right now because my API Key is missing. Please configure the .env file.",
                summary: "API Key Missing Error",
                keywords: ["System Error"],
                importance: 5
            };
        }

        const fullPrompt = `
      You are a wise and poetic astronomical guide named "Sidera".
      
      [Context Memory]
      ${context ? `Relevant past memories:\n${context}` : "No specific relevant memories found, rely on general knowledge."}

      Task:
      1. Analyze the user's input and provide a helpful, engaging response in **Korean** (한국어).
      2. Extract 1-3 short keywords (noun phrases in **Korean**).
      3. **Rate Importance (Sidera-IS)** on a scale of 1-5 based on the following rubric:
         - **5 (Critical)**: High information gain (novelty), concrete stats, or major decision/milestone (agreement, proposal).
         - **4 (High)**: Detailed explanation, specific examples, clarifying complex topics.
         - **3 (Medium)**: Standard relevant info, context elaboration.
         - **2 (Low)**: Minor details, repetitive confirmation, simple agreement.
         - **1 (Trivial)**: Greetings, phatic communication ("Okay", "Hello"), pure reaction.
      4. **Summarize** the interaction in one concise sentence in **Korean**.

      User Input: "${prompt}"
      
      Respond STRICTLY in this JSON format:
      {
        "answer": "Your detailed response in Korean...",
        "summary": "User asked about X, explained Y (in Korean).",
        "keywords": ["keyword1", "keyword2"],
        "importance": 3
      }
    `;

        // Dynamic Configuration
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
        console.log(`[AI Raw Text]`, text);

        // Safety parse
        try {
            const jsonText = text.replace(/```json\n|\n```/g, '').replace(/```/g, '');
            return JSON.parse(jsonText);
        } catch (e) {
            console.warn("[AI Service] JSON Parse Failed (likely truncated). Attempting repair.");

            // Attempt to extract the "answer" field content even if truncated
            // Matches: "answer": "..... (until end of string or closing quote)
            const answerMatch = text.match(/"answer"\s*:\s*"([^"]*)/s);
            let cleanedText = answerMatch ? answerMatch[1] : text;

            // Remove any trailing markdown artifacts if the match failed and we used raw text
            if (!answerMatch) {
                cleanedText = cleanedText.replace(/```json|```/g, '').replace(/[\{\}]/g, '').trim();
            }

            return {
                answer: cleanedText + " (Response truncated...)",
                summary: "Interaction (Truncated)",
                keywords: ["Truncated"],
                importance: 2
            };
        }
    } catch (error) {
        console.error("AI Generation Error:", error);
        return {
            answer: "I am unable to contemplate that at the moment.",
            summary: "Error occurred",
            keywords: ["Error"],
            importance: 1
        };
    }
}

async function generateTitle(text) {
    if (!apiKey || !text) return "New Conversation";
    try {
        const prompt = `
        Task: Generate a concise, engaging title (3-6 words) in **Korean** for a conversation that begins with the following user input.
        The title should reflect the core topic.
        Input: "${text}"
        Output: Just the title text in Korean. No quotes, no "Title:", no markdown.
        `;

        const result = await model.generateContent(prompt);
        const title = result.response.text().trim().replace(/^"|"$/g, '').replace(/\*\*/g, '');
        return title || "New Conversation";
    } catch (error) {
        console.error("[AI Title Error]", error);
        return "New Conversation";
    }
}

module.exports = { generateResponse, getEmbedding, generateTitle };
