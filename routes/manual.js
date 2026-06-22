import express from 'express';
import { sheets } from '../server.js';

const router = express.Router();

// POST /api/manual
router.post('/', async (req, res) => {
  try {
    const { userEmail, date, vendor, category, amount, currency, type } = req.body;

    if (!userEmail || !date || !amount) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Append to Google Sheets
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: "Invoices!A:I",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            userEmail,
            date,
            vendor || "",
            category || "Uncategorized", 
            amount,
            currency || "ILS",
            type || "Manual",
            "N/A", // driveFileId is N/A for manual entry
            "Reported Manually" // Status
          ]
        ]
      }
    });

    return res.status(200).json({
      success: true,
      message: "Manual entry saved successfully.",
      data: {
        date,
        vendor,
        category,
        amount,
        currency,
        type
      }
    });
  } catch (error) {
    console.error('Error saving manual entry:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

export default router;
