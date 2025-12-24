import { GoogleGenerativeAI } from '@google/generative-ai';
import { useState, useRef } from 'react';

// Initialize Gemini
// Note: In client-side code, we use 'dangerouslyAllowBrowser: true' if necessary, 
// but the SDK works in browser with API key.
// Ensure VITE_GEMINI_API_KEY is set.
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export const useGemini = () => {
  const [loading, setLoading] = useState(false);
  const chatSessionRef = useRef(null);
  const [history, setHistory] = useState([]);

  // Initialize chat session lazily
  const getChatSession = async () => {
    if (!chatSessionRef.current) {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash-exp",
        systemInstruction: {
          parts: [{ text: `
You are a helpful, witty, and concise AI assistant for a voice-based conversation. You are like a 'Soulmate' or a close friend.
CRITICAL INSTRUCTION: Keep your responses EXTREMELY BRIEF, conversational, and to the point.
- Do NOT give long explanations unless explicitly asked.
- Do NOT use markdown formatting like bold, italics, or lists, as this is a voice conversation.
- Answer in 1-2 short sentences whenever possible.
- Avoid formal greetings or sign-offs.
- Be friendly and engaging but concise.
          `}]
        }
      });
      chatSessionRef.current = model.startChat({
        history: [],
        generationConfig: {
          maxOutputTokens: 200, // Reduced from 1000 to encourage brevity
        },
      });
    }
    return chatSessionRef.current;
  };

  const sendMessage = async (text) => {
    setLoading(true);
    try {
      const chat = await getChatSession();
      const result = await chat.sendMessage(text);
      const response = result.response.text();
      
      const newHistoryItem = { role: 'user', parts: [{ text }] };
      const newResponseItem = { role: 'model', parts: [{ text: response }] };
      
      setHistory(prev => [...prev, newHistoryItem, newResponseItem]);
      return response;
    } catch (err) {
      console.error('Gemini Error:', err);
      return "I'm having trouble connecting to my brain right now.";
    } finally {
      setLoading(false);
    }
  };

  return { sendMessage, loading, history };
};
