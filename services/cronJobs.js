import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { isWithinLastWorkingDays } from './hebcalService.js';
import { sheets } from '../server.js';
import { bot } from './telegramBot.js';
import { generateUserReport } from '../routes/report.js';

const DATA_FILE = path.join(process.cwd(), 'data', 'users.json');

const getUsersData = () => {
  if (fs.existsSync(DATA_FILE)) {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }
  return [];
};

const getMissingReceipts = async (userEmail, monthYear) => {
    try {
        const getResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: 'Invoices!A:I',
        });
        const rows = getResponse.data.values || [];
        const missing = [];
        
        rows.forEach(row => {
            if (row[0] === userEmail) {
                const dateStr = row[1] || '';
                // match if the date string includes the monthYear (e.g. "06/2026")
                if (dateStr.includes(monthYear)) {
                    const fileUrl = row[7];
                    if (!fileUrl || fileUrl === "N/A" || fileUrl.trim() === "") {
                        missing.push({
                            date: dateStr,
                            vendor: row[2],
                            amount: row[4],
                            currency: row[5] || 'ILS'
                        });
                    }
                }
            }
        });
        return missing;
    } catch (err) {
        console.error("Error fetching missing receipts:", err);
        return [];
    }
};

const getTelegramChatId = async (userEmail) => {
    try {
        const getResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: 'Users!A:I',
        });
        const rows = getResponse.data.values || [];
        for (let i = 1; i < rows.length; i++) {
            if (rows[i][0] === userEmail) {
                return rows[i][8]; // Chat ID
            }
        }
    } catch (err) {
        console.error("Error fetching chat ID:", err);
    }
    return null;
};

// ============================================================================
// Job 1: Daily Missing Receipts Reminder (Last 5 Working Days of Month)
// ============================================================================
export const startCronJobs = () => {
    // Run every day at 10:00 AM
    cron.schedule('0 10 * * *', async () => {
        const today = new Date();
        if (!isWithinLastWorkingDays(today, 5)) {
            console.log("Not in the last 5 working days of the month. Skipping reminders.");
            return;
        }

        console.log("Running Daily Missing Receipts Reminder...");
        const users = getUsersData();
        const monthYear = `${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

        for (const user of users) {
            if (!user.userEmail) continue;
            
            const missing = await getMissingReceipts(user.userEmail, monthYear);
            if (missing.length > 0) {
                const chatId = await getTelegramChatId(user.userEmail);
                if (chatId && bot) {
                    let message = `⚠️ **תזכורת חוסרים - סוף חודש מתקרב!** ⚠️\n\n`;
                    message += `נותרו ימי עסקים בודדים לסוף החודש ויש לך **${missing.length}** עסקאות ללא קבלות:\n\n`;
                    
                    missing.forEach((item, idx) => {
                        message += `${idx + 1}. ${item.vendor} - ${item.amount} ${item.currency === 'ILS' ? '₪' : item.currency} (${item.date})\n`;
                    });
                    
                    message += `\nאנא שלח לי את הקבלות החסרות בהקדם כדי שנוכל לסגור את הדוח החודשי בצורה תקינה.`;
                    
                    bot.sendMessage(chatId, message);
                }
            }
        }
    });

    // ============================================================================
    // Job 2: Generate & Send Monthly Report (1st of every month at 00:05)
    // ============================================================================
    cron.schedule('5 0 1 * *', async () => {
        console.log("Running Monthly PDF Generator...");
        const users = getUsersData();
        
        // Target previous month
        const today = new Date();
        const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const targetMonthYear = `${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}/${prevMonthDate.getFullYear()}`;

        for (const user of users) {
            if (!user.userEmail) continue;

            const sendToUser = user.sendReportToTelegram === true;
            const sendToAcc = user.sendReportToAccountantTelegram === true;
            
            if (!sendToUser && !sendToAcc) continue;

            try {
                // Generate the PDF
                const pdfBuffer = await generateUserReport(user.userEmail, targetMonthYear);
                if (!pdfBuffer) continue;

                // Send to user
                if (sendToUser) {
                    const userChatId = await getTelegramChatId(user.userEmail);
                    if (userChatId && bot) {
                        bot.sendDocument(userChatId, pdfBuffer, {
                            caption: `📄 מצורף הדוח החודשי שלך לחודש ${targetMonthYear}.`,
                        }, { filename: `Report_${targetMonthYear.replace('/','_')}.pdf`, contentType: 'application/pdf' });
                    }
                }

                // Send to accountant
                if (sendToAcc && user.accountantChatId && bot) {
                    bot.sendDocument(user.accountantChatId, pdfBuffer, {
                        caption: `📄 דוח חודשי עבור הלקוח ${user.userEmail} לחודש ${targetMonthYear}.`,
                    }, { filename: `Client_Report_${targetMonthYear.replace('/','_')}.pdf`, contentType: 'application/pdf' });
                }
            } catch (err) {
                console.error(`Error generating/sending report for ${user.userEmail}:`, err);
            }
        }
    });
    
    console.log("⏰ Cron jobs initialized.");
};
