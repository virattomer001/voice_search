import * as XLSX from 'xlsx';
import OpenAI from 'openai';
import { logApiKeyInfo } from '../utils/apiKeyUtils';

// Log OpenAI API key in this service
console.log("=== Plywood RAG Service API Key Check ===");
logApiKeyInfo("OpenAI (Plywood RAG Service)", import.meta.env.VITE_OPENAI_API_KEY);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // For client-side usage
});

// Function to process queries using RAG for plywood data with direct OpenAI search
export const processPlywoodQuery = async (query) => {
  try {
    console.log('Processing query with direct OpenAI search:', query);
    
    // Load plywood data
    const plywoodData = await loadPlywoodData();
    
    if (!plywoodData || plywoodData.length === 0) {
      console.error('No plywood data found');
      return {
        response: "I couldn't find any product data. Please check the data source.",
        products: []
      };
    }
    
    // Log the number of products loaded
    console.log(`Loaded ${plywoodData.length} products for OpenAI search`);
    
    // Sample some products to understand the structure
    const sampleSize = Math.min(5, plywoodData.length);
    const sampleProducts = plywoodData.slice(0, sampleSize);
    console.log('Sample product structure:', sampleProducts[0]);
    
    // Use OpenAI to directly search the data
    const searchResults = await searchWithOpenAI(query, plywoodData);
    
    return {
      response: searchResults.message,
      products: searchResults.products
    };
  } catch (error) {
    console.error('Plywood RAG processing error:', error);
    
    // Provide a graceful fallback response
    return {
      response: "I'm sorry, I encountered an error while searching for plywood products. Please try a different query or check the connection.",
      products: []
    };
  }
};

// Function to extract keywords from a query
const extractKeywords = (query) => {
  // Remove common words and keep only relevant terms
  const commonWords = ['a', 'an', 'the', 'i', 'want', 'need', 'looking', 'for', 'me', 'please', 'can', 'you', 'show', 'get', 'find', 'price', 'cost', 'rate', 'and', 'with', 'by', 'of'];
  
  // First, handle comma-separated inputs - split and clean
  const commaSeparated = query.split(',').map(part => part.trim());
  
  // Process each comma-separated part
  let extractedKeywords = [];
  commaSeparated.forEach(part => {
    // Split the part into individual words
    const partWords = part
      .toLowerCase()
      .split(/\s+/)
      .map(word => word.replace(/[.?!;:()]/g, ''))
      .filter(word => !commonWords.includes(word));
    
    // Include the entire part as a potential keyword (like "green ply")
    if (part.trim().length > 0) {
      extractedKeywords.push(part.trim().toLowerCase());
    }
    
    // Add individual words
    extractedKeywords = [...extractedKeywords, ...partWords];
  });
  
  // Special handling for product types (MR, BWP, etc.) - preserve case sensitivity
  const productTypes = ['mr', 'bwp', 'bwr', 'commercial', 'marine'];
  let typeMatches = [];
  
  productTypes.forEach(type => {
    if (query.toLowerCase().includes(type)) {
      // Add both lowercase and uppercase versions
      typeMatches.push(type);
      typeMatches.push(type.toUpperCase());
    }
  });
  
  // Add special case handling for common thickness values
  const thicknessMatches = query.toLowerCase().match(/\d+\s*mm|\d+\s*millimeter/g) || [];
  const normalizedThicknessMatches = thicknessMatches.map(match => match.replace(/\s+/g, ''));
  
  // Look for common thickness values
  if (query.toLowerCase().includes('12') || 
      query.toLowerCase().includes('twelve') || 
      query.toLowerCase().includes('12 mm')) {
    normalizedThicknessMatches.push('12mm');
  }
  
  if (query.toLowerCase().includes('19') || 
      query.toLowerCase().includes('nineteen') || 
      query.toLowerCase().includes('19 mm')) {
    normalizedThicknessMatches.push('19mm');
  }
  
  // Handle brand names with spaces, like "green ply"
  if (query.toLowerCase().includes('green')) {
    if (query.toLowerCase().includes('green ply') || 
        query.toLowerCase().includes('greenply') || 
        query.toLowerCase().includes('green plywood')) {
      extractedKeywords.push('greenply');
      extractedKeywords.push('green');
    }
  }
  
  if (query.toLowerCase().includes('century')) {
    if (query.toLowerCase().includes('century ply') || 
        query.toLowerCase().includes('centuryply') || 
        query.toLowerCase().includes('century plywood')) {
      extractedKeywords.push('centuryply');
      extractedKeywords.push('century');
    }
  }
  
  // Combine all keywords and remove duplicates
  const allKeywords = [
    ...extractedKeywords,
    ...normalizedThicknessMatches,
    ...typeMatches
  ];
  
  // Filter out very short words unless they're important (like MR, BWP)
  const filteredKeywords = allKeywords.filter(word => {
    // Keep product types regardless of length
    if (productTypes.includes(word.toLowerCase()) || 
        normalizedThicknessMatches.includes(word.toLowerCase())) {
      return true;
    }
    // Otherwise require at least 3 characters
    return word.length > 2;
  });
  
  // Remove duplicates
  const keywords = [...new Set(filteredKeywords)];
  
  console.log('Extracted keywords:', keywords);
  return keywords;
};

