"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// ✨ เปลี่ยนไอคอนเป็น PieChartIcon
import { Search, ChevronRight, Building2, Plus, Loader2, Edit, Trash2, Download, PhoneCall, Users, X, MapPin, CreditCard, MessageCircle, Star, AlertCircle, PieChart as PieChartIcon } from "lucide-react";
import Link from "next/link";

interface AdditionalContact {
  contactName: string;
  contactPosition: string;
  phone: string;
  email: string;
  lineId?: string; 
}

interface Customer {
  id: string;
  customerId?: string;
  companyName?: string;
  taxId?: string;
  tsicCode?: string; 
  businessType?: string;
  contactName?: string;
  contactPosition?: string;
  phone?: string;
  email?: string;
  lineId?: string; 
  website?: string;
  registeredCapital?: string;
  creditLimit?: string;
  creditTerms?: string;
  subdistrict?: string;
  district?: string;
  province?: string;
  zipcode?: string;
  googleMapUrl?: string; 
  logoUrl?: string; 
  manufacturingDetails?: string; 
  status?: string;
  tier?: string; 
  lastInteractionDate?: string; 
  additionalContacts?: AdditionalContact[];
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [tierFilter, setTierFilter] = useState("All"); 
  const [provinceFilter, setProvinceFilter] = useState("All");
  
  const [loading, setLoading] = useState(true);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const initialFormState = {
    customerId: "", companyName: "", taxId: "", tsicCode: "", 
    businessType: "", contactName: "", contactPosition: "", phone: "", email: "", lineId: "", 
    website: "", registeredCapital: "", creditLimit: "", creditTerms: "",
    subdistrict: "", district: "", province: "", zipcode: "", 
    googleMapUrl: "", logoUrl: "", manufacturingDetails: "", 
    status: "ติดตาม", tier: "None",
    additionalContacts: [] as AdditionalContact[]
  };
  const [formData, setFormData] = useState(initialFormState);

