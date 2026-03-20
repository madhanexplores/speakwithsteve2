'use server';

import { getSteveSystemPrompt } from '@/lib/prompts';
import { GoogleGenAI } from "@google/genai";

export async function checkApiStatusAction() {
  // --- HARDCODED KEYS (Optional fallback for Vercel/Local) ---
  const HARDCODED_GEMINI_KEY = ""; // Paste your Gemini key here if env vars aren't working
  const HARDCODED_OPENROUTER_KEY = "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"; // Paste your OpenRouter key here
  
  const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || HARDCODED_GEMINI_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY || HARDCODED_OPENROUTER_KEY;
  
  return {
    gemini: !!(geminiKey && geminiKey !== "" && geminiKey !== "YOUR_API_KEY"),
    openRouter: !!(openRouterKey && openRouterKey !== "" && openRouterKey !== "YOUR_OPENROUTER_API_KEY")
  };
}

export async function getSteveSpeechAction(text: string): Promise<{ data: string, mimeType: string } | null> {
  const HARDCODED_GEMINI_KEY = ""; // Paste your Gemini key here
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || HARDCODED_GEMINI_KEY;
  if (!apiKey || apiKey === "" || apiKey === "YOUR_API_KEY") return null;

  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say naturally: ${text}` }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Zephyr' },
          },
        },
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    if (part?.inlineData?.data && part?.inlineData?.mimeType) {
      return {
        data: part.inlineData.data,
        mimeType: part.inlineData.mimeType
      };
    }
    return null;
  } catch (error: any) {
    if (error.message?.includes("429") || error.status === "RESOURCE_EXHAUSTED") {
      console.warn("Gemini TTS Quota exceeded");
    } else {
      console.error("Error generating speech:", error);
    }
    return null;
  }
}

export async function getSteveResponseAction(message: string, history: { role: "user" | "model", parts: { text: string }[] }[], language: 'English' | 'Tamil' = 'English') {
  // --- HARDCODED KEYS ---
  const HARDCODED_GEMINI_KEY = ""; // Paste your Gemini key here
  const HARDCODED_OPENROUTER_KEY = ""; // Paste your OpenRouter key here
  
  // Try OpenRouter first if a key is provided
  const openRouterKey = process.env.OPENROUTER_API_KEY || HARDCODED_OPENROUTER_KEY;
  
  if (openRouterKey && openRouterKey !== "" && openRouterKey !== "YOUR_OPENROUTER_API_KEY" && openRouterKey !== "sk-or-v1-...") {
    try {
      const formattedHistory = history.map(h => ({
        role: h.role === "model" ? "assistant" : "user",
        content: h.parts[0].text
      }));

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openRouterKey.trim()}`,
          "X-Title": "SpeakWithSteve",
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          messages: [
            { role: "system", content: getSteveSystemPrompt(language) },
            ...formattedHistory,
            { role: "user", content: message }
          ]
        }),
        cache: 'no-store'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.choices && data.choices.length > 0) {
          return data.choices[0].message.content;
        }
      } else {
        const errorText = await response.text();
        console.error(`OpenRouter error (${response.status}):`, errorText);
        
        // Handle specific OpenRouter errors
        if (response.status === 401) {
          throw new Error("OpenRouter API Key is invalid or user not found. Please check your OPENROUTER_API_KEY in the Secrets panel.");
        }
        
        // If it's not a 401, we'll fall back to Gemini
      }
    } catch (error) {
      console.error("OpenRouter fetch failed, falling back to Gemini:", error);
    }
  }

  // Fallback to Gemini (built-in, no external key needed)
  console.log("Falling back to Gemini for response...");
  const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || HARDCODED_GEMINI_KEY;
  
  if (!geminiKey || geminiKey === "" || geminiKey === "YOUR_API_KEY") {
    throw new Error("AI Service is not configured. Please ensure NEXT_PUBLIC_GEMINI_API_KEY is set in your environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey: geminiKey.trim() });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...history,
        { role: "user", parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: getSteveSystemPrompt(language),
      }
    });

    return response.text || "I'm sorry, I didn't catch that.";
  } catch (error: any) {
    console.error("Gemini fallback failed:", error);
    
    // Handle specific Gemini error codes
    const errorMsg = error.message || "";
    if (errorMsg.includes("API key not valid") || errorMsg.includes("INVALID_ARGUMENT")) {
      throw new Error("The Gemini API Key provided is invalid. Please get a new key from https://aistudio.google.com/app/apikey and update your environment variables.");
    }
    
    throw new Error(`AI Service Error: ${errorMsg || "Unknown error"}`);
  }
}
