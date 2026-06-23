import express from 'express';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { sheets, drive } from '../server.js';

const router = express.Router();

if (!fs.existsSync('exports/')) {
  fs.mkdirSync('exports/');
}

// 1. מוודא שהפונקציה מיוצאת (Export)
export const generateUserReport = async (userEmail) => {
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
      const status = row[8];

      if (rowEmail === userEmail && status === 'Pending') {
        pendingInvoices.push({
          sheetRow,
          date: row[1],
          vendor: row[2],
          amount: parseFloat(row[4]) || 0,
          currency: row[5] || 'ILS',
          type: row[6],
          fileUrl: row[7]
        });
      }
    });

    if (pendingInvoices.length === 0) {
      return { success: true, message: 'No pending invoices to report' };
    }

    const doc = new PDFDocument({ margin: 50 });
    const fileName = `Summary_Report_${Date.now()}_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    const filePath = path.join('exports', fileName);
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    const totals = {
      ILS: { income: 0, expense: 0 },
      USD: { income: 0, expense: 0 },
      EUR: { income: 0, expense: 0 }
    };

    for (const inv of pendingInvoices) {
      const curr = inv.currency.toUpperCase();
      if (!totals[curr]) totals[curr] = { income: 0, expense: 0 };
      
      if (inv.type === 'הכנסה') {
        totals[curr].income += inv.amount;
      } else {
        totals[curr].expense += inv.amount;
      }
    }

    doc.fontSize(24).text('Financial Summary Report', { align: 'center' });
    doc.fontSize(12).text(`Account: ${userEmail}`, { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(16).text('Summary Totals', { underline: true });
    doc.moveDown(0.5);

    Object.keys(totals).forEach(curr => {
      const { income, expense } = totals[curr];
      if (income > 0 || expense > 0) {
        doc.fontSize(14).text(`${curr} Transactions:`);
        doc.fontSize(12).text(`  - Total Income: ${income.toFixed(2)}`);
        doc.fontSize(12).text(`  - Total Expense: ${expense.toFixed(2)}`);
        doc.moveDown();
      }
    });

    doc.moveDown();
    doc.fontSize(12).text(`Total Transactions Processed: ${pendingInvoices.length}`);

    for (const invoice of pendingInvoices) {
      doc.addPage();
      
      doc.fontSize(16).text('Transaction Receipt', { underline: true });
      doc.fontSize(12).text(`Date: ${invoice.date || 'N/A'}`);
      doc.text(`Vendor: ${invoice.vendor || 'N/A'}`);
      doc.text(`Amount: ${invoice.amount.toFixed(2)} ${invoice.currency}`);
      doc.moveDown();

      if (!invoice.fileUrl || invoice.fileUrl === 'N/A' || invoice.fileUrl === 'Unknown') {
        doc.text('[No attachment found for this transaction]');
        continue;
      }

      try {
        if (invoice.fileUrl.toLowerCase().endsWith('.pdf') || invoice.fileUrl.includes('.pdf')) {
           doc.text(`[Attachment is a PDF document]`);
           doc.fillColor('blue').text('Click here to view PDF', { link: invoice.fileUrl, underline: true });
           doc.fillColor('black'); // Reset
           continue;
        }

        // Fetch image from Cloudinary (or any public URL)
        const axios = (await import('axios')).default;
        const response = await axios.get(invoice.fileUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);

        doc.image(buffer, {
          fit: [500, 550],
          align: 'center',
          valign: 'center'
        });
      } catch (err) {
        console.error(`Failed to load/embed attachment for ${invoice.fileUrl}:`, err.message);
        doc.text(`[Attachment could not be loaded]`);
        doc.fillColor('blue').text('Original Link', { link: invoice.fileUrl, underline: true });
        doc.fillColor('black');
      }
    }

    doc.end();

    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    const dataToUpdate = pendingInvoices.map(invoice => ({
      range: `Invoices!I${invoice.sheetRow}`,
      values: [['Reported']]
    }));

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: 'USER_ENTERED', data: dataToUpdate }
    });

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