// Function to load and parse plywood Excel data
const loadPlywoodData = async () => {
  try {
    console.log('Attempting to load plywood.xlsx...');
    
    // Fetch the Excel file
    const response = await fetch('/data/plywood.xlsx');
    if (!response.ok) {
      console.error(`Failed to fetch Excel file: ${response.status} ${response.statusText}`);
      
      // Attempt to fall back to CSV if Excel fails
      console.log('Attempting to fall back to plywood.csv...');
      const csvResponse = await fetch('/data/plywood.csv');
      if (!csvResponse.ok) {
        throw new Error(`Failed to fetch both Excel and CSV files`);
      }
      
      // Parse CSV manually
      const csvText = await csvResponse.text();
      console.log('CSV loaded, parsing data...');
      
      // Simple CSV parsing (header row + data rows)
      const lines = csvText.split('\n');
      const headers = lines[0].split(',');
      
      // Process each line into an object
      const csvData = [];
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim().length === 0) continue;
        
        const values = lines[i].split(',');
        const entry = {};
        
        // Map column values to headers
        headers.forEach((header, index) => {
          if (index < values.length) {
            entry[header.trim()] = values[index].trim();
          }
        });
        
        // Add important fields with normalized names if they don't exist
        if (!entry.Name && values[0]) entry.Name = values[0].trim();
        if (!entry.Brand && values[1]) entry.Brand = values[1].trim();
        if (!entry.SubBrand && values[2]) entry.SubBrand = values[2].trim();
        if (!entry.Size && values[3]) entry.Size = values[3].trim();
        if (!entry.Thickness && values[4]) entry.Thickness = values[4].trim();
        if (!entry.Type && values[5]) entry.Type = values[5].trim();
        
        csvData.push(entry);
      }
      
      console.log(`Loaded ${csvData.length} plywood products from CSV fallback`);
      console.log('Sample product:', csvData[0]);
      return csvData;
    }
    
    const fileData = await response.arrayBuffer();
    console.log('Excel file loaded, parsing data...');
    
    // Parse Excel data
    const workbook = XLSX.read(fileData, { type: 'array' });
    
    // List all available sheets
    console.log('Available sheets:', workbook.SheetNames);
    
    // Assume data is in the first sheet
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to JSON
    const plywoodData = XLSX.utils.sheet_to_json(worksheet);
    
    // Debug output
    console.log(`Loaded ${plywoodData.length} plywood products from Excel file`);
    if (plywoodData.length > 0) {
      console.log('Column names:', Object.keys(plywoodData[0]));
      console.log('Sample product:', plywoodData[0]);
    } else {
      console.error('No data found in Excel file');
    }
    
    return plywoodData;
  } catch (error) {
    console.error('Error loading plywood data:', error);
    
    // Return empty array instead of throwing to prevent app crash
    return [];
  }
};

