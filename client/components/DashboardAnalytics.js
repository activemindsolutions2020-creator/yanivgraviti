"use client";

import React, { useMemo, useState, useEffect } from 'react';
import axios from 'axios';
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Target, AlertTriangle } from 'lucide-react';

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
];

export default function DashboardAnalytics({ invoices, userEmail }) {
  const [monthlyBudget, setMonthlyBudget] = useState(0);

  useEffect(() => {
    if (!userEmail) return;
    axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/profile?userEmail=${userEmail}`)
      .then(res => {
        if (res.data.success && res.data.data?.monthlyBudget) {
          setMonthlyBudget(Number(res.data.data.monthlyBudget));
        }
      })
      .catch(err => console.error("Error fetching profile", err));
  }, [userEmail]);

  const { summary, expensesByCategory, monthlyFlow, currentMonthExpenses } = useMemo(() => {
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

    const now = new Date();
    const currentMonthStr = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    const currentExpenses = monthMap[currentMonthStr]?.expenses || 0;

    return {
      summary: { totalIncome, totalExpenses, balance: totalIncome - totalExpenses },
      expensesByCategory: expensesByCategoryData,
      monthlyFlow: monthlyFlowData,
      currentMonthExpenses: currentExpenses
    };
  }, [invoices]);

  if (!invoices || invoices.length === 0) return null;

  // Calculate budget utilization
  const budgetPercentage = monthlyBudget > 0 ? Math.min((currentMonthExpenses / monthlyBudget) * 100, 100) : 0;
  
  let progressColor = "bg-emerald-500";
  let statusText = "תקציב תקין";
  let statusIcon = <Target className="w-5 h-5 text-emerald-500" />;
  
  if (budgetPercentage >= 90) {
    progressColor = "bg-rose-500";
    statusText = "חריגה מהתקציב!";
    statusIcon = <AlertTriangle className="w-5 h-5 text-rose-500" />;
  } else if (budgetPercentage >= 75) {
    progressColor = "bg-amber-500";
    statusText = "מתקרב לגבול התקציב";
    statusIcon = <AlertTriangle className="w-5 h-5 text-amber-500" />;
  }

  return (
    <div dir="rtl" className="mb-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-slate-800">דשבורד אנליטי</h2>
      </div>

      {/* Budget Heat Map */}
      {monthlyBudget > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
          <div className="flex justify-between items-end mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-1">
                {statusIcon}
                ניצול תקציב (החודש הנוכחי)
              </h3>
              <p className="text-sm text-slate-500">{statusText}</p>
            </div>
            <div className="text-left">
              <span className="text-2xl font-bold text-slate-800">₪{currentMonthExpenses.toLocaleString()}</span>
              <span className="text-slate-400 mx-1">/</span>
              <span className="text-lg text-slate-500">₪{monthlyBudget.toLocaleString()}</span>
            </div>
          </div>
          
          <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden relative">
            <div 
              className={`h-4 rounded-full transition-all duration-1000 ${progressColor}`} 
              style={{ width: `${budgetPercentage}%` }}
            ></div>
          </div>
          
          <div className="flex justify-between mt-2 text-xs font-medium text-slate-400">
            <span>0%</span>
            <span>{budgetPercentage.toFixed(1)}% נוצל</span>
            <span>100%</span>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-sm text-slate-500 font-medium mb-1">סך הכנסות (כללי)</p>
            <h3 className="text-3xl font-bold text-emerald-600">₪{summary.totalIncome.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
          </div>
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500">
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-sm text-slate-500 font-medium mb-1">סך הוצאות (כללי)</p>
            <h3 className="text-3xl font-bold text-rose-600">₪{summary.totalExpenses.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
          </div>
          <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-500">
            <TrendingDown size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-sm text-slate-500 font-medium mb-1">יתרה נטו</p>
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
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-96 flex flex-col">
          <h3 className="text-lg font-bold text-slate-700 mb-2">התפלגות הוצאות לפי קטגוריה</h3>
          <p className="text-sm text-slate-400 mb-6">מציג את מוקדי ההוצאה המרכזיים</p>
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
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-96 flex flex-col">
          <h3 className="text-lg font-bold text-slate-700 mb-2">תזרים חודשי</h3>
          <p className="text-sm text-slate-400 mb-6">השוואת הכנסות מול הוצאות לאורך זמן</p>
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
