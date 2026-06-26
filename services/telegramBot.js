import TelegramBot from 'node-telegram-bot-api';
import { sheets, encryptData } from '../server.js';
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
const adminStates = {}; // Add admin state tracking

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
            let errMsg = "❌ אירעה שגיאה בעת הפקת הדו\"ח.";
            if (user.phone && normalizePhone(user.phone) === normalizePhone("972546799182")) {
               errMsg += `\n\n[DEBUG ERROR INFO]\n${reportErr.message}`;
            }
            bot.sendMessage(chatId, errMsg);
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

  // Helper for admin user creation
  const handleUserCreation = async (chatId, text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 3) {
      return bot.sendMessage(chatId, "חסרים פרטים. אנא שלח: שם מלא, מייל, טלפון.");
    }
    const name = lines.length === 3 ? lines[0] : (lines[0] === 'הקמה' ? lines[1] : lines[0]);
    const email = lines.length === 3 ? lines[1] : (lines[0] === 'הקמה' ? lines[2] : lines[1]);
    const phone = lines.length === 3 ? lines[2] : (lines[0] === 'הקמה' ? lines[3] : lines[2]);
    const isManager = text.includes('מנהל משרד');
    
    try {
      const createdAt = new Date().toISOString();
      const encryptedPassword = encryptData(phone);
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: 'Users!A:K',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [[email, name, isManager ? 'Manager' : 'User', 'Approved', createdAt, encryptedPassword, 'Admin', phone, '', '25', '']]
        }
      });
      delete adminStates[chatId];
      bot.sendMessage(chatId, `✅ המשתמש ${name} הוקם בהצלחה כ${isManager ? 'מנהל משרד' : 'משתמש רגיל'}!`);
    } catch(e) {
      bot.sendMessage(chatId, "❌ שגיאה בהקמת המשתמש: " + e.message);
    }
  };

  // Helper for admin broadcast
  const executeBroadcast = async (adminChatId, messageIdToCopy, fromChatId) => {
    bot.sendMessage(adminChatId, "⏳ מתחיל בשליחת תפוצה...");
    try {
      const getResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: 'Users!A:I',
      });
      const rows = getResponse.data.values || [];
      let successCount = 0;
      let failCount = 0;
      const sentChatIds = new Set();
      
      for (let i = 1; i < rows.length; i++) {
         const targetChatId = rows[i][8];
         if (targetChatId && targetChatId.trim() !== '' && !sentChatIds.has(targetChatId)) {
            try {
               const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/copyMessage`;
               await axios.post(url, {
                 chat_id: targetChatId,
                 from_chat_id: fromChatId,
                 message_id: messageIdToCopy
               });
               successCount++;
               sentChatIds.add(targetChatId);
            } catch(e) {
               failCount++;
            }
         }
      }
      
      const usersFile = path.join(process.cwd(), 'data', 'users.json');
      if (fs.existsSync(usersFile)) {
         const usersJson = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
         for (const u of usersJson) {
            if (u.accountantChatId && !sentChatIds.has(String(u.accountantChatId))) {
                try {
                   const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/copyMessage`;
                   await axios.post(url, {
                     chat_id: u.accountantChatId,
                     from_chat_id: fromChatId,
                     message_id: messageIdToCopy
                   });
                   successCount++;
                   sentChatIds.add(String(u.accountantChatId));
                } catch(e) {
                   failCount++;
                }
            }
         }
      }
      bot.sendMessage(adminChatId, `✅ הודעת התפוצה נשלחה ל-${successCount} משתמשים. (נכשלו: ${failCount})`);
    } catch(err) {
      bot.sendMessage(adminChatId, "❌ שגיאה בשליחת תפוצה: " + err.message);
    }
  };

  // Consolidate all listeners into one master listener
  bot.on('message', async (msg) => {
    if (msg.contact || msg.text === '/start') return; // Handled separately
    
    const chatId = msg.chat.id;
    const user = await getUserByChatId(chatId);
    
    // Check if user is the main admin (Yaniv)
    const isAdmin = (user && normalizePhone(user.phone) === normalizePhone("972546799182")) || 
                    (msg.from && msg.from.id === chatId); // Wait, we must be absolutely sure. Let's just use the phone check if possible.
    // If the admin hasn't shared contact yet, we fallback to hardcoding chat id? No, Yaniv is already in the system.
    const isVerifiedAdmin = user && normalizePhone(user.phone) === normalizePhone("972546799182");

    if (isVerifiedAdmin) {
       if (adminStates[chatId] === 'WAITING_FOR_BROADCAST_MSG') {
           delete adminStates[chatId];
           return executeBroadcast(chatId, msg.message_id, chatId);
       }
       if (msg.text === 'שלח תפוצה') {
           adminStates[chatId] = 'WAITING_FOR_BROADCAST_MSG';
           return bot.sendMessage(chatId, "מה תרצה לשלוח? (אפשר לשלוח טקסט, תמונה, מסמך או קול - וההודעה תועתק כפי שהיא לכולם)");
       }
       
       if (adminStates[chatId] === 'WAITING_FOR_USER_DETAILS' && msg.text) {
           return handleUserCreation(chatId, msg.text);
       }
       
       if (msg.text && msg.text.startsWith('הקמה')) {
           const lines = msg.text.split('\n').map(l => l.trim()).filter(Boolean);
           if (lines.length === 1) {
               adminStates[chatId] = 'WAITING_FOR_USER_DETAILS';
               return bot.sendMessage(chatId, "אנא שלח את פרטי המשתמש בשורות נפרדות:\nשם מלא\nמייל\nטלפון\n(אם זה משרד עורכי דין, הוסף 'מנהל משרד' בשורה רביעית)");
           } else {
               return handleUserCreation(chatId, msg.text);
           }
       }
    }

    // Fallback to normal functionality
    if (msg.photo) {
       const photo = msg.photo[msg.photo.length - 1];
       return handleMedia(msg, photo.file_id, `photo_${Date.now()}.jpg`, 'image/jpeg');
    }
    if (msg.document) {
       return handleMedia(msg, msg.document.file_id, msg.document.file_name || `doc_${Date.now()}.pdf`, msg.document.mime_type);
    }
    if (msg.voice || msg.text) {
       return handleChat(msg);
    }
  });

  return bot;
};
