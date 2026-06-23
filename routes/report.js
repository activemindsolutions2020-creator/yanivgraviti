import express from 'express';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { sheets } from '../server.js';

const router = express.Router();

if (!fs.existsSync('exports/')) {
  fs.mkdirSync('exports/');
}

export const generateUserReport = async (userEmail, targetMonthYear = null) => {
  try {
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const range = 'Invoices!A:I'; 

    const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = getResponse.data.values || [];
    const pendingInvoices = [];
    
    rows.forEach((row, index) => {
      const sheetRow = index + 1; 
      const rowEmail = row[0];
      const dateStr = row[1] || '';
      const status = row[8];

      if (rowEmail === userEmail) {
        if (targetMonthYear) {
           // Target format is MM/YYYY. Date format is DD/MM/YYYY
           if (dateStr.includes(targetMonthYear)) {
               pendingInvoices.push({
                 sheetRow,
                 date: dateStr,
                 vendor: row[2],
                 amount: parseFloat(row[4]) || 0,
                 currency: row[5] || 'ILS',
                 type: row[6],
                 fileUrl: row[7]
               });
           }
        } else if (status === 'Pending') {
           pendingInvoices.push({
             sheetRow,
             date: dateStr,
             vendor: row[2],
             amount: parseFloat(row[4]) || 0,
             currency: row[5] || 'ILS',
             type: row[6],
             fileUrl: row[7]
           });
        }
      }
    });

    if (pendingInvoices.length === 0) {
      return { success: true, message: 'No pending invoices to report' };
    }

    const fileName = `Summary_Report_${Date.now()}_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    const filePath = path.join('exports', fileName);

    const totals = {
      ILS: { income: 0, expense: 0 },
      USD: { income: 0, expense: 0 },
      EUR: { income: 0, expense: 0 }
    };

    let tableRowsHtml = '';

    for (const inv of pendingInvoices) {
      const curr = inv.currency.toUpperCase();
      if (!totals[curr]) totals[curr] = { income: 0, expense: 0 };
      
      if (inv.type === 'הכנסה') {
        totals[curr].income += inv.amount;
      } else {
        totals[curr].expense += inv.amount;
      }

      tableRowsHtml += `
        <tr>
          <td>${inv.date}</td>
          <td>${inv.vendor}</td>
          <td style="color: ${inv.type === 'הכנסה' ? '#16a34a' : '#dc2626'}">${inv.amount.toFixed(2)} ${inv.currency}</td>
          <td>${inv.type}</td>
        </tr>
      `;
    }

    let summaryHtml = '';
    Object.keys(totals).forEach(curr => {
      const { income, expense } = totals[curr];
      if (income > 0 || expense > 0) {
        summaryHtml += `
          <div class="summary-box">
            <h4>${curr}</h4>
            <p>הכנסות: <span class="income">₪${income.toFixed(2)}</span></p>
            <p>הוצאות: <span class="expense">₪${expense.toFixed(2)}</span></p>
          </div>
        `;
      }
    });

    let imagesHtml = '';
    for (const invoice of pendingInvoices) {
       if (invoice.fileUrl && invoice.fileUrl !== 'N/A' && invoice.fileUrl !== 'Unknown') {
          if (invoice.fileUrl.toLowerCase().endsWith('.pdf') || invoice.fileUrl.includes('.pdf')) {
              imagesHtml += `
                 <div class="receipt">
                    <p><strong>${invoice.vendor}</strong> - ${invoice.date}</p>
                    <p><a href="${invoice.fileUrl}" style="color: #2563eb; text-decoration: underline;">[לחץ כאן לפתיחת קובץ ה-PDF המקורי המצורף]</a></p>
                 </div>
              `;
          } else {
              imagesHtml += `
                 <div class="receipt">
                    <p><strong>${invoice.vendor}</strong> - ${invoice.date}</p>
                    <img src="${invoice.fileUrl}" alt="Receipt for ${invoice.vendor}">
                 </div>
              `;
          }
       }
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="he" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>דו"ח מסכם</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; }
        .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #1e40af; margin: 0 0 10px 0; font-size: 32px; }
        .header p { color: #64748b; font-size: 16px; margin: 5px 0; }
        .summary-container { display: flex; justify-content: center; gap: 20px; margin-bottom: 40px; flex-wrap: wrap; }
        .summary-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px 30px; border-radius: 12px; text-align: center; min-width: 180px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
        .summary-box h4 { margin: 0 0 15px 0; color: #475569; font-size: 20px; border-bottom: 1px solid #cbd5e1; padding-bottom: 10px; }
        .summary-box p { margin: 10px 0; font-weight: bold; font-size: 18px; }
        .income { color: #16a34a; }
        .expense { color: #dc2626; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 40px; font-size: 15px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border-radius: 8px; overflow: hidden; }
        th, td { border: 1px solid #e2e8f0; padding: 14px 16px; text-align: right; }
        th { background-color: #f1f5f9; color: #0f172a; font-weight: bold; font-size: 16px; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .receipts-section { page-break-before: always; }
        .receipt { text-align: center; margin-bottom: 40px; page-break-inside: avoid; border: 1px solid #cbd5e1; padding: 25px; border-radius: 12px; background: #fff; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
        .receipt p { margin: 0 0 20px 0; font-size: 18px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 15px; }
        .receipt img { max-width: 100%; max-height: 700px; object-fit: contain; border-radius: 8px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>דו"ח פיננסי חודשי - חדלות פירעון</h1>
        <p>חשבון: <strong>${userEmail}</strong></p>
        <p>סה"כ עסקאות מדווחות בדו"ח זה: <strong>${pendingInvoices.length}</strong></p>
        <p>תאריך הפקה: <strong>${new Date().toLocaleDateString('he-IL')}</strong></p>
      </div>
      
      <div class="summary-container">
        ${summaryHtml}
      </div>

      <table>
        <thead>
          <tr>
            <th>תאריך</th>
            <th>בית עסק / תיאור</th>
            <th>סכום</th>
            <th>סוג פעולה</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>

      ${imagesHtml ? `
      <div class="receipts-section">
        <h2 style="text-align: center; color: #1e40af; margin-bottom: 40px; border-bottom: 2px solid #2563eb; padding-bottom: 15px;">נספחים - צילומי קבלות ומסמכים</h2>
        ${imagesHtml}
      </div>
      ` : ''}
    </body>
    </html>
    `;

    const browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    await page.pdf({ 
       path: filePath, 
       format: 'A4', 
       printBackground: true,
       margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' }
    });
    await browser.close();

    // Only mark as reported if we are generating a pending report, NOT a historical one
    if (!targetMonthYear) {
       const dataToUpdate = pendingInvoices.map(invoice => ({
         range: `Invoices!I${invoice.sheetRow}`,
         values: [['Reported']]
       }));

       if (dataToUpdate.length > 0) {
           await sheets.spreadsheets.values.batchUpdate({
             spreadsheetId,
             requestBody: { valueInputOption: 'USER_ENTERED', data: dataToUpdate }
           });
       }
    }

    return { success: true, message: 'Report generated successfully', filePath };

  } catch (error) {
    console.error('Error generating report:', error);
    throw error;
  }
};

router.post('/generate', async (req, res) => {
  try {
    const { userEmail } = req.body;
    if (!userEmail) {
      return res.status(400).json({ success: false, message: 'userEmail is required' });
    }

    const result = await generateUserReport(userEmail);
    return res.json(result);
  } catch (error) {
    console.error('Error in /generate route:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

export default router;
