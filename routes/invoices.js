import express from 'express';
import { sheets } from '../server.js';

const router = express.Router();

// GET /api/invoices?userEmail=test@example.com
router.get('/', async (req, res) => {
  try {
    const { userEmail } = req.query;
    if (!userEmail) {
      return res.status(400).json({ success: false, message: 'userEmail is required' });
    }

    const spreadsheetId = process.env.SPREADSHEET_ID;
    const range = 'Invoices!A:I'; 

    const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = getResponse.data.values || [];
    const invoices = [];
    
    // Skip header row if it exists, assume first row might be headers
    rows.forEach((row, index) => {
      const rowEmail = row[0];
      const status = row[8] || '';
      
      // Filter out deleted/cancelled rows
      if (rowEmail === userEmail && status !== 'מבוטל') {
        invoices.push({
          id: index, // Unique enough for frontend keys (maps to row index)
          date: row[1] || 'N/A',
          vendor: row[2] || 'N/A',
          category: row[3] || 'Uncategorized',
          amount: parseFloat(row[4]) || 0,
          currency: row[5] || 'ILS',
          type: row[6] || 'N/A',
          driveFileId: row[7],
          status: status
        });
      }
    });

    return res.status(200).json({
      success: true,
      data: invoices
    });

  } catch (error) {
    console.error('Error fetching invoices:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// DELETE /api/invoices/:id (Soft Delete - updates status to 'מבוטל')
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail } = req.query; // For security, though simple here

    if (!userEmail) {
      return res.status(400).json({ success: false, message: 'userEmail is required' });
    }

    const rowIndex = parseInt(id, 10);
    if (isNaN(rowIndex) || rowIndex < 0) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }

    const rowNumber = rowIndex + 1; // 0-based array to 1-based sheet row
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // Update only the Status column (Column I) to "מבוטל"
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Invoices!I${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['מבוטל']]
      }
    });

    return res.status(200).json({ success: true, message: 'Invoice deleted successfully' });

  } catch (error) {
    console.error('Error deleting invoice:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// PUT /api/invoices/:id (Edit row)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail, date, vendor, category, amount, currency, type } = req.body;

    if (!userEmail || !date || amount === undefined) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const rowIndex = parseInt(id, 10);
    if (isNaN(rowIndex) || rowIndex < 0) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }

    const rowNumber = rowIndex + 1;
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // We update columns B through G (Date, Vendor, Category, Amount, Currency, Type)
    // Column A is Email, H is DriveId, I is Status - we leave those alone.
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Invoices!B${rowNumber}:G${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[date, vendor, category, amount, currency, type]]
      }
    });

    return res.status(200).json({ success: true, message: 'Invoice updated successfully' });

  } catch (error) {
    console.error('Error updating invoice:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

export default router;
