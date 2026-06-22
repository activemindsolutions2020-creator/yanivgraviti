export default function PendingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#edeef2] p-4">
      <div dir="rtl" className="p-10 shadow-neu-flat rounded-3xl text-center w-full max-w-md bg-[#edeef2]">
        <div className="w-20 h-20 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-neu-pressed">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-700 mb-4">החשבון ממתין לאישור</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          בקשת ההרשמה שלך התקבלה בהצלחה! 
          המערכת כרגע נמצאת במצב המתנה עד לאישור של מנהל המערכת. 
          אנא נסה להתחבר שוב מאוחר יותר.
        </p>
        <a 
          href="/"
          className="inline-block w-full px-8 py-4 bg-[#edeef2] shadow-neu-flat rounded-xl font-bold text-gray-700 hover:shadow-neu-pressed transition-all"
        >
          חזרה לעמוד הראשי
        </a>
      </div>
    </div>
  );
}
