"use client";
import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ShieldAlert, ArrowRight, Lock, Key } from "lucide-react";
import axios from "axios";

function ForceChangeForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email");

  const [tempPassword, setTempPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setStatus({ type: "error", message: "הסיסמאות החדשות אינן תואמות" });
      return;
    }
    if (newPassword.length < 6) {
      setStatus({ type: "error", message: "סיסמה חדשה חייבת להכיל לפחות 6 תווים" });
      return;
    }

    setStatus({ type: "loading", message: "מעדכן סיסמה..." });
    
    try {
      const res = await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/api/users/password`, {
        email,
        oldPassword: tempPassword,
        newPassword
      });

      if (res.data.success) {
        setStatus({ type: "success", message: "הסיסמה עודכנה בהצלחה! מעביר אותך להתחברות..." });
        setTimeout(() => {
          router.push("/");
        }, 3000);
      } else {
        setStatus({ type: "error", message: res.data.message || "שגיאה בעדכון הסיסמה" });
      }
    } catch (err) {
      setStatus({ 
        type: "error", 
        message: err.response?.data?.message || "סיסמה זמנית שגויה. אנא נסה שוב." 
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="relative">
        <Lock className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" />
        <input 
          type="text" 
          required
          placeholder="סיסמה זמנית (מהמייל)" 
          value={tempPassword}
          onChange={(e) => setTempPassword(e.target.value)}
          className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
        />
      </div>

      <div className="relative">
        <Key className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" />
        <input 
          type="password" 
          required
          placeholder="סיסמה קבועה חדשה" 
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
        />
      </div>

      <div className="relative">
        <Key className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" />
        <input 
          type="password" 
          required
          placeholder="אימות סיסמה חדשה" 
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
        />
      </div>

      <button 
        type="submit" 
        disabled={status?.type === "loading"}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-all shadow-md shadow-blue-500/20 disabled:opacity-70"
      >
        {status?.type === "loading" ? "מעדכן..." : "עדכן סיסמה והתחבר"}
      </button>

      {status && status.type !== "loading" && (
        <div className={`mt-4 p-3 rounded-lg text-center font-medium text-sm ${status.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
          {status.message}
        </div>
      )}
    </form>
  );
}

export default function ForceChangePassword() {
  const router = useRouter();

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        <div className="p-8 text-center bg-amber-50 border-b border-amber-100">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">אבטחת חשבון</h1>
          <p className="text-slate-600">התחברת למערכת באמצעות סיסמה זמנית. מטעמי אבטחה, עליך לבחור סיסמה קבועה כעת.</p>
        </div>
        
        <div className="p-8">
          <Suspense fallback={<div className="text-center p-4">טוען...</div>}>
            <ForceChangeForm />
          </Suspense>
          
          <button 
            onClick={() => router.push("/")}
            className="w-full mt-6 flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            חזרה לדף ההתחברות <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
