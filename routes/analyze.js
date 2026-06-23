import express from "express";
import multer from "multer";
import { Readable } from "stream";
import dotenv from "dotenv";
dotenv.config(); // Ensure env vars are loaded before Cloudinary configures itself
import { GoogleGenerativeAI } from "@google/generative-ai";
import { drive, sheets } from "../server.js";
import { v2 as cloudinary } from "cloudinary";
cloudinary.config(true); // Force Cloudinary to read the newly loaded process.env
import JSON5 from "json5";
import { PDFDocument } from "pdf-lib";
import fs from "fs";
import path from "path";

const router = express.Router();

// Configure Multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
});

// Fallback sequence of models to try
let currentKeyIndex = 0;

// POST /api/analyze - Receives multipart/form-data with 'invoiceFile'
router.post("/", upload.single("invoiceFile"), async (req, res) => {
  try {
    const file = req.file;
    const { userEmail } = req.body;

    if (!file) {
      return res.status(400).json({ success: false, message: "No file uploaded." });
    }

    const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY;
    if (!rawKeys) {
      return res.status(500).json({ 
        success: false, 
        message: "AI Service is not configured. Missing GEMINI_API_KEY or GEMINI_API_KEYS." 
      });
    }

    const keys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);
    
    console.log(`Analyzing file: ${file.originalname} (${file.mimetype}) for user: ${userEmail}`);

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

    const docType = isInsolvency ? "insolvency document" : "financial document";
    const prompt = `Analyze this ${docType} (invoice/receipt). The document might be in Hebrew or English and may contain MULTIPLE receipts or invoices.
Extract the details for EACH distinct receipt found and return ONLY a valid JSON ARRAY of objects. Each object must have these EXACT keys:
- "type": (e.g. "Invoice", "Receipt", "חשבונית מס", "קבלה")
- "vendor": (Name of the business/person who issued it, in Hebrew if possible)
- "category": (MUST be ONE of the exact following official Israeli trustee report categories. For EXPENSES: "שכר דירה", "משכנתא", "מיסי עירייה", "כלכלה (מזון)", "טלפון, כבלים ואינטרנט", "טלפון נייד", "גז", "ועד בית", "מים", "חשמל", "תשלום חודשי לממונה", "הוצאות רפואיות", "נסיעות לעבודה", "טיפול בילדים", "תשלום מזונות", "נסיעות אחרות", "אחזקת רכב", "חינוך ותרבות", "הלבשה", "הוצאות נוספות". For INCOME: "משכורת נטו", "הכנסה מעסק", "פנסיה", "שכר דירה (הכנסה)", "קצבאות ביטוח לאומי", "מזונות (הכנסה)", "הכנסות נוספות". Do NOT invent new categories.)
- "totalAmount": (Numeric value only, e.g. 150.50. If not found, use 0)
- "currency": (e.g. "ILS", "USD", "EUR")
- "date": (Format as DD/MM/YYYY if possible, or extract as written)
- "pageNumber": (The page number in the PDF where this specific receipt is located. 1-indexed. e.g., 1, 2, 3... If it's an image, just return 1)

If there is only one receipt, return an array with one object. If you cannot find a specific field, do your best to infer it from the context or leave it as "Unknown". Do not return an empty array. ONLY return the raw JSON array without markdown formatting.`;
    let mimeType = file.mimetype;
    // Force application/pdf if the file name indicates it's a PDF, 
    // because Windows sometimes uploads PDFs as application/octet-stream
    if (file.originalname.toLowerCase().endsWith(".pdf")) {
      mimeType = "application/pdf";
    }

    const imageParts = [
      {
        inlineData: {
          data: file.buffer.toString("base64"),
          mimeType: mimeType
        }
      }
    ];

    let resultText = null;
    let firstError = null;
    let success = false;

    // Dynamically fetch available models to prevent 404 errors!
    let MODELS_TO_TRY = [];
    try {
      // Use the first API key to query Google for exactly which models are currently online and available
      const fetchReq = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${keys[0]}`);
      const data = await fetchReq.json();
      
      if (data.models) {
         MODELS_TO_TRY = data.models
            .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent") && m.name.includes("gemini"))
            .map(m => m.name.replace("models/", ""));
            
         // Sort to prioritize fast 'flash' models over 'pro', and newer versions over older ones
         MODELS_TO_TRY.sort((a, b) => {
            if (a.includes("flash") && !b.includes("flash")) return -1;
            if (!a.includes("flash") && b.includes("flash")) return 1;
            // Reverse alphabetical roughly sorts newer versions (2.5) before older (1.5)
            return b.localeCompare(a);
         });
         
         // Keep only the top 4 models so we don't wait forever if rate-limited globally
         MODELS_TO_TRY = MODELS_TO_TRY.slice(0, 4);
      } else {
         throw new Error("No models array in response");
      }
    } catch (e) {
      console.warn("Failed to dynamically fetch models list, using hardcoded fallback. Error:", e.message);
      MODELS_TO_TRY = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"];
    }
    
    console.log(`Dynamically selected models to try in order: ${MODELS_TO_TRY.join(", ")}`);

    // Loop through models FIRST.
    for (const modelName of MODELS_TO_TRY) {
      console.log(`\n--- Trying model: ${modelName} ---`);
      
      // Try each key for the current model
      for (const activeKey of keys) {
        try {
          console.log(`Attempting to analyze using model: ${modelName} with API Key ending in ...${activeKey.slice(-4)}`);
          const genAI = new GoogleGenerativeAI(activeKey);
          const model = genAI.getGenerativeModel({ 
            model: modelName,
            generationConfig: { responseMimeType: "application/json" }
          });
          
          const result = await model.generateContent([prompt, ...imageParts]);
          const response = await result.response;
          resultText = response.text();
          
          console.log(`Successfully analyzed using model: ${modelName}`);
          success = true;
          break; // Break the KEY loop, we succeeded!
        } catch (error) {
          console.warn(`Model ${modelName} failed with key ...${activeKey.slice(-4)}. Error: ${error.message}`);
          firstError = error; // Always update so we see the LATEST error (like 429), not a masked 404 from a failed model
          
          // If 404 (model not found), it won't exist for ANY key. Instantly jump to NEXT MODEL!
          if (error.message && (error.message.includes("404") || error.message.includes("not found"))) {
             console.log(`Model ${modelName} does not exist. Instantly jumping to fallback model...`);
             break; // Break the KEY loop!
          }

          // If 429 or 503, try the NEXT MODEL instantly! 
          // All keys share the same Google Project, so if one key hits a rate limit for this model, ALL keys will hit it.
          if (error.message && (error.message.includes("429") || error.message.includes("Too Many Requests") || error.message.includes("503"))) {
             console.log(`Project rate limit hit on model ${modelName}! Instantly jumping to fallback model...`);
             break; // Break the KEY loop!
          }
          
          // If 400, key is invalid or payload is bad
          if (error.message && (error.message.includes("400") || error.message.includes("API key not valid"))) {
             continue; // Go to next key
          }
        }
      }
      
      if (success) break; // Break the MODEL loop if we got a successful response!
    }

    if (!resultText) {
      throw firstError || new Error("All fallback models failed to analyze the document.");
    }
    
    // Clean markdown formatting if present
    resultText = resultText.replace(/```json/i, "").replace(/```/g, "").trim();

    // Extract JSON from potential surrounding text
    const jsonMatch = resultText.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (jsonMatch) {
      resultText = jsonMatch[0];
    }
    
    // Fix common LLM JSON syntax errors
    resultText = resultText.replace(/,\s*([\]}])/g, '$1'); // Trailing commas
    resultText = resultText.replace(/(?<!\\)בע"([א-תa-zA-Z])/g, 'בע\\"$1'); // Unescaped Ltd quotes with any letter (e.g. בע"מ, בע"p, בע"פ)

    let parsedResult;
    try {
      parsedResult = JSON5.parse(resultText);
      // Ensure the result is an array
      if (!Array.isArray(parsedResult)) {
        parsedResult = [parsedResult];
      }
    } catch (parseError) {
      console.error("Failed to parse AI JSON. Raw text:", resultText);
      return res.status(500).json({ success: false, message: `JSON5 Error: ${parseError.message}. (Raw: ${resultText})` });
    }

    // =========================================================================
    // Save to Cloudinary & Google Sheets
    // =========================================================================
    
    const uploadBufferToCloudinary = (buffer, isPdfFormat = false) => {
      return new Promise((resolve, reject) => {
        const options = { resource_type: "auto", folder: "yaniv_invoices" };
        if (isPdfFormat) options.format = "pdf";
        
        const stream = cloudinary.uploader.upload_stream(
          options,
          (error, result) => {
            if (error) return reject(error);
            resolve(result.secure_url);
          }
        );
        stream.end(buffer);
      });
    };

    let defaultFileUrl = "N/A";
    let isPdf = file.originalname.toLowerCase().endsWith(".pdf") || file.mimetype === "application/pdf";
    let pdfDoc = null;

    try {
      // 1. Upload the full original file as a fallback/default
      console.log(`Uploading full ${file.originalname} to Cloudinary...`);
      defaultFileUrl = await uploadBufferToCloudinary(file.buffer, isPdf);
      console.log(`Full file uploaded successfully. URL: ${defaultFileUrl}`);
    } catch (uploadError) {
      console.error("Failed to upload full file to Cloudinary:", uploadError.message);
    }

    if (isPdf) {
       try {
         pdfDoc = await PDFDocument.load(file.buffer);
       } catch (e) {
         console.error("Failed to load PDF with pdf-lib:", e);
       }
    }

    // 2. Split PDF pages sequentially to avoid pdf-lib concurrency bug, then upload concurrently
    const buffersToUpload = [];
    for (const item of parsedResult) {
      item.fileUrl = defaultFileUrl; // fallback
      if (pdfDoc && item.pageNumber) {
        const pageIndex = parseInt(item.pageNumber, 10) - 1;
        if (!isNaN(pageIndex) && pageIndex >= 0 && pageIndex < pdfDoc.getPageCount()) {
          try {
            console.log(`Splitting PDF page ${item.pageNumber} for vendor ${item.vendor}...`);
            const newPdf = await PDFDocument.create();
            const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageIndex]);
            newPdf.addPage(copiedPage);
            const pdfBytes = await newPdf.save();
            const buffer = Buffer.from(pdfBytes);
            buffersToUpload.push({ item, buffer });
          } catch(err) {
             console.error(`Failed to split PDF page ${item.pageNumber}:`, err.message);
          }
        }
      }
    }

    const uploadPromises = buffersToUpload.map(async ({ item, buffer }) => {
       try {
         const splitUrl = await uploadBufferToCloudinary(buffer, true);
         item.fileUrl = splitUrl;
         console.log(`Successfully uploaded page ${item.pageNumber}. URL: ${splitUrl}`);
       } catch (err) {
         console.error(`Failed to upload page ${item.pageNumber} to Cloudinary:`, err.message);
       }
    });

    // 2.5 Currency Conversion (Run Concurrently)
    const currencyPromises = parsedResult.map(async (item) => {
      const currency = item.currency ? item.currency.toUpperCase() : "ILS";
      if (currency !== "ILS" && currency !== "₪" && currency !== "NIS") {
        try {
          console.log(`Converting ${item.totalAmount} ${currency} to ILS...`);
          
          // Add timeout to fetch to prevent hanging
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
          
          const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${currency}`, {
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          
          const data = await response.json();
          const rate = data.rates["ILS"];
          if (rate) {
            const convertedAmount = parseFloat(item.totalAmount) * rate;
            item.vendor = `${item.vendor || 'Unknown'} (מקור: ${item.totalAmount} ${currency})`;
            item.totalAmount = convertedAmount.toFixed(2);
            item.currency = "ILS";
            console.log(`Converted to ${item.totalAmount} ILS (Rate: ${rate})`);
          }
        } catch (error) {
          console.error(`Failed to convert currency ${currency}:`, error.message);
        }
      }
    });

    // Wait for all uploads and currency conversions to finish concurrently
    await Promise.all([...uploadPromises, ...currencyPromises]);

    try {
      // 2. Fetch existing rows to check for duplicates
      let existingRows = [];
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: process.env.SPREADSHEET_ID,
          range: "Invoices!A:E", // We only need Date(B), Vendor(C), Amount(E)
        });
        existingRows = response.data.values || [];
      } catch (err) {
        console.error("Failed to fetch existing rows for duplicate check:", err.message);
      }

      console.log(`Appending rows to Google Sheets...`);
      
      const normalizeVendor = (str) => {
        if (!str) return "";
        // Remove common Ltd suffixes and all non-alphanumeric characters for fuzzy matching
        return str.replace(/בע"מ|בע"ים|בעמ|בע"p/g, "").replace(/[^א-תa-zA-Z0-9]/g, "").trim();
      };

      const rowsToAppend = parsedResult.map(item => {
        let isDuplicate = false;
        const newItemAmount = parseFloat(item.totalAmount || 0);
        const normalizedItemVendor = normalizeVendor(item.vendor);
        
        // Skip header row usually at index 0, but loop all to be safe
        for (let i = 1; i < existingRows.length; i++) {
          const row = existingRows[i];
          if (row && row.length >= 5) {
             const existingDate = row[1];
             const existingVendor = row[2];
             const existingAmount = parseFloat(row[4] || 0);
             
             if (existingDate === item.date && existingAmount === newItemAmount && normalizeVendor(existingVendor) === normalizedItemVendor) {
                isDuplicate = true;
                console.log(`Duplicate found for vendor ${item.vendor} on ${item.date} for ${newItemAmount}`);
                break;
             }
          }
        }

        return [
          userEmail,
          item.date || "",
          item.vendor || "",
          item.category || "", 
          item.totalAmount || 0,
          item.currency || "ILS",
          item.type || "",
          item.fileUrl || defaultFileUrl || "N/A",
          isDuplicate ? "Duplicate" : "Pending"
        ];
      });

      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: "Invoices!A:I",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: rowsToAppend
        }
      });
      console.log(`Saved ${rowsToAppend.length} rows to Google Sheets successfully.`);
    } catch (sheetError) {
      console.error("Failed to save to Sheets:", sheetError.message);
    }

    // Return the successful structured data
    return res.status(200).json({
      success: true,
      message: "Analysis complete and data saved.",
      data: parsedResult,
    });

  } catch (error) {
    console.error("Error during file analysis:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "An error occurred during file analysis.",
    });
  }
});

export default router;