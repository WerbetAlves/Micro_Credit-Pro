import { useState, useEffect } from 'react';
import {ShieldCheck} from 'lucide-react';
import {motion} from 'motion/react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function PortfolioHealth() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [health, setHealth] = useState(100);

  useEffect(() => {
    fetchHealth();
  }, [user]);

  async function fetchHealth() {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('installments')
        .select('status, loans!inner(user_id)')
        .eq('loans.user_id', user.id);

      if (error) throw error;

      if (!data || data.length === 0) {
        setHealth(100);
        return;
      }

      const total = data.length;
      const paid = data.filter(i => i.status === 'paid' || i.status === 'upcoming').length;
      const missed = data.filter(i => i.status === 'missed' || i.status === 'late').length;
      
      const healthPercentage = (paid / total) * 100;
      setHealth(healthPercentage);
    } catch (err: any) {
      console.error('Error fetching health:', err.message);
    }
  }

  return (
    <div className="bg-slate-50 p-6 lg:p-10 rounded-[2rem] border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between group gap-6">
      <div className="space-y-4 lg:space-y-5 w-full md:w-auto">
        <h4 className="text-xs lg:text-base font-bold text-slate-500 uppercase tracking-widest">{t.portfolioHealth}</h4>
        <div className="flex items-end gap-3">
          <span className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tighter">{health.toFixed(1)}%</span>
          <span className="text-xs text-emerald-600 font-black pb-1 lg:pb-2 uppercase tracking-widest">
            {health > 90 ? t.optimal : 'Alert'}
          </span>
        </div>
        
        <div className="w-full md:w-72 h-3 bg-slate-200 rounded-full overflow-hidden">
          <motion.div 
            initial={{width: 0}}
            animate={{width: `${health}%`}}
            transition={{duration: 1.5, ease: "easeOut"}}
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
