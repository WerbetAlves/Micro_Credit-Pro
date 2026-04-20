import { useState, useEffect } from 'react';
import { Plus, Zap, User, Wallet } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { AIAssistantDashboard } from '../components/AIAssistantDashboard';
import { KPICard } from '../components/KPICard';
import { LoanSimulator } from '../components/LoanSimulator';
import { UpcomingCollections } from '../components/UpcomingCollections';
import { RecentActivity } from '../components/RecentActivity';
import { PortfolioHealth } from '../components/PortfolioHealth';
import { OnboardingChecklist } from '../components/OnboardingChecklist';
import { WelcomeAnimation } from '../components/WelcomeAnimation';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

export function Dashboard() {
  const { t, formatCurrency } = useLanguage();
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [stats, setStats] = useState({
    totalCapital: 0,
    monthlyProfit: 0,
    activeLoans: 0,
    defaultRate: 0,
    avgLoanAmount: 0,
    hasWallets: false,
    hasClients: false,
    hasLoans: false
  });
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (profile && profile.has_onboarded === false) {
      setShowWelcome(true);
    }
  }, [profile]);

  const handleWelcomeComplete = async () => {
    setShowWelcome(false);
    if (user) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ has_onboarded: true })
          .eq('id', user.id);
        if (error) throw error;
        await refreshProfile();
      } catch (err) {
        console.error("Erro ao atualizar status de onboarding:", err);
      }
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardStats();
    }
  }, [user]);

  // 🔥 Lógica de Conexão e Cálculos Otimizada
  async function fetchDashboardStats() {
    if (!user) return;
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Puxamos todas as tabelas necessárias em paralelo para máxima performance
      const [loansRes, walletsRes, clientsRes, txRes] = await Promise.all([
        supabase.from('loans').select('id, principal_amount, status').eq('user_id', user.id),
        supabase.from('wallets').select('balance').eq('user_id', user.id),
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('transactions')
          .select('amount, type, category')
          .eq('user_id', user.id)
          .gte('created_at', firstDayOfMonth)
      ]);

      // 1. Capital Total = Soma exata do saldo em todas as carteiras (Liquidez real)
      const totalWalletBalance = (walletsRes.data || []).reduce((acc, w) => acc + Number(w.balance), 0);

      // 2. Lucro Mensal = Fluxo de Caixa (Entradas - Saídas do mês)
      // Nota: Categorizamos 'loan_disbursement' como investimento, não despesa de lucro.
      const monthlyIncome = (txRes.data || [])
        .filter(t => t.type === 'income')
        .reduce((acc, t) => acc + Number(t.amount), 0);
      
      const monthlyExpenses = (txRes.data || [])
        .filter(t => t.type === 'expense' && t.category !== 'loan_disbursement')
        .reduce((acc, t) => acc + Number(t.amount), 0);

      const netProfit = monthlyIncome - monthlyExpenses;

      // 3. Estatísticas de Empréstimos
      const totalLoans = loansRes.data || [];
      const activeCount = totalLoans.filter(l => l.status === 'active' || l.status === 'pending').length;
      const defaultCount = totalLoans.filter(l => l.status === 'default').length;
      const defRate = totalLoans.length ? (defaultCount / totalLoans.length) * 100 : 0;
      const totalPrincipalOut = totalLoans.reduce((acc, l) => acc + Number(l.principal_amount), 0);
      const avgAmt = totalLoans.length ? totalPrincipalOut / totalLoans.length : 0;

      setStats({
        totalCapital: totalWalletBalance, 
        monthlyProfit: netProfit,
        activeLoans: activeCount,
        defaultRate: defRate,
        avgLoanAmount: avgAmt,
        hasWallets: (walletsRes.data?.length || 0) > 0,
        hasClients: (clientsRes.count || 0) > 0,
        hasLoans: totalLoans.length > 0
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', (error as Error).message);
    }
  }

  const scrollToSimulator = () => {
    const element = document.getElementById('issue-new-credit');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f8fafc] overflow-x-hidden">
      {showWelcome && <WelcomeAnimation onComplete={handleWelcomeComplete} />}
      
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="flex-1 lg:ml-72 min-h-screen pb-20 w-full transition-all duration-300">
        <Header 
          title={t.dashboard} 
          onMenuClick={() => setIsSidebarOpen(true)}
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder={t.search}
        >
          {profile?.plan_type && (
            <div className="hidden sm:flex items-center bg-white px-3 py-1.5 rounded-xl gap-2 border border-slate-200 shadow-sm">
              <div className={cn(
                "size-2 rounded-full animate-pulse",
                profile.plan_type === 'free' ? "bg-slate-400" : "bg-emerald-500"
              )} />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                {t.planLabel || 'Plano'}: {profile.plan_type}
              </span>
            </div>
          )}
        </Header>

        <div className="px-4 md:px-6 lg:px-8 py-6 lg:py-10 w-full max-w-[1600px] mx-auto space-y-8 lg:space-y-12 transition-all">
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <button onClick={scrollToSimulator} className="group p-4 bg-white rounded-3xl border border-slate-50 shadow-sm hover:shadow-xl hover:shadow-emerald-100/50 transition-all flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-emerald-200">
                <Plus className="size-6" />
              </div>
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{t.issueLoan}</span>
            </button>
            <button onClick={() => navigate('/clients')} className="group p-4 bg-white rounded-3xl border border-slate-50 shadow-sm hover:shadow-xl hover:shadow-primary-100/50 transition-all flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-primary-500 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-primary-200">
                <User className="size-6" />
              </div>
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{t.addClient}</span>
            </button>
            <button onClick={() => navigate('/payments')} className="group p-4 bg-white rounded-3xl border border-slate-50 shadow-sm hover:shadow-xl hover:shadow-amber-100/50 transition-all flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-amber-200">
                <Zap className="size-6" />
              </div>
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{t.manageInstallments}</span>
            </button>
            <button onClick={() => navigate('/financial')} className="group p-4 bg-white rounded-3xl border border-slate-50 shadow-sm hover:shadow-xl hover:shadow-blue-100/50 transition-all flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-500 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-blue-200">
                <Wallet className="size-6" />
              </div>
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{t.wallets}</span>
            </button>
          </div>

          <OnboardingChecklist hasWallets={stats.hasWallets} hasClients={stats.hasClients} hasLoans={stats.hasLoans} />

          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            <KPICard label={t.totalCapital} value={stats.totalCapital} isCurrency={true} change={t.vsLastMonth?.replace('{val}', '+0.0%')} trend="up" />
            <KPICard label={t.monthlyProfit} value={stats.monthlyProfit} isCurrency={true} change={t.yield?.replace('{val}', '0.0%')} trend="up" />
            <KPICard label={t.activeLoans} value={stats.activeLoans.toString()} subtext={t.avgPerClient?.replace('{amount}', formatCurrency(stats.avgLoanAmount))} />
            <KPICard label={t.defaultRate} value={`${stats.defaultRate.toFixed(1)}%`} change={t.improvement?.replace('{val}', '0.0%')} trend="up" />
          </section>

          <div className="space-y-8 lg:space-y-12 w-full">
            <div id="issue-new-credit" className="space-y-6 scroll-mt-24 w-full">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xl lg:text-2xl font-black tracking-tight text-slate-900">{t.issueNewCredit}</h3>
              </div>
              <div className="w-full">
                <LoanSimulator />
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 md:gap-8 lg:gap-12">
              <div className="xl:col-span-8 w-full min-w-0">
                <UpcomingCollections searchTerm={searchTerm} />
              </div>

              <div className="xl:col-span-4 space-y-8 w-full min-w-0">
                <AIAssistantDashboard />
                <RecentActivity searchTerm={searchTerm} />
                
                <div className="bg-emerald-600 rounded-[2rem] p-6 lg:p-8 text-white relative overflow-hidden shadow-xl shadow-emerald-100">
                  <div className="relative z-10 space-y-4">
                    <h3 className="text-lg lg:text-xl font-bold tracking-tight">{t.needSupport}</h3>
                    <p className="text-sm text-emerald-50 font-medium opacity-90 leading-relaxed max-w-[280px]">{t.supportText}</p>
                    <button onClick={() => navigate('/support')} className="bg-white text-emerald-600 px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg hover:scale-105 transition-transform active:scale-95">{t.liveChat}</button>
                  </div>
                  <Plus className="absolute -bottom-10 -right-10 size-32 lg:size-48 opacity-10 rotate-12" />
                </div>
              </div>
            </div>
          </div>

          <PortfolioHealth />
        </div>
      </main>

      <button onClick={scrollToSimulator} className="fixed bottom-6 right-6 lg:hidden w-14 h-14 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-2xl shadow-emerald-200 z-50 hover:scale-110 active:scale-95 transition-all">
        <Plus className="size-7" />
      </button>
    </div>
  );
}