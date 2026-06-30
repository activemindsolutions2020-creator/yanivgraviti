const dotenv = require('dotenv');
dotenv.config();
const keys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY;
const key = keys.split(',')[0].replace(/^"|"$/g, '').trim();
fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`)
  .then(res => res.json())
  .then(data => {
    const models = data.models.filter(m => m.supportedGenerationMethods.includes("generateContent")).map(m => m.name);
    console.log("AVAILABLE MODELS:", models);
  })
  .catch(err => console.error("Error:", err));
