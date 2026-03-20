import React, { useEffect, useState } from 'react';
import { Plus, Search, FileText, Download, Filter, Edit, ChevronRight, AlertCircle, Building2, Package, Calendar, User, Hash, CheckCircle2, CreditCard, ArrowDownCircle, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency } from '../lib/utils';
import { generatePOPDF } from '../lib/pdfGenerator';
import { useSettingsStore } from '../store/settingsStore';

interface PurchaseOrder {
  id: string;
  poNumber: string;
  boqId?: string;
  vendorId: string;
  status: string;
  subTotal: number;
  gstAmount: number;
  totalAmount: number;
  terms?: string;
  createdAt: string;
  vendor: {
    id: string;
    name: string;
    email: string;
    address?: string;
    gstNumber?: string;
  };
  boq?: {
    id: string;
    title: string;
  };
  items: any[];
  payments?: any[];
  invoices?: any[];
  outflows?: any[];
}

export default function PurchaseOrders() {
  const { erpSettings, fetchSettings } = useSettingsStore();
  const currencySymbol = erpSettings?.currencySymbol || '₹';
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [boqs, setBoqs] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [masterItems, setMasterItems] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [newPO, setNewPO] = useState({
    boqId: '',
    vendorId: '',
    terms: '',
    items: [{ itemId: '', description: '', quantity: 1, unit: 'Nos', rate: 0, gstRate: 18 }]
  });

  useEffect(() => {
    if (isModalOpen && settings?.poTerms && !newPO.terms) {
      setNewPO(prev => ({ ...prev, terms: settings.poTerms }));
    }
  }, [settings, isModalOpen]);

  const [paymentData, setPaymentData] = useState({
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    method: 'Bank Transfer',
    reference: '',
    notes: ''
  });

  const fetchData = async () => {
    try {
      const [posRes, boqsRes, vendorsRes, itemsRes, settingsRes] = await Promise.all([
        fetch('/api/purchase-orders'),
        fetch('/api/boqs'),
        fetch('/api/vendors'),
        fetch('/api/items'),
        fetch('/api/settings')
      ]);
      
      if (posRes.ok) {
        const data = await posRes.json();
        if (Array.isArray(data)) {
          const enrichedPOs = data.map((po: any) => {
            const outflows = po.outflows || [];
            const directPaid = outflows.reduce((sum: number, out: any) => sum + (Number(out.amount) || 0), 0);
            
            const invoices = po.invoices || [];
            const invoicePaid = invoices.reduce((sum: number, inv: any) => {
              const payments = inv.payments || [];
              return sum + payments.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
            }, 0);

            const totalPaid = directPaid + invoicePaid;
            const totalAmount = Number(po.totalAmount) || 0;

            return {
              ...po,
              totalPaid,
              balance: Math.max(0, totalAmount - totalPaid)
            };
          });
          setPos(enrichedPOs);
        } else {
          console.error("PO data is not an array:", data);
          setPos([]);
        }
      }
      if (boqsRes.ok) {
        const data = await boqsRes.json();
        if (Array.isArray(data)) {
          setBoqs(data);
        } else {
          console.error("BOQ data is not an array:", data);
          setBoqs([]);
        }
      }
      if (vendorsRes.ok) {
        const data = await vendorsRes.json();
        if (Array.isArray(data)) {
          setVendors(data);
        } else {
          console.error("Vendor data is not an array:", data);
          setVendors([]);
        }
      }
      if (itemsRes.ok) {
        const data = await itemsRes.json();
        if (Array.isArray(data)) {
          setMasterItems(data);
        } else {
          console.error("Items data is not an array:", data);
          setMasterItems([]);
        }
      }
      if (settingsRes.ok) setSettings(await settingsRes.json());
    } catch (e) {
      console.error("Failed to fetch PO data", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchData();
  }, []);

  useEffect(() => {
    if (settings?.poTerms && !newPO.terms) {
      setNewPO(prev => ({ ...prev, terms: settings.poTerms }));
    }
  }, [settings]);

  const handleExportPDF = (po: any) => {
    const settingsToUse = settings || {
      companyName: "THE SUBTLE INFRA - Business Intelligence",
      address: "N/A",
      gstNumber: "N/A"
    };
    generatePOPDF(po, settingsToUse);
  };

  const handleRecordPayment = (po: any) => {
    setSelectedPO(po);
    const balance = po.balance || po.totalAmount;
    setPaymentData({
      ...paymentData,
      amount: balance,
      date: new Date().toISOString().split('T')[0]
    });
    setIsPaymentModalOpen(true);
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPO) return;

    try {
      const payload = {
        amount: Number(paymentData.amount),
        date: paymentData.date,
        method: paymentData.method,
        reference: paymentData.reference,
        notes: paymentData.notes,
        vendorId: selectedPO.vendorId,
        poId: selectedPO.id,
        boqId: selectedPO.boqId || null, // Ensure empty string becomes null
        category: 'Vendor Payment',
        description: `Payment for PO ${selectedPO.poNumber}`
      };

      console.log("[PO Payment] Submitting outflow:", payload);

      const res = await fetch('/api/outflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        console.log("[PO Payment] Outflow recorded successfully");
        setIsPaymentModalOpen(false);
        fetchData();
      } else {
        const errData = await res.json();
        console.error("[PO Payment] Failed to record outflow:", errData);
        alert(`Failed to record payment: ${errData.error || 'Unknown error'}${errData.details ? ': ' + errData.details : ''}`);
      }
    } catch (e) {
      console.error("[PO Payment] Critical submission error:", e);
      alert("Network error while recording payment");
    }
  };

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPO, setEditingPO] = useState<any>(null);

  const handleDeletePO = async (id: string) => {
    if (!confirm("Are you sure you want to delete this Purchase Order? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/purchase-orders/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete PO");
      }
    } catch (e) {
      console.error("Delete PO error", e);
    }
  };

  const handleEditPO = (po: any) => {
    setEditingPO({
      ...po,
      items: (po.items || []).map((i: any) => ({
        itemId: i.itemId || '',
        description: i.description || i.item?.name || '',
        quantity: i.quantity,
        unit: i.unit || 'Nos',
        rate: i.rate,
        gstRate: i.gstRate || 0
      }))
    });
    setIsEditModalOpen(true);
  };

  const handleUpdatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/purchase-orders/${editingPO.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPO),
      });

      if (res.ok) {
        setIsEditModalOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update PO");
      }
    } catch (e) {
      console.error("Update PO error", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Log the payload to debug
      console.log("Submitting PO with payload:", newPO);
      
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPO),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setNewPO({
          boqId: '',
          vendorId: '',
          terms: '',
          items: [{ itemId: '', description: '', quantity: 1, unit: 'Nos', rate: 0, gstRate: 18 }]
        });
        fetchData();
      } else {
        const errData = await res.json();
        alert(`Failed to create PO: ${errData.error || 'Unknown error'}`);
      }
    } catch (e) {
      console.error("Failed to create PO", e);
      alert("Network error while creating PO");
    }
  };

  const filteredPOs = pos.filter(po => 
    po.poNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    po.vendor?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">Purchase Orders</h1>
          <p className="text-slate-400 mt-2 text-lg">Manage procurement and vendor commitments.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl font-black transition-all flex items-center gap-2 shadow-xl shadow-indigo-500/20 w-fit"
        >
          <Plus size={24} />
          Create Manual PO
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={20} />
          <input
            type="text"
            placeholder="Search by PO number or vendor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
          />
        </div>
        <button className="bg-slate-900 border border-slate-800 text-slate-400 px-6 py-4 rounded-2xl font-bold hover:text-white hover:border-slate-700 transition-all flex items-center gap-2">
          <Filter size={20} />
          Filter
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredPOs.map((po) => (
          <motion.div
            key={po.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 hover:border-indigo-500/50 transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[80px] rounded-full -mr-16 -mt-16" />
            
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
              <div className="flex items-start gap-6">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform duration-500">
                  <FileText size={32} />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-2xl font-black text-white">{po.poNumber}</span>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      po.status === 'DRAFT' ? "bg-slate-800 text-slate-400" : "bg-emerald-500/10 text-emerald-400"
                    )}>
                      {po.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-slate-400 font-bold text-sm">
                    <span className="flex items-center gap-1.5">
                      <Building2 size={16} className="text-slate-600" />
                      {po.vendor.name}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-slate-700" />
                    <span className="flex items-center gap-1.5">
                      <Calendar size={16} className="text-slate-600" />
                      {new Date(po.createdAt).toLocaleDateString()}
                    </span>
                    {po.boq && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-slate-700" />
                        <span className="flex items-center gap-1.5">
                          <Package size={16} className="text-slate-600" />
                          {po.boq.name}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="flex gap-8 px-8 border-x border-slate-800">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total</p>
                    <p className="text-xl font-black text-white">{formatCurrency(po.totalAmount, currencySymbol)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Paid</p>
                    <p className="text-xl font-black text-emerald-400">
                      {formatCurrency(po.totalPaid || 0, currencySymbol)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Balance</p>
                    <p className="text-xl font-black text-rose-400">
                      {formatCurrency(po.balance !== undefined ? po.balance : po.totalAmount, currencySymbol)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleRecordPayment(po)}
                    className="p-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-xl transition-colors group/btn"
                    title="Record Payment"
                  >
                    <CreditCard size={20} className="group-hover/btn:scale-110 transition-transform" />
                  </button>
                  <button 
                    onClick={() => handleExportPDF(po)}
                    className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors"
                    title="Download PDF"
                  >
                    <Download size={20} />
                  </button>
                  <button 
                    onClick={() => handleEditPO(po)}
                    className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-indigo-400 rounded-xl transition-colors"
                    title="Edit PO"
                  >
                    <Edit size={20} />
                  </button>
                  <button 
                    onClick={() => handleDeletePO(po.id)}
                    className="p-3 bg-slate-800 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 rounded-xl transition-colors"
                    title="Delete PO"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {isPaymentModalOpen && selectedPO && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPaymentModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-800 bg-slate-800/30 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-white">Record Payment</h2>
                  <p className="text-slate-400 font-bold">PO: {selectedPO.poNumber} | Vendor: {selectedPO.vendor.name}</p>
                  <p className="text-xs text-slate-500 mt-1">Total Amount: {formatCurrency(selectedPO.totalAmount, currencySymbol)}</p>
                </div>
                <button
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
                >
                  <ChevronRight className="rotate-90" size={24} />
                </button>
              </div>

              <form onSubmit={submitPayment} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Payment Amount</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-black">{currencySymbol}</span>
                      <input
                        required
                        type="number"
                        value={paymentData.amount}
                        onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl pl-8 pr-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-black text-xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Payment Date</label>
                    <input
                      required
                      type="date"
                      value={paymentData.date}
                      onChange={(e) => setPaymentData({ ...paymentData, date: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Payment Method</label>
                    <select
                      value={paymentData.method}
                      onChange={(e) => setPaymentData({ ...paymentData, method: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold appearance-none"
                    >
                      <option>Bank Transfer</option>
                      <option>Cash</option>
                      <option>Cheque</option>
                      <option>UPI</option>
                      <option>Credit Card</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Reference #</label>
                    <input
                      type="text"
                      placeholder="Transaction ID, Cheque #..."
                      value={paymentData.reference}
                      onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Notes</label>
                  <textarea
                    value={paymentData.notes}
                    onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold min-h-[100px]"
                    placeholder="Optional payment notes..."
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsPaymentModalOpen(false)}
                    className="flex-1 py-4 rounded-2xl font-black text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-black transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2"
                  >
                    <ArrowDownCircle size={20} />
                    Confirm Payment
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isEditModalOpen && editingPO && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-800 bg-slate-800/30 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-white">Edit Purchase Order</h2>
                  <p className="text-slate-400 font-bold">#{editingPO.poNumber} | {editingPO.vendor?.name}</p>
                </div>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
                >
                  <ChevronRight className="rotate-90" size={24} />
                </button>
              </div>

              <form onSubmit={handleUpdatePO} className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Status</label>
                    <select
                      value={editingPO.status}
                      onChange={(e) => setEditingPO({ ...editingPO, status: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold appearance-none"
                    >
                      <option value="DRAFT">DRAFT</option>
                      <option value="SENT">SENT</option>
                      <option value="RECEIVED">RECEIVED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black text-white uppercase tracking-wider">Line Items</h3>
                    <button
                      type="button"
                      onClick={() => setEditingPO({
                        ...editingPO,
                        items: [...editingPO.items, { description: '', quantity: 1, unit: 'Nos', rate: 0, gstRate: 18 }]
                      })}
                      className="text-indigo-400 hover:text-indigo-300 font-black text-sm flex items-center gap-2"
                    >
                      <Plus size={16} />
                      Add Item
                    </button>
                  </div>

                  {editingPO.items.map((item: any, index: number) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-6 bg-slate-800/30 border border-slate-800 rounded-3xl relative group">
                      <div className="md:col-span-4 space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Description</label>
                        <input
                          required
                          type="text"
                          value={item.description}
                          onChange={(e) => {
                            const newItems = [...editingPO.items];
                            newItems[index].description = e.target.value;
                            setEditingPO({ ...editingPO, items: newItems });
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                        />
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Qty</label>
                        <input
                          required
                          type="number"
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...editingPO.items];
                            newItems[index].quantity = parseFloat(e.target.value);
                            setEditingPO({ ...editingPO, items: newItems });
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                        />
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Rate</label>
                        <input
                          required
                          type="number"
                          value={item.rate}
                          onChange={(e) => {
                            const newItems = [...editingPO.items];
                            newItems[index].rate = parseFloat(e.target.value);
                            setEditingPO({ ...editingPO, items: newItems });
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                        />
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">GST %</label>
                        <input
                          required
                          type="number"
                          value={item.gstRate}
                          onChange={(e) => {
                            const newItems = [...editingPO.items];
                            newItems[index].gstRate = parseFloat(e.target.value);
                            setEditingPO({ ...editingPO, items: newItems });
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                        />
                      </div>
                      <div className="md:col-span-2 flex items-end pb-3">
                        <button
                          type="button"
                          onClick={() => {
                            const newItems = editingPO.items.filter((_: any, i: number) => i !== index);
                            setEditingPO({ ...editingPO, items: newItems });
                          }}
                          className="text-rose-500 hover:text-rose-400 p-2"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Terms & Conditions</label>
                  <textarea
                    value={editingPO.terms}
                    onChange={(e) => setEditingPO({ ...editingPO, terms: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold min-h-[150px]"
                  />
                </div>

                <div className="mt-12 flex items-center justify-end gap-4">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-8 py-4 rounded-2xl font-black text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-12 py-4 rounded-2xl font-black transition-all shadow-xl shadow-indigo-500/20"
                  >
                    Update Purchase Order
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-800 bg-slate-800/30 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-white">Create Purchase Order</h2>
                  <p className="text-slate-400 font-bold">Fill in the details to generate a new PO.</p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
                >
                  <ChevronRight className="rotate-90" size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Select Vendor</label>
                    <select
                      required
                      value={newPO.vendorId}
                      onChange={(e) => setNewPO({ ...newPO, vendorId: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold appearance-none"
                    >
                      <option value="">Choose a vendor...</option>
                      {vendors.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Link to BOQ (Optional)</label>
                    <select
                      value={newPO.boqId}
                      onChange={(e) => setNewPO({ ...newPO, boqId: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold appearance-none"
                    >
                      <option value="">Standalone PO</option>
                      {boqs.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black text-white uppercase tracking-wider">Line Items</h3>
                    <button
                      type="button"
                      onClick={() => setNewPO({
                        ...newPO,
                        items: [...newPO.items, { description: '', quantity: 1, unit: 'Nos', rate: 0, gstRate: 18 }]
                      })}
                      className="text-indigo-400 hover:text-indigo-300 font-black text-sm flex items-center gap-2"
                    >
                      <Plus size={16} />
                      Add Item
                    </button>
                  </div>

                  {newPO.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-6 bg-slate-800/30 border border-slate-800 rounded-3xl relative group">
                      <div className="md:col-span-4 space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Select Item Master</label>
                        <select
                          value={item.itemId || ''}
                          onChange={(e) => {
                            const master = masterItems.find(m => m.id === e.target.value);
                            const newItems = [...newPO.items];
                            newItems[index] = {
                              ...newItems[index],
                              itemId: e.target.value,
                              description: master?.name || '',
                              unit: master?.unit || 'Nos',
                              gstRate: 18
                            };
                            setNewPO({ ...newPO, items: newItems });
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold appearance-none"
                        >
                          <option value="">Manual Entry...</option>
                          {masterItems.map(m => (
                            <option key={m.id} value={m.id}>{m.itemCode} - {m.name}</option>
                          ))}
                        </select>
                        <input
                          required
                          type="text"
                          placeholder="Custom Description"
                          value={item.description}
                          onChange={(e) => {
                            const newItems = [...newPO.items];
                            newItems[index].description = e.target.value;
                            setNewPO({ ...newPO, items: newItems });
                          }}
                          className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Qty</label>
                        <input
                          required
                          type="number"
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...newPO.items];
                            newItems[index].quantity = parseFloat(e.target.value);
                            setNewPO({ ...newPO, items: newItems });
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                        />
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Rate</label>
                        <input
                          required
                          type="number"
                          value={item.rate}
                          onChange={(e) => {
                            const newItems = [...newPO.items];
                            newItems[index].rate = parseFloat(e.target.value);
                            setNewPO({ ...newPO, items: newItems });
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                        />
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">GST %</label>
                        <select
                          value={item.gstRate}
                          onChange={(e) => {
                            const newItems = [...newPO.items];
                            newItems[index].gstRate = parseInt(e.target.value);
                            setNewPO({ ...newPO, items: newItems });
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold appearance-none"
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </div>
                      <div className="md:col-span-2 flex items-end pb-3">
                        <button
                          type="button"
                          onClick={() => {
                            const newItems = newPO.items.filter((_, i) => i !== index);
                            setNewPO({ ...newPO, items: newItems });
                          }}
                          className="text-rose-500 hover:text-rose-400 p-2"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Terms & Conditions (PO Specific)</label>
                  <textarea
                    value={newPO.terms}
                    onChange={(e) => setNewPO({ ...newPO, terms: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold min-h-[150px]"
                    placeholder="Enter specific terms for this PO..."
                  />
                </div>

                <div className="mt-12 flex items-center justify-between">
                  <div className="text-slate-400 font-bold">
                    Total Items: {newPO.items.length}
                  </div>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-8 py-4 rounded-2xl font-black text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-12 py-4 rounded-2xl font-black transition-all shadow-xl shadow-indigo-500/20"
                    >
                      Generate Purchase Order
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
