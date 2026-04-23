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
import { useRealtimeRefresh } from '../lib/useRealtimeRefresh';
import { isLoanWrittenOff } from '../lib/loanWriteOff';

type DashboardLoan = {
  id: string;
  principal_amount: number;
  status: 'pending' | 'active' | 'repaid' | 'default';
  notes?: string | null;
};

type DashboardWallet = {
  balance: number;
};

type DashboardTransaction = {
  type: 'income' | 'expense';
  category: 'loan_disbursement' | 'payment_received' | 'fee' | 'adjustment' | 'other';
  amount: number;
  created_at: string;
};

export function Dashboard() {
  const { t, formatCurrency } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  const [stats, setStats] = useState({
    totalCapital: 0,
    monthlyProfit: 0,
    activeLoans: 0,
    defaultRate: 0,
    avgLoanAmount: 0,
    hasWallets: false,
    hasClients: false,
    hasLoans: false,
  });
  const [errorVisible, setErrorVisible] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem(`welcome_seen_${user?.id}`);
    if (!hasSeenWelcome && user) {
      setShowWelcome(true);
    }
  }, [user]);

  const handleWelcomeComplete = () => {
    setShowWelcome(false);
    if (user) {
      localStorage.setItem(`welcome_seen_${user.id}`, 'true');
    }
  };

  useEffect(() => {
    void fetchDashboardStats();
  }, [user]);

  useRealtimeRefresh({
    enabled: !!user,
    channelKey: `dashboard-kpis-${user?.id || 'guest'}`,
    tables: ['loans', 'wallets', 'clients', 'transactions', 'profiles'],
    onRefresh: () => fetchDashboardStats(true),
    intervalMs: 45000,
  });

  async function fetchDashboardStats(silent = false) {
    if (!user) return;

    try {
      if (!silent) {
        setIsLoadingStats(true);
      }

      setErrorVisible(null);

      const [
        { data: profileData },
        { data: loans, error: loansError },
        { data: wallets, error: walletsError },
        { count: clientsCount },
        { data: transactions, error: transactionsError },
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('loans').select('id, principal_amount, status, notes').eq('user_id', user.id),
        supabase.from('wallets').select('balance').eq('user_id', user.id),
        supabase.from('clients').select('id', { count: 'exact' }).eq('user_id', user.id).limit(1),
        supabase.from('transactions').select('type, category, amount, created_at').eq('user_id', user.id),
      ]);

      if (profileData) {
        setProfile(profileData);
      }

      if (loansError) throw loansError;
      if (transactionsError) throw transactionsError;

      const safeLoans = ((loans || []) as DashboardLoan[]).map((loan) => ({
        ...loan,
        principal_amount: Number(loan.principal_amount || 0),
      }));

      const visibleLoans = safeLoans.filter((loan) => !isLoanWrittenOff(loan.notes));
      const issuedLoans = visibleLoans.filter((loan) => loan.status !== 'pending');
      const activeLoans = visibleLoans.filter((loan) => loan.status === 'active');
      const riskyExposure = safeLoans
        .filter((loan) => !isLoanWrittenOff(loan.notes) && (loan.status === 'active' || loan.status === 'default'))
        .reduce((acc, loan) => acc + loan.principal_amount, 0);

      const activeCount = activeLoans.length;
      const defaultCount = issuedLoans.filter((loan) => loan.status === 'default').length;
      const defRate = issuedLoans.length > 0 ? (defaultCount / issuedLoans.length) * 100 : 0;
      const avgAmt =
        issuedLoans.length > 0
          ? issuedLoans.reduce((acc, loan) => acc + loan.principal_amount, 0) / issuedLoans.length
          : 0;

      let totalWalletBalance = 0;
      if (!walletsError && wallets) {
        totalWalletBalance = (wallets as DashboardWallet[]).reduce(
          (acc, wallet) => acc + Number(wallet.balance || 0),
          0
        );
      }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const safeTransactions = (transactions || []) as DashboardTransaction[];

      const monthlyP = safeTransactions
        .filter((transaction) => {
          const createdAt = new Date(transaction.created_at);
          return createdAt >= monthStart && createdAt < nextMonthStart;
        })
        .reduce((acc, transaction) => {
          const amount = Number(transaction.amount || 0);

          if (transaction.type === 'income') {
            return acc + amount;
          }

          if (transaction.category === 'loan_disbursement') {
            return acc;
          }

          return acc - amount;
        }, 0);

      setStats({
        totalCapital: totalWalletBalance + riskyExposure,
        monthlyProfit: monthlyP,
        activeLoans: activeCount,
        defaultRate: defRate,
        avgLoanAmount: avgAmt,
        hasWallets: (wallets?.length || 0) > 0,
        hasClients: (clientsCount || 0) > 0,
        hasLoans: visibleLoans.length > 0,
      });
    } catch (err: any) {
      console.error('Error fetching dashboard stats:', err.message);
      setErrorVisible(err.message);
    } finally {
      if (!silent) {
        setIsLoadingStats(false);
      }
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
        <Header title={t.dashboard} onMenuClick={() => setIsSidebarOpen(true)}>
          {profile?.plan_type && (
            <div className="hidden sm:flex items-center bg-white px-3 py-1.5 rounded-xl gap-2 border border-slate-200 shadow-sm">
              <div
                className={cn(
                  'size-2 rounded-full animate-pulse',
                  profile.plan_type === 'free' ? 'bg-slate-400' : 'bg-emerald-500'
                )}
              />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                {t.planLabel} {profile.plan_type}
              </span>
            </div>
          )}
        </Header>

        <div className="px-4 md:px-6 lg:px-8 py-6 lg:py-10 w-full max-w-[1600px] mx-auto space-y-8 lg:space-y-12 transition-all">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={scrollToSimulator}
              className="group p-4 bg-white rounded-3xl border border-slate-50 shadow-sm hover:shadow-xl hover:shadow-emerald-100/50 transition-all flex flex-col items-center text-center space-y-3"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-emerald-200">
                <Plus className="size-6" />
              </div>
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
                {t.issueLoan || 'Novo Emprestimo'}
              </span>
            </button>
            <button
              onClick={() => navigate('/clients')}
              className="group p-4 bg-white rounded-3xl border border-slate-50 shadow-sm hover:shadow-xl hover:shadow-primary-100/50 transition-all flex flex-col items-center text-center space-y-3"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary-500 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-primary-200">
                <User className="size-6" />
              </div>
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{t.addClient}</span>
            </button>
            <button
              onClick={() => navigate('/payments')}
              className="group p-4 bg-white rounded-3xl border border-slate-50 shadow-sm hover:shadow-xl hover:shadow-amber-100/50 transition-all flex flex-col items-center text-center space-y-3"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-amber-200">
                <Zap className="size-6" />
              </div>
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
                {t.manageInstallments}
              </span>
            </button>
            <button
              onClick={() => navigate('/financial')}
              className="group p-4 bg-white rounded-3xl border border-slate-50 shadow-sm hover:shadow-xl hover:shadow-blue-100/50 transition-all flex flex-col items-center text-center space-y-3"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-500 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-blue-200">
                <Wallet className="size-6" />
              </div>
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{t.wallets}</span>
            </button>
          </div>

          <OnboardingChecklist hasWallets={stats.hasWallets} hasClients={stats.hasClients} hasLoans={stats.hasLoans} />

          {errorVisible && (
            <div className="rounded-[2rem] border border-rose-100 bg-rose-50/80 px-5 py-4 text-sm font-medium text-rose-700">
              Nao foi possivel atualizar todos os indicadores do painel agora. Alguns numeros podem estar temporariamente desatualizados.
            </div>
          )}

          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {isLoadingStats ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`dashboard-kpi-skeleton-${index}`}
                  className="bg-white rounded-[2rem] p-6 lg:p-8 border border-slate-50 shadow-sm animate-pulse"
                >
                  <div className="h-3 w-24 rounded-full bg-slate-100" />
                  <div className="mt-5 h-10 w-32 rounded-2xl bg-slate-100" />
                  <div className="mt-8 h-10 w-full rounded-2xl bg-slate-50" />
                </div>
              ))
            ) : (
              <>
                <KPICard
                  label={t.totalCapital}
                  value={stats.totalCapital}
                  isCurrency={true}
                  subtext="Caixa + carteira em operacao"
                />
                <KPICard
                  label={t.monthlyProfit}
                  value={stats.monthlyProfit}
                  isCurrency={true}
                  subtext="Fluxo liquido do mes"
                />
                <KPICard
                  label={t.activeLoans}
                  value={stats.activeLoans.toString()}
                  subtext={t.avgPerClient.replace('{amount}', formatCurrency(stats.avgLoanAmount))}
                />
                <KPICard
                  label={t.defaultRate}
                  value={`${stats.defaultRate.toFixed(1)}%`}
                  subtext="Base: emprestimos emitidos"
                  trend={stats.defaultRate > 0 ? 'down' : 'neutral'}
                />
              </>
            )}
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
