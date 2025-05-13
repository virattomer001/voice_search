/**
 * Utility for handling transliteration of technical/product terms from Hindi to English
 * This helps convert terms like "प्लाइवूड 6 एमेम" to "plywood 6mm"
 */

// Map of Hindi/Hinglish product terms to English equivalents
const productTermsMap = {
  // Plywood and related terms
  'प्लाइवूड': 'plywood',
  'प्लाइवुड': 'plywood',
  'प्लाईवुड': 'plywood',
  'प्लावुड': 'plywood',
  'प्लाई': 'ply',
  'प्लाइ': 'ply',
  
  // Thickness measurements
  'एमएम': 'mm',
  'एमेम': 'mm',
  'मिमी': 'mm',
  'मिलीमीटर': 'mm',
  'इंच': 'inch',
  
  // Common brands
  'ग्रीनप्लाई': 'greenply',
  'ग्रीनप्ली': 'greenply',
  'सेंचुरी': 'century',
  'सेंचुरीप्लाई': 'centuryply',
  
  // Type specs
  'बीडब्ल्यूपी': 'BWP',
  'बीडब्लूपी': 'BWP',
  'बीडब्लूआर': 'BWR',
  'एमआर': 'MR',
  
  // Dimensions
  '8x4': '8x4',
  '७x४': '7x4',
  '८x४': '8x4',
  'फीट': 'feet'
};

// List of product-specific keywords extracted from the Metakeywords field in the CSV
const metaKeywords = [
  "greenply", "greenplai", "grinply", "grenply", "grenplai", 
  "ekotech", "ekotack", "ecotek", "akotec", 
  "centuryply", "centuriply", "sentryply", "senturiply",
  "m r", "emer", "ar", "BWP-710", "bwp", "bvp", "710",
  "6 mm", "6mm", "six mm", "9 mm", "9mm", "nine mm",
  "12 mm", "12mm", "twelve mm", "16 mm", "16mm", "sixteen mm",
  "19 mm", "19mm", "nineteen mm", "25 mm", "25mm", "twentyfive mm",
  "8x4", "8 x 4", "8ft by 4ft", "8feet4feet", "8by4",
  "7x4", "7 x 4", "7by4", "7ft by 4ft", "7feet4feet"
];

/**
 * Improves translation by replacing Hindi product terms with English equivalents
 * @param {string} hindiText - The original Hindi/mixed text
 * @returns {string} - Text with product terms converted to English
 */
export const improveTransliteration = (hindiText) => {
  if (!hindiText) return hindiText;
  
  let improvedText = hindiText;
  
  // Replace known Hindi product terms with English equivalents
  Object.entries(productTermsMap).forEach(([hindiTerm, englishTerm]) => {
    const regex = new RegExp(hindiTerm, 'gi');
    improvedText = improvedText.replace(regex, englishTerm);
  });
  
  // Handle numbers specially - ensure they're preserved correctly
  // This regex matches Hindi/Devanagari digits and converts them to Arabic numerals
  improvedText = improvedText.replace(/[०-९]/g, match => {
    const hindiDigits = '०१२३४५६७८९';
    return hindiDigits.indexOf(match).toString();
  });
  
  return improvedText;
};

/**
 * Extracts product related terms from translated text 
 * by looking for keywords found in the product metadata
 * 
 * @param {string} text - The text to extract product terms from
 * @returns {string[]} - Array of extracted product terms
 */
export const extractProductTerms = (text) => {
  if (!text) return [];
  
  const lowercasedText = text.toLowerCase();
  const extractedTerms = [];
  
  // Check for each meta keyword in the text
  metaKeywords.forEach(keyword => {
    if (lowercasedText.includes(keyword.toLowerCase())) {
      extractedTerms.push(keyword);
    }
  });
  
  // Also check for common transliterated terms
  Object.entries(productTermsMap).forEach(([hindiTerm, englishTerm]) => {
    if (lowercasedText.includes(englishTerm.toLowerCase())) {
      extractedTerms.push(englishTerm);
    }
  });
  
  return [...new Set(extractedTerms)]; // Remove duplicates
};

/**
 * Creates a "Hinglish" version of the query to improve search matching
 * @param {string} text - The text to convert to Hinglish
 * @returns {string} - The Hinglish version of the text
 */
export const createSearchableHinglish = (text) => {
  // First improve any transliteration
  const transliterated = improveTransliteration(text);
  
  // Extract product terms
  const productTerms = extractProductTerms(transliterated);
  
  // If we have product terms, add them to the search
  if (productTerms.length > 0) {
    return `${transliterated} ${productTerms.join(' ')}`;
  }
  
  return transliterated;
};

export default {
  improveTransliteration,
  extractProductTerms,
  createSearchableHinglish
}; 