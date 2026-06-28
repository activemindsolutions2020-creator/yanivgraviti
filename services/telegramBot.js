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
          return { email: rows[i][0], name: rows[i][1], role: rows[i][2], phone: rows[i][7], rowIndex: i };
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
    const dataLines = lines.filter(l => !l.startsWith('הקמה') && !l.startsWith('הקם משתמש') && !l.includes('מנהל משרד') && !l.includes('חדלות פירעון'));
    
    if (dataLines.length < 3) {
      return bot.sendMessage(chatId, "חסרים פרטים. אנא שלח: שם מלא, מייל, טלפון.");
    }

    const email = dataLines.find(l => l.includes('@'));
    const phone = dataLines.find(l => /\d{9,}/.test(l.replace(/\D/g, '')));
    const name = dataLines.find(l => l !== email && l !== phone) || dataLines[0];

    if (!email || !phone) {
       return bot.sendMessage(chatId, "❌ לא הצלחתי לזהות כתובת מייל או טלפון בהודעה שלך. אנא ודא שהם תקינים.");
    }

    const isManager = text.includes('מנהל משרד');
    const isInsolvency = text.includes('חדלות פירעון');
    
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

      // Update users.json with insolvency status
      try {
        const DATA_FILE = path.join(process.cwd(), 'data', 'users.json');
        if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
          fs.mkdirSync(path.join(process.cwd(), 'data'));
        }
        let users = [];
        if (fs.existsSync(DATA_FILE)) {
          users = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
        const userIndex = users.findIndex(u => u.userEmail === email);
        if (userIndex > -1) {
          users[userIndex].isInsolvency = isInsolvency;
        } else {
          users.push({ userEmail: email, isInsolvency: isInsolvency });
        }
        fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
      } catch (e) {
        console.error("Failed to update users.json for insolvency flag:", e);
      }

      delete adminStates[chatId];
      let successMsg = `✅ המשתמש ${name} הוקם בהצלחה כ${isManager ? 'מנהל משרד' : 'משתמש רגיל'}!`;
      if (isInsolvency) {
        successMsg += `\nהלקוח הוגדר כלקוח חדלות פירעון.`;
      }
      bot.sendMessage(chatId, successMsg);
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

  // Helper for admin action: Search user by identifier
  const handleUserSearchForAction = async (chatId, text, actionType) => {
    bot.sendMessage(chatId, "⏳ מחפש משתמש במערכת...");
    try {
      const getResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: 'Users!A:I',
      });
      const rows = getResponse.data.values || [];
      const searchTarget = text.trim().toLowerCase();
      const searchPhone = normalizePhone(searchTarget);
      
      let foundRowIndex = -1;
      let foundEmail = "";
      let foundName = "";
      let foundPhone = "";
      
      for (let i = 1; i < rows.length; i++) {
        const rowEmail = (rows[i][0] || "").toLowerCase();
        const rowPhone = normalizePhone(rows[i][7]);
        
        if (rowEmail === searchTarget || (searchPhone && rowPhone === searchPhone)) {
          foundRowIndex = i;
          foundEmail = rows[i][0];
          foundName = rows[i][1];
          foundPhone = rows[i][7] || "לא סופק";
          break;
        }
      }
      
      if (foundRowIndex === -1) {
         return bot.sendMessage(chatId, "❌ לא מצאתי משתמש עם המייל או הטלפון שסיפקת. אנא ודא שהפרטים נכונים ונסה שוב (שלח את המזהה שוב).");
      }
      
      const actionText = actionType === 'delete' ? 'למחוק לחלוטין' : 'להקפיא';
      adminStates[chatId] = { 
         state: actionType === 'delete' ? 'CONFIRM_DELETE' : 'CONFIRM_FREEZE',
         rowIndex: foundRowIndex,
         email: foundEmail,
         name: foundName
      };
      
      bot.sendMessage(chatId, `מצאתי את המשתמש:\nשם: ${foundName}\nמייל: ${foundEmail}\nטלפון: ${foundPhone}\n\nהאם אתה בטוח שברצונך ${actionText} את המשתמש?\nהשב 'כן' לאישור או 'לא' לביטול.`);
      
    } catch(e) {
      bot.sendMessage(chatId, "❌ שגיאה בחיפוש המשתמש: " + e.message);
    }
  };

  // Helper for admin action: Confirm and Execute
  const handleUserActionConfirm = async (chatId, text, actionData) => {
    const reply = text.trim().toLowerCase();
    if (reply !== 'כן' && reply !== 'לא') {
       return bot.sendMessage(chatId, "אנא השב 'כן' כדי לאשר או 'לא' כדי לבטל.");
    }
    
    if (reply === 'לא') {
       delete adminStates[chatId];
       return bot.sendMessage(chatId, "✅ הפעולה בוטלה.");
    }
    
    // User confirmed 'כן'
    bot.sendMessage(chatId, "⏳ מבצע פעולה...");
    try {
       const spreadsheetId = process.env.SPREADSHEET_ID;
       
       if (actionData.state === 'CONFIRM_FREEZE') {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Users!D${actionData.rowIndex + 1}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [['Frozen']] }
          });
          bot.sendMessage(chatId, `✅ המשתמש ${actionData.name} הוקפא בהצלחה.`);
       } else if (actionData.state === 'CONFIRM_DELETE') {
          // Get sheetId
          const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
          const usersSheet = spreadsheet.data.sheets.find(s => s.properties.title === 'Users');
          if (!usersSheet) throw new Error("Users sheet not found");
          
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [{
                deleteDimension: {
                  range: {
                    sheetId: usersSheet.properties.sheetId,
                    dimension: 'ROWS',
                    startIndex: actionData.rowIndex,
                    endIndex: actionData.rowIndex + 1
                  }
                }
              }]
            }
          });
          bot.sendMessage(chatId, `✅ המשתמש ${actionData.name} נמחק לחלוטין בהצלחה.`);
       }
       delete adminStates[chatId];
    } catch(e) {
       bot.sendMessage(chatId, "❌ שגיאה בביצוע הפעולה: " + e.message);
    }
  };

  // Consolidate all listeners into one master listener
  bot.on('message', async (msg) => {
    if (msg.contact || msg.text === '/start') return; // Handled separately
    
    const chatId = msg.chat.id;
    const user = await getUserByChatId(chatId);
    
    // Check if user is the main admin (Yaniv) or has Admin role in DB
    const isAdmin = (user && normalizePhone(user.phone) === normalizePhone("972546799182")) || 
                    (msg.from && msg.from.id === chatId); // Wait, we must be absolutely sure. Let's just use the phone check if possible.
    // If the admin hasn't shared contact yet, we fallback to hardcoding chat id? No, Yaniv is already in the system.
    const isVerifiedAdmin = user && (normalizePhone(user.phone) === normalizePhone("972546799182") || user.role === 'Admin');

    if (isVerifiedAdmin) {
       const adminState = adminStates[chatId];
       
       if (adminState === 'WAITING_FOR_BROADCAST_MSG') {
           delete adminStates[chatId];
           return executeBroadcast(chatId, msg.message_id, chatId);
       }
       if (adminState === 'WAITING_FOR_USER_DETAILS' && msg.text) {
           return handleUserCreation(chatId, msg.text);
       }
       if (adminState === 'WAITING_FOR_USER_ID_FREEZE' && msg.text) {
           return handleUserSearchForAction(chatId, msg.text, 'freeze');
       }
       if (adminState === 'WAITING_FOR_USER_ID_DELETE' && msg.text) {
           return handleUserSearchForAction(chatId, msg.text, 'delete');
       }
       if (typeof adminState === 'object' && (adminState.state === 'CONFIRM_FREEZE' || adminState.state === 'CONFIRM_DELETE')) {
           return handleUserActionConfirm(chatId, msg.text, adminState);
       }
       
       if (msg.text === 'שלח תפוצה') {
           const allowedBroadcastEmails = ['activemind.solutions2020@gmail.com', 'nmshivuk@gmail.com'];
           if (!user || !allowedBroadcastEmails.includes(user.email)) {
               return bot.sendMessage(chatId, "❌ אין לך הרשאה לשלוח הודעות תפוצה.");
           }
           adminStates[chatId] = 'WAITING_FOR_BROADCAST_MSG';
           return bot.sendMessage(chatId, "מה תרצה לשלוח? (אפשר לשלוח טקסט, תמונה, מסמך או קול - וההודעה תועתק כפי שהיא לכולם)");
       }
       
       if (msg.text && (msg.text.startsWith('הקפא משתמש') || msg.text.startsWith('מחק משתמש'))) {
           const actionType = msg.text.startsWith('מחק משתמש') ? 'delete' : 'freeze';
           const parts = msg.text.split(/[\s\n]+/).filter(Boolean);
           if (parts.length > 2) {
               // The user provided the identifier inline
               const identifier = parts.slice(2).join(' ');
               return handleUserSearchForAction(chatId, identifier, actionType);
           } else {
               adminStates[chatId] = actionType === 'delete' ? 'WAITING_FOR_USER_ID_DELETE' : 'WAITING_FOR_USER_ID_FREEZE';
               return bot.sendMessage(chatId, `אנא שלח לי את המייל או מספר הטלפון של המשתמש שברצונך ${actionType === 'delete' ? 'למחוק לחלוטין' : 'להקפיא'}:`);
           }
       }
       
       if (msg.text && (msg.text.startsWith('הקמה') || msg.text.startsWith('הקם משתמש'))) {
           const lines = msg.text.split('\n').map(l => l.trim()).filter(Boolean);
           if (lines.length === 1) {
               adminStates[chatId] = 'WAITING_FOR_USER_DETAILS';
               return bot.sendMessage(chatId, "אנא שלח את פרטי המשתמש בשורות נפרדות:\nשם מלא\nמייל\nטלפון\n(אם זה משרד עורכי דין, הוסף 'מנהל משרד' בשורה רביעית)\n(ללקוח חדלות פירעון הוסף 'חדלות פירעון')");
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
