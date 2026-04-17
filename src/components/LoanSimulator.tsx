import {useState, useEffect} from 'react';
import {Landmark, Lightbulb, Calculator, User} from 'lucide-react';
import {motion} from 'framer-motion'; // Ajustado para o padrão comum, altere se seu pacote for 'motion/react'
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

  const safePrincipal = principal === '' ? 0 : principal;
  const safeInterest = interestRate === '' ? 0 : interestRate;

  const monthlyRate = interestType === 'monthly' 
    ? (safeInterest / 100) 
    : (safeInterest / 100) / 12;

  const totalRepayment = safePrincipal * Math.pow(1 + monthlyRate, termMonths);
  const monthlyInstallment = totalRepayment / termMonths;
  const totalInterest = totalRepayment - safePrincipal;

  const handleApply = async () => {
    if (!user) return alert('Por favor, faça login.');
    if (!selectedClientId) return alert('Selecione um cliente.');
    if (safePrincipal <= 0) return alert('O valor principal deve ser maior que zero.');

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

      if (loanData) {
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
      setSuccessMessage(t.successApply || 'Empréstimo efetivado com sucesso!');
    } catch (err: any) {
      console.error('Erro:', err.message);
      setSuccessMessage('Erro ao salvar. Verifique a conexão.');
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrencyParts = (amount: number) => {
    const formatted = formatCurrency(amount);
    const lastComma = formatted.lastIndexOf(',');
    const lastDot = formatted.lastIndexOf('.');
    const separatorIndex = Math.max(lastComma, lastDot);
    
    if (separatorIndex === -1 || formatted.length - separatorIndex > 4) {
      return { main: formatted, cents: '00', separator: ',' };
    }
    
    return {
      main: formatted.substring(0, separatorIndex),
      cents: formatted.substring(separatorIndex + 1),
      separator: formatted[separatorIndex]
    };
  };

  const { main, cents, separator } = getCurrencyParts(monthlyInstallment);

  return (
    <div className="flex flex-col xl:flex-row gap-6 lg:gap-8 items-start w-full">
      {/* Coluna da Esquerda: Inputs */}
      <div className="w-full xl:flex-1 bg-white rounded-[2rem] p-6 lg:p-10 shadow-sm border border-slate-50 space-y-8 lg:space-y-10">
        <div className="flex items-center gap-3">
          <Calculator className="text-emerald-500 size-6" />
          <h3 className="text-lg lg:text-xl font-bold text-slate-900 tracking-tight">{t.loanSimulator}</h3>
        </div>

        {/* Seleção de Cliente */}
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

        {/* Capital Principal */}
        <div className="space-y-6">
          <div className="flex justify-between items-end">
            <div className="flex-1 mr-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t.principalAmount}</span>
              <input
                type="number"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-transparent border-none p-0 text-2xl lg:text-3xl font-black text-slate-900 focus:ring-0 outline-none mt-1"
                placeholder="0"
              />
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-emerald-600 font-bold bg-emerald-50 px-3 py-1 rounded-full text-[10px] uppercase tracking-wider">{t.flexible}</span>
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
        </div>

        {/* Taxa de Juros */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
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
                  className="bg-transparent border-none p-0 text-2xl lg:text-3xl font-black text-slate-900 focus:ring-0 outline-none w-24"
                />
                <span className="text-2xl lg:text-3xl font-black text-slate-900">%</span>
              </div>
            </div>
            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 self-start sm:self-auto">
              {(['monthly', 'annual'] as const).map((type) => (
                <button 
                  key={type}
                  onClick={() => setInterestType(type)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                    interestType === type ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400"
                  )}
                >
                  {type === 'monthly' ? t.monthly : t.annual}
                </button>
              ))}
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
        </div>

        {/* Duração */}
        <div className="space-y-6">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t.loanDuration}</span>
          <h3 className="text-2xl lg:text-3xl font-black text-slate-900">{termMonths} {t.months}</h3>
          <input
            type="range" min="1" max="60" step="1" value={termMonths}
            onChange={(e) => setTermMonths(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[1, 3, 6, 12, 24, 36].map((m) => (
              <button
                key={m} onClick={() => setTermMonths(m)}
                className={cn(
                  "py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all",
                  termMonths === m ? "bg-emerald-500 text-white shadow-md" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                )}
              >
                {m}m
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Coluna da Direita: Resumo Verde */}
      <div className="w-full xl:w-[400px] shrink-0 space-y-6">
        <div className="bg-emerald-600 bg-gradient-to-br from-emerald-600 to-emerald-500 rounded-[2rem] p-8 lg:p-10 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">{t.monthlyInstallment}</span>
            <div className="mt-2 flex items-baseline gap-1 flex-wrap">
              <span className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black tracking-tighter break-all">
                {main}
              </span>
              <span className="text-lg lg:text-xl opacity-80 font-bold">{separator}{cents}</span>
            </div>

            {successMessage && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 p-3 bg-white/10 rounded-xl text-[10px] font-bold text-center border border-white/20">
                {successMessage}
              </motion.div>
            )}

            <div className="mt-10 pt-8 border-t border-white/10 space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="opacity-70">{t.totalRepayment}</span>
                <span className="font-bold text-base">{formatCurrency(totalRepayment)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="opacity-70">{t.totalInterest}</span>
                <span className="font-bold text-base">{formatCurrency(totalInterest)}</span>
              </div>
            </div>

            <button
              onClick={handleApply} disabled={isLoading}
              className="w-full mt-10 bg-white text-emerald-600 font-black py-4 rounded-2xl hover:bg-slate-50 transition-all uppercase tracking-widest text-xs shadow-lg disabled:opacity-50 active:scale-95"
            >
              {isLoading ? t.processing : t.applyForLoan}
            </button>
          </div>
          <Landmark className="absolute -bottom-8 -right-8 size-48 opacity-10 rotate-12" />
        </div>

        {/* Card de Insight */}
        <div className="bg-white rounded-[2rem] p-6 lg:p-8 shadow-sm border border-slate-50">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <Lightbulb className="text-emerald-600 size-5" />
            </div>
            <h4 className="font-bold text-sm text-slate-900">{t.insightTitle}</h4>
          </div>
          <p className="text-slate-500 text-xs leading-relaxed mb-6">{t.insightText}</p>
          <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full w-[75%]" />
          </div>
          <div className="flex justify-between mt-3 text-[10px] font-bold uppercase text-slate-300">
            <span>{t.affordabilityIndex}</span>
            <span className="text-emerald-600">{t.optimal} (75%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}