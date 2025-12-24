import { useState } from 'react';

const API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;

export const useDeepgram = () => {
  const [transcribing, setTranscribing] = useState(false);

  const transcribe = async (audioBlob) => {
    setTranscribing(true);
    try {
      // Use local proxy to bypass CORS
      const response = await fetch('/api/deepgram/v1/listen?model=nova-2&smart_format=true', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${API_KEY}`,
          'Content-Type': 'audio/*,',
        },
        body: audioBlob,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Deepgram API Error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      return data.results?.channels[0]?.alternatives[0]?.transcript || "";
      
    } catch (err) {
      console.error('Deepgram Error:', err);
      // Fallback or re-throw
      return null;
    } finally {
      setTranscribing(false);
    }
  };

  return { transcribe, transcribing };
};
