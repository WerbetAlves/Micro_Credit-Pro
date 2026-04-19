import { useState, useEffect } from 'react';
import { Search, Bell, Plus, Menu, Zap } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { AIAssistantDashboard } from '../components/AIAssistantDashboard';
import { KPICard } from '../components/KPICard';
import { LoanSimulator } from '../components/LoanSimulator';
import { UpcomingCollections } from '../components/UpcomingCollections';
import { RecentActivity } from '../components/RecentActivity';
import { PortfolioHealth } from '../components/PortfolioHealth';
import { OnboardingChecklist } from '../components/OnboardingChecklist';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase, isConfigured } from '../lib/supabase';
import { cn } from '../lib/utils';
import { AlertCircle } from 'lucide-react';

export function Dashboard() {
  const { t, formatCurrency } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  
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
  const [errorVisible, setErrorVisible] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardStats();
  }, [user]);

  async function fetchDashboardStats() {
    if (!user) return;

    try {
      setErrorVisible(null);
      // 0. Busca Perfil
      const { data: profileData } = await supabase.from('profiles').select('*').single();
      if (profileData) setProfile(profileData);

      // 1. Busca Empréstimos (Dinheiro Emprestado)
      const { data: loans, error: loansError } = await supabase
        .from('loans')
        .select('*')
        .eq('user_id', user.id);
      
      if (loansError) throw loansError;

      const totalLoansCapital = (loans || []).reduce((acc, l) => acc + Number(l.principal_amount), 0);
      const activeCount = (loans || []).filter(l => l.status === 'active' || l.status === 'pending').length;
      const defaultCount = (loans || []).filter(l => l.status === 'default').length;
      const defRate = loans?.length ? (defaultCount / loans.length) * 100 : 0;
      const avgAmt = loans?.length ? totalLoansCapital / loans.length : 0;

      // 2. Busca Saldo das Carteiras (Dinheiro em Caixa)
      let totalWalletBalance = 0;
      const { data: wallets, error: walletsError } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id);
      
      if (!walletsError && wallets) {
        totalWalletBalance = wallets.reduce((acc, w) => acc + Number(w.balance), 0);
      }

      // 3. Busca Contagem de Clientes (para o Onboarding)
      const { count: clientsCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // 4. Lucro Mensal (Cálculo robusto sem join complexo)
      let monthlyP = 0;
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      
      const { data: paidInstallments, error: instError } = await supabase
        .from('installments')
        .select('amount, loan_id')
        .eq('status', 'paid')
        .gte('due_date', firstDay)
        .lte('due_date', lastDay);

      if (!instError && paidInstallments && loans) {
        const myLoanIds = loans.map(l => l.id);
        monthlyP = paidInstallments
          .filter(i => myLoanIds.includes(i.loan_id))
          .reduce((acc, i) => acc + Number(i.amount), 0);
      }

      // 5. Consolida tudo no Estado
      setStats({
        totalCapital: totalLoansCapital + totalWalletBalance,
        monthlyProfit: monthlyP,
        activeLoans: activeCount,
        defaultRate: defRate,
        avgLoanAmount: avgAmt,
        hasWallets: (wallets?.length || 0) > 0,
        hasClients: (clientsCount || 0) > 0,
        hasLoans: (loans?.length || 0) > 0
      });
    } catch (err: any) {
      console.error('Error fetching dashboard stats:', err.message);
      setErrorVisible(err.message);
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
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="flex-1 lg:ml-72 min-h-screen pb-20 w-full transition-all duration-300">
        <Header title={t.dashboard} onMenuClick={() => setIsSidebarOpen(true)}>
          {profile?.plan_type && (
            <div className="hidden sm:flex items-center bg-white px-3 py-1.5 rounded-xl gap-2 border border-slate-200 shadow-sm">
              <div className={cn(
                "size-2 rounded-full animate-pulse",
                profile.plan_type === 'free' ? "bg-slate-400" : "bg-emerald-500"
              )} />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                Plano {profile.plan_type}
              </span>
            </div>
          )}
        </Header>

        <div className="px-4 md:px-6 lg:px-8 py-6 lg:py-10 w-full max-w-[1600px] mx-auto space-y-8 lg:space-y-12 transition-all">
          
          <OnboardingChecklist 
            hasWallets={stats.hasWallets}
            hasClients={stats.hasClients}
            hasLoans={stats.hasLoans}
          />

          {/* KPI Grid - O Card "Total Capital" agora refletirá a nova conta */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            <KPICard 
              label={t.totalCapital} 
              value={stats.totalCapital} 
              isCurrency={true}
              change={t.vsLastMonth.replace('{val}', '+0.0%')}
              trend="up" 
            />
            <KPICard 
              label={t.monthlyProfit} 
              value={stats.monthlyProfit} 
              isCurrency={true}
              change={t.yield.replace('{val}', '0.0%')} 
              trend="up" 
            />
            <KPICard 
              label={t.activeLoans} 
              value={stats.activeLoans.toString()} 
              subtext={t.avgPerClient.replace('{amount}', formatCurrency(stats.avgLoanAmount))} 
            />
            <KPICard 
              label={t.defaultRate} 
              value={`${stats.defaultRate.toFixed(1)}%`} 
              change={t.improvement.replace('{val}', '0,0%')} 
              trend="up" 
            />
          </section>

          {/* LAYOUT DO MAIN CONTENT: Simulador no topo como configuramos antes */}
          <div className="space-y-8 lg:space-y-12 w-full">
            
            {/* LINHA 1: Simulador Ocupando a Largura Total (12/12) */}
            <div id="issue-new-credit" className="space-y-6 scroll-mt-24 w-full">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xl lg:text-2xl font-black tracking-tight text-slate-900">{t.issueNewCredit}</h3>
              </div>
              <div className="w-full">
                <LoanSimulator />
              </div>
            </div>

            {/* LINHA 2: Cobranças e Sidebar Direita */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 md:gap-8 lg:gap-12">
              <div className="xl:col-span-8 w-full min-w-0">
                <UpcomingCollections />
              </div>

              <div className="xl:col-span-4 space-y-8 w-full min-w-0">
                <AIAssistantDashboard />
                <RecentActivity />
                
                <div className="bg-emerald-600 rounded-[2rem] p-6 lg:p-8 text-white relative overflow-hidden shadow-xl shadow-emerald-100">
                  <div className="relative z-10 space-y-4">
                    <h3 className="text-lg lg:text-xl font-bold tracking-tight">{t.needSupport}</h3>
                    <p className="text-sm text-emerald-50 font-medium opacity-90 leading-relaxed max-w-[280px]">
                      {t.supportText}
                    </p>
                    <button 
                      onClick={() => navigate('/support')}
                      className="bg-white text-emerald-600 px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg hover:scale-105 transition-transform active:scale-95"
                    >
                      {t.liveChat}
                    </button>
                  </div>
                  <Plus className="absolute -bottom-10 -right-10 size-32 lg:size-48 opacity-10 rotate-12" />
                </div>
              </div>
            </div>

          </div>

          <PortfolioHealth />
        </div>
      </main>

      <button 
        onClick={scrollToSimulator}
        className="fixed bottom-6 right-6 lg:hidden w-14 h-14 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-2xl shadow-emerald-200 z-50 hover:scale-110 active:scale-95 transition-all"
      >
        <Plus className="size-7" />
      </button>
    </div>
  );
}