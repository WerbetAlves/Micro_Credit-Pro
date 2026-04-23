import { useEffect, useMemo, useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { CheckCircle2, CreditCard, Landmark, LifeBuoy, UserPlus } from 'lucide-react';

type ActivityItem = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  type: 'loan' | 'payment' | 'ticket' | 'client' | 'transaction';
};

const activityIcons = {
  loan: Landmark,
  payment: CheckCircle2,
  ticket: LifeBuoy,
  client: UserPlus,
  transaction: CreditCard,
};

export function ActivityLog() {
  const { user } = useAuth();
  const { t, formatCurrency } = useLanguage();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, [user]);

  async function fetchActivities() {
    if (!user) return;
    setLoading(true);

    try {
      const [{ data: loans }, { data: installments }, { data: clients }, { data: tickets }, { data: transactions }] =
        await Promise.all([
          supabase
            .from('loans')
            .select('id, principal_amount, created_at, clients(full_name)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20),
          supabase
            .from('installments')
            .select('id, amount, status, created_at, loans!inner(user_id, clients(full_name))')
            .eq('loans.user_id', user.id)
            .in('status', ['paid', 'late', 'missed'])
            .order('created_at', { ascending: false })
            .limit(20),
          supabase
            .from('clients')
            .select('id, full_name, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20),
          supabase
            .from('support_tickets')
            .select('id, subject, status, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20),
          supabase
            .from('transactions')
            .select('id, type, category, amount, description, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20),
        ]);

      const merged: ActivityItem[] = [
        ...((loans || []) as any[]).map((loan) => ({
          id: `loan-${loan.id}`,
          title: t.newLoanApproved,
          description: `${formatCurrency(Number(loan.principal_amount || 0))} ${t.for} ${loan.clients?.full_name || 'Cliente'}`,
          createdAt: loan.created_at,
          type: 'loan' as const,
        })),
        ...((installments || []) as any[]).map((installment) => ({
          id: `installment-${installment.id}`,
          title:
            installment.status === 'paid'
              ? t.paymentReceived
              : installment.status === 'late'
                ? t.missedPayment
                : 'Pagamento perdido',
          description: `${formatCurrency(Number(installment.amount || 0))} ${t.from} ${installment.loans?.clients?.full_name || 'Cliente'}`,
          createdAt: installment.created_at,
          type: 'payment' as const,
        })),
        ...((clients || []) as any[]).map((client) => ({
          id: `client-${client.id}`,
          title: t.newBorrower,
          description: client.full_name,
          createdAt: client.created_at,
          type: 'client' as const,
        })),
        ...((tickets || []) as any[]).map((ticket) => ({
          id: `ticket-${ticket.id}`,
          title: 'Ticket de suporte',
          description: `${ticket.subject} (${ticket.status})`,
          createdAt: ticket.created_at,
          type: 'ticket' as const,
        })),
        ...((transactions || []) as any[]).map((transaction) => ({
          id: `transaction-${transaction.id}`,
          title: transaction.type === 'income' ? t.income : t.expense,
          description: `${formatCurrency(Number(transaction.amount || 0))} - ${transaction.description || transaction.category}`,
          createdAt: transaction.created_at,
          type: 'transaction' as const,
        })),
      ];

      setActivities(
        merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
    } catch (error) {
      console.error('Error fetching activity log:', error);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }

  const grouped = useMemo(() => activities.slice(0, 50), [activities]);

  return (
    <div className="flex min-h-screen bg-[#f8fafc] overflow-x-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="flex-1 lg:ml-72 min-h-screen pb-20 w-full transition-all duration-300">
        <Header title={t.fullActivityLog} onMenuClick={() => setIsSidebarOpen(true)} />

        <div className="px-4 md:px-6 lg:px-8 py-6 lg:py-10 w-full max-w-[1200px] mx-auto">
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 lg:px-8 py-6 border-b border-slate-100">
              <h2 className="text-lg lg:text-xl font-black tracking-tight text-slate-900">{t.recentActivity}</h2>
            </div>

            <div className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="px-6 lg:px-8 py-6 animate-pulse">
                    <div className="h-4 bg-slate-100 rounded w-1/3 mb-3" />
                    <div className="h-3 bg-slate-100 rounded w-2/3" />
                  </div>
                ))
              ) : grouped.length === 0 ? (
                <div className="px-6 lg:px-8 py-16 text-center text-slate-400 font-medium">
                  {t.noTransactions}
                </div>
              ) : (
                grouped.map((activity) => {
                  const Icon = activityIcons[activity.type];

                  return (
                    <div key={activity.id} className="px-6 lg:px-8 py-5 flex items-start gap-4">
                      <div className="size-11 rounded-2xl bg-slate-50 flex items-center justify-center text-emerald-500 shrink-0">
                        <Icon className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-sm font-bold text-slate-900">{activity.title}</p>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">
                            {new Date(activity.createdAt).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">{activity.description}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
