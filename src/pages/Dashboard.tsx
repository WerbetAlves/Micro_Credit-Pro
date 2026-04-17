import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { AIAssistantDashboard } from '../components/AIAssistantDashboard';
import { KPICard } from '../components/KPICard';
import { LoanSimulator } from '../components/LoanSimulator';
import { UpcomingCollections } from '../components/UpcomingCollections';
import { RecentActivity } from '../components/RecentActivity';
import { PortfolioHealth } from '../components/PortfolioHealth';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export function Dashboard() {
  const { t, formatCurrency } = useLanguage();
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [stats, setStats] = useState({
    totalCapital: 0,
    monthlyProfit: 0,
    activeLoans: 0,
    defaultRate: 0,
    avgLoanAmount: 0
  });

  useEffect(() => {
    fetchDashboardStats();
  }, [user]);

  async function fetchDashboardStats() {
    if (!user) return;

    try {
      const { data: loans, error: loansError } = await supabase
        .from('loans')
        .select('*')
        .eq('user_id', user.id);

      if (loansError) throw loansError;

      const totalCap = (loans || []).reduce((acc, l) => acc + Number(l.principal_amount), 0);
      const activeCount = (loans || []).filter(l => l.status === 'active' || l.status === 'pending').length;
      const defaultCount = (loans || []).filter(l => l.status === 'default').length;
      const defRate = loans?.length ? (defaultCount / loans.length) * 100 : 0;
      const avgAmt = loans?.length ? totalCap / loans.length : 0;

      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      const { data: paidInstallments, error: instError } = await supabase
        .from('installments')
        .select('amount, loans!inner(user_id)')
        .eq('status', 'paid')
        .eq('loans.user_id', user.id)
        .gte('due_date', firstDay)
        .lte('due_date', lastDay);

      if (instError) throw instError;

      const monthlyP = (paidInstallments || []).reduce((acc, i) => acc + Number(i.amount), 0);

      setStats({
        totalCapital: totalCap,
        monthlyProfit: monthlyP,
        activeLoans: activeCount,
        defaultRate: defRate,
        avgLoanAmount: avgAmt
      });
    } catch (err: any) {
      console.error('Error fetching dashboard stats:', err.message);
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

      <main className="flex-1 lg:ml-72 min-h-screen pb-24 w-full">
        
        <Header title={t.dashboard} onMenuClick={() => setIsSidebarOpen(true)} />

        <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[1400px] mx-auto space-y-8 lg:space-y-12">

          {/* KPIs */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
            <KPICard 
              label={t.totalCapital} 
              value={stats.totalCapital} 
              isCurrency
              change={t.vsLastMonth.replace('{val}', '+0.0%')}
              trend="up" 
            />
            <KPICard 
              label={t.monthlyProfit} 
              value={stats.monthlyProfit} 
              isCurrency
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

          {/* Conteúdo principal */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8">

            {/* Esquerda */}
            <div className="xl:col-span-8 min-w-0">
              <UpcomingCollections />
            </div>

            {/* Direita */}
            <div className="xl:col-span-4 space-y-6 min-w-0">
              <AIAssistantDashboard />
              <RecentActivity />

              <div className="bg-emerald-600 rounded-3xl p-6 text-white relative overflow-hidden shadow-lg">
                <div className="relative z-10 space-y-3">
                  <h3 className="text-base sm:text-lg font-bold">
                    {t.needSupport}
                  </h3>

                  <p className="text-sm text-emerald-50 leading-relaxed max-w-full sm:max-w-[260px]">
                    {t.supportText}
                  </p>

                  <button className="bg-white text-emerald-600 px-5 py-2.5 rounded-xl font-bold text-xs tracking-wide hover:scale-105 active:scale-95 transition">
                    {t.liveChat}
                  </button>
                </div>

                <Plus className="absolute -bottom-8 -right-8 size-28 opacity-10 rotate-12" />
              </div>
            </div>
          </div>

          {/* Simulador */}
          <div id="issue-new-credit" className="space-y-4 scroll-mt-24">
            <h3 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900">
              {t.issueNewCredit}
            </h3>

            <div className="w-full">
              <LoanSimulator />
            </div>
          </div>

          {/* Rodapé */}
          <PortfolioHealth />

        </div>
      </main>

      {/* FAB Mobile */}
      <button 
        onClick={scrollToSimulator}
        className="fixed bottom-5 right-5 lg:hidden w-14 h-14 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-xl z-50 hover:scale-110 active:scale-95 transition"
      >
        <Plus className="size-6" />
      </button>

    </div>
  );
}