  async function fetchCustomers() {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "customers"));
      const customerData: Customer[] = [];
      querySnapshot.forEach((doc) => {
        customerData.push({ id: doc.id, ...doc.data() } as Customer);
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

      const mergedData = customerData.map(c => {
         if (c.customerId && lastDates[c.customerId]) {
            c.lastInteractionDate = lastDates[c.customerId];
         }
         return c;
      });

      setCustomers(mergedData);
    } catch (error) {
      console.error("Error fetching customers:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingId) {
        const docRef = doc(db, "customers", editingId);
        await updateDoc(docRef, { ...formData, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, "customers"), { ...formData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }
      setIsDialogOpen(false);
      fetchCustomers();
    } catch (error) {
      console.error("Error saving document: ", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (id: string, companyName: string) => {
    if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลของบริษัท "${companyName}"?\n(ลบแล้วกู้คืนไม่ได้)`)) {
      try {
        await deleteDoc(doc(db, "customers", id));
        fetchCustomers(); 
      } catch (error) {
        console.error("Error deleting document: ", error);
      }
    }
  };

  const openAddDialog = () => {
    setEditingId(null);
    setFormData(initialFormState);
    setIsDialogOpen(true);
  };

  const openEditDialog = (customer: Customer) => {
    setEditingId(customer.id);
    setFormData({
      ...initialFormState,
      ...customer,
      status: customer.status || "ติดตาม",
      tier: customer.tier || "None",
      additionalContacts: customer.additionalContacts || [] 
    });
    setIsDialogOpen(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const getLineLink = (id: string) => {
    if (id.startsWith('http')) return id;
    if (id.startsWith('@')) return `https://line.me/R/ti/p/${id}`;
    return `https://line.me/ti/p/~${id}`;
  };

  const exportToCSV = () => {
    const headers = ["ID", "Company Name", "Tier", "Status", "TSIC Code", "Province", "Map Link", "Contact Name", "Phone", "LINE", "Last Interaction"];
    const rows = filteredCustomers.map(c => [
      c.customerId || "",
      `"${c.companyName || ""}"`,
      c.tier || "ไม่ระบุ",
      c.status || "",
      c.tsicCode || "",
      c.province || "",
      `"${c.googleMapUrl || ""}"`,
      `"${c.contactName || ""}"`,
      `'${c.phone || ""}`,
      `'${c.lineId || ""}`,
      c.lastInteractionDate || "ไม่มีประวัติ"
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" }); 
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `CRM_Customers_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const uniqueProvinces = Array.from(new Set(customers.map(c => c.province).filter(Boolean))).sort();

  const filteredCustomers = customers.filter(customer => {
    const searchLow = searchTerm.toLowerCase();
    const matchCompany = customer.companyName?.toLowerCase().includes(searchLow);
    const matchId = customer.customerId?.toLowerCase().includes(searchLow);
    
    const passSearch = !searchTerm || matchCompany || matchId;
    const passStatus = statusFilter === "All" || customer.status === statusFilter;
    const passTier = tierFilter === "All" || customer.tier === tierFilter;
    const passProvince = provinceFilter === "All" || customer.province === provinceFilter;
    
    return passSearch && passStatus && passTier && passProvince;
  });

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'ลูกค้า': return <Badge className="bg-emerald-500 hover:bg-emerald-600 px-2 sm:px-3 py-0.5 sm:py-1 shadow-sm">ลูกค้า</Badge>;
      case 'ติดตาม': return <Badge className="bg-blue-500 hover:bg-blue-600 px-2 sm:px-3 py-0.5 sm:py-1 shadow-sm">ติดตาม</Badge>;
      default: return <Badge variant="outline" className="text-slate-500 px-2 sm:px-3 py-0.5 sm:py-1">{status || 'ไม่ระบุ'}</Badge>;
    }
  };

  const getTierBadge = (tier?: string) => {
    switch(tier) {
      case 'A': return <span className="inline-flex items-center justify-center bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-md text-[10px] border border-amber-200">⭐ Tier A</span>;
      case 'B': return <span className="inline-flex items-center justify-center bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-md text-[10px] border border-slate-200">Tier B</span>;
      case 'C': return <span className="inline-flex items-center justify-center bg-stone-100 text-stone-600 font-bold px-2 py-0.5 rounded-md text-[10px] border border-stone-200">Tier C</span>;
      default: return null;
    }
  }

  const getContactWarning = (lastDate?: string, status?: string) => {
     if (status === 'ลูกค้า') return <span className="text-[10px] text-emerald-600 mt-1 block">เป็นลูกค้าแล้ว</span>;
     if (!lastDate) return <span className="text-[10px] text-rose-500 bg-rose-50 px-2 py-0.5 rounded-md font-bold mt-1 inline-block border border-rose-100">❌ ไม่เคยพูดคุย</span>;
     
     const diffTime = Math.abs(new Date().getTime() - new Date(lastDate).getTime());
     const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
     
     if (diffDays > 14) {
        return <span className="text-[10px] text-orange-500 bg-orange-50 px-2 py-0.5 rounded-md font-bold mt-1 inline-block border border-orange-200 shadow-sm animate-pulse">⚠️ หายไป {diffDays} วัน</span>;
     }
     
     return <span className="text-[10px] text-slate-400 mt-1 block font-medium">คุยล่าสุด: {lastDate}</span>;
  }

  const urgentFollowUps = customers.filter(c => {
    if (c.status === 'ลูกค้า') return false; 
    if (!c.lastInteractionDate) return true; 
    const diffTime = Math.abs(new Date().getTime() - new Date(c.lastInteractionDate).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 14;
  }).length;

  // ✨ ฟังก์ชันคำนวณกราฟโดนัท TSIC 
  const tsicCounts = customers.reduce((acc, c) => {
    if (c.tsicCode && c.tsicCode.trim() !== '') {
      const label = c.businessType ? `${c.tsicCode} - ${c.businessType}` : `รหัส ${c.tsicCode}`;
      acc[label] = (acc[label] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const sortedTsic = Object.entries(tsicCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const totalTsicCount = sortedTsic.reduce((sum, item) => sum + item.count, 0);

  let tsicChartData: {name: string, count: number, isOthers?: boolean}[] = [];
  if (sortedTsic.length > 5) {
    tsicChartData = sortedTsic.slice(0, 5);
    const othersCount = sortedTsic.slice(5).reduce((sum, item) => sum + item.count, 0);
    if (othersCount > 0) {
      tsicChartData.push({ name: "อุตสาหกรรมอื่นๆ รวมกัน", count: othersCount, isOthers: true });
    }
  } else {
    tsicChartData = sortedTsic;
  }

  // สร้าง Gradient สำหรับกราฟโดนัท 🍩
  let currentPercentage = 0;
  const donutGradientStops = tsicChartData.map((data, idx) => {
    const percentage = (data.count / totalTsicCount) * 100;
    const start = currentPercentage;
    const end = currentPercentage + percentage;
    currentPercentage = end;
    const colorCode = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#94a3b8'][idx % 6];
    return `${colorCode} ${start}% ${end}%`;
  }).join(', ');

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-7xl mx-auto pb-24 px-4 pt-2">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div className="w-full sm:w-auto">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            <Building2 className="text-blue-600 shrink-0" size={28} />
            <span className="truncate">Customer Directory</span>
          </h1>
          <p className="text-slate-500 mt-2 text-sm sm:text-base font-medium">ระบบจัดการข้อมูลบริษัทคู่ค้าสำหรับฝ่ายขาย</p>
        </div>
        
        <div className="flex w-full sm:w-auto gap-2">
          <Button onClick={exportToCSV} variant="outline" className="w-1/2 sm:w-auto border-emerald-500 text-emerald-600 hover:bg-emerald-50 rounded-xl shadow-sm">
            <Download className="w-4 h-4 mr-1 sm:mr-2" /> <span className="hidden sm:inline">Export</span> Excel
          </Button>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <Button onClick={openAddDialog} className="w-1/2 sm:w-auto bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/30">
              <Plus className="w-5 h-5 sm:mr-1" /> <span className="hidden sm:inline">เพิ่มลูกค้าใหม่</span><span className="sm:hidden">เพิ่ม</span>
            </Button>
            <DialogContent className="sm:max-w-[750px] w-[95vw] max-h-[90vh] overflow-y-auto rounded-2xl glass border-white/50 p-4 sm:p-6 bg-white">
              <DialogHeader>
                <DialogTitle className="text-xl sm:text-2xl font-bold text-slate-800 border-b pb-4 mb-2 sm:mb-4">
                  {editingId ? "แก้ไขข้อมูลลูกค้า" : "เพิ่มบริษัทลูกค้าใหม่"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveCustomer} className="space-y-8">
                
                {/* 🏢 ส่วนที่ 1: ข้อมูลบริษัท */}
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-blue-600 mb-4 uppercase tracking-wider flex items-center gap-2">
                    <Building2 size={16}/> ข้อมูลหลักบริษัท
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="customerId" className="text-slate-600">รหัสลูกค้า *</Label>
                      <Input id="customerId" required value={formData.customerId} onChange={handleChange} className="rounded-xl" placeholder="เช่น TFTR"/>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-slate-600">สถานะลูกค้า (Status) *</Label>
                      <Select value={formData.status} onValueChange={(val) => setFormData({...formData, status: val})}>
                        <SelectTrigger className="w-full rounded-xl border-blue-200">
                          <SelectValue placeholder="เลือกสถานะ" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="ติดตาม">ติดตาม (อยู่ระหว่างเจรจา)</SelectItem>
                          <SelectItem value="ลูกค้า">ลูกค้า (เคยซื้อขายแล้ว)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="companyName" className="text-slate-600">ชื่อบริษัท *</Label>
                      <Input id="companyName" required value={formData.companyName} onChange={handleChange} className="rounded-xl font-bold text-blue-900" />
                    </div>

                    <div className="space-y-1 sm:col-span-2 mt-2">
                      <Label htmlFor="manufacturingDetails" className="text-slate-600">สิ่งที่บริษัทผลิต / สินค้าที่ขาย (พิมพ์ได้ยาวๆ)</Label>
                      <textarea 
                        id="manufacturingDetails" 
                        value={formData.manufacturingDetails} 
                        onChange={(e) => setFormData({...formData, manufacturingDetails: e.target.value})} 
                        className="flex w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-h-[80px]" 
                        placeholder="เช่น รับผลิตขวดพลาสติก PET, ฝาเกลียว, กล่องกระดาษลูกฟูก..." 
                      />
                    </div>
                    
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="logoUrl" className="text-slate-600">ลิงก์รูปภาพโลโก้บริษัท (URL) - ถ้ามี</Label>
                      <Input id="logoUrl" value={formData.logoUrl} onChange={handleChange} className="rounded-xl" placeholder="เช่น https://example.com/logo.png" />
                    </div>
                    
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-slate-600">เกรดลูกค้า (Tier) - สำหรับจัดลำดับความสำคัญ</Label>
                      <Select value={formData.tier} onValueChange={(val) => setFormData({...formData, tier: val})}>
                        <SelectTrigger className="w-full rounded-xl">
                          <SelectValue placeholder="เลือกเกรด" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="A">⭐ เกรด A (VIP / งบเยอะ / ปิดการขายง่าย)</SelectItem>
                          <SelectItem value="B">เกรด B (ลูกค้าทั่วไป / มีโอกาส)</SelectItem>
                          <SelectItem value="C">เกรด C (นานๆ ซื้อที / โอกาสน้อย)</SelectItem>
                          <SelectItem value="None">ไม่ระบุ</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="taxId" className="text-slate-600">เลขประจำตัวผู้เสียภาษี (13 หลัก)</Label>
                      <Input id="taxId" value={formData.taxId} onChange={handleChange} className="rounded-xl" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="tsicCode" className="text-slate-600 font-bold text-blue-700">รหัส TSIC (5 หลัก)</Label>
                      <Input id="tsicCode" value={formData.tsicCode} onChange={handleChange} maxLength={5} className="rounded-xl bg-blue-50/50 border-blue-200 font-mono text-blue-700" placeholder="เช่น 22220" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="businessType" className="text-slate-600">ประเภทธุรกิจ</Label>
                      <Input id="businessType" value={formData.businessType} onChange={handleChange} className="rounded-xl" placeholder="เช่น การผลิตบรรจุภัณฑ์พลาสติก" />
                    </div>
                  </div>
                </div>

                <div className="w-full h-px bg-slate-100"></div>

                {/* 📍 ส่วนที่ 2: ข้อมูลที่ตั้ง */}
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-amber-600 mb-4 uppercase tracking-wider flex items-center gap-2">
                    <MapPin size={16}/> ข้อมูลที่ตั้ง (Address)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="subdistrict" className="text-slate-600">ตำบล / แขวง</Label>
                      <Input id="subdistrict" value={formData.subdistrict} onChange={handleChange} className="rounded-xl" placeholder="เช่น บางน้ำจืด" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="district" className="text-slate-600">อำเภอ / เขต</Label>
                      <Input id="district" value={formData.district} onChange={handleChange} className="rounded-xl" placeholder="เช่น เมือง" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="province" className="text-slate-600">จังหวัด</Label>
                      <Input id="province" value={formData.province} onChange={handleChange} className="rounded-xl" placeholder="เช่น สมุทรสาคร" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="zipcode" className="text-slate-600">รหัสไปรษณีย์</Label>
                      <Input id="zipcode" value={formData.zipcode} onChange={handleChange} className="rounded-xl" placeholder="เช่น 74000" />
                    </div>
                    
                    <div className="space-y-1 sm:col-span-2 mt-2">
                      <Label htmlFor="googleMapUrl" className="text-slate-600">ลิงก์แผนที่ Google Maps (พิกัดบริษัท)</Label>
                      <Input id="googleMapUrl" value={formData.googleMapUrl} onChange={handleChange} className="rounded-xl bg-blue-50/30 border-blue-100" placeholder="เช่น https://maps.app.goo.gl/..." />
                    </div>
                  </div>
                </div>

                <div className="w-full h-px bg-slate-100"></div>

                {/* 💰 ส่วนที่ 3: ข้อมูลการเงิน */}
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-emerald-600 mb-4 uppercase tracking-wider flex items-center gap-2">
                    <CreditCard size={16}/> ข้อมูลการเงินและเครดิต
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="registeredCapital" className="text-slate-600">ทุนจดทะเบียน</Label>
                      <Input id="registeredCapital" value={formData.registeredCapital} onChange={handleChange} className="rounded-xl" placeholder="เช่น 1000000" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="creditLimit" className="text-slate-600">วงเงินเครดิต</Label>
                      <Input id="creditLimit" value={formData.creditLimit} onChange={handleChange} className="rounded-xl" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="creditTerms" className="text-slate-600">เครดิตเทอม</Label>
                      <Input id="creditTerms" value={formData.creditTerms} onChange={handleChange} className="rounded-xl" placeholder="เช่น เงินสด/โอน" />
                    </div>
                  </div>
                </div>

                <div className="w-full h-px bg-slate-100"></div>

                {/* 🧑‍💼 ส่วนที่ 4: ผู้ติดต่อหลัก */}
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-blue-600 mb-4 uppercase tracking-wider flex items-center gap-2">
                    <PhoneCall size={16}/> ผู้ติดต่อหลัก
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <div className="space-y-1">
                      <Label htmlFor="contactName" className="text-slate-600">ชื่อผู้ติดต่อ</Label>
                      <Input id="contactName" value={formData.contactName} onChange={handleChange} className="rounded-xl bg-white" placeholder="เช่น บุญเกิด" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="contactPosition" className="text-slate-600">ตำแหน่ง</Label>
                      <Input id="contactPosition" value={formData.contactPosition} onChange={handleChange} className="rounded-xl bg-white" placeholder="เช่น เจ้าของ" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="phone" className="text-slate-600">เบอร์โทรศัพท์</Label>
                      <Input id="phone" value={formData.phone} onChange={handleChange} className="rounded-xl bg-white" placeholder="เช่น 065-549-7826" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="lineId" className="text-slate-600">LINE ID / ลิงก์ไลน์</Label>
                      <Input id="lineId" value={formData.lineId} onChange={handleChange} className="rounded-xl bg-white" placeholder="เช่น @company หรือลิงก์" />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="email" className="text-slate-600">อีเมล</Label>
                      <Input id="email" type="email" value={formData.email} onChange={handleChange} className="rounded-xl bg-white" placeholder="เช่น info@company.com" />
                    </div>
                  </div>
                </div>

                {/* 👥 ส่วนที่ 5: ผู้ติดต่อเพิ่มเติม */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                      <Users size={16}/> ผู้ติดต่อเพิ่มเติม (ถ้ามี)
                    </h3>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setFormData({
                        ...formData, 
                        additionalContacts: [...(formData.additionalContacts || []), { contactName: "", contactPosition: "", phone: "", email: "", lineId: "" }]
                      })}
                      className="rounded-xl h-8 text-xs font-bold border-blue-200 text-blue-700 hover:bg-blue-50 bg-white"
                    >
                      <Plus size={14} className="mr-1" /> เพิ่มบุคคล
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    {(formData.additionalContacts || []).map((contact, index) => (
                      <div key={index} className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 relative group animate-in slide-in-from-top-2">
                        <Button 
                          type="button"
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                             const newContacts = [...(formData.additionalContacts || [])];
                             newContacts.splice(index, 1);
                             setFormData({...formData, additionalContacts: newContacts});
                          }}
                          className="absolute -top-3 -right-3 bg-white border border-rose-200 text-rose-500 hover:bg-rose-50 rounded-full w-7 h-7 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        >
                          <X size={14} />
                        </Button>

                        <div className="space-y-1">
                          <Label className="text-slate-600 text-xs">ชื่อผู้ติดต่อคนที่ {index + 2}</Label>
                          <Input 
                            value={contact.contactName} 
                            onChange={(e) => {
                               const newContacts = [...(formData.additionalContacts || [])];
                               newContacts[index].contactName = e.target.value;
                               setFormData({...formData, additionalContacts: newContacts});
                            }} 
                            className="rounded-xl h-9 bg-white" 
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-slate-600 text-xs">ตำแหน่ง</Label>
                          <Input 
                            value={contact.contactPosition} 
                            onChange={(e) => {
                               const newContacts = [...(formData.additionalContacts || [])];
                               newContacts[index].contactPosition = e.target.value;
                               setFormData({...formData, additionalContacts: newContacts});
                            }} 
                            className="rounded-xl h-9 bg-white" 
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-slate-600 text-xs">เบอร์โทรศัพท์</Label>
                          <Input 
                            value={contact.phone} 
                            onChange={(e) => {
                               const newContacts = [...(formData.additionalContacts || [])];
                               newContacts[index].phone = e.target.value;
                               setFormData({...formData, additionalContacts: newContacts});
                            }} 
                            className="rounded-xl h-9 bg-white" 
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-slate-600 text-xs">LINE ID / ลิงก์ไลน์</Label>
                          <Input 
                            value={contact.lineId || ''} 
                            onChange={(e) => {
                               const newContacts = [...(formData.additionalContacts || [])];
                               newContacts[index].lineId = e.target.value;
                               setFormData({...formData, additionalContacts: newContacts});
                            }} 
                            className="rounded-xl h-9 bg-white" 
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-slate-600 text-xs">อีเมล</Label>
                          <Input 
                            type="email"
                            value={contact.email} 
                            onChange={(e) => {
                               const newContacts = [...(formData.additionalContacts || [])];
                               newContacts[index].email = e.target.value;
                               setFormData({...formData, additionalContacts: newContacts});
                            }} 
                            className="rounded-xl h-9 bg-white" 
                          />
                        </div>
                      </div>
                    ))}
                    {(formData.additionalContacts || []).length === 0 && (
                      <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm bg-slate-50">
                        ยังไม่มีผู้ติดต่อเพิ่มเติม กดปุ่ม + ด้านบนเพื่อเพิ่มได้เลยครับ
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-200 flex flex-col-reverse sm:flex-row justify-end gap-3 sticky bottom-0 bg-white pb-2 z-20">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl w-full sm:w-auto font-bold bg-white">
                    ยกเลิก
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl w-full sm:w-auto px-10 font-bold shadow-lg shadow-blue-500/30">
                    {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> กำลังบันทึก...</> : 'บันทึกข้อมูล'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 📊 โซน Dashboard: เรียงกล่องสถิติ และ กราฟโดนัท ให้อยู่ในแถวเดียวกัน */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6 animate-in fade-in slide-in-from-top-4 duration-500 delay-100">
        
        {/* 📉 ฝั่งซ้าย: กล่องสถิติ 3 กล่อง (เรียงลงมา) */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm flex items-center gap-4 flex-1">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">ลูกค้ารวมทั้งหมด</p>
              <p className="text-2xl font-black text-slate-800">{customers.length} <span className="text-sm font-medium text-slate-500">บริษัท</span></p>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm flex items-center gap-4 flex-1">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
              <Star className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">ลูกค้า VIP (Tier A)</p>
              <p className="text-2xl font-black text-slate-800">{customers.filter(c => c.tier === 'A').length} <span className="text-sm font-medium text-slate-500">บริษัท</span></p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-sm flex items-center gap-4 relative overflow-hidden flex-1">
            <div className="absolute top-0 right-0 w-16 h-16 bg-rose-50 rounded-bl-full -z-10"></div>
            <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">ต้องตามด่วน (เกิน 14 วัน)</p>
              <p className="text-2xl font-black text-rose-600">{urgentFollowUps} <span className="text-sm font-medium text-rose-400">บริษัท</span></p>
            </div>
          </div>
        </div>

        {/* 🍩 ฝั่งขวา: กราฟโดนัท TSIC (ประหยัดพื้นที่ สุดพรีเมียม) */}
        <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-bl-full -z-10"></div>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
                <PieChartIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base leading-tight">สัดส่วนอุตสาหกรรม (TSIC)</h3>
                <p className="text-[11px] text-slate-500">วิเคราะห์จาก {totalTsicCount} บริษัทที่มีรหัส</p>
              </div>
            </div>
          </div>

          {tsicChartData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50 min-h-[150px]">
              ยังไม่มีข้อมูลรหัส TSIC 
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 flex-1 justify-center py-2">
              
              {/* ตัวโดนัท CSS */}
              <div className="relative flex items-center justify-center shrink-0 group">
                <div 
                  className="w-36 h-36 sm:w-40 sm:h-40 rounded-full shadow-md transition-transform duration-500 group-hover:scale-105"
                  style={{ background: `conic-gradient(${donutGradientStops})` }}
                ></div>
                {/* รูกลางโดนัท */}
                <div className="absolute w-24 h-24 sm:w-28 sm:h-28 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                  <span className="text-3xl font-black text-slate-700 leading-none">{totalTsicCount}</span>
                  <span className="text-[10px] font-bold text-slate-400 mt-1">TOTAL</span>
                </div>
              </div>

              {/* คำอธิบาย (Legend) */}
              <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                {tsicChartData.map((data, idx) => {
                  const colorClass = ['bg-[#6366f1]', 'bg-[#8b5cf6]', 'bg-[#ec4899]', 'bg-[#f43f5e]', 'bg-[#f97316]', 'bg-slate-400'][idx % 6];
                  const percentage = Math.round((data.count / totalTsicCount) * 100);
                  return (
                    <div key={idx} className="flex items-start gap-2.5">
                      <div className={`w-3.5 h-3.5 rounded-full mt-0.5 shrink-0 shadow-sm ${colorClass}`}></div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate leading-tight" title={data.name}>{data.name}</p>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">{data.count} บริษัท ({percentage}%)</p>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}
        </div>
      </div>

      <div className="bg-white/50 p-3 sm:p-4 rounded-2xl border border-slate-200/60 shadow-sm space-y-4 backdrop-blur-md">
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input 
              placeholder="ค้นหาชื่อบริษัท หรือ รหัสลูกค้า..." 
              className="pl-12 bg-white border-slate-200 h-12 rounded-xl text-base focus-visible:ring-blue-500 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="w-full sm:w-64 shrink-0">
            <Select value={provinceFilter} onValueChange={setProvinceFilter}>
              <SelectTrigger className="w-full h-12 bg-white border-slate-200 rounded-xl font-medium text-slate-600">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <SelectValue placeholder="ทุกจังหวัด" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-[300px]">
                <SelectItem value="All">🗺️ ทุกจังหวัด (รวมทั้งหมด)</SelectItem>
                {uniqueProvinces.map(prov => (
                  <SelectItem key={prov as string} value={prov as string}>{prov}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 snap-x hide-scrollbar">
          <Button variant={statusFilter === "All" ? "default" : "outline"} onClick={() => setStatusFilter("All")} className={`rounded-full px-4 sm:px-6 shrink-0 snap-start ${statusFilter === "All" ? "bg-slate-800 text-white shadow-md" : "text-slate-600 bg-white"}`}>
            สถานะทั้งหมด
          </Button>
          <Button variant={statusFilter === "ลูกค้า" ? "default" : "outline"} onClick={() => setStatusFilter("ลูกค้า")} className={`rounded-full px-4 sm:px-6 shrink-0 snap-start border-emerald-200 ${statusFilter === "ลูกค้า" ? "bg-emerald-500 text-white shadow-md" : "text-emerald-700 bg-white"}`}>
            ลูกค้า
          </Button>
          <Button variant={statusFilter === "ติดตาม" ? "default" : "outline"} onClick={() => setStatusFilter("ติดตาม")} className={`rounded-full px-4 sm:px-6 shrink-0 snap-start border-blue-200 ${statusFilter === "ติดตาม" ? "bg-blue-500 text-white shadow-md" : "text-blue-700 bg-white"}`}>
            ติดตาม
          </Button>
          
          <div className="w-px bg-slate-300 mx-1 shrink-0"></div>

          <Button variant={tierFilter === "All" ? "default" : "outline"} onClick={() => setTierFilter("All")} className={`rounded-full px-4 shrink-0 border-slate-200 ${tierFilter === "All" ? "bg-slate-700 text-white" : "text-slate-600 bg-white"}`}>
            ทุกเกรด
          </Button>
          <Button variant={tierFilter === "A" ? "default" : "outline"} onClick={() => setTierFilter("A")} className={`rounded-full px-4 shrink-0 border-amber-200 ${tierFilter === "A" ? "bg-amber-500 text-white shadow-md" : "text-amber-700 bg-amber-50/50"}`}>
            ⭐ VIP (A)
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-16 text-slate-500"><Loader2 className="h-6 w-6 animate-spin mr-2" /> โหลดข้อมูล...</div>
      ) : filteredCustomers.length === 0 ? (
        <div className="text-center py-16 text-slate-500 glass rounded-2xl">ไม่พบข้อมูล</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredCustomers.map(customer => (
              <div key={customer.id} className="bg-white rounded-[24px] p-5 sm:p-6 border border-slate-100 shadow-[0_2px_15px_-4px_rgba(0,0,0,0.05)] hover:shadow-xl hover:border-blue-200 transition-all duration-300 group flex flex-col h-full relative overflow-hidden">
                
                <div className={`absolute top-0 left-0 w-full h-1.5 ${
                  customer.tier === 'A' ? 'bg-amber-400' 
                  : customer.status === 'ลูกค้า' ? 'bg-emerald-400' 
                  : 'bg-blue-400'
                }`}></div>

                <div className="flex justify-between items-start mb-4 mt-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-bold bg-slate-50 text-slate-500 border-slate-200 shadow-sm">
                      {customer.customerId || '-'}
                    </Badge>
                    {getTierBadge(customer.tier)}
                  </div>
                  <div>{getStatusBadge(customer.status)}</div>
                </div>

                <div className="flex gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl shrink-0 overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-center shadow-inner">
                    {customer.logoUrl ? (
                      <img src={customer.logoUrl} alt={customer.companyName} className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-6 h-6 text-slate-300" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-800 leading-tight group-hover:text-blue-600 transition-colors line-clamp-2">
                      {customer.companyName || 'ไม่ระบุชื่อบริษัท'}
                    </h3>
                    
                    {(customer.manufacturingDetails || customer.businessType || customer.tsicCode) && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 font-medium leading-relaxed">
                        📦 {customer.tsicCode && <span className="font-bold text-blue-600 bg-blue-50 px-1 rounded mr-1">[{customer.tsicCode}]</span>} 
                        {customer.manufacturingDetails || customer.businessType}
                      </p>
                    )}
                    
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {customer.province && (
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                          <MapPin className="w-3 h-3" /> {customer.province}
                        </span>
                      )}
                      {customer.googleMapUrl && (
                        <a href={customer.googleMapUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold hover:bg-blue-100 transition-colors flex items-center gap-1">
                          📍 เปิดแผนที่
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50/80 rounded-2xl p-4 mb-5 space-y-3 border border-slate-100 flex-1">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-3 text-sm text-slate-700">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-inner">
                        <span className="text-xs">🧑</span>
                      </div>
                      <span className="font-semibold truncate">{customer.contactName || 'ไม่ระบุชื่อผู้ติดต่อ'}</span>
                    </div>
                    {customer.additionalContacts && customer.additionalContacts.length > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-500 border-slate-200 shrink-0 mt-1">
                        + อีก {customer.additionalContacts.length} คน
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2 mt-3">
                    {customer.phone && (
                      <div className="flex items-center gap-3 text-sm text-slate-700">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 shadow-inner">
                          <PhoneCall className="w-3.5 h-3.5" />
                        </div>
                        <a href={`tel:${customer.phone}`} className="font-bold text-emerald-600 hover:underline">{customer.phone}</a>
                      </div>
                    )}
                    
                    {customer.lineId && (
                      <div className="flex items-center gap-3 text-sm text-slate-700">
                        <div className="w-8 h-8 rounded-full bg-[#00B900]/15 flex items-center justify-center text-[#00B900] shrink-0 shadow-inner">
                          <MessageCircle className="w-3.5 h-3.5" />
                        </div>
                        <a 
                          href={getLineLink(customer.lineId)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="font-bold text-[#00B900] hover:underline line-clamp-1"
                        >
                          {customer.lineId}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-end justify-between pt-4 border-t border-slate-100 mt-auto">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">สถานะติดตาม</p>
                    {getContactWarning(customer.lastInteractionDate, customer.status)}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <div className="flex gap-1 mr-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                       <Button variant="ghost" size="icon" onClick={() => openEditDialog(customer)} className="text-slate-400 hover:text-amber-500 hover:bg-amber-50 w-9 h-9 rounded-xl"><Edit size={16} /></Button>
                       <Button variant="ghost" size="icon" onClick={() => handleDeleteCustomer(customer.id, customer.companyName || '')} className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 w-9 h-9 rounded-xl"><Trash2 size={16} /></Button>
                    </div>
                    <Link href={`/customers/${customer.id}`}>
                      <Button className="bg-slate-900 hover:bg-blue-600 text-white rounded-xl h-10 px-4 text-xs font-bold transition-all shadow-md group-hover:shadow-lg">
                        เปิดดู <ChevronRight size={14} className="ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>

              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}