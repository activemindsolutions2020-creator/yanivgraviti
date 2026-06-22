"use client";

import { useState } from "react";
import axios from "axios";

export default function ProfileForm({ userEmail }) {
  const [formData, setFormData] = useState({
    idNumber: "",
    caseNumber: "",
    govToken: "",
    geminiApiKey: "",
  });
  const [status, setStatus] = useState(null);

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
    <div className="p-8 bg-[#edeef2] shadow-neu-flat rounded-3xl" dir="rtl">
      <form onSubmit={handleSubmit} className="space-y-6">
        <input
          type="text"
          name="idNumber"
          placeholder="תעודת זהות"
          value={formData.idNumber}
          onChange={handleChange}
          className="w-full p-4 rounded-xl bg-[#edeef2] shadow-neu-pressed outline-none text-gray-700"
        />
        <input
          type="text"
          name="caseNumber"
          placeholder="מספר תיק"
          value={formData.caseNumber}
          onChange={handleChange}
          className="w-full p-4 rounded-xl bg-[#edeef2] shadow-neu-pressed outline-none text-gray-700"
        />
        <div className="relative">
          <input
            type="password"
            name="govToken"
            placeholder="טוקן הזדהות - ממשל זמין"
            value={formData.govToken}
            onChange={handleChange}
            className="w-full p-4 rounded-xl bg-[#edeef2] shadow-neu-pressed outline-none text-gray-700"
          />
          <a 
            href="https://my.gov.il/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-500 hover:underline transition-colors bg-[#edeef2] px-2"
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
            className="w-full p-4 pl-20 rounded-xl bg-[#edeef2] shadow-neu-pressed outline-none text-gray-700"
          />
          <a 
            href="https://aistudio.google.com/app/apikey" 
            target="_blank" 
            rel="noopener noreferrer"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-500 hover:underline transition-colors bg-[#edeef2] px-2"
          >
            קבל מפתח
          </a>
        </div>
        
        <button type="submit" className="w-full px-6 py-3 rounded-xl bg-blue-500 shadow-neu-flat font-bold text-white hover:bg-blue-600 transition-all">
          שמור הגדרות
        </button>
        
        {status && (
          <p className={`mt-4 text-center font-semibold ${status.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
            {status.message}
          </p>
        )}
      </form>
    </div>
  );
}