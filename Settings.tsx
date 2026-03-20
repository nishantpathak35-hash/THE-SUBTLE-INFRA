import React, { useEffect, useState } from 'react';
import { MapPin, Plus, Trash2, AlertCircle, Building2, FileText, Hash, Save, CheckCircle2, Users, UserPlus, Mail, Shield, ShieldCheck, X, Lock, UserCog } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuthStore } from '../store/authStore';

const ROLES = ['Admin', 'Estimator', 'Procurement', 'Viewer'];

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'company' | 'po' | 'states' | 'users' | 'defaults'>('company');
  const [settings, setSettings] = useState({
    companyName: '',
    address: '',
    logoUrl: '',
    gstNumber: '',
    panNumber: '',
    poSeries: 'PO',
    poNextNumber: 1,
    poTerms: '',
    defaultGstRate: 18,
    defaultMargin: 20,
    currencySymbol: '₹',
    projectCategories: 'Residential,Commercial,Industrial,Infrastructure'
  });
  const [states, setStates] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [newState, setNewState] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'Estimator' });
  const { user: currentUser } = useAuthStore();

  const fetchData = async () => {
    try {
      const [settingsRes, statesRes, usersRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/states'),
        fetch('/api/users')
      ]);
      
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSettings(settingsData);
      }
      
      if (statesRes.ok) {
        const statesData = await statesRes.json();
        setStates(statesData);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);
      }
    } catch (e) {
      console.error("Failed to fetch settings data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setSuccess('Settings updated successfully');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to update settings');
      }
    } catch (e) {
      setError('Network error while saving settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });

      if (res.ok) {
        setIsUserModalOpen(false);
        setNewUser({ name: '', email: '', password: '', role: 'Estimator' });
        fetchData();
        setSuccess('User added successfully');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to add user');
      }
    } catch (e) {
      setError('Failed to add user');
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (id === currentUser?.id) {
      alert("You cannot delete yourself.");
      return;
    }
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete user');
      }
    } catch (e) {
      setError('Failed to delete user');
    }
  };

  const handleAddState = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newState.trim()) return;

    try {
      const res = await fetch('/api/states', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newState.trim() }),
      });

      if (res.ok) {
        setNewState('');
        setError(null);
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to add state');
      }
    } catch (e: any) {
      setError(`Network error: ${e.message}`);
    }
  };

  const handleDeleteState = async (id: string) => {
    try {
      const res = await fetch(`/api/states/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete state");
      }
    } catch (e) {
      setError("Network error during deletion");
    }
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-4xl font-black text-white tracking-tight">Settings</h1>
        <p className="text-slate-400 mt-2 text-lg">Configure your company profile and application defaults.</p>
      </div>

      <div className="flex flex-wrap gap-2 p-1 bg-slate-900 border border-slate-800 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('company')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
            activeTab === 'company' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-400 hover:text-white hover:bg-slate-800"
          )}
        >
          <Building2 size={18} />
          Company Info
        </button>
        <button
          onClick={() => setActiveTab('po')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
            activeTab === 'po' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-400 hover:text-white hover:bg-slate-800"
          )}
        >
          <Hash size={18} />
          PO Config
        </button>
        <button
          onClick={() => setActiveTab('states')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
            activeTab === 'states' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-400 hover:text-white hover:bg-slate-800"
          )}
        >
          <MapPin size={18} />
          States
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
            activeTab === 'users' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-400 hover:text-white hover:bg-slate-800"
          )}
        >
          <Users size={18} />
          Users
        </button>
        <button
          onClick={() => setActiveTab('defaults')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
            activeTab === 'defaults' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-400 hover:text-white hover:bg-slate-800"
          )}
        >
          <ShieldCheck size={18} />
          ERP Defaults
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {activeTab === 'company' && (
              <motion.div
                key="company"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl"
              >
                <div className="p-8 border-b border-slate-800 bg-slate-800/30">
                  <h2 className="text-xl font-bold text-white">Company Profile</h2>
                  <p className="text-sm text-slate-500 mt-1">This information will appear on your generated PDFs.</p>
                </div>
                <form onSubmit={handleSaveSettings} className="p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Company Name</label>
                      <input
                        type="text"
                        value={settings.companyName || ''}
                        onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                        placeholder="Subtle Infra"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">GST Number</label>
                      <input
                        type="text"
                        value={settings.gstNumber || ''}
                        onChange={(e) => setSettings({ ...settings, gstNumber: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                        placeholder="27AAAAA0000A1Z5"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">PAN Number</label>
                      <input
                        type="text"
                        value={settings.panNumber || ''}
                        onChange={(e) => setSettings({ ...settings, panNumber: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                        placeholder="ABCDE1234F"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Logo URL</label>
                      <input
                        type="text"
                        value={settings.logoUrl || ''}
                        onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                        placeholder="https://example.com/logo.png"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Address</label>
                      <textarea
                        value={settings.address || ''}
                        onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold min-h-[100px]"
                        placeholder="123, Business Park, Mumbai, Maharashtra"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4">
                    <div className="flex items-center gap-4">
                      {success && (
                        <span className="text-emerald-400 text-sm flex items-center gap-2">
                          <CheckCircle2 size={16} />
                          {success}
                        </span>
                      )}
                      {error && (
                        <span className="text-rose-400 text-sm flex items-center gap-2">
                          <AlertCircle size={16} />
                          {error}
                        </span>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-8 py-3 rounded-2xl font-black transition-all flex items-center gap-2 shadow-xl shadow-indigo-500/20"
                    >
                      {isSaving ? 'Saving...' : (
                        <>
                          <Save size={20} />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {activeTab === 'po' && (
              <motion.div
                key="po"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl"
              >
                <div className="p-8 border-b border-slate-800 bg-slate-800/30">
                  <h2 className="text-xl font-bold text-white">Purchase Order Configuration</h2>
                  <p className="text-sm text-slate-500 mt-1">Manage PO numbering series and standard terms.</p>
                </div>
                <form onSubmit={handleSaveSettings} className="p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">PO Series Prefix</label>
                      <input
                        type="text"
                        value={settings.poSeries || ''}
                        onChange={(e) => setSettings({ ...settings, poSeries: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                        placeholder="PO"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Next PO Number</label>
                      <input
                        type="number"
                        value={settings.poNextNumber || 1}
                        onChange={(e) => setSettings({ ...settings, poNextNumber: parseInt(e.target.value) })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Standard Terms & Conditions</label>
                      <textarea
                        value={settings.poTerms || ''}
                        onChange={(e) => setSettings({ ...settings, poTerms: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold min-h-[200px]"
                        placeholder="1. Payment within 30 days...&#10;2. Delivery at site..."
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end pt-4">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-8 py-3 rounded-2xl font-black transition-all flex items-center gap-2 shadow-xl shadow-indigo-500/20"
                    >
                      {isSaving ? 'Saving...' : (
                        <>
                          <Save size={20} />
                          Save PO Config
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {activeTab === 'states' && (
              <motion.div
                key="states"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl"
              >
                <div className="p-8 border-b border-slate-800 bg-slate-800/30 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">Manage States</h2>
                    <p className="text-sm text-slate-500 mt-1">Define states for regional rate management.</p>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
                    {states.length} Active
                  </span>
                </div>
                <div className="p-8 space-y-6">
                  <form onSubmit={handleAddState} className="flex gap-3">
                    <input
                      type="text"
                      value={newState}
                      onChange={(e) => setNewState(e.target.value)}
                      placeholder="Enter state name (e.g. Gujarat)"
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                    />
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl font-black transition-all flex items-center gap-2 shadow-xl shadow-indigo-500/20"
                    >
                      <Plus size={20} />
                      Add
                    </button>
                  </form>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    <AnimatePresence mode="popLayout">
                      {states.map((state) => (
                        <motion.div
                          key={state.id}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="flex items-center justify-between p-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl hover:bg-slate-800 transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-indigo-400">
                              <MapPin size={16} />
                            </div>
                            <span className="font-bold text-slate-200">{state.name}</span>
                          </div>
                          <button
                            onClick={() => handleDeleteState(state.id)}
                            className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={18} />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'users' && (
              <motion.div
                key="users"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl"
              >
                <div className="p-8 border-b border-slate-800 bg-slate-800/30 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">User Management</h2>
                    <p className="text-sm text-slate-500 mt-1">Manage team members and their access levels.</p>
                  </div>
                  <button
                    onClick={() => setIsUserModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                  >
                    <UserPlus size={18} />
                    Add User
                  </button>
                </div>
                <div className="p-8">
                  <div className="space-y-3">
                    {users.map((u) => (
                      <div key={u.id} className="flex items-center justify-between p-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl hover:bg-slate-800 transition-all group">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-indigo-400 font-bold border border-slate-700">
                            {u.name[0]}
                          </div>
                          <div>
                            <p className="font-bold text-white">{u.name}</p>
                            <p className="text-xs text-slate-500">{u.email} • {u.role}</p>
                          </div>
                        </div>
                        {u.id !== currentUser?.id && (
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'defaults' && (
              <motion.div
                key="defaults"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl"
              >
                <div className="p-8 border-b border-slate-800 bg-slate-800/30">
                  <h2 className="text-xl font-bold text-white">ERP Defaults & Customization</h2>
                  <p className="text-sm text-slate-500 mt-1">Set global defaults for financial calculations and project categorization.</p>
                </div>
                <form onSubmit={handleSaveSettings} className="p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Default GST Rate (%)</label>
                      <input
                        type="number"
                        value={settings.defaultGstRate}
                        onChange={(e) => setSettings({ ...settings, defaultGstRate: parseFloat(e.target.value) })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Default Margin (%)</label>
                      <input
                        type="number"
                        value={settings.defaultMargin}
                        onChange={(e) => setSettings({ ...settings, defaultMargin: parseFloat(e.target.value) })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Currency Symbol</label>
                      <input
                        type="text"
                        value={settings.currencySymbol}
                        onChange={(e) => setSettings({ ...settings, currencySymbol: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                        placeholder="₹"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Project Categories (Comma separated)</label>
                      <textarea
                        value={settings.projectCategories}
                        onChange={(e) => setSettings({ ...settings, projectCategories: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold min-h-[100px]"
                        placeholder="Residential, Commercial, Industrial"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end pt-4">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-8 py-3 rounded-2xl font-black transition-all flex items-center gap-2 shadow-xl shadow-indigo-500/20"
                    >
                      {isSaving ? 'Saving...' : (
                        <>
                          <Save size={20} />
                          Save Defaults
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <FileText size={20} className="text-indigo-400" />
              Quick Help
            </h3>
            <div className="space-y-4">
              <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                <p className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-1">PO Numbering</p>
                <p className="text-sm text-slate-400 leading-relaxed">
                  The PO number is generated as <code className="text-indigo-300 font-bold">Prefix-00X</code>. 
                  Changing the next number will affect only future POs.
                </p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                <p className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-1">GST & PAN</p>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Ensure these are correct as they are legally required on all Purchase Orders and Invoices.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isUserModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-2xl font-black text-white tracking-tight">Add Team Member</h2>
              <button onClick={() => setIsUserModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                <X size={28} />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Full Name</label>
                <div className="relative">
                  <UserCog className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl pl-12 pr-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                    placeholder="John Doe"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl pl-12 pr-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                    placeholder="john@subtleinfra.com"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Access Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl pl-12 pr-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Access Role</label>
                <div className="relative">
                  <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl pl-12 pr-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold appearance-none cursor-pointer"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl transition-all border border-slate-700 uppercase tracking-widest text-[10px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest text-[10px]"
                >
                  Grant Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

