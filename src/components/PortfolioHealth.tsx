import { useState, useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// Interface para definir o formato dos dados
interface InstallmentHealth {
  status: string;
  loans: {
    user_id: string;
  };
}

export function PortfolioHealth() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [health, setHealth] = useState(100);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchHealth();
    }
  }, [user]);

  async function fetchHealth() {
    if (!user) return;
    setLoading(true);
    try {
      // Buscamos apenas o status e filtramos pelo user_id do empréstimo vinculado
      const { data, error } = await supabase
        .from('installments')
        .select('status, loans!inner(user_id)')
        .eq('loans.user_id', user.id);

      if (error) throw error;

      if (!data || data.length === 0) {
        setHealth(100); // Se não há dívidas, a saúde é 100%
        return;
      }

      const installments = data as any as InstallmentHealth[];
      const total = installments.length;
      
      // Consideramos "saudável" o que está pago ou ainda vai vencer
      const healthyItems = installments.filter(
        i => i.status === 'paid' || i.status === 'upcoming'
      ).length;
      
      const healthPercentage = (healthyItems / total) * 100;
      setHealth(healthPercentage);
    } catch (err: any) {
      console.error('Error fetching health:', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-slate-50 p-6 lg:p-10 rounded-[2rem] border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between group gap-6">
      <div className="space-y-4 lg:space-y-5 w-full md:w-auto">
        <h4 className="text-xs lg:text-base font-bold text-slate-500 uppercase tracking-widest">
          {t.portfolioHealth || 'Saúde da Carteira'}
        </h4>
        
        <div className="flex items-end gap-3">
          {loading ? (
            <div className="h-12 w-24 bg-slate-200 animate-pulse rounded-xl" />
          ) : (
            <>
              <span className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tighter">
                {health.toFixed(1)}%
              </span>
              <span className={cn(
                "text-xs font-black pb-1 lg:pb-2 uppercase tracking-widest",
                health > 80 ? "text-emerald-600" : health > 50 ? "text-amber-500" : "text-rose-500"
              )}>
                {health > 90 ? (t.optimal || 'Excelente') : (t.alert || 'Atenção')}
              </span>
            </>
          )}
        </div>
        
        <div className="w-full md:w-72 h-3 bg-slate-200 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${health}%` }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className={cn(
              "h-full rounded-full shadow-lg",
              health > 80 ? "bg-emerald-500 shadow-emerald-100" : 
              health > 50 ? "bg-amber-500 shadow-amber-100" : "bg-rose-500 shadow-rose-100"
            )}
          />
        </div>
      </div>
      
      <div className="hidden sm:block">
        <ShieldCheck className={cn(
          "size-16 lg:size-20 transition-all duration-500 -rotate-12",
          health > 80 ? "text-emerald-500 opacity-10 group-hover:opacity-25" : 
          health > 50 ? "text-amber-500 opacity-10 group-hover:opacity-25" : "text-rose-500 opacity-10 group-hover:opacity-25"
        )} />
      </div>
    </div>
  );
}

// Helper rápido para classes (caso não esteja importado)
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}