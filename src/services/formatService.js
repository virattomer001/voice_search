// Function to format the response from ChatGPT/RAG
export const formatResponse = (response, products) => {
  try {
    // In a production app, this would connect to OpenAI or another LLM to format the response
    // For our demo, we'll do a basic formatting
    
    if (!response || response.trim() === '') {
      return 'Sorry, I could not generate a response.';
    }
    
    // Format the response to be more conversational
    let formattedResponse = response;
    
    // Replace line breaks with HTML for better display
    formattedResponse = formattedResponse.replace(/\n\n/g, '<br><br>');
    formattedResponse = formattedResponse.replace(/\n/g, '<br>');
    
    // Highlight product names
    if (products && products.length > 0) {
      products.forEach(product => {
        const regex = new RegExp(`(${product.name})`, 'gi');
        formattedResponse = formattedResponse.replace(regex, '<strong>$1</strong>');
      });
    }
    
    return formattedResponse;
  } catch (error) {
    console.error('Error formatting response:', error);
    return response; // Return original response if formatting fails
  }
}; 