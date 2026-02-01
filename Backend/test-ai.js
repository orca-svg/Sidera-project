const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const apiKey = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const modelName = "gemma-3-27b-it";

async function testAI() {
    console.log(`Testing model: ${modelName} (Key Present: ${!!apiKey})`);
    try {
        const model = genAI.getGenerativeModel({
            model: modelName
            // No generationConfig for JSON
        });

        const result = await model.generateContent("Hello, are you there?");
        const response = await result.response;
        console.log("Success! Response:", response.text());
    } catch (error) {
        console.error("Error testing AI:", error.message);
        if (error.message.includes("404") || error.message.includes("not found")) {
            console.log("Suggestion: Model name might be incorrect. Try 'gemini-1.5-flash'.");
        }
    }
}

testAI();
