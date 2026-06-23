import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';

// Helper to normalize phone numbers (convert +97250... or 97250... to 050...)
const normalizePhone = (phone) => {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, ''); // Keep only digits
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

  // Create a bot that uses 'polling' to fetch new updates
  const bot = new TelegramBot(token, { polling: true });
  console.log("🤖 Telegram Bot initialized and polling...");

  const DATA_FILE = path.join(process.cwd(), 'data', 'users.json');

  const getUsers = () => {
    if (!fs.existsSync(DATA_FILE)) return [];
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  };

  const saveUsers = (users) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
  };

  const getUserFromChatId = (chatId) => {
    const users = getUsers();
    return users.find(u => u.telegramChatId === chatId);
  };

  // 1. Handle /start and Authentication
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const user = getUserFromChatId(chatId);

    if (user) {
      bot.sendMessage(chatId, `שלום שוב ${msg.from.first_name}! 👋\nאני מוכן לעבודה. שלח לי קבלות או הקלטה קולית.`);
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
  bot.on('contact', (msg) => {
    const chatId = msg.chat.id;
    const contactPhone = msg.contact.phone_number;
    const normalizedContact = normalizePhone(contactPhone);
    
    const users = getUsers();
    let foundUser = null;
    let userIndex = -1;

    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      if (normalizePhone(u.phoneNumber) === normalizedContact) {
        foundUser = u;
        userIndex = i;
        break;
      }
    }

    if (foundUser) {
      // Link the chat ID
      users[userIndex].telegramChatId = chatId;
      saveUsers(users);

      bot.sendMessage(chatId, `✅ אימות הושלם בהצלחה!\nברוך הבא, חשבונך מחובר למערכת.\n\nמה אפשר לעשות עכשיו?\n📸 צלם ושלח חשבונית\n🎙️ שלח הקלטה קולית עם פירוט הוצאה\n💬 שאל אותי שאלות על התזרים שלך`, {
        reply_markup: { remove_keyboard: true }
      });
    } else {
      bot.sendMessage(chatId, `❌ מצטער, לא מצאתי את המספר שלך (${contactPhone}) במערכת.\nאנא היכנס לאתר, עדכן את מספר הטלפון שלך בפרופיל, ונסה שוב.`, {
        reply_markup: { remove_keyboard: true }
      });
    }
  });

  // 3. Handle incoming text messages
  bot.on('message', (msg) => {
    if (msg.contact || msg.text === '/start') return;

    const chatId = msg.chat.id;
    const user = getUserFromChatId(chatId);

    if (!user) {
      bot.sendMessage(chatId, "אנא אמת את חשבונך תחילה על ידי שליחת /start");
      return;
    }

    if (msg.text) {
      // For now, echo. Later, send to Gemini.
      bot.sendMessage(chatId, `קיבלתי את ההודעה שלך! כרגע המנוע הקולי/טקסטואלי בהקמה. אמרת: ${msg.text}`);
    }
  });

  return bot;
};
