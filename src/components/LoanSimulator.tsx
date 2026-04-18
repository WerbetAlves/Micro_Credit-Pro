import React, { useState, useEffect } from 'react';
import { Calculator, DollarSign, Calendar, Percent, User, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';

export function LoanSimulator() {
  const { formatCurrency } = useLanguage();
  const { user } = useAuth();
  
  const [amount, setAmount] = useState('5000');
  const [rate, setRate] = useState('5');
  const [months, setMonths] = useState('12');
  const [interestType, setInterestType] = useState<'monthly' | 'annual'>('monthly');
  
  // Novos estados para vinculação com o banco de dados
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (user) fetchClients();
  }, [user]);

  async function fetchClients() {
    const { data } = await supabase
      .from('clients')
      .select('id, full_name')
      .eq('user_id', user?.id)
      .eq('status', 'active');
    if (data) setClients(data);
  }

  const numAmount = parseFloat(amount) || 0;
  const numRate = parseFloat(rate) || 0;
  const numMonths = parseInt(months) || 1;

  // Cálculo Básico
  let monthlyRate = interestType === 'monthly' ? numRate / 100 : (numRate / 12) / 100;
  let totalInterest = numAmount * monthlyRate * numMonths;
  let totalAmount = numAmount + totalInterest;
  let monthlyInstallment = totalAmount / numMonths;

  // A função que MÁGICA: Salva no banco de dados
  const handleSaveLoan = async () => {
    if (!user || !selectedClientId) {
      alert("Por favor, selecione um cliente para vincular o empréstimo.");
      return;
    }
    
    setIsSaving(true);
    try {
      // 1. Grava o contrato de empréstimo
      const { data: loan, error: loanError } = await supabase.from('loans').insert([{
        user_id: user.id,
        client_id: selectedClientId,
        principal_amount: numAmount,
        interest_rate: numRate,
        interest_type: interestType,
        term_months: numMonths,
        monthly_installment: monthlyInstallment,
        total_repayment: totalAmount,
        status: 'active'
      }]).select().single();

      if (loanError) throw loanError;

      // 2. Cria todas as parcelas mensais baseadas no prazo
      const installments = [];
      let currentDate = new Date();
      
      for (let i = 1; i <= numMonths; i++) {
        const dueDate = new Date(currentDate.setMonth(currentDate.getMonth() + 1));
        installments.push({
          loan_id: loan.id,
          amount: monthlyInstallment,
          due_date: dueDate.toISOString().split('T')[0],
          status: 'upcoming'
        });
      }

      const { error: instError } = await supabase.from('installments').insert(installments);
      if (instError) throw instError;

      // 3. Opcional: Registra o fluxo de caixa nas Transações
      await supabase.from('transactions').insert([{
        user_id: user.id,
        client_id: selectedClientId,
        loan_id: loan.id,
        type: 'expense',
        category: 'loan_disbursement',
        amount: numAmount,
        description: `Empréstimo Liberado`
      }]);

      // Feedback visual de sucesso!
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
      setSelectedClientId(''); // Limpa a seleção para um novo empréstimo
      
    } catch (error: any) {
      console.error("Erro ao efetivar empréstimo:", error.message);
      alert("Ocorreu um erro. Verifique as configurações do banco de dados.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-50 shadow-sm overflow-hidden flex flex-col xl:flex-row">
      <div className="flex-1 p-6 lg:p-10 border-b xl:border-b-0 xl:border-r border-slate-100 space-y-8">
         <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Valor Principal (R$)</label>
            <div className="relative">
              <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 size-4 text-slate-300" />
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl pl-12 pr-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Taxa (%)</label>
              <div className="relative">
                <Percent className="absolute left-5 top-1/2 -translate-y-1/2 size-4 text-slate-300" />
                <input type="number" value={rate} onChange={(e) => setRate(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl pl-12 pr-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none" />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Período</label>
              <select value={interestType} onChange={(e: any) => setInterestType(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none appearance-none">
                <option value="monthly">Ao Mês</option>
                <option value="annual">Ao Ano</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Prazo (Meses)</label>
            <div className="relative">
              <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 size-4 text-slate-300" />
              <input type="number" value={months} onChange={(e) => setMonths(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl pl-12 pr-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-[0.8] bg-slate-900 p-6 lg:p-10 text-white relative overflow-hidden flex flex-col justify-between">
        <Calculator className="absolute -bottom-10 -right-10 size-64 opacity-5 rotate-12" />
        
        <div className="relative z-10 space-y-8">
          <div>
             <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Parcela Mensal</p>
             <h2 className="text-4xl lg:text-5xl font-black text-emerald-400">{formatCurrency(monthlyInstallment)}</h2>
          </div>

          <div className="space-y-4 pt-6 border-t border-slate-800">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-slate-400">Total de Juros</span>
              <span className="text-sm font-black">{formatCurrency(totalInterest)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-slate-400">Total a Pagar</span>
              <span className="text-sm font-black text-white">{formatCurrency(totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* NOVA SESSÃO: Vínculo do Cliente e Efetivação */}
        <div className="relative z-10 pt-8 mt-8 border-t border-slate-800 space-y-4">
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Vincular a um Cliente</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <select 
                  value={selectedClientId} 
                  onChange={(e) => setSelectedClientId(e.target.value)} 
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl pl-10 pr-6 py-3 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none appearance-none text-white"
                >
                  <option value="">Selecione um cliente...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
              </div>
           </div>

           <button 
             onClick={handleSaveLoan}
             disabled={isSaving || !selectedClientId}
             className="w-full bg-emerald-500 text-slate-900 rounded-2xl py-4 font-black text-xs uppercase tracking-widest hover:bg-emerald-400 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
           >
             {isSaving ? "Processando..." : (
               <>
                  <CheckCircle2 className="size-4" />
                  Efetivar Empréstimo
               </>
             )}
           </button>

           <AnimatePresence>
             {showSuccess && (
               <motion.div 
                 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                 className="bg-emerald-500/20 text-emerald-400 p-3 rounded-xl text-center text-xs font-bold border border-emerald-500/30"
               >
                 Empréstimo efetivado e parcelas geradas!
               </motion.div>
             )}
           </AnimatePresence>
        </div>

      </div>
    </div>
  );
}