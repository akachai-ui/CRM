"use client";

import React, { useEffect, useState, useRef } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, TrendingUp, Box, Info, CornerDownRight, Building2, Clock, Plus, Target, CheckCircle2, X, Edit2, Trash2, FileSpreadsheet, Download, Upload, AlertTriangle, DownloadCloud, Trophy, PackageOpen, History } from "lucide-react";

interface SalesData {
  createdAt: any;
  customerId: string;
  customerName: string;
  productName: string;
  quantity: string;
  sellingPrice: string;
}

interface ForecastRow {
  id: string;
  source: "History" | "Manual";
  customerId: string;
  customerName: string;
  productName: string;
  qty: number;
  buyingCycleDays?: number; 
  latestPrice: number;
  expectedValue: number;
  confidence: string;
  isDueNextMonth: boolean;
  expectedMonth?: string; 
  isChurnRisk?: boolean;
}

export default function ForecastPage() {
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [groupedForecasts, setGroupedForecasts] = useState<Record<string, ForecastRow[]>>({});
  const [summary, setSummary] = useState({ totalActual: 0, totalForecastNextMonth: 0 });
  const [customerOptions, setCustomerOptions] = useState<{id: string, name: string}[]>([]);
  
  const [targetRevenue, setTargetRevenue] = useState(1000000);
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [topProducts, setTopProducts] = useState<{name: string, qty: number, value: number}[]>([]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState<"actual" | "pipeline" | "excel">("actual");
  const [editingId, setEditingId] = useState<string | null>(null); 
  const [uploadingExcel, setUploadingExcel] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    customerName: "",
    productName: "",
    quantity: "",
    sellingPrice: "",
    orderDate: new Date().toISOString().split('T')[0],
    expectedMonth: "", 
    confidence: "ปานกลาง (อยู่ระหว่างเจรจา)" 
  });

  const fetchData = async () => {
    try {
      const settingsSnap = await getDoc(doc(db, "settings", "forecastTarget"));
      if (settingsSnap.exists()) {
          setTargetRevenue(settingsSnap.data().value || 1000000);
      }

      const custSnap = await getDocs(collection(db, "customers"));
      const cList = custSnap.docs.map(d => ({ id: d.id, name: d.data().companyName || "" }));
      setCustomerOptions(cList);

      const now = new Date();
      const nextMonth = new Date();
      nextMonth.setMonth(now.getMonth() + 1);
      const nextMonthKey = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
      const endOfNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0);

      const salesSnap = await getDocs(collection(db, "sales"));
      const actualsByMonth: Record<string, number> = {};
      const productGroups: Record<string, any> = {};
      let totalActual = 0;

      salesSnap.forEach(doc => {
        const data = doc.data() as SalesData;
        if (!data.quantity || !data.sellingPrice || !data.createdAt) return;

        let dateObj;
        if (data.createdAt?.toDate) {
            dateObj = data.createdAt.toDate();
        } else if (typeof data.createdAt === 'string') {
            dateObj = new Date(data.createdAt);
        } else {
            dateObj = new Date(); 
        }

        const date = dateObj;
        if (date.getFullYear() < 2024) return;

        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        const qty = parseFloat(data.quantity) || 0;
        const price = parseFloat(data.sellingPrice) || 0;
        const val = qty * price;
        
        actualsByMonth[monthKey] = (actualsByMonth[monthKey] || 0) + val;
        totalActual += val;

        if (data.customerName && data.productName) {
           const groupKey = `${data.customerName}_${data.productName}`;
           if (!productGroups[groupKey]) {
              productGroups[groupKey] = {
                 customerId: data.customerId || "",
                 customerName: data.customerName,
                 productName: data.productName,
                 orderDates: [],
                 totalQty: 0,
                 latestSellingPrice: price,
              };
           }
           productGroups[groupKey].orderDates.push(date);
           productGroups[groupKey].totalQty += qty;
           
           const currentLatest = productGroups[groupKey].orderDates.sort((a:any,b:any) => b.getTime() - a.getTime())[0];
           if (date.getTime() >= currentLatest.getTime()) {
               productGroups[groupKey].latestSellingPrice = price;
           }
        }
      });

      let totalForecast = 0;
      const groupsByCompany: Record<string, ForecastRow[]> = {};
      const productDemandTemp: Record<string, {qty: number, value: number}> = {};

      Object.keys(productGroups).forEach(key => {
         const group = productGroups[key];
         group.orderDates.sort((a:any, b:any) => a.getTime() - b.getTime());
         
         let buyingCycleDays = 30; 
         if (group.orderDates.length >= 2) {
             const firstDate = group.orderDates[0].getTime();
             const lastDate = group.orderDates[group.orderDates.length - 1].getTime();
             buyingCycleDays = ((lastDate - firstDate) / (1000 * 60 * 60 * 24)) / (group.orderDates.length - 1);
         }
         
         const latestDate = group.orderDates[group.orderDates.length - 1];
         const nextOrderDate = new Date(latestDate.getTime() + (buyingCycleDays * 24 * 60 * 60 * 1000));
         const nextOrderMonthKey = `${nextOrderDate.getFullYear()}-${String(nextOrderDate.getMonth() + 1).padStart(2, '0')}`;
         
         const avgQtyPerOrder = group.totalQty / group.orderDates.length;
         
         let expectedValue = 0;
         let isDueNextMonth = false;
         
         const daysSinceLastOrder = (now.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24);
         const isChurnRisk = group.orderDates.length >= 2 && daysSinceLastOrder > (buyingCycleDays * 2);

         if (nextOrderDate <= endOfNextMonth && !isChurnRisk) {
            isDueNextMonth = true;
            expectedValue = avgQtyPerOrder * group.latestSellingPrice;
            totalForecast += expectedValue;
            
            if(!productDemandTemp[group.productName]) productDemandTemp[group.productName] = {qty: 0, value: 0};
            productDemandTemp[group.productName].qty += avgQtyPerOrder;
            productDemandTemp[group.productName].value += expectedValue;
         }

         const aiRow: ForecastRow = {
            id: `ai_${key}`,
            source: "History",
            customerId: group.customerId,
            customerName: group.customerName,
            productName: group.productName,
            qty: avgQtyPerOrder,
            buyingCycleDays: buyingCycleDays,
            latestPrice: group.latestSellingPrice,
            expectedValue: expectedValue,
            confidence: isChurnRisk ? "🚨 เสี่ยงขาดการติดต่อ" : (isDueNextMonth ? (group.orderDates.length >= 4 ? "สูง (ถึงรอบซื้อเป๊ะ)" : "ปานกลาง (ถึงรอบซื้อ)") : `รอซื้อ: ${getMonthName(nextOrderMonthKey)}`),
            isDueNextMonth: isDueNextMonth,
            isChurnRisk: isChurnRisk
         };

         if (!groupsByCompany[group.customerName]) groupsByCompany[group.customerName] = [];
         groupsByCompany[group.customerName].push(aiRow);
      });

      const manualSnap = await getDocs(collection(db, "manual_forecasts"));
      manualSnap.forEach(doc => {
         const data = doc.data();
         const isDue = data.expectedMonth === nextMonthKey;
         const expVal = (parseFloat(data.quantity) || 0) * (parseFloat(data.sellingPrice) || 0);
         
         if (isDue) {
             totalForecast += expVal;
             if(!productDemandTemp[data.productName || ""]) productDemandTemp[data.productName || ""] = {qty: 0, value: 0};
             productDemandTemp[data.productName || ""].qty += parseFloat(data.quantity) || 0;
             productDemandTemp[data.productName || ""].value += expVal;
         }

         const manualRow: ForecastRow = {
            id: doc.id,
            source: "Manual",
            customerId: "",
            customerName: data.customerName || "ไม่ระบุชื่อ",
            productName: data.productName || "-",
            qty: parseFloat(data.quantity) || 0,
            latestPrice: parseFloat(data.sellingPrice) || 0,
            expectedValue: isDue ? expVal : 0,
            confidence: data.confidence || "เจรจา (Manual)",
            isDueNextMonth: isDue,
            expectedMonth: data.expectedMonth 
         };

         if (!groupsByCompany[manualRow.customerName]) groupsByCompany[manualRow.customerName] = [];
         groupsByCompany[manualRow.customerName].push(manualRow);
      });

      Object.keys(groupsByCompany).forEach(company => {
         groupsByCompany[company].sort((a, b) => {
            if (a.isChurnRisk && !b.isChurnRisk) return -1;
            if (!a.isChurnRisk && b.isChurnRisk) return 1;
            if (a.isDueNextMonth === b.isDueNextMonth) return b.expectedValue - a.expectedValue;
            return a.isDueNextMonth ? -1 : 1;
         });
      });

      const top5 = Object.keys(productDemandTemp)
         .map(name => ({ name, ...productDemandTemp[name] }))
         .sort((a, b) => b.value - a.value)
         .slice(0, 5);
      
      setTopProducts(top5);
      setGroupedForecasts(groupsByCompany);

      const allMonths = Array.from(new Set([...Object.keys(actualsByMonth), nextMonthKey])).sort();
      const merged = allMonths.map(month => ({
         month,
         actual: actualsByMonth[month] || 0,
         forecast: month === nextMonthKey ? totalForecast : 0
      }));

      setMonthlyData(merged);
      setSummary({ totalActual, totalForecastNextMonth: totalForecast });

    } catch(err) {
      console.error("Error generating forecast:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveTarget = async () => {
     try {
        await setDoc(doc(db, "settings", "forecastTarget"), { value: targetRevenue });
        setIsEditingTarget(false);
     } catch(e) { console.error(e); }
  }

  const handleExportExcel = () => {
     const exportData: any[] = [];
     Object.keys(groupedForecasts).forEach(company => {
         groupedForecasts[company].forEach(item => {
             exportData.push({
                "ชื่อบริษัท": item.customerName,
                "ชื่อสินค้า": item.productName,
                "แหล่งที่มาข้อมูล": item.source === "History" ? "ประวัติการซื้อ" : "เจรจาล่วงหน้า",
                "ความมั่นใจ / สถานะ": item.confidence,
                "จำนวนสินค้าที่คาดหวัง": item.qty,
                "ยอดเงินที่พยากรณ์ได้ (บาท)": item.expectedValue || 0,
                "รอบการซื้อเฉลี่ย (วัน)": item.buyingCycleDays ? Math.round(item.buyingCycleDays) : "-",
                "ความเสี่ยง": item.isChurnRisk ? "มีความเสี่ยงสูง" : "ปกติ"
             });
         });
     });
     const ws = XLSX.utils.json_to_sheet(exportData);
     const wb = XLSX.utils.book_new();
     XLSX.utils.book_append_sheet(wb, ws, "Sales Forecast");
     XLSX.writeFile(wb, `Enterprise_Sales_Forecast_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  const openAddModal = () => {
     setEditingId(null);
     setFormData({
        customerName: "",
        productName: "",
        quantity: "",
        sellingPrice: "",
        orderDate: new Date().toISOString().split('T')[0],
        expectedMonth: "", 
        confidence: "ปานกลาง (อยู่ระหว่างเจรจา)" 
     });
     setAddMode("actual");
     setIsAddModalOpen(true);
  };

  const handleEditManual = (item: ForecastRow) => {
     setAddMode("pipeline"); 
     setEditingId(item.id);
     setFormData({
        customerName: item.customerName,
        productName: item.productName,
        quantity: item.qty.toString(),
        sellingPrice: item.latestPrice.toString(),
        orderDate: new Date().toISOString().split('T')[0],
        expectedMonth: item.expectedMonth || "", 
        confidence: item.confidence 
     });
     setIsAddModalOpen(true);
  };

  const handleDeleteManual = async (id: string) => {
     if (confirm("ยืนยันการลบโปรเจกต์เจรจานี้?")) {
        setLoading(true);
        try {
           await deleteDoc(doc(db, "manual_forecasts", id));
           fetchData();
        } catch (error) {
           console.error("Error deleting:", error);
           alert("เกิดข้อผิดพลาดในการลบ");
           setLoading(false);
        }
     }
  };

  const handleSaveData = async (e: React.FormEvent) => {
     e.preventDefault();
     setLoading(true);
     setIsAddModalOpen(false);

     try {
        if (addMode === "actual") {
           await addDoc(collection(db, "sales"), {
              costPrice: "0",
              customerId: "",
              customerName: formData.customerName,
              deliveryDate: formData.orderDate,
              orderDate: formData.orderDate,
              paymentTerm: "เครดิต",
              poNumber: "",
              productName: formData.productName,
              quantity: formData.quantity,
              quotationNo: "",
              sellingPrice: formData.sellingPrice,
              createdAt: formData.orderDate,
              updatedAt: serverTimestamp() 
           });
           alert("✅ บันทึกยอดขายจริง เรียบร้อยแล้ว!");
        } else if (addMode === "pipeline") {
           const payload = {
              customerName: formData.customerName,
              productName: formData.productName,
              quantity: formData.quantity,
              sellingPrice: formData.sellingPrice,
              expectedMonth: formData.expectedMonth,
              confidence: formData.confidence,
              updatedAt: serverTimestamp()
           };

           if (editingId) {
              await updateDoc(doc(db, "manual_forecasts", editingId), payload);
              alert("✏️ อัปเดตข้อมูลเจรจาเรียบร้อยแล้ว!");
           } else {
              await addDoc(collection(db, "manual_forecasts"), {
                  ...payload,
                  createdAt: serverTimestamp()
              });
              alert("🚀 เพิ่มข้อมูลเจรจาเข้าตาราง Forecast แล้ว!");
           }
        }
        
        fetchData(); 
     } catch (error) {
        console.error("Error saving data:", error);
        alert("เกิดข้อผิดพลาดในการบันทึก");
        setLoading(false);
     }
  };

  const handleDownloadTemplate = () => {
    const templateData = [{
       costPrice: "107.06",
       customerId: "NYCI",
       customerName: "บริษัท นำยงอุตสาหกรรมเคมี จำกัด",
       deliveryDate: "2026-06-26",
       orderDate: "2026-04-06",
       paymentTerm: "เครดิต",
       poNumber: "D2604033",
       productName: "Ultraform N2320 003 AT (Black)",
       quantity: "100",
       quotationNo: "co-26/05-00169",
       sellingPrice: "110"
    }];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales Data Template");
    XLSX.writeFile(wb, "Sales_Import_Template.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
       try {
          setUploadingExcel(true);
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: "binary" });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);
          
          let count = 0;
          for (const row of data as any[]) {
             if (!row.customerName || !row.productName) continue;
             let orderDateObj = new Date();
             if (row.orderDate) orderDateObj = new Date(row.orderDate);

             await addDoc(collection(db, "sales"), {
                costPrice: String(row.costPrice || "0"),
                customerId: String(row.customerId || ""),
                customerName: String(row.customerName || ""),
                deliveryDate: String(row.deliveryDate || ""),
                orderDate: String(row.orderDate || ""),
                paymentTerm: String(row.paymentTerm || ""),
                poNumber: String(row.poNumber || ""),
                productName: String(row.productName || ""),
                quantity: String(row.quantity || "0"),
                quotationNo: String(row.quotationNo || ""),
                sellingPrice: String(row.sellingPrice || "0"),
                createdAt: orderDateObj, 
                updatedAt: serverTimestamp()
             });
             count++;
          }
          
          alert(`✅ นำเข้าข้อมูลประวัติยอดขายสำเร็จจำนวน ${count} รายการ!`);
          setIsAddModalOpen(false);
          fetchData(); 
       } catch (error) {
          console.error(error);
          alert("❌ เกิดข้อผิดพลาดในการอ่านไฟล์ Excel");
       } finally {
          setUploadingExcel(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
       }
    };
    reader.readAsBinaryString(file);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(val);
  };

  const getMonthName = (monthStr: string) => {
    if (!monthStr) return "";
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('th-TH', { month: 'short', year: 'numeric' });
  };

  if (loading) return <div className="flex justify-center items-center h-[calc(100vh-100px)]"><Loader2 className="w-8 h-8 animate-spin text-indigo-500"/></div>;

  const maxVal = Math.max(...monthlyData.map(d => Math.max(d.actual, d.forecast)), 1);
  const targetPercent = Math.min((summary.totalForecastNextMonth / targetRevenue) * 100, 100);

  return (
    <div className="space-y-8 w-full max-w-6xl mx-auto px-4 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <TrendingUp className="text-indigo-600 shrink-0" /> Enterprise Forecast
          </h1>
          <p className="text-slate-500 mt-2 text-sm sm:text-base font-medium">ระบบวิเคราะห์ข้อมูล (คำนวณจากยอดอดีต + เจรจาใหม่)</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
            <Button onClick={handleExportExcel} variant="outline" className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 bg-white shadow-sm flex-1 sm:flex-none">
               <DownloadCloud size={18} className="mr-2" /> Export
            </Button>
            <Button onClick={openAddModal} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 flex-1 sm:flex-none">
               <Plus size={18} className="mr-2" /> นำเข้าข้อมูล
            </Button>
        </div>
      </div>

      <datalist id="customer-list">
         {customerOptions.map((c, i) => <option key={i} value={c.name} />)}
      </datalist>

      {/* KPI & SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <Card className="glass border-0 bento-shadow overflow-hidden relative">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-bl-full -z-10" />
          <CardContent className="p-6">
             <p className="text-sm font-bold text-slate-500 mb-1">ยอดขายเกิดขึ้นจริงสะสม</p>
             <h2 className="text-2xl sm:text-3xl font-black text-emerald-600 truncate">{formatCurrency(summary.totalActual)}</h2>
          </CardContent>
        </Card>

        <Card className="glass border-0 bento-shadow overflow-hidden relative">
          <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/10 rounded-bl-full -z-10" />
          <CardContent className="p-6">
             <p className="text-sm font-bold text-indigo-500 mb-1">พยากรณ์รายได้เดือนถัดไป</p>
             <h2 className="text-2xl sm:text-3xl font-black text-indigo-700 truncate">{formatCurrency(summary.totalForecastNextMonth)}</h2>
          </CardContent>
        </Card>

        {/* TARGET KPI CARD */}
        <Card className="glass border-0 bento-shadow overflow-hidden relative border-l-4 border-amber-500">
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-bl-full -z-10" />
          <CardContent className="p-6">
             <div className="flex justify-between items-start mb-1">
                <p className="text-sm font-bold text-amber-600">เป้าหมาย (KPI เดือนหน้า)</p>
                <button onClick={() => setIsEditingTarget(!isEditingTarget)} className="text-amber-400 hover:text-amber-600"><Edit2 size={14}/></button>
             </div>
             
             {isEditingTarget ? (
                 <div className="flex gap-2 items-center mt-2">
                    <Input type="number" value={targetRevenue} onChange={(e) => setTargetRevenue(Number(e.target.value))} className="h-8" />
                    <Button onClick={handleSaveTarget} size="sm" className="h-8 bg-amber-500 hover:bg-amber-600 text-white">บันทึก</Button>
                 </div>
             ) : (
                 <>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-800 truncate">{formatCurrency(targetRevenue)}</h2>
                    <div className="mt-3 bg-slate-100 h-2 w-full rounded-full overflow-hidden">
                       <div className={`h-full rounded-full transition-all duration-1000 ${targetPercent >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${targetPercent}%` }}></div>
                    </div>
                    <p className="text-xs font-bold text-slate-500 mt-2">
                       {targetPercent >= 100 ? "🎉 พยากรณ์ทะลุเป้าหมายแล้ว!" : `ขาดอีก ${formatCurrency(targetRevenue - summary.totalForecastNextMonth)}`}
                    </p>
                 </>
             )}
          </CardContent>
        </Card>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex gap-3 text-indigo-800">
         <Info className="w-5 h-5 shrink-0 mt-0.5 text-indigo-500" />
         <div>
            <h4 className="font-bold mb-1">วิธีการคำนวณจากสถิติรอบการซื้อ (Historical Analytics)</h4>
            <p className="text-sm text-indigo-700/80 leading-relaxed">
               ระบบจะวิเคราะห์ประวัติลูกค้าแต่ละราย ว่ามักจะสั่งซื้อสินค้าชนิดเดิมทุกๆ กี่วัน (ดึงเฉพาะสถิติตั้งแต่ปี 2024 เป็นต้นมาเพื่อความแม่นยำ) <br/>
               ถ้าระบบคำนวณแล้วพบว่า <strong>"ถึงดิวที่ต้องสั่งซื้อ"</strong> ภายในเดือนหน้า ระบบจะดึงยอดมาเป็น Forecast ให้ทันที 
               แต่ถ้าพบว่ายังไม่ถึงดิว ยอด Forecast เดือนหน้าจะเป็น 0 ทันที เพื่อไม่ให้หลอกตาครับ
            </p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* CHART */}
         <Card className="glass border-0 bento-shadow lg:col-span-2">
            <CardHeader className="border-b border-slate-100 pb-4">
               <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-700">
                  <TrendingUp className="text-indigo-500 shrink-0" /> เทรนด์การขาย (ยอดจริง vs ยอดที่คาดว่าจะได้)
               </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
               <div className="flex items-end gap-4 sm:gap-8 h-64 border-b border-slate-200 pb-2 overflow-x-auto hide-scrollbar">
                  {monthlyData.map(d => {
                     const actualHeight = Math.max((d.actual / maxVal) * 100, 2);
                     const forecastHeight = Math.max((d.forecast / maxVal) * 100, 2);
                     return (
                        <div key={d.month} className="flex flex-col items-center justify-end h-full min-w-[50px] sm:min-w-[70px] group cursor-pointer">
                           <div className="flex items-end gap-1 w-full justify-center relative h-full">
                              {d.actual > 0 && (
                                <div className="w-5 sm:w-6 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-sm transition-all duration-500 relative" style={{ height: `${actualHeight}%` }}>
                                   <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap transition-opacity z-10 pointer-events-none">
                                      จริง: {formatCurrency(d.actual)}
                                   </div>
                                </div>
                              )}
                              {d.forecast > 0 && (
                                <div className="w-5 sm:w-6 bg-gradient-to-t from-indigo-500 to-indigo-300 rounded-t-sm transition-all duration-500 relative animate-pulse" style={{ height: `${forecastHeight}%` }}>
                                   <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap transition-opacity z-10 pointer-events-none">
                                      พยากรณ์: {formatCurrency(d.forecast)}
                                   </div>
                                </div>
                              )}
                           </div>
                           <div className="text-[10px] font-bold text-slate-500 mt-3 whitespace-nowrap">{getMonthName(d.month)}</div>
                        </div>
                     )
                  })}
               </div>
            </CardContent>
         </Card>

         {/* TOP 5 PRODUCTS DEMAND */}
         <Card className="glass border-0 bento-shadow bg-gradient-to-br from-indigo-50 to-white">
            <CardHeader className="border-b border-indigo-100 pb-4">
               <CardTitle className="text-lg font-bold flex items-center gap-2 text-indigo-900">
                  <Trophy className="text-amber-500 shrink-0" /> สินค้าขายดีเดือนหน้า (Top 5)
               </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
               <div className="space-y-4">
                  {topProducts.length === 0 ? <p className="text-sm text-slate-400">ยังไม่มีข้อมูล</p> : null}
                  {topProducts.map((p, i) => (
                     <div key={i} className="flex items-center gap-3 bg-white p-3 rounded-lg shadow-sm border border-slate-100">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center shrink-0">{i+1}</div>
                        <div className="flex-1 overflow-hidden">
                           <h4 className="font-bold text-sm text-slate-800 truncate" title={p.name}>{p.name}</h4>
                           <p className="text-xs text-slate-500 flex items-center gap-1"><PackageOpen size={10}/> เตรียมสต๊อก: {p.qty.toLocaleString(undefined, {maximumFractionDigits:0})} ชิ้น</p>
                        </div>
                     </div>
                  ))}
               </div>
            </CardContent>
         </Card>
      </div>

      <Card className="glass border-0 bento-shadow">
         <CardHeader className="border-b border-slate-100 pb-4 bg-indigo-50/50 flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-indigo-900">
               <Box className="text-indigo-600" /> ตารางวิเคราะห์แยกรายบริษัท (อิงจากประวัติการซื้อ & เจรจา)
            </CardTitle>
         </CardHeader>
         <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm text-left">
               <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] sm:text-xs">
                  <tr>
                     <th className="px-6 py-4">รายละเอียด (บริษัท / สินค้า)</th>
                     <th className="px-6 py-4 text-center">แหล่งที่มาข้อมูล</th>
                     <th className="px-6 py-4 text-center">สถานะ/ความมั่นใจ</th>
                     <th className="px-6 py-4 text-right">จำนวน</th>
                     <th className="px-6 py-4 text-right">เป้ายอดขายเดือนหน้า</th>
                     <th className="px-6 py-4 text-center rounded-tr-lg">จัดการ</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {Object.keys(groupedForecasts).length === 0 ? (
                     <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">ยังไม่มีข้อมูล</td>
                     </tr>
                  ) : (
                     Object.entries(groupedForecasts).map(([companyName, products]) => {
                        const companyTotal = products.reduce((acc, p) => acc + p.expectedValue, 0);

                        return (
                           <React.Fragment key={companyName}>
                              <tr className="bg-slate-50/80">
                                 <td className="px-6 py-4 font-black text-slate-800 flex items-center gap-2">
                                    <Building2 size={16} className="text-indigo-400"/>
                                    {companyName}
                                    <span className="text-[10px] font-bold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full ml-2">
                                       {products.length} รายการ
                                    </span>
                                 </td>
                                 <td></td><td></td><td></td>
                                 <td className="px-6 py-4 text-right font-black text-indigo-700">
                                    {formatCurrency(companyTotal)}
                                 </td>
                                 <td></td>
                              </tr>
                              
                              {products.map(item => (
                                 <tr key={item.id} className={`transition-colors ${item.isChurnRisk ? 'bg-rose-50/50' : (item.isDueNextMonth ? 'bg-indigo-50/20 hover:bg-indigo-50/60' : 'hover:bg-slate-50/50')}`}>
                                    <td className="px-6 py-3 pl-10 text-slate-600 font-medium flex items-center gap-2">
                                       <CornerDownRight size={14} className="text-slate-300"/>
                                       {item.productName}
                                       {item.source === "History" && item.buyingCycleDays && (
                                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                                             <Clock size={10}/> ซื้อทุก {Math.round(item.buyingCycleDays)} วัน
                                          </span>
                                       )}
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                       {item.source === "History" ? (
                                          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-bold flex items-center justify-center gap-1 w-max mx-auto"><History size={12}/> ประวัติเก่า</span>
                                       ) : (
                                          <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-[10px] font-bold flex items-center justify-center gap-1 w-max mx-auto"><Target size={12}/> เจรจาใหม่</span>
                                       )}
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                       {item.isChurnRisk ? (
                                          <span className="px-2 py-1 rounded-md font-bold text-[10px] sm:text-xs bg-rose-100 text-rose-700 flex items-center justify-center gap-1"><AlertTriangle size={12}/> {item.confidence}</span>
                                       ) : (
                                          <span className={`px-2 py-1 rounded-md font-bold text-[10px] sm:text-xs ${
                                          item.isDueNextMonth ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                                          }`}>
                                          {item.confidence}
                                          </span>
                                       )}
                                    </td>
                                    <td className="px-6 py-3 text-right text-slate-500">
                                       {item.isChurnRisk ? "-" : Number(item.qty || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} ชิ้น
                                    </td>
                                    <td className={`px-6 py-3 text-right font-semibold ${item.isChurnRisk ? 'text-rose-400' : (item.isDueNextMonth ? 'text-indigo-600' : 'text-slate-400')}`}>
                                       {item.expectedValue > 0 ? formatCurrency(item.expectedValue) : '-'}
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                       {item.source === "Manual" ? (
                                          <div className="flex items-center justify-center gap-2">
                                             <button onClick={() => handleEditManual(item)} className="text-slate-400 hover:text-blue-600 transition-colors" title="แก้ไข">
                                                <Edit2 size={16} />
                                             </button>
                                             <button onClick={() => handleDeleteManual(item.id)} className="text-slate-400 hover:text-rose-600 transition-colors" title="ลบ">
                                                <Trash2 size={16} />
                                             </button>
                                          </div>
                                       ) : (
                                          <span className="text-[10px] text-slate-300">-</span>
                                       )}
                                    </td>
                                 </tr>
                              ))}
                           </React.Fragment>
                        );
                     })
                  )}
               </tbody>
            </table>
         </CardContent>
      </Card>

      {/* --- Modal ฟอร์ม นำเข้า / กรอกข้อมูล --- */}
      {isAddModalOpen && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
            <Card className="w-full max-w-2xl shadow-2xl border-0 animate-in zoom-in-95 overflow-hidden">
               
               {!editingId && (
                 <div className="flex overflow-x-auto hide-scrollbar">
                    <button 
                       onClick={() => setAddMode("actual")} 
                       className={`flex-1 min-w-[150px] py-4 font-bold flex items-center justify-center gap-2 transition-colors ${addMode === "actual" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                    >
                       <CheckCircle2 size={16}/> บันทึกยอดขาย
                    </button>
                    <button 
                       onClick={() => setAddMode("pipeline")} 
                       className={`flex-1 min-w-[150px] py-4 font-bold flex items-center justify-center gap-2 transition-colors ${addMode === "pipeline" ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                    >
                       <Target size={16}/> เจรจาล่วงหน้า
                    </button>
                    <button 
                       onClick={() => setAddMode("excel")} 
                       className={`flex-1 min-w-[150px] py-4 font-bold flex items-center justify-center gap-2 transition-colors ${addMode === "excel" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                    >
                       <FileSpreadsheet size={16}/> นำเข้า Excel
                    </button>
                 </div>
               )}

               <CardContent className="pt-6 relative">
                  <button onClick={() => setIsAddModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-white rounded-full p-1"><X size={20}/></button>
                  
                  {addMode === "excel" && (
                     <div className="space-y-6">
                        <div>
                           <h3 className="font-black text-lg text-slate-800">📊 นำเข้าประวัติยอดขายจาก Excel (.xlsx)</h3>
                           <p className="text-sm text-slate-500 mt-1">
                              โหลดไฟล์ Template ไปพิมพ์ข้อมูลหลายๆ บรรทัด แล้วอัปโหลดกลับเข้ามาที่นี่รวดเดียวได้เลย
                           </p>
                        </div>
                        
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 flex flex-col items-center justify-center gap-4">
                           <Button onClick={handleDownloadTemplate} variant="outline" className="border-indigo-300 text-indigo-700 hover:bg-indigo-100 w-full sm:w-auto">
                              <Download size={18} className="mr-2"/> 1. ดาวน์โหลดไฟล์ Excel ต้นแบบ
                           </Button>
                           
                           <div className="w-full border-t border-indigo-200/50 my-2"></div>
                           
                           <div className="w-full space-y-2 text-center">
                              <Label className="font-bold text-indigo-900">2. อัปโหลดไฟล์ Excel ที่กรอกข้อมูลเสร็จแล้ว</Label>
                              <div className="flex items-center justify-center mt-2">
                                 {uploadingExcel ? (
                                    <div className="flex items-center gap-2 text-indigo-600 font-bold animate-pulse"><Loader2 className="animate-spin" size={20}/> กำลังนำเข้าข้อมูล...</div>
                                 ) : (
                                    <Label htmlFor="excel-upload" className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg shadow-indigo-200">
                                       <Upload size={18} /> เลือกไฟล์จากเครื่อง
                                    </Label>
                                 )}
                                 <input 
                                    id="excel-upload" 
                                    type="file" 
                                    accept=".xlsx, .xls" 
                                    className="hidden" 
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    disabled={uploadingExcel}
                                 />
                              </div>
                           </div>
                        </div>
                     </div>
                  )}

                  {addMode !== "excel" && (
                     <form onSubmit={handleSaveData} className="space-y-4">
                        <div className="mb-6">
                           <h3 className="font-black text-lg text-slate-800">
                              {editingId ? "✏️ แก้ไขโปรเจกต์เจรจา (Pipeline)" : (addMode === "actual" ? "🟢 เพิ่มประวัติใบสั่งซื้อใหม่" : "🟠 เพิ่มโปรเจกต์เจรจา (Pipeline)")}
                           </h3>
                        </div>

                        <div className="space-y-2">
                           <Label>ชื่อบริษัทลูกค้า <span className="text-rose-500">*</span></Label>
                           <Input required list="customer-list" value={formData.customerName} onChange={(e) => setFormData({...formData, customerName: e.target.value})} placeholder="พิมพ์หรือเลือกจากรายชื่อ..." />
                        </div>
                        <div className="space-y-2">
                           <Label>ชื่อสินค้า <span className="text-rose-500">*</span></Label>
                           <Input required value={formData.productName} onChange={(e) => setFormData({...formData, productName: e.target.value})} placeholder="เช่น HPS POLIMAXX" />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                              <Label>จำนวนชิ้น <span className="text-rose-500">*</span></Label>
                              <Input required type="number" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: e.target.value})} placeholder="เช่น 1000" />
                           </div>
                           <div className="space-y-2">
                              <Label>ราคาต่อชิ้น (บาท) <span className="text-rose-500">*</span></Label>
                           <Input required type="number" value={formData.sellingPrice} onChange={(e) => setFormData({...formData, sellingPrice: e.target.value})} placeholder="เช่น 150" />
                           </div>
                        </div>

                        {addMode === "actual" ? (
                           <div className="space-y-2 bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                              <Label className="text-emerald-800">วันที่ลูกค้าสั่งซื้อจริง <span className="text-rose-500">*</span></Label>
                              <Input required type="date" value={formData.orderDate} onChange={(e) => setFormData({...formData, orderDate: e.target.value})} />
                           </div>
                        ) : (
                           <div className="space-y-4 bg-amber-50 p-4 rounded-xl border border-amber-100">
                              <div className="space-y-2">
                                 <Label className="text-amber-800">คาดว่าจะปิดยอดได้เดือนไหน? <span className="text-rose-500">*</span></Label>
                                 <Input required type="month" value={formData.expectedMonth} onChange={(e) => setFormData({...formData, expectedMonth: e.target.value})} />
                              </div>
                              <div className="space-y-2">
                                 <Label className="text-amber-800">ระดับความมั่นใจ (Confidence)</Label>
                                 <select 
                                    className="flex h-10 w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                                    value={formData.confidence}
                                    onChange={(e) => setFormData({...formData, confidence: e.target.value})}
                                 >
                                    <option>สูง (กำลังร่างสัญญา)</option>
                                    <option>ปานกลาง (อยู่ระหว่างเจรจา)</option>
                                    <option>ต่ำ (เพิ่งเสนอราคา)</option>
                                 </select>
                              </div>
                           </div>
                        )}

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                           <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)}>ยกเลิก</Button>
                           <Button type="submit" className={addMode === "actual" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-amber-500 hover:bg-amber-600 text-white"}>
                              {editingId ? "บันทึกการแก้ไข" : (addMode === "actual" ? "บันทึกยอดขายจริง" : "บันทึกดีลล่วงหน้า")}
                           </Button>
                        </div>
                     </form>
                  )}
               </CardContent>
            </Card>
         </div>
      )}

    </div>
  );
}