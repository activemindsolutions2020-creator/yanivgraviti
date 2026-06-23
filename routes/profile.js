import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();
const DATA_FILE = path.join(process.cwd(), 'data', 'users.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
  fs.mkdirSync(path.join(process.cwd(), 'data'));
}

// Ensure JSON file exists
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

// POST /api/profile - Handles profile data submission
router.post('/', (req, res) => {
  try {
    const { userEmail, idNumber, caseNumber, phoneNumber, govToken, geminiApiKey, reminderDay, reminderMessage, monthlyBudget, isInsolvency } = req.body;

    // Validate that userEmail is provided
    if (!userEmail) {
      return res.status(400).json({ 
        success: false, 
        message: 'userEmail is a required field.' 
      });
    }

    // Read current users
    const users = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    
    // Find if user exists
    const userIndex = users.findIndex(u => u.userEmail === userEmail);
    const newUserData = { userEmail, idNumber, caseNumber, phoneNumber, govToken, geminiApiKey, reminderDay, reminderMessage, monthlyBudget, isInsolvency: isInsolvency === true };

    if (userIndex > -1) {
      users[userIndex] = { ...users[userIndex], ...newUserData };
    } else {
      users.push(newUserData);
    }

    // Save
    fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));

    return res.status(200).json({ success: true, message: "הפרופיל נשמר בהצלחה בשרת" });
  } catch (error) {
    console.error('Error saving profile:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// GET /api/profile - Retrieve profile
router.get('/', (req, res) => {
  try {
    const { userEmail } = req.query;
    if (!userEmail) return res.status(400).json({ success: false, message: 'Email required' });
    
    const users = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const user = users.find(u => u.userEmail === userEmail);
    
    return res.status(200).json({ success: true, data: user || null });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;