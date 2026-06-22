export default function FrozenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#edeef2] p-4">
      <div dir="rtl" className="p-10 shadow-neu-flat rounded-3xl text-center w-full max-w-md bg-[#edeef2]">
        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-neu-pressed">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-700 mb-4">החשבון הוקפא</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          החשבון שלך הוקפא על ידי מנהל המערכת ואין לך גישה כרגע.
          לבירורים נוספים, אנא פנה לתמיכה.
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
