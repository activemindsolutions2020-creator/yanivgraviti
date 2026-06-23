import TelegramBot from 'node-telegram-bot-api';
import { sheets } from '../server.js';

const normalizePhone = (phone) => {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('972')) {
    digits = '0' + digits.substring(3);
  }
  return digits;
};

export const initTelegramBot = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
    console.warn("⚠️ TELEGRAM_BOT_TOKEN is not set. Telegram bot will not start.");
    return null;
  }

  const bot = new TelegramBot(token, { polling: true });
  console.log("🤖 Telegram Bot initialized and polling...");

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
          return { email: rows[i][0], name: rows[i][1], rowIndex: i };
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
        bot.sendMessage(chatId, `❌ מצטער, לא מצאתי את המספר שלך (${contactPhone}) במערכת.\nאנא בקש ממנהל המערכת להוסיף את מספר הטלפון שלך לפרופיל ונסה שוב.`, {
          reply_markup: { remove_keyboard: true }
        });
      }
    } catch (err) {
      console.error("Error during contact auth:", err);
      bot.sendMessage(chatId, "אירעה שגיאה בבדיקת הנתונים. אנא נסה שוב מאוחר יותר.");
    }
  });

  // 3. Handle incoming text messages
  bot.on('message', async (msg) => {
    if (msg.contact || msg.text === '/start') return;

    const chatId = msg.chat.id;
    const user = await getUserByChatId(chatId);

    if (!user) {
      bot.sendMessage(chatId, "אנא אמת את חשבונך תחילה על ידי שליחת /start");
      return;
    }

    if (msg.text) {
      bot.sendMessage(chatId, `קיבלתי את ההודעה שלך! כרגע המנוע הקולי/טקסטואלי בהקמה. אמרת: ${msg.text}`);
    }
  });

  return bot;
};
