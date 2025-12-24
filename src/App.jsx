import React from 'react';
import VoiceChat from './components/VoiceChat';
import './App.css';

// Main Application Component
function App() {
  return (
    <div className="app-container">
      <header>
        <h1>AI Soulmate Assistant</h1>
        <p>Talk to me about anything.</p>
      </header>
      <main>
        <VoiceChat />
      </main>
    </div>
  );
}

export default App;
