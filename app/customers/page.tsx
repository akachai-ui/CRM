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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ChevronRight, Building2, Plus, Loader2, Edit, Trash2, Download, PhoneCall } from "lucide-react";
import Link from "next/link";

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
  tier?: string; 
  lastInteractionDate?: string; 
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [tierFilter, setTierFilter] = useState("All"); // เพิ่มตัวแปรสำหรับ Filter VIP
  const [loading, setLoading] = useState(true);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const initialFormState = {
    customerId: "", companyName: "", taxId: "", businessType: "",
    contactName: "", contactPosition: "", phone: "", email: "", website: "",
    registeredCapital: "", creditLimit: "", creditTerms: "",
    subdistrict: "", district: "", province: "", zipcode: "", logoUrl: "",
    status: "ติดตาม", tier: "None"
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
      tier: customer.tier || "None"
    });
    setIsDialogOpen(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const exportToCSV = () => {
    const headers = ["ID", "Company Name", "Tier", "Status", "Contact Name", "Phone", "Last Interaction"];
    const rows = filteredCustomers.map(c => [
      c.customerId || "",
      `"${c.companyName || ""}"`,
      c.tier || "ไม่ระบุ",
      c.status || "",
      `"${c.contactName || ""}"`,
      `'${c.phone || ""}`,
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

  // อัปเดตตัวกรอง: รวมการกรองค้นหา, สถานะ และ เกรด (VIP)
  const filteredCustomers = customers.filter(customer => {
    const searchLow = searchTerm.toLowerCase();
    const matchCompany = customer.companyName?.toLowerCase().includes(searchLow);
    const matchId = customer.customerId?.toLowerCase().includes(searchLow);
    
    const passSearch = !searchTerm || matchCompany || matchId;
    const passStatus = statusFilter === "All" || customer.status === statusFilter;
    const passTier = tierFilter === "All" || customer.tier === tierFilter;
    
    return passSearch && passStatus && passTier;
  });

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'ลูกค้า': return <Badge className="bg-emerald-500 hover:bg-emerald-600 px-2 sm:px-3 py-0.5 sm:py-1">ลูกค้า</Badge>;
      case 'ติดตาม': return <Badge className="bg-blue-500 hover:bg-blue-600 px-2 sm:px-3 py-0.5 sm:py-1">ติดตาม</Badge>;
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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-6xl mx-auto pb-24 px-4">
      
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
            <DialogContent className="sm:max-w-[750px] w-[95vw] max-h-[90vh] overflow-y-auto rounded-2xl glass border-white/50 p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle className="text-xl sm:text-2xl font-bold text-slate-800 border-b pb-4 mb-2 sm:mb-4">
                  {editingId ? "แก้ไขข้อมูลลูกค้า" : "เพิ่มบริษัทลูกค้าใหม่"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveCustomer} className="space-y-8">
                
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
                      <Label htmlFor="companyName" className="text-slate-600">ชื่อบริษัท *</Label>
                      <Input id="companyName" required value={formData.companyName} onChange={handleChange} className="rounded-xl" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="taxId" className="text-slate-600">เลขประจำตัวผู้เสียภาษี</Label>
                      <Input id="taxId" value={formData.taxId} onChange={handleChange} className="rounded-xl" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="businessType" className="text-slate-600">ประเภทธุรกิจ</Label>
                      <Input id="businessType" value={formData.businessType} onChange={handleChange} className="rounded-xl" />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-blue-600 mb-4 uppercase tracking-wider flex items-center gap-2">
                    <PhoneCall size={16}/> ข้อมูลผู้ติดต่อ
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="contactName" className="text-slate-600">ชื่อผู้ติดต่อ</Label>
                      <Input id="contactName" value={formData.contactName} onChange={handleChange} className="rounded-xl" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="contactPosition" className="text-slate-600">ตำแหน่ง</Label>
                      <Input id="contactPosition" value={formData.contactPosition} onChange={handleChange} className="rounded-xl" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="phone" className="text-slate-600">เบอร์โทรศัพท์ (ใส่เพื่อให้โทรง่าย)</Label>
                      <Input id="phone" value={formData.phone} onChange={handleChange} className="rounded-xl" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="email" className="text-slate-600">อีเมล</Label>
                      <Input id="email" type="email" value={formData.email} onChange={handleChange} className="rounded-xl" />
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex flex-col-reverse sm:flex-row justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl w-full sm:w-auto font-bold">
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

      <div className="bg-white/50 p-3 sm:p-4 rounded-2xl border border-slate-200/60 shadow-sm space-y-4 backdrop-blur-md">
        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <Input 
            placeholder="ค้นหาชื่อบริษัท หรือ รหัสลูกค้า..." 
            className="pl-12 bg-white border-slate-200 h-12 rounded-xl text-base focus-visible:ring-blue-500 w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* แถบรวมปุ่มตัวกรองทั้งหมด */}
        <div className="flex gap-2 overflow-x-auto pb-2 snap-x hide-scrollbar">
          {/* 1. กรองสถานะ */}
          <Button variant={statusFilter === "All" ? "default" : "outline"} onClick={() => setStatusFilter("All")} className={`rounded-full px-4 sm:px-6 shrink-0 snap-start ${statusFilter === "All" ? "bg-slate-800 text-white shadow-md" : "text-slate-600 bg-white"}`}>
            สถานะทั้งหมด
          </Button>
          <Button variant={statusFilter === "ลูกค้า" ? "default" : "outline"} onClick={() => setStatusFilter("ลูกค้า")} className={`rounded-full px-4 sm:px-6 shrink-0 snap-start border-emerald-200 ${statusFilter === "ลูกค้า" ? "bg-emerald-500 text-white shadow-md" : "text-emerald-700 bg-white"}`}>
            ลูกค้า
          </Button>
          <Button variant={statusFilter === "ติดตาม" ? "default" : "outline"} onClick={() => setStatusFilter("ติดตาม")} className={`rounded-full px-4 sm:px-6 shrink-0 snap-start border-blue-200 ${statusFilter === "ติดตาม" ? "bg-blue-500 text-white shadow-md" : "text-blue-700 bg-white"}`}>
            ติดตาม
          </Button>
          
          {/* ขีดคั่นกลาง */}
          <div className="w-px bg-slate-300 mx-1 shrink-0"></div>

          {/* 2. กรองเกรด VIP */}
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
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filteredCustomers.map(customer => (
              <div key={customer.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3">
                <div className="flex justify-between items-start gap-2 border-b border-slate-50 pb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-blue-600 text-xs tracking-wider uppercase">{customer.customerId || '-'}</p>
                      {getTierBadge(customer.tier)}
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg leading-tight mt-1">{customer.companyName || 'ไม่ระบุชื่อบริษัท'}</h3>
                  </div>
                  <div className="shrink-0">{getStatusBadge(customer.status)}</div>
                </div>

                <div className="flex flex-col gap-1">
                  {customer.contactName && <p className="text-sm font-medium text-slate-700">🧑 {customer.contactName}</p>}
                  {customer.phone && (
                    <a href={`tel:${customer.phone}`} className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 w-fit px-3 py-1.5 rounded-lg border border-blue-100 mt-1 active:bg-blue-100">
                      <PhoneCall size={14} /> {customer.phone}
                    </a>
                  )}
                  {getContactWarning(customer.lastInteractionDate, customer.status)}
                </div>

                <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-50 mt-1">
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(customer)} className="text-amber-500 hover:bg-amber-50 h-9 w-9 rounded-xl"><Edit size={16} /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteCustomer(customer.id, customer.companyName || '')} className="text-rose-500 hover:bg-rose-50 h-9 w-9 rounded-xl"><Trash2 size={16} /></Button>
                  <Link href={`/customers/${customer.id}`} className="ml-2 w-full max-w-[120px]">
                    <Button className="w-full bg-slate-900 text-white rounded-xl h-9 text-xs">ดูข้อมูล <ChevronRight size={14}/></Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block glass rounded-2xl overflow-hidden bento-shadow border border-white/40">
            <div className="overflow-x-auto">
              <Table className="w-full min-w-[900px]">
                <TableHeader className="bg-slate-800">
                  <TableRow className="border-b-0">
                    <TableHead className="font-bold text-slate-200 w-[100px] pl-6 py-4">ID</TableHead>
                    <TableHead className="font-bold text-slate-200 py-4 min-w-[250px]">บริษัท</TableHead>
                    <TableHead className="font-bold text-slate-200 py-4 min-w-[200px]">ผู้ติดต่อ & เบอร์โทร</TableHead>
                    <TableHead className="font-bold text-slate-200 py-4 min-w-[180px]">การติดตามล่าสุด</TableHead>
                    <TableHead className="font-bold text-slate-200 py-4 w-[120px]">สถานะ</TableHead>
                    <TableHead className="text-right font-bold text-slate-200 pr-6 py-4">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white/60">
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.id} className="hover:bg-blue-50/80 transition-colors border-b-slate-100 group">
                      <TableCell className="font-bold text-blue-700 pl-6 py-4">{customer.customerId || '-'}</TableCell>
                      <TableCell className="py-4">
                        <div className="font-bold text-slate-800 line-clamp-1">{customer.companyName || 'ไม่ระบุชื่อบริษัท'}</div>
                        {getTierBadge(customer.tier)}
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="text-sm font-semibold text-slate-700">{customer.contactName || '-'}</div>
                        {customer.phone && <div className="text-xs text-blue-600 font-bold mt-1 flex items-center gap-1"><PhoneCall size={10}/> {customer.phone}</div>}
                      </TableCell>
                      <TableCell className="py-4">
                        {getContactWarning(customer.lastInteractionDate, customer.status)}
                      </TableCell>
                      <TableCell className="py-4">{getStatusBadge(customer.status)}</TableCell>
                      <TableCell className="text-right pr-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(customer)} className="text-amber-500 rounded-xl"><Edit size={16} /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteCustomer(customer.id, customer.companyName || '')} className="text-rose-500 rounded-xl"><Trash2 size={16} /></Button>
                          <Link href={`/customers/${customer.id}`}>
                            <div className="inline-flex items-center justify-center gap-1 bg-slate-900 text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-blue-600 ml-2">
                              เปิดดู <ChevronRight size={14} />
                            </div>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}