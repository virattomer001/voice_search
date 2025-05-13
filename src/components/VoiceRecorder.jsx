import { useState, useEffect, useRef } from 'react';

const VoiceRecorder = ({ isRecording, onStartRecording, onStopRecording }) => {
  const [recordingTime, setRecordingTime] = useState(0);
  const [timerId, setTimerId] = useState(null);
  const [isMicSupported, setIsMicSupported] = useState(true);
  const buttonRef = useRef(null);
  const processingClickRef = useRef(false);
  
  // Check if browser supports media devices
  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsMicSupported(false);
    }
  }, []);
  
  useEffect(() => {
    if (isRecording) {
      const id = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      setTimerId(id);
    } else {
      clearInterval(timerId);
      setRecordingTime(0);
    }
    
    return () => {
      clearInterval(timerId);
    };
  }, [isRecording]);
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };
  
  const handleStartRecording = async (e) => {
    e.preventDefault(); // Prevent default behavior
    
    // Prevent double-clicks or extension interference
    if (processingClickRef.current) return;
    processingClickRef.current = true;
    
    try {
      // Add a longer delay to avoid extension conflicts
      setTimeout(() => {
        onStartRecording();
        // Reset the processing flag after the button has been handled
        setTimeout(() => {
          processingClickRef.current = false;
        }, 1000);
      }, 300);
    } catch (error) {
      console.error("Error starting recording:", error);
      processingClickRef.current = false;
    }
  };
  
  const handleStopRecording = (e) => {
    e.preventDefault(); // Prevent default behavior
    
    // Prevent double-clicks or extension interference
    if (processingClickRef.current) return;
    processingClickRef.current = true;
    
    try {
      onStopRecording();
      // Reset the processing flag after the button has been handled
      setTimeout(() => {
        processingClickRef.current = false;
      }, 1000);
    } catch (error) {
      console.error("Error stopping recording:", error);
      processingClickRef.current = false;
    }
  };
  
  if (!isMicSupported) {
    return (
      <div className="voice-recorder">
        <div className="error-message">
          Microphone access is not supported in your browser. 
          Please try using Chrome, Edge, or Firefox.
        </div>
      </div>
    );
  }
  
  return (
    <div className="voice-recorder">
      <button 
        ref={buttonRef}
        className={`record-button ${isRecording ? 'recording' : ''}`}
        onClick={isRecording ? handleStopRecording : handleStartRecording}
        disabled={processingClickRef.current}
      >
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </button>
      
      {isRecording && (
        <div className="recording-indicator">
          <div className="recording-pulse"></div>
          <span className="recording-time">{formatTime(recordingTime)}</span>
        </div>
      )}
      
      <p className="instructions">
        {isRecording 
          ? 'Speak your query in any Indian language...' 
          : 'Click the button and speak your query in any Indian language.'}
      </p>
    </div>
  );
};

export default VoiceRecorder; 