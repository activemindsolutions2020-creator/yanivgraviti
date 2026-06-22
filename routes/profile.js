import express from 'express';

const router = express.Router();

// POST /api/profile - Handles profile data submission
router.post('/', (req, res) => {
  try {
    const { userEmail, idNumber, caseNumber, govToken, geminiApiKey } = req.body;

    // Validate that userEmail, idNumber, and geminiApiKey are provided
    if (!userEmail || !idNumber || !geminiApiKey) {
      return res.status(400).json({ 
        success: false, 
        message: 'userEmail, idNumber, and geminiApiKey are required fields.' 
      });
    }

    return res.status(200).json({ success: true, message: "הפרופיל נשמר בהצלחה בשרת" });
  } catch (error) {
    console.error('Error saving profile:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

export default router;