import express from 'express';
import { sheets } from '../server.js';
import { bot } from '../services/telegramBot.js';

const router = express.Router();

// POST /api/admin/broadcast - Send a broadcast message to specific Telegram Chat IDs
router.post('/broadcast', async (req, res) => {
  try {
    const { adminEmail, chatIds, message } = req.body;

    if (!adminEmail) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!message || message.trim() === '') return res.status(400).json({ success: false, message: 'Message is required' });
    if (!Array.isArray(chatIds) || chatIds.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one recipient is required' });
    }

    const spreadsheetId = process.env.SPREADSHEET_ID;
    
    // Verify admin
    const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Users!A:I',
    });

    const rows = getResponse.data.values || [];
    let isAdmin = false;
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === adminEmail && (rows[i][2] === 'Admin' || rows[i][2] === 'Manager')) {
        isAdmin = true;
        break;
      }
    }

    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    let successCount = 0;
    let failedCount = 0;

    // Send messages
    for (const chatId of chatIds) {
      try {
        await bot.sendMessage(chatId, message);
        successCount++;
      } catch (err) {
        console.error(`Failed to send broadcast to ${chatId}:`, err.message);
        failedCount++;
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: `Broadcast completed. Sent: ${successCount}, Failed: ${failedCount}`
    });

  } catch (error) {
    console.error('Error in broadcast:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

export default router;
