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

import fs from 'fs';
import path from 'path';
import { bot } from './telegramBot.js';
const DATA_FILE = path.join(process.cwd(), 'data', 'users.json');

// Run every day at 10:00 AM server time for Telegram Reminders
cron.schedule('0 10 * * *', async () => {
  console.log('⏰ Cron started: Checking for daily Telegram reminders...');
  try {
    const todayDay = new Date().getDate().toString();
    const spreadsheetId = process.env.SPREADSHEET_ID;
    
    // Fetch from Users sheet to get TelegramChatId
    const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Users!A:I', 
    });
    
    const rows = getResponse.data.values || [];
    const userChatIds = new Map();
    
    // row indices: 0:Email, 3:Status, 8:TelegramChatId
    for (let i = 1; i < rows.length; i++) {
      const email = rows[i][0];
      const status = rows[i][3];
      const chatId = rows[i][8];
      if (status === 'Approved' && chatId) {
        userChatIds.set(email, chatId);
      }
    }

    // Read local users.json for reminder settings (reminderDay, reminderMessage)
    let localUsers = [];
    if (fs.existsSync(DATA_FILE)) {
      localUsers = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }

    for (const localUser of localUsers) {
      const { userEmail, reminderDay, reminderMessage } = localUser;
      const targetDay = reminderDay || "25"; // Default to 25
      
      if (targetDay === todayDay) {
        const chatId = userChatIds.get(userEmail);
        if (chatId) {
          const message = reminderMessage && reminderMessage.trim() !== "" 
            ? reminderMessage 
            : "בוקר טוב! ☀️\nתזכורת קטנה: אנחנו מתקרבים לסוף החודש. אנא ודא שהעלית למערכת את כל קבלות החובה (חשמל, שכר דירה, מים וכו') כדי שלא נתעכב מול הנאמן. תודה!";
            
          try {
            await bot.sendMessage(chatId, message);
            console.log(`✅ Sent reminder to ${userEmail} at chat ${chatId}`);
          } catch (err) {
            console.error(`❌ Failed to send reminder to ${userEmail}:`, err.message);
          }
        }
      }
    }
    console.log('⏰ Cron finished: Daily Telegram reminders check completed.');
  } catch (error) {
    console.error('Error in daily reminder cron:', error);
  }
});