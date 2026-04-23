import { useState, useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { parseAppDate } from '../lib/date';
import { useRealtimeRefresh } from '../lib/useRealtimeRefresh';

type InstallmentHealthRow = {
  status: 'upcoming' | 'paid' | 'late' | 'missed';
  due_date: string;
};

export function PortfolioHealth() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [health, setHealth] = useState(100);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchHealth();
  }, [user]);

  useRealtimeRefresh({
    enabled: !!user,
    channelKey: `portfolio-health-${user?.id || 'guest'}`,
    tables: ['installments', 'loans'],
    onRefresh: () => fetchHealth(true),
  });

  async function fetchHealth(silent = false) {
    if (!user) return;
    try {
      if (!silent) {
        setLoading(true);
      }

      const { data, error } = await supabase
        .from('installments')
        .select('status, due_date, loans!inner(user_id)')
        .eq('loans.user_id', user.id);

      if (error) throw error;

      if (!data || data.length === 0) {
        setHealth(100);
        return;
      }

      const installments = data as InstallmentHealthRow[];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const maturedInstallments = installments.filter((installment) => {
        const dueDate = parseAppDate(installment.due_date);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate <= today;
      });

      if (maturedInstallments.length === 0) {
        setHealth(100);
        return;
      }

      const settledCount = maturedInstallments.filter((installment) => installment.status === 'paid').length;
      const healthPercentage = (settledCount / maturedInstallments.length) * 100;
      setHealth(healthPercentage);
    } catch (err: any) {
      console.error('Error fetching health:', err.message);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  return (
    <div className="bg-slate-50 p-6 lg:p-10 rounded-[2rem] border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between group gap-6">
      <div className="space-y-4 lg:space-y-5 w-full md:w-auto">
        <h4 className="text-xs lg:text-base font-bold text-slate-500 uppercase tracking-widest">{t.portfolioHealth}</h4>
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-12 w-36 rounded-2xl bg-slate-200" />
            <div className="h-3 w-28 rounded-full bg-slate-100" />
          </div>
        ) : (
          <div className="flex items-end gap-3">
            <span className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tighter">{health.toFixed(1)}%</span>
            <span className="text-xs text-emerald-600 font-black pb-1 lg:pb-2 uppercase tracking-widest">
              {health > 90 ? t.optimal : t.alert}
            </span>
          </div>
        )}

        <div className="w-full md:w-72 h-3 bg-slate-200 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${health}%` }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full shadow-lg shadow-emerald-100"
          />
        </div>
      </div>
      <div className="hidden sm:block">
        <ShieldCheck className="text-emerald-500 size-16 lg:size-20 opacity-10 group-hover:opacity-20 transition-opacity duration-500 -rotate-12" />
      </div>
    </div>
  );
}
