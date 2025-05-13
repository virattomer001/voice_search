import axios from 'axios';
import OpenAI from 'openai';
import { logApiKeyInfo } from '../utils/apiKeyUtils';
import { improveTransliteration, createSearchableHinglish } from '../utils/transliterationUtil';

// Log OpenAI API key
console.log("=== Translation Service API Key Check ===");
logApiKeyInfo("OpenAI (Translation Service)", import.meta.env.VITE_OPENAI_API_KEY);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // For client-side usage
});

// Map ISO 639-3 codes to standard language codes
const languageCodeMap = {
  hin: 'hi', // Hindi
  tam: 'ta', // Tamil
  tel: 'te', // Telugu
  mal: 'ml', // Malayalam
  kan: 'kn', // Kannada
  ben: 'bn', // Bengali
  mar: 'mr', // Marathi
  guj: 'gu', // Gujarati
  ori: 'or', // Odia
  pan: 'pa', // Punjabi
  urd: 'ur', // Urdu
  asm: 'as', // Assamese
  eng: 'en', // English
  // Add direct mapping for 2-letter codes
  hi: 'hi',
  ta: 'ta',
  te: 'te',
  ml: 'ml',
  kn: 'kn',
  bn: 'bn',
  mr: 'mr',
  gu: 'gu',
  or: 'or',
  pa: 'pa',
  ur: 'ur',
  as: 'as',
  en: 'en',
};

// Simple cache for translations to avoid redundant API calls
const translationCache = {
  toEnglish: new Map(),
  fromEnglish: new Map()
};

// Function to get standard language code from ISO 639-3 code
const getStandardLangCode = (iso6393Code) => {
  return languageCodeMap[iso6393Code] || 'en';
};

// Translate text from any language to English using OpenAI
export const translateToEnglish = async (text, langCode) => {
  try {
    // Check cache first
    const cacheKey = `${langCode}:${text}`;
    if (translationCache.toEnglish.has(cacheKey)) {
      console.log("Using cached translation to English");
      return translationCache.toEnglish.get(cacheKey);
    }
    
    // Skip translation if already English
    const standardLangCode = getStandardLangCode(langCode);
    if (standardLangCode === 'en') {
      return text;
    }
    
    // First, improve transliteration of product terms
    const textWithImprovedTerms = improveTransliteration(text);
    console.log("After transliteration improvement:", textWithImprovedTerms);
    
    // If the language is Hindi, create a more searchable version
    let translatedText;
    if (standardLangCode === 'hi') {
      // Create a "Hinglish" version for better search matching
      const searchableHinglish = createSearchableHinglish(textWithImprovedTerms);
      translatedText = searchableHinglish;
      
      // If the transliteration seems to have worked well, we might not need the API call
      if (searchableHinglish.match(/^[a-zA-Z0-9\s.,()[\]{}'"?!;:+\-*/%$#@&|<>_=]+$/)) {
        console.log("Using transliteration result directly:", searchableHinglish);
        translationCache.toEnglish.set(cacheKey, searchableHinglish);
        return searchableHinglish;
      }
    }
    
    // Use OpenAI for translation with improved context
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a translation assistant specializing in product terminology. 
          Translate the following text from ${standardLangCode} to English.
          Pay special attention to technical terms like product names, dimensions, and specifications.
          For example, "प्लाइवूड 6 एमेम" should be translated as "plywood 6mm".
          Provide only the translation, no explanations or additional text.`
        },
        {
          role: "user",
          content: textWithImprovedTerms
        }
      ],
      temperature: 0.3,
      max_tokens: 256
    });
    
    translatedText = response.choices[0].message.content.trim();
    
    // Apply one more pass of product term transliteration to ensure all terms are correctly translated
    const finalTranslation = improveTransliteration(translatedText);
    
    // Save to cache
    translationCache.toEnglish.set(cacheKey, finalTranslation);
    return finalTranslation;
  } catch (error) {
    console.error('Translation error:', error);
    
    // Try to use the transliteration result if available
    if (text && langCode === 'hi') {
      const transliterated = improveTransliteration(text);
      if (transliterated !== text) {
        return transliterated;
      }
    }
    
    // Fallback mock translations for demonstration
    const mockTranslations = {
      "मुझे एक अच्छा स्मार्टफोन चाहिए": "I want a good smartphone",
      "नाकु मंचि స్మార్ట్‌ఫోన్ కావాలి": "I need a good smartphone",
      "எனக்கு ஒரு நல்ல ஸ்மார்ட்போன் வேண்டும்": "I want a good smartphone",
      "प्लाइवूड 6 एमेम": "plywood 6mm",
      "ग्रीनप्लाई प्लाइवूड 19mm": "greenply plywood 19mm",
      "सेंचुरीप्लाई बीडब्ल्यूपी-710 प्लाइवूड 12 एमएम": "centuryply BWP-710 plywood 12mm"
    };
    
    return mockTranslations[text] || "I'm looking for a product";
  }
};

// Translate text from English back to the original language
export const translateFromEnglish = async (text, langCode) => {
  try {
    // Check cache first
    const cacheKey = `${langCode}:${text}`;
    if (translationCache.fromEnglish.has(cacheKey)) {
      console.log("Using cached translation from English");
      return translationCache.fromEnglish.get(cacheKey);
    }
    
    // Skip translation if target is English
    const standardLangCode = getStandardLangCode(langCode);
    if (standardLangCode === 'en') {
      return text;
    }
    
    // Use OpenAI for translation
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a translation assistant. Translate the following text from English to ${standardLangCode}. Provide only the translation, no explanations or additional text.`
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.3,
      max_tokens: 512
    });
    
    const translatedText = response.choices[0].message.content.trim();
    
    // Save to cache
    translationCache.fromEnglish.set(cacheKey, translatedText);
    return translatedText;
  } catch (error) {
    console.error('Translation error:', error);
    
    // Fallback mock translations for demonstration
    const mockResponsesHindi = {
      "I found these smartphones for you": "मैंने आपके लिए ये स्मार्टफोन खोजे हैं",
      "Here are some good smartphones": "यहां कुछ अच्छे स्मार्टफोन हैं",
      "Based on your request, I recommend": "आपके अनुरोध के आधार पर, मैं अनुशंसा करता हूं"
    };
    
    const mockResponsesTamil = {
      "I found these smartphones for you": "நான் உங்களுக்காக இந்த ஸ்மார்ட்போன்களைக் கண்டுபிடித்தேன்",
      "Here are some good smartphones": "இதோ சில நல்ல ஸ்மார்ட்போன்கள்",
      "Based on your request, I recommend": "உங்கள் கோரிக்கையின் அடிப்படையில், நான் பரிந்துரைக்கிறேன்"
    };
    
    const mockResponsesTelugu = {
      "I found these smartphones for you": "నేను మీ కోసం ఈ స్మార్ట్‌ఫోన్‌లను కనుగొన్నాను",
      "Here are some good smartphones": "ఇక్కడ కొన్ని మంచి స్మార్ట్‌ఫోన్‌లు ఉన్నాయి",
      "Based on your request, I recommend": "మీ అభ్యర్థన ఆధారంగా, నేను సిఫార్సు చేస్తున్నాను"
    };
    
    // Select appropriate mock response based on language
    let mockResponses = mockResponsesHindi;
    if (langCode === 'tam' || langCode === 'ta') mockResponses = mockResponsesTamil;
    if (langCode === 'tel' || langCode === 'te') mockResponses = mockResponsesTelugu;
    
    // Get a random mock response
    const keys = Object.keys(mockResponses);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    
    return mockResponses[randomKey];
  }
}; 