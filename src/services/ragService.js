import Papa from 'papaparse';
import { formatResponse } from './formatService';
import OpenAI from 'openai';
import * as XLSX from 'xlsx';
import { logApiKeyInfo } from '../utils/apiKeyUtils';
import { createSearchableHinglish, extractProductTerms } from '../utils/transliterationUtil';

// Log OpenAI API key in this service
console.log("=== RAG Service API Key Check ===");
logApiKeyInfo("OpenAI (RAG Service)", import.meta.env.VITE_OPENAI_API_KEY);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // For client-side usage
});

// Function to process queries using RAG (Retrieval-Augmented Generation)
export const processQueryWithRAG = async (query) => {
  try {
    // Step 1: Parse the query to extract keywords for search
    const keywords = extractKeywords(query);
    
    // Step 2: Retrieve relevant products from database (Excel/CSV file in our case)
    const products = await searchProducts(keywords, query);
    
    // Step 3: Generate a response using the retrieved products and OpenAI
    const response = await generateResponseWithOpenAI(query, products);
    
    return {
      response,
      products
    };
  } catch (error) {
    console.error('RAG processing error:', error);
    throw new Error('Error processing your query with RAG');
  }
};

// Function to extract keywords from a query
const extractKeywords = (query) => {
  // This is a simplified version. In a real app, you might use NLP libraries
  // Remove common words and keep only relevant terms
  const commonWords = ['a', 'an', 'the', 'i', 'want', 'need', 'looking', 'for', 'me', 'please', 'can', 'you', 'show'];
  
  // Check if we have product terms from the query
  const productTerms = extractProductTerms(query);
  if (productTerms.length > 0) {
    console.log("Extracted product terms:", productTerms);
    return productTerms;
  }
  
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(word => !commonWords.includes(word) && word.length > 2)
    .map(word => word.replace(/[.,?!;:()]/g, ''));
};

// Function to determine which sheet(s) to search based on the query
const determineRelevantSheets = (workbook, query) => {
  try {
    // Instead of calling OpenAI, use simple keyword matching
    const sheetNames = workbook.SheetNames;
    
    // Extract keywords from query
    const keywords = extractKeywords(query);
    
    // Simple algorithm to find relevant sheets based on keywords
    const matchedSheets = sheetNames.filter(sheetName => {
      const sheetNameLower = sheetName.toLowerCase();
      return keywords.some(keyword => sheetNameLower.includes(keyword.toLowerCase()) ||
                            keyword.toLowerCase().includes(sheetNameLower));
    });
    
    // If we found matches, return them, otherwise return all sheets
    return matchedSheets.length > 0 ? matchedSheets : sheetNames;
  } catch (error) {
    console.error('Error determining relevant sheets:', error);
    // Return all sheets as fallback
    return workbook.SheetNames;
  }
};

// Function to match product by checking its metakeywords field
const matchProductWithMetakeywords = (product, keywords) => {
  if (!product.Metakeywords) return false;
  
  try {
    // Parse the metakeywords JSON string into an array
    let metaKeywords = [];
    if (typeof product.Metakeywords === 'string') {
      try {
        metaKeywords = JSON.parse(product.Metakeywords);
      } catch (e) {
        // If parsing fails, use it as a single keyword
        metaKeywords = [product.Metakeywords];
      }
    }
    
    // If metaKeywords is still not an array, handle appropriately
    if (!Array.isArray(metaKeywords)) {
      metaKeywords = [String(metaKeywords)];
    }
    
    // Check if any keyword matches any metakeyword
    return keywords.some(keyword => 
      metaKeywords.some(metaKeyword => 
        metaKeyword.toLowerCase().includes(keyword.toLowerCase()) ||
        keyword.toLowerCase().includes(metaKeyword.toLowerCase())
      )
    );
    
  } catch (error) {
    console.error('Error matching metakeywords:', error);
    return false;
  }
};

