import { sheets } from './server.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  try {
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Invoices!A:I',
    });
    const rows = response.data.values;
    // Print last 5 rows
    const last = rows.slice(-5);
    console.log(last);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
