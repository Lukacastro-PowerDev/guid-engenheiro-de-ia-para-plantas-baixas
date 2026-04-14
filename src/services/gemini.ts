import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const getApiKey = () => {
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : null;
  return localKey || process.env.GEMINI_API_KEY || "";
};

const getClient = () => {
  return new GoogleGenAI({ apiKey: getApiKey() });
};

export interface Message {
  role: "user" | "model";
  parts: { text?: string; inlineData?: { mimeType: string; data: string } }[];
  timestamp?: string;
}

export async function chatWithGemini(
  messages: Message[],
  systemInstruction: string
): Promise<string> {
  try {
    const ai = getClient();
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: messages.map(m => ({
        role: m.role,
        parts: m.parts
      })),
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return response.text || "Desculpe, não consegui gerar uma resposta.";
  } catch (error) {
    console.error("Error calling Gemini:", error);
    return "Ocorreu um erro ao processar sua solicitação. Verifique sua conexão e tente novamente.";
  }
}

export async function analyzeImage(
  base64Image: string,
  mimeType: string,
  prompt: string,
  systemInstruction: string,
  context?: string
): Promise<string> {
  try {
    const ai = getClient();
    const fullPrompt = context 
      ? `CONTEXTO TÉCNICO (RAG):\n${context}\n\nPERGUNTA/COMANDO:\n${prompt}`
      : prompt;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Image,
              },
            },
            { text: fullPrompt },
          ],
        },
      ],
      config: {
        systemInstruction,
        temperature: 0.4,
      },
    });

    return response.text || "Não foi possível analisar a imagem.";
  } catch (error) {
    console.error("Error analyzing image:", error);
    return "Erro na análise da imagem.";
  }
}
