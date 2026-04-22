import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Shield, 
  Activity, 
  TrendingUp, 
  Search, 
  MoreVertical, 
  UserCheck, 
  UserMinus,
  Crown,
  LayoutDashboard,
  AlertCircle,
  Settings,
  CreditCard,
  Building,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

export function Admin() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { t, formatCurrency } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeLoans: 0,
    totalVolume: 0,
    systemHealth: 98.5
  });
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'gateways'>('users');
  
  // Fake Gateway state for demo
  const [gateways, setGateways] = useState({
    asaas: { active: true, key: 'asaas_live_*******************' },
    stripe: { active: false, key: '' },
    pix: { active: true, key: 'suporte@emerald.pro' }
  });

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  async function checkAdminStatus() {
    if (!user) return;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();
      
      if (profile?.is_admin) {
        setIsAdmin(true);
        fetchAdminData();
      }
    } catch (err) {
      console.error('Error checking admin status:', err);
    }
  }

  async function fetchAdminData() {
    try {
      // Fetch users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (profiles) setUsers(profiles);

      // Fetch global metrics
      const { data: loans } = await supabase
        .from('loans')
        .select('principal_amount, status');
      
      const activeLoans = loans?.filter(l => l.status === 'active') || [];
      const totalVolume = loans?.reduce((acc, curr) => acc + Number(curr.principal_amount), 0) || 0;

      setStats({
        totalUsers: profiles?.length || 0,
        activeLoans: activeLoans.length,
        totalVolume,
        systemHealth: 99.8
      });
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleUserPlan(userId: string, currentPlan: string) {
    const plans: ('free' | 'pro' | 'enterprise')[] = ['free', 'pro', 'enterprise'];
    const currentIndex = plans.indexOf(currentPlan as any);
    const nextPlan = plans[(currentIndex + 1) % plans.length];

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ plan_type: nextPlan })
        .eq('id', userId);
      
      if (error) throw error;
      fetchAdminData();
    } catch (err) {
      console.error('Error updating plan:', err);
    }
  }

  const filteredUsers = users.filter(u => 
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAdmin && !loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <div className="space-y-6 max-w-md">
          <div className="flex justify-center">
            <AlertCircle className="size-20 text-red-500 animate-pulse" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">{t.accessDenied}</h1>
          <p className="text-slate-500 font-medium">{t.accessDenied}</p> {/* Reuse or add specific desc if needed */}
          <button 
            onClick={() => navigate('/')}
            className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold shadow-xl hover:scale-105 transition-all"
          >
            {t.backToDashboard}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <main className="flex-1 lg:ml-72 min-h-screen pb-20 w-full transition-all duration-300">
        <Header title={t.adminPanel} onMenuClick={() => setIsSidebarOpen(true)} />

        <div className="px-4 md:px-6 lg:px-8 py-6 lg:py-10 w-full max-w-[1600px] mx-auto space-y-8 lg:space-y-12 transition-all">
          
          {/* Admin KPI Grid */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            <AdminKPICard 
              label={t.totalUsers} 
              value={stats.totalUsers.toString()} 
              icon={Users} 
              color="bg-blue-50 text-blue-600"
            />
            <AdminKPICard 
              label={t.activeLoans} 
              value={stats.activeLoans.toString()} 
              icon={Activity} 
              color="bg-emerald-50 text-emerald-600"
            />
            <AdminKPICard 
              label={t.totalVolume} 
              value={formatCurrency(stats.totalVolume)} 
              icon={TrendingUp} 
              color="bg-violet-50 text-violet-600"
            />
            <AdminKPICard 
              label="System Health" 
              value={`${stats.systemHealth}%`} 
              icon={Shield} 
              color="bg-amber-50 text-amber-600"
            />
          </section>

          {/* Tabs */}
          <div className="flex items-center gap-4 border-b border-slate-200">
            <button 
              onClick={() => setActiveTab('users')}
              className={cn(
                "pb-4 px-2 text-sm font-bold transition-all border-b-2",
                activeTab === 'users' ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              Usuários & Planos
            </button>
            <button 
              onClick={() => setActiveTab('gateways')}
              className={cn(
                "pb-4 px-2 text-sm font-bold transition-all border-b-2",
                activeTab === 'gateways' ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              Gateways & Faturamento
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'users' ? (
              <motion.div 
                key="users"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
                  <h3 className="text-xl lg:text-2xl font-black tracking-tight text-slate-900">
                    {t.platformManagement}
                  </h3>
                  
                  <div className="relative w-full md:w-80 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                    <input 
                      type="text"
                      placeholder={t.searchTickets}
                      className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none text-sm font-medium"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">{t.clientName}</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Email</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">{t.planLabel}</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">{t.status}</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">{t.actions}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredUsers.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-3">
                                <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500">
                                  {u.avatar_url ? (
                                    <img src={u.avatar_url} className="size-full rounded-full object-cover" alt="" referrerPolicy="no-referrer" />
                                  ) : (
                                    u.full_name.charAt(0)
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-900 leading-none">{u.full_name}</p>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                    {new Date(u.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-5 font-mono text-xs text-slate-500">{u.email}</td>
                            <td className="px-8 py-5">
                              <div className={cn(
                                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                u.plan_type === 'enterprise' ? "bg-violet-100 text-violet-700" :
                                u.plan_type === 'pro' ? "bg-emerald-100 text-emerald-700" : 
                                "bg-slate-100 text-slate-600"
                              )}>
                                {u.plan_type === 'enterprise' && <Shield className="size-3" />}
                                {u.plan_type === 'pro' && <Crown className="size-3" />}
                                {u.plan_type}
                              </div>
                            </td>
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-2">
                                <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">{t.active}</span>
                              </div>
                            </td>
                            <td className="px-8 py-5 text-right">
                              <button 
                                onClick={() => toggleUserPlan(u.id, u.plan_type)}
                                className="p-2 hover:bg-white rounded-xl transition-all hover:shadow-md text-slate-400 hover:text-emerald-500"
                                title="Mudar Plano"
                              >
                                <UserCheck className="size-5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="gateways"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Gateways de Pagamento */}
                  <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
                    <div className="flex items-center gap-4 mb-8">
                      <div className="size-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                        <CreditCard className="size-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-900">Gateways de Recebimento</h3>
                        <p className="text-sm font-medium text-slate-500 mt-1">Configure por onde você cobra as assinaturas do SaaS.</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-full bg-[#001E60] flex items-center justify-center">
                              <span className="text-white font-black text-xs">Asaas</span>
                            </div>
                            <span className="font-bold text-slate-900">Asaas Gateway</span>
                          </div>
                          <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-emerald-500">
                            <span className="inline-block h-4 w-4 translate-x-6 rounded-full bg-white transition" />
                          </div>
                        </div>
                        <input 
                          type="password"
                          value={gateways.asaas.key}
                          onChange={(e) => setGateways({...gateways, asaas: {...gateways.asaas, key: e.target.value}})}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium font-mono text-slate-600"
                          placeholder="API Key"
                        />
                      </div>

                      <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-full bg-[#635BFF] flex items-center justify-center">
                              <span className="text-white font-black text-xs">S</span>
                            </div>
                            <span className="font-bold text-slate-900">Stripe</span>
                          </div>
                          <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-300">
                            <span className="inline-block h-4 w-4 translate-x-1 rounded-full bg-white transition" />
                          </div>
                        </div>
                        <input 
                          type="password"
                          value={gateways.stripe.key}
                          onChange={(e) => setGateways({...gateways, stripe: {...gateways.stripe, key: e.target.value}})}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium font-mono text-slate-600"
                          placeholder="Publishable Key"
                        />
                      </div>
                      
                      <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-full bg-teal-500 flex items-center justify-center">
                              <span className="text-white font-black text-xs">PIX</span>
                            </div>
                            <span className="font-bold text-slate-900">Chave PIX Direta</span>
                          </div>
                          <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-emerald-500">
                            <span className="inline-block h-4 w-4 translate-x-6 rounded-full bg-white transition" />
                          </div>
                        </div>
                        <input 
                          type="text"
                          value={gateways.pix.key}
                          onChange={(e) => setGateways({...gateways, pix: {...gateways.pix, key: e.target.value}})}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium text-slate-600"
                          placeholder="Chave PIX"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Planos e Configurações */}
                  <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
                    <div className="flex items-center gap-4 mb-8">
                      <div className="size-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                        <Settings className="size-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-900">Preços dos Planos (SaaS)</h3>
                        <p className="text-sm font-medium text-slate-500 mt-1">Defina quanto cobrar dos seus clientes.</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                        <div>
                          <p className="font-bold text-slate-900">Free</p>
                          <p className="text-xs text-slate-500 mt-1">Até 3 clientes vinculados</p>
                        </div>
                        <div className="font-black text-slate-900">R$ 0,00</div>
                      </div>
                      
                      <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                        <div>
                          <p className="font-bold text-emerald-900">Pro</p>
                          <p className="text-xs text-emerald-600/70 mt-1">Clientes ilimitados, WhatsApp bot</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-emerald-400">R$</span>
                          <input type="number" defaultValue={97.00} className="w-20 bg-white border border-emerald-200 rounded-lg px-2 py-1 text-emerald-900 font-bold" />
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between p-4 bg-violet-50 rounded-2xl border border-violet-100">
                        <div>
                          <p className="font-bold text-violet-900">Enterprise</p>
                          <p className="text-xs text-violet-600/70 mt-1">Multi-usuários, API Bank, IA Customizada</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-violet-400">R$</span>
                          <input type="number" defaultValue={497.00} className="w-20 bg-white border border-violet-200 rounded-lg px-2 py-1 text-violet-900 font-bold" />
                        </div>
                      </div>
                    </div>
                    
                    <button className="w-full mt-6 flex items-center justify-center gap-2 bg-slate-900 text-white px-4 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all">
                      <CheckCircle2 className="size-4" />
                      Salvar Configurações SaaS
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </main>
    </div>
  );
}

function AdminKPICard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 lg:p-8 rounded-[2rem] shadow-xl shadow-slate-200/40 border border-slate-100 flex items-center gap-6"
    >
      <div className={cn("size-12 lg:size-14 rounded-2xl flex items-center justify-center shrink-0", color)}>
        <Icon className="size-6 lg:size-7" />
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{label}</p>
        <p className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tighter">{value}</p>
      </div>
    </motion.div>
  );
}