// Function to search plywood products based on keywords
const searchPlywoodProducts = async (keywords, originalQuery) => {
  try {
    // Load plywood data from Excel
    const plywoodData = await loadPlywoodData();
    
    // Early exit if data is empty
    if (!plywoodData || plywoodData.length === 0) {
      console.error('No plywood data loaded - cannot perform search');
      return [];
    }
    
    console.log(`Searching for keywords: ${keywords.join(', ')}`);
    console.log(`Original query: ${originalQuery}`);
    
    // DIRECT QUERY APPROACH - Try exact matching for common queries first
    // For comma-separated queries like "Green ply, 12mm, MR", try direct matching
    if (originalQuery.includes(',')) {
      console.log('Attempting direct matching for comma-separated query...');
      const directMatches = searchByDirectMatch(plywoodData, originalQuery);
      
      if (directMatches.length > 0) {
        console.log(`Found ${directMatches.length} direct matches`);
        return directMatches;
      }
    }
    
    // Check for common voice transcription errors and create alternative keywords
    let enhancedKeywords = [...keywords];
    
    // Add product type variations (exact matches for MR, BWP, etc. are critical)
    const productTypes = ['mr', 'bwp', 'bwr', 'marine', 'commercial'];
    productTypes.forEach(type => {
      // If the original input has this type mentioned in any form
      if (originalQuery.toLowerCase().includes(type)) {
        // Add both uppercase and proper case versions
        enhancedKeywords.push(type.toUpperCase());
        enhancedKeywords.push(type.charAt(0).toUpperCase() + type.slice(1).toLowerCase());
      }
    });
    
    // Handle brand name variations
    if (originalQuery.toLowerCase().includes('green')) {
      enhancedKeywords.push('greenply');
      enhancedKeywords.push('GreenPly');
      enhancedKeywords.push('green ply');
      enhancedKeywords.push('Green Plywood');
    }
    
    if (originalQuery.toLowerCase().includes('century')) {
      enhancedKeywords.push('centuryply');
      enhancedKeywords.push('CenturyPly');
      enhancedKeywords.push('century ply');
    }
    
    // Handle common speech-to-text errors
    if (originalQuery.toLowerCase().includes('dwell') || 
        originalQuery.toLowerCase().includes('dell') || 
        originalQuery.toLowerCase().includes('dual')) {
      enhancedKeywords.push('gold');
      enhancedKeywords.push('green');
    }
    
    if (originalQuery.toLowerCase().includes('pore') || 
        originalQuery.toLowerCase().includes('poor') || 
        originalQuery.toLowerCase().includes('pour')) {
      enhancedKeywords.push('ply');
      enhancedKeywords.push('bwp');
      enhancedKeywords.push('board');
    }
    
    // Special handling for comma-separated inputs
    if (originalQuery.includes(',')) {
      // For comma-separated inputs, create combinations of adjacent parts
      const parts = originalQuery.split(',').map(part => part.trim().toLowerCase());
      for (let i = 0; i < parts.length - 1; i++) {
        enhancedKeywords.push(`${parts[i]} ${parts[i+1]}`);
      }
    }
    
    // Remove duplicates
    enhancedKeywords = [...new Set(enhancedKeywords)];
    
    console.log(`Enhanced keywords: ${enhancedKeywords.join(', ')}`);
    
    // Create scoring system for more accurate matching
    const scoredProducts = plywoodData.map(product => {
      let score = 0;
      
      // Map fields from Excel format - use column names as in Excel
      const fields = {
        name: (product.Name || '').toLowerCase(),
        brand: (product.Brand || '').toLowerCase(),
        subBrand: (product.SubBrand || '').toLowerCase(),
        size: (product.Size || '').toLowerCase(),
        thickness: (product.Thickness || '').toLowerCase(),
        type: product.Type || '' // Keep original case for type field (MR, BWP, etc.)
      };
      
      // Secondary fields with normalized case for flexible matching
      const normalizedFields = {
        name: fields.name,
        brand: fields.brand,
        subBrand: fields.subBrand,
        size: fields.size,
        thickness: fields.thickness,
        type: (product.Type || '').toLowerCase()
      };
      
      // Convert all product info to a single searchable string
      const allProductText = Object.values(fields).join(' ');
      
      // Score based on exact and partial matches in important fields
      enhancedKeywords.forEach(keyword => {
        const lowerKeyword = keyword.toLowerCase();
        
        // -- EXACT MATCHES (case sensitive for product types) --
        
        // Exact type match with case sensitivity (e.g., "MR" should match "MR" but not "mr")
        // This is critical for product types like MR, BWP, etc.
        if (product.Type === keyword) {
          score += 25; // Very high score for exact type match with correct case
          console.log(`Exact type match: ${product.Name} - Type: ${product.Type}`);
        }
        
        // -- BRAND MATCHING --
        
        // Brand matching (most important)
        if (fields.brand === lowerKeyword) {
          score += 20; // Increased weight for exact brand match
        } else if (fields.brand.includes(lowerKeyword) || lowerKeyword.includes(fields.brand)) {
          score += 15; // Increased weight for partial brand match
        }
        
        // Handle special case for "Green" vs "GreenPly"
        if ((lowerKeyword === 'green' && fields.brand === 'greenply') ||
            (lowerKeyword === 'green ply' && fields.brand === 'greenply')) {
          score += 18; // High score for this common case
        }
        
        // -- THICKNESS MATCHING --
        
        // Thickness matching (very specific identifier)
        if (fields.thickness === lowerKeyword) {
          score += 20; // Higher score for exact thickness match
        } else if (fields.thickness.includes(lowerKeyword) || lowerKeyword.includes(fields.thickness)) {
          score += 15; // Higher score for partial thickness match
        }
        
        // -- TYPE MATCHING (lowercase comparison) --
        
        // Type matching (MR, BWP, etc) - using normalized fields for case-insensitive matching
        if (normalizedFields.type === lowerKeyword) {
          score += 18; // High score for case-insensitive match
        } else if (normalizedFields.type.includes(lowerKeyword) || lowerKeyword.includes(normalizedFields.type)) {
          score += 12; // Increased for partial type match
        }
        
        // -- SUB-BRAND MATCHING --
        
        // Sub-brand/product line matching
        if (fields.subBrand === lowerKeyword) {
          score += 15;
        } else if (fields.subBrand.includes(lowerKeyword) || lowerKeyword.includes(fields.subBrand)) {
          score += 10;
        }
        
        // -- SIZE MATCHING --
        
        // Size matching
        if (fields.size === lowerKeyword) {
          score += 12;
        } else if (fields.size.includes(lowerKeyword) || lowerKeyword.includes(fields.size)) {
          score += 8;
        }
        
        // -- OTHER MATCHES --
        
        // Full product name matching
        if (fields.name.includes(lowerKeyword)) {
          score += 7;
        }
        
        // Check for keyword appearing anywhere in product text
        if (allProductText.includes(lowerKeyword)) {
          score += 5; // General match anywhere in product details
        }
      });
      
      // Check for metakeywords if available (phonetic variations)
      if (product.Metakeywords) {
        try {
          const metaKeywords = JSON.parse(product.Metakeywords);
          
          // For each enhanced keyword, check against metakeywords
          enhancedKeywords.forEach(keyword => {
            const lowerKeyword = keyword.toLowerCase();
            
            metaKeywords.forEach(metaKeyword => {
              const lowerMetaKeyword = metaKeyword.toLowerCase();
              
              // Exact match in metakeywords
              if (lowerMetaKeyword === lowerKeyword) {
                score += 8; // Increased from 5
              }
              // Partial match in metakeywords
              else if (lowerMetaKeyword.includes(lowerKeyword) || 
                       lowerKeyword.includes(lowerMetaKeyword)) {
                score += 4; // Increased from 2
              }
              // Levenshtein distance for fuzzy matching
              else if (levenshteinDistance(lowerMetaKeyword, lowerKeyword) <= 2) {
                score += 3; // Add points for close fuzzy matches
              }
            });
          });
        } catch (e) {
          // If parsing fails, ignore metakeywords
          console.error('Error parsing metakeywords:', e);
        }
      }
      
      return {
        product,
        score
      };
    });
    
    // Filter products with a score above 0 and sort by score (highest first)
    const filteredProducts = scoredProducts
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.product);
    
    console.log(`Found ${filteredProducts.length} matching products`);
    
    // If filtered products is empty, try basic search approaches
    if (filteredProducts.length === 0) {
      console.log('No products found with scoring method, trying direct search...');
      
      // ATTEMPT 1: Handle common specific queries directly
      if (originalQuery.toLowerCase().includes('green') && 
          originalQuery.toLowerCase().includes('12mm') && 
          originalQuery.toLowerCase().includes('mr')) {
        console.log('Detected specific search for Green 12mm MR plywood');
        
        const specificMatches = plywoodData.filter(product => {
          const brandMatch = (product.Brand || '').toLowerCase().includes('green');
          const thicknessMatch = (product.Thickness || '').toLowerCase().includes('12mm');
          const typeMatch = product.Type === 'MR';
          return brandMatch && thicknessMatch && typeMatch;
        });
        
        if (specificMatches.length > 0) {
          console.log(`Found ${specificMatches.length} direct matches for Green 12mm MR`);
          return specificMatches;
        }
      }
      
      // ATTEMPT 2: Simple brand + thickness search
      console.log('Trying basic brand + thickness matching...');
      let simpleMatches = [];
      
      if (originalQuery.toLowerCase().includes('green')) {
        // Look for any GreenPly products
        simpleMatches = plywoodData.filter(product => {
          return (product.Brand || '').toLowerCase().includes('green');
        });
        
        // If we have thickness mentioned, further filter
        if (originalQuery.toLowerCase().includes('12mm') || originalQuery.toLowerCase().includes('12 mm')) {
          simpleMatches = simpleMatches.filter(product => {
            return (product.Thickness || '').toLowerCase().includes('12');
          });
        }
        
        if (simpleMatches.length > 0) {
          console.log(`Found ${simpleMatches.length} simple matches by brand/thickness`);
          return simpleMatches.slice(0, 10);
        }
      }
      
      // ATTEMPT 3: Very basic fallback - just look for any thickness match
      console.log('Trying basic thickness matching...');
      if (originalQuery.toLowerCase().includes('12mm') || originalQuery.toLowerCase().includes('12 mm')) {
        const thicknessMatches = plywoodData.filter(product => {
          return (product.Thickness || '').toLowerCase().includes('12');
        });
        
        if (thicknessMatches.length > 0) {
          console.log(`Found ${thicknessMatches.length} products with 12mm thickness`);
          return thicknessMatches.slice(0, 10);
        }
      }
      
      // ATTEMPT 4: Emergency fallback - return first 5 products from data
      console.log('No specific matches found, returning some sample products');
      return plywoodData.slice(0, 5);
    }
    
    return filteredProducts;
  } catch (error) {
    console.error('Error searching plywood products:', error);
    return [];
  }
};

