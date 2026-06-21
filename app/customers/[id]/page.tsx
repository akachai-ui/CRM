"use client";

import { useEffect, useState } from "react";
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
import { ArrowLeft, Building2, User, Phone, Mail, MapPin, MessageSquare, Calendar, Plus, Loader2, Edit, Trash2 } from "lucide-react";

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

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);

  // สถานะฟอร์มบันทึกการคุย
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingInteractionId, setEditingInteractionId] = useState<string | null>(null); // จำ ID ว่ากำลังแก้ไขอันไหน
  
  const today = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    subject: "",
    notes: "",
    interactionDate: today,
    nextAppointmentDate: "",
    status: "Ongoing",
    contactPerson: ""
  });

  async function fetchData() {
    if (!params.id) return;
    
    try {
      const docRef = doc(db, "customers", params.id as string);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const custData = { id: docSnap.id, ...docSnap.data() } as Customer;
        setCustomer(custData);
        // ไม่ต้อง setFormData contactPerson ที่นี่แล้ว ไป set ตอนกดปุ่ม Add แทน

        if (custData.customerId) {
          const q = query(
            collection(db, "customerInteractions"),
            where("customerId", "==", custData.customerId)
          );
          const interactionSnap = await getDocs(q);
          const interactionList: Interaction[] = [];
          
          interactionSnap.forEach((doc) => {
            interactionList.push({ id: doc.id, ...doc.data() } as Interaction);
          });
          
          interactionList.sort((a, b) => {
            const dateA = a.interactionDate ? new Date(a.interactionDate).getTime() : 0;
            const dateB = b.interactionDate ? new Date(b.interactionDate).getTime() : 0;
            return dateB - dateA;
          });

          setInteractions(interactionList);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [params.id]);

  // เปิดฟอร์ม เพิ่มประวัติใหม่
  const openAddInteractionDialog = () => {
    setEditingInteractionId(null);
    setFormData({
      subject: "", notes: "", interactionDate: today,
      nextAppointmentDate: "", status: "Ongoing", contactPerson: customer?.contactName || ""
    });
    setIsDialogOpen(true);
  };

  // เปิดฟอร์ม แก้ไขประวัติเดิม
  const openEditInteractionDialog = (interaction: Interaction) => {
    setEditingInteractionId(interaction.id);
    setFormData({
      subject: interaction.subject || "",
      notes: interaction.notes || "",
      interactionDate: interaction.interactionDate || today,
      nextAppointmentDate: interaction.nextAppointmentDate || "",
      status: interaction.status || "Ongoing",
      contactPerson: interaction.contactPerson || ""
    });
    setIsDialogOpen(true);
  };

  // ลบประวัติ
  const handleDeleteInteraction = async (id: string, subject: string) => {
    if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบประวัติการพูดคุยหัวข้อ "${subject}"?`)) {
      try {
        await deleteDoc(doc(db, "customerInteractions", id));
        fetchData();
      } catch (error) {
        console.error("Error deleting interaction:", error);
      }
    }
  };

  // บันทึก หรือ อัปเดต ประวัติ
  const handleSaveInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer?.customerId) {
      alert("ไม่สามารถบันทึกได้ เนื่องจากบริษัทนี้ไม่มีรหัสลูกค้า");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingInteractionId) {
        // อัปเดตข้อมูลเดิม
        const docRef = doc(db, "customerInteractions", editingInteractionId);
        await updateDoc(docRef, {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        // เพิ่มข้อมูลใหม่
        await addDoc(collection(db, "customerInteractions"), {
          ...formData,
          customerId: customer.customerId,
          customerName: customer.companyName || "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      setIsDialogOpen(false);
      fetchData(); 
    } catch (error) {
      console.error("Error saving interaction: ", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-500">กำลังโหลดข้อมูล...</div>;
  if (!customer) return <div className="p-10 text-center text-slate-500">ไม่พบข้อมูลลูกค้า</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24 px-2 sm:px-4">
      
      {/* ส่วนหัว และปุ่มย้อนกลับ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white/50 p-4 rounded-2xl border border-slate-200/60 shadow-sm backdrop-blur-md">
        <Button variant="outline" size="icon" onClick={() => router.back()} className="rounded-xl border-slate-200 shrink-0">
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </Button>
        {customer.logoUrl && (
          <img src={customer.logoUrl} alt="logo" className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md shrink-0 hidden sm:block" />
        )}
        <div className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 truncate">{customer.companyName || 'ไม่ระบุชื่อบริษัท'}</h1>
            <Badge className={`w-fit px-3 py-1 ${customer.status === 'ลูกค้า' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-blue-500 hover:bg-blue-600'}`}>
              {customer.status || 'ติดตาม'}
            </Badge>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-slate-500 font-medium text-sm sm:text-base">
              รหัสลูกค้า: <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md ml-1">{customer.customerId || '-'}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* กล่องข้อมูลบริษัท */}
        <Card className="glass bento-shadow border-white/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg text-slate-800 border-b border-slate-100 pb-4">
              <Building2 className="w-5 h-5 text-indigo-500" /> ข้อมูลบริษัท
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <p className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">ประเภทธุรกิจ</p>
                <p className="text-slate-700 font-semibold">{customer.businessType || '-'}</p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">เลขผู้เสียภาษี</p>
                <p className="text-slate-700 font-semibold">{customer.taxId || '-'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">เว็บไซต์</p>
                <p className="text-blue-600 font-semibold truncate">
                  {customer.website ? <a href={customer.website} target="_blank" rel="noreferrer" className="hover:underline">{customer.website}</a> : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* กล่องข้อมูลผู้ติดต่อ */}
        <Card className="glass bento-shadow border-white/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg text-slate-800 border-b border-slate-100 pb-4">
              <User className="w-5 h-5 text-blue-500" /> ข้อมูลผู้ติดต่อ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <p className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">ชื่อผู้ติดต่อ</p>
                <p className="text-lg font-bold text-slate-800">{customer.contactName || '-'}</p>
                <p className="text-sm text-slate-500 font-medium">{customer.contactPosition || 'ตำแหน่ง: -'}</p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider"><Phone className="w-3 h-3"/> เบอร์โทรศัพท์</div>
                <p className="text-slate-700 font-semibold">{customer.phone || '-'}</p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider"><Mail className="w-3 h-3"/> อีเมล</div>
                <p className="text-slate-700 font-semibold truncate">{customer.email || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* กล่องข้อมูลที่อยู่ */}
        <Card className="glass bento-shadow border-white/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg text-slate-800 border-b border-slate-100 pb-4">
              <MapPin className="w-5 h-5 text-rose-500" /> ที่อยู่
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <p className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">ตำบล/แขวง</p>
                <p className="text-slate-700 font-semibold">{customer.subdistrict || '-'}</p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">อำเภอ/เขต</p>
                <p className="text-slate-700 font-semibold">{customer.district || '-'}</p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">จังหวัด</p>
                <p className="text-slate-700 font-semibold">{customer.province || '-'}</p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">รหัสไปรษณีย์</p>
                <p className="text-slate-700 font-semibold">{customer.zipcode || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* กล่องข้อมูลการเงิน */}
        <Card className="glass bento-shadow border-white/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg text-slate-800 border-b border-slate-100 pb-4">
              <svg className="w-5 h-5 text-amber-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
              ข้อมูลการเงิน
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <p className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">ทุนจดทะเบียน</p>
                <p className="text-slate-700 font-semibold">{customer.registeredCapital || '-'}</p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">เครดิตเทอม</p>
                <p className="text-slate-700 font-semibold">{customer.creditTerms ? `${customer.creditTerms} วัน` : '-'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">วงเงินเครดิต</p>
                <p className="text-slate-700 font-semibold">{customer.creditLimit || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* ---------------- ประวัติการติดต่อ (Interaction History) ---------------- */}
      <div className="mt-12 bg-white/40 p-4 sm:p-6 rounded-3xl border border-white/50 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="text-blue-500" /> ประวัติการพูดคุย <Badge variant="secondary" className="ml-2 bg-white">{interactions.length}</Badge>
          </h2>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <Button onClick={openAddInteractionDialog} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md">
              <Plus className="w-4 h-4 mr-1" /> เพิ่มประวัติ
            </Button>
            <DialogContent className="sm:max-w-[500px] w-[95vw] rounded-2xl glass">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-slate-800">
                  {editingInteractionId ? "แก้ไขประวัติการติดต่อ" : "บันทึกการติดต่อใหม่"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveInteraction} className="space-y-4 mt-4">
                <div className="space-y-1">
                  <Label>หัวข้อการสนทนา *</Label>
                  <Input required placeholder="เช่น นำเสนอสินค้า, โทรติดตามผล" className="rounded-xl"
                    value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})}
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>วันที่คุย *</Label>
                    <Input type="date" required className="rounded-xl"
                      value={formData.interactionDate} onChange={e => setFormData({...formData, interactionDate: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>วันที่นัดหมายครั้งถัดไป</Label>
                    <Input type="date" className="rounded-xl"
                      value={formData.nextAppointmentDate} onChange={e => setFormData({...formData, nextAppointmentDate: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>คุยกับใคร</Label>
                    <Input className="rounded-xl"
                      value={formData.contactPerson} onChange={e => setFormData({...formData, contactPerson: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>สถานะการเจรจา</Label>
                    <select 
                      className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}
                    >
                      <option value="Ongoing">Ongoing (กำลังเจรจา)</option>
                      <option value="Close">Close (ปิดการขาย/สำเร็จ)</option>
                      <option value="Lost">Lost (ปฏิเสธ/ไม่สำเร็จ)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>รายละเอียด / โน้ตเพิ่มเติม</Label>
                  <Textarea placeholder="จดบันทึกสิ่งที่คุณคุยกับลูกค้า..." className="rounded-xl resize-none h-24"
                    value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}
                  />
                </div>
                
                <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl w-full sm:w-auto">
                    ยกเลิก
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
                    {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> กำลังบันทึก...</> : 'บันทึกประวัติ'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {interactions.length === 0 ? (
          <div className="glass p-10 rounded-2xl border-dashed border-2 border-slate-200 flex flex-col items-center justify-center text-slate-400">
            <MessageSquare className="w-10 h-10 mb-3 opacity-50" />
            <p>ยังไม่มีประวัติการพูดคุยกับลูกค้ารายนี้</p>
          </div>
        ) : (
          <div className="space-y-4">
            {interactions.map((interaction) => (
              <Card key={interaction.id} className="bg-white border-slate-200 hover:-translate-y-1 transition-all duration-300 shadow-sm relative group">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-2">
                    <div>
                      <Badge variant={interaction.status === 'Close' ? 'default' : interaction.status === 'Lost' ? 'destructive' : 'secondary'} 
                             className={`${interaction.status === 'Close' ? 'bg-emerald-500' : interaction.status === 'Ongoing' ? 'bg-amber-500 text-white' : ''} mb-2`}>
                        {interaction.status || 'Ongoing'}
                      </Badge>
                      <h3 className="text-lg font-bold text-slate-800 leading-tight pr-10">{interaction.subject || 'ไม่ระบุหัวข้อ'}</h3>
                      <p className="text-xs text-slate-400 font-medium mt-1">ติดต่อ: {interaction.contactPerson || '-'}</p>
                    </div>
                    
                    <div className="flex flex-row sm:flex-col sm:items-end items-center gap-2 w-full sm:w-auto justify-between sm:justify-start mt-2 sm:mt-0">
                      <p className="text-xs sm:text-sm font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                        {interaction.interactionDate || '-'}
                      </p>
                      {/* ปุ่มแก้ไข และ ปุ่มลบ */}
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={() => openEditInteractionDialog(interaction)} className="text-amber-500 hover:text-amber-600 hover:bg-amber-50 h-8 w-8 rounded-xl" title="แก้ไขประวัติ">
                          <Edit size={16} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteInteraction(interaction.id, interaction.subject || '')} className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 h-8 w-8 rounded-xl" title="ลบประวัติ">
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50/50 p-3 sm:p-4 rounded-xl text-slate-700 text-sm leading-relaxed border border-slate-100 whitespace-pre-wrap">
                    {interaction.notes || 'ไม่มีรายละเอียด'}
                  </div>

                  {interaction.nextAppointmentDate && (
                    <div className="mt-4 flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium border border-blue-100 w-fit">
                      <Calendar className="w-4 h-4 shrink-0" /> นัดหมายถัดไป: {interaction.nextAppointmentDate}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}