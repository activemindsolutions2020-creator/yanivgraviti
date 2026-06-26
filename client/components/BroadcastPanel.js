"use client";
import { useState } from "react";
import axios from "axios";
import { Send, CheckSquare, Square, Users } from "lucide-react";

export default function BroadcastPanel({ users, adminEmail }) {
  const [message, setMessage] = useState("");
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [result, setResult] = useState(null);

  // Filter users to include all approved users
  const eligibleUsers = users.filter(u => u.status === 'Approved');

  const toggleSelection = (email) => {
    if (selectedEmails.includes(email)) {
      setSelectedEmails(selectedEmails.filter(e => e !== email));
    } else {
      setSelectedEmails([...selectedEmails, email]);
    }
  };

  const handleSelectAll = () => {
    if (selectedEmails.length === eligibleUsers.length) {
      setSelectedEmails([]);
    } else {
      setSelectedEmails(eligibleUsers.map(u => u.email));
    }
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (selectedEmails.length === 0 || !message.trim()) return;

    setIsBroadcasting(true);
    setResult(null);

    try {
      const chatIds = selectedEmails
        .map(email => eligibleUsers.find(u => u.email === email)?.telegramChatId)
        .filter(id => id);

      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/broadcast`, {
        adminEmail,
        chatIds,
        message
      });

      setResult({ type: 'success', text: "ההודעות נשלחו בהצלחה!" });
      setMessage("");
      setSelectedEmails([]);
    } catch (err) {
      console.error(err);
      setResult({ type: 'error', text: "אירעה שגיאה בשליחת ההודעות." });
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 mt-6">
      <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
        <Send className="w-5 h-5 text-blue-600" />
        שליחת הודעת וואטסאפ/טלגרם יזומה (Broadcast)
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 border border-slate-200 rounded-xl overflow-hidden flex flex-col max-h-[300px]">
          <div className="bg-slate-50 border-b border-slate-200 p-3 flex justify-between items-center">
            <span className="font-semibold text-sm text-slate-700">בחר נמענים</span>
            <button 
              onClick={handleSelectAll} 
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              {selectedEmails.length === eligibleUsers.length ? "נקה בחירה" : "בחר הכל"}
            </button>
          </div>
          <div className="overflow-y-auto flex-1 p-2">
            {eligibleUsers.length === 0 ? (
              <div className="text-center text-sm text-slate-400 p-4">אין משתמשים המחוברים לבוט</div>
            ) : (
              eligibleUsers.map(u => (
                <div 
                  key={u.email} 
                  onClick={() => toggleSelection(u.email)}
                  className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                >
                  {selectedEmails.includes(u.email) ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-300" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      {u.name}
                      {!u.telegramChatId && (
                        <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-200">לא מחובר לבוט</span>
                      )}
                    </span>
                    <span className="text-xs text-slate-500">{u.email}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="md:col-span-2 flex flex-col gap-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="כתוב את ההודעה שתישלח ללקוחות..."
            className="w-full flex-1 min-h-[150px] p-4 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none text-slate-700"
          />
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-500">
              נבחרו {selectedEmails.length} לקוחות
            </span>
            <button
              onClick={handleBroadcast}
              disabled={isBroadcasting || selectedEmails.length === 0 || !message.trim()}
              className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {isBroadcasting ? "שולח..." : "שלח הודעה כעת"}
              <Send className="w-4 h-4" />
            </button>
          </div>
          {result && (
            <div className={`p-3 rounded-lg text-sm font-medium ${result.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {result.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
