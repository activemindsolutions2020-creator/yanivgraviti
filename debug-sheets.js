import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
privateKey = privateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');

const auth = new google.auth.JWT(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  null,
  privateKey,
  ['https://www.googleapis.com/auth/spreadsheets']
);

const sheets = google.sheets({ version: 'v4', auth });

async function check() {
  try {
    const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: 'Invoices!A:I',
    });
    const rows = getResponse.data.values || [];
    console.log(`Total rows: ${rows.length}`);
    if (rows.length > 0) {
      console.log('Headers:', rows[0]);
      console.log('Last row:', rows[rows.length - 1]);
    }
  } catch(e) {
    console.error('Error:', e.message);
  }
}
check();
