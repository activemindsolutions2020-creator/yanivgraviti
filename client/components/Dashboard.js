import React from 'react';
import ProfileForm from './ProfileForm';
import Dropzone from './Dropzone';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">לוח בקרה (Dashboard)</h1>
          <p className="text-gray-600 mt-2">נהל את הפרופיל שלך, העלה מסמכים וצפה בתוצאות הניתוח.</p>
        </header>

        {/* Main Grid for Profile and Dropzone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">הגדרות פרופיל</h2>
            <ProfileForm />
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">העלאת מסמכים</h2>
            <Dropzone />
          </div>
        </div>

        {/* Analysis Results Placeholder */}
        <div className="bg-white p-8 rounded-xl shadow-sm border-2 border-dashed border-blue-200 flex flex-col items-center justify-center min-h-[250px]">
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">תוצאות ניתוח (Analysis Results)</h2>
          <p className="text-gray-500">התוצאות יוצגו כאן לאחר סיום עיבוד הנתונים והמסמכים שהועלו.</p>
        </div>
        
      </div>
    </div>
  );
}