'use server';

import { getSteveSystemPrompt } from '@/lib/prompts';

export async function checkApiStatusAction() {
  // --- HARDCODED KEYS ---
  const HARDCODED_OPENROUTER_KEY = "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";

  let openRouterKey = HARDCODED_OPENROUTER_KEY;

  // If hardcoded is empty or a placeholder, try environment variable
  if (!openRouterKey || openRouterKey === "" || openRouterKey.includes("YOUR_") || openRouterKey.includes("placeholder")) {
    openRouterKey = process.env.OPENROUTER_API_KEY || "";
  }

  const hasOpenRouter = !!(openRouterKey &&
    openRouterKey !== "" &&
    openRouterKey !== "YOUR_OPENROUTER_API_KEY" &&
    !openRouterKey.includes("placeholder"));

  return {
    gemini: false,
    openRouter: hasOpenRouter
  };
}

export async function getSteveSpeechAction(text: string): Promise<{ data: string, mimeType: string } | null> {
  // Gemini TTS is disabled as per user request to only use OpenRouter
  return null;
}

export async function getSteveResponseAction(message: string, history: { role: "user" | "model", parts: { text: string }[] }[], language: 'English' | 'Tamil' = 'English') {
  // --- HARDCODED KEYS ---
  const HARDCODED_OPENROUTER_KEY = "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";

  // Prioritize hardcoded key if it's set and not a placeholder, otherwise use env var
  let openRouterKey = HARDCODED_OPENROUTER_KEY;

  // If hardcoded is empty or a placeholder, try environment variable
  if (!openRouterKey || openRouterKey === "" || openRouterKey.includes("YOUR_") || openRouterKey.includes("placeholder")) {
    openRouterKey = process.env.OPENROUTER_API_KEY || "";
  }

  if (!openRouterKey || openRouterKey === "" || openRouterKey === "YOUR_OPENROUTER_API_KEY") {
    throw new Error("OpenRouter API key is missing. Please provide it in the file or as an environment variable.");
  }

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
      throw new Error("OpenRouter returned an empty response.");
    } else {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || "Unknown OpenRouter error";
      console.error(`OpenRouter error (${response.status}):`, errorMsg);

      if (response.status === 401) {
        throw new Error(`OpenRouter Authentication Failed: ${errorMsg}. Please check if your API key is active and has credits.`);
      }
      throw new Error(`OpenRouter API Error (${response.status}): ${errorMsg}`);
    }
  } catch (error: any) {
    console.error("OpenRouter request failed:", error);
    throw error;
  }
}
