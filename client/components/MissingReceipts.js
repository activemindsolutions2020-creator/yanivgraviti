"use client";

import React, { useMemo } from 'react';
import { AlertCircle, Printer, FileX, Calendar } from 'lucide-react';

export default function MissingReceipts({ invoices }) {
  const missingReceipts = useMemo(() => {
    if (!invoices || !Array.isArray(invoices)) return [];
    
    return invoices.filter(inv => {
      // Must not be a duplicate
      if (inv.status?.trim() === 'Duplicate') return false;
      // Must be an expense (not income)
      const isIncome = inv.type && inv.type.includes("הכנסה");
      if (isIncome) return false;
      // Must not have a valid fileUrl
      const hasFile = inv.fileUrl && inv.fileUrl.trim() !== '' && inv.fileUrl !== 'N/A';
      return !hasFile;
    }).sort((a, b) => {
      // Sort by date descending if possible
      if (!a.date || !b.date) return 0;
      return b.date.localeCompare(a.date);
    });
  }, [invoices]);

  if (!invoices || invoices.length === 0) return null;

  const handlePrint = () => {
    window.print();
  };

  if (missingReceipts.length === 0) {
    return (
      <div dir="rtl" className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl flex items-center justify-center gap-3 mb-8">
        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
          <AlertCircle size={24} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-emerald-800">בקרת קבלות: הכל תקין!</h3>
          <p className="text-emerald-600 text-sm">לכל ההוצאות בחשבון צורפה קבלה או אסמכתא.</p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="bg-white border border-rose-200 p-6 rounded-2xl shadow-sm mb-8 print:border-none print:shadow-none print:p-0">
      <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center text-rose-600">
            <FileX size={20} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">דוח חוסרים (בקרה אוטומטית)</h3>
            <p className="text-slate-500 text-sm">נמצאו {missingReceipts.length} עסקאות ללא קבלה או מסמך מצורף</p>
          </div>
        </div>
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm font-medium print:hidden"
        >
          <Printer size={16} />
          הדפס דוח חוסרים
        </button>
      </div>

      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
              <th className="p-4 font-semibold w-1/6">תאריך</th>
              <th className="p-4 font-semibold w-2/6">ספק / בית עסק</th>
              <th className="p-4 font-semibold w-1/6">סכום</th>
              <th className="p-4 font-semibold w-1/6">קטגוריה</th>
              <th className="p-4 font-semibold w-1/6 text-left">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {missingReceipts.map((inv, idx) => (
              <tr key={idx} className="border-b border-slate-100 hover:bg-rose-50/30 transition-colors">
                <td className="p-4 text-slate-700">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-slate-400" />
                    {inv.date || "לא צוין"}
                  </div>
                </td>
                <td className="p-4 font-medium text-slate-800">{inv.vendor || "לא ידוע"}</td>
                <td className="p-4 text-slate-800 font-bold" dir="ltr">₪{parseFloat(inv.amount || 0).toLocaleString()}</td>
                <td className="p-4 text-slate-600 text-sm">{inv.category || "אחר"}</td>
                <td className="p-4 text-left">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-100 text-rose-700 text-xs font-semibold">
                    <AlertCircle size={12} /> חסרה קבלה
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 text-sm text-slate-400 text-center print:block hidden">
        דוח חוסרים הופק אוטומטית ממערכת Smart Insolvency בתאריך {new Date().toLocaleDateString('he-IL')}
      </div>
    </div>
  );
}
