import cron from 'node-cron';
import { sheets } from '../server.js';
import { generateUserReport } from '../routes/report.js';

// Run every day at 02:00 AM
cron.schedule('0 2 * * *', async () => {
  console.log('Cron started: Checking for daily PDF reports to generate...');
  
  try {
    const spreadsheetId = process.env.SPREADSHEET_ID;
    // Fetch up to Column F (Index 5) assuming ReportDayOfMonth is stored there
    const range = 'Users_Config!A:F'; 
    
    const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = getResponse.data.values || [];
    const today = new Date().getDate(); // Returns day of the month 1-31

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const userEmail = row[0];
      // Safely parse the ReportDayOfMonth from column F (index 5)
      const reportDay = parseInt(row[5], 10);

      if (userEmail && reportDay === today) {
        console.log(`Processing user: ${userEmail}`);
        try {
          const result = await generateUserReport(userEmail);
          console.log(`Successfully processed user ${userEmail}: ${result.message}`);
        } catch (userError) {
          console.error(`Failed to process user ${userEmail}:`, userError.message);
        }
      }
    }
    
    console.log('Cron finished: Daily reports check completed.');
  } catch (error) {
    console.error('Error during cron execution:', error);
  }
});