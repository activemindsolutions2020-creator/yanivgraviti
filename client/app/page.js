"use client";
import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import ProfileForm from "../components/ProfileForm";
import Dropzone from "../components/Dropzone";
import ReportTable from "../components/ReportTable";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [analysisResult, setAnalysisResult] = useState(null);
  
  // We can use a small state to trigger refresh in the ReportTable when a new file is uploaded
  const [uploadKey, setUploadKey] = useState(0);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#edeef2]">
        <span className="text-2xl font-bold text-gray-500 animate-pulse">טוען...</span>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#edeef2]">
        <div dir="rtl" className="p-10 shadow-neu-flat rounded-3xl text-center w-full max-w-md">
          <h1 className="text-3xl font-bold text-gray-700 mb-8">Smart Insolvency AI</h1>
          <div className="flex flex-col gap-4">
            <button
              onClick={() => signIn("google")}
              className="w-full px-8 py-4 bg-[#edeef2] shadow-neu-flat rounded-xl font-bold text-gray-700 hover:shadow-neu-pressed transition-all"
            >
              התחבר באמצעות Google
            </button>
            <button
              onClick={() => signIn()}
              className="w-full px-8 py-4 bg-[#edeef2] shadow-neu-flat rounded-xl font-bold text-gray-500 hover:shadow-neu-pressed transition-all text-sm"
            >
              התחברות חלופית (שם משתמש וסיסמה)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#edeef2] p-8 pb-20">
      <nav className="flex flex-col md:flex-row justify-between items-center mb-10 p-6 shadow-neu-flat rounded-2xl max-w-6xl mx-auto gap-4 md:gap-0">
        <h1 className="text-2xl font-bold text-gray-700">שלום, {session.user.name}</h1>
        <div className="flex gap-4">
          {session.user.role === 'Admin' && (
            <a
              href="/admin"
              className="px-8 py-3 bg-blue-100 shadow-neu-flat rounded-xl font-bold text-blue-700 hover:shadow-neu-pressed transition-all"
            >
              פאנל ניהול מנהל
            </a>
          )}
          <button
            onClick={() => signOut()}
            className="px-8 py-3 bg-[#edeef2] shadow-neu-flat rounded-xl font-bold text-gray-700 hover:shadow-neu-pressed transition-all"
          >
            התנתק
          </button>
        </div>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-6xl mx-auto">
        <Dropzone 
          userEmail={session.user.email} 
          onUploadSuccess={(data) => {
            setAnalysisResult(data);
            setUploadKey(prev => prev + 1); // Trigger a refresh of the history table
          }} 
        />
        <ProfileForm userEmail={session.user.email} />
      </div>

      <div className="mt-10 max-w-6xl mx-auto">
        <div className="p-8 bg-[#edeef2] shadow-neu-flat rounded-3xl min-h-[250px] flex flex-col justify-center transition-all duration-500 mb-10">
          <h2 className="text-2xl font-bold text-gray-700 mb-6">דוח תוצאות ניתוח בינה מלאכותית</h2>
          
          {!analysisResult ? (
            <div className="text-center p-10 border-2 border-dashed border-gray-300 rounded-2xl">
              <p className="text-gray-500 text-lg">התוצאות יוצגו כאן לאחר סיום עיבוד הנתונים והמסמכים שהועלו.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="p-4 bg-green-50/50 border border-green-200 rounded-xl">
                <span className="text-lg font-bold text-green-700 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  זוהו בהצלחה {analysisResult.length} מסמכים/חשבוניות בקובץ
                </span>
              </div>
              
              <div className="grid grid-cols-1 gap-6">
                {analysisResult.map((item, idx) => (
                  <div key={idx} className="p-6 rounded-2xl bg-[#edeef2] shadow-neu-pressed grid grid-cols-2 md:grid-cols-5 gap-4 items-center">
                    <div>
                      <span className="text-xs text-gray-500 font-semibold block mb-1">ספק</span>
                      <span className="font-bold text-gray-800">{item.vendor}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 font-semibold block mb-1">סכום</span>
                      <span className="font-bold text-blue-600" dir="ltr">{item.currency === 'ILS' ? '₪' : item.currency} {item.totalAmount}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 font-semibold block mb-1">תאריך</span>
                      <span className="font-bold text-gray-800">{item.date}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 font-semibold block mb-1">קטגוריה</span>
                      <span className="font-bold text-gray-800">{item.category}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 font-semibold block mb-1">סוג מסמך</span>
                      <span className="font-bold text-gray-800">{item.type}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Historical Reports Table */}
        <ReportTable key={uploadKey} userEmail={session.user.email} />
        
      </div>
    </div>
  );
}