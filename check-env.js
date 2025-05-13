#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Checking environment setup...');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.error('\x1b[31mERROR: .env file not found!\x1b[0m');
  console.log('Creating example .env file...');
  
  // Create example .env file
  const envExample = `# OpenAI API Key for all services (RAG, Translation, Speech-to-Text)
VITE_OPENAI_API_KEY=your_openai_api_key_here

# Note: We use OpenAI APIs for all functionality
# - OpenAI Whisper API for speech recognition
# - OpenAI GPT for translation
# - OpenAI GPT for RAG responses`;

  fs.writeFileSync(envPath, envExample);
  console.log('\x1b[33mAn example .env file has been created. Please edit it with your actual API key.\x1b[0m');
  process.exit(1);
}

// Read .env file
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');

// Define the required variables
const requiredVars = [
  'VITE_OPENAI_API_KEY'
];

// Check each required variable
const missingVars = [];
const placeholderVars = [];

requiredVars.forEach(varName => {
  // Look for variable in the file
  const varLine = envLines.find(line => 
    line.trim().startsWith(varName + '=') && !line.trim().startsWith('#')
  );
  
  if (!varLine) {
    missingVars.push(varName);
    return;
  }
  
  // Extract value
  const value = varLine.split('=')[1]?.trim();
  
  // Check if it's a placeholder
  if (!value || value.includes('your_') || value.includes('_here')) {
    placeholderVars.push(varName);
  }
});

// Report results
if (missingVars.length > 0) {
  console.error('\x1b[31mERROR: Missing required environment variable:\x1b[0m');
  missingVars.forEach(v => console.log(`- ${v}`));
}

if (placeholderVars.length > 0) {
  console.error('\x1b[33mWARNING: The OpenAI API key appears to be a placeholder:\x1b[0m');
  placeholderVars.forEach(v => console.log(`- ${v}`));
}

if (missingVars.length === 0 && placeholderVars.length === 0) {
  console.log('\x1b[32mSuccess! OpenAI API key is present.\x1b[0m');
  console.log('Note: This script only checks if the variable exists, not if the API key is valid.');
}

console.log('\nEnvironment variable value (first and last 4 characters):');
requiredVars.forEach(varName => {
  const varLine = envLines.find(line => line.trim().startsWith(varName + '=') && !line.trim().startsWith('#'));
  if (varLine) {
    const value = varLine.split('=')[1]?.trim();
    if (value && value.length > 8) {
      const masked = `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
      console.log(`- ${varName}: ${masked}`);
    } else {
      console.log(`- ${varName}: [too short to mask]`);
    }
  } else {
    console.log(`- ${varName}: [not found]`);
  }
});

console.log('\nTo fix API key issues:');
console.log('1. Get a valid API key from OpenAI (https://platform.openai.com)');
console.log('2. Update the .env file with your actual API key');
console.log('3. Restart the application'); 