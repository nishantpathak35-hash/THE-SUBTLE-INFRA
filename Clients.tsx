import React, { useEffect, useState } from 'react';
import { Plus, Search, User, Mail, Phone, Building2, Edit2, Trash2, X, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency } from '../lib/utils';
import { useSettingsStore } from '../store/settingsStore';

export default function Clients() {
  const { erpSettings, fetchSettings } = useSettingsStore();
  const currencySymbol = erpSettings?.currencySymbol || '₹';
  const [clients, setClients] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', email: '', contactInfo: '' });
  const [editingClient, setEditingClient] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchClients = async () => {
    const res = await fetch('/api/clients');
    if (res.ok) {
      const data = await res.json();
      setClients(data);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchClients();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingClient ? `/api/clients/${editingClient.id}` : '/api/clients';
    const method = editingClient ? 'PUT' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingClient || newClient),
    });
    
    if (res.ok) {
      setIsModalOpen(false);
      setEditingClient(null);
      setNewClient({ name: '', email: '', contactInfo: '' });
      fetchClients();
    } else {
      const data = await res.json();
      alert(data.error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this client?")) return;
    try {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchClients();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete client");
      }
    } catch (e) {
      console.error("Delete client error", e);
    }
  };

  const handleEdit = (client: any) => {
    setEditingClient(client);
    setIsModalOpen(true);
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Clients</h1>
          <p className="text-slate-400 mt-1">Manage your client relationships and projects.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-lg shadow-indigo-500/20"
        >
          <Plus size={20} />
          Add Client
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
          {filteredClients.map((client) => (
            <div key={client.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-indigo-500/50 transition-all group">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Building2 size={24} />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(client)}
                    className="p-2 text-slate-500 hover:text-indigo-400 transition-colors"
                    title="Edit Client"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(client.id)}
                    className="p-2 text-slate-500 hover:text-rose-500 transition-colors"
                    title="Delete Client"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">{client.name}</h3>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Mail size={14} />
                  {client.email}
                </div>
                {client.contactInfo && (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Phone size={14} />
                    {client.contactInfo}
                  </div>
                )}
              </div>
              <div className="pt-4 border-t border-slate-700 flex justify-between items-center">
                <div className="text-xs text-slate-500">
                  {client.boqs.length} Projects
                </div>
                <div className="text-sm font-bold text-emerald-400">
                  {formatCurrency(client.inflows.reduce((sum: number, i: any) => sum + i.amount, 0), currencySymbol)} Received
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">{editingClient ? 'Edit Client' : 'Add New Client'}</h2>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingClient(null);
                }}
                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Client Name</label>
                <input
                  type="text"
                  value={editingClient ? editingClient.name : newClient.name}
                  onChange={(e) => editingClient ? setEditingClient({...editingClient, name: e.target.value}) : setNewClient({ ...newClient, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
                <input
                  type="email"
                  value={editingClient ? editingClient.email : newClient.email}
                  onChange={(e) => editingClient ? setEditingClient({...editingClient, email: e.target.value}) : setNewClient({ ...newClient, email: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Contact Info / Phone</label>
                <input
                  type="text"
                  value={editingClient ? editingClient.contactInfo : newClient.contactInfo}
                  onChange={(e) => editingClient ? setEditingClient({...editingClient, contactInfo: e.target.value}) : setNewClient({ ...newClient, contactInfo: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. +91 98765 43210"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingClient(null);
                  }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded-lg shadow-lg shadow-indigo-500/20 transition-colors"
                >
                  {editingClient ? 'Update Client' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
