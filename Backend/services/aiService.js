const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const apiKey = process.env.GOOGLE_API_KEY;
console.log(`[AI Configuration] API Key Status: ${apiKey ? 'Present' : 'Missing'}`);
if (apiKey) {
    console.log(`[AI Configuration] Key snippet: ${apiKey.substring(0, 10)}...`);
} else {
    console.log(`[AI Configuration] No API Key found in process.env.GOOGLE_API_KEY`);
}

// Fallback safety: If no key, don't crash immediately, but the first call will fail.
const genAI = new GoogleGenerativeAI(apiKey || 'INVALID_KEY_PLACEHOLDER');

const model = genAI.getGenerativeModel({
    model: "gemma-3-27b-it",
    // generationConfig: { responseMimeType: "application/json" } // Not supported by Gemma 3 yet
});

// Helper to safely parse AI JSON response
const parseAIResponse = (text) => {
    try {
        // 1. Remove markdown code blocks (```json ... ```)
        const cleanText = text
            .replace(/```json\n|\n```/g, '')
            .replace(/```/g, '')
            .replace(/\/\/.*$/gm, '') // Remove single-line comments
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
            .trim();

        // 2. Attempt Parse
        return JSON.parse(cleanText);
    } catch (error) {
        console.error("❌ JSON Parse Failed. Raw Text:", text);
        // 3. Fallback
        return {
            answer: text, // Show original text so user sees the answer at least
            keywords: ["Analysis Failed"],
            importance: "Beta", // Force it to appear in Topic List
            topicSummary: "Topic Analysis Failed",
            title: null
        };
    }
};

async function generateResponse(prompt, isFirstMessage = false) {
    try {
        if (!apiKey) {
            console.error("[AI Generation Error] No API Key available.");
            return {
                answer: "API Key missing.",
                keywords: ["Error"],
                importance: "Satellite",
                topicSummary: "System Error",
                title: null
            };
        }

        // 1. Response Generation Prompt
        const responsePrompt = `
      You are a JSON generator. You must respond with valid JSON only.
      
      Conversation Status: ${isFirstMessage ? "START OF NEW CHAT (Generate a Title!)" : "ONGOING CHAT"}
      User Input: "${prompt}"

      MANDATORY: Respond with this exact JSON structure (no markdown, no comments):
      {
        "answer": "String (Markdown supported)",
        "importance": "Alpha" | "Beta" | "Satellite",
        "topicSummary": "String (Max 5 words)",
        "title": "String (Project title if Status is 'START OF NEW CHAT', else null)"
      }
      
      Definitions:
      - Alpha (Priority 1): 
        * Project Initialization (Core Idea)
        * Major Pivot or Completely New Topic
        * User explicitly emphasizes importance
      - Beta (Priority 2):
        * Detailed explanation of an Alpha node
        * Code examples or implementation steps
        * Specific sub-concepts
      - Satellite (Priority 3):
        * Chit-chat, greetings, short confirmations
        * Context maintenance (e.g., "Yes", "Okay", "Tell me more")
    `;

        const result = await model.generateContent(responsePrompt);
        const response = await result.response;
        const text = response.text();

        // 2. Robust Parsing
        const data = parseAIResponse(text);

        // 3. Fallbacks for missing fields
        if (!data.topicSummary) {
            data.topicSummary = (data.keywords && data.keywords.length > 0) ? data.keywords[0] : "Topic Node";
        }
        if (!data.importance) data.importance = "Satellite";

        return data;

    } catch (error) {
        console.error("AI Generation Error:", error);
        return {
            answer: "I am unable to contemplate that at the moment.",
            keywords: ["Error"],
            importance: "Satellite",
            topicSummary: "Error"
        };
    }
}

module.exports = { generateResponse };
