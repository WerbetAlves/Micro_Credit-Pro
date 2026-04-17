import {TrendingUp, AlertCircle} from 'lucide-react';
import {cn} from '@/src/lib/utils';
import { useLanguage } from '../contexts/LanguageContext';

interface KPICardProps {
  label: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down';
  subtext?: string;
  isCurrency?: boolean;
}

export function KPICard({label, value, change, trend, subtext, isCurrency}: KPICardProps) {
  const { formatCurrency } = useLanguage();
  const displayValue = isCurrency && typeof value === 'number' ? formatCurrency(value) : value;

  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-between min-h-[160px] hover:shadow-md transition-shadow duration-300">
      <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">{label}</span>
      <div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter mt-2">{displayValue}</h2>
        {change && (
          <div className={cn(
            "flex items-center text-xs mt-2 font-bold",
            trend === 'up' ? "text-emerald-500" : "text-rose-500"
          )}>
            {trend === 'up' ? (
              <TrendingUp className="size-3 mr-1" />
            ) : (
              <AlertCircle className="size-3 mr-1" />
            )}
            {change}
          </div>
        )}
        {subtext && (
          <p className="text-slate-400 text-xs mt-2 font-medium">{subtext}</p>
        )}
      </div>
    </div>
  );
}
