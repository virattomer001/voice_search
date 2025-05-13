/**
 * Safely logs API key information without exposing the full key
 * @param {string} name - The name of the API key
 * @param {string} key - The API key to check
 */
export const logApiKeyInfo = (name, key) => {
  console.log(`=== ${name} Key Info ===`);
  console.log(`- Key exists: ${Boolean(key)}`);
  
  if (!key) {
    console.log(`- ERROR: ${name} key is missing!`);
    return;
  }
  
  // Clean up the key - remove any whitespace, newlines, etc.
  const cleanKey = key.replace(/\s+/g, '');
  
  // Check key length
  console.log(`- Key length: ${cleanKey.length} characters`);
  
  // Show masked version (first 4 and last 4 characters)
  if (cleanKey.length > 8) {
    const firstFour = cleanKey.substring(0, 4);
    const lastFour = cleanKey.substring(cleanKey.length - 4);
    console.log(`- Key prefix/suffix: ${firstFour}...${lastFour}`);
  } else {
    console.log(`- Key too short to mask: ${cleanKey.length} chars`);
  }
  
  // Check for common issues
  if (cleanKey.includes('your_') || cleanKey.includes('_here')) {
    console.log(`- ERROR: Key appears to be a placeholder!`);
  }
  
  if (key.includes('\n')) {
    console.log(`- WARNING: Key contains newlines!`);
  }
  
  if (key.includes(' ')) {
    console.log(`- WARNING: Key contains spaces`);
  }
  
  console.log('=====================');
  
  return cleanKey;
};

/**
 * Ensures that an API key is properly formatted (no newlines, spaces, etc)
 * @param {string} key - The API key to clean
 * @returns {string} - The cleaned API key
 */
export const cleanApiKey = (key) => {
  if (!key) return '';
  return key.replace(/\s+/g, '');
}; 