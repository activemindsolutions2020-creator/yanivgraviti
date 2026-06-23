import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
privateKey = privateKey.replace(/^"|"$/g, '');
privateKey = privateKey.replace(/\\n/g, '\n');

const auth = new google.auth.JWT(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  null,
  privateKey,
  ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
);

const sheets = google.sheets({ version: 'v4', auth });

async function checkJune() {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const getResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Invoices!A:I',
  });
  
  const rows = getResponse.data.values || [];
  const juneRows = rows.filter(r => (r[1] || '').includes('06/2026'));
  console.log(`Found ${juneRows.length} rows for June 2026:`);
  juneRows.forEach(r => {
    console.log(`Date: ${r[1]}, Vendor: ${r[2]}, Amount: ${r[4]}, URL: ${r[7]}`);
  });
}

checkJune().catch(console.error);