// Direct matching for comma-separated queries like "Green ply, 12mm, MR"
function searchByDirectMatch(products, query) {
  // Split by commas and clean up each part
  const parts = query.split(',').map(part => part.trim().toLowerCase());
  console.log('Query parts:', parts);
  
  // Filter products that match all criteria
  const matches = products.filter(product => {
    // For debugging, convert product to a searchable string
    let productString = '';
    try {
      // Get all values from the product and join them
      const values = Object.values(product);
      productString = values.join(' ').toLowerCase();
    } catch (e) {
      console.error('Error creating product string:', e);
      return false;
    }
    
    // Check if product matches all parts of the query
    const allPartsMatch = parts.every(part => {
      if (part.length < 2) return true; // Skip very short parts
      
      // Special case for "MR" - check product Type field directly
      if (part.toUpperCase() === 'MR') {
        const typeMatch = product.Type === 'MR';
        console.log(`Checking if product ${product.Name} has Type=MR: ${typeMatch}`);
        return typeMatch;
      }
      
      // Special case for thickness (e.g., "12mm")
      if (part.includes('mm')) {
        const thicknessMatch = (product.Thickness || '').toLowerCase() === part;
        console.log(`Checking if product ${product.Name} has Thickness=${part}: ${thicknessMatch}`);
        return thicknessMatch;
      }
      
      // For "green ply" check Brand field
      if (part === 'green ply' || part === 'greenply') {
        const brandMatch = (product.Brand || '').toLowerCase().includes('green');
        console.log(`Checking if product ${product.Name} has Brand containing 'green': ${brandMatch}`);
        return brandMatch;
      }
      
      // Check if this part is present anywhere in the product text
      const partMatch = productString.includes(part);
      console.log(`Checking if product ${product.Name} contains '${part}': ${partMatch}`);
      return partMatch;
    });
    
    if (allPartsMatch) {
      console.log('MATCHED PRODUCT:', product.Name);
    }
    
    return allPartsMatch;
  });
  
  console.log(`Found ${matches.length} matches with direct matching`);
  return matches;
}

