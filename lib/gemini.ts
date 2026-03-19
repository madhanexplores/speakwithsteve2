import { GoogleGenAI } from "@google/genai";

// getSteveResponse has been moved to a server action in app/actions/ai.ts
// to keep the API key secure and avoid CORS issues.

export async function getSteveSpeech(text: string): Promise<{ data: string, mimeType: string } | null> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });

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
    // Silently handle quota errors to allow fallback to browser TTS
    if (error.message?.includes("429") || error.status === "RESOURCE_EXHAUSTED") {
      console.warn("Gemini TTS Quota exceeded, falling back to browser voice.");
    } else {
      console.error("Error generating speech:", error);
    }
    return null;
  }
}
