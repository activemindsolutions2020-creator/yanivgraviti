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