// Function to search products based on keywords
const searchProducts = async (keywords, originalQuery) => {
  try {
    // Fetch products data from Excel/CSV file
    const response = await fetch('/data/products.xlsx');
    const fileData = await response.arrayBuffer();
    
    // Parse Excel data
    const workbook = XLSX.read(fileData, { type: 'array' });
    
    // Determine which sheets to search based on the query
    const relevantSheets = determineRelevantSheets(workbook, originalQuery);
    
    let allProducts = [];
    
    // Search in each relevant sheet
    for (const sheetName of relevantSheets) {
      const worksheet = workbook.Sheets[sheetName];
      const sheetData = XLSX.utils.sheet_to_json(worksheet);
      
      // Add sheet name to each product for context
      const productsWithSheetName = sheetData.map(product => ({
        ...product,
        category: sheetName, // Add sheet name as category if not present
      }));
      
      // Filter products based on keywords and metakeywords
      const matchedProducts = productsWithSheetName.filter(product => {
        // First check the Metakeywords field if available
        if (matchProductWithMetakeywords(product, keywords)) {
          return true;
        }
        
        // Combine all product fields into a single searchable string
        const productText = Object.values(product)
          .filter(value => typeof value === 'string' || typeof value === 'number')
          .join(' ')
          .toLowerCase();
        
        // Check if any keyword is found in the product text
        return keywords.some(keyword => productText.includes(keyword.toLowerCase()));
      });
      
      allProducts = [...allProducts, ...matchedProducts];
    }
    
    // If we found products with keyword search, return them
    if (allProducts.length > 0) {
      return allProducts;
    }
    
    // If no products found with keywords, try a fallback search with "hinglish" transliteration
    const hinglishQuery = createSearchableHinglish(originalQuery);
    if (hinglishQuery !== originalQuery) {
      console.log("Trying fallback search with Hinglish query:", hinglishQuery);
      const hinglishKeywords = extractKeywords(hinglishQuery);
      
      let hinglishProducts = [];
      for (const sheetName of relevantSheets) {
        const worksheet = workbook.Sheets[sheetName];
        const sheetData = XLSX.utils.sheet_to_json(worksheet);
        
        const productsWithSheetName = sheetData.map(product => ({
          ...product,
          category: sheetName,
        }));
        
        // Filter with hinglish keywords
        const matchedProducts = productsWithSheetName.filter(product => {
          if (matchProductWithMetakeywords(product, hinglishKeywords)) {
            return true;
          }
          
          const productText = Object.values(product)
            .filter(value => typeof value === 'string' || typeof value === 'number')
            .join(' ')
            .toLowerCase();
          
          return hinglishKeywords.some(keyword => productText.includes(keyword.toLowerCase()));
        });
        
        hinglishProducts = [...hinglishProducts, ...matchedProducts];
      }
      
      if (hinglishProducts.length > 0) {
        return hinglishProducts;
      }
    }
    
    // If no products found with keywords, get a sample of products from all relevant sheets
    // This gives the user some results even if exact keyword matches fail
    const sampleProducts = [];
    
    for (const sheetName of relevantSheets) {
      const worksheet = workbook.Sheets[sheetName];
      const sheetData = XLSX.utils.sheet_to_json(worksheet);
      
      // Take a small sample from each sheet
      const sample = sheetData.slice(0, 3).map(product => ({
        ...product,
        category: sheetName,
      }));
      
      sampleProducts.push(...sample);
    }
    
    if (sampleProducts.length > 0) {
      return sampleProducts;
    }
    
    return [];
  } catch (error) {
    console.error('Product search error:', error);
    
    // Fallback to CSV if Excel fails
    try {
      const csvResponse = await fetch('/data/plywood.csv');
      const csvText = await csvResponse.text();
      
      // Parse CSV data
      const { data } = Papa.parse(csvText, { header: true });
      
      // Filter products based on keywords
      const matchedProducts = data.filter(product => {
        const productText = Object.values(product)
          .filter(value => typeof value === 'string')
          .join(' ')
          .toLowerCase();
        
        return keywords.some(keyword => productText.includes(keyword.toLowerCase()));
      });
      
      return matchedProducts;
    } catch (csvError) {
      console.error('CSV fallback error:', csvError);
      return [];
    }
  }
};

// Function to generate a response using OpenAI with the retrieved context
const generateResponseWithOpenAI = async (query, products) => {
  if (products.length === 0) {
    return "I couldn't find any products matching your request. Could you please provide more details about what you're looking for?";
  }
  
  try {
    // Group products by category/sheet
    const productsByCategory = products.reduce((acc, product) => {
      const category = product.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(product);
      return acc;
    }, {});
    
    // Format product data to provide as context
    let productContext = '';
    
    for (const [category, categoryProducts] of Object.entries(productsByCategory)) {
      productContext += `\n== ${category} ==\n`;
      
      categoryProducts.forEach(product => {
        productContext += `\nProduct ID: ${product.id}\n`;
        
        // Add all product properties dynamically
        Object.entries(product).forEach(([key, value]) => {
          // Skip id (already added) and category (used for grouping)
          if (key !== 'id' && key !== 'category' && key !== 'Metakeywords') {
            productContext += `${key}: ${value}\n`;
          }
        });
      });
      
      productContext += '\n';
    }
    
    // Build the prompt for OpenAI
    const prompt = `
You are a helpful shopping assistant. The user is looking for products based on the following query:
"${query}"

I've searched across multiple product categories and found these matching items:

${productContext}

Please provide a helpful, conversational response that:
1. Summarizes the available options
2. Groups them by their respective categories
3. Highlights key features relevant to the user's query
4. Makes personalized recommendations if appropriate
5. Formats the response in a clean, readable way
6. Asks a follow-up question to help narrow down options if there are many results

Your response should be directly useful to the user without requiring them to understand the technical details of how you found the information.
`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-16k",
      messages: [
        { role: "system", content: "You are a helpful shopping assistant specializing in finding the perfect products based on user needs." },
        { role: "user", content: prompt }
      ],
      max_tokens: 800,
      temperature: 0.7,
    });
    
    // Return the generated response
    return completion.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI generation error:', error);
    
    // Fallback to the simpler response generation if OpenAI fails
    return generateFallbackResponse(products);
  }
};

// Fallback response generation when API calls fail
const generateFallbackResponse = (products) => {
  // Group products by category for a more structured response
  const categories = {};
  
  products.forEach(product => {
    const category = product.category || product.price_category || 'Other';
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(product);
  });
  
  let response = "Based on your request, I found the following products:\n\n";
  
  for (const [category, categoryProducts] of Object.entries(categories)) {
    response += `${category} options:\n`;
    categoryProducts.forEach(product => {
      const name = product.name || product.title || product.Name || `Product ${product.id}`;
      const description = product.description || product.Description || '';
      response += `- ${name}: ${description}\n`;
    });
    response += '\n';
  }
  
  response += "Would you like more details about any specific product?";
  
  return response;
}; 