// Helper function for fuzzy matching - Levenshtein distance calculation
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Function to directly search products using OpenAI
const searchWithOpenAI = async (query, plywoodData) => {
  try {
    console.log('Searching products with OpenAI for query:', query);
    
    // Limit data size to avoid token limits
    const maxProducts = 30;
    const productSample = plywoodData.slice(0, maxProducts);
    
    // Convert products to a simple string format for the prompt
    const productsContext = JSON.stringify(productSample, null, 2);
    
    // Create the prompt for OpenAI to search through the data
    const prompt = `
You are an expert assistant specializing in finding plywood products based on user queries. 

User Query: "${query}"

Available Plywood Products (JSON format):
${productsContext}

Your task:
1. Analyze the user query to understand what they're looking for
2. Search through the product data to find items that best match the query
3. Return a JSON response with the following structure:
{
  "message": "A helpful, conversational response summarizing the search results",
  "products": [
    {
      "name": "Product Name",
      "brand": "Brand Name",
      "sub_brand": "Sub-brand",
      "thickness": "Thickness",
      "type": "Type (e.g., MR, BWP)",
      "size": "Size",
      "selling_price": "Selling Price with unit",
      "market_price": "Market Price with unit"
    },
    ...(more matching products)
  ]
}

Guidelines:
- Focus on exact matches first, then close matches
- Handle misspellings and variations in the query
- For "MR" or "BWP" type specifications, match exactly
- If thickness is specified (e.g., "12mm"), find products with that thickness
- If the brand is mentioned (e.g., "Green" or "GreenPly"), prioritize those products
- Return ONLY matching products in the exact JSON format specified
- If no matches are found, return an appropriate message and empty products array

RESPOND ONLY WITH THE JSON - NO OTHER TEXT BEFORE OR AFTER.
`;

    // Call OpenAI API with the search prompt
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-16k", // Using 16k model for larger context
      messages: [
        { role: "system", content: "You are an assistant that searches through product data and returns matching results in JSON format." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2, // Lower temperature for more deterministic results
      max_tokens: 2000,
    });
    
    // Extract the JSON response
    const responseText = completion.choices[0].message.content;
    console.log('OpenAI search response received');
    
    try {
      // Extract and parse the JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const searchResults = JSON.parse(jsonMatch[0]);
        console.log(`OpenAI found ${searchResults.products.length} matching products`);
        return searchResults;
      } else {
        throw new Error('No valid JSON found in OpenAI response');
      }
    } catch (jsonError) {
      console.error('Error parsing JSON from OpenAI search response:', jsonError);
      console.log('Raw response:', responseText);
      
      // Fallback to manually constructing response
      return {
        message: "I found some plywood products that might match your query.",
        products: productSample.slice(0, 5).map(product => ({
          name: product.Name || '',
          brand: product.Brand || '',
          sub_brand: product.SubBrand || '',
          thickness: product.Thickness || '',
          type: product.Type || '',
          size: product.Size || '',
          selling_price: `${product.SellingPrice || ''} ${product.SPUnit || ''}`,
          market_price: `${product.MarketPrice || ''} ${product.MPUnit || ''}`
        }))
      };
    }
  } catch (error) {
    console.error('OpenAI search error:', error);
    return {
      message: "I encountered an error while searching for products.",
      products: []
    };
  }
};

