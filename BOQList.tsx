import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, Filter, MoreVertical, FileText, Trash2 } from 'lucide-react';
import { formatCurrency, formatPercent, cn } from '../lib/utils';
import { useSettingsStore } from '../store/settingsStore';

export default function BOQList() {
  const { erpSettings, fetchSettings } = useSettingsStore();
  const currencySymbol = erpSettings?.currencySymbol || '₹';
  const [searchParams] = useSearchParams();
  const [boqs, setBoqs] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [availableStates, setAvailableStates] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(searchParams.get('new') === 'true');
  const [newBoq, setNewBoq] = useState({ name: '', clientId: '', state: '', category: '' });

  const fetchBOQs = async () => {
    try {
      const [boqRes, clientRes, statesRes] = await Promise.all([
        fetch('/api/boqs'),
        fetch('/api/clients'),
        fetch('/api/states')
      ]);
      
      if (boqRes.ok) {
        const boqData = await boqRes.json();
        if (Array.isArray(boqData)) {
          setBoqs(boqData);
        } else {
          console.error("BOQ data is not an array:", boqData);
          setBoqs([]);
        }
      }
      
      if (clientRes.ok) {
        const clientData = await clientRes.json();
        if (Array.isArray(clientData)) {
          setClients(clientData);
        } else {
          console.error("Client data is not an array:", clientData);
          setClients([]);
        }
      }
      
      if (statesRes.ok) {
        const statesData = await statesRes.json();
        if (Array.isArray(statesData)) {
          setAvailableStates(statesData);
          if (statesData.length > 0 && !newBoq.state) {
            setNewBoq(prev => ({ ...prev, state: statesData[0].name }));
          }
        } else {
          console.error("States data is not an array:", statesData);
          setAvailableStates([]);
        }
      }
    } catch (e) {
      console.error("Failed to fetch BOQ list data", e);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchBOQs();
  }, []);

  useEffect(() => {
    if (erpSettings?.projectCategories && erpSettings.projectCategories.length > 0 && !newBoq.category) {
      setNewBoq(prev => ({ ...prev, category: erpSettings.projectCategories[0] }));
    }
  }, [erpSettings]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/boqs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newBoq),
    });
    if (res.ok) {
      setIsModalOpen(false);
      setNewBoq({ 
        name: '', 
        clientId: '', 
        state: availableStates[0]?.name || '', 
        category: erpSettings?.projectCategories?.[0] || 'Residential' 
      });
      fetchBOQs();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this BOQ? This will remove all associated line items and progress logs.")) return;
    try {
      const res = await fetch(`/api/boqs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchBOQs();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete BOQ");
      }
    } catch (e) {
      console.error("Delete BOQ error", e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Bill of Quantities</h1>
          <p className="text-slate-400 mt-1">Manage and track your project estimations.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-lg shadow-indigo-500/20"
        >
          <Plus size={20} />
          New Project
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Search BOQs..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
          <button className="bg-slate-800 border border-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-slate-700 transition-colors">
            <Filter size={16} />
            Filter
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-800/50 text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Project Details</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Total Cost</th>
                <th className="px-6 py-4 font-semibold text-right">Client Value</th>
                <th className="px-6 py-4 font-semibold text-center">Margin</th>
                <th className="px-6 py-4 font-semibold">Created By</th>
                <th className="px-6 py-4 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {boqs.map((boq) => (
                <tr key={boq.id} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="px-6 py-4">
                    <Link to={`/boqs/${boq.id}`} className="block">
                      <div className="font-bold text-white group-hover:text-indigo-400 transition-colors">
                        {boq.name}
                        {boq.status === 'Approved' && (
                          <span className="ml-2 text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            Approved
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{boq.client?.name || 'No Client'} • {boq.category || 'Residential'}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">Created {new Date(boq.createdAt).toLocaleDateString()}</div>
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide",
                      boq.status === 'Approved' ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20" :
                      boq.status === 'Pending Approval' ? "bg-amber-400/10 text-amber-400 border border-amber-400/20" :
                      boq.status === 'Rejected' ? "bg-rose-400/10 text-rose-400 border border-rose-400/20" :
                      "bg-slate-400/10 text-slate-400 border border-slate-400/20"
                    )}>
                      {boq.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-slate-300">{formatCurrency(boq.totalCost, currencySymbol)}</td>
                  <td className="px-6 py-4 text-right font-bold text-white">{formatCurrency(boq.totalValue, currencySymbol)}</td>
                  <td className="px-6 py-4 text-center">
                    <div className={cn(
                      "inline-block px-2 py-1 rounded text-xs font-bold",
                      boq.totalMargin < 15 ? "text-rose-400 bg-rose-400/10" : "text-emerald-400 bg-emerald-400/10"
                    )}>
                      {formatPercent(boq.totalMargin)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-indigo-400 font-bold">
                        {boq.createdBy.name[0]}
                      </div>
                      <span className="text-sm text-slate-400">{boq.createdBy.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/boqs/${boq.id}`}
                        className="p-2 text-slate-400 hover:text-white transition-colors"
                      >
                        <MoreVertical size={20} />
                      </Link>
                      <button
                        onClick={() => handleDelete(boq.id)}
                        className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                        title="Delete BOQ"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-xl font-bold text-white">Create New BOQ</h2>
              <p className="text-slate-400 text-sm mt-1">Enter a project name to get started.</p>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Project Name</label>
                <input
                  type="text"
                  value={newBoq.name}
                  onChange={(e) => setNewBoq({ ...newBoq, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="e.g. Skyline Tower Phase 1"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Assign Client</label>
                <select
                  value={newBoq.clientId}
                  onChange={(e) => setNewBoq({ ...newBoq, clientId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  required
                >
                  <option value="">Select a client...</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Project Category</label>
                <select
                  value={newBoq.category}
                  onChange={(e) => setNewBoq({ ...newBoq, category: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  required
                >
                  {erpSettings?.projectCategories?.map((c: string) => (
                    <option key={c} value={c}>{c}</option>
                  )) || <option value="Residential">Residential</option>}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Project State (for Benchmark Rates)</label>
                <select
                  value={newBoq.state}
                  onChange={(e) => setNewBoq({ ...newBoq, state: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  required
                >
                  {availableStates.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded-lg shadow-lg shadow-indigo-500/20 transition-colors"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
