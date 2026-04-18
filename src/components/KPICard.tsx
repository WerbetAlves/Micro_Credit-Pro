import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface KPICardProps {
  label: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  isCurrency?: boolean;
  subtext?: string;
}

export function KPICard({ label, value, change, trend, isCurrency, subtext }: KPICardProps) {
  const { formatCurrency } = useLanguage();
  
  const displayValue = isCurrency && typeof value === 'number' 
    ? formatCurrency(value) 
    : value;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-[2rem] p-6 lg:p-8 border border-slate-50 shadow-sm flex flex-col justify-between group hover:shadow-xl hover:shadow-emerald-50 transition-all overflow-hidden min-w-0"
    >
      <div className="space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
        
        {/* A classe 'truncate' abaixo garante que textos muito grandes ganhem '...' e não quebrem o card */}
        <h2 
          className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight truncate"
          title={String(displayValue)}
        >
          {displayValue}
        </h2>
      </div>

      {(change || subtext) && (
        <div className="mt-6 pt-4 border-t border-slate-50 flex items-center gap-3">
          {trend && (
            <div className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
              trend === 'up' ? "bg-emerald-50 text-emerald-600" : 
              trend === 'down' ? "bg-rose-50 text-rose-600" : 
              "bg-slate-50 text-slate-400"
            )}>
              {trend === 'up' ? <ArrowUpRight className="size-4" /> : 
               trend === 'down' ? <ArrowDownRight className="size-4" /> : 
               <Minus className="size-4" />}
            </div>
          )}
          <span className={cn(
            "text-xs font-bold",
            trend === 'up' ? "text-emerald-600" : 
            trend === 'down' ? "text-rose-600" : 
            "text-slate-500"
          )}>
            {change || subtext}
          </span>
        </div>
      )}
    </motion.div>
  );
}