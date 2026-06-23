"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { Users, LogOut, ShieldCheck, UserPlus, ShieldBan, Settings, Edit2 } from "lucide-react";
import EditUserModal from "../../components/EditUserModal";

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Create User State
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState("User");
  const [newStatus, setNewStatus] = useState("Approved");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (status === "authenticated") {
      if (session.user.role !== "Admin" && session.user.role !== "Manager") {
        router.push("/");
      } else {
        fetchUsers();
      }
    }
  }, [status, session]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/users`, {
        params: { adminEmail: session.user.email }
      });
      setUsers(res.data.data);
    } catch (err) {
      setError("שגיאה בטעינת משתמשים");
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (targetEmail, newStatus, newRole) => {
    try {
      await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${targetEmail}`, {
        adminEmail: session.user.email,
        status: newStatus,
        role: newRole
      });
      fetchUsers(); // Refresh
    } catch (err) {
      alert("שגיאה בעדכון המשתמש");
    }
  };

  const createUser = async (e) => {
    e.preventDefault();
    if (!newEmail) return;
    try {
      setIsCreating(true);
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/users`, {
        adminEmail: session.user.email,
        targetEmail: newEmail,
        targetName: newName,
        targetRole: newRole,
        targetStatus: newStatus,
        targetPassword: newPassword,
        targetPhone: newPhone
      });
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      setNewPhone("");
      fetchUsers();
    } catch (err) {
      alert("שגיאה ביצירת משתמש (אולי הוא כבר קיים?)");
    } finally {
      setIsCreating(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <span className="text-2xl font-bold text-slate-400 animate-pulse">טוען נתונים...</span>
      </div>
    );
  }

  if (!session || (session.user.role !== "Admin" && session.user.role !== "Manager")) {
    return null; // Will redirect
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-l border-slate-200 flex flex-col hidden md:flex h-screen sticky top-0">
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
            מערכת ניהול
          </h1>
          <p className="text-sm text-slate-500 mt-1">{session.user.role === 'Admin' ? 'פאנל אדמין ראשי' : 'מנהל משרד עו"ד'}</p>
        </div>
        
        <nav className="flex-1 p-4 flex flex-col gap-2">
          <a href="#" className="flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-700 font-medium rounded-lg">
            <Users className="w-5 h-5" />
            ניהול לקוחות
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 font-medium rounded-lg transition-colors">
            <Settings className="w-5 h-5" />
            הגדרות
          </a>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={() => router.push("/")}
            className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 font-medium rounded-lg transition-colors w-full"
          >
            <LogOut className="w-5 h-5" />
            חזרה לדאשבורד
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-bold text-slate-800">ניהול לקוחות</h2>
            <p className="text-slate-500 mt-2">צפה ונהל את {session.user.role === 'Admin' ? 'כל המשתמשים במערכת' : 'הלקוחות של המשרד שלך'}.</p>
          </div>
        </header>

        <div className="space-y-6 max-w-6xl">
          
          {/* Create User Card */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600" />
              הוספת לקוח חדש
            </h3>
            <form onSubmit={createUser} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
              <div className="flex flex-col gap-2">
                <label className="text-slate-600 font-medium text-sm">שם מלא</label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)} 
                  placeholder="ישראל ישראלי" 
                  className="px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-slate-600 font-medium text-sm">שם משתמש (אימייל) *</label>
                <input 
                  type="email" 
                  value={newEmail} 
                  onChange={e => setNewEmail(e.target.value)} 
                  required
                  placeholder="user@example.com" 
                  className="px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-left"
                  dir="ltr"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-slate-600 font-medium text-sm">סיסמה</label>
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  placeholder="******" 
                  className="px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-left"
                  dir="ltr"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-slate-600 font-medium text-sm">טלפון (לבוט בטלגרם)</label>
                <input 
                  type="text" 
                  value={newPhone} 
                  onChange={e => setNewPhone(e.target.value)} 
                  placeholder="0501234567" 
                  className="px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-left"
                  dir="ltr"
                />
              </div>
              {session.user.role === 'Admin' && (
                <div className="flex flex-col gap-2">
                  <label className="text-slate-600 font-medium text-sm">תפקיד</label>
                  <select 
                    value={newRole} 
                    onChange={e => setNewRole(e.target.value)} 
                    className="px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  >
                    <option value="User">לקוח רגיל (User)</option>
                    <option value="Manager">מנהל משרד עו"ד (Manager)</option>
                    <option value="Admin">מנהל ראשי (Admin)</option>
                  </select>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label className="text-slate-600 font-medium text-sm">סטטוס</label>
                <select 
                  value={newStatus} 
                  onChange={e => setNewStatus(e.target.value)} 
                  className="px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                >
                  <option value="Approved">מאושר</option>
                  <option value="Pending">ממתין</option>
                </select>
              </div>
              <button 
                type="submit" 
                disabled={isCreating}
                className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg shadow-sm hover:bg-blue-700 hover:shadow transition-all h-[42px] disabled:opacity-50"
              >
                {isCreating ? "יוצר..." : "צור"}
              </button>
            </form>
          </div>

          {/* Users Table Card */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <h3 className="text-lg font-bold text-slate-800">רשימת לקוחות</h3>
               <span className="text-sm font-medium text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-full">{users.length} משתמשים</span>
            </div>
            
            {error && <div className="p-4 bg-red-50 text-red-600 border-b border-red-100">{error}</div>}
            
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-sm">
                    <th className="p-4 font-medium border-b border-slate-200">שם מלא</th>
                    <th className="p-4 font-medium border-b border-slate-200">אימייל</th>
                    <th className="p-4 font-medium border-b border-slate-200">תפקיד</th>
                    <th className="p-4 font-medium border-b border-slate-200">סטטוס</th>
                    <th className="p-4 font-medium border-b border-slate-200">תאריך הרשמה</th>
                    <th className="p-4 font-medium border-b border-slate-200 text-center">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-4 font-medium text-slate-800">{u.name}</td>
                      <td className="p-4 text-slate-500" dir="ltr">{u.email}</td>
                      <td className="p-4">
                        {session.user.role === 'Admin' && u.email !== session.user.email ? (
                          <select 
                            value={u.role}
                            onChange={(e) => updateUser(u.email, u.status, e.target.value)}
                            className="bg-transparent border border-slate-200 rounded-md px-2 py-1 text-sm text-slate-700 outline-none focus:border-blue-500"
                          >
                            <option value="User">User</option>
                            <option value="Manager">Manager</option>
                            <option value="Admin">Admin</option>
                          </select>
                        ) : (
                          <span className="font-medium text-slate-600 text-sm bg-slate-100 px-2.5 py-1 rounded-md">{u.role}</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center w-fit gap-1.5 ${
                          u.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          u.status === 'Frozen' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {u.status === 'Approved' && <ShieldCheck className="w-3.5 h-3.5" />}
                          {u.status === 'Frozen' && <ShieldBan className="w-3.5 h-3.5" />}
                          {u.status === 'Approved' ? 'מאושר' :
                           u.status === 'Frozen' ? 'מוקפא' : 'ממתין'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500 text-sm">{new Date(u.createdAt).toLocaleDateString('he-IL')}</td>
                      <td className="p-4 flex gap-2 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => { setEditingUser(u); setIsEditModalOpen(true); }}
                          className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-xs font-semibold hover:bg-blue-100 transition-colors flex items-center gap-1"
                          title="ערוך משתמש"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          ערוך
                        </button>
                        {u.status !== 'Approved' && (
                          <button 
                            onClick={() => updateUser(u.email, 'Approved', u.role)}
                            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-xs font-semibold hover:bg-emerald-100 transition-colors"
                          >
                            אשר
                          </button>
                        )}
                        {u.status !== 'Frozen' && u.email !== session.user.email && (
                          <button 
                            onClick={() => updateUser(u.email, 'Frozen', u.role)}
                            className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md text-xs font-semibold hover:bg-rose-100 transition-colors"
                          >
                            הקפא
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-500 font-medium">אין משתמשים במערכת</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <EditUserModal 
        isOpen={isEditModalOpen} 
        onClose={() => { setIsEditModalOpen(false); setEditingUser(null); }} 
        user={editingUser} 
        adminEmail={session?.user?.email} 
        isAdmin={session?.user?.role === 'Admin'}
        onSuccess={fetchUsers} 
      />
    </div>
  );
}
