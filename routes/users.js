import express from 'express';
import { sheets } from '../server.js';

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
        range: 'Users!A1:E1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['Email', 'Name', 'Role', 'Status', 'CreatedAt']]
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
      range: 'Users!A:E',
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
          createdAt: rows[i][4]
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
      name: name || 'Unknown',
      role: isMainAdmin ? 'Admin' : 'User',
      status: isMainAdmin ? 'Approved' : 'Pending',
      createdAt: new Date().toISOString()
    };

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Users!A:E',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[newUser.email, newUser.name, newUser.role, newUser.status, newUser.createdAt]]
      }
    });

    return res.status(200).json({ success: true, data: newUser });

  } catch (error) {
    console.error('Error in users auth:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// GET /api/users - Get all users (Admin only)
router.get('/', async (req, res) => {
  try {
    const { adminEmail } = req.query;
    if (!adminEmail) return res.status(401).json({ success: false, message: 'Unauthorized' });

    await ensureUsersSheet();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Users!A:E',
    });

    const rows = getResponse.data.values || [];
    if (rows.length < 2) return res.status(200).json({ success: true, data: [] });

    // Verify admin
    let isAdmin = false;
    const users = [];
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === adminEmail && rows[i][2] === 'Admin' && rows[i][3] === 'Approved') {
        isAdmin = true;
      }
      users.push({
        email: rows[i][0],
        name: rows[i][1],
        role: rows[i][2],
        status: rows[i][3],
        createdAt: rows[i][4]
      });
    }

    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
    }

    return res.status(200).json({ success: true, data: users });

  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// PUT /api/users/:targetEmail - Update user status/role (Admin only)
router.put('/:targetEmail', async (req, res) => {
  try {
    const { targetEmail } = req.params;
    const { adminEmail, status, role } = req.body;

    if (!adminEmail) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const spreadsheetId = process.env.SPREADSHEET_ID;
    const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Users!A:E',
    });

    const rows = getResponse.data.values || [];
    
    // Verify Admin
    let isAdmin = false;
    let targetRowIndex = -1;

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === adminEmail && rows[i][2] === 'Admin' && rows[i][3] === 'Approved') {
        isAdmin = true;
      }
      if (rows[i][0] === targetEmail) {
        targetRowIndex = i;
      }
    }

    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
    }
    if (targetRowIndex === -1) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update the row. Columns C=Role, D=Status
    // We fetch current to preserve if not passed
    const currentRole = rows[targetRowIndex][2];
    const currentStatus = rows[targetRowIndex][3];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Users!C${targetRowIndex + 1}:D${targetRowIndex + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[role || currentRole, status || currentStatus]]
      }
    });

    return res.status(200).json({ success: true, message: 'User updated successfully' });

  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

export default router;
