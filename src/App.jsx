import { useState, useEffect, useRef } from 'react';
import './App.css';
import axios from 'axios';
import { franc } from 'franc';
import { translateToEnglish, translateFromEnglish } from './services/translationService';
import { processQueryWithRAG } from './services/ragService';
import { processPlywoodQuery } from './services/plywoodRagService';
import { formatResponse } from './services/formatService';
import VoiceRecorder from './components/VoiceRecorder';
import ProductResults from './components/ProductResults';
import LanguageSelector from './components/LanguageSelector';
import { logApiKeyInfo, cleanApiKey } from './utils/apiKeyUtils';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // For client-side usage
});

// Log API keys on startup
console.log("=== Environment Variables Check ===");
console.log("import.meta.env available:", Boolean(import.meta.env));
logApiKeyInfo("OpenAI", import.meta.env.VITE_OPENAI_API_KEY);

// Language name mapping as fallback
const languageNameMap = {
  hin: 'Hindi',
  tam: 'Tamil',
  tel: 'Telugu',
  mal: 'Malayalam',
  kan: 'Kannada',
  ben: 'Bengali',
  mar: 'Marathi',
  guj: 'Gujarati',
  ori: 'Odia',
  pan: 'Punjabi',
  urd: 'Urdu',
  asm: 'Assamese',
  eng: 'English',
  hi: 'Hindi',
  ta: 'Tamil',
  te: 'Telugu',
  ml: 'Malayalam',
  kn: 'Kannada',
  bn: 'Bengali',
  mr: 'Marathi',
  gu: 'Gujarati',
  or: 'Odia',
  pa: 'Punjabi',
  ur: 'Urdu',
};

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [detectedLanguage, setDetectedLanguage] = useState('');
  const [languageCode, setLanguageCode] = useState('hi'); // Default to Hindi
  const [selectedLanguage, setSelectedLanguage] = useState('hi'); // New state for user-selected language
  const [translatedText, setTranslatedText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [response, setResponse] = useState('');
  const [translatedResponse, setTranslatedResponse] = useState('');
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  
  // Refs for audio recording
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const timeoutRef = useRef(null);

  // Array of supported language codes for speech recognition
  const supportedLanguageCodes = [
    'hi-IN', // Hindi
    'ta-IN', // Tamil
    'te-IN', // Telugu
    'ml-IN', // Malayalam
    'kn-IN', // Kannada
    'bn-IN', // Bengali
    'mr-IN', // Marathi
    'gu-IN', // Gujarati
    'pa-IN', // Punjabi
    'ur-IN'  // Urdu
  ];

  // Handle language selection change
  const handleLanguageChange = (langCode) => {
    setSelectedLanguage(langCode);
    setLanguageCode(langCode);
    setDetectedLanguage(languageNameMap[langCode] || 'Unknown');
  };

  // 1. Start recording function - simple implementation using MediaRecorder
  const startRecording = async () => {
    try {
      // Reset state
      setError('');
      audioChunksRef.current = [];
      
      console.log('Starting recording...');
      
      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Create MediaRecorder
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      
      // Set up data handler
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log(`Received audio chunk: ${event.data.size} bytes`);
          audioChunksRef.current.push(event.data);
        }
      };
      
      // Handle recording stop
      recorder.onstop = () => {
        console.log('MediaRecorder stopped');
        processRecording();
      };
      
      // Handle errors
      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        setError(`Recording error: ${event.error.message || 'Unknown error'}`);
        cleanupRecording();
      };
      
      // Start recording
      recorder.start(1000); // Collect data in 1-second chunks
      console.log('MediaRecorder started:', recorder.state);
      
      // Set recording state
      setIsRecording(true);
      
      // Auto-stop after 30 seconds
      timeoutRef.current = setTimeout(() => {
        if (isRecording) {
          console.log('Auto-stopping after 30 seconds');
          stopRecording();
        }
      }, 30000);
      
    } catch (err) {
      console.error('Error starting recording:', err);
      setError(`Could not access microphone: ${err.message}`);
      cleanupRecording();
    }
  };

  // 2. Stop recording function
  const stopRecording = () => {
    console.log(`Stop called at ${new Date().toISOString()}`);
    
    // First, stop the timeout if exists
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Immediately stop all audio tracks to ensure no more audio is captured
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Audio track stopped');
      });
      streamRef.current = null;
    }
    
    // Now try to stop the MediaRecorder if it exists and is active
    let recorderStopped = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        console.log('MediaRecorder state before stop:', mediaRecorderRef.current.state);
        mediaRecorderRef.current.stop();
        console.log('MediaRecorder stopped successfully');
        recorderStopped = true;
      } catch (err) {
        console.error('Error stopping MediaRecorder:', err);
      }
    } else {
      console.log('MediaRecorder was not active');
    }
    
    // Process recording only if we have audio chunks and only after ensuring everything is stopped
    if (!recorderStopped && audioChunksRef.current.length > 0) {
      // If the recorder wasn't stopped but we have audio chunks, process them
      processRecording();
    }
    
    setIsRecording(false);
  };

  // 3. Clean up recording resources
  const cleanupRecording = () => {
    // Stop all tracks in the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Audio track stopped');
      });
      streamRef.current = null;
    }
    
    // Clear recorder
    mediaRecorderRef.current = null;
    
    // Update state
    setIsRecording(false);
  };

  // 4. Process recorded audio
  const processRecording = async () => {
    try {
      if (!audioChunksRef.current.length) {
        console.log('No audio chunks collected');
        setError('No audio recorded. Please try again.');
        cleanupRecording();
        return;
      }
      
      console.log(`Processing ${audioChunksRef.current.length} audio chunks`);
      audioChunksRef.current.forEach((chunk, index) => {
        console.log(`Chunk ${index}: ${chunk.size} bytes`);
      });
      
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      console.log(`Audio blob created: ${audioBlob.size} bytes`);
      
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
      
      cleanupRecording();
      
      await transcribeAudio(audioBlob);
      
    } catch (err) {
      console.error('Error processing recording:', err);
      setError('Error processing recording. Please try again.');
      cleanupRecording();
      setProcessing(false);
    }
  };

  // Add cleanup effect to ensure resources are released on unmount
  useEffect(() => {
    return () => {
      console.log('Component unmounting, cleaning up audio resources');
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      cleanupRecording();
    };
  }, []);

  // Update the transcribeAudio function to handle the audio blob
  const transcribeAudio = async (audioBlob) => {
    try {
      setProcessing(true);
      
      if (!audioBlob || audioBlob.size === 0) {
        console.error('Invalid audio blob');
        setError('No audio recorded. Please try again.');
        setProcessing(false);
        return;
      }
      
      console.log(`Transcribing audio: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
      
      // Create audio file for the API
      const audioFile = new File([audioBlob], 'recording.webm', { type: audioBlob.type });
      
      try {
        // Call OpenAI Whisper API
        const response = await openai.audio.transcriptions.create({
          file: audioFile,
          model: 'whisper-1',
          language: selectedLanguage
        });
        
        if (response && response.text) {
          const transcription = response.text.trim();
          console.log('Transcription received:', transcription);
          
          if (transcription) {
            setTranscript(transcription);
            processWithSelectedLanguage(transcription);
          } else {
            throw new Error('Empty transcription received');
          }
        } else {
          throw new Error('Invalid response from transcription service');
        }
      } catch (apiError) {
        console.error('Transcription API error:', apiError);
        
        // Try fallback methods
        useFallbackTranscription();
      }
    } catch (err) {
      console.error('Transcription error:', err);
      setError('Error transcribing audio. Please try again.');
      setProcessing(false);
    }
  };

  // Fallback transcription method
  const useFallbackTranscription = () => {
    console.log('Using fallback transcription');
    
    // Try browser's speech recognition if available
    if ('webkitSpeechRecognition' in window) {
      try {
        const recognition = new window.webkitSpeechRecognition();
        const speechRecogLang = `${selectedLanguage}-${selectedLanguage.toUpperCase() === 'EN' ? 'US' : 'IN'}`;
        recognition.lang = speechRecogLang;
        
        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          setTranscript(transcript);
          processWithSelectedLanguage(transcript);
        };
        
        recognition.onerror = () => useMockTranscription();
        recognition.start();
      } catch (e) {
        console.error('Browser recognition failed:', e);
        useMockTranscription();
      }
    } else {
      useMockTranscription();
    }
  };

  // Mock transcription for demos
  const useMockTranscription = () => {
    console.log('Using mock transcription');
    const mockTranscriptions = {
      hi: "मुझे एक अच्छा स्मार्टफोन चाहिए",
      ta: "நான் ஒரு நல்ல ஸ்மார்ட்போன் வேண்டும்",
      te: "నాకు మంచి స్మార్ట్‌ఫోన్ కావాలి",
      en: "I want a good smartphone"
    };
    
    const mockTranscription = mockTranscriptions[selectedLanguage] || mockTranscriptions.hi;
    setTranscript(mockTranscription);
    processWithSelectedLanguage(mockTranscription);
  };

  // New function to process with the selected language
  const processWithSelectedLanguage = async (text) => {
    try {
      // Set the detected language to the selected language
      const languageName = languageNameMap[selectedLanguage] || 'Unknown';
      setDetectedLanguage(languageName);
      
      // Translate to English
      const translated = await translateToEnglish(text, selectedLanguage);
      setTranslatedText(translated);
      
      // Process with RAG
      processQuery(translated);
    } catch (err) {
      console.error('Error processing with selected language:', err);
      setError('Error processing your query. Please try again.');
      setProcessing(false);
    }
  };

  // Keep the original detectLanguage function as fallback
  const detectLanguage = async (text, knownLangCode = null) => {
    try {
      let languageCode;
      
      if (knownLangCode) {
        // If language code is already provided (from Google Speech API)
        languageCode = knownLangCode;
      } else {
        // Use franc to detect language
        languageCode = franc(text);
        if (languageCode === 'und') {
          // If language detection fails, use the selected language
          languageCode = selectedLanguage;
        }
      }
      
      // Get language name using local mapping
      const languageName = languageNameMap[languageCode] || 'Unknown';
      
      setDetectedLanguage(languageName);
      setLanguageCode(languageCode);
      
      // Translate to English
      const translated = await translateToEnglish(text, languageCode);
      setTranslatedText(translated);
      
      // Process with RAG
      processQuery(translated);
    } catch (err) {
      console.error('Error detecting language:', err);
      setError('Error detecting language. Please try again.');
      setProcessing(false);
    }
  };

  const processQuery = async (text) => {
    try {
      // Process with Plywood RAG service
      const plywoodResponse = await processPlywoodQuery(text);
      
      // Set the response text
      setResponse(plywoodResponse.response);
      
      // Set the products from the response
      if (plywoodResponse.products && Array.isArray(plywoodResponse.products)) {
        setProducts(plywoodResponse.products);
      } else {
        setProducts([]);
      }
      
      // Translate back to original language
      const translatedResponse = await translateFromEnglish(plywoodResponse.response, languageCode);
      setTranslatedResponse(translatedResponse);
    } catch (err) {
      console.error('Error processing query:', err);
      setError('Error processing your query with Plywood RAG. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const speakResponse = () => {
    if (translatedResponse && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(translatedResponse);
      
      // Try to set voice to match the detected language
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.lang.startsWith(languageCode));
      if (voice) {
        utterance.voice = voice;
      }
      
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="app-container">
      <h1>Multilingual Voice Assistant</h1>
      
      <div className="language-selection-container">
        <LanguageSelector
          selectedLanguage={selectedLanguage}
          onLanguageChange={handleLanguageChange}
        />
      </div>
      
      <div className="voice-controls">
        <VoiceRecorder 
          isRecording={isRecording}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
        />
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {transcript && (
        <div className="transcript-container">
          <h2>Your Query:</h2>
          <p className="transcript">{transcript}</p>
          <p className="language-detection">
            Language: {detectedLanguage || 'Detecting...'}
          </p>
          {translatedText && (
            <div className="translated-text">
              <h3>Translated to English:</h3>
              <p>{translatedText}</p>
            </div>
          )}
        </div>
      )}
      
      {processing && (
        <div className="loading">
          Processing your request...
        </div>
      )}
      
      {translatedResponse && (
        <div className="response-container">
          <h2>Response:</h2>
          <p className="response" dangerouslySetInnerHTML={{ __html: translatedResponse }}></p>
          <button onClick={speakResponse} className="speak-button">
            🔊 Listen
          </button>
        </div>
      )}
      
      {products.length > 0 && (
        <ProductResults products={products} />
      )}
    </div>
  );
}

export default App;

