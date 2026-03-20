import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ShoppingCart, FileText, Download, Clock, CheckCircle2, Package, User, Mail, Phone, CreditCard, Plus, Upload, AlertCircle } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { useSettingsStore } from '../store/settingsStore';
import { motion, AnimatePresence } from 'motion/react';
import Logo from '../components/Logo';

export default function VendorPortal() {
  const { token } = useParams();
  const [vendor, setVendor] = useState<any>(null);
  const [pos, setPos] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pos' | 'invoices' | 'payments' | 'rates'>('pos');
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  const [newInvoice, setNewInvoice] = useState({ purchaseOrderId: '', invoiceNumber: '', amount: '', fileUrl: '' });
  const [newRate, setNewRate] = useState({ id: '', itemId: '', vendorItemName: '', vendorCategory: '', submittedRate: '', vendorUnit: '', remarks: '' });
  const [itemSearch, setItemSearch] = useState('');
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false);
  const { erpSettings, fetchSettings } = useSettingsStore();
  const currencySymbol = erpSettings?.currencySymbol || '₹';

  const fetchData = async () => {
    try {
      fetchSettings();
      const vendorRes = await fetch(`/api/public/vendor-portal/${token}`);
      if (vendorRes.ok) {
        const vendorData = await vendorRes.json();
        setVendor(vendorData);

        const [posRes, invoicesRes, paymentsRes, itemsRes, ratesRes] = await Promise.all([
          fetch(`/api/public/vendor-portal/${token}/pos`),
          fetch(`/api/public/vendor-portal/${token}/invoices`),
          fetch(`/api/public/vendor-portal/${token}/payments`),
          fetch(`/api/public/vendor-portal/${token}/items`),
          fetch(`/api/public/vendor-portal/${token}/rates`)
        ]);

        setPos(await posRes.json());
        setInvoices(await invoicesRes.json());
        setPayments(await paymentsRes.json());
        setItems(await itemsRes.json());
        setRates(await ratesRes.json());
      }
    } catch (e) {
      console.error("Failed to fetch portal data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchPODetails = async (poId: string) => {
    const res = await fetch(`/api/public/vendor-portal/${token}/pos/${poId}`);
    if (res.ok) {
      const data = await res.json();
      setSelectedPO(data);
    }
  };

  const handleDownload = (fileUrl: string) => {
    window.open(fileUrl, '_blank');
  };

  const handleInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/public/vendor-portal/${token}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newInvoice),
    });
    if (res.ok) {
      setIsInvoiceModalOpen(false);
      setNewInvoice({ purchaseOrderId: '', invoiceNumber: '', amount: '', fileUrl: '' });
      fetchData();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to submit invoice");
    }
  };

  const handleRateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(newRate.submittedRate);
    if (isNaN(rate) || rate <= 0) {
      alert("Please enter a valid rate greater than 0");
      return;
    }
    const url = newRate.id 
      ? `/api/public/vendor-portal/${token}/rates/${newRate.id}`
      : `/api/public/vendor-portal/${token}/rates`;
    
    const res = await fetch(url, {
      method: newRate.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newRate, submittedRate: rate }),
    });
    if (res.ok) {
      setIsRateModalOpen(false);
      setNewRate({ id: '', itemId: '', vendorItemName: '', vendorCategory: '', submittedRate: '', vendorUnit: '', remarks: '' });
      setItemSearch('');
      fetchData();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to submit rate");
    }
  };

  const handleEditRate = (rate: any) => {
    setNewRate({
      id: rate.id,
      itemId: rate.itemId || 'new',
      vendorItemName: rate.vendorItemName || '',
      vendorCategory: rate.vendorCategory || '',
      submittedRate: rate.submittedRate?.toString() || '',
      vendorUnit: rate.vendorUnit || '',
      remarks: rate.remarks || ''
    });
    const itemName = rate.item?.name || rate.vendorItemName || '';
    setItemSearch(itemName);
    setIsRateModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Invalid Access Link</h1>
          <p className="text-slate-400">Please contact THE SUBTLEINFRA PVT LTD for a valid portal link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-20">
      {/* Header */}
      <header className="bg-slate-900/50 border-b border-slate-800 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={40} />
            <div>
              <h1 className="text-lg font-bold tracking-tight">Vendor Portal</h1>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">THE SUBTLEINFRA PVT LTD</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-right hidden sm:block">
              <p className="font-bold text-white">{vendor.name}</p>
              <p className="text-xs text-slate-500">{vendor.email}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-indigo-400 font-bold border border-slate-700">
              {vendor.name[0]}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Tabs */}
        <div className="flex gap-4 mb-10 border-b border-slate-800 pb-px">
          <button
            onClick={() => setActiveTab('pos')}
            className={cn(
              "px-6 py-4 text-sm font-bold uppercase tracking-widest transition-all relative",
              activeTab === 'pos' ? "text-indigo-400" : "text-slate-500 hover:text-slate-300"
            )}
          >
            Purchase Orders
            {activeTab === 'pos' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />}
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={cn(
              "px-6 py-4 text-sm font-bold uppercase tracking-widest transition-all relative",
              activeTab === 'invoices' ? "text-indigo-400" : "text-slate-500 hover:text-slate-300"
            )}
          >
            Invoices
            {activeTab === 'invoices' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />}
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={cn(
              "px-6 py-4 text-sm font-bold uppercase tracking-widest transition-all relative",
              activeTab === 'payments' ? "text-indigo-400" : "text-slate-500 hover:text-slate-300"
            )}
          >
            Payments
            {activeTab === 'payments' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />}
          </button>
          <button
            onClick={() => setActiveTab('rates')}
            className={cn(
              "px-6 py-4 text-sm font-bold uppercase tracking-widest transition-all relative",
              activeTab === 'rates' ? "text-indigo-400" : "text-slate-500 hover:text-slate-300"
            )}
          >
            Rate Submission
            {activeTab === 'rates' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />}
          </button>
        </div>

        {activeTab === 'pos' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* PO List */}
            <div className="lg:col-span-1 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <FileText size={20} className="text-indigo-400" />
                  Orders
                </h2>
                <span className="bg-slate-800 text-slate-400 px-2 py-1 rounded text-[10px] font-bold uppercase">
                  {pos.length} Total
                </span>
              </div>

              <div className="space-y-3">
                {pos.map((po) => (
                  <button
                    key={po.id}
                    onClick={() => fetchPODetails(po.id)}
                    className={cn(
                      "w-full text-left p-4 rounded-2xl border transition-all group",
                      selectedPO?.id === po.id 
                        ? "bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-500/20" 
                        : "bg-slate-900 border-slate-800 hover:border-slate-700"
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={cn(
                        "font-bold",
                        selectedPO?.id === po.id ? "text-white" : "text-slate-200"
                      )}>
                        PO-{po.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded",
                        selectedPO?.id === po.id 
                          ? "bg-white/20 text-white" 
                          : "bg-slate-800 text-slate-400"
                      )}>
                        {po.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs opacity-60">
                      <Clock size={12} />
                      {new Date(po.createdAt).toLocaleDateString()}
                    </div>
                    <div className="mt-3 text-lg font-bold">
                      {formatCurrency(po.totalAmount, currencySymbol)}
                    </div>
                  </button>
                ))}
                {pos.length === 0 && (
                  <div className="p-10 text-center bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl">
                    <ShoppingCart size={32} className="text-slate-700 mx-auto mb-3" />
                    <p className="text-sm text-slate-500 italic">No Purchase Orders found.</p>
                  </div>
                )}
              </div>
            </div>

            {/* PO Detail View */}
            <div className="lg:col-span-2">
              {selectedPO ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white text-slate-950 rounded-3xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none"
                >
                  {/* PO Header */}
                  <div className="p-8 bg-slate-950 text-white flex justify-between items-start">
                    <div>
                      <h3 className="text-2xl font-bold mb-1">PURCHASE ORDER</h3>
                      <p className="text-slate-400 text-sm">PO-{selectedPO.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">THE SUBTLEINFRA PVT LTD</p>
                      <p className="text-slate-400 text-xs">Procurement Department</p>
                    </div>
                  </div>

                  {/* PO Info */}
                  <div className="p-8 grid grid-cols-2 gap-8 border-b border-slate-100">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Vendor Details</p>
                      <p className="font-bold text-lg">{vendor.name}</p>
                      <p className="text-slate-500 text-sm">{vendor.email}</p>
                      {vendor.contactInfo && <p className="text-slate-500 text-sm">{vendor.contactInfo}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Order Details</p>
                      <p className="text-sm"><span className="text-slate-400">Date:</span> {new Date(selectedPO.createdAt).toLocaleDateString()}</p>
                      <p className="text-sm"><span className="text-slate-400">BOQ Reference:</span> {selectedPO.boq.name}</p>
                      <p className="text-sm"><span className="text-slate-400">Status:</span> <span className="font-bold text-indigo-600 uppercase">{selectedPO.status}</span></p>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="p-8">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b-2 border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          <th className="py-4">Item Description</th>
                          <th className="py-4 text-center">Unit</th>
                          <th className="py-4 text-right">Quantity</th>
                          <th className="py-4 text-right">Rate</th>
                          <th className="py-4 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {selectedPO.items.map((item: any) => (
                          <tr key={item.id} className="text-sm">
                            <td className="py-4 font-medium">{item.item.name}</td>
                            <td className="py-4 text-center text-slate-500">{item.item.unit}</td>
                            <td className="py-4 text-right font-bold">{item.quantity}</td>
                            <td className="py-4 text-right text-slate-500">{formatCurrency(item.rate, currencySymbol)}</td>
                            <td className="py-4 text-right font-bold">{formatCurrency(item.total, currencySymbol)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-100">
                          <td colSpan={4} className="py-6 text-right font-bold text-slate-400 uppercase tracking-widest">Grand Total</td>
                          <td className="py-6 text-right text-2xl font-bold text-indigo-600">{formatCurrency(selectedPO.totalAmount, currencySymbol)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Footer Actions */}
                  <div className="p-8 bg-slate-50 flex justify-between items-center print:hidden">
                    <p className="text-xs text-slate-400 italic">This is a computer-generated document.</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setNewInvoice({ ...newInvoice, purchaseOrderId: selectedPO.id, amount: selectedPO.totalAmount.toString() });
                          setIsInvoiceModalOpen(true);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-bold transition-all shadow-lg shadow-emerald-500/20"
                      >
                        <Plus size={20} />
                        Submit Invoice
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-bold transition-all shadow-lg shadow-indigo-500/20"
                      >
                        <Download size={20} />
                        Download PDF
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-slate-900/30 border border-dashed border-slate-800 rounded-3xl p-10 text-center">
                  <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-600 mb-6">
                    <FileText size={40} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Select an Order</h3>
                  <p className="text-slate-500 max-w-xs">Choose a purchase order from the list on the left to view full details and download.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileText size={20} className="text-indigo-400" />
                Submitted Invoices
              </h2>
              <button
                onClick={() => setIsInvoiceModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-all"
              >
                <Plus size={18} />
                New Invoice
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Invoice #</p>
                      <p className="text-lg font-bold text-white">{invoice.invoiceNumber}</p>
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded",
                      invoice.status === 'Paid' ? "bg-emerald-400/10 text-emerald-400" :
                      invoice.status === 'Pending' ? "bg-amber-400/10 text-amber-400" :
                      "bg-slate-800 text-slate-400"
                    )}>
                      {invoice.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">PO Reference</p>
                      <p className="text-sm font-medium text-slate-300">PO-{invoice.purchaseOrder.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 mb-1">Amount</p>
                      <p className="text-xl font-bold text-white">{formatCurrency(invoice.amount, currencySymbol)}</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock size={14} />
                      {new Date(invoice.submittedAt).toLocaleDateString()}
                    </div>
                    {invoice.fileUrl && (
                      <a href={invoice.fileUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 text-xs font-bold flex items-center gap-1">
                        <Download size={14} />
                        View File
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {invoices.length === 0 && (
                <div className="col-span-full p-20 text-center bg-slate-900/50 border border-dashed border-slate-800 rounded-3xl">
                  <FileText size={40} className="text-slate-700 mx-auto mb-4" />
                  <p className="text-slate-500">No invoices submitted yet.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'rates' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Plus size={20} className="text-indigo-400" />
                Submit Your Rates
              </h2>
              <button
                onClick={() => setIsRateModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-all"
              >
                <Plus size={18} />
                Submit New Rate
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-800/50 text-slate-400 text-xs uppercase tracking-wider font-bold">
                    <th className="px-6 py-4">Item</th>
                    <th className="px-6 py-4">Submitted Rate</th>
                    <th className="px-6 py-4">Unit</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {rates.map((rate) => (
                    <tr key={rate.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-white">{rate.item?.name || rate.vendorItemName || 'New Item'}</p>
                        <p className="text-[10px] text-slate-500">{rate.remarks || 'No remarks'}</p>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-indigo-400">
                        {formatCurrency(rate.submittedRate, currencySymbol)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">{rate.vendorUnit}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded",
                          rate.status === 'Active' ? "bg-emerald-400/10 text-emerald-400" :
                          rate.status === 'Pending' ? "bg-amber-400/10 text-amber-400" :
                          "bg-slate-800 text-slate-400"
                        )}>
                          {rate.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {new Date(rate.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleEditRate(rate)}
                          className="text-indigo-400 hover:text-indigo-300 text-xs font-bold"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {rates.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center text-slate-500 italic">
                        No rates submitted yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <CreditCard size={20} className="text-indigo-400" />
              Payment History
            </h2>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-800/50 text-slate-400 text-xs uppercase tracking-wider font-bold">
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Invoice #</th>
                    <th className="px-6 py-4">Method</th>
                    <th className="px-6 py-4">Transaction ID</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-300">
                        {new Date(payment.paymentDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-white">{payment.invoice.invoiceNumber}</p>
                        <p className="text-[10px] text-slate-500">PO-{payment.invoice.purchaseOrder.id.slice(0, 8).toUpperCase()}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">{payment.method || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm font-mono text-slate-500">{payment.transactionId || 'N/A'}</td>
                      <td className="px-6 py-4 text-right font-bold text-emerald-400">
                        {formatCurrency(payment.amount, currencySymbol)}
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center text-slate-500 italic">
                        No payment records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Rate Submission Modal */}
      <AnimatePresence>
        {isRateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRateModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-800">
                <h3 className="text-2xl font-bold text-white">{newRate.id ? 'Edit Rate' : 'Submit Rate'}</h3>
                <p className="text-slate-400 text-sm mt-1">
                  {newRate.id ? 'Update your previously submitted rate.' : 'Submit your competitive rate for an item.'}
                </p>
              </div>

              <form onSubmit={handleRateSubmit} className="p-8 space-y-6">
                <div className="relative">
                  <label className="block text-sm font-medium text-slate-400 mb-2">Search or Add Item</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={itemSearch}
                      onChange={(e) => {
                        setItemSearch(e.target.value);
                        setIsItemDropdownOpen(true);
                        if (newRate.itemId !== 'new') {
                          setNewRate({ ...newRate, itemId: '', vendorItemName: e.target.value });
                        } else {
                          setNewRate({ ...newRate, vendorItemName: e.target.value });
                        }
                      }}
                      onFocus={() => setIsItemDropdownOpen(true)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Search for an item or type to add new..."
                      required
                    />
                    {isItemDropdownOpen && (
                      <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                        {items
                          .filter(item => item.name.toLowerCase().includes(itemSearch.toLowerCase()))
                          .map(item => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setNewRate({ ...newRate, itemId: item.id, vendorUnit: item.unit });
                                setItemSearch(item.name);
                                setIsItemDropdownOpen(false);
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors text-sm"
                            >
                              <p className="font-bold text-white">{item.name}</p>
                              <p className="text-[10px] text-slate-500">{item.category} • {item.unit}</p>
                            </button>
                          ))}
                        <button
                          type="button"
                          onClick={() => {
                            setNewRate({ ...newRate, itemId: 'new', vendorItemName: itemSearch });
                            setIsItemDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-indigo-600 transition-colors text-sm border-t border-slate-700"
                        >
                          <p className="font-bold text-white flex items-center gap-2">
                            <Plus size={14} />
                            Add "{itemSearch}" as new item
                          </p>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {newRate.itemId === 'new' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4 p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl"
                  >
                    <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">New Item Details</p>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Item Name</label>
                      <input
                        type="text"
                        value={newRate.vendorItemName}
                        onChange={(e) => setNewRate({ ...newRate, vendorItemName: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Enter full item name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Category</label>
                      <input
                        type="text"
                        value={newRate.vendorCategory}
                        onChange={(e) => setNewRate({ ...newRate, vendorCategory: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g. Civil, Electrical"
                        required
                      />
                    </div>
                  </motion.div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Your Rate ({currencySymbol})</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newRate.submittedRate}
                      onChange={(e) => setNewRate({ ...newRate, submittedRate: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Unit</label>
                    <input
                      type="text"
                      value={newRate.vendorUnit}
                      onChange={(e) => setNewRate({ ...newRate, vendorUnit: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. SQFT, NOS"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Remarks / Specs</label>
                  <textarea
                    value={newRate.remarks}
                    onChange={(e) => setNewRate({ ...newRate, remarks: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
                    placeholder="Provide any specific details about your rate..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsRateModalOpen(false)}
                    className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all"
                  >
                    Submit Rate
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invoice Submission Modal */}
      <AnimatePresence>
        {isInvoiceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsInvoiceModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-800">
                <h3 className="text-2xl font-bold text-white">Submit Invoice</h3>
                <p className="text-slate-400 text-sm mt-1">Provide details for your invoice submission.</p>
              </div>

              <form onSubmit={handleInvoiceSubmit} className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Select Purchase Order</label>
                  <select
                    value={newInvoice.purchaseOrderId}
                    onChange={(e) => setNewInvoice({ ...newInvoice, purchaseOrderId: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">Choose an order...</option>
                    {pos.map(po => (
                      <option key={po.id} value={po.id}>PO-{po.id.slice(0, 8).toUpperCase()} ({formatCurrency(po.totalAmount, currencySymbol)})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Invoice Number</label>
                    <input
                      type="text"
                      value={newInvoice.invoiceNumber}
                      onChange={(e) => setNewInvoice({ ...newInvoice, invoiceNumber: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="INV-001"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newInvoice.amount}
                      onChange={(e) => setNewInvoice({ ...newInvoice, amount: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Invoice File URL (Optional)</label>
                  <div className="relative">
                    <Upload className="absolute left-4 top-3.5 text-slate-500" size={18} />
                    <input
                      type="url"
                      value={newInvoice.fileUrl}
                      onChange={(e) => setNewInvoice({ ...newInvoice, fileUrl: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="https://example.com/invoice.pdf"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
                    <AlertCircle size={10} />
                    Please provide a link to your digital invoice document.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsInvoiceModalOpen(false)}
                    className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all"
                  >
                    Submit Invoice
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
