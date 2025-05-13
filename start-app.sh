#!/bin/bash

# Check if .env file exists
if [ ! -f .env ]; then
  echo "No .env file found. Creating one with placeholder values..."
  cat > .env << EOF
# OpenAI API Key for all services (RAG, Translation, Speech-to-Text)
VITE_OPENAI_API_KEY=your_openai_api_key_here

# Note: We use OpenAI APIs for all functionality
# - OpenAI Whisper API for speech recognition
# - OpenAI GPT for translation
# - OpenAI GPT for RAG responses
EOF
  echo ".env file created. Please edit it with your actual OpenAI API key."
  exit 1
fi

# Start the development server
npm run dev 