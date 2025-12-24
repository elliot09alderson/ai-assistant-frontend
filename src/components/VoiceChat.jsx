import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2, Volume2, MessageSquare } from 'lucide-react';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useDeepgram } from '../hooks/useDeepgram';
import { useGemini } from '../hooks/useGemini';
import { useElevenLabs } from '../hooks/useElevenLabs';
import Visualizer from './Visualizer';
import './VoiceChat.css';

const VoiceChat = () => {
    const { 
      startRecording, 
      stopRecording, 
      startMonitoring, 
      stopMonitoring, 
      startSilenceDetection,
      releaseMicrophone,
      recording 
    } = useAudioRecorder();
  
    const { transcribe, transcribing } = useDeepgram();
    const { sendMessage, loading: thinking, history } = useGemini();
    const { speak, speaking: speakingAudio, stop: stopSpeaking } = useElevenLabs();
  
    const [processing, setProcessing] = useState(false);
    const [isHandsFree, setIsHandsFree] = useState(false); // Mode toggle
    const [mode, setMode] = useState('IDLE'); // IDLE, LISTENING, RECORDING, PROCESSING, SPEAKING

    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);
  
    // --- State Machine & Effects ---

    // --- State Machine & Effects ---

    // 1. Manage state based on external hooks (AI Speaking) - REMOVED, using explicit callbacks

    // 2. Main Loop Effect
    useEffect(() => {
        if (!isHandsFree) return;

        let active = true;

        const runState = async () => {
            if (mode === 'LISTENING') {
                console.log('State: LISTENING - Waiting for speech...');
                 // Make sure we are not recording or speaking
                if (recording) await stopRecording();
                
                startMonitoring(() => {
                    if (active && mode === 'LISTENING') {
                        console.log('Voice Detected! Switching to RECORDING');
                        setMode('RECORDING');
                    }
                });
            } else if (mode === 'RECORDING') {
                console.log('State: RECORDING - Listening for silence...');
                stopMonitoring(); // Stop start-detection
                await startRecording();
                
                // Start silence detection while recording
                startSilenceDetection(async () => {
                    if (active && mode === 'RECORDING') {
                        console.log('Silence Detected! Stopping & Processing');
                        setMode('PROCESSING'); // Immediate state switch
                         
                        const audioBlob = await stopRecording();
                        if (audioBlob) {
                             await processAudio(audioBlob);
                        } else {
                             // Error getting blob, go back to listening
                             setMode('LISTENING');
                        }
                    }
                });
            } else if (mode === 'SPEAKING') {
                 // Barge-in logic
                 console.log('State: SPEAKING - Monitoring for barge-in...');
                 // While speaking, we monitor for NEW speech to interrupt
                 startMonitoring(() => {
                    if (active && mode === 'SPEAKING') {
                         console.log('Barge-in Detected! Stopping AI...');
                         stopSpeaking();
                         // Transition to RECORDING immediately to capture the interruption
                         setMode('RECORDING');
                    }
                 });
            } else if (mode === 'PROCESSING') {
                 stopMonitoring(); // Ensure no monitoring
            }
        };
        
        runState();

        return () => {
            active = false;
            stopMonitoring(); // Cleanup monitoring on state change
            // Note: We don't release mic here as we might just be switching states, 
            // but if component unmounts we should. Ideally use another effect for unmount.
        };
    }, [mode, isHandsFree]);
    
    // Cleanup on unmount
    useEffect(() => {
        return () => {
             releaseMicrophone();
        };
    }, []);

  
    const toggleHandsFree = () => {
        if (isHandsFree) {
            setIsHandsFree(false);
            setMode('IDLE');
            stopMonitoring();
            stopSpeaking();
            releaseMicrophone(); // Completely stop mic when turning off
        } else {
            setIsHandsFree(true);
            setMode('LISTENING');
        }
    };

    const handleManualRecord = async () => {
        // Manual override for non-hands-free or forcing start
        if (isHandsFree) {
            // If in hands free, clicking might mean "Stop" or "Force Listen"
            // For simplicity, let's just toggle hands free off if clicking main mic
            toggleHandsFree(); 
            return;
        }

        if (recording) {
            const audioBlob = await stopRecording();
            if (audioBlob) processAudio(audioBlob);
        } else {
            startRecording();
        }
    };
  
    const processAudio = async (audioBlob) => {
      // If manually triggered in hands-free (barge-in or silence), ensure we are in processing
      if (isHandsFree) setMode('PROCESSING');
      setProcessing(true);
      try {
        // 1. Transcribe
        const text = await transcribe(audioBlob);
        if (!text || text.trim().length === 0) {
            console.log('Empty transcription, ignoring...');
            // If empty, just go back to listening if hands-free
            if (isHandsFree) setMode('LISTENING');
            return;
        }
  
        // 2. Get AI Response
        const response = await sendMessage(text);
  
        // 3. Speak Response
        if (isHandsFree) setMode('SPEAKING'); // Explicitly set state
        
        await speak(response, () => {
            // onEnd callback: Audio finished naturally
            console.log('Audio ended naturally. Back to listening.');
            if (isHandsFree) {
                setMode('LISTENING');
            }
        }); 
        
      } catch (error) {
        console.error('Error processing voice flow:', error);
        // Resume listening on error
        if (isHandsFree) setMode('LISTENING');
      } finally {
        setProcessing(false);
      }
    };
  
    return (
      <div className="voice-chat-container">
        <div className="chat-history">
          {history.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
               <div className="message-bubble">
                {msg.parts[0].text}
               </div>
            </div>
          ))}
          {processing && <div className="status-indicator">Thinking...</div>}
          {isHandsFree && mode === 'LISTENING' && <div className="status-indicator">Listening...</div>}
        </div>
  
        <div className="controls">
          <Visualizer active={recording || speakingAudio || (isHandsFree && mode === 'LISTENING')} />
          
          <div className="buttons-row">
            <button 
                className={`mode-button ${isHandsFree ? 'active' : ''}`}
                onClick={toggleHandsFree}
                title="Toggle Hands-Free Mode"
            >
                {isHandsFree ? "Auto Mode On" : "Auto Mode Off"}
            </button>

             <button 
                className={`mic-button ${recording ? 'recording' : ''} ${isHandsFree ? 'hands-free-mic' : ''}`}
                onClick={handleManualRecord}
                disabled={processing && !speakingAudio && !isHandsFree}
            >
                {processing || transcribing || thinking ? (
                <Loader2 className="icon spin" />
                ) : recording ? (
                <MicOff className="icon" />
                ) : (
                <Mic className="icon" />
                )}
            </button>
          </div>
         
          <p className="hint">
            {isHandsFree 
                ? (mode === 'Record' ? 'Listening...' : 'Auto-conversation active. Tap Auto Mode to stop.') 
                : (recording ? 'Tap to stop & send' : 'Tap to speak')
            }
          </p>
        </div>
      </div>
    );
  };
  
  export default VoiceChat;
