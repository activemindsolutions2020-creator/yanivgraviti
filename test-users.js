import axios from 'axios';
import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  try {
    let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
    privateKey = privateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');

    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      privateKey,
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth });
    
    const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: 'Users!A:K',
    });
    
    console.log(JSON.stringify(getResponse.data.values, null, 2));
  } catch (err) {
    console.error(err);
  }
}
test();
