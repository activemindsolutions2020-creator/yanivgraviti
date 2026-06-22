"use client";

import { useState, useEffect } from "react";
import axios from "axios";

export default function ManualEntryModal({ isOpen, onClose, userEmail, onSuccess, initialData = null }) {
  const EXPENSE_CATEGORIES = [
    "שכר דירה", "משכנתא", "מיסי עירייה", "כלכלה (מזון)", 
    "טלפון, כבלים ואינטרנט", "טלפון נייד", "גז", "ועד בית", 
    "מים", "חשמל", "תשלום חודשי לממונה", "הוצאות רפואיות", 
    "נסיעות לעבודה", "טיפול בילדים", "תשלום מזונות", 
    "נסיעות אחרות", "אחזקת רכב", "חינוך ותרבות", "הלבשה", "הוצאות נוספות"
  ];

  const INCOME_CATEGORIES = [
    "משכורת נטו", "הכנסה מעסק", "פנסיה", "שכר דירה (הכנסה)", 
    "קצבאות ביטוח לאומי", "מזונות (הכנסה)", "הכנסות נוספות"
  ];

  const [formData, setFormData] = useState({
    type: "הוצאה", // Default
    date: "",
    vendor: "",
    category: EXPENSE_CATEGORIES[0],
    amount: "",
    currency: "ILS"
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load initialData when modal opens or initialData changes
  useEffect(() => {
    if (initialData && isOpen) {
      // Convert DD/MM/YYYY to YYYY-MM-DD for the input[type=date]
      let dateForInput = initialData.date;
      if (initialData.date && initialData.date.includes('/')) {
        const parts = initialData.date.split('/');
        if (parts.length === 3) {
          dateForInput = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
      
      const isExpense = !initialData.type || !initialData.type.includes("הכנסה");

      setFormData({
        type: isExpense ? "הוצאה" : "הכנסה",
        date: dateForInput || "",
        vendor: initialData.vendor || "",
        category: initialData.displayCategory || initialData.category || (isExpense ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]),
        amount: initialData.amount || "",
        currency: initialData.currency || "ILS"
      });
    } else if (!initialData && isOpen) {
      // Reset if opened in create mode
      setFormData({
        type: "הוצאה",
        date: "",
        vendor: "",
        category: EXPENSE_CATEGORIES[0],
        amount: "",
        currency: "ILS"
      });
      setError("");
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const currentCategories = formData.type === "הוצאה" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  // Make sure category is valid when switching types
  const handleTypeChange = (newType) => {
    setFormData(prev => ({
      ...prev,
      type: newType,
      category: newType === "הוצאה" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.date || !formData.amount) {
      setError("אנא מלא את כל שדות החובה (תאריך וסכום)");
      return;
    }

    try {
      setLoading(true);
      setError("");

      let formattedDate = formData.date;
      if (formData.date.includes("-")) {
        const parts = formData.date.split("-");
        if (parts.length === 3) {
          formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }

      const payload = {
        userEmail,
        date: formattedDate,
        vendor: formData.vendor,
        category: formData.category,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        type: formData.type === "הוצאה" ? "דיווח ידני - הוצאה" : "דיווח ידני - הכנסה"
      };

      let res;
      if (initialData && initialData.id !== undefined) {
        // Edit Mode
        res = await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/api/invoices/${initialData.id}`, payload);
      } else {
        // Create Mode
        res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/manual`, payload);
      }
      
      if (res.data.success) {
        if (!initialData) {
          setFormData({
            type: "הוצאה",
            date: "",
            vendor: "",
            category: EXPENSE_CATEGORIES[0],
            amount: "",
            currency: "ILS"
          });
        }
        onSuccess();
        onClose();
      } else {
        setError(res.data.message || "שגיאה בשמירת הנתונים");
      }
    } catch (err) {
      setError("אירעה שגיאה בתקשורת מול השרת.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all" dir="rtl">
      <div className="bg-[#edeef2] shadow-neu-flat rounded-3xl p-8 w-full max-w-lg mx-4 transform transition-all relative">
        
        <button 
          onClick={onClose}
          className="absolute top-6 left-6 w-10 h-10 rounded-full bg-[#edeef2] shadow-neu-flat flex items-center justify-center text-gray-500 hover:text-red-500 hover:shadow-neu-pressed transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <h2 className="text-2xl font-extrabold text-gray-700 mb-6">הוספת תנועה ידנית</h2>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 border border-red-100 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => handleTypeChange("הוצאה")}
              className={`flex-1 py-3 rounded-xl font-bold transition-all ${formData.type === "הוצאה" ? "bg-red-100 text-red-600 shadow-neu-pressed border border-red-200" : "bg-[#edeef2] shadow-neu-flat text-gray-500 hover:shadow-neu-pressed"}`}
            >
              הוצאה
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange("הכנסה")}
              className={`flex-1 py-3 rounded-xl font-bold transition-all ${formData.type === "הכנסה" ? "bg-green-100 text-green-600 shadow-neu-pressed border border-green-200" : "bg-[#edeef2] shadow-neu-flat text-gray-500 hover:shadow-neu-pressed"}`}
            >
              הכנסה
            </button>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">תאריך *</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-[#edeef2] rounded-xl shadow-neu-pressed text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">סכום *</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="w-full px-4 py-3 pl-12 bg-[#edeef2] rounded-xl shadow-neu-pressed text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
                <span className="absolute left-4 top-3 text-gray-500 font-bold">₪</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-600 mb-2">ספק / גוף / לקוח</label>
            <input
              type="text"
              name="vendor"
              value={formData.vendor}
              onChange={handleChange}
              placeholder="לדוגמה: דואר ישראל, לקוח פרטי..."
              className="w-full px-4 py-3 bg-[#edeef2] rounded-xl shadow-neu-pressed text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-600 mb-2">קטגוריה</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-[#edeef2] rounded-xl shadow-neu-pressed text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {currentCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-blue-500 text-white rounded-xl shadow-neu-flat font-bold hover:bg-blue-600 transition-all disabled:bg-gray-400 flex justify-center items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  שומר נתונים...
                </>
              ) : (
                initialData ? "שמור שינויים" : "שמור תנועה"
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
