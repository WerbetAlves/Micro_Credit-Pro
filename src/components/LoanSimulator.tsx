import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, DollarSign, Calendar, Percent, User, CheckCircle2, Wallet, Shield } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { generateLoanContract } from '../services/contractService';
import { cn } from '../lib/utils';

interface Client {
  id: string;
  full_name: string;
}

interface Wallet {
  id: string;
  name: string;
}

export function LoanSimulator() {
  const { formatCurrency, t } = useLanguage();
  const { user } = useAuth();
  
  const [amount, setAmount] = useState('100');
  const [rate, setRate] = useState('10');
  const [duration, setDuration] = useState('1'); // Prazo em MESES
  const [interestType, setInterestType] = useState<'monthly' | 'annual'>('monthly');
  const [paymentFrequency, setPaymentFrequency] = useState<'monthly' | 'daily' | 'weekly' | 'biweekly'>('monthly');
  const [paymentDays, setPaymentDays] = useState<string[]>([]);
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [firstInstallmentDueDate, setFirstInstallmentDueDate] = useState(new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('Microcrédito');
  
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [hasGuarantee, setHasGuarantee] = useState(false);
  const [guaranteeType, setGuaranteeType] = useState('celular');
  const [guaranteeDescription, setGuaranteeDescription] = useState('');

  useEffect(() => {
    if (user) {
      fetchClients();
      fetchWallets();
    }
  }, [user]);

  async function fetchWallets() {
    const { data } = await supabase.from('wallets').select('id, name').eq('user_id', user?.id);
    if (data) {
      setWallets(data);
      if (data.length > 0) setSelectedWalletId(data[0].id);
    }
  }

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('id, full_name').eq('user_id', user?.id).eq('status', 'active');
    if (data) setClients(data);
  }

  const weekDays = [
    { id: 'sunday', label: 'D' }, { id: 'monday', label: 'S' }, { id: 'tuesday', label: 'T' },
    { id: 'wednesday', label: 'Q' }, { id: 'thursday', label: 'Q' }, { id: 'friday', label: 'S' },
    { id: 'saturday', label: 'S' },
  ];

  const toggleDay = (dayId: string) => {
    if (paymentFrequency === 'daily') {
      setPaymentDays(prev => prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]);
    } else {
      setPaymentDays([dayId]);
    }
  };

  // 🔥 LÓGICA DE CÁLCULO CORRIGIDA (Juros Simples Diretos)
  const simulation = useMemo(() => {
    const principal = parseFloat(amount) || 0;
    const rateVal = parseFloat(rate) || 0;
    const months = parseInt(duration) || 1;

    // 1. Calcular o Juro Total Baseado no Prazo em Meses
    // Se 10% ao mês por 1 mês = 10% de juro.
    // Se 10% ao mês por 2 meses = 20% de juro.
    const effectiveMonthlyRate = interestType === 'monthly' ? rateVal / 100 : (rateVal / 12) / 100;
    const totalInterest = principal * effectiveMonthlyRate * months;
    const totalRepayment = principal + totalInterest;

    // 2. Determinar o número de parcelas baseado na frequência
    let installmentCount = months;
    if (paymentFrequency === 'daily') installmentCount = months * 30;
    else if (paymentFrequency === 'weekly') installmentCount = months * 4;
    else if (paymentFrequency === 'biweekly') installmentCount = months * 2;

    const installmentValue = totalRepayment / installmentCount;

    return {
      totalInterest,
      totalRepayment,
      installmentValue,
      installmentCount
    };
  }, [amount, rate, duration, interestType, paymentFrequency]);

  const handleSaveLoan = async () => {
    if (!user || !selectedClientId) {
      alert("Selecione um cliente.");
      return;
    }
    
    setIsSaving(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('*').single();
      const { data: client } = await supabase.from('clients').select('*').eq('id', selectedClientId).single();

      // 1. Inserir o Empréstimo
      const { data: loan, error: loanError } = await supabase.from('loans').insert([{
        user_id: user.id,
        client_id: selectedClientId,
        principal_amount: parseFloat(amount),
        interest_rate: parseFloat(rate),
        interest_type: interestType,
        payment_frequency: paymentFrequency,
        payment_days: paymentDays,
        first_installment_date: firstInstallmentDate,
        due_date: firstInstallmentDueDate,
        category,
        notes,
        term_months: parseInt(duration),
        monthly_installment: simulation.installmentValue,
        total_repayment: simulation.totalRepayment,
        status: 'active',
        guarantee_info: hasGuarantee ? { type: guaranteeType, description: guaranteeDescription } : null,
        contract_content: await generateLoanContract(
          { 
            principal_amount: parseFloat(amount), 
            interest_rate: parseFloat(rate), 
            interest_type: interestType, 
            term_months: parseInt(duration), 
            monthly_installment: simulation.installmentValue, 
            total_repayment: simulation.totalRepayment,
            payment_frequency: paymentFrequency,
            category,
            guarantee_info: hasGuarantee ? { type: guaranteeType, description: guaranteeDescription } : null 
          },
          client,
          profile
        )
      }]).select().single();

      if (loanError) throw loanError;

      // 2. Gerar Parcelas baseadas na contagem exata da simulação
      const installments = [];
      let currentDate = new Date(firstInstallmentDueDate);
      
      for (let i = 0; i < simulation.installmentCount; i++) {
        installments.push({
          loan_id: loan.id,
          amount: simulation.installmentValue,
          due_date: currentDate.toISOString().split('T')[0],
          status: 'upcoming'
        });

        // Avança a data conforme frequência
        if (paymentFrequency === 'monthly') currentDate.setMonth(currentDate.getMonth() + 1);
        else if (paymentFrequency === 'daily') currentDate.setDate(currentDate.getDate() + 1);
        else if (paymentFrequency === 'weekly') currentDate.setDate(currentDate.getDate() + 7);
        else if (paymentFrequency === 'biweekly') currentDate.setDate(currentDate.getDate() + 15);
      }

      await supabase.from('installments').insert(installments);

      // 3. Movimentação Financeira
      await supabase.from('transactions').insert([{
        user_id: user.id,
        client_id: selectedClientId,
        loan_id: loan.id,
        wallet_id: selectedWalletId || null,
        type: 'expense',
        category: 'loan_disbursement',
        amount: parseFloat(amount),
        description: `Empréstimo Liberado - ${client?.full_name}`
      }]);

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
      setSelectedClientId('');
      
    } catch (error: any) {
      console.error("Erro:", error.message);
      alert("Erro ao efetivar.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-50 shadow-sm overflow-hidden flex flex-col xl:flex-row">
      <div className="flex-1 p-6 lg:p-10 border-b xl:border-b-0 xl:border-r border-slate-100 space-y-8">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Capital Principal</label>
            <div className="relative">
              <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 size-4 text-slate-300" />
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl pl-12 pr-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Taxa (%)</label>
              <input type="number" value={rate} onChange={(e) => setRate(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Tipo</label>
              <select value={interestType} onChange={(e) => setInterestType(e.target.value as any)} className="w-full bg-slate-50 border-none rounded-2xl px-4 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none appearance-none">
                <option value="monthly">Mês</option>
                <option value="annual">Ano</option>
              </select>
            </div>
          </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Prazo (Meses)</label>
              <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Frequência</label>
              <select value={paymentFrequency} onChange={(e) => setPaymentFrequency(e.target.value as any)} className="w-full bg-slate-50 border-none rounded-2xl px-4 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none appearance-none">
                <option value="monthly">Mensal</option>
                <option value="biweekly">Quinzenal</option>
                <option value="weekly">Semanal</option>
                <option value="daily">Diário</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Categoria</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-4 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none appearance-none">
                <option value="Microcrédito">Microcrédito</option>
                <option value="Pessoal">Pessoal</option>
                <option value="Comercial">Comercial</option>
              </select>
            </div>
         </div>

         <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Observações Internas</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none h-24 resize-none" />
         </div>

         <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-emerald-500" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-700">Garantia Colateral</span>
            </div>
            <input type="checkbox" checked={hasGuarantee} onChange={e => setHasGuarantee(e.target.checked)} className="size-5 accent-emerald-500" />
         </div>
      </div>

      <div className="flex-[0.7] bg-slate-900 p-6 lg:p-10 text-white flex flex-col justify-between relative overflow-hidden">
        <Calculator className="absolute -bottom-10 -right-10 size-64 opacity-5" />
        
        <div className="relative z-10 space-y-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Valor da Parcela</p>
            <h2 className="text-4xl font-black text-emerald-400">{formatCurrency(simulation.installmentValue)}</h2>
            <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-widest">{simulation.installmentCount} pagamentos no total</p>
          </div>

          <div className="space-y-3 pt-6 border-t border-slate-800">
            <div className="flex justify-between text-sm"><span className="text-slate-400">Lucro (Juros)</span><span className="font-black text-emerald-400">+{formatCurrency(simulation.totalInterest)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-400">Total a Receber</span><span className="font-black text-white">{formatCurrency(simulation.totalRepayment)}</span></div>
          </div>
        </div>

        <div className="relative z-10 pt-10 space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cliente</label>
            <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} className="w-full bg-slate-800 border-none rounded-xl p-3 text-sm font-bold text-white outline-none">
              <option value="">Selecionar...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>

          <button 
            onClick={handleSaveLoan} 
            disabled={isSaving || !selectedClientId}
            className="w-full bg-emerald-500 text-slate-900 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-400 transition-all disabled:opacity-30"
          >
            {isSaving ? "Efetivando..." : "Confirmar Empréstimo"}
          </button>

          <AnimatePresence>
            {showSuccess && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
                Sucesso! Empréstimo registrado.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}