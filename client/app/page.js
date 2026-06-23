"use client";
import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import ProfileForm from "../components/ProfileForm";
import Dropzone from "../components/Dropzone";
import ReportTable from "../components/ReportTable";
import DashboardAnalytics from "../components/DashboardAnalytics";
import { LogOut, ShieldCheck, FileText, CheckCircle2 } from "lucide-react";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [analysisResult, setAnalysisResult] = useState(null);
  const [dashboardData, setDashboardData] = useState([]);
  
  // We can use a small state to trigger refresh in the ReportTable when a new file is uploaded
  const [uploadKey, setUploadKey] = useState(0);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <span className="text-2xl font-bold text-slate-400 animate-pulse">טוען נתונים...</span>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div dir="rtl" className="p-10 bg-white border border-slate-200 shadow-sm rounded-3xl text-center w-full max-w-md">
          <ShieldCheck className="w-16 h-16 text-blue-600 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Smart Insolvency</h1>
          <p className="text-slate-500 mb-8">התחבר למערכת ניהול התזרים שלך</p>
          <div className="flex flex-col gap-4">
            <button
              onClick={() => signIn("google")}
              className="w-full px-8 py-3.5 bg-blue-600 shadow-sm rounded-xl font-medium text-white hover:bg-blue-700 transition-colors"
            >
              התחבר באמצעות Google
            </button>
            <button
              onClick={() => signIn()}
              className="w-full px-8 py-3.5 bg-slate-100 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-200 transition-colors text-sm"
            >
              התחברות באמצעות אימייל וסיסמה
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 mb-10">
        <nav className="flex justify-between items-center p-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-800 hidden sm:block">Smart Insolvency</h1>
          </div>
          <div className="flex items-center gap-6">
            <span className="font-medium text-slate-600">שלום, {session.user.name}</span>
            <div className="flex gap-3">
              {(session.user.role === 'Admin' || session.user.role === 'Manager') && (
                <a
                  href="/admin"
                  className="px-5 py-2 bg-blue-50 text-blue-700 rounded-lg font-medium hover:bg-blue-100 transition-colors border border-blue-200 text-sm"
                >
                  פאנל ניהול משרד
                </a>
              )}
              <button
                onClick={() => signOut()}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-medium hover:bg-slate-200 transition-colors text-sm flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                התנתק
              </button>
            </div>
          </div>
        </nav>
      </header>

      <div className="max-w-7xl mx-auto px-4 space-y-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Dropzone 
            userEmail={session.user.email} 
            onUploadSuccess={(data) => {
              setAnalysisResult(data);
              setUploadKey(prev => prev + 1); // Trigger a refresh of the history table
            }} 
          />
          <ProfileForm userEmail={session.user.email} />
        </div>

        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl min-h-[250px] flex flex-col justify-center transition-all duration-500 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
             <FileText className="w-5 h-5 text-blue-600" />
             <h2 className="text-xl font-bold text-slate-800">דוח תוצאות ניתוח בינה מלאכותית (פעיל)</h2>
          </div>
          
          <div className="p-6">
            {!analysisResult ? (
              <div className="text-center p-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                <p className="text-slate-500 text-lg">התוצאות יוצגו כאן לאחר סיום עיבוד הנתונים והמסמכים שהועלו.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  <span className="text-lg font-bold text-emerald-700">
                    זוהו בהצלחה {analysisResult.length} מסמכים/חשבוניות בקובץ
                  </span>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  {analysisResult.map((item, idx) => (
                    <div key={idx} className="p-5 rounded-xl border border-slate-200 bg-white hover:shadow-md transition-shadow grid grid-cols-2 md:grid-cols-5 gap-4 items-center">
                      <div>
                        <span className="text-xs text-slate-500 font-medium block mb-1">ספק</span>
                        <span className="font-semibold text-slate-800">{item.vendor}</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 font-medium block mb-1">סכום</span>
                        <span className="font-bold text-blue-600" dir="ltr">{item.currency === 'ILS' ? '₪' : item.currency} {item.totalAmount}</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 font-medium block mb-1">תאריך</span>
                        <span className="font-medium text-slate-700">{item.date}</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 font-medium block mb-1">קטגוריה</span>
                        <span className="inline-flex px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">{item.category}</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 font-medium block mb-1">סוג מסמך</span>
                        <span className="font-medium text-slate-700">{item.type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Analytical Dashboard */}
        <DashboardAnalytics invoices={dashboardData} />

        {/* Historical Reports Table */}
        <ReportTable key={uploadKey} userEmail={session.user.email} onDataLoaded={setDashboardData} />
        
      </div>
    </div>
  );
}