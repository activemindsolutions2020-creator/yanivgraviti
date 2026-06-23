import express from 'express';
import { sheets, encryptData, decryptData } from '../server.js';

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
        range: 'Users!A1:K1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['Email', 'Name', 'Role', 'Status', 'CreatedAt', 'Password', 'CreatedBy', 'Phone', 'TelegramChatId', 'ReminderDay', 'ReminderMessage']]
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
      range: 'Users!A:K',
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
          reminderMessage: rows[i][10] || ""
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
      status: isMainAdmin ? 'Approved' : 'Pending',
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
              status: rows[i][3]
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

export default router;
