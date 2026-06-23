import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const targetPhone = "972546799182";
const message = process.argv[2] || "עדכון מערכת בוצע!";

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
privateKey = privateKey.replace(/^"|"$/g, '');
privateKey = privateKey.replace(/\\n/g, '\n');

const auth = new google.auth.JWT(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  null,
  privateKey,
  SCOPES
);

const sheets = google.sheets({ version: 'v4', auth });

async function notify() {
  try {
    const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: 'Users!A:I',
    });
    const rows = getResponse.data.values || [];
    let chatId = null;
    
    for (let i = 1; i < rows.length; i++) {
      let phone = rows[i][7] || "";
      let digits = String(phone).replace(/\D/g, '');
      if (digits.endsWith('546799182')) {
        chatId = rows[i][8];
        break;
      }
    }
    
    if (!chatId) {
      console.error("Chat ID not found for admin phone.");
      return;
    }
    
    const telegramApi = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(telegramApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: "🚀 *עדכון מערכת (Smart Finance)*\n\n" + message,
        parse_mode: 'Markdown'
      })
    });
    
    if (!res.ok) {
      const data = await res.text();
      console.error("Failed to send telegram message:", data);
    } else {
      console.log("Admin successfully notified!");
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

notify();
