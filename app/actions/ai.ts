'use server';

import { getSteveSystemPrompt } from '@/lib/prompts';

export async function getSteveResponseAction(message: string, history: { role: "user" | "model", parts: { text: string }[] }[], language: 'English' | 'Tamil' = 'English') {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    console.error("OPENROUTER_API_KEY is not set");
    throw new Error("OpenRouter API key is missing. Please set OPENROUTER_API_KEY in your environment variables.");
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
        "Authorization": `Bearer ${apiKey.trim()}`,
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

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `OpenRouter error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error: any) {
    console.error("Error in getSteveResponseAction:", error);
    throw error;
  }
}
