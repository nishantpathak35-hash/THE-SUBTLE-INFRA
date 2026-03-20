import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Send, CheckCircle2, XCircle, Plus, Trash2, AlertCircle, Sparkles, FileText, MapPin, Download, FileSpreadsheet, File as FilePdf, ArrowUpCircle, ArrowDownCircle, TrendingUp, BarChart3, CreditCard } from 'lucide-react';
import { formatCurrency, formatPercent, formatDate, cn } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import { generateBOQInsights } from '../services/aiService';
import { exportToExcel, exportToPDF } from '../lib/exportUtils';

export default function BOQDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [boq, setBoq] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [masterItems, setMasterItems] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [availableStates, setAvailableStates] = useState<any[]>([]);
  const [erpSettings, setErpSettings] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'items' | 'progress' | 'financials'>('items');
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [selectedLineItem, setSelectedLineItem] = useState<any>(null);
  const [progressForm, setProgressForm] = useState({ quantity: '', remarks: '', date: new Date().toISOString().split('T')[0] });
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [progressSearch, setProgressSearch] = useState('');
  const [dates, setDates] = useState({ startDate: '', endDate: '' });

  const currencySymbol = erpSettings?.currencySymbol || '₹';

  const fetchData = async () => {
    const [boqRes, itemsRes, vendorsRes, statesRes, settingsRes] = await Promise.all([
      fetch(`/api/boqs/${id}`),
      fetch('/api/items'),
      fetch('/api/vendors'),
      fetch('/api/states'),
      fetch('/api/settings')
    ]);
    const boqData = await boqRes.json();
    setBoq(boqData);
    if (statesRes.ok) setAvailableStates(await statesRes.json());
    if (settingsRes.ok) setErpSettings(await settingsRes.json());
    setDates({
      startDate: boqData.startDate ? boqData.startDate.split('T')[0] : '',
      endDate: boqData.endDate ? boqData.endDate.split('T')[0] : ''
    });
    setItems(boqData.lineItems.map((li: any) => ({
      id: li.id,
      itemId: li.itemId,
      description: li.description || li.item.name,
      category: li.category || li.item.category,
      quantity: li.quantity,
      rateType: li.rateType,
      rate: li.rate,
      itemMasterRate: li.item?.stateRates?.find((sr: any) => sr.state === boqData.state)?.supplyPlusInstallationRate || li.rate,
      gstRate: li.gstRate || 0,
      amount: li.amount,
      vendorId: li.vendorId,
      vendor: li.vendor,
      bcs: li.bcs,
      clientPrice: li.clientPrice,
      name: li.item.name,
      unit: li.item.unit,
      progress: li.progress || []
    })));
    setMasterItems(await itemsRes.json());
    setVendors(await vendorsRes.json());
  };

  const localSummary = React.useMemo(() => {
    if (!items.length) return { totalCost: 0, totalValue: 0, totalMargin: 0 };
    
    let totalCost = 0;
    let totalValue = 0;
    
    items.forEach(item => {
      const qty = item.quantity || 0;
      const itemMasterRate = item.itemMasterRate || item.rate || 0;
      const clientPrice = item.clientPrice || 0;
      const gstRate = item.gstRate || 0;
      
      const itemCost = qty * itemMasterRate * (1 + gstRate / 100);
      const itemValue = qty * clientPrice * (1 + gstRate / 100);
      
      totalCost += itemCost;
      totalValue += itemValue;
    });
    
    const totalMargin = totalValue > 0 ? ((totalValue - totalCost) / totalValue) * 100 : 0;
    
    return { totalCost, totalValue, totalMargin };
  }, [items]);

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleLogProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLineItem) return;

    const qty = parseFloat(progressForm.quantity);
    if (isNaN(qty) || qty <= 0) {
      alert('Please enter a valid quantity greater than 0.');
      return;
    }

    const totalLogged = selectedLineItem.progress?.reduce((sum: number, p: any) => sum + p.quantity, 0) || 0;
    const remaining = selectedLineItem.quantity - totalLogged;

    if (qty > remaining + 0.0001) { // Small buffer for float precision
      alert(`Cannot log more than the remaining quantity (${remaining.toFixed(2)} ${selectedLineItem.unit}).`);
      return;
    }

    const res = await fetch(`/api/line-items/${selectedLineItem.id}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...progressForm, quantity: qty }),
    });

    if (res.ok) {
      await fetchData();
      setIsProgressModalOpen(false);
      setProgressForm({ quantity: '', remarks: '', date: new Date().toISOString().split('T')[0] });
    }
  };

  const handleDeleteProgress = async (updateId: string) => {
    if (confirm('Delete this progress entry?')) {
      const res = await fetch(`/api/progress-updates/${updateId}`, { method: 'DELETE' });
      if (res.ok) await fetchData();
    }
  };

  const handleAddItem = () => {
    const defaultGst = erpSettings?.defaultGstRate || 18;
    setItems([...items, { itemId: '', description: '', category: '', quantity: 1, rateType: 'SupplyPlusInstallation', rate: 0, itemMasterRate: 0, amount: 0, vendorId: '', bcs: 0, clientPrice: 0, gstRate: defaultGst, progress: [] }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    const currentItem = newItems[index];

    if (field === 'itemId') {
      const master = masterItems.find(m => m.id === value);
      const stateRate = master?.stateRates?.find((sr: any) => sr.state === boq.state);
      
      // Default to item master rate (state-specific)
      let masterRate = 0;
      if (stateRate) {
        if (currentItem.rateType === 'Labour') masterRate = stateRate.labourRate;
        else if (currentItem.rateType === 'SupplyOnly') masterRate = stateRate.supplyOnlyRate;
        else masterRate = stateRate.supplyPlusInstallationRate;
      }

      // Find lowest vendor rate for reference (optional, but keep it for auto vendor selection)
      const itemVendorRates = vendors.flatMap(v => v.rates || []).filter(r => r.itemId === value && r.status === 'Active');
      const lowestVendorRate = itemVendorRates.length > 0 
        ? itemVendorRates.reduce((min, r) => (r.activeRate || r.submittedRate) < (min.activeRate || min.submittedRate) ? r : min)
        : null;

      const marginMultiplier = 1 + (erpSettings?.defaultMargin || 40) / 100;
      const defaultGst = erpSettings?.defaultGstRate || 18;

      newItems[index] = { 
        ...currentItem, 
        itemId: value,
        name: master?.name || '',
        description: master?.name || '',
        category: master?.category || '',
        unit: master?.unit || '',
        rate: masterRate, // Cost Rate picks from Item Master
        itemMasterRate: masterRate, // Base Rate picks from Item Master
        bcs: masterRate,
        gstRate: defaultGst,
        vendorId: lowestVendorRate?.vendorId || '',
        clientPrice: masterRate * marginMultiplier, 
        amount: (masterRate * marginMultiplier) * currentItem.quantity * (1 + defaultGst / 100)
      };
    } else if (field === 'rateType') {
      const master = masterItems.find(m => m.id === currentItem.itemId);
      const stateRate = master?.stateRates?.find((sr: any) => sr.state === boq.state);
      
      let masterRate = 0;
      if (stateRate) {
        if (value === 'Labour') masterRate = stateRate.labourRate;
        else if (value === 'SupplyOnly') masterRate = stateRate.supplyOnlyRate;
        else masterRate = stateRate.supplyPlusInstallationRate;
      }

      const marginMultiplier = 1 + (erpSettings?.defaultMargin || 40) / 100;
      const defaultGst = erpSettings?.defaultGstRate || 18;

      newItems[index] = { 
        ...currentItem, 
        rateType: value,
        rate: masterRate,
        itemMasterRate: masterRate,
        bcs: masterRate,
        clientPrice: masterRate * marginMultiplier,
        amount: (masterRate * marginMultiplier) * currentItem.quantity * (1 + (currentItem.gstRate || defaultGst) / 100)
      };
    } else if (field === 'quantity' || field === 'rate' || field === 'gstRate' || field === 'clientPrice') {
      const val = parseFloat(value) || 0;
      const qty = field === 'quantity' ? val : currentItem.quantity;
      const rate = field === 'rate' ? val : currentItem.rate;
      const gstRate = field === 'gstRate' ? val : (currentItem.gstRate || 0);
      const clientPrice = field === 'clientPrice' ? val : currentItem.clientPrice;
      
      const subtotal = qty * clientPrice;
      const gstAmount = subtotal * (gstRate / 100);
      const amount = subtotal + gstAmount;

      newItems[index] = { 
        ...currentItem, 
        [field]: val,
        amount,
        rate,
        bcs: rate,
        gstRate,
        clientPrice
      };
    } else {
      newItems[index] = { ...currentItem, [field]: value };
    }
    setItems(newItems);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const res = await fetch(`/api/boqs/${id}/line-items`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, ...dates }),
    });
    if (res.ok) {
      await fetchData();
    }
    setIsSaving(false);
  };

  const handleSubmit = async () => {
    if (confirm('Submit this BOQ?')) {
      const res = await fetch(`/api/boqs/${id}/submit`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'Approved') {
          alert('BOQ auto-approved by Admin.');
          fetchData();
        } else {
          navigate('/boqs');
        }
      }
    }
  };

  const handleApprove = async (status: string) => {
    const comment = prompt(`Enter a comment for ${status.toLowerCase()}:`);
    await fetch(`/api/boqs/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, comment }),
    });
    navigate('/boqs');
  };

  const handleGenerateInsights = async () => {
    setIsGeneratingInsights(true);
    const insights = await generateBOQInsights({ ...boq, lineItems: items });
    setAiInsights(insights);
    setIsGeneratingInsights(false);
  };

  const handleCreatePO = async () => {
    if (confirm('Create Purchase Orders for all items in this BOQ? Items will be grouped by vendor with the lowest rate.')) {
      try {
        const res = await fetch(`/api/boqs/${id}/create-po`, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          alert(`Successfully created ${data.count} Purchase Orders.`);
          navigate('/purchase-orders');
        } else {
          const data = await res.json();
          alert(data.error || 'Failed to create Purchase Orders. Ensure all items have active vendor rates.');
        }
      } catch (err) {
        alert('Network error creating Purchase Orders');
      }
    }
  };

  if (!boq) return null;

  const isLocked = (boq.status !== 'Draft' && boq.status !== 'Rejected') && user?.role !== 'Admin';
  const canApprove = (user?.role === 'Approver' || user?.role === 'Admin') && boq.status === 'Pending Approval';

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600/10 rounded-xl flex items-center justify-center text-indigo-400">
            <FileText size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{boq.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className={cn(
                "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
                boq.status === 'Approved' ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" :
                boq.status === 'Pending Approval' ? "bg-amber-400/10 text-amber-400 border-amber-400/20" :
                "bg-slate-400/10 text-slate-400 border-slate-400/20"
              )}>
                {boq.status}
              </span>
              <span className="text-xs text-slate-500">Created by {boq.createdBy.name}</span>
              {!isLocked ? (
                <select
                  value={boq.state}
                  onChange={async (e) => {
                    const newState = e.target.value;
                    await fetch(`/api/boqs/${id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ state: newState })
                    });
                    fetchData();
                  }}
                  className="bg-indigo-500/10 text-indigo-400 text-xs px-2 py-0.5 rounded-full border border-indigo-500/20 focus:outline-none cursor-pointer"
                >
                  {availableStates.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              ) : (
                <span className="text-xs px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20 flex items-center gap-1">
                  <MapPin size={10} />
                  {boq.state}
                </span>
              )}
              {boq.startDate && (
                <span className="text-[10px] text-slate-500 font-medium">
                  {formatDate(boq.startDate)} — {boq.endDate ? formatDate(boq.endDate) : 'Ongoing'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isLocked && (
            <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1 mr-2">
              <div className="flex flex-col">
                <span className="text-[8px] text-slate-500 uppercase font-bold">Start Date</span>
                <input 
                  type="date" 
                  value={dates.startDate}
                  onChange={(e) => setDates({...dates, startDate: e.target.value})}
                  className="bg-transparent text-[10px] text-white focus:outline-none"
                />
              </div>
              <div className="w-px h-6 bg-slate-700 mx-1" />
              <div className="flex flex-col">
                <span className="text-[8px] text-slate-500 uppercase font-bold">End Date</span>
                <input 
                  type="date" 
                  value={dates.endDate}
                  onChange={(e) => setDates({...dates, endDate: e.target.value})}
                  className="bg-transparent text-[10px] text-white focus:outline-none"
                />
              </div>
            </div>
          )}
          <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700 mr-2">
            <button
              onClick={() => exportToExcel(boq)}
              className="p-2 text-slate-400 hover:text-emerald-400 transition-colors"
              title="Export to Excel"
            >
              <FileSpreadsheet size={20} />
            </button>
            <button
              onClick={() => exportToPDF(boq)}
              className="p-2 text-slate-400 hover:text-rose-400 transition-colors"
              title="Export to PDF"
            >
              <FilePdf size={20} />
            </button>
          </div>

          {!isLocked && boq.status !== 'Approved' && (
            <>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors border border-slate-700"
              >
                <Save size={18} />
                {isSaving ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                onClick={handleSubmit}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20"
              >
                <Send size={18} />
                Submit
              </button>
            </>
          )}
          {boq.status === 'Approved' && (
            <button
              onClick={handleCreatePO}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-lg shadow-blue-500/20"
            >
              <Plus size={18} />
              Create POs
            </button>
          )}
          {canApprove && (
            <>
              <button
                onClick={() => handleApprove('Rejected')}
                className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-lg shadow-rose-500/20"
              >
                <XCircle size={18} />
                Reject
              </button>
              <button
                onClick={() => handleApprove('Approved')}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-lg shadow-emerald-500/20"
              >
                <CheckCircle2 size={18} />
                Approve
              </button>
            </>
          )}
        </div>
      </div>

      {/* Project Progress Summary - Always Visible */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl mb-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white mb-2">Project Execution Progress</h2>
            <p className="text-slate-400 text-sm">Overall completion status based on BOQ items execution.</p>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Total Items</p>
                <p className="text-xl font-bold text-white">{items.length}</p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Completed</p>
                <p className="text-xl font-bold text-emerald-400">
                  {items.filter(item => item.progress.reduce((sum: number, p: any) => sum + p.quantity, 0) >= item.quantity).length}
                </p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">In Progress</p>
                <p className="text-xl font-bold text-amber-400">
                  {items.filter(item => {
                    const exec = item.progress.reduce((sum: number, p: any) => sum + p.quantity, 0);
                    return exec > 0 && exec < item.quantity;
                  }).length}
                </p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Not Started</p>
                <p className="text-xl font-bold text-slate-400">
                  {items.filter(item => item.progress.reduce((sum: number, p: any) => sum + p.quantity, 0) === 0).length}
                </p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Timeline</p>
                {boq.startDate && boq.endDate ? (
                  <div>
                    <p className="text-xl font-bold text-indigo-400">
                      {Math.max(0, Math.ceil((new Date(boq.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))}
                      <span className="text-xs font-normal text-slate-500 ml-1">days left</span>
                    </p>
                  </div>
                ) : (
                  <p className="text-xl font-bold text-slate-500">—</p>
                )}
              </div>
            </div>

            {boq.startDate && boq.endDate && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Project Timeline</span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {formatDate(boq.startDate)} — {formatDate(boq.endDate)}
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden relative">
                  {/* Total duration bar */}
                  <div className="absolute inset-0 bg-slate-800" />
                  
                  {/* Elapsed time bar */}
                  {(() => {
                    const start = new Date(boq.startDate).getTime();
                    const end = new Date(boq.endDate).getTime();
                    const now = new Date().getTime();
                    const total = end - start;
                    const elapsed = now - start;
                    const percent = Math.min(Math.max((elapsed / total) * 100, 0), 100);
                    
                    return (
                      <div 
                        className={cn(
                          "h-full transition-all duration-1000",
                          percent > 90 ? "bg-rose-500" : percent > 75 ? "bg-amber-500" : "bg-indigo-500"
                        )}
                        style={{ width: `${percent}%` }}
                      />
                    );
                  })()}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[8px] text-slate-600 uppercase font-bold">Start</span>
                  <span className="text-[8px] text-slate-600 uppercase font-bold">Today</span>
                  <span className="text-[8px] text-slate-600 uppercase font-bold">Deadline</span>
                </div>
              </div>
            )}
          </div>
          <div className="w-48 h-48 relative">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-800" />
              <circle
                cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="12" fill="transparent"
                strokeDasharray={502.6}
                strokeDashoffset={502.6 * (1 - Math.min((items.reduce((sum, item) => sum + (item.progress?.reduce((s: number, p: any) => s + p.quantity, 0) || 0), 0) / (items.reduce((sum, item) => sum + (item.quantity || 0), 0) || 1)), 1))}
                className="text-indigo-500 transition-all duration-1000"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold text-white">
                {Math.round((items.reduce((sum, item) => sum + (item.progress?.reduce((s: number, p: any) => s + p.quantity, 0) || 0), 0) / (items.reduce((sum, item) => sum + (item.quantity || 0), 0) || 1)) * 100)}%
              </span>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Overall</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex border-b border-slate-800 mb-6">
        <button
          onClick={() => setActiveTab('items')}
          className={cn(
            "px-6 py-3 text-sm font-bold transition-all border-b-2",
            activeTab === 'items' ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-500 hover:text-slate-300"
          )}
        >
          BOQ Items
        </button>
        <button
          onClick={() => setActiveTab('progress')}
          className={cn(
            "px-6 py-3 text-sm font-bold transition-all border-b-2",
            activeTab === 'progress' ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-500 hover:text-slate-300"
          )}
        >
          Execution Progress
        </button>
        <button
          onClick={() => setActiveTab('financials')}
          className={cn(
            "px-6 py-3 text-sm font-bold transition-all border-b-2",
            activeTab === 'financials' ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-500 hover:text-slate-300"
          )}
        >
          Financials
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          {activeTab === 'items' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                    <BarChart3 size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Total Value</p>
                    <p className="text-lg font-bold text-white">{formatCurrency(localSummary.totalValue, currencySymbol)}</p>
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400">
                    <ArrowDownCircle size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Total Cost</p>
                    <p className="text-lg font-bold text-white">{formatCurrency(localSummary.totalCost, currencySymbol)}</p>
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Total Margin</p>
                    <p className="text-lg font-bold text-white">{formatPercent(localSummary.totalMargin)}</p>
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                    <CreditCard size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Net Cash Flow</p>
                    <p className="text-lg font-bold text-white">
                      {formatCurrency(((boq.inflows?.reduce((s: number, i: any) => s + i.amount, 0) || 0) - (boq.pos?.reduce((s: number, p: any) => s + (p.payments?.reduce((ss: number, pp: any) => ss + pp.amount, 0) || 0), 0) || 0)), currencySymbol)}
                    </p>
                  </div>
                </div>
              </div>
              {isLocked && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                      <Sparkles size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Overall Progress</p>
                      <p className="text-xl font-bold text-white">
                        {Math.round((items.reduce((sum, item) => sum + (item.progress?.reduce((s: number, p: any) => s + p.quantity, 0) || 0), 0) / (items.reduce((sum, item) => sum + (item.quantity || 0), 0) || 1)) * 100)}%
                      </p>
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Items Completed</p>
                      <p className="text-xl font-bold text-white">
                        {items.filter(item => (item.progress?.reduce((s: number, p: any) => s + p.quantity, 0) || 0) >= item.quantity).length} / {items.length}
                      </p>
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                      <AlertCircle size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Pending Execution</p>
                      <p className="text-xl font-bold text-white">
                        {items.filter(item => (item.progress?.reduce((s: number, p: any) => s + p.quantity, 0) || 0) < item.quantity).length} Items
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-800/50 text-slate-400 text-[10px] uppercase tracking-wider font-bold">
                        <th className="px-4 py-4 border-b border-slate-800">Item Details</th>
                        <th className="px-4 py-4 border-b border-slate-800">Vendor & Rate Type</th>
                        <th className="px-4 py-4 border-b border-slate-800 text-right">Qty</th>
                        <th className="px-4 py-4 border-b border-slate-800 text-right">Base Rate</th>
                        <th className="px-4 py-4 border-b border-slate-800 text-right">Cost Rate</th>
                        <th className="px-4 py-4 border-b border-slate-800 text-right">Client Price</th>
                        <th className="px-4 py-4 border-b border-slate-800 text-right">GST %</th>
                        <th className="px-4 py-4 border-b border-slate-800 text-right">Total (Incl. GST)</th>
                        <th className="px-4 py-4 border-b border-slate-800 text-center">Margin</th>
                        {!isLocked && <th className="px-4 py-4 border-b border-slate-800"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {items.map((item, index) => {
                        const baseCost = item.itemMasterRate || item.rate || 0;
                        const margin = item.clientPrice > 0 ? ((item.clientPrice - baseCost) / item.clientPrice) * 100 : 0;
                        const gstRate = item.gstRate || 0;
                        const subtotal = item.quantity * item.clientPrice;
                        const gstAmount = subtotal * (gstRate / 100);
                        const totalWithGst = subtotal + gstAmount;
                        
                        return (
                          <tr key={index} className="hover:bg-slate-800/30 transition-colors group">
                          <td className="px-4 py-3 min-w-[250px]">
                            {isLocked ? (
                              <div>
                                <div className="text-sm font-bold text-white">{item.description || item.name}</div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded uppercase tracking-tighter">{item.category}</span>
                                  <span className="text-[10px] text-slate-500 italic">{item.rateType}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <select
                                  value={item.itemId}
                                  onChange={(e) => handleItemChange(index, 'itemId', e.target.value)}
                                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                  <option value="">Select Item Master</option>
                                  {masterItems.map(m => <option key={m.id} value={m.id}>{m.itemCode} - {m.name}</option>)}
                                </select>
                                <input
                                  type="text"
                                  value={item.description}
                                  onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                  placeholder="Custom Description"
                                  className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-1 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 min-w-[180px]">
                            {isLocked ? (
                              <div className="flex flex-col">
                                <span className="text-sm text-slate-400">{item.vendor?.name || 'N/A'}</span>
                                <span className="text-[10px] text-slate-600">{item.rateType}</span>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <select
                                  value={item.vendorId || ''}
                                  onChange={(e) => handleItemChange(index, 'vendorId', e.target.value)}
                                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                  <option value="">Auto (Lowest)</option>
                                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                </select>
                                <select
                                  value={item.rateType}
                                  onChange={(e) => handleItemChange(index, 'rateType', e.target.value)}
                                  className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-1 text-[10px] text-slate-400 focus:outline-none"
                                >
                                  <option value="SupplyOnly">Supply Only</option>
                                  <option value="Labour">Labour Only</option>
                                  <option value="SupplyPlusInstallation">Supply + Install</option>
                                </select>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-col items-end">
                              <input
                                type="number"
                                value={item.quantity}
                                disabled={isLocked}
                                onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                className="w-20 bg-transparent text-right text-sm font-bold text-white focus:outline-none disabled:opacity-50"
                              />
                              <span className="text-[10px] text-slate-500 uppercase">{item.unit}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm text-slate-500">{formatCurrency(baseCost, currencySymbol)}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              value={item.rate}
                              disabled={isLocked}
                              onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                              className="w-24 bg-transparent text-right text-sm text-slate-300 focus:outline-none disabled:opacity-50"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              value={item.clientPrice}
                              disabled={isLocked}
                              onChange={(e) => handleItemChange(index, 'clientPrice', e.target.value)}
                              className="w-24 bg-transparent text-right text-sm font-bold text-indigo-400 focus:outline-none disabled:opacity-50"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              value={item.gstRate || 0}
                              disabled={isLocked}
                              onChange={(e) => handleItemChange(index, 'gstRate', e.target.value)}
                              className="w-16 bg-transparent text-right text-sm text-slate-400 focus:outline-none disabled:opacity-50"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-bold text-white">{formatCurrency(totalWithGst, currencySymbol)}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className={cn(
                              "text-xs font-bold px-2 py-1 rounded-full inline-block",
                              margin < 15 ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"
                            )}>
                              {formatPercent(margin)}
                            </div>
                          </td>
                          {!isLocked && (
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleRemoveItem(index)}
                                className="p-2 text-slate-500 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                      <tr className="bg-slate-800/30 font-bold text-white">
                        <td colSpan={5} className="px-4 py-6 text-right uppercase tracking-wider text-[10px] text-slate-400">Grand Total Project Value</td>
                        <td className="px-4 py-6 text-right text-xl text-indigo-400" colSpan={3}>{formatCurrency(localSummary.totalValue, currencySymbol)}</td>
                      <td className="px-4 py-6 text-center">
                        <div className={cn(
                          "text-sm font-bold",
                          localSummary.totalMargin < 15 ? "text-rose-400" : "text-emerald-400"
                        )}>
                          {formatPercent(localSummary.totalMargin)}
                        </div>
                      </td>
                      {!isLocked && <td></td>}
                    </tr>
                  </tfoot>
                </table>
              </div>
              {!isLocked && (
                <div className="p-6 bg-slate-800/20 border-t border-slate-800 flex justify-center">
                  <button
                    onClick={handleAddItem}
                    className="flex items-center gap-2 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold transition-all border border-slate-700 hover:border-indigo-500/50"
                  >
                    <Plus size={18} className="text-indigo-400" />
                    Add New Line Item
                  </button>
                </div>
              )}
            </div>
          </div>
          ) : activeTab === 'progress' ? (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <input
                    type="text"
                    placeholder="Search items by name or category..."
                    value={progressSearch}
                    onChange={(e) => setProgressSearch(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 pl-10"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    <BarChart3 size={18} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {items.filter(item => 
                  (item.description || item.name).toLowerCase().includes(progressSearch.toLowerCase()) ||
                  item.category.toLowerCase().includes(progressSearch.toLowerCase())
                ).map((item) => {
                  const totalExecuted = item.progress?.reduce((sum: number, p: any) => sum + p.quantity, 0) || 0;
                  const remaining = item.quantity - totalExecuted;
                  const progressPercent = (totalExecuted / (item.quantity || 1)) * 100;
                  
                  return (
                    <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-lg hover:border-slate-700 transition-all group">
                      <div className="p-5 border-b border-slate-800">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="text-sm font-bold text-white line-clamp-1">{item.description || item.name}</h4>
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{item.category}</span>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedLineItem(item);
                              setIsProgressModalOpen(true);
                            }}
                            className="p-2 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-lg transition-all"
                            title="Log Progress"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                        
                        <div className="mt-4 flex items-center gap-4">
                          <div className="relative w-16 h-16 shrink-0">
                            <svg className="w-full h-full transform -rotate-90">
                              <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-800" />
                              <circle
                                cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent"
                                strokeDasharray={175.9}
                                strokeDashoffset={175.9 * (1 - Math.min(progressPercent / 100, 1))}
                                className={cn(
                                  "transition-all duration-1000",
                                  progressPercent >= 100 ? "text-emerald-500" : "text-indigo-500"
                                )}
                                strokeLinecap="round"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-[10px] font-bold text-white">{Math.round(progressPercent)}%</span>
                            </div>
                          </div>
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                              <p className="text-[8px] text-slate-500 uppercase font-bold">Executed</p>
                              <p className="text-xs font-bold text-emerald-400">{totalExecuted} {item.unit}</p>
                            </div>
                            <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                              <p className="text-[8px] text-slate-500 uppercase font-bold">Remaining</p>
                              <p className="text-xs font-bold text-rose-400">{remaining.toFixed(2)} {item.unit}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 p-5 bg-slate-800/20">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Recent Updates</span>
                          <span className="text-[10px] text-slate-600">{item.progress.length} logs</span>
                        </div>
                        <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                          {item.progress.length > 0 ? (
                            item.progress.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((p: any) => (
                              <div key={p.id} className="bg-slate-800/40 border border-slate-700/30 rounded-lg p-2 flex items-center justify-between group/log">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-emerald-400">+{p.quantity} {item.unit}</span>
                                    <span className="text-[8px] text-slate-500">{formatDate(p.date)}</span>
                                  </div>
                                  {p.remarks && <p className="text-[9px] text-slate-400 line-clamp-1 italic">"{p.remarks}"</p>}
                                </div>
                                <button
                                  onClick={() => handleDeleteProgress(p.id)}
                                  className="p-1 text-slate-600 hover:text-rose-400 opacity-0 group-hover/log:opacity-100 transition-all"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))
                          ) : (
                            <p className="text-[10px] text-slate-600 italic text-center py-4">No progress logged yet.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Project Health Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                  <h4 className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-4">Total Value</h4>
                  <p className="text-2xl font-bold text-white">{formatCurrency(localSummary.totalValue, currencySymbol)}</p>
                  <p className="text-[10px] text-slate-500 mt-1">Project Contract Value</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                  <h4 className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-4">Total Cost</h4>
                  <p className="text-2xl font-bold text-white">{formatCurrency(localSummary.totalCost, currencySymbol)}</p>
                  <p className="text-[10px] text-slate-500 mt-1">Estimated Base Cost</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                  <h4 className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-4">Cash Position</h4>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold text-white">
                        {formatCurrency(((boq.inflows?.reduce((s: number, i: any) => s + i.amount, 0) || 0) - (boq.pos?.reduce((s: number, p: any) => s + (p.payments?.reduce((ss: number, pp: any) => ss + pp.amount, 0) || 0), 0) || 0)), currencySymbol)}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">Net Cash Flow</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-400">+{formatPercent(((boq.inflows?.reduce((s: number, i: any) => s + i.amount, 0) || 0) / (boq.totalValue || 1)) * 100)}</p>
                      <p className="text-[10px] text-slate-500 mt-1">Collected</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                  <h4 className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-4">Budget Burn</h4>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold text-white">
                        {formatCurrency((boq.pos?.reduce((s: number, p: any) => s + p.totalAmount, 0) || 0), currencySymbol)}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">Committed Cost</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-rose-400">
                        {formatPercent(((boq.pos?.reduce((s: number, p: any) => s + p.totalAmount, 0) || 0) / (localSummary.totalCost || 1)) * 100)}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">of Budget</p>
                    </div>
                  </div>
                  <div className="mt-4 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="h-full bg-rose-500" 
                      style={{ width: `${Math.min(((boq.pos?.reduce((s: number, p: any) => s + p.totalAmount, 0) || 0) / (localSummary.totalCost || 1)) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                  <h4 className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-4">Execution Efficiency</h4>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold text-white">
                        {Math.round((items.reduce((sum, item) => sum + (item.progress?.reduce((s: number, p: any) => s + p.quantity, 0) || 0), 0) / (items.reduce((sum, item) => sum + item.quantity, 0) || 1)) * 100)}%
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">Physical Completion</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-indigo-400">
                        {formatCurrency(items.reduce((sum, item) => sum + (item.progress?.reduce((s: number, p: any) => s + p.quantity, 0) || 0) * item.rate, 0), currencySymbol)}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">Earned Value</p>
                    </div>
                  </div>
                  <div className="mt-4 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500" 
                      style={{ width: `${Math.round((items.reduce((sum, item) => sum + (item.progress?.reduce((s: number, p: any) => s + p.quantity, 0) || 0), 0) / (items.reduce((sum, item) => sum + item.quantity, 0) || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Combined Cash Flow Section */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <TrendingUp size={20} className="text-indigo-400" />
                    Project Cash Flow (Transaction History)
                  </h3>
                  <div className="flex gap-4">
                    <div className="text-sm font-bold text-emerald-400">
                      In: {formatCurrency((boq.inflows?.reduce((s: number, i: any) => s + i.amount, 0) || 0), currencySymbol)}
                    </div>
                    <div className="text-sm font-bold text-rose-400">
                      Out: {formatCurrency((boq.pos?.reduce((s: number, p: any) => s + (p.payments?.reduce((ss: number, pp: any) => ss + pp.amount, 0) || 0), 0) || 0), currencySymbol)}
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-800/50 text-slate-400 text-[10px] uppercase tracking-wider font-bold">
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4">Description / Vendor</th>
                        <th className="px-6 py-4">Method / PO</th>
                        <th className="px-6 py-4 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {[
                        ...(boq.inflows?.map((i: any) => ({ ...i, type: 'Inflow' })) || []),
                        ...(boq.pos?.flatMap((po: any) => 
                          po.payments?.map((payment: any) => ({
                            ...payment,
                            type: 'Outflow',
                            vendorName: po.vendor.name,
                            poNumber: po.poNumber,
                            date: payment.paymentDate // Unified date key
                          })) || []
                        ) || [])
                      ].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((txn: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4 text-sm text-slate-400">{formatDate(txn.date)}</td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
                              txn.type === 'Inflow' ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" : "bg-rose-400/10 text-rose-400 border-rose-400/20"
                            )}>
                              {txn.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-300">
                            {txn.type === 'Inflow' ? 'Client Payment' : txn.vendorName}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {txn.type === 'Inflow' ? txn.method : `PO: ${txn.poNumber}`}
                          </td>
                          <td className={cn(
                            "px-6 py-4 text-right font-bold",
                            txn.type === 'Inflow' ? "text-emerald-400" : "text-rose-400"
                          )}>
                            {txn.type === 'Inflow' ? '+' : '-'}{formatCurrency(txn.amount, currencySymbol)}
                          </td>
                        </tr>
                      ))}
                      {(!boq.inflows?.length && !boq.pos?.some((p: any) => p.payments?.length)) && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-500 text-sm">
                            No transactions recorded for this project yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Purchase Orders Summary */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-6 border-b border-slate-800">
                  <h3 className="text-lg font-bold text-white">Purchase Orders Summary</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-800/50 text-slate-400 text-[10px] uppercase tracking-wider font-bold">
                        <th className="px-6 py-4">PO Number</th>
                        <th className="px-6 py-4">Vendor</th>
                        <th className="px-6 py-4 text-right">PO Value</th>
                        <th className="px-6 py-4 text-right">Paid</th>
                        <th className="px-6 py-4 text-right">Balance</th>
                        <th className="px-6 py-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {boq.pos?.map((po: any) => {
                        const paid = po.payments?.reduce((s: number, p: any) => s + p.amount, 0) || 0;
                        return (
                          <tr key={po.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-6 py-4 text-sm font-medium text-indigo-400">{po.poNumber}</td>
                            <td className="px-6 py-4 text-sm text-white">{po.vendor.name}</td>
                            <td className="px-6 py-4 text-right text-sm text-slate-200">{formatCurrency(po.totalAmount, currencySymbol)}</td>
                            <td className="px-6 py-4 text-right text-sm text-emerald-400">{formatCurrency(paid, currencySymbol)}</td>
                            <td className="px-6 py-4 text-right text-sm text-rose-400">{formatCurrency(po.totalAmount - paid, currencySymbol)}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
                                po.status === 'Sent' ? "bg-blue-400/10 text-blue-400 border-blue-400/20" :
                                po.status === 'Received' ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" :
                                "bg-slate-400/10 text-slate-400 border-slate-400/20"
                              )}>
                                {po.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Financial Summary</h2>
              <div className={cn(
                "w-3 h-3 rounded-full",
                boq.totalMargin < 15 ? "bg-rose-500 animate-pulse" : "bg-emerald-500"
              )} />
            </div>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Total Cost (BCS)</span>
                <span className="text-white font-medium">{formatCurrency(localSummary.totalCost, currencySymbol)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Client Value</span>
                <span className="text-white font-medium">{formatCurrency(localSummary.totalValue, currencySymbol)}</span>
              </div>
              <div className="pt-4 border-t border-slate-800 flex flex-col gap-1">
                <span className="text-slate-400 text-xs uppercase tracking-widest font-bold">Overall Margin</span>
                <div className="flex items-baseline justify-between">
                  <span className={cn(
                    "text-3xl font-black",
                    localSummary.totalMargin < 15 ? "text-rose-400" : "text-emerald-400"
                  )}>
                    {formatPercent(localSummary.totalMargin)}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatCurrency(localSummary.totalValue - localSummary.totalCost, currencySymbol)} profit
                  </span>
                </div>
              </div>
            </div>
            {localSummary.totalMargin < 15 && (
              <div className="mt-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex gap-3">
                <AlertCircle className="text-rose-400 shrink-0" size={20} />
                <p className="text-xs text-rose-200/80 leading-relaxed">Margin is below the 15% safety threshold. This project might be at risk of loss.</p>
              </div>
            )}
          </div>

          {/* AI Insights Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles size={18} className="text-indigo-400" />
                AI Analysis
              </h2>
              <button
                onClick={handleGenerateInsights}
                disabled={isGeneratingInsights}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-indigo-400 transition-colors disabled:opacity-50"
              >
                <Sparkles size={16} className={isGeneratingInsights ? "animate-spin" : ""} />
              </button>
            </div>
            <div className="space-y-3">
              {aiInsights.length > 0 ? (
                aiInsights.map((insight, i) => (
                  <div key={i} className="text-xs text-slate-400 leading-relaxed p-3 bg-slate-800/30 rounded-xl border border-slate-800/50">
                    {insight}
                  </div>
                ))
              ) : (
                <div className="py-8 text-center">
                  <p className="text-xs text-slate-500 italic mb-4">No analysis generated yet.</p>
                  <button 
                    onClick={handleGenerateInsights}
                    className="text-xs font-bold text-indigo-400 hover:underline"
                  >
                    Generate Now
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Approval History */}
          {boq.approvals.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-lg font-bold text-white mb-4">Approval Log</h2>
              <div className="space-y-4">
                {boq.approvals.map((app: any) => (
                  <div key={app.id} className="relative pl-6 pb-4 border-l border-slate-800 last:pb-0">
                    <div className={cn(
                      "absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full",
                      app.status === 'Approved' ? "bg-emerald-500" : "bg-rose-500"
                    )} />
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white">{app.user.name}</span>
                      <span className={cn(
                        "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded",
                        app.status === 'Approved' ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                      )}>
                        {app.status}
                      </span>
                    </div>
                    {app.comment && <p className="text-xs text-slate-500 italic bg-slate-800/50 p-2 rounded-lg mt-1">"{app.comment}"</p>}
                    <p className="text-[10px] text-slate-600 mt-2">{new Date(app.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress Modal */}
      {isProgressModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Log Execution Progress</h3>
              <button onClick={() => setIsProgressModalOpen(false)} className="text-slate-400 hover:text-white">
                <XCircle size={24} />
              </button>
            </div>
            <form onSubmit={handleLogProgress} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Item</label>
                <div className="text-sm font-bold text-white bg-slate-800 p-3 rounded-xl border border-slate-700">
                  {selectedLineItem?.description || selectedLineItem?.name}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Quantity ({selectedLineItem?.unit})</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={progressForm.quantity}
                    onChange={(e) => setProgressForm({ ...progressForm, quantity: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Date</label>
                  <input
                    type="date"
                    required
                    value={progressForm.date}
                    onChange={(e) => setProgressForm({ ...progressForm, date: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Remarks</label>
                <textarea
                  value={progressForm.remarks}
                  onChange={(e) => setProgressForm({ ...progressForm, remarks: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
                  placeholder="Any site notes..."
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsProgressModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-indigo-500/20"
                >
                  Log Progress
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
