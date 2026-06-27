"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Building2, User, Phone, Mail, MapPin, MessageSquare, Calendar, Plus, Loader2, Edit, Trash2, ShoppingCart, DollarSign, Package, FileText, TrendingUp, Copy, Send, ChevronUp, ChevronDown, Info, BookOpen, ExternalLink, LineChart } from "lucide-react";

// ----------------------------------------------------
// 🌟 คอมโพเนนต์สำหรับสร้าง "กล่องแบบย่อ-ขยายได้" 🌟
// ----------------------------------------------------
function CollapsibleSection({ 
  title, 
  icon: Icon, 
  iconColor = "text-blue-500",
  defaultOpen = true, 
  children, 
  rightAction = null,
  badge = null
}: any) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="mt-6 bg-white/70 p-4 sm:p-6 rounded-[2rem] border border-white shadow-sm backdrop-blur-xl transition-all duration-300 hover:shadow-md">
       <div 
         className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer select-none group" 
         onClick={() => setIsOpen(!isOpen)}
       >
          <div className="flex items-center gap-3">
             <div className={`p-2.5 rounded-2xl bg-white shadow-sm border border-slate-100 group-hover:scale-110 transition-transform duration-300`}>
                <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${iconColor}`} />
             </div>
             <h2 className="text-lg sm:text-xl font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                {title}
             </h2>
             {badge && badge}
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto" onClick={e => e.stopPropagation()}>
             {rightAction}
             <button 
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                className="hidden sm:flex p-2 rounded-full hover:bg-slate-200/50 text-slate-400 hover:text-slate-700 transition-colors"
             >
                {isOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
             </button>
          </div>
          
          <div className="w-full sm:hidden border-t border-slate-100/50 pt-2 flex justify-center text-slate-300">
             {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
       </div>
       
       {isOpen && (
          <div className="mt-6 animate-in fade-in slide-in-from-top-4 duration-500">
             {children}
          </div>
       )}
    </div>
  );
}
// ----------------------------------------------------


interface Customer {
  id: string;
  customerId?: string;
  companyName?: string;
  taxId?: string;
  businessType?: string;
  contactName?: string;
  contactPosition?: string;
  phone?: string;
  email?: string;
  website?: string;
  registeredCapital?: string;
  creditLimit?: string;
  creditTerms?: string;
  subdistrict?: string;
  district?: string;
  province?: string;
  zipcode?: string;
  logoUrl?: string;
  status?: string;
}

interface Interaction {
  id: string;
  subject?: string;
  notes?: string;
  interactionDate?: string;
  nextAppointmentDate?: string;
  status?: string;
  contactPerson?: string;
}

interface SalesData {
  id: string;
  orderDate: string;
  productName: string;
  quantity: number;
  sellingPrice: number;
  totalValue: number;
  poNumber?: string;
}

interface PriceReport {
  id: string;
  date: string;
  pm: string;
  product: string;
  moq: string;
  min: number;
  minSp: number;
  pl: number;
  gp: number;
  profit: number;
}

interface ForecastData {
  productName: string;
  avgQty: number;
  lastOrderDate: string;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  
  const [salesHistory, setSalesHistory] = useState<SalesData[]>([]);
  const [salesSummary, setSalesSummary] = useState({ totalLifetimeValue: 0, totalOrders: 0, topProduct: "-" });
  const [uniqueProducts, setUniqueProducts] = useState<string[]>([]);
  
  const [aiForecasts, setAiForecasts] = useState<ForecastData[]>([]);
  const [nextMonthName, setNextMonthName] = useState("");
  
  const [priceReports, setPriceReports] = useState<PriceReport[]>([]);
  
  const [salesPage, setSalesPage] = useState(1);
  const [pricePage, setPricePage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  
  const [loading, setLoading] = useState(true);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingInteractionId, setEditingInteractionId] = useState<string | null>(null);
  
  const [isPriceDialogOpen, setIsPriceDialogOpen] = useState(false);
  const [isPriceSubmitting, setIsPriceSubmitting] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState("");

  const today = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    subject: "", notes: "", interactionDate: today, nextAppointmentDate: "", status: "Ongoing", contactPerson: ""
  });

  const [priceFormData, setPriceFormData] = useState({
    date: today, pm: "", product: "", moq: "", min: "", minSp: "", pl: ""
  });

  async function fetchData() {
    if (!params.id) return;
    
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setNextMonthName(nextMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }));

    try {
      const docRef = doc(db, "customers", params.id as string);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const custData = { id: docSnap.id, ...docSnap.data() } as Customer;
        setCustomer(custData);

        if (custData.customerId) {
          const qInteractions = query(collection(db, "customerInteractions"), where("customerId", "==", custData.customerId));
          const interactionSnap = await getDocs(qInteractions);
          const interactionList: Interaction[] = [];
          interactionSnap.forEach((doc) => { interactionList.push({ id: doc.id, ...doc.data() } as Interaction); });
          interactionList.sort((a, b) => (new Date(b.interactionDate || 0).getTime()) - (new Date(a.interactionDate || 0).getTime()));
          setInteractions(interactionList);

          const qPrices = query(collection(db, "customerPrices"), where("customerId", "==", custData.customerId));
          const priceSnap = await getDocs(qPrices);
          const priceList: PriceReport[] = [];
          priceSnap.forEach((doc) => { priceList.push({ id: doc.id, ...doc.data() } as PriceReport); });
          priceList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setPriceReports(priceList);
        }

        if (custData.companyName) {
           const salesQ = query(collection(db, "sales"), where("customerName", "==", custData.companyName));
           const salesSnap = await getDocs(salesQ);
           
           let totalVal = 0;
           const productsCount: Record<string, number> = {};
           const history: SalesData[] = [];
           
           const sixMonthsAgo = new Date();
           sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
           const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];
           const forecastStats: Record<string, { totalQty: number, lastOrderDate: string }> = {};

           salesSnap.forEach((doc) => {
              const data = doc.data();
              const qty = parseFloat(data.quantity) || 0;
              const price = parseFloat(data.sellingPrice) || 0;
              const lineTotal = qty * price;
              totalVal += lineTotal;
 
              if (data.productName) productsCount[data.productName] = (productsCount[data.productName] || 0) + qty;
 
              let rawDate = data.orderDate || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString().split('T')[0] : (typeof data.createdAt === 'string' ? data.createdAt.split('T')[0] : ""));
              
              let oDate = rawDate;
              if (rawDate && !isNaN(Number(rawDate)) && Number(rawDate) > 20000) {
                  const jsDate = new Date((Number(rawDate) - 25569) * 86400 * 1000);
                  oDate = jsDate.toISOString().split('T')[0];
              } else if (rawDate && rawDate.includes('/')) {
                  const parts = rawDate.split('/');
                  if (parts.length === 3) {
                     oDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                  }
              }

              history.push({ id: doc.id, orderDate: oDate, productName: data.productName || "-", quantity: qty, sellingPrice: price, totalValue: lineTotal, poNumber: data.poNumber || "-" });

              if (data.productName && oDate >= sixMonthsAgoStr) {
                  if (!forecastStats[data.productName]) {
                      forecastStats[data.productName] = { totalQty: 0, lastOrderDate: "" };
                  }
                  forecastStats[data.productName].totalQty += qty;
                  if (oDate > forecastStats[data.productName].lastOrderDate) {
                      forecastStats[data.productName].lastOrderDate = oDate;
                  }
              }
           });
 
           history.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
           
           let favProduct = "-"; let maxQty = 0;
           const uniqueProds = Object.keys(productsCount);
           Object.entries(productsCount).forEach(([prod, q]) => { if (q > maxQty) { maxQty = q; favProduct = prod; } });
           
           const forecastList = Object.entries(forecastStats).map(([prod, stat]) => ({
              productName: prod,
              avgQty: Math.round(stat.totalQty / 6),
              lastOrderDate: stat.lastOrderDate
           })).filter(f => f.avgQty > 0).sort((a, b) => b.avgQty - a.avgQty);

           setSalesHistory(history);
           setSalesSummary({ totalLifetimeValue: totalVal, totalOrders: history.length, topProduct: favProduct });
           setUniqueProducts(uniqueProds);
           setAiForecasts(forecastList);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, [params.id]);

  const handleCopyForecast = () => {
    if (aiForecasts.length === 0) {
      alert("ไม่มีข้อมูลให้คัดลอก");
      return;
    }
    
    // เรียงคอลัมน์ให้อยู่ในรูป Tab-Separated Values (TSV) เพื่อ Paste ลง Excel ได้ตรงช่อง
    let tsv = "ชื่อลูกค้า\tรายการสินค้า\tยอดวิเคราะห์คาดการณ์\n";
    aiForecasts.forEach(f => {
      tsv += `${customer?.companyName || 'ไม่ระบุ'}\t${f.productName}\t${f.avgQty}\n`;
    });
    
    navigator.clipboard.writeText(tsv);
    alert("✅ คัดลอกข้อมูลเรียบร้อยแล้ว!\nคุณสามารถเปิด Excel และกด Paste (Ctrl+V) ลงในตารางได้เลยครับ");
  };

  const openAddPriceDialog = () => { setEditingPriceId(null); setPriceFormData({ date: today, pm: "", product: "", moq: "", min: "", minSp: "", pl: "" }); setIsPriceDialogOpen(true); };
  const openEditPriceDialog = (report: PriceReport) => { setEditingPriceId(report.id); setPriceFormData({ date: report.date || today, pm: report.pm || "", product: report.product || "", moq: report.moq || "", min: report.min ? String(report.min) : "", minSp: report.minSp ? String(report.minSp) : "", pl: report.pl ? String(report.pl) : "" }); setIsPriceDialogOpen(true); };
  const handleSavePriceReport = async (e: React.FormEvent) => { e.preventDefault(); setIsPriceSubmitting(true); const minNum = parseFloat(priceFormData.min) || 0; const minSpNum = parseFloat(priceFormData.minSp) || 0; const plNum = parseFloat(priceFormData.pl) || 0; const profit = plNum - minSpNum; const gp = minSpNum > 0 ? (profit / minSpNum) * 100 : 0; try { if (editingPriceId) { await updateDoc(doc(db, "customerPrices", editingPriceId), { date: priceFormData.date, pm: priceFormData.pm, product: priceFormData.product, moq: priceFormData.moq, min: minNum, minSp: minSpNum, pl: plNum, gp: gp, profit: profit, updatedAt: serverTimestamp() }); } else { await addDoc(collection(db, "customerPrices"), { customerId: customer?.customerId, date: priceFormData.date, pm: priceFormData.pm, product: priceFormData.product, moq: priceFormData.moq, min: minNum, minSp: minSpNum, pl: plNum, gp: gp, profit: profit, createdAt: serverTimestamp() }); } setIsPriceDialogOpen(false); setPriceFormData({ date: today, pm: "", product: "", moq: "", min: "", minSp: "", pl: "" }); fetchData(); } catch (error) { console.error(error); } finally { setIsPriceSubmitting(false); } };
  const handleDeletePrice = async (id: string) => { if (window.confirm(`ต้องการลบรายการราคานี้ใช่หรือไม่?`)) { await deleteDoc(doc(db, "customerPrices", id)); fetchData(); } };

  const handleGenerateMessage = () => {
    const latestPrices: Record<string, PriceReport> = {};
    priceReports.forEach(report => { if (!latestPrices[report.product]) { latestPrices[report.product] = report; } });
    const d = new Date(today); const dateStr = d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    let msg = `📢 อัปเดตราคาประจำสัปดาห์\nเรียน บริษัท ${customer?.companyName || 'ลูกค้า'}\n\nขออนุญาตแจ้งอัปเดตราคาสินค้าประจำวันที่ ${dateStr} ครับ:\n\n`;
    let count = 1;
    Object.values(latestPrices).forEach(item => { const moqText = item.moq ? ` (MOQ: ${item.moq})` : ''; msg += `${count}. ${item.product}\n   ราคา: ${item.pl.toFixed(2)} บาท/หน่วย${moqText}\n\n`; count++; });
    if (Object.keys(latestPrices).length === 0) { msg += `- ยังไม่มีข้อมูลการแจ้งราคาในระบบ -\n\n`; }
    const paymentTermText = customer?.creditTerms ? `เครดิต ${customer.creditTerms} วัน` : 'ตามที่ตกลงกันไว้ / เงินสด';
    msg += `💳 เงื่อนไขการชำระเงิน: ${paymentTermText}\n\nหากสนใจสั่งซื้อหรือสอบถามเพิ่มเติม สามารถแจ้งได้เลยครับ\nขอบคุณครับ`;
    setGeneratedMessage(msg); setIsMessageDialogOpen(true);
  };
  const handleCopyMessage = () => { navigator.clipboard.writeText(generatedMessage); alert("คัดลอกข้อความเรียบร้อยแล้ว!"); };
  const formatCurrency = (val: number, maxFraction: number = 0) => { if (isNaN(val)) return '-'; return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: maxFraction, maximumFractionDigits: maxFraction }).format(val); }
  const formatDate = (dateStr: string) => { if (!dateStr) return "-"; const date = new Date(dateStr); if (isNaN(date.getTime())) return dateStr; return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }); };

  const totalSalesPages = Math.ceil(salesHistory.length / ITEMS_PER_PAGE);
  const currentSales = salesHistory.slice((salesPage - 1) * ITEMS_PER_PAGE, salesPage * ITEMS_PER_PAGE);
  const totalPricePages = Math.ceil(priceReports.length / ITEMS_PER_PAGE);
  const currentPrices = priceReports.slice((pricePage - 1) * ITEMS_PER_PAGE, pricePage * ITEMS_PER_PAGE);

  const openAddInteractionDialog = () => { setEditingInteractionId(null); setFormData({ subject: "", notes: "", interactionDate: today, nextAppointmentDate: "", status: "Ongoing", contactPerson: customer?.contactName || "" }); setIsDialogOpen(true); };
  const openEditInteractionDialog = (interaction: Interaction) => { setEditingInteractionId(interaction.id); setFormData({ subject: interaction.subject || "", notes: interaction.notes || "", interactionDate: interaction.interactionDate || today, nextAppointmentDate: interaction.nextAppointmentDate || "", status: interaction.status || "Ongoing", contactPerson: interaction.contactPerson || "" }); setIsDialogOpen(true); };
  const handleDeleteInteraction = async (id: string, subject: string) => { if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบประวัติการพูดคุยหัวข้อ "${subject}"?`)) { await deleteDoc(doc(db, "customerInteractions", id)); fetchData(); } };
  const handleSaveInteraction = async (e: React.FormEvent) => { e.preventDefault(); setIsSubmitting(true); try { if (editingInteractionId) { await updateDoc(doc(db, "customerInteractions", editingInteractionId), { ...formData, updatedAt: serverTimestamp() }); } else { await addDoc(collection(db, "customerInteractions"), { ...formData, customerId: customer?.customerId, customerName: customer?.companyName || "", createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); } setIsDialogOpen(false); fetchData(); } catch (error) { console.error(error); } finally { setIsSubmitting(false); } };

  if (loading) return <div className="p-10 text-center text-slate-500 flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
  if (!customer) return <div className="p-10 text-center text-slate-500">ไม่พบข้อมูลลูกค้า</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24 px-2 sm:px-4">
      
      {/* 🌟 Header หลัก */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white/80 p-5 rounded-3xl border border-white shadow-sm backdrop-blur-xl sticky top-4 z-40">
        <Button variant="outline" size="icon" onClick={() => router.back()} className="rounded-2xl border-slate-200 shrink-0 hover:bg-slate-100"><ArrowLeft className="w-5 h-5 text-slate-700" /></Button>
        {customer.logoUrl && <img src={customer.logoUrl} alt="logo" className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-md shrink-0 hidden sm:block" />}
        <div className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 truncate">{customer.companyName || 'ไม่ระบุชื่อบริษัท'}</h1>
            <Badge className={`w-fit px-4 py-1.5 rounded-full text-sm font-bold shadow-sm ${customer.status === 'ลูกค้า' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-blue-500 hover:bg-blue-600'}`}>{customer.status || 'ติดตาม'}</Badge>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-slate-500 font-medium text-sm sm:text-base">รหัสลูกค้า: <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-lg ml-1 border border-blue-100">{customer.customerId || '-'}</span></p>
          </div>
        </div>
      </div>

      {/* 🌟 ส่วนที่ 1: ข้อมูลทั่วไป */}
      <CollapsibleSection title="ข้อมูลบริษัทและผู้ติดต่อ" icon={Building2} iconColor="text-indigo-500" defaultOpen={true}>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-slate-50/50 border-slate-100 shadow-none rounded-2xl">
               <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2 text-indigo-600 font-bold mb-4 border-b border-indigo-100 pb-2"><Building2 className="w-5 h-5"/> ข้อมูลบริษัท</div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="col-span-2 sm:col-span-1"><p className="text-xs text-slate-400 font-medium uppercase">ประเภทธุรกิจ</p><p className="text-slate-700 font-semibold">{customer.businessType || '-'}</p></div>
                     <div className="col-span-2 sm:col-span-1"><p className="text-xs text-slate-400 font-medium uppercase">เลขผู้เสียภาษี</p><p className="text-slate-700 font-semibold">{customer.taxId || '-'}</p></div>
                     <div className="col-span-2"><p className="text-xs text-slate-400 font-medium uppercase">ที่อยู่</p><p className="text-slate-700 font-medium">{[customer.subdistrict, customer.district, customer.province, customer.zipcode].filter(Boolean).join(' ') || '-'}</p></div>
                     <div className="col-span-2 sm:col-span-1 mt-2"><p className="text-xs text-slate-400 font-medium uppercase">ทุนจดทะเบียน</p><p className="text-slate-800 font-bold text-lg">{customer.registeredCapital ? formatCurrency(parseFloat(customer.registeredCapital.replace(/,/g, ''))) : '-'}</p></div>
                     <div className="col-span-2 sm:col-span-1 mt-2"><p className="text-xs text-slate-400 font-medium uppercase">วงเงินเครดิต</p><p className="text-emerald-600 font-bold text-lg">{customer.creditLimit ? formatCurrency(parseFloat(customer.creditLimit.replace(/,/g, ''))) : '-'}</p><p className="text-xs font-medium text-slate-500 mt-1">({customer.creditTerms ? `${customer.creditTerms} วัน` : 'เงินสด'})</p></div>
                  </div>
               </CardContent>
            </Card>

            <Card className="bg-slate-50/50 border-slate-100 shadow-none rounded-2xl">
               <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2 text-blue-600 font-bold mb-4 border-b border-blue-100 pb-2"><User className="w-5 h-5"/> ข้อมูลผู้ติดต่อ</div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="col-span-2"><p className="text-xs text-slate-400 font-medium uppercase">ชื่อผู้ติดต่อ</p><p className="text-lg font-bold text-slate-800">{customer.contactName || '-'}</p><p className="text-sm text-slate-500 font-medium">{customer.contactPosition || 'ตำแหน่ง: -'}</p></div>
                     <div className="col-span-2 sm:col-span-1"><div className="flex items-center gap-2 text-xs text-slate-400 font-medium uppercase"><Phone className="w-3 h-3"/> เบอร์โทรศัพท์</div><p className="text-slate-700 font-semibold">{customer.phone || '-'}</p></div>
                     <div className="col-span-2 sm:col-span-1"><div className="flex items-center gap-2 text-xs text-slate-400 font-medium uppercase"><Mail className="w-3 h-3"/> อีเมล</div><p className="text-slate-700 font-semibold truncate">{customer.email || '-'}</p></div>
                  </div>
               </CardContent>
            </Card>
         </div>
      </CollapsibleSection>


      {/* 🌟 ส่วนที่ 2: ระบบวิเคราะห์คาดการณ์ยอดสั่งซื้อ (Data Analytics) 🌟 */}
      <CollapsibleSection title={`ระบบวิเคราะห์คาดการณ์ยอดสั่งซื้อเดือน "${nextMonthName}"`} icon={LineChart} iconColor="text-amber-500" defaultOpen={true}>
         <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-4 sm:p-6 rounded-2xl border border-blue-100 shadow-sm">
            
            <div className="flex flex-col lg:flex-row gap-6 items-start">
               {/* 📘 กล่องคำอธิบายหลักการคำนวณ (Methodology & References) */}
               <div className="w-full lg:w-1/3 bg-white/70 p-5 rounded-2xl border border-blue-100 shadow-sm backdrop-blur-sm">
                  <h4 className="text-sm font-bold text-blue-800 flex items-center gap-2 mb-3">
                     <Info className="w-4 h-4 text-blue-600" /> หลักการวิเคราะห์ข้อมูล (Analytics)
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed mb-3">
                     ระบบประเมินตัวเลขโดยอ้างอิงหลักสถิติ <br/>
                     <b className="text-blue-700 text-sm">6-Month Simple Moving Average (SMA)</b>
                  </p>
                  
                  <div className="bg-slate-100/80 p-3 rounded-xl border border-slate-200/60 mb-3">
                     <p className="text-[10px] text-slate-500 font-bold mb-1">📝 สูตรคำนวณ (Formula):</p>
                     <p className="text-[11px] text-slate-700 font-mono">
                        (ยอดสั่งซื้อรวมทั้งหมดใน 6 เดือนล่าสุด) ÷ 6
                     </p>
                  </div>
                  
                  <p className="text-[11px] text-slate-500 leading-relaxed bg-blue-50/50 p-2 rounded-lg mb-4">
                     <b>💡 วัตถุประสงค์:</b> เพื่อตัดความผันผวน (Anomaly) และสะท้อนพฤติกรรมการสั่งซื้อจริง ช่วยป้องกันปัญหาของขาดสต๊อก (Stockout) หรือล้นสต๊อก (Overstock)
                  </p>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                     <p className="text-[11px] text-slate-800 font-bold mb-3 flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5 text-indigo-500"/> ข้อมูลอ้างอิงสากล (References):</p>
                     <ul className="text-[10px] text-slate-600 space-y-3 list-none">
                        <li className="flex gap-2 items-start">
                           <span className="text-slate-400 mt-0.5">•</span>
                           <div>
                              <a href="https://www.ascm.org/" target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline font-bold inline-flex items-center gap-1">
                                 APICS (ASCM) <ExternalLink className="w-2.5 h-2.5" />
                              </a><br/>
                              สมาคม Supply Chain โลก แนะนำให้ใช้ SMA 3-6 เดือนใน B2B เพื่อลด Bullwhip Effect
                           </div>
                        </li>
                        <li className="flex gap-2 items-start">
                           <span className="text-slate-400 mt-0.5">•</span>
                           <div>
                              <a href="https://global.toyota/en/company/vision-and-philosophy/production-system/" target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline font-bold inline-flex items-center gap-1">
                                 Toyota (TPS) <ExternalLink className="w-2.5 h-2.5" />
                              </a><br/>
                              ใช้หลักการนี้คำนวณ Heijunka (ปรับเรียบการผลิต) และคำนวณรอบจุดสั่งซื้อ ROP
                           </div>
                        </li>
                        <li className="flex gap-2 items-start">
                           <span className="text-slate-400 mt-0.5">•</span>
                           <div>
                              <a href="https://www.gartner.com/en/supply-chain" target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline font-bold inline-flex items-center gap-1">
                                 Gartner Research <ExternalLink className="w-2.5 h-2.5" />
                              </a><br/>
                              ระบุว่านี่คือโมเดล Baseline ที่มีเสถียรภาพที่สุดสำหรับ Demand Planning อุตสาหกรรม
                           </div>
                        </li>
                     </ul>
                  </div>
               </div>

               {/* 📊 ส่วนแสดงตัวเลขที่คำนวณได้ */}
               <div className="w-full lg:w-2/3">
                  <div className="flex justify-between items-center mb-4 border-b border-blue-200/50 pb-3">
                     <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        ตัวเลขประเมินยอดสั่งซื้อ
                     </h4>
                     {aiForecasts.length > 0 && (
                        <Button 
                           onClick={handleCopyForecast} 
                           className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm text-xs h-8 px-4 font-bold"
                        >
                           <FileText className="w-4 h-4 mr-1.5" /> คัดลอกลง Excel
                        </Button>
                     )}
                  </div>
                  
                  {aiForecasts.length === 0 ? (
                     <div className="bg-white p-8 rounded-2xl text-center text-slate-400 shadow-sm border border-slate-100 flex flex-col items-center justify-center h-full min-h-[200px]">
                        <ShoppingCart className="w-8 h-8 mb-2 opacity-20" />
                        ยังไม่มีประวัติการซื้อใน 6 เดือนที่ผ่านมา เพื่อให้ระบบวิเคราะห์
                     </div>
                  ) : (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {aiForecasts.map(forecast => (
                           <div key={forecast.productName} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-blue-200 transition-all">
                              <div className="mb-4 border-b border-slate-50 pb-3">
                                 <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">{forecast.productName}</h3>
                                 <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><Calendar className="w-3 h-3"/> สั่งล่าสุด: {formatDate(forecast.lastOrderDate)}</p>
                              </div>
                              <div className="flex justify-between items-end bg-blue-50/30 p-3 rounded-xl">
                                 <div className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">ยอดวิเคราะห์คาดการณ์</div>
                                 <div className="text-2xl sm:text-3xl font-black text-blue-600 leading-none">{forecast.avgQty.toLocaleString()}</div>
                              </div>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            </div>
         </div>
      </CollapsibleSection>


      {/* 🌟 ส่วนที่ 3: รายงานราคาและกำไร */}
      <CollapsibleSection 
         title="รายงานราคาและกำไร" 
         icon={TrendingUp} 
         iconColor="text-emerald-500" 
         defaultOpen={true}
         rightAction={
            <div className="flex gap-2 w-full sm:w-auto">
               <Button onClick={handleGenerateMessage} variant="outline" className="rounded-xl border-indigo-200 text-indigo-700 hover:bg-indigo-50 w-full sm:w-auto">
                  <Send className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">สร้างข้อความ</span>
               </Button>
               <Button onClick={openAddPriceDialog} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-sm w-full sm:w-auto">
                  <Plus className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">เพิ่มรายงานราคา</span>
               </Button>
            </div>
         }
      >
         <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold text-[10px] sm:text-xs">
                     <tr>
                        <th className="px-4 py-3 border-b border-slate-200">วันที่</th>
                        <th className="px-4 py-3 border-b border-slate-200">PM</th>
                        <th className="px-4 py-3 border-b border-slate-200">Product</th>
                        <th className="px-4 py-3 border-b border-slate-200">MOQ</th>
                        <th className="px-4 py-3 border-b border-slate-200 text-right">Min<br/><span className="text-[9px] font-normal text-slate-400">(จาก PM)</span></th>
                        <th className="px-4 py-3 border-b border-slate-200 text-right">Min SP<br/><span className="text-[9px] font-normal text-slate-400">(ต้นทุนรวม)</span></th>
                        <th className="px-4 py-3 border-b border-slate-200 text-right">PL<br/><span className="text-[9px] font-normal text-slate-400">(เสนอขาย)</span></th>
                        <th className="px-4 py-3 border-b border-slate-200 text-right">GP (%)</th>
                        <th className="px-4 py-3 border-b border-slate-200 text-right bg-emerald-50 text-emerald-700">กำไรที่ได้</th>
                        <th className="px-4 py-3 border-b border-slate-200"></th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {currentPrices.length === 0 ? (
                        <tr><td colSpan={10} className="p-8 text-center text-slate-400">ยังไม่มีบันทึกราคาและกำไร</td></tr>
                     ) : (
                        currentPrices.map((item) => (
                           <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDate(item.date)}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-slate-700 font-medium">{item.pm}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-slate-800 font-semibold">{item.product}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-amber-600 font-medium">{item.moq || '-'}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-right text-slate-500 font-medium">{item.min ? item.min.toFixed(4) : '-'}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-right text-rose-600">{item.minSp.toFixed(4)}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-slate-800">{item.pl.toFixed(4)}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-right text-indigo-600 font-medium">{item.gp.toFixed(2)}%</td>
                              <td className="px-4 py-3 whitespace-nowrap text-right bg-emerald-50/50 text-emerald-700 font-bold">{item.profit.toFixed(4)}</td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                 <Button variant="ghost" size="icon" onClick={() => openEditPriceDialog(item)} className="h-6 w-6 text-slate-400 hover:text-amber-500 mr-1"><Edit size={14}/></Button>
                                 <Button variant="ghost" size="icon" onClick={() => handleDeletePrice(item.id)} className="h-6 w-6 text-slate-400 hover:text-rose-500"><Trash2 size={14}/></Button>
                              </td>
                           </tr>
                        ))
                     )}
                  </tbody>
               </table>
            </div>
            {totalPricePages > 1 && (
               <div className="flex items-center justify-between p-3 border-t border-slate-100 bg-slate-50/50">
                  <span className="text-xs text-slate-500">หน้า {pricePage} จาก {totalPricePages}</span>
                  <div className="flex gap-2">
                     <Button variant="outline" size="sm" disabled={pricePage===1} onClick={() => setPricePage(p => Math.max(1, p - 1))} className="h-7 text-xs rounded-lg">ย้อนกลับ</Button>
                     <Button variant="outline" size="sm" disabled={pricePage===totalPricePages} onClick={() => setPricePage(p => Math.min(totalPricePages, p + 1))} className="h-7 text-xs rounded-lg">ถัดไป</Button>
                  </div>
               </div>
            )}
         </div>

         <Dialog open={isPriceDialogOpen} onOpenChange={setIsPriceDialogOpen}>
             <DialogContent className="sm:max-w-[700px] rounded-3xl glass">
                 <DialogHeader><DialogTitle className="text-xl font-bold text-slate-800">{editingPriceId ? "แก้ไขรายงานราคา" : "เพิ่มรายงานราคาและกำไร"}</DialogTitle></DialogHeader>
                 <form onSubmit={handleSavePriceReport} className="space-y-4 mt-2">
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1"><Label>วันที่ (Date)</Label><Input type="date" required className="rounded-xl" value={priceFormData.date} onChange={e => setPriceFormData({...priceFormData, date: e.target.value})} /></div>
                       <div className="space-y-1"><Label>ผู้รับผิดชอบ (PM)</Label><Input required placeholder="เช่น ปนัดดา" className="rounded-xl" value={priceFormData.pm} onChange={e => setPriceFormData({...priceFormData, pm: e.target.value})} /></div>
                    </div>
                    <div className="space-y-2">
                       <Label className="flex justify-between items-center">ชื่อสินค้า (Product) <span className="text-xs font-normal text-slate-400">คลิกที่ป้ายเพื่อพิมพ์อัตโนมัติ</span></Label>
                       {uniqueProducts.length > 0 && (<div className="flex flex-wrap gap-2 mb-2">{uniqueProducts.slice(0, 5).map(prod => (<Badge key={prod} variant="outline" className="cursor-pointer hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 bg-white" onClick={() => setPriceFormData({...priceFormData, product: prod})}>+ {prod}</Badge>))}</div>)}
                       <Input required placeholder="พิมพ์หรือเลือกชื่อสินค้าด้านบน" className="rounded-xl" value={priceFormData.product} onChange={e => setPriceFormData({...priceFormData, product: e.target.value})} />
                    </div>
                    <div className="space-y-1"><Label>จำนวนสั่งซื้อขั้นต่ำ (MOQ)</Label><Input placeholder="เช่น 1,000 kg, 1 พาเลท" className="rounded-xl" value={priceFormData.moq} onChange={e => setPriceFormData({...priceFormData, moq: e.target.value})} /></div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                       <div className="space-y-1"><Label className="text-slate-600 font-bold text-xs">Min (ราคาจัดซื้อ)</Label><Input type="number" step="0.0001" required placeholder="0.0000" className="rounded-xl border-slate-300" value={priceFormData.min} onChange={e => setPriceFormData({...priceFormData, min: e.target.value})} /></div>
                       <div className="space-y-1"><Label className="text-rose-600 font-bold text-xs">Min SP (ต้นทุนรวม)</Label><Input type="number" step="0.0001" required placeholder="0.0000" className="rounded-xl border-rose-200" value={priceFormData.minSp} onChange={e => setPriceFormData({...priceFormData, minSp: e.target.value})} /></div>
                       <div className="space-y-1"><Label className="text-emerald-600 font-bold text-xs">PL (ราคาเสนอขาย)</Label><Input type="number" step="0.0001" required placeholder="0.0000" className="rounded-xl border-emerald-200" value={priceFormData.pl} onChange={e => setPriceFormData({...priceFormData, pl: e.target.value})} /></div>
                    </div>
                    {(priceFormData.minSp && priceFormData.pl) && ( <div className="bg-indigo-50 text-indigo-700 p-4 rounded-2xl text-sm flex justify-between font-bold border border-indigo-100"><span>คาดการณ์กำไร: {formatCurrency(parseFloat(priceFormData.pl) - parseFloat(priceFormData.minSp), 4)}</span><span>GP: {((parseFloat(priceFormData.pl) - parseFloat(priceFormData.minSp)) / parseFloat(priceFormData.minSp) * 100).toFixed(2)}%</span></div> )}
                    <div className="pt-2 flex justify-end gap-2">
                       <Button type="button" variant="outline" onClick={() => setIsPriceDialogOpen(false)} className="rounded-xl">ยกเลิก</Button>
                       <Button type="submit" disabled={isPriceSubmitting} className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl">{isPriceSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> บันทึก...</> : (editingPriceId ? 'บันทึกการแก้ไข' : 'บันทึกรายงาน')}</Button>
                    </div>
                 </form>
             </DialogContent>
         </Dialog>

         <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
             <DialogContent className="sm:max-w-[500px] rounded-3xl glass">
                 <DialogHeader><DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2"><MessageSquare className="text-blue-500" /> ตัวอย่างข้อความแจ้งราคา</DialogTitle></DialogHeader>
                 <div className="mt-4 space-y-4">
                     <p className="text-sm text-slate-500">ระบบปกปิดข้อมูลต้นทุน และคัดลอกเฉพาะข้อมูลที่ลูกค้าควรทราบให้แล้วครับ</p>
                     <Textarea readOnly className="h-64 rounded-2xl bg-slate-50 border-slate-200 text-slate-800 text-sm p-4 font-medium leading-relaxed" value={generatedMessage} />
                     <Button onClick={handleCopyMessage} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md h-12 text-md font-bold"><Copy className="w-5 h-5 mr-2" /> คัดลอกข้อความ (Copy)</Button>
                 </div>
             </DialogContent>
         </Dialog>
      </CollapsibleSection>


      {/* 🌟 ส่วนที่ 4: ประวัติบิลสั่งซื้อย้อนหลัง */}
      <CollapsibleSection title="ประวัติบิลสั่งซื้อย้อนหลัง" icon={ShoppingCart} iconColor="text-pink-500" defaultOpen={false}>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-white border border-slate-100 shadow-sm relative overflow-hidden rounded-2xl">
               <DollarSign className="absolute -right-4 -bottom-4 w-24 h-24 text-emerald-500/10" />
               <CardContent className="p-5">
                  <p className="text-xs font-bold text-slate-500 mb-1">ยอดสั่งซื้อสะสม (LTV)</p>
                  <h2 className="text-2xl font-black text-emerald-600 truncate">{formatCurrency(salesSummary.totalLifetimeValue)}</h2>
               </CardContent>
            </Card>
            <Card className="bg-white border border-slate-100 shadow-sm rounded-2xl">
               <CardContent className="p-5 flex flex-col justify-center h-full">
                  <p className="text-xs font-bold text-slate-500 mb-1">จำนวนบิลทั้งหมด</p>
                  <h2 className="text-2xl font-black text-slate-800">{salesSummary.totalOrders} <span className="text-sm font-medium text-slate-400">รายการ</span></h2>
               </CardContent>
            </Card>
            <Card className="bg-white border border-slate-100 shadow-sm rounded-2xl">
               <CardContent className="p-5 flex flex-col justify-center h-full">
                  <p className="text-xs font-bold text-slate-500 mb-1">สินค้าที่ซื้อบ่อยที่สุด</p>
                  <h2 className="text-lg font-black text-amber-600 truncate" title={salesSummary.topProduct}>{salesSummary.topProduct}</h2>
               </CardContent>
            </Card>
         </div>

         <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] sm:text-xs">
                     <tr><th className="px-6 py-4 border-b border-slate-100">วันที่สั่งซื้อ</th><th className="px-6 py-4 border-b border-slate-100">รายการสินค้า</th><th className="px-6 py-4 text-right border-b border-slate-100">จำนวน</th><th className="px-6 py-4 text-right border-b border-slate-100">ราคา/ชิ้น</th><th className="px-6 py-4 text-right border-b border-slate-100">ยอดรวม (บาท)</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {currentSales.length === 0 ? (
                        <tr><td colSpan={5} className="p-10 text-center text-slate-400">ยังไม่มีประวัติการสั่งซื้อ</td></tr>
                     ) : (
                        currentSales.map((item) => (
                           <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4 font-medium text-slate-700 whitespace-nowrap">{formatDate(item.orderDate)}</td>
                              <td className="px-6 py-4 text-slate-800 font-semibold">{item.productName}</td>
                              <td className="px-6 py-4 text-right text-slate-600 whitespace-nowrap">{item.quantity.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                              <td className="px-6 py-4 text-right text-slate-500 whitespace-nowrap">{item.sellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="px-6 py-4 text-right font-black text-emerald-600 whitespace-nowrap">{formatCurrency(item.totalValue)}</td>
                           </tr>
                        ))
                     )}
                  </tbody>
               </table>
            </div>
            {totalSalesPages > 1 && (
               <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50">
                  <span className="text-xs sm:text-sm text-slate-500">หน้า {salesPage} จาก {totalSalesPages}</span>
                  <div className="flex gap-2">
                     <Button variant="outline" size="sm" disabled={salesPage === 1} onClick={() => setSalesPage(p => Math.max(1, p - 1))} className="h-8 text-xs sm:text-sm rounded-lg">ก่อนหน้า</Button>
                     <Button variant="outline" size="sm" disabled={salesPage === totalSalesPages} onClick={() => setSalesPage(p => Math.min(totalSalesPages, p + 1))} className="h-8 text-xs sm:text-sm rounded-lg">ถัดไป</Button>
                  </div>
               </div>
            )}
         </div>
      </CollapsibleSection>


      {/* 🌟 ส่วนที่ 5: ประวัติการเจรจา */}
      <CollapsibleSection 
         title="ประวัติการพูดคุยเจรจา" 
         icon={MessageSquare} 
         iconColor="text-blue-500" 
         defaultOpen={true}
         badge={<Badge variant="secondary" className="ml-2 bg-slate-100 text-slate-600 border-slate-200">{interactions.length}</Badge>}
         rightAction={
            <Button onClick={openAddInteractionDialog} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm">
               <Plus className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">เพิ่มประวัติ</span>
            </Button>
         }
      >
        {interactions.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl border-dashed border-2 border-slate-200 flex flex-col items-center justify-center text-slate-400"><MessageSquare className="w-10 h-10 mb-3 opacity-50" /><p>ยังไม่มีประวัติการพูดคุยกับลูกค้ารายนี้</p></div>
        ) : (
          <div className="space-y-4">
            {interactions.map((interaction) => (
              <Card key={interaction.id} className="bg-white border-slate-100 hover:border-blue-100 transition-all duration-300 shadow-sm relative group rounded-2xl">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-2">
                    <div>
                      <Badge variant={interaction.status === 'Close' ? 'default' : interaction.status === 'Lost' ? 'destructive' : 'secondary'} className={`${interaction.status === 'Close' ? 'bg-emerald-500' : interaction.status === 'Ongoing' ? 'bg-amber-500 text-white' : ''} mb-3 shadow-sm`}>{interaction.status || 'Ongoing'}</Badge>
                      <h3 className="text-lg font-bold text-slate-800 leading-tight pr-10">{interaction.subject || 'ไม่ระบุหัวข้อ'}</h3>
                      <p className="text-xs text-slate-400 font-medium mt-1">ติดต่อ: {interaction.contactPerson || '-'}</p>
                    </div>
                    <div className="flex flex-row sm:flex-col sm:items-end items-center gap-2 w-full sm:w-auto justify-between sm:justify-start mt-2 sm:mt-0">
                      <p className="text-xs sm:text-sm font-semibold text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1 rounded-full">{interaction.interactionDate || '-'}</p>
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={() => openEditInteractionDialog(interaction)} className="text-amber-500 hover:text-amber-600 hover:bg-amber-50 h-8 w-8 rounded-xl"><Edit size={16} /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteInteraction(interaction.id, interaction.subject || '')} className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 h-8 w-8 rounded-xl"><Trash2 size={16} /></Button>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-50/70 p-4 rounded-xl text-slate-700 text-sm leading-relaxed border border-slate-100 whitespace-pre-wrap">{interaction.notes || 'ไม่มีรายละเอียด'}</div>
                  {interaction.nextAppointmentDate && <div className="mt-4 flex items-center gap-2 text-blue-600 bg-blue-50/50 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold border border-blue-100 w-fit"><Calendar className="w-4 h-4 shrink-0" /> นัดหมายถัดไป: {interaction.nextAppointmentDate}</div>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[500px] w-[95vw] rounded-3xl glass">
            <DialogHeader><DialogTitle className="text-xl font-bold text-slate-800">{editingInteractionId ? "แก้ไขประวัติการติดต่อ" : "บันทึกการติดต่อใหม่"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSaveInteraction} className="space-y-4 mt-4">
              <div className="space-y-1"><Label>หัวข้อการสนทนา *</Label><Input required placeholder="เช่น นำเสนอสินค้า, โทรติดตามผล" className="rounded-xl" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1"><Label>วันที่คุย *</Label><Input type="date" required className="rounded-xl" value={formData.interactionDate} onChange={e => setFormData({...formData, interactionDate: e.target.value})} /></div>
                <div className="space-y-1"><Label>วันที่นัดหมายครั้งถัดไป</Label><Input type="date" className="rounded-xl" value={formData.nextAppointmentDate} onChange={e => setFormData({...formData, nextAppointmentDate: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1"><Label>คุยกับใคร</Label><Input className="rounded-xl" value={formData.contactPerson} onChange={e => setFormData({...formData, contactPerson: e.target.value})} /></div>
                <div className="space-y-1"><Label>สถานะการเจรจา</Label><select className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}><option value="Ongoing">Ongoing (กำลังเจรจา)</option><option value="Close">Close (ปิดการขาย/สำเร็จ)</option><option value="Lost">Lost (ปฏิเสธ/ไม่สำเร็จ)</option></select></div>
              </div>
              <div className="space-y-1"><Label>รายละเอียด / โน้ตเพิ่มเติม</Label><Textarea placeholder="จดบันทึกสิ่งที่คุณคุยกับลูกค้า..." className="rounded-xl resize-none h-24" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} /></div>
              <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl w-full sm:w-auto">ยกเลิก</Button>
                <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white rounded-xl">{isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> กำลังบันทึก...</> : 'บันทึกประวัติ'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CollapsibleSection>

    </div>
  );
}