"use client";
import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import ProfileForm from "../components/ProfileForm";
import Dropzone from "../components/Dropzone";
import ReportTable from "../components/ReportTable";
import DashboardAnalytics from "../components/DashboardAnalytics";
import MissingReceipts from "../components/MissingReceipts";
import { LogOut, ShieldCheck, FileText, CheckCircle2, Settings, Mail } from "lucide-react";
import axios from "axios";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [analysisResult, setAnalysisResult] = useState(null);
  const [dashboardData, setDashboardData] = useState([]);
  const [showProfile, setShowProfile] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStatus, setForgotStatus] = useState(null);
  
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
            <button 
              onClick={() => setShowForgotPassword(true)}
              className="mt-2 text-sm text-slate-500 hover:text-blue-600 font-medium transition-colors"
            >
              שכחת סיסמה?
            </button>
          </div>
        </div>

        {/* Forgot Password Modal */}
        {showForgotPassword && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div dir="rtl" className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
              <button 
                onClick={() => { setShowForgotPassword(false); setForgotStatus(null); setForgotEmail(""); }}
                className="absolute top-4 left-4 text-slate-400 hover:text-slate-600"
              >
                ✕ סגור
              </button>
              
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">איפוס סיסמה</h2>
              <p className="text-slate-500 text-sm mb-6">הזן את כתובת האימייל שלך ונשלח אליך סיסמה זמנית חדשה.</p>

              <form onSubmit={async (e) => {
                e.preventDefault();
                setForgotStatus({ type: 'loading', message: 'שולח...' });
                try {
                  const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/users/forgot-password`, { email: forgotEmail });
                  if (res.data.success) {
                    setForgotStatus({ type: 'success', message: 'אם המייל קיים במערכת, סיסמה זמנית נשלחה אליו.' });
                  } else {
                    setForgotStatus({ type: 'error', message: res.data.message || 'שגיאה באיפוס' });
                  }
                } catch (err) {
                  setForgotStatus({ type: 'error', message: 'שגיאת שרת. אנא נסה שוב מאוחר יותר.' });
                }
              }}>
                <input 
                  type="email" 
                  required
                  placeholder="אימייל" 
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-blue-500 focus:bg-white transition-colors mb-4 text-left"
                  dir="ltr"
                />
                
                <button 
                  type="submit"
                  disabled={forgotStatus?.type === 'loading'}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-all disabled:opacity-70"
                >
                  {forgotStatus?.type === 'loading' ? 'מעבד...' : 'שלח סיסמה זמנית'}
                </button>

                {forgotStatus && forgotStatus.type !== 'loading' && (
                  <div className={`mt-4 p-3 rounded-lg text-center font-medium text-sm ${forgotStatus.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                    {forgotStatus.message}
                  </div>
                )}
              </form>
            </div>
          </div>
        )}
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
        <div className="flex justify-end">
          <button 
             onClick={() => setShowProfile(!showProfile)}
             className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm font-medium"
          >
            <Settings className="w-4 h-4" />
            הגדרות פרופיל ובוט
          </button>
        </div>

        {showProfile && (
           <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 relative animate-in fade-in slide-in-from-top-4 duration-300">
              <button 
                 onClick={() => setShowProfile(false)}
                 className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 text-sm font-medium"
              >
                 סגור ✕
              </button>
              <h2 className="text-xl font-bold text-slate-800 mb-6 border-b border-slate-100 pb-4">הגדרות אישיות וחיבור לטלגרם</h2>
              <div className="max-w-2xl">
                 <ProfileForm userEmail={session.user.email} />
              </div>
           </div>
        )}

        <div className="grid grid-cols-1 gap-8">
          <Dropzone 
            userEmail={session.user.email} 
            onUploadSuccess={(data) => {
              setAnalysisResult(data);
              setUploadKey(prev => prev + 1); // Trigger a refresh of the history table
            }} 
          />
        </div>

        {analysisResult && (
          <div className="bg-white border border-blue-200 shadow-sm rounded-xl flex flex-col justify-center transition-all duration-500 overflow-hidden mb-8">
            <div className="p-4 border-b border-slate-100 bg-blue-50/30 flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <FileText className="w-5 h-5 text-blue-600" />
                 <h2 className="text-lg font-bold text-slate-800">תוצאות סריקת המסמך</h2>
               </div>
               <button 
                 onClick={() => setAnalysisResult(null)}
                 className="text-sm font-medium text-slate-400 hover:text-slate-600 px-2 py-1 bg-slate-100 rounded-md transition-colors"
               >
                 סגור ✕
               </button>
            </div>
            
            <div className="p-4">
              <div className="space-y-4">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="text-md font-bold text-emerald-700">
                    זוהו בהצלחה {analysisResult.length} מסמכים בקובץ שהועלה
                  </span>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  {analysisResult.map((item, idx) => (
                    <div key={idx} className="p-4 rounded-lg border border-slate-200 bg-white hover:shadow-sm transition-shadow grid grid-cols-2 md:grid-cols-5 gap-3 items-center text-sm">
                      <div>
                        <span className="text-xs text-slate-400 font-medium block mb-0.5">ספק</span>
                        <span className="font-semibold text-slate-800 truncate block">{item.vendor}</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 font-medium block mb-0.5">סכום</span>
                        <span className="font-bold text-blue-600" dir="ltr">{item.currency === 'ILS' ? '₪' : item.currency}{item.totalAmount}</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 font-medium block mb-0.5">תאריך</span>
                        <span className="font-medium text-slate-700">{item.date}</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 font-medium block mb-0.5">קטגוריה</span>
                        <span className="inline-flex px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold truncate max-w-full">{item.category}</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 font-medium block mb-0.5">סוג מסמך</span>
                        <span className="font-medium text-slate-700 truncate block">{item.type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Analytical Dashboard */}
        <DashboardAnalytics invoices={dashboardData} userEmail={session.user.email} />

        {/* Missing Receipts Report */}
        <MissingReceipts invoices={dashboardData} />

        {/* Historical Reports Table */}
        <ReportTable key={uploadKey} userEmail={session.user.email} onDataLoaded={setDashboardData} />
        
      </div>
    </div>
  );
}