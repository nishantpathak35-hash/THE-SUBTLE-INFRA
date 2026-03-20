import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Package, Users, LogOut, ChevronRight, Plus, AlertCircle, CheckCircle2, Clock, ShoppingCart, ShieldCheck, Building2, CreditCard, Settings as SettingsIcon, ArrowUpCircle, ArrowDownCircle, BarChart3 } from 'lucide-react';
import { useAuthStore } from './store/authStore';
import { cn } from './lib/utils';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import BOQList from './pages/BOQList';
import BOQDetail from './pages/BOQDetail';
import ItemMaster from './pages/ItemMaster';
import Vendors from './pages/Vendors';
import VendorSubmission from './pages/VendorSubmission';
import VendorSetup from './pages/VendorSetup';
import PurchaseOrders from './pages/PurchaseOrders';
import Landing from './pages/Landing';
import Settings from './pages/Settings';
import VendorPortal from './pages/VendorPortal';
import UserManagement from './pages/UserManagement';
import Clients from './pages/Clients';
import CashFlow from './pages/CashFlow';
import Invoices from './pages/Invoices';
import PaymentTracking from './pages/PaymentTracking';
import Logo from './components/Logo';

const SidebarItem = ({ to, icon: Icon, label, active }: { to: string; icon: any; label: string; active?: boolean }) => (
  <Link
    to={to}
    className={cn(
      "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors rounded-lg",
      active ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
    )}
  >
    <Icon size={20} />
    {label}
  </Link>
);

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col border-r border-slate-800 bg-slate-900/50 backdrop-blur-xl">
        <div className="p-6 flex items-center gap-3">
          <Logo size={32} />
          <div className="flex flex-col">
            <span className="text-xs font-black text-indigo-400 tracking-tighter uppercase">THE SUBTLE INFRA</span>
            <span className="text-sm font-bold text-white tracking-tight leading-tight">Business Intelligence</span>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 py-4">
          <SidebarItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
          <SidebarItem to="/clients" icon={Building2} label="Clients" />
          <SidebarItem to="/boqs" icon={FileText} label="BOQs" />
          <SidebarItem to="/items" icon={Package} label="Item Master" />
          <SidebarItem to="/vendors" icon={Users} label="Vendors" />
          <SidebarItem to="/purchase-orders" icon={ShoppingCart} label="Purchase Orders" />
          <SidebarItem to="/invoices" icon={FileText} label="Invoices" />
          <SidebarItem to="/payment-tracking" icon={BarChart3} label="Payment Tracking" />
          <SidebarItem to="/cash-flow" icon={CreditCard} label="Cash Flow" />
          <SidebarItem to="/settings" icon={SettingsIcon} label="Settings" />
          {user?.role === 'Admin' && (
            <SidebarItem to="/users" icon={ShieldCheck} label="User Management" />
          )}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-4 py-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-indigo-400 font-bold">
              {user?.name?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors rounded-lg"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-bottom border-slate-800 flex items-center justify-between px-8 bg-slate-900/30">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>App</span>
            <ChevronRight size={14} />
            <span className="text-slate-100 font-medium">Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-8 w-px bg-slate-800 mx-2" />
            <div className="text-xs text-slate-500">
              Last sync: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default function App() {
  const { user, setUser, isLoading, setIsLoading } = useAuthStore();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch (e) {
        console.error("Auth check failed");
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, [setUser, setIsLoading]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Landing />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/vendor-submit/:token" element={<VendorSubmission />} />
        <Route path="/vendor-setup/:token" element={<VendorSetup />} />
        <Route path="/vendor-portal/:token" element={<VendorPortal />} />
        
        <Route
          path="/*"
          element={
            user ? (
              <MainLayout>
                <Routes>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/clients" element={<Clients />} />
                  <Route path="/boqs" element={<BOQList />} />
                  <Route path="/boqs/:id" element={<BOQDetail />} />
                  <Route path="/items" element={<ItemMaster />} />
                  <Route path="/vendors" element={<Vendors />} />
                  <Route path="/purchase-orders" element={<PurchaseOrders />} />
                  <Route path="/invoices" element={<Invoices />} />
                  <Route path="/payment-tracking" element={<PaymentTracking />} />
                  <Route path="/cash-flow" element={<CashFlow />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/users" element={<UserManagement />} />
                  <Route path="*" element={<Navigate to="/dashboard" />} />
                </Routes>
              </MainLayout>
            ) : (
              <Navigate to="/" />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
