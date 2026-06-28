"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { Users, FileText, TrendingDown, TrendingUp, Activity } from "lucide-react";

export default function AdminAnalytics({ adminEmail }) {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalInvoices: 0,
    totalExpenses: 0,
    totalIncomes: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (adminEmail) {
      fetchStats();
    }
  }, [adminEmail]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/users/stats`, {
        params: { adminEmail }
      });
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 p-6 rounded-2xl animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-slate-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const cards = [
    {
      title: "סה״כ משתמשים (פעילים)",
      value: stats.totalUsers,
      icon: <Users className="w-8 h-8 text-blue-400" />,
      bg: "bg-blue-500/10",
      border: "border-blue-500/20"
    },
    {
      title: "סה״כ מסמכים שנסרקו",
      value: stats.totalInvoices.toLocaleString('he-IL'),
      icon: <FileText className="w-8 h-8 text-purple-400" />,
      bg: "bg-purple-500/10",
      border: "border-purple-500/20"
    },
    {
      title: "סה״כ הוצאות (מערכת)",
      value: formatCurrency(stats.totalExpenses),
      icon: <TrendingDown className="w-8 h-8 text-red-400" />,
      bg: "bg-red-500/10",
      border: "border-red-500/20"
    },
    {
      title: "סה״כ הכנסות (מערכת)",
      value: formatCurrency(stats.totalIncomes),
      icon: <TrendingUp className="w-8 h-8 text-emerald-400" />,
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20"
    }
  ];

  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-6">
        <Activity className="w-6 h-6 text-indigo-600" />
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">מבט על (Analytics)</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, idx) => (
          <div 
            key={idx} 
            className={`bg-white border ${card.border} ${card.bg} p-6 rounded-2xl flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-1`}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-slate-600 text-sm font-semibold">{card.title}</h3>
              <div className="p-2 rounded-xl bg-white shadow-sm border border-slate-100">
                {card.icon}
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800 tracking-tight">{card.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
