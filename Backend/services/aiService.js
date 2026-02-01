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
    // generationConfig: { responseMimeType: "application/json" } // Not supported by Gemma 3 yet
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

async function generateResponse(prompt, context = "") {
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
      1. Analyze the user's input and provide a helpful, engaging response.
      2. Extract 1-3 short keywords (noun phrases).
      3. Rate importance (1=Trivial, 3=Standard, 5=Crucial/Milestone).
      4. **Summarize** the interaction in one concise sentence (Subject + Action + Result).

      User Input: "${prompt}"
      
      Respond STRICTLY in this JSON format:
      {
        "answer": "Your detailed response...",
        "summary": "User asked about X, explained Y.",
        "keywords": ["keyword1", "keyword2"],
        "importance": 3
      }
    `;

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();
        console.log(`[AI Raw Text]`, text);

        // Safety parse
        try {
            const jsonText = text.replace(/```json\n|\n```/g, '').replace(/```/g, '');
            return JSON.parse(jsonText);
        } catch (e) {
            console.error("JSON Parse Error:", text);
            return {
                answer: text,
                summary: "Interaction about " + prompt.substring(0, 20),
                keywords: ["Thought"],
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

module.exports = { generateResponse, getEmbedding };
