"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import axios from "axios";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (status === "authenticated") {
      if (session.user.role !== "Admin") {
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

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#edeef2]">
        <span className="text-2xl font-bold text-gray-500 animate-pulse">טוען נתונים...</span>
      </div>
    );
  }

  if (!session || session.user.role !== "Admin") {
    return null; // Will redirect
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#edeef2] p-8 pb-20">
      <nav className="flex justify-between items-center mb-10 p-6 shadow-neu-flat rounded-2xl max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-700">פאנל ניהול - משתמשים</h1>
        <button
          onClick={() => router.push("/")}
          className="px-8 py-3 bg-[#edeef2] shadow-neu-flat rounded-xl font-bold text-gray-700 hover:shadow-neu-pressed transition-all"
        >
          חזרה לדאשבורד
        </button>
      </nav>

      <div className="max-w-6xl mx-auto">
        <div className="p-8 bg-[#edeef2] shadow-neu-flat rounded-3xl">
          {error && <div className="text-red-500 mb-4">{error}</div>}
          
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="p-4 text-gray-600">שם משתמש</th>
                  <th className="p-4 text-gray-600">אימייל</th>
                  <th className="p-4 text-gray-600">תפקיד</th>
                  <th className="p-4 text-gray-600">סטטוס</th>
                  <th className="p-4 text-gray-600">תאריך הרשמה</th>
                  <th className="p-4 text-gray-600 text-center">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, idx) => (
                  <tr key={idx} className="border-b border-gray-200 hover:bg-gray-100/50 transition-colors">
                    <td className="p-4 font-bold text-gray-700">{u.name}</td>
                    <td className="p-4 text-gray-600" dir="ltr">{u.email}</td>
                    <td className="p-4">
                      <select 
                        value={u.role}
                        onChange={(e) => updateUser(u.email, u.status, e.target.value)}
                        className="bg-transparent border border-gray-300 rounded px-2 py-1 outline-none focus:border-blue-500"
                        disabled={u.email === session.user.email} // Prevent changing own role easily
                      >
                        <option value="User">User</option>
                        <option value="Admin">Admin</option>
                      </select>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        u.status === 'Approved' ? 'bg-green-100 text-green-700' :
                        u.status === 'Frozen' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {u.status === 'Approved' ? 'מאושר' :
                         u.status === 'Frozen' ? 'מוקפא' : 'ממתין לאישור'}
                      </span>
                    </td>
                    <td className="p-4 text-gray-500 text-sm">{new Date(u.createdAt).toLocaleDateString('he-IL')}</td>
                    <td className="p-4 flex gap-2 justify-center">
                      {u.status !== 'Approved' && (
                        <button 
                          onClick={() => updateUser(u.email, 'Approved', u.role)}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-bold shadow-md hover:bg-green-600 transition-colors"
                        >
                          אשר
                        </button>
                      )}
                      {u.status !== 'Frozen' && u.email !== session.user.email && (
                        <button 
                          onClick={() => updateUser(u.email, 'Frozen', u.role)}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-bold shadow-md hover:bg-red-600 transition-colors"
                        >
                          הקפא
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-gray-500">אין משתמשים במערכת</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
