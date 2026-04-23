import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, DollarSign } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  eachDayOfInterval 
} from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { parseAppDate } from '../lib/date';

export function Calendar() {
  const { t, formatCurrency, language } = useLanguage();
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [installments, setInstallments] = useState<any[]>([]);
  const [selectedDayInstallments, setSelectedDayInstallments] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const loc = language === 'pt' ? ptBR : enUS;

  useEffect(() => {
    fetchInstallments();
  }, [user]);

  async function fetchInstallments() {
    if (!user) return;
    const { data } = await supabase
      .from('installments')
      .select('*, loans!inner(clients(full_name))')
      .eq('loans.user_id', user.id);
    if (data) setInstallments(data);
  }

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const getDayInstallments = (day: Date) => {
    return installments.filter(inst => isSameDay(parseAppDate(inst.due_date), day));
  };

  const handleDayClick = (day: Date) => {
    const dayInsts = getDayInstallments(day);
    setSelectedDay(day);
    setSelectedDayInstallments(dayInsts);
  };

  return (
    <div className="flex min-h-screen bg-[#f8fafc] overflow-x-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="flex-1 lg:ml-72 min-h-screen pb-20 w-full transition-all duration-300">
        <Header title={t.calendar} onMenuClick={() => setIsSidebarOpen(true)} />

        <div className="px-4 lg:px-8 py-8 w-full max-w-[1600px] mx-auto space-y-8">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2 bg-white rounded-[2.5rem] border border-slate-50 shadow-sm p-6 lg:p-10">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 capitalize tracking-tight">
                    {format(currentDate, 'MMMM yyyy', { locale: loc })}
                  </h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
                    {t.receiptManagement}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handlePrevMonth} className="p-3 hover:bg-slate-50 rounded-2xl text-slate-400 transition-all border border-slate-100 shadow-sm">
                    <ChevronLeft className="size-5" />
                  </button>
                  <button onClick={() => setCurrentDate(new Date())} className="px-5 py-3 hover:bg-slate-50 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all border border-slate-100 shadow-sm">
                    {t.today}
                  </button>
                  <button onClick={handleNextMonth} className="p-3 hover:bg-slate-50 rounded-2xl text-slate-400 transition-all border border-slate-100 shadow-sm">
                    <ChevronRight className="size-5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 mb-4">
                {['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'].map(d => (
                  <div key={d} className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 py-3">
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-px bg-slate-100 border border-slate-100 rounded-3xl overflow-hidden shadow-inner">
                {calendarDays.map((day, idx) => {
                  const dayInsts = getDayInstallments(day);
                  const isCurrentMonth = isSameMonth(day, monthStart);
                  const isToday = isSameDay(day, new Date());
                  const isSelected = selectedDay && isSameDay(day, selectedDay);

                  return (
                    <div 
                      key={idx}
                      onClick={() => handleDayClick(day)}
                      className={cn(
                        "min-h-[100px] lg:min-h-[140px] p-3 transition-all cursor-pointer relative",
                        isCurrentMonth ? "bg-white" : "bg-slate-50/50 grayscale opacity-40",
                        isSelected ? "bg-emerald-50/30" : "hover:bg-slate-50"
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <span className={cn(
                          "text-xs font-black p-1.5 rounded-lg w-8 h-8 flex items-center justify-center transition-all",
                          isToday ? "bg-primary-500 text-white shadow-lg shadow-primary-200" : "text-slate-400",
                          isSelected && !isToday ? "bg-emerald-100 text-emerald-700" : ""
                        )}>
                          {format(day, 'd')}
                        </span>
                        {dayInsts.length > 0 && (
                          <div className="bg-emerald-500 w-2 h-2 rounded-full animate-pulse shadow-sm" />
                        )}
                      </div>
                      
                      <div className="mt-3 space-y-1">
                        {dayInsts.slice(0, 3).map((inst, i) => (
                          <div key={i} className={cn(
                            "text-[8px] font-bold p-1 rounded-md truncate border",
                            inst.status === 'paid' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                          )}>
                            {inst.loans?.clients?.full_name.split(' ')[0]} - {formatCurrency(inst.amount)}
                          </div>
                        ))}
                        {dayInsts.length > 3 && (
                          <p className="text-[8px] font-black text-slate-400 text-center uppercase tracking-widest mt-1">
                            + {dayInsts.length - 3} {t.more}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-8">
              <div className="bg-slate-900 rounded-[2.5rem] p-8 lg:p-10 text-white relative overflow-hidden h-fit">
                <CalendarIcon className="absolute -bottom-10 -right-10 size-48 opacity-5 rotate-12" />
                <h3 className="text-xl font-black uppercase tracking-tight mb-8 relative z-10 flex items-center gap-2">
                  <Clock className="size-5 text-emerald-400" />
                  {selectedDay ? format(selectedDay, "dd 'de' MMMM", { locale: loc }) : t.selectDay}
                </h3>
                
                <div className="space-y-6 relative z-10">
                  {selectedDayInstallments.length > 0 ? (
                    selectedDayInstallments.map((inst, idx) => (
                      <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        key={idx} 
                        className="bg-white/5 backdrop-blur-sm border border-white/10 p-5 rounded-3xl hover:bg-white/10 transition-all group"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-lg bg-white/10 flex items-center justify-center">
                              <User className="size-4 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-xs font-black uppercase tracking-tight text-white mb-0.5">{inst.loans?.clients?.full_name}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.monthlyInstallmentLabel}</p>
                            </div>
                          </div>
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest",
                            inst.status === 'paid' ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                          )}>
                            {inst.status === 'paid' ? t.paid : t.pending}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                           <div className="flex items-center gap-1.5">
                              <DollarSign className="size-3 text-emerald-500" />
                              <span className="text-sm font-black text-white">{formatCurrency(inst.amount)}</span>
                           </div>
                           <button className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 hover:text-emerald-300 transition-all">
                             {t.notify}
                           </button>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="py-12 text-center space-y-4 opacity-50">
                      <div className="size-16 bg-white/5 rounded-[2rem] flex items-center justify-center mx-auto">
                        <CalendarIcon className="size-8" />
                      </div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">{t.noReceiptsToday}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-50 shadow-sm space-y-6">
                 <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">{t.monthSummary}</h4>
                 <div className="grid grid-cols-1 gap-4">
                    <div className="bg-slate-50 p-6 rounded-3xl flex justify-between items-center">
                       <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t.totalToReceive}</p>
                          <p className="text-xl font-black text-slate-900">
                            {formatCurrency(
                              installments
                                .filter(i => isSameMonth(parseAppDate(i.due_date), currentDate))
                                .reduce((acc, curr) => acc + curr.amount, 0)
                            )}
                          </p>
                       </div>
                       <TrendingUp className="size-8 text-emerald-500 opacity-20" />
                    </div>
                 </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

function TrendingUp(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}
