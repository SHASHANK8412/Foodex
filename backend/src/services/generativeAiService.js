const { GoogleGenerativeAI } = require("@google/generative-ai");

// Access your API key as an environment variable
let genAI = null;

try {
  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    console.warn("GOOGLE_GEMINI_API_KEY is not set. Gemini AI service will not work.");
  } else {
    genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
  }
} catch (error) {
  console.error("Failed to initialize GoogleGenerativeAI:", error);
}

/**
 * Generates content using the Gemini model.
 * @param {string} prompt - The text prompt to generate content from.
 * @returns {Promise<string>} The generated text.
 */
async function generateContent(prompt) {
  try {
    if (!genAI) {
      throw new Error("Gemini AI client is not initialized. Please check if GOOGLE_GEMINI_API_KEY is set.");
    }

    // gemini-2.0-flash is retired for new API keys; the model is configurable.
    const model = genAI.getGenerativeModel({ model: process.env.GOOGLE_GEMINI_MODEL || "gemini-3.5-flash-lite" });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    return text;
  } catch (error) {
    console.error("Error generating content:", error);
    
    // Handle quota exceeded errors gracefully
    if (error.status === 429) {
      throw new Error("API quota exceeded. Please try again later or upgrade your plan at https://ai.google.dev");
    }
    
    // Handle authentication errors
    if (error.status === 401 || error.status === 403) {
      throw new Error("Invalid or expired API key. Please check your GOOGLE_GEMINI_API_KEY.");
    }
    
    throw new Error("Failed to generate content from AI service: " + error.message);
  }
}

module.exports = { generateContent };
