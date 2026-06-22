"use client";

import { useState, useRef } from "react";
import axios from "axios";

export default function Dropzone({ userEmail, onUploadSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("invoiceFile", file);
    formData.append("userEmail", userEmail);

    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/analyze`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      
      if (res.data.success) {
        if (onUploadSuccess) onUploadSuccess(res.data.data);
      } else {
        setError(res.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Upload failed");
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="p-8 bg-[#edeef2] shadow-neu-flat rounded-3xl space-y-6" dir="rtl">
      <h2 className="text-xl font-bold text-gray-700 mb-2">העלאת מסמך</h2>
      <div 
        onClick={() => fileInputRef.current?.click()}
        className="flex flex-col items-center justify-center w-full h-48 rounded-2xl bg-[#edeef2] shadow-neu-pressed cursor-pointer hover:scale-[0.98] transition-transform border-2 border-dashed border-gray-300 hover:border-blue-400"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <span className="text-gray-600 font-bold text-lg">לחץ או גרור חשבונית לכאן (PDF/תמונה)</span>
        <input 
          type="file" 
          className="hidden" 
          onChange={handleFileSelect} 
          accept="image/*,application/pdf"
          disabled={loading}
          ref={fileInputRef}
        />
      </div>

      {loading && (
        <div className="p-6 rounded-xl bg-[#edeef2] shadow-neu-pressed text-center text-blue-600 font-bold animate-pulse">
          סורק ומנתח באמצעות בינה מלאכותית...
        </div>
      )}

      {error && (
        <div className="p-6 rounded-xl bg-[#edeef2] shadow-neu-pressed text-center text-red-500 font-bold">
          {error}
        </div>
      )}
    </div>
  );
}