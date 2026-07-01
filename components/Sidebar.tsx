"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Users, 
  LayoutDashboard, 
  Bell, 
  Calendar, 
  Clock, 
  AlertCircle, 
  ChevronRight, 
  Menu, 
  X, 
  TrendingUp, 
  Package, 
  ChevronLeft 
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Notification {
  id: string;
  customerId: string;
  customerName: string;
  subject: string;
  nextAppointmentDate: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Forecast", href: "/forecast", icon: TrendingUp },
    { name: "Customers", href: "/customers", icon: Users },
    { name: "Products", href: "/products", icon: Package },
  ];

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  const fetchNotifications = async () => {
    try {
      const custSnap = await getDocs(collection(db, "customers"));
      const customerIdMap: Record<string, string> = {};
      custSnap.forEach(doc => {
         const data = doc.data();
         if (data.customerId) {
            customerIdMap[data.customerId] = doc.id;
         }
      });

      const snap = await getDocs(collection(db, "customerInteractions"));
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      const next3Days = new Date();
      next3Days.setDate(today.getDate() + 3);
      const next3DaysStr = next3Days.toISOString().split('T')[0];

      const notifs: Notification[] = [];
      snap.forEach(doc => {
        const data = doc.data();
        
        const statusLower = (data.status || "").toLowerCase();
        const isClosedOrLost = statusLower === "close" || statusLower === "closed" || statusLower === "lost";
        
        if (!isClosedOrLost) {
          const correctFirebaseId = customerIdMap[data.customerId] || data.customerId;

          if (!data.nextAppointmentDate || data.nextAppointmentDate === "") {
             notifs.push({ id: doc.id, customerId: correctFirebaseId, customerName: data.customerName || "ไม่ระบุชื่อบริษัท", subject: data.subject || "ประวัติการพูดคุย", nextAppointmentDate: "ไม่มีกำหนด" });
          } 
          else if (data.nextAppointmentDate <= next3DaysStr) {
             notifs.push({ id: doc.id, customerId: correctFirebaseId, customerName: data.customerName || "ไม่ระบุชื่อบริษัท", subject: data.subject || "ประวัติการพูดคุย", nextAppointmentDate: data.nextAppointmentDate });
          }
        }
      });
      
      notifs.sort((a, b) => {
         if (a.nextAppointmentDate === "ไม่มีกำหนด") return -1;
         if (b.nextAppointmentDate === "ไม่มีกำหนด") return 1;
         return a.nextAppointmentDate.localeCompare(b.nextAppointmentDate);
      });
      
      setNotifications(notifs);
    } catch(err) {
      console.error("Error fetching notifications:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 1000 * 60 * 60);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  const getStatusDisplay = (date: string) => {
    if (date === "ไม่มีกำหนด") return { label: "ด่วน! ลืมระบุนัด", color: "text-purple-600 bg-purple-100 border-purple-200", icon: <AlertCircle className="w-3 h-3"/> };
    if (date < todayStr) return { label: "เลยกำหนด", color: "text-rose-600 bg-rose-100 border-rose-200", icon: <AlertCircle className="w-3 h-3"/> };
    if (date === todayStr) return { label: "วันนี้", color: "text-amber-600 bg-amber-100 border-amber-200", icon: <Clock className="w-3 h-3"/> };
    return { label: "เร็วๆ นี้", color: "text-blue-600 bg-blue-100 border-blue-200", icon: <Calendar className="w-3 h-3"/> };
  };

  return (
    <>
      {/* 📱 ปุ่มกดเมนูสำหรับมือถือ */}
      <button 
        onClick={() => setIsSidebarOpen(true)}
        className="md:hidden fixed bottom-6 right-6 z-40 bg-slate-900 text-white p-4 rounded-full shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)] border border-slate-700 hover:scale-105 transition-transform"
      >
        <Menu className="w-6 h-6" />
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 border-2 border-slate-900"></span>
          </span>
        )}
      </button>

      {/* 📱 ฉากหลังมืดๆ ตอนเปิดเมนูบนมือถือ */}
      {isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 💻 ตัว Sidebar Container (✨ เพิ่ม md:sticky เพื่อให้ดันเนื้อหาขยับหลบ) */}
      <div className={`
        bg-slate-900 text-slate-300 flex flex-col h-screen shrink-0 border-r border-slate-800 shadow-2xl z-50 
        transition-all duration-300 ease-in-out
        fixed left-0 top-0 md:sticky md:top-0
        ${isSidebarOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0"}
        ${!isSidebarOpen && isCollapsed ? "md:w-20" : "md:w-64"}
      `}>
        
        {/* 🌟 Header & Logo */}
        <div className={`h-20 flex items-center px-4 md:px-0 border-b border-slate-800 bg-slate-900/50 
          ${(!isSidebarOpen && isCollapsed) ? 'md:justify-center' : 'justify-between md:px-6'}`}>
          
          <div className={`${(!isSidebarOpen && isCollapsed) ? 'hidden' : 'block'} flex-1`}>
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 tracking-wider">
              CRM<span className="text-slate-100">PRO</span>
            </h1>
          </div>

          {(!isSidebarOpen && isCollapsed) && (
            <div className="hidden md:flex w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 items-center justify-center font-black text-white text-lg shadow-lg">
              CR
            </div>
          )}

          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-500 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 🌟 Main Menu */}
        <nav className="flex-1 px-4 py-8 space-y-2">
          {(!(!isSidebarOpen && isCollapsed)) && (
            <p className="px-2 text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 transition-opacity">Main Menu</p>
          )}
          
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link key={item.name} href={item.href} className="relative group block">
                <div className={`flex items-center px-3 py-3 rounded-xl transition-all duration-300 font-medium cursor-pointer 
                  ${(!isSidebarOpen && isCollapsed) ? "justify-center" : "gap-4"} 
                  ${isActive ? "bg-blue-600/10 text-blue-400 shadow-inner border border-blue-500/20" : "hover:bg-slate-800 hover:text-slate-100 border border-transparent"}
                }`}>
                  <item.icon className={`w-5 h-5 shrink-0 ${isActive ? "text-blue-400" : "text-slate-400"}`} />
                  {(!(!isSidebarOpen && isCollapsed)) && <span className="whitespace-nowrap transition-opacity">{item.name}</span>}
                </div>

                {(!isSidebarOpen && isCollapsed) && (
                  <div className="hidden md:block absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-xl border border-slate-700">
                    {item.name}
                    <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[5px] border-r-slate-800"></div>
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* 🌟 Notification & Dropdown */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 relative" ref={dropdownRef}>
          <button 
            onClick={() => {
              fetchNotifications();
              setIsDropdownOpen(!isDropdownOpen);
            }}
            className={`w-full flex items-center py-3 rounded-xl hover:bg-slate-800 transition-colors relative group ${(!isSidebarOpen && isCollapsed) ? 'justify-center' : 'justify-between px-4'}`}
          >
            <div className={`flex items-center ${(!isSidebarOpen && isCollapsed) ? 'justify-center' : 'gap-3'}`}>
              <div className="relative">
                <Bell className={`w-5 h-5 ${notifications.length > 0 ? "text-amber-400 group-hover:animate-wiggle" : "text-slate-400"}`} />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 border-2 border-slate-900"></span>
                  </span>
                )}
              </div>
              {(!(!isSidebarOpen && isCollapsed)) && <span className="font-semibold text-slate-200 whitespace-nowrap">การแจ้งเตือน</span>}
            </div>
            
            {(!(!isSidebarOpen && isCollapsed)) && notifications.length > 0 && (
              <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{notifications.length}</span>
            )}
            
            {(!isSidebarOpen && isCollapsed) && (
              <div className="hidden md:block absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-xl border border-slate-700">
                การแจ้งเตือน ({notifications.length})
                <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[5px] border-r-slate-800"></div>
              </div>
            )}
          </button>

          {isDropdownOpen && (
            <div className="absolute bottom-[110%] left-4 mb-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200 z-50">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-sm">นัดหมายที่ต้องติดตาม</h3>
                <span className="text-xs font-medium text-slate-500">{notifications.length} รายการ</span>
              </div>
              
              <div className="max-h-[350px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                      <Bell className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-sm font-medium">ไม่มีนัดหมายในเร็วๆ นี้</p>
                    <p className="text-xs">สบายใจได้ คุณเคลียร์งานหมดแล้ว!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {notifications.map((notif) => {
                      const status = getStatusDisplay(notif.nextAppointmentDate);
                      return (
                        <Link 
                          key={notif.id} 
                          href={`/customers/${notif.customerId}`}
                          onClick={() => { setIsDropdownOpen(false); setIsSidebarOpen(false); }}
                          className="block p-4 hover:bg-blue-50/50 transition-colors group"
                        >
                          <div className="flex justify-between items-start mb-1">
                            <p className="font-bold text-sm text-slate-800 group-hover:text-blue-700 transition-colors line-clamp-1 pr-2">{notif.customerName}</p>
                            <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${status.color}`}>
                              {status.icon} {status.label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-1 mb-2">{notif.subject}</p>
                          <div className="flex items-center justify-between mt-2">
                            <p className={`text-xs font-semibold ${notif.nextAppointmentDate === "ไม่มีกำหนด" ? "text-purple-500" : "text-slate-400"}`}>
                              กำหนด: {notif.nextAppointmentDate}
                            </p>
                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 🌟 ปุ่มลูกศรสำหรับ กาง/หุบ แถบเมนู */}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`hidden md:flex w-full items-center p-3 mt-4 text-slate-500 hover:text-white hover:bg-slate-800 transition-colors border-t border-slate-800/50 rounded-xl
              ${isCollapsed ? 'justify-center' : 'justify-end'}
            `}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5 mr-2" />}
            {!isCollapsed && <span className="text-sm font-semibold">ซ่อนเมนู</span>}
          </button>
        </div>

      </div>
    </>
  );
}