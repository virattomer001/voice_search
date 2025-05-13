import React from 'react';

const LanguageSelector = ({ selectedLanguage, onLanguageChange }) => {
  // List of supported languages with their display names and ISO codes
  const supportedLanguages = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'Hindi' },
    { code: 'ta', name: 'Tamil' },
    { code: 'te', name: 'Telugu' },
    { code: 'ml', name: 'Malayalam' },
    { code: 'kn', name: 'Kannada' },
    { code: 'bn', name: 'Bengali' },
    { code: 'mr', name: 'Marathi' },
    { code: 'gu', name: 'Gujarati' },
    { code: 'or', name: 'Odia' },
    { code: 'pa', name: 'Punjabi' },
    { code: 'ur', name: 'Urdu' },
    { code: 'as', name: 'Assamese' }
  ];
  
  return (
    <div className="language-selector">
      <label htmlFor="language-select">Select Your Language: </label>
      <select 
        id="language-select"
        value={selectedLanguage}
        onChange={(e) => onLanguageChange(e.target.value)}
        className="language-dropdown"
      >
        {supportedLanguages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSelector;

