"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import ManualEntryModal from "./ManualEntryModal";

export default function ReportTable({ userEmail }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState(null);
  const [expandedMonths, setExpandedMonths] = useState({});

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
      <div className="p-8 bg-[#edeef2] shadow-neu-flat rounded-3xl text-center">
        <span className="text-xl font-bold text-gray-500 animate-pulse">טוען נתונים היסטוריים...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-[#edeef2] shadow-neu-flat rounded-3xl text-center">
        <span className="text-xl font-bold text-red-500">{error}</span>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="p-8 bg-[#edeef2] shadow-neu-flat rounded-3xl text-center">
        <span className="text-xl font-bold text-gray-500">עדיין לא הועלו חשבוניות או מסמכים למערכת.</span>
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
    } else {
      groupedData[monthYearStr].totalExpense += inv.amount;
      // Track category expenses
      if (!groupedData[monthYearStr].categories[hebCat]) {
        groupedData[monthYearStr].categories[hebCat] = 0;
      }
      groupedData[monthYearStr].categories[hebCat] += inv.amount;
    }
  });


  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row justify-between items-center bg-[#edeef2] shadow-neu-flat rounded-2xl p-6 gap-4">
        <h2 className="text-2xl font-bold text-gray-700">היסטוריית חשבוניות ודוחות</h2>
        <div className="flex gap-4">
          <button 
            onClick={() => { setEditInvoice(null); setIsModalOpen(true); }}
            className="px-6 py-2 bg-blue-500 rounded-xl font-bold text-white hover:bg-blue-600 shadow-neu-flat transition-all flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            הוסף תנועה ידנית
          </button>
          <button 
            onClick={fetchInvoices}
            className="px-6 py-2 bg-[#edeef2] shadow-neu-flat rounded-xl font-bold text-gray-700 hover:shadow-neu-pressed transition-all flex items-center gap-2"
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

      {Object.keys(groupedData).map((monthYear) => {
        const { items, totalIncome, totalExpense, categories } = groupedData[monthYear];
        const isExpanded = expandedMonths[monthYear] !== false; // Default to true (expanded)
        
        return (
          <div key={monthYear} className="bg-[#edeef2] shadow-neu-flat rounded-3xl p-8 transition-all duration-500">
            {/* Header (Clickable for Accordion) */}
            <div 
              className="flex flex-col md:flex-row justify-between items-center mb-6 cursor-pointer group"
              onClick={() => toggleMonth(monthYear)}
            >
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-extrabold text-gray-800 group-hover:text-blue-500 transition-colors">{monthYear}</h3>
                <div className={`p-1 bg-[#edeef2] shadow-neu-pressed rounded-full text-gray-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
              <div className="flex gap-4 mt-4 md:mt-0">
                <div className="px-6 py-3 rounded-xl bg-[#edeef2] shadow-neu-pressed flex flex-col items-center">
                  <span className="text-sm font-semibold text-gray-500">הכנסות</span>
                  <span className="text-lg font-bold text-green-600">₪{totalIncome.toFixed(2)}</span>
                </div>
                <div className="px-6 py-3 rounded-xl bg-[#edeef2] shadow-neu-pressed flex flex-col items-center">
                  <span className="text-sm font-semibold text-gray-500">הוצאות</span>
                  <span className="text-lg font-bold text-red-500">₪{totalExpense.toFixed(2)}</span>
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
                      <div key={catName} className="flex items-center gap-2 px-4 py-2 bg-[#edeef2] shadow-neu-flat rounded-full">
                        <span className="text-lg">{getCategoryEmoji(catName)}</span>
                        <span className="text-sm font-semibold text-gray-700">{catName}:</span>
                        <span className="text-sm font-bold text-red-500">₪{amount.toFixed(2)}</span>
                      </div>
                  ))}
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="py-4 px-4 font-bold text-gray-600">תאריך</th>
                    <th className="py-4 px-4 font-bold text-gray-600">ספק/לקוח</th>
                    <th className="py-4 px-4 font-bold text-gray-600">קטגוריה</th>
                    <th className="py-4 px-4 font-bold text-gray-600">סוג מסמך</th>
                    <th className="py-4 px-4 font-bold text-gray-600">סכום</th>
                    <th className="py-4 px-4 font-bold text-gray-600">סטטוס</th>
                    <th className="py-4 px-4 font-bold text-gray-600">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((inv, idx) => (
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
                          <button onClick={() => { setEditInvoice(inv); setIsModalOpen(true); }} className="p-2 bg-[#edeef2] text-blue-500 rounded-xl shadow-neu-flat hover:shadow-neu-pressed transition-all" title="ערוך">
                            ✏️
                          </button>
                          <button onClick={() => handleDelete(inv.id)} className="p-2 bg-[#edeef2] text-red-500 rounded-xl shadow-neu-flat hover:shadow-neu-pressed transition-all" title="מחק">
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
