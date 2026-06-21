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
      <body className={`${inter.className} bg-slate-50 min-h-screen`}>
        
        {/* เมนูด้านข้าง */}
        <Sidebar />
        
        {/* ✨ ความลับอยู่ตรงคำว่า md:pl-64 ครับ 
            หมายความว่า: ให้เว้นพื้นที่ฝั่งซ้ายเฉพาะตอนเปิดในจอคอม (md) 
            แต่ถ้าเป็นจอมือถือ พื้นที่ว่างนี้จะหายไป คืนพื้นที่ให้การ์ดลูกค้า 100% */}
        <main className="md:pl-64 transition-all duration-300 ease-in-out min-h-screen w-full">
          <div className="p-2 sm:p-6 lg:p-8 w-full mx-auto">
            {children}
          </div>
        </main>

      </body>
    </html>
  );
}