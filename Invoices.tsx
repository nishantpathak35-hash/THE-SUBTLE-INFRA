import React, { useEffect, useState } from 'react';
import { FileText, CheckCircle2, XCircle, Clock, Download, ExternalLink, CreditCard, Search, Filter } from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/utils';
import { useSettingsStore } from '../store/settingsStore';

export default function Invoices() {
  const { erpSettings, fetchSettings } = useSettingsStore();
  const currencySymbol = erpSettings?.currencySymbol || '₹';
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [paymentData, setPaymentData] = useState({
    amount: '',
    method: 'Bank Transfer',
    transactionId: '',
    paymentDate: new Date().toISOString().split('T')[0]
  });
  const [approvalData, setApprovalData] = useState({
    certifiedAmount: '',
    tdsAmount: ''
  });

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/invoices');
      const data = await res.json();
      if (Array.isArray(data)) {
        setInvoices(data);
      } else {
        console.error("Invoices data is not an array:", data);
        setInvoices([]);
      }
    } catch (e) {
      console.error("Failed to fetch invoices", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchInvoices();
  }, []);

  const handleStatusUpdate = async (id: string, status: string, extraData?: any) => {
    const res = await fetch(`/api/invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...extraData }),
    });
    if (res.ok) {
      setIsApprovalModalOpen(false);
      setApprovalData({ certifiedAmount: '', tdsAmount: '' });
      fetchInvoices();
    }
  };

  const handleApproveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    handleStatusUpdate(selectedInvoice.id, 'Approved', {
      certifiedAmount: parseFloat(approvalData.certifiedAmount),
      tdsAmount: parseFloat(approvalData.tdsAmount) || 0
    });
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceId: selectedInvoice.id,
        ...paymentData
      }),
    });

    if (res.ok) {
      setIsPaymentModalOpen(false);
      setSelectedInvoice(null);
      setPaymentData({
        amount: '',
        method: 'Bank Transfer',
        transactionId: '',
        paymentDate: new Date().toISOString().split('T')[0]
      });
      fetchInvoices();
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesFilter = filter === 'All' || inv.status === filter;
    const matchesSearch = 
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      inv.vendor.name.toLowerCase().includes(search.toLowerCase()) ||
      inv.purchaseOrder.poNumber.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Paid': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Approved': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'Rejected': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default: return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Vendor Invoices</h1>
          <p className="text-slate-400 mt-1">Review and process invoices submitted by vendors.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Search by invoice, vendor, or PO..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={18} className="text-slate-500" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          >
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Paid">Paid</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-800/50 text-slate-400 text-xs uppercase tracking-wider font-bold">
                <th className="px-6 py-4">Invoice Details</th>
                <th className="px-6 py-4">Vendor & PO</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
                      <span>Loading invoices...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No invoices found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-white flex items-center gap-2">
                        <FileText size={16} className="text-indigo-400" />
                        {inv.invoiceNumber}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Submitted: {formatDate(inv.submittedAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-200">{inv.vendor.name}</div>
                      <div className="text-xs text-slate-500 mt-1">PO: {inv.purchaseOrder.poNumber}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-white">{formatCurrency(inv.amount, currencySymbol)}</div>
                      {inv.payments.length > 0 && (
                        <div className="text-[10px] text-emerald-400 mt-1">
                          Paid: {formatCurrency(inv.payments.reduce((s: number, p: any) => s + p.amount, 0), currencySymbol)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${getStatusColor(inv.status)}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {inv.fileUrl && (
                          <a
                            href={inv.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            title="View Invoice File"
                          >
                            <ExternalLink size={18} />
                          </a>
                        )}
                        {inv.status === 'Pending' && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedInvoice(inv);
                                setApprovalData({
                                  certifiedAmount: inv.amount.toString(),
                                  tdsAmount: '0'
                                });
                                setIsApprovalModalOpen(true);
                              }}
                              className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                              title="Approve Invoice"
                            >
                              <CheckCircle2 size={18} />
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(inv.id, 'Rejected')}
                              className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                              title="Reject Invoice"
                            >
                              <XCircle size={18} />
                            </button>
                          </>
                        )}
                        {inv.status === 'Approved' && (
                          <button
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setPaymentData({ ...paymentData, amount: inv.amount.toString() });
                              setIsPaymentModalOpen(true);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-emerald-500/20"
                          >
                            <CreditCard size={14} />
                            Pay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isApprovalModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-xl font-bold text-white">Approve Invoice</h2>
              <p className="text-sm text-slate-400 mt-1">Invoice: {selectedInvoice?.invoiceNumber}</p>
              <p className="text-xs text-slate-500 mt-1">Total Amount: {formatCurrency(selectedInvoice?.amount, currencySymbol)}</p>
            </div>
            <form onSubmit={handleApproveSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Certified Amount ({currencySymbol})</label>
                <input
                  type="number"
                  step="0.01"
                  value={approvalData.certifiedAmount}
                  onChange={(e) => setApprovalData({ ...approvalData, certifiedAmount: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <p className="text-[10px] text-slate-500 mt-1">The actual amount approved for payment.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">TDS Amount ({currencySymbol})</label>
                <input
                  type="number"
                  step="0.01"
                  value={approvalData.tdsAmount}
                  onChange={(e) => setApprovalData({ ...approvalData, tdsAmount: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">Tax Deducted at Source, if applicable.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsApprovalModalOpen(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-lg shadow-lg shadow-emerald-500/20 transition-colors"
                >
                  Approve
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-xl font-bold text-white">Record Payment</h2>
              <p className="text-sm text-slate-400 mt-1">Invoice: {selectedInvoice?.invoiceNumber}</p>
            </div>
            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Amount to Pay ({currencySymbol})</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Payment Method</label>
                <select
                  value={paymentData.method}
                  onChange={(e) => setPaymentData({ ...paymentData, method: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Transaction ID / Ref</label>
                <input
                  type="text"
                  value={paymentData.transactionId}
                  onChange={(e) => setPaymentData({ ...paymentData, transactionId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="UTR Number, Cheque No, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Payment Date</label>
                <input
                  type="date"
                  value={paymentData.paymentDate}
                  onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-lg shadow-lg shadow-emerald-500/20 transition-colors"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
