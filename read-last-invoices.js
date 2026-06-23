import { google } from "googleapis";
import dotenv from "dotenv";
dotenv.config();

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
let privateKey = process.env.GOOGLE_PRIVATE_KEY || "";
privateKey = privateKey.replace(/^"|"$/g, "").replace(/\\n/g, "\n");

const auth = new google.auth.JWT(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  null,
  privateKey,
  SCOPES
);

const sheets = google.sheets({ version: "v4", auth });

async function run() {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: "Invoices!A:H",
  });
  const rows = response.data.values || [];
  console.log(rows.slice(-5));
}
run();
