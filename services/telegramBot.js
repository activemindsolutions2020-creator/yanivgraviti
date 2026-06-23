import TelegramBot from 'node-telegram-bot-api';
import { sheets } from '../server.js';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const normalizePhone = (phone) => {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('972')) {
    digits = '0' + digits.substring(3);
  }
  return digits;
};

export let bot;

export const initTelegramBot = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
    console.warn("⚠️ TELEGRAM_BOT_TOKEN is not set. Telegram bot will not start.");
    return null;
  }

  const webhookUrl = process.env.RENDER_EXTERNAL_URL || process.env.WEBHOOK_URL;
  if (webhookUrl) {
    bot = new TelegramBot(token, { polling: false });
    const webhookPath = `/api/telegram-webhook/${token}`;
    bot.setWebHook(`${webhookUrl}${webhookPath}`)
      .then(() => {
        console.log(`🤖 Telegram Bot initialized with webhook at: ${webhookUrl}${webhookPath}`);
      })
      .catch(err => {
        console.error(`❌ Failed to set Telegram Webhook:`, err);
      });
  } else {
    bot = new TelegramBot(token, { polling: false });
    bot.deleteWebHook()
      .then(() => {
        bot.startPolling();
        console.log("🤖 Telegram Bot initialized and polling...");
      })
      .catch(err => {
        console.error("❌ Failed to delete webhook before polling:", err);
        bot.startPolling();
        console.log("🤖 Telegram Bot initialized and polling (with warning)...");
      });
  }

  const spreadsheetId = process.env.SPREADSHEET_ID;

  const getUserByChatId = async (chatId) => {
    try {
      const getResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Users!A:I',
      });
      const rows = getResponse.data.values || [];
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][8] == chatId) {
          return { email: rows[i][0], name: rows[i][1], phone: rows[i][7], rowIndex: i };
        }
      }
    } catch (err) {
      console.error("Error fetching users from sheet:", err);
    }
    return null;
  };

  // 1. Handle /start and Authentication
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const user = await getUserByChatId(chatId);

    if (user) {
      bot.sendMessage(chatId, `שלום שוב ${user.name}! 👋\nאני מוכן לעבודה. שלח לי קבלות או הקלטה קולית.`);
    } else {
      const opts = {
        reply_markup: {
          keyboard: [
            [{ text: "📱 שתף מספר טלפון לאימות", request_contact: true }]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      };
      bot.sendMessage(chatId, "ברוך הבא ל-Smart Insolvency! 🏦\n\nכדי לשמור על אבטחת הנתונים שלך, עלי לאמת את זהותך מול המערכת.\nלחץ על הכפתור למטה כדי לשתף את מספר הטלפון שלך.", opts);
    }
  });

  // 2. Handle Contact Sharing (Authentication check)
  bot.on('contact', async (msg) => {
    const chatId = msg.chat.id;
    const contactPhone = msg.contact.phone_number;
    const normalizedContact = normalizePhone(contactPhone);
    
    try {
      const getResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Users!A:I',
      });
      
      const rows = getResponse.data.values || [];
      let foundUserIndex = -1;
      let foundUserName = "";

      for (let i = 1; i < rows.length; i++) {
        if (normalizePhone(rows[i][7]) === normalizedContact) {
          foundUserIndex = i;
          foundUserName = rows[i][1];
          break;
        }
      }

      if (foundUserIndex !== -1) {
        // Link the chat ID in column I (Index 8)
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `Users!I${foundUserIndex + 1}:I${foundUserIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [[String(chatId)]] }
        });

        bot.sendMessage(chatId, `✅ אימות הושלם בהצלחה!\nברוך הבא ${foundUserName}, חשבונך מחובר למערכת.\n\nמה אפשר לעשות עכשיו?\n📸 צלם ושלח חשבונית\n🎙️ שלח הקלטה קולית עם פירוט הוצאה\n💬 שאל אותי שאלות על התזרים שלך`, {
          reply_markup: { remove_keyboard: true }
        });
      } else {
        // Check if it's an accountant
        const usersFile = path.join(process.cwd(), 'data', 'users.json');
        let accountantForUser = null;
        if (fs.existsSync(usersFile)) {
            const usersJson = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
            const accUserIndex = usersJson.findIndex(u => normalizePhone(u.accountantPhone) === normalizedContact);
            if (accUserIndex > -1) {
                accountantForUser = usersJson[accUserIndex];
                usersJson[accUserIndex].accountantChatId = String(chatId);
                fs.writeFileSync(usersFile, JSON.stringify(usersJson, null, 2));
            }
        }

        if (accountantForUser) {
          bot.sendMessage(chatId, `✅ אימות הושלם!\nזוהית כרואה החשבון / עורך הדין של ${accountantForUser.userEmail}.\nמעתה תקבל לכאן דוחות סיכום חודשיים עבור הלקוח.`, {
            reply_markup: { remove_keyboard: true }
          });
        } else {
          bot.sendMessage(chatId, `❌ מצטער, לא מצאתי את המספר שלך (${contactPhone}) במערכת.\nאנא בקש ממנהל המערכת להוסיף את מספר הטלפון שלך לפרופיל ונסה שוב.`, {
            reply_markup: { remove_keyboard: true }
          });
        }
      }
    } catch (err) {
      console.error("Error during contact auth:", err);
      bot.sendMessage(chatId, "אירעה שגיאה בבדיקת הנתונים. אנא נסה שוב מאוחר יותר.");
    }
  });

  // Helper to handle files (images/PDFs) sent to the bot
  const handleMedia = async (msg, fileId, fileName, mimeType) => {
    const chatId = msg.chat.id;
    const user = await getUserByChatId(chatId);
    if (!user) return bot.sendMessage(chatId, "אנא אמת את חשבונך תחילה על ידי שליחת /start");

    try {
      bot.sendMessage(chatId, "⏳ מוריד את הקובץ ושולח לרואה החשבון המלאכותי שלך...");
      
      const fileLink = await bot.getFileLink(fileId);
      const response = await axios.get(fileLink, { responseType: 'stream' });

      const formData = new FormData();
      formData.append('invoiceFile', response.data, { filename: fileName, contentType: mimeType });
      formData.append('userEmail', user.email);
      // Let the analysis route know it came from the bot
      formData.append('source', 'telegram');

      const apiRes = await axios.post(`http://127.0.0.1:${process.env.PORT || 3000}/api/analyze`, formData, {
        headers: { ...formData.getHeaders() }
      });

      if (apiRes.data.success) {
        const results = apiRes.data.data || apiRes.data.results || [];
        let replyMsg = "✅ *פענוח הושלם בהצלחה!*\n\n";
        let hasCorrection = false;
        
        results.forEach(res => {
           // Handle both old and new response formats
           const data = res.extractedData || res;
           
           if (data.correctionMessage) {
             hasCorrection = true;
             replyMsg += `⚠️ *שים לב:* ${data.correctionMessage}\n\n`;
           }
           
           replyMsg += `📄 *${data.ExpenseName || data.vendor || 'הוצאה כללית'}*\n`;
           replyMsg += `💰 סכום: ₪${data.TotalAmount !== undefined ? data.TotalAmount : (data.totalAmount || 0)}\n`;
           replyMsg += `📅 תאריך: ${data.Date || data.date || 'לא זוהה'}\n`;
           replyMsg += `🏷️ קטגוריה: ${data.Category || data.category || 'אחר'}\n\n`;
        });
        
        if (!hasCorrection) {
          replyMsg += "📊 הנתונים נשמרו בהצלחה במערכת!";
        } else {
          replyMsg += "החשבונית נשמרה בסטטוס כפול לבדיקתך בדשבורד.";
        }
        bot.sendMessage(chatId, replyMsg, { parse_mode: 'Markdown' });
      } else {
        bot.sendMessage(chatId, "❌ ה-AI לא הצליח לפענח את הקבלה.");
      }
    } catch (err) {
      console.error(err);
      let errMsg = "❌ אירעה שגיאה בעיבוד הקובץ. אנא נסה שוב.";
      if (user.phone && normalizePhone(user.phone) === normalizePhone("972546799182")) {
        const errorDetails = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
        errMsg += `\n\n[DEBUG ERROR INFO]\n${errorDetails}`;
      }
      bot.sendMessage(chatId, errMsg);
    }
  };

  // 3. Handle incoming photos (Receipts)
  bot.on('photo', (msg) => {
    // Get the highest resolution photo
    const photo = msg.photo[msg.photo.length - 1];
    handleMedia(msg, photo.file_id, `photo_${Date.now()}.jpg`, 'image/jpeg');
  });

  // 4. Handle incoming documents (PDFs)
  bot.on('document', (msg) => {
    handleMedia(msg, msg.document.file_id, msg.document.file_name || `doc_${Date.now()}.pdf`, msg.document.mime_type);
  });

  // Helper to handle Chat (Voice/Text)
  const handleChat = async (msg) => {
    const chatId = msg.chat.id;
    const user = await getUserByChatId(chatId);
    if (!user) return bot.sendMessage(chatId, "אנא אמת את חשבונך תחילה על ידי שליחת /start");

    try {
      bot.sendChatAction(chatId, 'typing');
      
      const formData = new FormData();
      formData.append('userEmail', user.email);
      formData.append('source', 'telegram');

      if (msg.voice) {
        bot.sendMessage(chatId, "⏳ מקשיב ומנתח את ההודעה הקולית שלך...");
        const fileLink = await bot.getFileLink(msg.voice.file_id);
        const response = await axios.get(fileLink, { responseType: 'stream' });
        formData.append('voiceFile', response.data, { filename: `voice_${Date.now()}.ogg`, contentType: 'audio/ogg' });
      } else if (msg.text) {
        formData.append('textMessage', msg.text);
      }

      const apiRes = await axios.post(`http://127.0.0.1:${process.env.PORT || 3000}/api/chat`, formData, {
        headers: { ...formData.getHeaders() }
      });

      if (apiRes.data.success) {
        const { intent, replyText, expenses, monthYear } = apiRes.data;
        if (intent === "expense") {
          const isMultiple = expenses && expenses.length > 1;
          let replyMsg = isMultiple ? `✅ נרשמו ${expenses.length} פעולות בהצלחה!\n\n` : "";
          
          if (expenses && expenses.length > 0) {
            expenses.forEach((expenseData, idx) => {
               const isIncome = expenseData.type && expenseData.type.includes('הכנסה');
               if (!isMultiple) {
                 replyMsg += isIncome ? `✅ ההכנסה נרשמה בהצלחה!\n\n` : `✅ ההוצאה נרשמה בהצלחה!\n\n`;
               } else {
                 replyMsg += `📌 פעולה ${idx + 1}:\n`;
               }
               
               if (expenseData.category === 'UNKNOWN') {
                 replyMsg += `📄 בית עסק: ${expenseData.vendor || 'לא זוהה'}\n`;
                 replyMsg += `💰 סכום: ₪${expenseData.totalAmount || 0}\n`;
                 replyMsg += `🏷️ קטגוריה: ממתין לסיווג...\n\n`;
                 
                 const categoriesToSuggest = Array.isArray(expenseData.suggestedCategories) && expenseData.suggestedCategories.length > 0
                    ? expenseData.suggestedCategories 
                    : ["כלכלה (מזון)", "הוצאות נוספות", "אחזקת רכב"];
                    
                 const buttons = categoriesToSuggest.map(cat => ([{ 
                    text: cat, 
                    callback_data: `cat_${expenseData.sheetRow}_${cat}`.substring(0, 60) 
                 }]));
                 
                 bot.sendMessage(chatId, `זיהיתי הוצאה של ₪${expenseData.totalAmount} עבור ${expenseData.vendor || 'עסק לא ידוע'}. לאיזו קטגוריה לשייך אותה?`, {
                   reply_markup: { inline_keyboard: buttons }
                 });
               } else {
                 replyMsg += `📄 בית עסק: ${expenseData.vendor || 'לא זוהה'} ${isMultiple ? (isIncome ? '(הכנסה)' : '(הוצאה)') : ''}\n`;
                 replyMsg += `💰 סכום: ₪${expenseData.totalAmount || 0}\n`;
                 if (isMultiple) replyMsg += `📅 תאריך: ${expenseData.date || 'לא צוין'}\n`;
                 replyMsg += `🏷️ קטגוריה: ${expenseData.category || 'אחר'}\n\n`;
               }
            });
          }
          
          if (replyText) {
            replyMsg += replyText;
          }
          bot.sendMessage(chatId, replyMsg);
        } else if (intent === "generate_report") {
          bot.sendMessage(chatId, replyText || "⏳ מייצר את הדו\"ח המבוקש, אנא המתן...");
          try {
            const { generateUserReport } = await import('../routes/report.js');
            const result = await generateUserReport(user.email, monthYear);
            if (result.success && result.filePath) {
               await bot.sendDocument(chatId, result.filePath);
               bot.sendMessage(chatId, "✅ הדו\"ח נשלח בהצלחה!");
            } else {
               bot.sendMessage(chatId, "ℹ️ אין הוצאות/הכנסות חדשות להפיק עבורן דו\"ח כרגע.");
            }
          } catch (reportErr) {
            console.error("Error generating report for bot:", reportErr);
            bot.sendMessage(chatId, "❌ אירעה שגיאה בעת הפקת הדו\"ח.");
          }
        } else {
          // It's a chat response. Never use parse_mode here because Gemini outputs asterisks and it crashes Telegram!
          bot.sendMessage(chatId, replyText);
        }
      } else {
         bot.sendMessage(chatId, "❌ מצטער, לא הצלחתי להבין את הבקשה.");
      }
    } catch (err) {
      console.error(err);
      let errMsg = "❌ אירעה שגיאה בעיבוד ההודעה.";
      if (user.phone && normalizePhone(user.phone) === normalizePhone("972546799182")) {
        const errorDetails = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
        errMsg += `\n\n[DEBUG ERROR INFO]\n${errorDetails}`;
      }
      bot.sendMessage(chatId, errMsg);
    }
  };

  // 5. Handle incoming voice notes
  bot.on('voice', (msg) => {
    handleChat(msg);
  });

  // 6. Handle incoming text messages
  bot.on('message', async (msg) => {
    if (msg.contact || msg.photo || msg.document || msg.voice || msg.text === '/start') return;
    handleChat(msg);
  });

  return bot;
};
