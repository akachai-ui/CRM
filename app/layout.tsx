import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CRM PRO",
  description: "Customer Relationship Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      {/* ✨ เพิ่ม flex ตรงนี้ */}
      <body className={`${inter.className} bg-slate-50 min-h-screen flex`}>
        
        {/* เมนูด้านข้าง */}
        <Sidebar />
        
        {/* ✨ เอา md:pl-64 ออก แล้วใส่ flex-1 เข้าไปแทน 
            มันจะคอยผลักและขยายพื้นที่อัตโนมัติตามขนาดของ Sidebar */}
        <main className="flex-1 transition-all duration-300 ease-in-out min-h-screen min-w-0 w-full">
          <div className="p-2 sm:p-6 lg:p-8 w-full mx-auto">
            {children}
          </div>
        </main>

      </body>
    </html>
  );
}