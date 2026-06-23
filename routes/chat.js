import express from "express";
import multer from "multer";
import dotenv from "dotenv";
dotenv.config();
import { GoogleGenerativeAI } from "@google/generative-ai";
import { sheets } from "../server.js";
import JSON5 from "json5";
import fs from "fs";
import path from "path";

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

    // Fetch user profile to check insolvency status
    let isInsolvency = false; // default
    try {
      const DATA_FILE = path.join(process.cwd(), 'data', 'users.json');
      if (fs.existsSync(DATA_FILE)) {
        const users = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const userProf = users.find(u => u.userEmail === userEmail);
        if (userProf && userProf.isInsolvency !== undefined) {
          isInsolvency = userProf.isInsolvency === true;
        }
      }
    } catch (e) {
      console.error("Error reading profile for insolvency check:", e);
    }

    const systemPromptInsolvency = `You are "Smart Insolvency Assistant" (רואה חשבון וירטואלי חכם).
You are assisting a user in Israel who is going through personal bankruptcy (חדלות פירעון).
You must answer in Hebrew, be empathetic, professional, and helpful.`;

    const systemPromptFinance = `You are "Smart Finance Assistant" (יועץ פיננסי חכם).
You are assisting a user in Israel with managing their personal finances, tracking expenses, and budgeting.
You must answer in Hebrew, be empathetic, professional, and helpful. Do NOT mention bankruptcy or insolvency rules.`;

    const insolvencyRules = `GENERAL INSOLVENCY RULES IN ISRAEL:
- Permitted expenses (מה מותר): basic food, rent, utilities, basic clothing, necessary medical expenses, public transport.
- Forbidden/restricted expenses (מה אסור/בעייתי): luxury items, vacations abroad, gambling, high-end restaurants, new expensive cars, new large debts/loans.
- The user has a monthly payment they must make to the trustee (קופת הנשייה).
- Provide helpful links if relevant: https://www.gov.il/he/departments/topics/insolvency (אתר משרד המשפטים - הממונה על הליכי חדלות פירעון).`;

    const financeRules = `GENERAL FINANCE RULES:
- Guide the user towards saving money and sticking to their budget.
- Provide general financial tips, tracking patterns, and identifying wasteful expenses.`;

    const rulesSection = isInsolvency ? insolvencyRules : financeRules;
    const basePrompt = isInsolvency ? systemPromptInsolvency : systemPromptFinance;

    const fullSystemPrompt = `${basePrompt}
THE CURRENT DATE IS: ${new Date().toLocaleDateString('en-GB')} (DD/MM/YYYY). All implicit dates should be relative to this date.

${rulesSection}

USER FINANCIAL HISTORY (JSON):
${JSON.stringify(userHistory, null, 2)}

TASK:
Analyze the user's message (which may be text or an audio transcript). Determine the INTENT:
1. "expense" - The user is reporting a new expense or income.
2. "chat" - The user is asking a question or chatting.
3. "generate_report" - The user specifically asks to generate, download, export, or send them a PDF report of their data/invoices.

If INTENT is "expense":
Extract the details. If the user asks to add the expense for multiple months or retroactively, generate an array of objects, one for each relevant month.
Return JSON EXACTLY in this format:
{
  "intent": "expense",
  "expenses": [
    {
      "type": "Must be either 'דיווח טלגרם - הוצאה' if it's an expense, or 'דיווח טלגרם - הכנסה' if it's an income",
      "vendor": "Name of business",
      "category": "One of: שכר דירה, משכנתא, מיסי עירייה, כלכלה (מזון), טלפון, כבלים ואינטרנט, טלפון נייד, גז, ועד בית, מים, חשמל, תשלום חודשי לממונה, הוצאות רפואיות, נסיעות לעבודה, טיפול בילדים, תשלום מזונות, נסיעות אחרות, אחזקת רכב, חינוך ותרבות, הלבשה, הוצאות נוספות, משכורת נטו, הכנסה מעסק, פנסיה, שכר דירה (הכנסה), קצבאות ביטוח לאומי, מזונות (הכנסה), הכנסות נוספות. IF YOU ARE NOT SURE, return 'UNKNOWN'.",
      "suggestedCategories": ["If category is UNKNOWN, provide an array of exactly 3 likely category strings from the list above. Otherwise, omit this field."],
      "totalAmount": 150.50,
      "currency": "ILS",
      "date": "DD/MM/YYYY" // Determine the correct date for each month requested. If they don't specify, use the current date.
    }
  ],
  "replyText": "A friendly confirmation message in Hebrew that it was logged."
}

If INTENT is "chat":
Act as a real-time financial advisor and calculator. Read their history carefully. If the user asks a question about their budget or expenses (e.g. "how much did I spend on food?"), calculate the exact sums from the provided JSON data and answer them accurately with numbers. Provide helpful financial advice.
Return JSON EXACTLY in this format:
{
  "intent": "chat",
  "replyText": "Your full response in Hebrew (Plain text only, NO markdown!)."
}

If INTENT is "generate_report":
If the user specifies a specific month (e.g. "May", "last month"), extract it into MM/YYYY format (e.g. "05/2026"). Otherwise, leave it null.
Return JSON EXACTLY in this format:
{
  "intent": "generate_report",
  "monthYear": "05/2026",
  "replyText": "מייצר את הדו\"ח המבוקש ושולח אליך מיד..."
}

CRITICAL: Return ONLY valid JSON. Do not include markdown \`\`\`json blocks.
IMPORTANT: Never use unescaped double quotes (") inside the JSON string values. For Hebrew abbreviations like דו"ח or מע"מ, use single quotes instead: דו'ח, מע'מ.`;

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
             systemInstruction: fullSystemPrompt 
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
    if (parsedResult.intent === "expense") {
       const expensesToAppend = parsedResult.expenses || (parsedResult.expenseData ? [parsedResult.expenseData] : []);
       const rowsToAppend = expensesToAppend.map(item => [
          userEmail,                                // Index 0 (A): Email
          item.date || new Date().toLocaleDateString('he-IL'), // Index 1 (B): Date
          item.vendor || "Unknown",                 // Index 2 (C): Vendor
          item.category || "אחר",                   // Index 3 (D): Category
          item.totalAmount || 0,                    // Index 4 (E): Amount
          item.currency || "ILS",                   // Index 5 (F): Currency
          item.type || "Invoice",                   // Index 6 (G): Type
          "N/A",                                    // Index 7 (H): File URL
          "Pending"                                 // Index 8 (I): Status
       ]);

       if (rowsToAppend.length > 0) {
           try {
             const appendRes = await sheets.spreadsheets.values.append({
                spreadsheetId: process.env.SPREADSHEET_ID,
                range: "Invoices!A:I",
                valueInputOption: "USER_ENTERED",
                requestBody: { values: rowsToAppend },
             });
             
             // Try to parse the row number: "Invoices!A42:I42" -> 42
             const updatedRange = appendRes.data.updates.updatedRange;
             const match = updatedRange ? updatedRange.match(/!A(\d+):/) : null;
             let startRow = match ? parseInt(match[1], 10) : null;

             if (startRow) {
               expensesToAppend.forEach((exp, i) => {
                 exp.sheetRow = startRow + i;
               });
             }
           } catch (sheetErr) {
             console.error("Failed to append voice expense:", sheetErr);
             return res.status(500).json({ success: false, message: "הפענוח הצליח אך השמירה בגוגל שיטס נכשלה." });
           }
       }
    }

    return res.json({
      success: true,
      intent: parsedResult.intent,
      replyText: parsedResult.replyText,
      expenses: parsedResult.expenses || (parsedResult.expenseData ? [parsedResult.expenseData] : []),
      monthYear: parsedResult.monthYear
    });

  } catch (error) {
    console.error("Chat API Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
