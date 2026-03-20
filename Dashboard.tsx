import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, TrendingUp, AlertTriangle, CheckCircle2, Clock, ArrowUpRight, ArrowDownRight, ArrowUpCircle, ArrowDownCircle, CreditCard } from 'lucide-react';
import { formatCurrency, formatPercent, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useSettingsStore } from '../store/settingsStore';

const StatCard = ({ title, value, icon: Icon, trend, color }: any) => (
  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
    <div className="flex items-center justify-between mb-4">
      <div className={cn("p-3 rounded-xl", color)}>
        <Icon size={24} className="text-white" />
      </div>
      {trend && (
        <div className={cn("flex items-center gap-1 text-sm font-medium", trend > 0 ? "text-emerald-400" : "text-rose-400")}>
          {trend > 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    <h3 className="text-slate-400 text-sm font-medium mb-1">{title}</h3>
    <p className="text-2xl font-bold text-white">{value}</p>
  </div>
);

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [recentBOQs, setRecentBOQs] = useState<any[]>([]);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const { erpSettings, fetchSettings } = useSettingsStore();
  const currencySymbol = erpSettings?.currencySymbol || '₹';

  useEffect(() => {
    fetchSettings();
    const fetchData = async () => {
      try {
        const [boqRes, statsRes] = await Promise.all([
          fetch('/api/boqs'),
          fetch('/api/dashboard/stats')
        ]);
        
        const boqData = await boqRes.json();
        const statsData = await statsRes.json();
        
        if (Array.isArray(boqData)) {
          setRecentBOQs(boqData.slice(0, 5));
        } else {
          console.error("BOQ data is not an array:", boqData);
          setRecentBOQs([]);
        }

        if (statsData && !statsData.error) {
          setStats({
            totalValue: statsData.totalPipelineValue,
            avgMargin: statsData.avgMargin,
            pendingApprovals: statsData.pendingApprovals,
            approvedValue: statsData.approvedValue,
            totalPOValue: statsData.totalPOValue,
            itemCount: statsData.itemCount,
            vendorCount: statsData.vendorCount,
            poCount: statsData.poCount,
            pendingInvoices: statsData.pendingInvoices,
            totalInflow: statsData.totalInflow,
            totalOutflow: statsData.totalOutflow,
            overallProgress: statsData.overallProgress
          });
        } else {
          console.error("Stats data error:", statsData);
        }
      } catch (e) {
        console.error("Failed to fetch dashboard data", e);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Executive Overview</h1>
          <p className="text-slate-400 mt-1">Real-time BOQ performance and margin intelligence.</p>
        </div>
        <div className="flex gap-3">
          <Link 
            to="/boqs?new=true"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20 flex items-center"
          >
            New Project
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm font-medium mb-1">Project Execution Progress</p>
            <p className="text-3xl font-bold text-white">{Math.round(stats?.overallProgress || 0)}%</p>
            <p className="text-xs text-slate-500 mt-2">Overall completion across all active projects</p>
          </div>
          <div className="relative w-24 h-24">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                className="text-slate-800"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={251.2}
                strokeDashoffset={251.2 - (251.2 * (stats?.overallProgress || 0)) / 100}
                className="text-indigo-500 transition-all duration-1000 ease-out"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-white">{Math.round(stats?.overallProgress || 0)}%</span>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-400 text-sm font-medium mb-1">Active Projects</p>
          <p className="text-3xl font-bold text-white">{recentBOQs.length}</p>
          <p className="text-xs text-slate-500 mt-2">Total number of BOQs in the pipeline</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-400 text-sm font-medium mb-1">Vendor Network</p>
          <p className="text-3xl font-bold text-white">{stats?.vendorCount || 0}</p>
          <p className="text-xs text-slate-500 mt-2">Registered vendors across all categories</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Pipeline Value" 
          value={formatCurrency(stats?.totalValue || 0, currencySymbol)} 
          icon={TrendingUp} 
          trend={12}
          color="bg-indigo-600"
        />
        <StatCard 
          title="Total Inflow" 
          value={formatCurrency(stats?.totalInflow || 0, currencySymbol)} 
          icon={ArrowUpCircle} 
          trend={8.5}
          color="bg-emerald-600"
        />
        <StatCard 
          title="Total Outflow" 
          value={formatCurrency(stats?.totalOutflow || 0, currencySymbol)} 
          icon={ArrowDownCircle} 
          trend={-4.2}
          color="bg-rose-600"
        />
        <StatCard 
          title="Net Cash Flow" 
          value={formatCurrency((stats?.totalInflow || 0) - (stats?.totalOutflow || 0), currencySymbol)} 
          icon={CreditCard} 
          color="bg-blue-600"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-400 text-sm font-medium mb-1">Average Project Margin</p>
          <p className="text-2xl font-bold text-white">{formatPercent(stats?.avgMargin || 0)}</p>
          <div className="mt-2 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500" 
              style={{ width: `${Math.min(100, (stats?.avgMargin || 0) * 2)}%` }}
            />
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-400 text-sm font-medium mb-1">Pending Approvals</p>
          <p className="text-2xl font-bold text-amber-400">{stats?.pendingApprovals || 0}</p>
          <p className="text-xs text-slate-500 mt-2">BOQs awaiting executive sign-off</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-400 text-sm font-medium mb-1">Pending Invoices</p>
          <p className="text-2xl font-bold text-rose-400">{stats?.pendingInvoices || 0}</p>
          <p className="text-xs text-slate-500 mt-2">Vendor invoices awaiting payment</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-400 text-sm font-medium mb-1">Purchase Orders</p>
          <p className="text-2xl font-bold text-indigo-400">{stats?.poCount || 0}</p>
          <p className="text-xs text-slate-500 mt-2">Total POs issued to vendors</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Recent BOQs</h2>
              <button className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">View All</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-800/50 text-slate-400 text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 font-semibold">Project Name</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Total Value</th>
                    <th className="px-6 py-4 font-semibold">Margin</th>
                    <th className="px-6 py-4 font-semibold">Created By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {recentBOQs.map((boq) => (
                    <tr key={boq.id} className="hover:bg-slate-800/30 transition-colors cursor-pointer">
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{boq.name}</div>
                        <div className="text-xs text-slate-500">ID: {boq.id.slice(0, 8)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide",
                          boq.status === 'Approved' ? "bg-emerald-400/10 text-emerald-400" :
                          boq.status === 'Pending Approval' ? "bg-amber-400/10 text-amber-400" :
                          "bg-slate-400/10 text-slate-400"
                        )}>
                          {boq.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-200">{formatCurrency(boq.totalValue, currencySymbol)}</td>
                      <td className="px-6 py-4">
                        <div className={cn(
                          "font-bold",
                          boq.totalMargin < 15 ? "text-rose-400" : "text-emerald-400"
                        )}>
                          {formatPercent(boq.totalMargin)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-sm">{boq.createdBy.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">Margin Alerts</h2>
            <div className="space-y-4">
              {recentBOQs.filter(b => b.totalMargin < 15).map(b => (
                <div key={b.id} className="flex gap-3 p-3 bg-rose-400/5 border border-rose-400/20 rounded-xl">
                  <AlertTriangle className="text-rose-400 shrink-0" size={20} />
                  <div>
                    <p className="text-sm font-medium text-rose-100">{b.name}</p>
                    <p className="text-xs text-rose-400/70">Margin dropped to {formatPercent(b.totalMargin)}</p>
                  </div>
                </div>
              ))}
              {recentBOQs.filter(b => b.totalMargin < 15).length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle2 className="text-emerald-400 mx-auto mb-2" size={32} />
                  <p className="text-slate-400 text-sm">All margins healthy</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-indigo-600 rounded-2xl p-6 text-white relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-lg font-bold mb-2">Need Help?</h3>
              <p className="text-indigo-100 text-sm mb-4 opacity-80">Check out our documentation for advanced BOQ strategies and vendor management.</p>
              <button 
                onClick={() => setIsHelpModalOpen(true)}
                className="bg-white text-indigo-600 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-indigo-50 transition-colors"
              >
                Read Docs
              </button>
            </div>
            <FileText size={120} className="absolute -bottom-8 -right-8 text-white/10 rotate-12" />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isHelpModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHelpModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-800 bg-slate-800/30 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-white">Help & Documentation</h2>
                  <p className="text-slate-400 font-bold tracking-tight">Everything you need to know about Business Intelligence.</p>
                </div>
                <button
                  onClick={() => setIsHelpModalOpen(false)}
                  className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
                >
                  <CheckCircle2 size={24} />
                </button>
              </div>
              <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <FileText className="text-indigo-400" size={20} />
                    Getting Started
                  </h3>
                  <p className="text-slate-400 leading-relaxed">
                    Welcome to Business Intelligence by THE SUBTLE INFRA. This platform is designed to manage your BOQs, Purchase Orders, and Vendor relationships with precision.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
                    <h4 className="font-bold text-white mb-2">BOQ Management</h4>
                    <p className="text-xs text-slate-400">Create detailed Bill of Quantities, track margins, and manage project approvals.</p>
                  </div>
                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
                    <h4 className="font-bold text-white mb-2">Purchase Orders</h4>
                    <p className="text-xs text-slate-400">Generate POs with specific terms, track vendor payments, and manage invoices.</p>
                  </div>
                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
                    <h4 className="font-bold text-white mb-2">Vendor Portal</h4>
                    <p className="text-xs text-slate-400">Invite vendors to submit rates directly and view their POs in a dedicated portal.</p>
                  </div>
                  <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
                    <h4 className="font-bold text-white mb-2">Cash Flow</h4>
                    <p className="text-xs text-slate-400">Monitor inflows and outflows to maintain healthy project finances.</p>
                  </div>
                </div>

                <div className="p-6 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl">
                  <h4 className="font-bold text-indigo-400 mb-2">Support Contact</h4>
                  <p className="text-sm text-slate-300">For technical support or feature requests, please contact the THE SUBTLE INFRA IT department.</p>
                </div>
              </div>
              <div className="p-8 border-t border-slate-800 bg-slate-800/30 flex justify-end">
                <button
                  onClick={() => setIsHelpModalOpen(false)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-bold transition-all"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
