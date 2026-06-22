import { Heebo } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/AuthProvider";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  display: 'swap',
});

export const metadata = {
  title: "Smart Insolvency",
  description: "מערכת ניהול חדלות פרעון",
};

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.className} antialiased bg-slate-50 text-slate-800`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}