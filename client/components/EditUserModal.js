"use client";

import { useState, useEffect } from "react";
import axios from "axios";

export default function EditUserModal({ isOpen, onClose, user, adminEmail, onSuccess, isAdmin }) {
  const [formData, setFormData] = useState({
    name: "",
    password: "",
    phone: "",
    role: "User",
    status: "Approved"
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user && isOpen) {
      setFormData({
        name: user.name || "",
        password: "", // Always start empty, only update if typed
        phone: user.phone || "",
        role: user.role || "User",
        status: user.status || "Approved"
      });
      setError("");
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");

      const payload = {
        adminEmail,
        name: formData.name,
        role: formData.role,
        status: formData.status,
        phone: formData.phone,
      };

      if (formData.password.trim() !== "") {
        payload.password = formData.password;
      }

      const res = await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${user.email}`, payload);
      
      if (res.data.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.data.message || "שגיאה בעדכון המשתמש");
      }
    } catch (err) {
      setError("אירעה שגיאה בתקשורת מול השרת.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("האם אתה בטוח שברצונך למחוק משתמש זה לחלוטין? פעולה זו אינה הפיכה!")) return;
    try {
      setLoading(true);
      setError("");
      
      const res = await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${user.email}`, {
        data: { adminEmail }
      });
      
      if (res.data.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.data.message || "שגיאה במחיקת המשתמש");
      }
    } catch (err) {
      setError(err.response?.data?.message || "אירעה שגיאה במחיקת המשתמש");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm transition-all" dir="rtl">
      <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-8 w-full max-w-md mx-4 relative">
        
        <button 
          onClick={onClose}
          className="absolute top-6 left-6 w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <h2 className="text-2xl font-bold text-slate-800 mb-2">עריכת משתמש</h2>
        <p className="text-slate-500 mb-6 text-sm" dir="ltr" style={{ textAlign: 'right' }}>{user.email}</p>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-50 text-red-600 border border-red-100 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">שם מלא</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">סיסמה חדשה (השאר ריק כדי לא לשנות)</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="******"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-left"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">מספר טלפון (עבור הבוט בטלגרם)</label>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="0501234567"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-left"
              dir="ltr"
            />
          </div>

          {isAdmin && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">תפקיד</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="User">לקוח רגיל (User)</option>
                <option value="Manager">מנהל משרד עו"ד (Manager)</option>
                <option value="Admin">מנהל ראשי (Admin)</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">סטטוס</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Approved">מאושר</option>
              <option value="Pending">ממתין</option>
              <option value="Frozen">מוקפא</option>
            </select>
          </div>

          <div className="pt-4 flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3.5 bg-blue-600 text-white rounded-lg shadow-sm font-medium hover:bg-blue-700 transition-all disabled:bg-slate-400 flex justify-center items-center gap-2"
            >
              {loading ? "שומר..." : "שמור שינויים"}
            </button>
            {isAdmin && (
              <button
                type="button"
                disabled={loading}
                onClick={handleDelete}
                className="px-6 py-3.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg shadow-sm font-medium hover:bg-rose-100 transition-all disabled:opacity-50"
              >
                מחק
              </button>
            )}
          </div>

        </form>
      </div>
    </div>
  );
}
