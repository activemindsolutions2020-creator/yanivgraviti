import { google } from 'googleapis';
import dotenv from 'dotenv';
import { Readable } from 'stream';
dotenv.config();

let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
privateKey = privateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');

const auth = new google.auth.JWT(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  null,
  privateKey,
  ['https://www.googleapis.com/auth/drive']
);

const drive = google.drive({ version: 'v3', auth });

async function run() {
  try {
    const dummyContent = "This is a test file to check Google Drive permissions.";
    const fileMetadata = {
      name: `Test_Upload_${Date.now()}.txt`,
      parents: [process.env.DRIVE_FOLDER_ID]
    };
    const media = {
      mimeType: 'text/plain',
      body: Readable.from([dummyContent])
    };

    console.log("Attempting to upload to folder:", process.env.DRIVE_FOLDER_ID);
    const driveFile = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id",
    });
    console.log(`Success! File ID: ${driveFile.data.id}`);
  } catch (err) {
    console.error("Upload Error:", err.message);
  }
}
run();
