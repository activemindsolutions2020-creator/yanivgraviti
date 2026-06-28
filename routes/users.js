import express from 'express';
import { sheets, encryptData, decryptData } from '../server.js';
import nodemailer from 'nodemailer';

const router = express.Router();

const ADMIN_EMAIL = 'activemind.solutions2020@gmail.com';

// Helper to ensure the Users sheet exists and has headers
async function ensureUsersSheet() {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetExists = spreadsheet.data.sheets.some(s => s.properties.title === 'Users');
    
    if (!sheetExists) {
      // Create the sheet
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: { properties: { title: 'Users' } }
          }]
        }
      });
      // Add headers
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Users!A1:L1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['Email', 'Name', 'Role', 'Status', 'CreatedAt', 'Password', 'CreatedBy', 'Phone', 'TelegramChatId', 'ReminderDay', 'ReminderMessage', 'ForcePasswordChange']]
        }
      });
    }
  } catch (error) {
    console.error('Error ensuring Users sheet exists:', error);
  }
}

// POST /api/users/auth - Called during login to check/create user
router.post('/auth', async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    await ensureUsersSheet();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // Fetch all users
    const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Users!A:L',
    });

    const rows = getResponse.data.values || [];
    // rows[0] is headers
    let userRowIndex = -1;
    let user = null;

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === email) {
        userRowIndex = i;
        user = {
          email: rows[i][0],
          name: rows[i][1],
          role: rows[i][2],
          status: rows[i][3],
          createdAt: rows[i][4],
          phone: rows[i][7] || "",
          telegramChatId: rows[i][8] || "",
          reminderDay: rows[i][9] || "25",
          reminderMessage: rows[i][10] || "",
          forcePasswordChange: rows[i][11] === 'TRUE'
        };
        break;
      }
    }

    if (user) {
      // User exists
      // Auto-approve admin if not already
      if (email === ADMIN_EMAIL && user.status !== 'Approved') {
        user.status = 'Approved';
        user.role = 'Admin';
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `Users!C${userRowIndex + 1}:D${userRowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [['Admin', 'Approved']] }
        });
      }
      return res.status(200).json({ success: true, data: user });
    }

    // User does not exist, create them
    const isMainAdmin = email === ADMIN_EMAIL;
    const newUser = {
      email,
      name: name || email,
      role: isMainAdmin ? 'Admin' : 'User',
      status: 'Approved', // Auto-approve all new users
      createdAt: new Date().toISOString(),
      reminderDay: "25",
      reminderMessage: ""
    };

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Users!A:K',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[newUser.email, newUser.name, newUser.role, newUser.status, newUser.createdAt, '', 'System', '', '', newUser.reminderDay, newUser.reminderMessage]]
      }
    });

    return res.status(200).json({ success: true, data: newUser });

  } catch (error) {
    console.error('Error in users auth:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// POST /api/users/login - Called by CredentialsProvider to authenticate
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });

    await ensureUsersSheet();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Users!A:F',
    });

    const rows = getResponse.data.values || [];
    let user = null;

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === email) {
        const encryptedPassword = rows[i][5];
        if (!encryptedPassword) {
          return res.status(401).json({ success: false, message: 'User has no password set (Use Google Login)' });
        }
        
        try {
          const decryptedPassword = decryptData(encryptedPassword);
          if (decryptedPassword === password) {
            user = {
              id: String(i),
              email: rows[i][0],
              name: rows[i][1],
              role: rows[i][2],
              status: rows[i][3],
              forcePasswordChange: rows[i][11] === 'TRUE'
            };
            break;
          }
        } catch (decErr) {
          console.error("Password decryption failed for user", email);
        }
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    return res.status(200).json({ success: true, data: user });

  } catch (error) {
    console.error('Error in manual login:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// GET /api/users - Get all users (Admin or Manager)
router.get('/', async (req, res) => {
  try {
    const { adminEmail } = req.query;
    if (!adminEmail) return res.status(401).json({ success: false, message: 'Unauthorized' });

    await ensureUsersSheet();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Users!A:K',
    });

    const rows = getResponse.data.values || [];
    if (rows.length < 2) return res.status(200).json({ success: true, data: [] });

    // Verify admin or manager
    let userRole = null;
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === adminEmail && rows[i][3] === 'Approved') {
        userRole = rows[i][2]; // 'Admin', 'Manager', or 'User'
        break;
      }
    }

    if (userRole !== 'Admin' && userRole !== 'Manager') {
      return res.status(403).json({ success: false, message: 'Forbidden: Admin or Manager access required' });
    }

    const users = [];
    for (let i = 1; i < rows.length; i++) {
      const rowEmail = rows[i][0];
      const rowCreatedBy = rows[i][6] || '';
      
      // Admin sees everyone. Manager sees only those they created.
      if (userRole === 'Admin' || rowCreatedBy === adminEmail || rowEmail === adminEmail) {
        users.push({
          email: rows[i][0],
          name: rows[i][1],
          role: rows[i][2],
          status: rows[i][3],
          createdAt: rows[i][4],
          createdBy: rowCreatedBy,
          phone: rows[i][7] || "",
          telegramChatId: rows[i][8] || "",
          reminderDay: rows[i][9] || "",
          reminderMessage: rows[i][10] || ""
        });
      }
    }

    return res.status(200).json({ success: true, data: users });

  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// POST /api/users - Create a new user manually (Admin or Manager)
router.post('/', async (req, res) => {
  try {
    const { adminEmail, targetEmail, targetName, targetRole, targetStatus, targetPassword } = req.body;
    if (!adminEmail || !targetEmail) return res.status(400).json({ success: false, message: 'Missing required fields' });

    await ensureUsersSheet();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Users!A:G',
    });

    const rows = getResponse.data.values || [];
    
    let userRole = null;
    let targetExists = false;

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === adminEmail && rows[i][3] === 'Approved') {
        userRole = rows[i][2];
      }
      if (rows[i][0] === targetEmail) {
        targetExists = true;
      }
    }

    if (userRole !== 'Admin' && userRole !== 'Manager') return res.status(403).json({ success: false, message: 'Forbidden' });
    if (targetExists) return res.status(409).json({ success: false, message: 'User already exists' });

    // Enforce Manager restrictions
    let finalRole = targetRole || 'User';
    let finalStatus = targetStatus || 'Approved';
    if (userRole === 'Manager') {
      finalRole = 'User'; // Manager can only create Users
    }

    const newUser = {
      email: targetEmail,
      name: targetName || targetEmail,
      role: finalRole,
      status: finalStatus,
      createdAt: new Date().toISOString(),
      createdBy: adminEmail
    };
    
    const passwordToStore = targetPassword ? encryptData(targetPassword) : "";

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Users!A:I',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[newUser.email, newUser.name, newUser.role, newUser.status, newUser.createdAt, passwordToStore, newUser.createdBy, req.body.targetPhone || '', '']]
      }
    });

    return res.status(201).json({ success: true, message: 'User created successfully', data: newUser });

  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// PUT /api/users/:targetEmail - Update user details (Admin or Manager)
router.put('/:targetEmail', async (req, res) => {
  try {
    const { targetEmail } = req.params;
    const { adminEmail, status, role, name, password } = req.body;

    if (!adminEmail) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const spreadsheetId = process.env.SPREADSHEET_ID;
    const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Users!A:I',
    });

    const rows = getResponse.data.values || [];
    
    let userRole = null;
    let targetRowIndex = -1;
    let targetCreatedBy = '';

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === adminEmail && rows[i][3] === 'Approved') {
        userRole = rows[i][2];
      }
      if (rows[i][0] === targetEmail) {
        targetRowIndex = i;
        targetCreatedBy = rows[i][6] || '';
      }
    }

    if (userRole !== 'Admin' && userRole !== 'Manager') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (targetRowIndex === -1) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Manager can only edit users they created
    if (userRole === 'Manager' && targetCreatedBy !== adminEmail) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only edit users you created' });
    }

    const currentName = rows[targetRowIndex][1];
    const currentRole = rows[targetRowIndex][2];
    const currentStatus = rows[targetRowIndex][3];
    const currentCreatedAt = rows[targetRowIndex][4] || '';
    const currentPassword = rows[targetRowIndex][5] || '';
    const currentCreatedBy = rows[targetRowIndex][6] || '';
    const currentPhone = rows[targetRowIndex][7] || '';
    const currentTelegramChatId = rows[targetRowIndex][8] || '';

    // Manager cannot change roles
    const newRole = userRole === 'Manager' ? currentRole : (req.body.role || currentRole);
    const newName = req.body.name || currentName;
    const newStatus = req.body.status || currentStatus;
    const newPhone = req.body.phone !== undefined ? req.body.phone : currentPhone;
    
    let newPasswordToStore = currentPassword;
    if (req.body.password && req.body.password.trim() !== '') {
      newPasswordToStore = encryptData(req.body.password);
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Users!B${targetRowIndex + 1}:I${targetRowIndex + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[newName, newRole, newStatus, currentCreatedAt, newPasswordToStore, currentCreatedBy, newPhone, currentTelegramChatId]]
      }
    });

    return res.status(200).json({ success: true, message: 'User updated successfully' });

  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// DELETE /api/users/:targetEmail - Delete a user (Admin only)
router.delete('/:targetEmail', async (req, res) => {
  try {
    const { targetEmail } = req.params;
    const { adminEmail } = req.query;

    if (!adminEmail) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const spreadsheetId = process.env.SPREADSHEET_ID;
    
    // 1. Get the sheet metadata to find the 'Users' sheetId
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const usersSheet = spreadsheet.data.sheets.find(s => s.properties.title === 'Users');
    if (!usersSheet) return res.status(500).json({ success: false, message: 'Users sheet not found' });
    const sheetId = usersSheet.properties.sheetId;

    // 2. Find the row index of the user to delete
    const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Users!A:D',
    });

    const rows = getResponse.data.values || [];
    let userRole = null;
    let targetRowIndex = -1;

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === adminEmail && rows[i][3] === 'Approved') {
        userRole = rows[i][2];
      }
      if (rows[i][0] === targetEmail) {
        targetRowIndex = i;
      }
    }

    if (userRole !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Forbidden: Only Admins can delete users' });
    }
    if (targetRowIndex === -1) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // 3. Delete the row using batchUpdate
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheetId,
              dimension: 'ROWS',
              startIndex: targetRowIndex,
              endIndex: targetRowIndex + 1
            }
          }
        }]
      }
    });

    return res.status(200).json({ success: true, message: 'User deleted successfully' });

  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// GET /api/users/stats - Get global stats for Admin Dashboard
router.get('/stats', async (req, res) => {
  try {
    const { adminEmail } = req.query;
    if (!adminEmail) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const spreadsheetId = process.env.SPREADSHEET_ID;

    // 1. Verify admin
    const usersRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Users!A:D' });
    const usersRows = usersRes.data.values || [];
    let isAdmin = false;
    let totalUsers = 0;
    
    for (let i = 1; i < usersRows.length; i++) {
      if (usersRows[i][0] === adminEmail && (usersRows[i][2] === 'Admin' || usersRows[i][2] === 'Manager') && usersRows[i][3] === 'Approved') {
        isAdmin = true;
      }
      if (usersRows[i][3] === 'Approved') {
        totalUsers++;
      }
    }

    if (!isAdmin) return res.status(403).json({ success: false, message: 'Forbidden' });

    // 2. Fetch Invoices for stats
    const invRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Invoices!A:I' });
    const invRows = invRes.data.values || [];
    
    let totalInvoices = 0;
    let totalExpenses = 0;
    let totalIncomes = 0;

    // Start from 1 to skip header
    for (let i = 1; i < invRows.length; i++) {
      const status = invRows[i][8] || '';
      if (status !== 'מבוטל') {
        totalInvoices++;
        const type = invRows[i][6] || '';
        const amount = parseFloat(invRows[i][4]) || 0;
        
        if (type === 'דיווח טלגרם - הוצאה') {
          totalExpenses += amount;
        } else if (type === 'דיווח טלגרם - הכנסה') {
          totalIncomes += amount;
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalInvoices,
        totalExpenses,
        totalIncomes
      }
    });

  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// POST /api/users/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });

    const spreadsheetId = process.env.SPREADSHEET_ID;
    const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Users!A:L',
    });

    const rows = getResponse.data.values || [];
    let userRowIndex = -1;

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === email) {
        userRowIndex = i;
        break;
      }
    }

    if (userRowIndex === -1) {
      // Don't leak that user doesn't exist for security
      return res.status(200).json({ success: true, message: 'If email exists, a password reset link has been sent.' });
    }

    // Generate Temp Password
    const tempPassword = Math.random().toString(36).substring(2, 8).toUpperCase();
    const encryptedPassword = encryptData(tempPassword);

    // Update Sheet: Password in Col F (index 5), ForcePasswordChange in Col L (index 11)
    const rowNum = userRowIndex + 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Users!F${rowNum}:L${rowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          [
            encryptedPassword, // F
            rows[userRowIndex][6] || '', // G
            rows[userRowIndex][7] || '', // H
            rows[userRowIndex][8] || '', // I
            rows[userRowIndex][9] || '', // J
            rows[userRowIndex][10] || '', // K
            'TRUE' // L
          ]
        ]
      }
    });

    // Send Email
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      const mailOptions = {
        from: `"מערכת לניהול כלכלי" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'איפוס סיסמה למערכת',
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif;">
            <h2>שלום,</h2>
            <p>ביקשת לאפס את הסיסמה שלך למערכת.</p>
            <p>הסיסמה הזמנית שלך היא: <strong>${tempPassword}</strong></p>
            <p>לאחר ההתחברות הבאה שלך, תתבקש להחליף סיסמה זו לסיסמה אישית משלך.</p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
    } else {
      console.warn('EMAIL_USER and EMAIL_PASS not set. Could not send temp password email. Temp password is:', tempPassword);
    }

    return res.status(200).json({ success: true, message: 'Password reset instructions sent.' });
  } catch (error) {
    console.error('Error in forgot-password:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/users/password - Update password and clear ForcePasswordChange
router.put('/password', async (req, res) => {
  try {
    const { email, oldPassword, newPassword } = req.body;
    if (!email || !oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Missing fields' });
    }

    const spreadsheetId = process.env.SPREADSHEET_ID;
    const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Users!A:L',
    });

    const rows = getResponse.data.values || [];
    let userRowIndex = -1;
    let isPasswordValid = false;

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === email) {
        userRowIndex = i;
        const encryptedStoredPassword = rows[i][5];
        if (encryptedStoredPassword) {
          try {
            const decryptedStoredPassword = decryptData(encryptedStoredPassword);
            if (decryptedStoredPassword === oldPassword) {
              isPasswordValid = true;
            }
          } catch (e) {
            console.error('Decryption error for user', email);
          }
        }
        break;
      }
    }

    if (userRowIndex === -1 || !isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid current password' });
    }

    const newEncryptedPassword = encryptData(newPassword);
    const rowNum = userRowIndex + 1;

    // Update password (Col F) and clear ForcePasswordChange (Col L)
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Users!F${rowNum}:L${rowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          [
            newEncryptedPassword, // F
            rows[userRowIndex][6] || '', // G
            rows[userRowIndex][7] || '', // H
            rows[userRowIndex][8] || '', // I
            rows[userRowIndex][9] || '', // J
            rows[userRowIndex][10] || '', // K
            'FALSE' // L
          ]
        ]
      }
    });

    return res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
