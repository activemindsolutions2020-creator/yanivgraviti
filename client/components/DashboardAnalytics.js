"use client";

import React, { useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
];

export default function DashboardAnalytics({ invoices }) {
  const { summary, expensesByCategory, monthlyFlow } = useMemo(() => {
    let totalIncome = 0;
    let totalExpenses = 0;
    const categoryMap = {};
    const monthMap = {};

    invoices.forEach(inv => {
      // Exclude duplicates and empty amounts
      if (inv.status?.trim() === 'Duplicate' || !inv.amount) return;

      const isIncome = inv.type && inv.type.includes("הכנסה");
      const amount = parseFloat(inv.amount) || 0;

      // Extract month-year (e.g., "05/2026")
      const dateStr = inv.date || "Unknown";
      let monthYearStr = "Unknown";
      
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          const m = parts[1].padStart(2, '0');
          let y = parts[2];
          if (y.length === 2) y = `20${y}`;
          monthYearStr = `${m}/${y}`;
        }
      }

      if (!monthMap[monthYearStr]) {
        monthMap[monthYearStr] = { month: monthYearStr, income: 0, expenses: 0 };
      }

      if (isIncome) {
        totalIncome += amount;
        monthMap[monthYearStr].income += amount;
      } else {
        totalExpenses += amount;
        monthMap[monthYearStr].expenses += amount;
        
        // Track expenses by category
        const cat = inv.category || "אחר";
        categoryMap[cat] = (categoryMap[cat] || 0) + amount;
      }
    });

    const expensesByCategoryData = Object.keys(categoryMap)
      .map(key => ({ name: key, value: categoryMap[key] }))
      .sort((a, b) => b.value - a.value);

    const monthlyFlowData = Object.values(monthMap)
      .filter(m => m.month !== "Unknown")
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      summary: { totalIncome, totalExpenses, balance: totalIncome - totalExpenses },
      expensesByCategory: expensesByCategoryData,
      monthlyFlow: monthlyFlowData
    };
  }, [invoices]);

  if (!invoices || invoices.length === 0) return null;

  return (
    <div dir="rtl" className="mb-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-slate-800">דשבורד אנליטי</h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-sm text-slate-500 font-medium mb-1">סך הכנסות</p>
            <h3 className="text-3xl font-bold text-emerald-600">₪{summary.totalIncome.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
          </div>
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500">
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-sm text-slate-500 font-medium mb-1">סך הוצאות</p>
            <h3 className="text-3xl font-bold text-rose-600">₪{summary.totalExpenses.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
          </div>
          <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-500">
            <TrendingDown size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-sm text-slate-500 font-medium mb-1">יתרה</p>
            <h3 className={`text-3xl font-bold ${summary.balance >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
              ₪{summary.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}
            </h3>
          </div>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${summary.balance >= 0 ? 'bg-blue-50 text-blue-500' : 'bg-rose-50 text-rose-500'}`}>
            <DollarSign size={24} />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-96">
          <h3 className="text-lg font-bold text-slate-700 mb-6">התפלגות הוצאות לפי קטגוריה</h3>
          {expensesByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expensesByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={false}
                >
                  {expensesByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `₪${value.toLocaleString()}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">אין נתוני הוצאות להצגה</div>
          )}
        </div>

        {/* Bar Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-96">
          <h3 className="text-lg font-bold text-slate-700 mb-6">תזרים חודשי (הכנסות מול הוצאות)</h3>
          {monthlyFlow.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyFlow} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{fill: '#64748b'}} axisLine={false} tickLine={false} />
                <YAxis tick={{fill: '#64748b'}} axisLine={false} tickLine={false} tickFormatter={(value) => `₪${value}`} />
                <Tooltip cursor={{fill: '#f8fafc'}} formatter={(value) => `₪${value.toLocaleString()}`} />
                <Legend />
                <Bar dataKey="income" name="הכנסות" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
                <Bar dataKey="expenses" name="הוצאות" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">אין נתונים חודשיים להצגה</div>
          )}
        </div>
      </div>
    </div>
  );
}
