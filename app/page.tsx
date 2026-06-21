"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Target, AlertCircle, Award, TrendingUp, BarChart3 } from "lucide-react";

export default function Dashboard() {
  const [stats, setStats] = useState({
    total: 0, closed: 0, pipeline: 0, attention: 0
  });
  const [tierStats, setTierStats] = useState({ A: 0, B: 0, C: 0, None: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const querySnapshot = await getDocs(collection(db, "customers"));
        const customersData: any[] = [];
        
        let total = 0, closed = 0, pipeline = 0;
        let tA = 0, tB = 0, tC = 0, tNone = 0;
        
        querySnapshot.forEach((doc) => {
          total++;
          const data = doc.data();
          customersData.push(data);
          
          if (data.status === 'ลูกค้า') closed++;
          if (data.status === 'ติดตาม') pipeline++;

          // นับเกรดลูกค้า
          if (data.tier === 'A') tA++;
          else if (data.tier === 'B') tB++;
          else if (data.tier === 'C') tC++;
          else tNone++;
        });

        const interactionsSnap = await getDocs(collection(db, "customerInteractions"));
        const lastDates: Record<string, string> = {}; 
        
        interactionsSnap.forEach(doc => {
           const data = doc.data();
           if (data.customerId && data.interactionDate) {
              if (!lastDates[data.customerId] || data.interactionDate > lastDates[data.customerId]) {
                 lastDates[data.customerId] = data.interactionDate;
              }
           }
        });

        let attention = 0;
        const now = new Date().getTime();

        customersData.forEach(c => {
           if (c.status === 'ติดตาม') {
              const lastDate = lastDates[c.customerId];
              if (!lastDate) {
                 attention++; 
              } else {
                 const diffTime = Math.abs(now - new Date(lastDate).getTime());
                 const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                 if (diffDays > 14) attention++;
              }
           }
        });

        setStats({ total, closed, pipeline, attention });
        setTierStats({ A: tA, B: tB, C: tC, None: tNone });
      } catch (error) {
        console.error("เกิดข้อผิดพลาดในการดึงข้อมูล:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-7xl mx-auto px-4 pb-20">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Dashboard Overview</h1>
        <p className="text-slate-500 mt-2 font-medium">ภาพรวมธุรกิจ สถิติการตามลูกค้า และกราฟวิเคราะห์ข้อมูล</p>
      </div>
      
      {/* ส่วนที่ 1: กล่องสถิติด้านบน */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="glass bento-shadow border-0 hover:-translate-y-1 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-slate-500">รายชื่อทั้งหมด (Total)</CardTitle>
            <Users className="w-5 h-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-slate-900">{loading ? "..." : stats.total}</div>
            <p className="text-xs text-slate-400 mt-1 font-medium">บริษัททั้งหมดในระบบ</p>
          </CardContent>
        </Card>

        <Card className="glass bento-shadow border-0 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-bl-full -z-10" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-slate-500">เป็นลูกค้าแล้ว (Closed)</CardTitle>
            <Award className="w-5 h-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-slate-900">{loading ? "..." : stats.closed}</div>
            <p className="text-xs text-slate-400 mt-1 font-medium">ปิดการขายสำเร็จ</p>
          </CardContent>
        </Card>

        <Card className="glass bento-shadow border-0 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-bl-full -z-10" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-slate-500">กำลังติดตาม (Pipeline)</CardTitle>
            <Target className="w-5 h-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-slate-900">{loading ? "..." : stats.pipeline}</div>
            <p className="text-xs text-slate-400 mt-1 font-medium">อยู่ระหว่างเจรจา/เสนอราคา</p>
          </CardContent>
        </Card>

        <Card className="glass bento-shadow border-0 bg-gradient-to-br from-white to-rose-50/50 hover:-translate-y-1 transition-all duration-300 ring-1 ring-rose-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-extrabold text-rose-600">ด่วน! ต้องรีบติดต่อ</CardTitle>
            <AlertCircle className="w-5 h-5 text-rose-600 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-rose-600">{loading ? "..." : stats.attention}</div>
            <p className="text-xs text-rose-500 font-bold mt-1">ขาดการติดต่อนานเกิน 14 วัน</p>
          </CardContent>
        </Card>
      </div>

      {/* ส่วนที่ 2: กราฟสถิติ Visual Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
        
        {/* กราฟแท่งแนวนอน: สัดส่วนเกรดลูกค้า */}
        <Card className="glass bento-shadow border-0">
          <CardHeader className="pb-2 border-b border-slate-100/50 mb-4">
            <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-500" /> สัดส่วนลูกค้าตามเกรด (VIP Tiers)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-amber-600 flex items-center gap-1">⭐ เกรด A (VIP)</span>
                <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">{tierStats.A} บริษัท</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div className="bg-gradient-to-r from-amber-400 to-amber-300 h-3 rounded-full transition-all duration-1000" style={{ width: `${stats.total ? (tierStats.A / stats.total) * 100 : 0}%` }}></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-600">เกรด B (ลูกค้าทั่วไป)</span>
                <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">{tierStats.B} บริษัท</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-blue-400 h-3 rounded-full transition-all duration-1000" style={{ width: `${stats.total ? (tierStats.B / stats.total) * 100 : 0}%` }}></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-stone-500">เกรด C (โอกาสน้อย)</span>
                <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">{tierStats.C} บริษัท</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div className="bg-gradient-to-r from-stone-400 to-stone-300 h-3 rounded-full transition-all duration-1000" style={{ width: `${stats.total ? (tierStats.C / stats.total) * 100 : 0}%` }}></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* กราฟหลอด: Sales Pipeline Conversion */}
        <Card className="glass bento-shadow border-0">
          <CardHeader className="pb-2 border-b border-slate-100/50 mb-4">
            <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" /> อัตราการปิดการขาย (Conversion Rate)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-12 w-full rounded-2xl overflow-hidden mt-4 border-2 border-white shadow-inner bg-slate-100">
              <div className="bg-emerald-500 flex items-center justify-center text-white text-xs font-bold transition-all duration-1000" style={{ width: `${stats.total ? (stats.closed / stats.total) * 100 : 0}%` }}>
                {stats.closed > 0 && `${((stats.closed / stats.total) * 100).toFixed(0)}%`}
              </div>
              <div className="bg-blue-400 flex items-center justify-center text-white text-xs font-bold transition-all duration-1000" style={{ width: `${stats.total ? (stats.pipeline / stats.total) * 100 : 0}%` }}>
                {stats.pipeline > 0 && `${((stats.pipeline / stats.total) * 100).toFixed(0)}%`}
              </div>
            </div>
            
            <div className="flex justify-between items-center mt-8 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm"></div>
                  <span className="text-xs font-bold text-slate-600">ลูกค้า (Closed)</span>
                </div>
                <span className="text-lg font-black text-emerald-600">{stats.closed}</span>
              </div>
              
              <div className="w-px h-8 bg-slate-200"></div>
              
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-400 shadow-sm"></div>
                  <span className="text-xs font-bold text-slate-600">กำลังติดตาม</span>
                </div>
                <span className="text-lg font-black text-blue-600">{stats.pipeline}</span>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}