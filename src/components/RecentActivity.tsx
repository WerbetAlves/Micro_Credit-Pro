import { useState, useEffect } from 'react';
import {CheckCircle2, PlusSquare, AlertTriangle, UserPlus} from 'lucide-react';
import {cn} from '@/src/lib/utils';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Activity {
  id: string;
  type: 'payment' | 'loan' | 'missed' | 'user';
  title: string;
  subtitle: string;
  time: string;
  icon: any;
  color: string;
  bg: string;
}

export function RecentActivity() {
  const { t, formatCurrency } = useLanguage();
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentActivity();
  }, [user]);

  async function fetchRecentActivity() {
    if (!user) return;
    try {
      // Fetch latest loans
      const { data: latestLoans } = await supabase
        .from('loans')
        .select('id, principal_amount, created_at, guarantee_info, clients(full_name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(2);

      // Fetch latest paid installments
      const { data: latestPayments } = await supabase
        .from('installments')
        .select('id, amount, created_at, loans!inner(user_id, clients(full_name))')
        .eq('status', 'paid')
        .eq('loans.user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(2);

      const combined: Activity[] = [];

      (latestLoans || []).forEach((l: any) => {
        const guaranteeText = l.guarantee_info ? ` (+ Garantia: ${l.guarantee_info.type})` : '';
        combined.push({
          id: l.id,
          type: 'loan',
          title: t.newLoanApproved,
          subtitle: `${formatCurrency(l.principal_amount)} for ${l.clients?.full_name}${guaranteeText}`,
          time: new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          icon: PlusSquare,
          color: 'text-blue-500',
          bg: 'bg-blue-50'
        });
      });

      (latestPayments || []).forEach((p: any) => {
        combined.push({
          id: p.id,
          type: 'payment',
          title: t.paymentReceived,
          subtitle: `${formatCurrency(p.amount)} from ${p.loans?.clients?.full_name}`,
          time: new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          icon: CheckCircle2,
          color: 'text-emerald-500',
          bg: 'bg-emerald-50'
        });
      });

      setActivities(combined.sort((a, b) => b.id > a.id ? 1 : -1).slice(0, 4));
    } catch (err: any) {
      console.error('Error fetching activity:', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="bg-white rounded-[2rem] shadow-sm border border-slate-50 p-6 lg:p-10">
      <h3 className="text-lg lg:text-xl font-bold tracking-tight text-slate-900 mb-8">{t.recentActivity}</h3>
      <div className="space-y-8 lg:space-y-10">
        {activities.map((item, idx) => (
          <div key={item.id} className="flex gap-4 lg:gap-5 relative">
            {idx !== activities.length - 1 && (
              <div className="absolute top-10 left-5 w-px h-10 border-l border-dashed border-slate-200" />
            )}
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", item.bg)}>
              <item.icon className={cn("size-5", item.color)} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-tight">{item.title}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">{item.subtitle}</p>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-wider">{item.time}</p>
            </div>
          </div>
        ))}
      </div>
      <button className="w-full mt-10 lg:mt-12 py-4 bg-slate-50 text-slate-500 text-[10px] font-black rounded-2xl hover:bg-slate-100 transition-colors uppercase tracking-[0.2em]">
        {t.fullActivityLog}
      </button>
    </section>
  );
}
