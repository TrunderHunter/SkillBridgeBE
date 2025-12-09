const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

/**
 * Script to list all available Gemini models for your API key
 * Run: node scripts/list-gemini-models.js
 */

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not found in .env file');
    process.exit(1);
  }

  console.log(
    '🔑 API Key:',
    apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4)
  );
  console.log('');

  try {
    console.log('📋 Fetching available models...');
    console.log('');

    const genAI = new GoogleGenerativeAI(apiKey);

    // Try to list models (this might not work with all API versions)
    // If it fails, we'll test individual models

    console.log('🧪 Testing common models:');
    console.log('');

    const modelsToTest = [
      // Stable models (v1)
      'gemini-pro',
      'gemini-pro-vision',

      // 1.5 Flash variants
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash-001',
      'gemini-1.5-flash-002',
      'models/gemini-1.5-flash',
      'models/gemini-1.5-flash-latest',

      // 1.5 Pro variants
      'gemini-1.5-pro',
      'gemini-1.5-pro-latest',
      'gemini-1.5-pro-001',
      'gemini-1.5-pro-002',
      'models/gemini-1.5-pro',
      'models/gemini-1.5-pro-latest',

      // 2.0 Experimental
      'gemini-2.0-flash-exp',
      'models/gemini-2.0-flash-exp',
      'gemini-exp-1206',
      'gemini-2.0-flash-thinking-exp',
      'gemini-2.0-flash-thinking-exp-1219',

      // 2.5 variants (if available)
      'gemini-2.5-flash',
      'gemini-2.5-flash-latest',
      'gemini-2.5-flash-exp',
      'gemini-2.5-pro',
      'gemini-2.5-pro-latest',
      'gemini-2.5-pro-exp',
      'models/gemini-2.5-flash',
      'models/gemini-2.5-flash-latest',
      'models/gemini-2.5-pro',
      'models/gemini-2.5-pro-latest',

      // Legacy
      'gemini-1.0-pro',
      'gemini-1.0-pro-001',
      'gemini-1.0-pro-latest',
    ];

    for (const modelName of modelsToTest) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('Test');
        const response = await result.response;
        const text = response.text();

        console.log(`✅ ${modelName.padEnd(30)} - WORKS!`);
      } catch (error) {
        const status = error.status || 'unknown';
        const msg = error.message?.includes('404')
          ? '404 Not Found'
          : error.message?.includes('429')
            ? '429 Quota Exceeded'
            : 'Error';
        console.log(`❌ ${modelName.padEnd(30)} - ${msg}`);
      }
    }

    console.log('');
    console.log(
      '💡 Use the first model that shows "WORKS!" in gemini.service.ts'
    );
    console.log('');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('');
    console.error('Try regenerating your API key at:');
    console.error('https://makersuite.google.com/app/apikey');
  }
}

listModels();
