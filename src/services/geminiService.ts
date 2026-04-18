import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getPoseSuggestion(outfit: string, location: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `User is wearing ${outfit} and is at ${location}. Suggest a simple pose (1-2 sentences) and a mood. Return as JSON: { "pose": string, "mood": string }`,
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini Error:", error);
    return { pose: "Just be yourself and smile!", mood: "Natural" };
  }
}
