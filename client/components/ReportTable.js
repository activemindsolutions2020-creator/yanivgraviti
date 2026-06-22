"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import * as htmlToImage from "html-to-image";
import { jsPDF } from "jspdf";
import { PDFDocument } from "pdf-lib";
import ManualEntryModal from "./ManualEntryModal";
import { ArrowUpDown, ArrowDown, ArrowUp, FileDown } from "lucide-react";

export default function ReportTable({ userEmail }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState(null);
  const [expandedMonths, setExpandedMonths] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [exportingMonth, setExportingMonth] = useState(null);

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const parseDate = (dateStr) => {
    if (!dateStr || dateStr === "N/A" || dateStr === "Unknown") return 0;
    try {
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          let year = parseInt(parts[2], 10);
          if (year < 100) year += 2000;
          return new Date(year, month, day).getTime();
        }
      }
      return new Date(dateStr).getTime() || 0;
    } catch {
      return 0;
    }
  };

  const exportToPDF = async (monthYear, items) => {
    const element = document.getElementById(`month-container-${monthYear}`);
    if (!element) return;

    try {
      setExportingMonth(monthYear);

      const pdfDoc = await PDFDocument.create();

      // 1. Capture the table as an image using html-to-image (bypasses lab color error)
      const imgData = await htmlToImage.toPng(element, { pixelRatio: 2 });
      
      const base64Data = imgData.split(',')[1];
      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Embed table image
      const tableImage = await pdfDoc.embedPng(bytes);
      const tablePage = pdfDoc.addPage([tableImage.width, tableImage.height]);
      tablePage.drawImage(tableImage, { x: 0, y: 0, width: tableImage.width, height: tableImage.height });

      // 2. Process each invoice file
      for (const inv of items) {
        if (!inv.fileUrl || inv.fileUrl === 'N/A' || inv.fileUrl === 'Unknown') continue;

        try {
          const proxyUrl = `/api/fetch-proxy?url=${encodeURIComponent(inv.fileUrl)}`;
          const response = await fetch(proxyUrl);

          if (!response.ok) {
            console.error(`Failed to fetch ${inv.fileUrl}`);
            continue;
          }

          const fileBuffer = await response.arrayBuffer();
          const contentType = response.headers.get('content-type') || '';
          const urlLower = inv.fileUrl.toLowerCase();

          if (contentType.includes('pdf') || urlLower.includes('.pdf')) {
            const externalPdf = await PDFDocument.load(fileBuffer);
            const copiedPages = await pdfDoc.copyPages(externalPdf, externalPdf.getPageIndices());
            copiedPages.forEach(page => pdfDoc.addPage(page));
          }
          else if (contentType.includes('image') || urlLower.match(/\.(jpeg|jpg|png|webp)$/)) {
            let externalImg;
            try {
              if (contentType.includes('png') || urlLower.includes('.png')) {
                externalImg = await pdfDoc.embedPng(fileBuffer);
              } else {
                externalImg = await pdfDoc.embedJpg(fileBuffer);
              }

              const page = pdfDoc.addPage([595.28, 841.89]);
              const margin = 40;
              const { width, height } = externalImg.scaleToFit(595.28 - (margin * 2), 841.89 - (margin * 2));

              page.drawImage(externalImg, {
                x: (595.28 / 2) - (width / 2),
                y: (841.89 / 2) - (height / 2),
                width,
                height,
              });
            } catch (imgErr) {
              console.warn(`Could not embed image ${inv.fileUrl}, skipping.`, imgErr);
            }
          }
        } catch (fileErr) {
          console.error(`Error processing file for invoice ${inv.id}:`, fileErr);
        }
      }

      // 3. Save and trigger download
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Report_${monthYear}_Full.pdf`;
      link.click();

    } catch (err) {
      console.error("Error generating combined PDF", err);
      alert(`שגיאה ביצירת ה-PDF המשולב: ${err.message}`);
    } finally {
      setExportingMonth(null);
    }
  };

  const toggleMonth = (monthYear) => {
    setExpandedMonths(prev => ({
      ...prev,
      [monthYear]: prev[monthYear] === false ? true : false
    }));
  };

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/invoices?userEmail=${userEmail}`);
      if (res.data.success) {
        setInvoices(res.data.data);
      } else {
        setError(res.data.message || res.data.error || "Unknown error occurred");
      }
    } catch (err) {
      const serverError = err.response?.data?.error || err.response?.data?.message || err.message;
      setError(`Failed to load historical data: ${serverError}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [userEmail]);

  // Expose fetchInvoices to parent if needed via an event or ref, but for now we just rely on polling or a refresh button

  const handleDelete = async (id) => {
    if (!confirm("האם אתה בטוח שברצונך למחוק תנועה זו? היא תוסתר מהדוח ותוגדר כ'מבוטלת'.")) return;

    try {
      setLoading(true);
      const res = await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/api/invoices/${id}?userEmail=${userEmail}`);
      if (res.data.success) {
        fetchInvoices();
      } else {
        alert("שגיאה במחיקת התנועה: " + res.data.message);
        setLoading(false);
      }
    } catch (err) {
      alert("אירעה שגיאה בתקשורת.");
      console.error(err);
      setLoading(false);
    }
  };
  if (loading) {
    return (
      <div className="p-8 bg-white border border-slate-200 shadow-sm rounded-2xl text-center">
        <span className="text-xl font-bold text-slate-500 animate-pulse">טוען נתונים היסטוריים...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-white border border-slate-200 shadow-sm rounded-2xl text-center">
        <span className="text-xl font-bold text-red-500">{error}</span>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="p-8 bg-white border border-slate-200 shadow-sm rounded-2xl text-center">
        <span className="text-xl font-medium text-slate-500">עדיין לא הועלו חשבוניות או מסמכים למערכת.</span>
      </div>
    );
  }

  // Category Translation Map (for backward compatibility with English/old Hebrew data in Sheets)
  const categoryMap = {
    // English
    'Food': 'כלכלה (מזון)',
    'Groceries': 'כלכלה (מזון)',
    'Transportation': 'אחזקת רכב',
    'Pharmacy': 'הוצאות רפואיות',
    'Office Supplies': 'הוצאות נוספות',
    'Services': 'הוצאות נוספות',
    'Legal': 'הוצאות נוספות',
    'Medical': 'הוצאות רפואיות',
    'General Merchandise': 'הוצאות נוספות',
    'Salary': 'משכורת נטו',
    'Other': 'הוצאות נוספות',
    'Uncategorized': 'ללא קטגוריה',
    // Old Hebrew
    'מזון ומסעדות': 'כלכלה (מזון)',
    'קניות בסופר': 'כלכלה (מזון)',
    'תחבורה ורכב': 'אחזקת רכב',
    'פארם ותרופות': 'הוצאות רפואיות',
    'ציוד משרדי': 'הוצאות נוספות',
    'שירותים ומנויים': 'הוצאות נוספות',
    'משפטי ואגרות': 'הוצאות נוספות',
    'רפואה ובריאות': 'הוצאות רפואיות',
    'אחר': 'הוצאות נוספות',
    'אחר / כללי': 'הוצאות נוספות'
  };

  const getHebrewCategory = (cat) => categoryMap[cat] || cat || 'ללא קטגוריה';

  // Function to get emoji based on official category
  const getCategoryEmoji = (cat) => {
    // Expenses
    if (cat === 'שכר דירה') return '🏠';
    if (cat === 'משכנתא') return '🏦';
    if (cat === 'מיסי עירייה') return '🏛️';
    if (cat === 'כלכלה (מזון)') return '🛒';
    if (cat === 'טלפון, כבלים ואינטרנט') return '📺';
    if (cat === 'טלפון נייד') return '📱';
    if (cat === 'גז') return '🔥';
    if (cat === 'ועד בית') return '🏢';
    if (cat === 'מים') return '💧';
    if (cat === 'חשמל') return '⚡';
    if (cat === 'תשלום חודשי לממונה') return '⚖️';
    if (cat === 'הוצאות רפואיות') return '🏥';
    if (cat === 'נסיעות לעבודה') return '🚌';
    if (cat === 'טיפול בילדים') return '👶';
    if (cat === 'תשלום מזונות') return '👨‍👩‍👧';
    if (cat === 'נסיעות אחרות') return '🚕';
    if (cat === 'אחזקת רכב') return '🚗';
    if (cat === 'חינוך ותרבות') return '📚';
    if (cat === 'הלבשה') return '👕';
    if (cat === 'הוצאות נוספות') return '📌';

    // Incomes
    if (cat === 'משכורת נטו') return '💼';
    if (cat === 'הכנסה מעסק') return '📈';
    if (cat === 'פנסיה') return '👴';
    if (cat === 'שכר דירה (הכנסה)') return '🔑';
    if (cat === 'קצבאות ביטוח לאומי') return '🛡️';
    if (cat === 'מזונות (הכנסה)') return '💰';
    if (cat === 'הכנסות נוספות') return '💵';

    return '📌';
  };

  const translateStatus = (status) => {
    if (!status) return 'ממתין לדיווח';
    if (status === 'Reported' || status === 'Reported ') return 'דווח בהצלחה';
    if (status === 'Pending' || status === 'Pending ') return 'ממתין לדיווח';
    if (status === 'Reported Manually' || status === 'Reported Manually ') return 'דווח ידנית';
    if (status === 'מבוטל') return 'מבוטל';
    return status;
  };

  const getStatusColor = (status) => {
    if (status === 'דווח בהצלחה') return 'bg-blue-100 text-blue-700';
    if (status === 'דווח ידנית') return 'bg-green-100 text-green-700';
    if (status === 'מבוטל') return 'bg-gray-100 text-gray-700';
    return 'bg-yellow-100 text-yellow-700'; // Pending
  };
  const groupedData = {};

  let grandTotalIncome = 0;
  let grandTotalExpense = 0;

  invoices.forEach(inv => {
    // Attempt to parse the date. Fallback to 'Unknown' if date is 'N/A' or invalid.
    let monthYearStr = "לא ידוע";
    if (inv.date && inv.date !== "N/A" && inv.date !== "Unknown") {
      try {
        let d;
        if (inv.date.includes('/')) {
          const parts = inv.date.split('/');
          if (parts.length === 3) {
            // parts[0] is DD, parts[1] is MM, parts[2] is YYYY
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            let year = parseInt(parts[2], 10);
            if (year < 100) year += 2000; // handle "26" as 2026
            d = new Date(year, month, day);
          } else {
            d = new Date(inv.date);
          }
        } else {
          d = new Date(inv.date);
        }

        if (d && !isNaN(d.getTime())) {
          monthYearStr = d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
        }
      } catch (e) {
        // keep as unknown
      }
    }

    if (!groupedData[monthYearStr]) {
      groupedData[monthYearStr] = { items: [], totalIncome: 0, totalExpense: 0, categories: {} };
    }

    // Convert to Hebrew category
    const hebCat = getHebrewCategory(inv.category);
    // Update inv.category so it displays in Hebrew in the table
    inv.displayCategory = hebCat;

    groupedData[monthYearStr].items.push(inv);

    // Assuming "הכנסה" means Income and anything else is Expense
    if (inv.type && inv.type.includes("הכנסה")) {
      groupedData[monthYearStr].totalIncome += inv.amount;
      if (inv.status !== 'מבוטל' && inv.status !== 'Canceled') {
        grandTotalIncome += inv.amount;
      }
    } else {
      groupedData[monthYearStr].totalExpense += inv.amount;
      if (inv.status !== 'מבוטל' && inv.status !== 'Canceled') {
        grandTotalExpense += inv.amount;
      }
      // Track category expenses
      if (!groupedData[monthYearStr].categories[hebCat]) {
        groupedData[monthYearStr].categories[hebCat] = 0;
      }
      groupedData[monthYearStr].categories[hebCat] += inv.amount;
    }
  });

  const grandBalance = grandTotalIncome - grandTotalExpense;
  const balanceColor = grandBalance >= 0 ? 'text-emerald-600' : 'text-rose-600';
  const balanceBg = grandBalance >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200';


  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white border border-slate-200 shadow-sm rounded-2xl p-6 gap-4">
        <h2 className="text-2xl font-bold text-slate-800">היסטוריית חשבוניות ודוחות</h2>
        <div className="flex gap-4">
          <button
            onClick={() => { setEditInvoice(null); setIsModalOpen(true); }}
            className="px-6 py-2.5 bg-blue-600 rounded-lg font-medium text-white hover:bg-blue-700 shadow-sm transition-all flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            הוסף תנועה ידנית
          </button>
          <button
            onClick={fetchInvoices}
            className="px-6 py-2.5 bg-slate-100 border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-200 transition-all flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            רענן נתונים
          </button>
        </div>
      </div>

      <ManualEntryModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditInvoice(null); }}
        userEmail={userEmail}
        onSuccess={fetchInvoices}
        initialData={editInvoice}
      />

      {/* Grand Totals Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 flex flex-col justify-center items-center text-center">
          <span className="text-sm font-semibold text-slate-500 mb-1">סך הכנסות מצטבר</span>
          <span className="text-3xl font-bold text-slate-800">₪{grandTotalIncome.toFixed(2)}</span>
        </div>
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 flex flex-col justify-center items-center text-center">
          <span className="text-sm font-semibold text-slate-500 mb-1">סך הוצאות מצטבר</span>
          <span className="text-3xl font-bold text-slate-800">₪{grandTotalExpense.toFixed(2)}</span>
        </div>
        <div className={`border shadow-sm rounded-2xl p-6 flex flex-col justify-center items-center text-center ${balanceBg}`}>
          <span className={`text-sm font-bold mb-1 ${balanceColor}`}>יתרה כוללת (הכנסות מול הוצאות)</span>
          <span className={`text-4xl font-black ${balanceColor}`}>
            {grandBalance > 0 ? '+' : ''}₪{grandBalance.toFixed(2)}
          </span>
        </div>
      </div>

      {Object.keys(groupedData).map((monthYear) => {
        const { items, totalIncome, totalExpense, categories } = groupedData[monthYear];
        const isExpanded = expandedMonths[monthYear] !== false; // Default to true (expanded)

        const sortedItems = [...items].sort((a, b) => {
          let valA = a[sortConfig.key];
          let valB = b[sortConfig.key];

          if (sortConfig.key === 'date') {
            valA = parseDate(a.date);
            valB = parseDate(b.date);
          } else if (sortConfig.key === 'amount') {
            valA = a.amount || 0;
            valB = b.amount || 0;
          } else if (sortConfig.key === 'displayCategory') {
            valA = a.displayCategory || "";
            valB = b.displayCategory || "";
          } else if (sortConfig.key === 'type') {
            valA = a.type || "";
            valB = b.type || "";
          } else if (sortConfig.key === 'vendor') {
            valA = a.vendor || "";
            valB = b.vendor || "";
          } else if (sortConfig.key === 'status') {
            valA = translateStatus(a.status) || "";
            valB = translateStatus(b.status) || "";
          }

          if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        });

        const SortIcon = ({ columnKey }) => {
          if (sortConfig.key !== columnKey) return <ArrowUpDown className="w-4 h-4 inline-block text-gray-400 opacity-50 ml-1" />;
          return sortConfig.direction === 'asc'
            ? <ArrowUp className="w-4 h-4 inline-block text-blue-600 ml-1" />
            : <ArrowDown className="w-4 h-4 inline-block text-blue-600 ml-1" />;
        };

        return (
          <div key={monthYear} id={`month-container-${monthYear}`} className="bg-white border border-slate-200 shadow-sm rounded-2xl p-8 transition-all duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center group">
              <div
                className="flex items-center gap-3 cursor-pointer flex-1"
                onClick={() => toggleMonth(monthYear)}
              >
                <h3 className="text-2xl font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{monthYear}</h3>
                <div className={`p-1 bg-slate-100 rounded-full text-slate-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-4 md:mt-0">
                <button
                  onClick={(e) => { e.stopPropagation(); exportToPDF(monthYear, items); }}
                  disabled={exportingMonth === monthYear}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-colors border ${exportingMonth === monthYear ? 'bg-blue-50 text-blue-400 border-blue-200 cursor-not-allowed' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'}`}
                  title="ייצא דוח מלא ל-PDF"
                >
                  {exportingMonth === monthYear ? (
                    <>
                      <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                      מייצר PDF...
                    </>
                  ) : (
                    <>
                      <FileDown className="w-4 h-4" />
                      PDF מלא
                    </>
                  )}
                </button>
                <div className="px-6 py-2 rounded-lg bg-emerald-50 border border-emerald-100 flex flex-col items-center">
                  <span className="text-xs font-semibold text-emerald-600">הכנסות</span>
                  <span className="text-lg font-bold text-emerald-700">₪{totalIncome.toFixed(2)}</span>
                </div>
                <div className="px-6 py-2 rounded-lg bg-rose-50 border border-rose-100 flex flex-col items-center">
                  <span className="text-xs font-semibold text-rose-600">הוצאות</span>
                  <span className="text-lg font-bold text-rose-700">₪{totalExpense.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Accordion Content (Collapsible) */}
            <div className={`transition-all duration-500 overflow-hidden ${isExpanded ? 'max-h-[5000px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>

              {/* Category Widgets */}
              {Object.keys(categories).length > 0 && (
                <div className="mb-8">
                  <h4 className="text-sm font-bold text-gray-500 mb-4 border-b border-gray-300 pb-2">סיכום הוצאות לפי קטגוריות</h4>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(categories)
                      .sort((a, b) => b[1] - a[1]) // Sort by amount descending
                      .map(([catName, amount]) => (
                        <div key={catName} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                          <span className="text-lg">{getCategoryEmoji(catName)}</span>
                          <span className="text-sm font-medium text-slate-700">{catName}:</span>
                          <span className="text-sm font-bold text-rose-600">₪{amount.toFixed(2)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-300">
                      <th className="py-4 px-4 font-bold text-gray-600 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handleSort('date')}>
                        <div className="flex items-center justify-end gap-1">תאריך <SortIcon columnKey="date" /></div>
                      </th>
                      <th className="py-4 px-4 font-bold text-gray-600 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handleSort('vendor')}>
                        <div className="flex items-center justify-end gap-1">ספק/לקוח <SortIcon columnKey="vendor" /></div>
                      </th>
                      <th className="py-4 px-4 font-bold text-gray-600 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handleSort('displayCategory')}>
                        <div className="flex items-center justify-end gap-1">קטגוריה <SortIcon columnKey="displayCategory" /></div>
                      </th>
                      <th className="py-4 px-4 font-bold text-gray-600 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handleSort('type')}>
                        <div className="flex items-center justify-end gap-1">סוג מסמך <SortIcon columnKey="type" /></div>
                      </th>
                      <th className="py-4 px-4 font-bold text-gray-600 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handleSort('amount')}>
                        <div className="flex items-center justify-end gap-1">סכום <SortIcon columnKey="amount" /></div>
                      </th>
                      <th className="py-4 px-4 font-bold text-gray-600 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handleSort('status')}>
                        <div className="flex items-center justify-end gap-1">סטטוס <SortIcon columnKey="status" /></div>
                      </th>
                      <th className="py-4 px-4 font-bold text-gray-600">פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedItems.map((inv, idx) => (
                      <tr key={idx} className="border-b border-gray-200 hover:bg-[#e4e5e9] transition-colors">
                        <td className="py-4 px-4 text-gray-700">{inv.date}</td>
                        <td className="py-4 px-4 text-gray-800 font-semibold">{inv.vendor}</td>
                        <td className="py-4 px-4 text-gray-600">{inv.displayCategory}</td>
                        <td className="py-4 px-4 text-gray-600">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${inv.type?.includes('הכנסה') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {inv.type}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-bold text-blue-600">
                          <span dir="ltr">{inv.currency === 'ILS' ? '₪' : inv.currency} {inv.amount}</span>
                        </td>
                        <td className="py-4 px-4 text-gray-600">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(translateStatus(inv.status))}`}>
                            {translateStatus(inv.status)}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => { setEditInvoice(inv); setIsModalOpen(true); }} className="p-2 bg-slate-50 border border-slate-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-all" title="ערוך">
                              ✏️
                            </button>
                            <button onClick={() => handleDelete(inv.id)} className="p-2 bg-slate-50 border border-slate-200 text-red-600 rounded-lg hover:bg-red-50 transition-all" title="מחק">
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
