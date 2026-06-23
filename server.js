import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import crypto from 'crypto';
import profileRoutes from './routes/profile.js';
import analyzeRoutes from './routes/analyze.js';
import reportRoutes from './routes/report.js';
import invoicesRoutes from './routes/invoices.js';
import manualRoutes from './routes/manual.js';
import usersRoutes from './routes/users.js';
import chatRoutes from './routes/chat.js';
import adminRoutes from './routes/admin.js';

// Initialize environment variables
dotenv.config();

// Initialize Telegram Bot
import { initTelegramBot } from './services/telegramBot.js';
initTelegramBot();

// Initialize Express app
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// ============================================================================
// Google Cloud API Integration
// ============================================================================

// Define scopes required for Drive and Sheets access
const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets'
];

// Handle potential escaped newlines in the private key from the .env file
let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
privateKey = privateKey.replace(/^"|"$/g, ''); // Remove wrapping quotes if present
privateKey = privateKey.replace(/\\n/g, '\n'); // Convert literal slash-n to actual newlines

// Initialize the JWT auth client using Service Account credentials
const auth = new google.auth.JWT(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  null,
  privateKey,
  SCOPES
);

// Initialize Drive and Sheets clients
export const drive = google.drive({ version: 'v3', auth });
export const sheets = google.sheets({ version: 'v4', auth });

// ============================================================================
// Robust Crypto Service (AES-256-GCM)
// ============================================================================

const ALGORITHM = 'aes-256-gcm';

// AES-256 requires exactly a 32-byte key.
// We use a SHA-256 hash to guarantee the key length is exactly 32 bytes 
// securely, regardless of the raw length of ENCRYPTION_SECRET_KEY.
const rawKey = process.env.ENCRYPTION_SECRET_KEY || 'fallback-secret-key-do-not-use-in-prod';
const SECRET_KEY = crypto.createHash('sha256').update(String(rawKey)).digest();

/**
 * Encrypts a plain text string.
 * @param {string} text - The plain text to encrypt.
 * @returns {string} The encrypted data formatted as "iv:authTag:encryptedText".
 */
export function encryptData(text) {
  if (!text) return text;

  // 12 bytes is the recommended initialization vector size for GCM
  const iv = crypto.randomBytes(12); 
  
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // The auth tag is essential for GCM; it verifies ciphertext integrity
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Return a single string combining the IV, Auth Tag, and Ciphertext
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * @param {string} encryptedText - The string formatted as "iv:authTag:encryptedText".
 * @returns {string} The decrypted plain text.
 */
export function decryptData(encryptedText) {
  if (!encryptedText || typeof encryptedText !== 'string' || !encryptedText.includes(':')) {
    // Return original if it doesn't match our specific encryption format
    return encryptedText;
  }

  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format. Expected "iv:authTag:encryptedText"');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    SECRET_KEY,
    Buffer.from(ivHex, 'hex')
  );

  // Set the Auth Tag before decrypting to verify integrity
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// ============================================================================
// Express Routes & Server Initialization
// ============================================================================

// Render default health check path
app.get('/', (req, res) => {
  res.status(200).send('Smart Insolvency AI Backend is running!');
});

// Health check endpoint (API specific)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Smart Insolvency AI Backend is operating normally',
    timestamp: new Date().toISOString()
  });
});

// Mount Profile Route
app.use('/api/profile', profileRoutes);
app.use('/api/analyze', analyzeRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/manual', manualRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);

// Start Cron Service dynamically after all exports (like sheets) are fully initialized
import('./services/cron.js').catch(err => console.error('Failed to load cron service:', err));

// Export for other services
// Exports are handled inline where they are declared.

// Start the server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Smart Insolvency AI Backend is successfully running on port ${PORT}`);
});
