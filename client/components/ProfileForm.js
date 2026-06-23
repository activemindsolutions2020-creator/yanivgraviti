"use client";

import { useState, useEffect } from "react";
import axios from "axios";

export default function ProfileForm({ userEmail }) {
  const [formData, setFormData] = useState({
    idNumber: "",
    caseNumber: "",
    phoneNumber: "",
    govToken: "",
    geminiApiKey: "",
    reminderDay: "25",
    reminderMessage: "",
    monthlyBudget: "",
    isInsolvency: false,
    accountantPhone: "",
    sendReportToTelegram: false,
    sendReportToAccountantTelegram: false,
  });
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!userEmail) return;
    axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/profile?userEmail=${userEmail}`)
      .then(res => {
        if (res.data.success && res.data.data) {
          setFormData(prev => ({ ...prev, ...res.data.data }));
        }
      })
      .catch(err => console.error("Error fetching profile", err));
  }, [userEmail]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: "loading", message: "שומר נתונים..." });
    
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/profile`, {
        userEmail,
        ...formData,
      });
      
      if (res.data.success) {
        setStatus({ type: "success", message: "ההגדרות נשמרו בהצלחה!" });
      } else {
        setStatus({ type: "error", message: res.data.message });
      }
    } catch (error) {
      setStatus({ 
        type: "error", 
        message: error.response?.data?.message || "אירעה שגיאה לא צפויה" 
      });
    }
  };

  return (
    <div className="p-8 bg-white border border-slate-200 shadow-sm rounded-2xl" dir="rtl">
      <form onSubmit={handleSubmit} className="space-y-5">
        <input
          type="text"
          name="phoneNumber"
          placeholder="מספר טלפון (לחיבור הבוט בטלגרם)"
          value={formData.phoneNumber}
          onChange={handleChange}
          className="w-full p-3.5 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-slate-700"
          dir="rtl"
        />

        <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              name="isInsolvency"
              checked={formData.isInsolvency}
              onChange={(e) => setFormData({ ...formData, isInsolvency: e.target.checked })}
              className="sr-only peer" 
            />
            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
          <span className="text-sm font-medium text-slate-700">האם הלקוח מוגדר תחת הליך חדלות פירעון? (משנה את לוגיקת הייעוץ הפיננסי)</span>
        </div>

        <input
          type="text"
          name="idNumber"
          placeholder="תעודת זהות"
          value={formData.idNumber}
          onChange={handleChange}
          className="w-full p-3.5 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-slate-700"
        />
        <input
          type="text"
          name="caseNumber"
          placeholder="מספר תיק"
          value={formData.caseNumber}
          onChange={handleChange}
          className="w-full p-3.5 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-slate-700"
        />
        <input
          type="number"
          name="monthlyBudget"
          placeholder="תקציב חודשי (₪)"
          value={formData.monthlyBudget}
          onChange={handleChange}
          className="w-full p-3.5 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-slate-700"
        />

        <div className="border-t border-slate-200 pt-4 mt-2">
          <h3 className="text-sm font-bold text-slate-800 mb-3">הגדרות סוף חודש (דוח אוטומטי)</h3>
          
          <input
            type="tel"
            name="accountantPhone"
            placeholder="טלפון נייד רואה חשבון / עו״ד (לשליחת הדוח)"
            value={formData.accountantPhone}
            onChange={handleChange}
            className="w-full p-3.5 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-slate-700 mb-4"
          />

          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.sendReportToTelegram}
                onChange={(e) => setFormData({ ...formData, sendReportToTelegram: e.target.checked })}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-700">שלח לי עותק לטלגרם ב-1 לכל חודש</span>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.sendReportToAccountantTelegram}
                onChange={(e) => setFormData({ ...formData, sendReportToAccountantTelegram: e.target.checked })}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-700">שלח עותק אוטומטי לטלגרם של רואה החשבון/עו״ד</span>
            </label>
          </div>
        </div>
        <div className="relative">
          <input
            type="password"
            name="govToken"
            placeholder="טוקן הזדהות - ממשל זמין"
            value={formData.govToken}
            onChange={handleChange}
            className="w-full p-3.5 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-slate-700"
          />
          <a 
            href="https://my.gov.il/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors bg-slate-50 px-2"
          >
            איך משיגים?
          </a>
        </div>
        
        <div className="flex gap-4">
          <div className="w-1/3">
            <label className="block text-xs font-medium text-slate-500 mb-1">יום תזכורת חודשי</label>
            <select
              name="reminderDay"
              value={formData.reminderDay}
              onChange={handleChange}
              className="w-full p-3.5 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-slate-700"
            >
              {[...Array(31)].map((_, i) => (
                <option key={i+1} value={i+1}>{i+1}</option>
              ))}
            </select>
          </div>
          <div className="w-2/3">
            <label className="block text-xs font-medium text-slate-500 mb-1">הודעת תזכורת מותאמת אישית</label>
            <textarea
              name="reminderMessage"
              placeholder="בוקר טוב! תזכורת קטנה להעלות קבלות..."
              value={formData.reminderMessage}
              onChange={handleChange}
              rows="2"
              className="w-full p-3.5 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-slate-700 resize-none"
            />
          </div>
        </div>

        <div className="relative">
          <input
            type="password"
            name="geminiApiKey"
            placeholder="מפתח API - בינה מלאכותית (Gemini)"
            value={formData.geminiApiKey}
            onChange={handleChange}
            className="w-full p-3.5 pl-20 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-slate-700"
          />
          <a 
            href="https://aistudio.google.com/app/apikey" 
            target="_blank" 
            rel="noopener noreferrer"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors bg-slate-50 px-2"
          >
            קבל מפתח
          </a>
        </div>
        
        <button type="submit" className="w-full px-6 py-3.5 rounded-lg bg-blue-600 text-white font-medium shadow-sm hover:bg-blue-700 transition-all">
          שמור הגדרות
        </button>
        
        {status && (
          <div className={`mt-4 p-3 rounded-lg text-center font-medium text-sm ${status.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
            {status.message}
          </div>
        )}
      </form>
    </div>
  );
}