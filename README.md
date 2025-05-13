# Multilingual Voice Assistant with RAG for Product Search

A web-based voice assistant that can recognize Indian languages, process queries using Retrieval-Augmented Generation (RAG), and respond in the original language.

## Features

- Voice input in Indian languages (auto-detection)
- Transcription to text using Google Cloud Speech-to-Text API
- Language detection using OpenAI
- Translation using Google Cloud Translation API
- RAG-based product search from CSV data with OpenAI integration
- Response generation and translation back to original language
- Text-to-speech for responses

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- API Keys:
  - OpenAI API Key
  - Google Cloud API Key with Speech-to-Text & Translation enabled

## API Key Setup

1. **OpenAI API Key**:
   - Create an account at [OpenAI](https://platform.openai.com/)
   - Generate an API key from your dashboard
   - Used for language detection and RAG response generation

2. **Google Cloud API Keys**:
   - Create a Google Cloud account at [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project
   - Enable the following APIs:
     - Cloud Speech-to-Text API
     - Cloud Translation API
   - Create API credentials and get your API key

3. Add your API keys to the `.env` file:
   ```
   VITE_OPENAI_API_KEY=your_openai_api_key_here
   VITE_GOOGLE_TRANSLATE_API_KEY=your_google_translate_key_here
   VITE_GOOGLE_SPEECH_API_KEY=your_google_speech_key_here
   ```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd rag-voice-assistant
```

2. Install dependencies:
```bash
npm install
```

3. Create and configure the `.env` file with your API keys (see above)

4. Start the development server:
```bash
./start-app.sh
```
Or alternatively:
```bash
npm run dev
```

5. Open the application in your browser at `http://localhost:5173`

## Usage

1. Click the "Start Recording" button
2. Speak your query in any Indian language
3. Wait for the system to process your query
4. View results and optional text-to-speech playback

## Fallback Mechanisms

The application includes fallback mechanisms for when API keys are not available or API calls fail:
- Mock transcriptions for speech recognition
- Browser-based translation if Google Translate API is unavailable
- Simple response generation if OpenAI API is unavailable

## Supported Indian Languages

- Hindi (hi)
- Tamil (ta)
- Telugu (te)
- Malayalam (ml)
- Kannada (kn)
- Bengali (bn)
- Marathi (mr)
- Gujarati (gu)
- Punjabi (pa)
- Urdu (ur)
- Assamese (as)
- Odia (or)

## Libraries Used

- **React** - UI framework
- **Vite** - Build tool
- **OpenAI API** - For language detection and intelligent RAG responses
- **Google Cloud APIs** - For speech recognition and translation
- **franc** - Fallback language detection
- **papaparse** - CSV parsing
- **Web Speech API** - Browser speech synthesis

## Project Structure

- `/src/components` - React components
- `/src/services` - Service functions for translation, RAG, etc.
- `/public/data` - CSV data for product database

## Browser Compatibility

This application uses modern Web APIs and is compatible with:
- Chrome (recommended)
- Firefox
- Edge
- Safari (limited support for some voice features)

## Limitations and Future Improvements

- Currently uses mock data for some features that would require paid APIs
- Limited language support based on browser capabilities
- Simple RAG implementation that could be improved with vector databases
- For production use, integrate with:
  - Google Cloud Speech-to-Text or similar for better transcription
  - A proper LLM API like OpenAI for response generation
  - A more robust translation service

## License

MIT
# voice_search
