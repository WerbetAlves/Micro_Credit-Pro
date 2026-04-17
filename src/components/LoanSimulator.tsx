import {useState, useEffect} from 'react';
import {Landmark, Lightbulb, Calculator, User} from 'lucide-react';
import {motion} from 'motion/react';
import {cn} from '@/src/lib/utils';
import {supabase} from '@/src/lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

export function LoanSimulator() {
  const { t, formatCurrency } = useLanguage();
  const { user } = useAuth();
  const [principal, setPrincipal] = useState<number | ''>(15000);
  const [interestRate, setInterestRate] = useState<number | ''>(4.25);
  const [interestType, setInterestType] = useState<'annual' | 'monthly'>('monthly');
  const [termMonths, setTermMonths] = useState(12);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [clients, setClients] = useState<{id: string, full_name: string}[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  useEffect(() => {
    async function fetchClients() {
      if (!user) return;
      const { data } = await supabase
        .from('clients')
        .select('id, full_name')
        .eq('status', 'active')
        .order('full_name');
      if (data) setClients(data);
    }
    fetchClients();
  }, [user]);

  // Handle number parsing for empty states
  const safePrincipal = principal === '' ? 0 : principal;
  const safeInterest = interestRate === '' ? 0 : interestRate;

  // If monthly, rate is per month. If annual, divide by 12.
  const monthlyRate = interestType === 'monthly' 
    ? (safeInterest / 100) 
    : (safeInterest / 100) / 12;

  const totalRepayment = safePrincipal * Math.pow(1 + monthlyRate, termMonths);
  const monthlyInstallment = totalRepayment / termMonths;
  const totalInterest = totalRepayment - safePrincipal;

  const handleApply = async () => {
    if (!user) {
      alert('Please log in to apply.');
      return;
    }
    if (!selectedClientId) {
      alert('Please select a client.');
      return;
    }
    if (safePrincipal <= 0) {
      alert('Interest principal must be greater than zero.');
      return;
    }
    setIsLoading(true);
    setSuccessMessage(null);
    try {
      const { data: loanData, error } = await supabase.from('loans').insert({
        user_id: user.id,
        client_id: selectedClientId,
        principal_amount: safePrincipal,
        interest_rate: safeInterest,
        interest_type: interestType,
        term_months: termMonths,
        monthly_installment: monthlyInstallment,
        total_repayment: totalRepayment,
        status: 'pending'
      }).select().single();
      
      if (error) throw error;

      // Generate installments
      if (loanData) {
        // Record payout transaction
        await supabase.from('transactions').insert({
          user_id: user.id,
          client_id: selectedClientId,
          loan_id: loanData.id,
          type: 'expense',
          category: 'loan_disbursement',
          amount: safePrincipal,
          description: `Empréstimo concedido: ${loanData.id.split('-')[0]}`
        });

        const installments = [];
        for (let i = 1; i <= termMonths; i++) {
          const dueDate = new Date();
          dueDate.setMonth(dueDate.getMonth() + i);
          installments.push({
            loan_id: loanData.id,
            amount: monthlyInstallment,
            status: 'upcoming',
            due_date: dueDate.toISOString().split('T')[0]
          });
        }
        await supabase.from('installments').insert(installments);
      }

      setSuccessMessage(t.successApply || 'Application submitted successfully!');
    } catch (err: any) {
      console.error('Submission error:', err.message);
      setSuccessMessage('Simulation mode: Connection required for live save.');
    } finally {
      setIsLoading(false);
    }
  };

  // Improved currency splitting logic that works across locales
  const getCurrencyParts = (amount: number) => {
    const formatted = formatCurrency(amount);
    // Find the last separator (either , or . depending on locale)
    const lastComma = formatted.lastIndexOf(',');
    const lastDot = formatted.lastIndexOf('.');
    const separatorIndex = Math.max(lastComma, lastDot);
    
    // If no separator found or it looks like a thousands separator (too far from end)
    // we assume there are no decimals shown or it's a very large number
    if (separatorIndex === -1 || formatted.length - separatorIndex > 4) {
      return { main: formatted, cents: '00' };
    }
    
    return {
      main: formatted.substring(0, separatorIndex),
      cents: formatted.substring(separatorIndex + 1),
      separator: formatted[separatorIndex]
    };
  };

  const { main, cents, separator } = getCurrencyParts(monthlyInstallment);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
      <div className="lg:col-span-7 bg-white rounded-[2rem] p-6 lg:p-10 shadow-sm border border-slate-50 space-y-8 lg:space-y-12">
        <div className="flex items-center gap-3 mb-4">
          <Calculator className="text-emerald-500 size-6" />
          <h3 className="text-lg lg:text-xl font-bold text-slate-900 tracking-tight">{t.loanSimulator}</h3>
        </div>

        <div className="space-y-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t.clientName}</span>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-300 pointer-events-none" />
            <select 
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full pl-11 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-slate-900 appearance-none cursor-pointer"
            >
              <option value="">{t.searchClients}</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.full_name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex justify-between items-end">
            <div className="flex-1 mr-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t.principalAmount}</span>
              <div className="relative group flex items-center mt-1">
                <input
                  type="number"
                  value={principal}
                  onChange={(e) => setPrincipal(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-transparent border-none p-0 text-2xl lg:text-3xl font-black text-slate-900 focus:ring-0 outline-none transition-all"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-emerald-600 font-bold bg-emerald-50 px-3 py-1 rounded-full text-[10px] uppercase tracking-wider">{t.flexible}</span>
              <p className="text-[9px] text-slate-300 font-bold uppercase tracking-tighter">{t.clickToType}</p>
            </div>
          </div>
          <input
            type="range"
            min="100"
            max={safePrincipal > 100000 ? safePrincipal * 1.5 : 100000}
            step="100"
            value={safePrincipal}
            onChange={(e) => setPrincipal(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] font-bold text-slate-300 uppercase tracking-widest">
            <span>{formatCurrency(100)}</span>
            <span>{formatCurrency(Math.max(100000, principal))}</span>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex justify-between items-end">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {interestType === 'annual' ? t.annualInterestRate : t.monthlyInterestRate}
              </span>
              <div className="flex items-center mt-1">
                <input
                  type="number"
                  step="0.05"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value === '' ? '' : Number(e.target.value))}
                  className="bg-transparent border-none p-0 text-2xl lg:text-3xl font-black text-slate-900 focus:ring-0 outline-none transition-all w-24"
                  placeholder="0"
                />
                <span className="text-2xl lg:text-3xl font-black text-slate-900">%</span>
              </div>
            </div>
            
            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
              <button 
                onClick={() => {
                  setInterestType('monthly');
                  if (interestRate > 15) setInterestRate(3.5); // auto-adjust if switching from annual
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                  interestType === 'monthly' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                {t.monthly}
              </button>
              <button 
                onClick={() => {
                  setInterestType('annual');
                  if (interestRate < 10) setInterestRate(12); // auto-adjust if switching from monthly
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                  interestType === 'annual' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                {t.annual}
              </button>
            </div>
          </div>
          
          <input
            type="range"
            min={interestType === 'monthly' ? "0.1" : "1"}
            max={interestType === 'monthly' ? "20" : "150"}
            step="0.05"
            value={safeInterest}
            onChange={(e) => setInterestRate(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] font-bold text-slate-300 uppercase tracking-widest">
            <span>{interestType === 'monthly' ? '0.1%' : '1%'}</span>
            <span>{interestType === 'monthly' ? '20%' : '150%'}</span>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex justify-between items-end">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t.loanDuration}</span>
              <h3 className="text-2xl lg:text-3xl font-black mt-1 text-slate-900">{termMonths} {t.months}</h3>
            </div>
          </div>
          <input
            type="range"
            min="1"
            max="60"
            step="1"
            value={termMonths}
            onChange={(e) => setTermMonths(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] font-bold text-slate-300 uppercase tracking-widest">
            <span>1 {t.months}</span>
            <span>60 {t.months}</span>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {[1, 3, 6, 12, 24, 36].map((months) => (
              <button
                key={months}
                onClick={() => setTermMonths(months)}
                className={cn(
                  "py-2 rounded-xl text-[10px] font-black tracking-widest transition-all uppercase",
                  termMonths === months 
                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-100" 
                    : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                )}
              >
                {months}m
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:col-span-5 space-y-6 lg:space-y-8 w-full">
        <div className="bg-emerald-600 bg-gradient-to-br from-emerald-600 to-emerald-500 rounded-[2rem] p-8 lg:p-10 text-white shadow-xl shadow-emerald-100 relative overflow-hidden">
          <div className="relative z-10">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">{t.monthlyInstallment}</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-4xl lg:text-6xl font-black tracking-tighter">{main}</span>
              <span className="text-lg lg:text-xl opacity-80 font-bold">{separator}{cents}</span>
            </div>
            
            {successMessage && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3 bg-white/10 rounded-xl text-[10px] font-bold uppercase tracking-wider text-center border border-white/20"
              >
                {successMessage}
              </motion.div>
            )}

            <div className="mt-8 lg:mt-10 pt-8 lg:pt-10 border-t border-white/10 space-y-4 lg:space-y-6">
              <div className="flex justify-between items-center">
                <span className="opacity-70 text-xs font-medium tracking-wide">{t.totalRepayment}</span>
                <span className="font-bold text-base lg:text-lg">{formatCurrency(totalRepayment)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="opacity-70 text-xs font-medium tracking-wide">{t.totalInterest}</span>
                <span className="font-bold text-base lg:text-lg">{formatCurrency(totalInterest)}</span>
              </div>
            </div>

            <button
              onClick={handleApply}
              disabled={isLoading}
              className="w-full mt-8 lg:mt-10 bg-white text-emerald-600 font-black py-4 rounded-2xl hover:bg-opacity-95 transition-all uppercase tracking-[0.15em] text-xs shadow-lg active:scale-95 disabled:opacity-50"
            >
              {isLoading ? t.processing : t.applyForLoan}
            </button>
          </div>
          <Landmark className="absolute -bottom-8 -right-8 size-48 opacity-10 rotate-12" />
        </div>

        <div className="bg-white rounded-[2rem] p-6 lg:p-8 shadow-sm border border-slate-50">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <Lightbulb className="text-emerald-600 size-5 lg:size-6" />
            </div>
            <h4 className="font-bold text-sm lg:text-base text-slate-900">{t.insightTitle}</h4>
          </div>
          <p className="text-slate-500 text-xs lg:text-sm leading-relaxed mb-6">
            {t.insightText}
          </p>
          <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
            <motion.div 
              initial={{width: 0}}
              animate={{width: '75%'}}
              className="h-full bg-emerald-500 rounded-full"
            />
          </div>
          <div className="flex justify-between mt-3 text-[10px] font-bold uppercase tracking-widest text-center sm:text-left">
            <span className="text-slate-300">{t.affordabilityIndex}</span>
            <span className="text-emerald-600">{t.optimal} (75%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
