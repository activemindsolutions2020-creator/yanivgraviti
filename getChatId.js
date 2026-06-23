import dotenv from 'dotenv';
dotenv.config();
import { google } from 'googleapis';

const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

async function getChatId() {
  const getResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: 'Users!A:I',
  });
  const rows = getResponse.data.values || [];
  for (let i = 1; i < rows.length; i++) {
    let phone = rows[i][7] || "";
    let digits = String(phone).replace(/\D/g, '');
    if (digits.endsWith('546799182')) {
      console.log("Found Chat ID:", rows[i][8]);
      return;
    }
  }
  console.log("Not found.");
}

getChatId();
