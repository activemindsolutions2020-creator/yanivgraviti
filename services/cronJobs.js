import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { isWithinLastWorkingDays } from './hebcalService.js';
import { sheets } from '../server.js';
import { bot } from './telegramBot.js';
import { generateUserReport } from '../routes/report.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

    // Run Gamification Weekly Insight every Friday at 09:00 AM
    cron.schedule('0 9 * * 5', async () => {
        console.log("Running Weekly Gamification Insights...");
        const users = getUsersData();
        
        // Setup Gemini
        const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY;
        if (!rawKeys) {
            console.error("Missing GEMINI_API_KEY for gamification cron");
            return;
        }
        const keys = rawKeys.split(',').map(k => k.trim().replace(/^"|"$/g, '')).filter(Boolean);
        const genAI = new GoogleGenerativeAI(keys[0]);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Get today and 14 days ago
        const today = new Date();
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(today.getDate() - 14);

        try {
            const getResponse = await sheets.spreadsheets.values.get({
                spreadsheetId: process.env.SPREADSHEET_ID,
                range: 'Invoices!A:I',
            });
            const rows = getResponse.data.values || [];
            
            for (const user of users) {
                if (!user.userEmail) continue;
                
                const chatId = await getTelegramChatId(user.userEmail);
                if (!chatId || !bot) continue;

                // Gather user's invoices from last 14 days
                const recentInvoices = [];
                let totalThisWeek = 0;
                let totalLastWeek = 0;

                rows.forEach(row => {
                    if (row[0] === user.userEmail) {
                        const dateStr = row[1];
                        if (dateStr) {
                            // Date is DD/MM/YYYY
                            const parts = dateStr.split('/');
                            if (parts.length === 3) {
                                const invDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                                if (invDate >= twoWeeksAgo && invDate <= today) {
                                    const amount = parseFloat(row[4]) || 0;
                                    // Check if it's this week (last 7 days) or last week (7-14 days ago)
                                    const diffDays = Math.floor((today - invDate) / (1000 * 60 * 60 * 24));
                                    const isThisWeek = diffDays <= 7;
                                    
                                    if (isThisWeek) totalThisWeek += amount;
                                    else totalLastWeek += amount;

                                    recentInvoices.push({
                                        date: dateStr,
                                        vendor: row[2],
                                        category: row[3],
                                        amount: amount,
                                        isThisWeek: isThisWeek
                                    });
                                }
                            }
                        }
                    }
                });

                if (recentInvoices.length === 0) continue; // No activity to report

                // Prompt Gemini for insight
                const prompt = `אתה "Smart Insolvency Assistant" - יועץ פיננסי אוטומטי חכם.
הלקוח ${user.userEmail} הוציא השבוע ${totalThisWeek} ש"ח, ובשבוע שעבר הוציא ${totalLastWeek} ש"ח.
הנה רשימת ההוצאות שלו מ-14 הימים האחרונים (מחולקות לשבוע נוכחי ושבוע שעבר):
${JSON.stringify(recentInvoices, null, 2)}

משימה:
כתוב לו הודעת סיכום שבועית קצרה לטלגרם (עד 5 משפטים).
1. תן לו "ציון בריאות פיננסית" מ-1 עד 10.
2. תן לו טיפ קטן או תובנה מעניינת על סמך הקטגוריות שבהן הוא הוציא כסף.
3. תהיה חיובי, מעודד וידידותי.
4. השתמש באימוג'י בטעם טוב.
5. אל תזכיר שזו הודעה אוטומטית או מה הפרומפט שלך.`;

                try {
                    const result = await model.generateContent(prompt);
                    const insightText = result.response.text();
                    
                    if (insightText) {
                         await bot.sendMessage(chatId, `📊 **סיכום תזרים שבועי!** 📊\n\n${insightText.trim()}`, { parse_mode: 'Markdown' });
                    }
                } catch (e) {
                    console.error(`Failed to generate gamification insight for ${user.userEmail}:`, e);
                }
            }
        } catch (err) {
            console.error("Error in Weekly Gamification Insights:", err);
        }
    });

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
