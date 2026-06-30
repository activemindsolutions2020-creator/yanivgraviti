import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';

dotenv.config();

const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY;
if (!rawKeys) {
  console.error("No GEMINI_API_KEY or GEMINI_API_KEYS found in env.");
  process.exit(1);
}

const keys = rawKeys.split(',').map(k => k.trim().replace(/^"|"$/g, '')).filter(Boolean);
console.log(`Found ${keys.length} keys.`);

// Use a tiny 1x1 base64 pixel as a mock image
const pixelBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const imageParts = [{
  inlineData: {
    data: pixelBase64,
    mimeType: "image/png"
  }
}];

async function testKey(key, index) {
  console.log(`\n--- Testing Key #${index + 1} (${key.substring(0, 8)}...) ---`);
  
  const modelsToTry = ["gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-3-flash-preview"];
  for (const modelName of modelsToTry) {
    console.log(`Testing model generateContent with '${modelName}' and an IMAGE...`);
    try {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(["Describe this image", ...imageParts]);
      const text = result.response.text();
      console.log(`✅ Success with ${modelName}: "${text.trim().substring(0, 50)}"`);
    } catch (err) {
      console.error(`❌ Failed with ${modelName}:`, err.message);
    }
  }
}

async function run() {
  for (let i = 0; i < keys.length; i++) {
    await testKey(keys[i], i);
  }
}

run();
