import "./globals.css";
import AuthProvider from "../components/AuthProvider";

export const metadata = {
  title: "Smart Insolvency AI",
  description: "AI Powered Insolvency Management",
};

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <body className="bg-[#edeef2] min-h-screen font-sans text-gray-800" suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}