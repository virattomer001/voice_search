#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Fixing environment variables...');

// Prepare corrected .env content
const fixedEnvContent = `# OpenAI API Key for all services (RAG, Translation, Speech-to-Text)
VITE_OPENAI_API_KEY=your_openai_api_key_here

# Note: We now use OpenAI APIs for all functionality
# - OpenAI Whisper API for speech recognition (replacing Google Speech-to-Text)
# - OpenAI GPT for translation (replacing Google Translation)
# - OpenAI GPT for RAG responses
`;

// Write to .env file
const envPath = path.join(__dirname, '.env');
fs.writeFileSync(envPath, fixedEnvContent, 'utf8');

console.log('Successfully fixed .env file. Environment now uses OpenAI for all services.');
console.log('Please restart your application for changes to take effect.');