// Original function kept for reference, not used anymore
const generatePlywoodResponse = async (query, products) => {
  if (products.length === 0) {
    return {
      text: "I couldn't find any plywood products matching your request. Could you please provide more details about what you're looking for?",
      products: []
    };
  }
  
  try {
    // Format product data for the prompt
    const productContext = products.map(product => {
      return `Name: ${product.Name}
Brand: ${product.Brand}
Sub-Brand: ${product.SubBrand}
Size: ${product.Size}
Thickness: ${product.Thickness}
Type: ${product.Type}
Market Price: ${product.MarketPrice} ${product.MPUnit}
Selling Price: ${product.SellingPrice} ${product.SPUnit}`;
    }).join('\n\n');
    
    // Build the prompt for OpenAI
    const prompt = `
You are a helpful assistant specializing in plywood products. The user is asking about plywood based on this query:
"${query}"

I've found these matching plywood products:

${productContext}

Your task is to create a JSON response containing these products with their details.
The response should be in this exact format:
{
  "message": "Brief summary of the query results",
  "products": [
    {
      "name": "Product Name",
      "brand": "Brand Name",
      "sub_brand": "Sub-brand",
      "thickness": "Thickness",
      "type": "Type",
      "size": "Size",
      "selling_price": "SP value with unit",
      "market_price": "Market Price value with unit"
    },
    ...additional products
  ]
}

Format the message to be helpful and conversational, but make sure the JSON structure is exactly as specified.
The 'products' array should include ALL matched products from the search.
Sort the products by most relevant to the user's query first.
`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant that provides information about plywood products in a specific JSON format." },
        { role: "user", content: prompt }
      ],
      max_tokens: 900,
      temperature: 0.2,
    });
    
    // Parse the response to extract JSON
    const responseText = completion.choices[0].message.content;
    let jsonResponse;
    
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No valid JSON found in response');
      }
    } catch (jsonError) {
      console.error('Error parsing JSON from OpenAI response:', jsonError);
      // Fallback to manually constructing JSON
      jsonResponse = {
        message: "Here are the plywood products that match your query:",
        products: products.map(product => ({
          name: product.Name,
          brand: product.Brand,
          sub_brand: product.SubBrand,
          thickness: product.Thickness,
          type: product.Type,
          size: product.Size,
          selling_price: `${product.SellingPrice} ${product.SPUnit}`,
          market_price: `${product.MarketPrice} ${product.MPUnit}`
        }))
      };
    }
    
    return {
      text: jsonResponse.message,
      products: jsonResponse.products
    };
  } catch (error) {
    console.error('OpenAI generation error:', error);
    
    // Fallback response if OpenAI fails
    return {
      text: "Based on your query, I found some matching plywood products:",
      products: products.map(product => ({
        name: product.Name,
        brand: product.Brand,
        sub_brand: product.SubBrand,
        thickness: product.Thickness,
        type: product.Type,
        size: product.Size,
        selling_price: `${product.SellingPrice} ${product.SPUnit}`,
        market_price: `${product.MarketPrice} ${product.MPUnit}`
      }))
    };
  }
};
