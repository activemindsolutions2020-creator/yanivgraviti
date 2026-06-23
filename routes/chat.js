import express from "express";
import multer from "multer";
import dotenv from "dotenv";
dotenv.config();
import { GoogleGenerativeAI } from "@google/generative-ai";
import { sheets } from "../server.js";
import JSON5 from "json5";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

let currentKeyIndex = 0;

// Helper to fetch user's previous invoices for context
async function getUserInvoices(userEmail) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: "Invoices!A:I",
    });
    const rows = response.data.values || [];
    // Skip header, filter by userEmail (which is at index 0)
    const userInvoices = rows.slice(1).filter(row => row[0] === userEmail);
    return userInvoices.map(row => ({
      email: row[0],
      date: row[1],
      vendor: row[2],
      category: row[3],
      amount: row[4],
      currency: row[5],
      type: row[6],
      status: row[8]
    }));
  } catch (err) {
    console.error("Failed to fetch user invoices for chat context:", err.message);
    return [];
  }
}

router.post("/", upload.single("voiceFile"), async (req, res) => {
  try {
    const file = req.file;
    const { userEmail, textMessage, source } = req.body;

    if (!userEmail) {
      return res.status(400).json({ success: false, message: "Missing userEmail" });
    }

    if (!file && !textMessage) {
      return res.status(400).json({ success: false, message: "No text or voice file provided." });
    }

    const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY;
    if (!rawKeys) {
      return res.status(500).json({ success: false, message: "Missing GEMINI_API_KEY" });
    }
    const keys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);

    // Fetch user context
    const userHistory = await getUserInvoices(userEmail);

    const systemPrompt = `You are "Smart Insolvency Assistant" (רואה חשבון וירטואלי חכם).
You are assisting a user in Israel who is going through personal bankruptcy (חדלות פירעון).
You must answer in Hebrew, be empathetic, professional, and helpful.

GENERAL INSOLVENCY RULES IN ISRAEL:
- Permitted expenses (מה מותר): basic food, rent, utilities, basic clothing, necessary medical expenses, public transport.
- Forbidden/restricted expenses (מה אסור/בעייתי): luxury items, vacations abroad, gambling, high-end restaurants, new expensive cars, new large debts/loans.
- The user has a monthly payment they must make to the trustee (קופת הנשייה).
- Provide helpful links if relevant: https://www.gov.il/he/departments/topics/insolvency (אתר משרד המשפטים - הממונה על הליכי חדלות פירעון).

USER FINANCIAL HISTORY (JSON):
${JSON.stringify(userHistory, null, 2)}

TASK:
Analyze the user's message (which may be text or an audio transcript). Determine the INTENT:
1. "expense" - The user is reporting a new expense or income (e.g., "I just paid 200 ILS for groceries at Shufersal").
2. "chat" - The user is asking a question, asking for a report/summary of their expenses, or chatting.

If INTENT is "expense":
Extract the details and return JSON EXACTLY in this format:
{
  "intent": "expense",
  "expenseData": {
    "type": "Invoice" or "Receipt",
    "vendor": "Name of business",
    "category": "One of: שכר דירה, משכנתא, מיסי עירייה, כלכלה (מזון), טלפון, כבלים ואינטרנט, טלפון נייד, גז, ועד בית, מים, חשמל, תשלום חודשי לממונה, הוצאות רפואיות, נסיעות לעבודה, טיפול בילדים, תשלום מזונות, נסיעות אחרות, אחזקת רכב, חינוך ותרבות, הלבשה, הוצאות נוספות",
    "totalAmount": 150.50,
    "currency": "ILS",
    "date": "DD/MM/YYYY"
  },
  "replyText": "A friendly confirmation message in Hebrew that it was logged."
}

If INTENT is "chat":
Read their history, calculate any sums they asked for, provide financial advice, or answer their question about insolvency rules.
Return JSON EXACTLY in this format:
{
  "intent": "chat",
  "replyText": "Your full response in Hebrew. Use markdown for formatting."
}

CRITICAL: Return ONLY valid JSON. Do not include markdown \`\`\`json blocks around the output.`;

    const contents = [];
    if (file) {
      contents.push({
        inlineData: {
          data: file.buffer.toString("base64"),
          mimeType: file.mimetype === "audio/ogg" || file.originalname.endsWith(".ogg") ? "audio/ogg" : file.mimetype
        }
      });
    }
    if (textMessage) {
      contents.push(textMessage);
    }

    let resultText = null;
    let firstError = null;
    let success = false;

    // Dynamically fetch available models to prevent 404 errors!
    let MODELS_TO_TRY = [];
    try {
      const fetchReq = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${keys[0]}`);
      const data = await fetchReq.json();
      if (data.models) {
         MODELS_TO_TRY = data.models
            .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent") && m.name.includes("gemini"))
            .map(m => m.name.replace("models/", ""));
         MODELS_TO_TRY.sort((a, b) => {
            if (a.includes("flash") && !b.includes("flash")) return -1;
            if (!a.includes("flash") && b.includes("flash")) return 1;
            return b.localeCompare(a);
         });
         MODELS_TO_TRY = MODELS_TO_TRY.slice(0, 4);
      } else {
         throw new Error("No models array in response");
      }
    } catch (e) {
      console.warn("Failed to dynamically fetch models list, using hardcoded fallback. Error:", e.message);
      MODELS_TO_TRY = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"];
    }

    // Loop through models FIRST
    for (const modelName of MODELS_TO_TRY) {
      // Try each key
      for (const activeKey of keys) {
        try {
          const genAI = new GoogleGenerativeAI(activeKey);
          const model = genAI.getGenerativeModel({ 
             model: modelName,
             systemInstruction: systemPrompt 
          });
          const result = await model.generateContent(contents);
          resultText = result.response.text();
          success = true;
          break; // Break the KEY loop
        } catch (err) {
          firstError = err;
          if (err.message && (err.message.includes("404") || err.message.includes("not found"))) break;
          if (err.message && (err.message.includes("429") || err.message.includes("Too Many Requests") || err.message.includes("503"))) break;
          if (err.message && (err.message.includes("400") || err.message.includes("API key not valid"))) continue;
        }
      }
      if (success) break; // Break the MODEL loop
    }

    if (!resultText) {
      throw firstError || new Error("Failed to generate response.");
    }

    // Clean JSON
    resultText = resultText.replace(/```json/i, "").replace(/```/g, "").trim();
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      resultText = jsonMatch[0];
    }

    let parsedResult;
    try {
      parsedResult = JSON5.parse(resultText);
    } catch (parseError) {
      return res.status(500).json({ success: false, message: `JSON Parse Error: ${parseError.message}`, raw: resultText });
    }

    // If it's an expense, append it to sheets!
    if (parsedResult.intent === "expense" && parsedResult.expenseData) {
       const item = parsedResult.expenseData;
       const rowToAppend = [
          item.type || "Invoice",
          item.date || new Date().toLocaleDateString('he-IL'),
          item.vendor || "Unknown",
          item.category || "אחר",
          item.totalAmount || 0,
          userEmail,
          "N/A" // No physical file URL for voice/text expenses
       ];

       try {
         await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: "Invoices!A:G",
            valueInputOption: "USER_ENTERED",
            requestBody: { values: [rowToAppend] },
         });
       } catch (sheetErr) {
         console.error("Failed to append voice expense:", sheetErr);
         return res.status(500).json({ success: false, message: "הפענוח הצליח אך השמירה בגוגל שיטס נכשלה." });
       }
    }

    return res.json({
      success: true,
      intent: parsedResult.intent,
      replyText: parsedResult.replyText,
      expenseData: parsedResult.expenseData
    });

  } catch (error) {
    console.error("Chat API Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
