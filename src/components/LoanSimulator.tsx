import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, DollarSign, Calendar, Percent, User, CheckCircle2, Wallet, Shield, FileText, Tags } from 'lucide-react';
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

interface WalletType {
  id: string;
  name: string;
  balance: number;
}

export function LoanSimulator() {
  const { formatCurrency } = useLanguage();
  const { user, profile } = useAuth();
  
  // --- Estados do Simulador ---
  const [amount, setAmount] = useState('1000');
  const [rate, setRate] = useState('10');
  const [duration, setDuration] = useState('1'); 
  const [interestType, setInterestType] = useState<'monthly' | 'annual'>('monthly');
  const [paymentFrequency, setPaymentFrequency] = useState<'monthly' | 'daily' | 'weekly' | 'biweekly'>('monthly');
  const [firstInstallmentDueDate, setFirstInstallmentDueDate] = useState(
    new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0]
  );
  
  // --- Funcionalidades Avançadas ---
  const [category, setCategory] = useState('Microcrédito');
  const [notes, setNotes] = useState('');
  const [paymentDays, setPaymentDays] = useState<string[]>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
  
  // --- Estados de Dados ---
  const [clients, setClients] = useState<Client[]>([]);
  const [wallets, setWallets] = useState<WalletType[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState('');
  
  // --- UI States ---
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [hasGuarantee, setHasGuarantee] = useState(false);
  const [guaranteeType, setGuaranteeType] = useState('celular');
  const [guaranteeDescription, setGuaranteeDescription] = useState('');

  // Dias da Semana para seleção visual
  const weekDays = [
    { id: 'sunday', label: 'D' }, { id: 'monday', label: 'S' }, { id: 'tuesday', label: 'T' },
    { id: 'wednesday', label: 'Q' }, { id: 'thursday', label: 'Q' }, { id: 'friday', label: 'S' },
    { id: 'saturday', label: 'S' },
  ];

  useEffect(() => {
    if (user?.id) fetchInitialData();
  }, [user]);

  async function fetchInitialData() {
    try {
      const [clientsRes, walletsRes] = await Promise.all([
        supabase.from('clients').select('id, full_name').eq('user_id', user?.id).eq('status', 'active').order('full_name'),
        supabase.from('wallets').select('id, name, balance').eq('user_id', user?.id).order('name')
      ]);

      if (clientsRes.data) setClients(clientsRes.data);
      if (walletsRes.data) {
        setWallets(walletsRes.data);
        if (walletsRes.data.length > 0) setSelectedWalletId(walletsRes.data[0].id);
      }
    } catch (err) {
      console.error("Erro ao carregar dados do simulador:", err);
    }
  }

  // Alternar dias da semana
  const toggleDay = (dayId: string) => {
    if (paymentFrequency === 'daily') {
      setPaymentDays(prev => prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]);
    } else {
      setPaymentDays([dayId]); // Semanal ou quinzenal só precisa de 1 dia de base
    }
  };

  // --- LÓGICA FINANCEIRA ---
  const simulation = useMemo(() => {
    const principal = parseFloat(amount) || 0;
    const rateVal = parseFloat(rate) || 0;
    const months = parseInt(duration) || 1;

    // Juro calculado sobre o total de meses, independente da frequência de pagamento
    const effectiveRate = interestType === 'monthly' ? rateVal / 100 : (rateVal / 12) / 100;
    const totalInterest = principal * effectiveRate * months;
    const totalRepayment = principal + totalInterest;

    let installmentCount = months;
    if (paymentFrequency === 'daily') installmentCount = months * 30; // Considerando mês comercial de 30 dias
    else if (paymentFrequency === 'weekly') installmentCount = months * 4;
    else if (paymentFrequency === 'biweekly') installmentCount = months * 2;

    return {
      totalInterest,
      totalRepayment,
      installmentValue: totalRepayment / installmentCount,
      installmentCount
    };
  }, [amount, rate, duration, interestType, paymentFrequency]);

  const handleSaveLoan = async () => {
    if (!user || !selectedClientId || !selectedWalletId) {
      alert("Selecione um cliente e uma carteira de origem.");
      return;
    }
    
    setIsSaving(true);
    try {
      const { data: clientData } = await supabase.from('clients').select('*').eq('id', selectedClientId).single();

      // 1. Criar Empréstimo
      const { data: loan, error: loanError } = await supabase.from('loans').insert([{
        user_id: user.id,
        client_id: selectedClientId,
        principal_amount: parseFloat(amount),
        interest_rate: parseFloat(rate),
        interest_type: interestType,
        payment_frequency: paymentFrequency,
        payment_days: paymentDays,
        due_date: firstInstallmentDueDate,
        term_months: parseInt(duration),
        monthly_installment: simulation.installmentValue,
        total_repayment: simulation.totalRepayment,
        category: category,
        notes: notes,
        status: 'active',
        guarantee_info: hasGuarantee ? { type: guaranteeType, description: guaranteeDescription } : null,
        contract_content: await generateLoanContract(
          { 
            ...simulation, 
            principal_amount: parseFloat(amount), 
            interest_rate: parseFloat(rate), 
            interest_type: interestType, 
            payment_frequency: paymentFrequency,
            category: category,
            guarantee_info: hasGuarantee ? { type: guaranteeType, description: guaranteeDescription } : null
          },
          clientData,
          profile
        )
      }]).select().single();

      if (loanError) throw loanError;

      // 2. Gerar Parcelas Inteligentes (Respeitando os dias da semana)
      const installments = [];
      let currentDate = new Date(firstInstallmentDueDate);
      let installmentsCreated = 0;

      while (installmentsCreated < simulation.installmentCount) {
        let isPaymentDay = true;
        
        // Verifica se é dia útil baseado na seleção do usuário (Apenas para pagamentos Diários)
        if (paymentFrequency === 'daily' && paymentDays.length > 0) {
          const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][currentDate.getDay()];
          isPaymentDay = paymentDays.includes(dayName);
        }

        if (isPaymentDay) {
          installments.push({
            loan_id: loan.id,
            amount: simulation.installmentValue,
            due_date: currentDate.toISOString().split('T')[0],
            status: 'upcoming'
          });
          installmentsCreated++;
        }

        // Avanço Dinâmico de Datas
        if (paymentFrequency === 'monthly') currentDate.setMonth(currentDate.getMonth() + 1);
        else if (paymentFrequency === 'biweekly') currentDate.setDate(currentDate.getDate() + 15);
        else if (paymentFrequency === 'weekly') currentDate.setDate(currentDate.getDate() + 7);
        else currentDate.setDate(currentDate.getDate() + 1); // Diário avança 1 a 1 para o while checar os finais de semana
      }

      await supabase.from('installments').insert(installments);

      // 3. Registrar Saída Financeira na Transação
      const loanAmount = parseFloat(amount);
      await supabase.from('transactions').insert([{
        user_id: user.id,
        wallet_id: selectedWalletId,
        type: 'expense',
        category: 'loan_disbursement',
        amount: loanAmount,
        description: `Empréstimo Liberado: ${clientData?.full_name}`
      }]);

      // 4. CORREÇÃO: Deduzir o valor da Carteira
      const currentWallet = wallets.find(w => w.id === selectedWalletId);
      if (currentWallet) {
        const newBalance = currentWallet.balance - loanAmount;
        await supabase.from('wallets').update({ balance: newBalance }).eq('id', selectedWalletId);
        
        // Atualiza o estado local para refletir na UI sem precisar recarregar
        setWallets(prev => prev.map(w => w.id === selectedWalletId ? { ...w, balance: newBalance } : w));
      }

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
      setSelectedClientId('');
      setNotes('');
    } catch (error: any) {
      alert("Erro ao gravar: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-50 shadow-sm overflow-hidden flex flex-col xl:flex-row">
      {/* Lado Esquerdo: Inputs */}
      <div className="flex-1 p-6 lg:p-10 border-b xl:border-b-0 xl:border-r border-slate-100 space-y-8">
        
        {/* Bloco 1: Capital e Taxa */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Valor Principal</label>
            <div className="relative">
              <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 size-4 text-slate-300" />
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} onFocus={e => e.target.select()} className="w-full bg-slate-50 border-none rounded-2xl pl-12 pr-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Taxa %</label>
              <input type="number" value={rate} onChange={e => setRate(e.target.value)} onFocus={e => e.target.select()} className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Período</label>
              <select value={interestType} onChange={e => setInterestType(e.target.value as any)} className="w-full bg-slate-50 border-none rounded-2xl px-4 py-4 text-sm font-bold outline-none appearance-none focus:ring-2 focus:ring-emerald-100">
                <option value="monthly">Ao Mês</option>
                <option value="annual">Ao Ano</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bloco 2: Prazos, Frequência e Categoria */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Prazo (Meses)</label>
            <input type="number" value={duration} onChange={e => setDuration(e.target.value)} onFocus={e => e.target.select()} className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Frequência</label>
            <select value={paymentFrequency} onChange={e => setPaymentFrequency(e.target.value as any)} className="w-full bg-slate-50 border-none rounded-2xl px-4 py-4 text-sm font-bold outline-none appearance-none focus:ring-2 focus:ring-emerald-100">
              <option value="monthly">Mensal</option>
              <option value="biweekly">Quinzenal</option>
              <option value="weekly">Semanal</option>
              <option value="daily">Diário</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Categoria</label>
            <div className="relative">
              <Tags className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400 opacity-50" />
              <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl pl-10 pr-4 py-4 text-sm font-bold outline-none appearance-none focus:ring-2 focus:ring-emerald-100">
                <option value="Microcrédito">Microcrédito</option>
                <option value="Pessoal">Pessoal</option>
                <option value="Comercial">Comercial</option>
                <option value="Emergencial">Emergencial</option>
                <option value="Veículo">Veículo</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bloco 3: Dias da Semana e Data (Dinâmico) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">1º Vencimento</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400 opacity-50" />
              <input type="date" value={firstInstallmentDueDate} onChange={e => setFirstInstallmentDueDate(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl pl-10 pr-4 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none" />
            </div>
          </div>

          {(paymentFrequency === 'daily' || paymentFrequency === 'weekly') && (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Dias de Pagamento</label>
              <div className="flex flex-wrap gap-2 px-1">
                {weekDays.map((day) => (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => toggleDay(day.id)}
                    className={cn(
                      "size-10 lg:size-11 rounded-xl text-[10px] font-black transition-all border-2 flex items-center justify-center",
                      paymentDays.includes(day.id)
                        ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100"
                        : "bg-white border-slate-100 text-slate-400 hover:border-emerald-200"
                    )}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bloco 4: Observações Internas */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Observações Internas</label>
          <div className="relative">
            <FileText className="absolute left-4 top-4 size-4 text-slate-400 opacity-50" />
            <textarea 
              value={notes} 
              onChange={e => setNotes(e.target.value)} 
              placeholder="Anotações privadas sobre a aprovação deste crédito..."
              className="w-full bg-slate-50 border-none rounded-2xl pl-10 pr-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none resize-none h-24" 
            />
          </div>
        </div>

        {/* Bloco 5: Garantia Colateral */}
        <div className="pt-6 border-t border-slate-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-emerald-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">Adicionar Garantia (Colateral)</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={hasGuarantee} onChange={e => setHasGuarantee(e.target.checked)} className="sr-only peer" />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>
          <AnimatePresence>
            {hasGuarantee && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="grid grid-cols-2 gap-4 pt-2 overflow-hidden">
                <select value={guaranteeType} onChange={e => setGuaranteeType(e.target.value)} className="bg-slate-50 border-none rounded-2xl px-4 py-4 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-100">
                  <option value="celular">Celular / Smartphone</option>
                  <option value="veiculo">Veículo / Moto</option>
                  <option value="joia">Joias / Ouro</option>
                  <option value="imovel">Imóvel / Terreno</option>
                  <option value="eletronico">TV / Eletrónico</option>
                </select>
                <input type="text" placeholder="Descrição do bem" value={guaranteeDescription} onChange={e => setGuaranteeDescription(e.target.value)} className="bg-slate-50 border-none rounded-2xl px-4 py-4 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-100" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Lado Direito: Preview Dark */}
      <div className="flex-[0.7] bg-slate-900 p-8 lg:p-12 text-white flex flex-col justify-between relative overflow-hidden">
        <Calculator className="absolute -bottom-10 -right-10 size-64 opacity-5 rotate-12 pointer-events-none" />
        
        <div className="relative z-10 space-y-10">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Parcela Estimada</p>
            <h2 className="text-5xl font-black text-emerald-400 tracking-tighter">{formatCurrency(simulation.installmentValue)}</h2>
            <p className="text-[10px] text-slate-400 mt-2 uppercase font-bold tracking-widest">{simulation.installmentCount} pagamentos no total</p>
          </div>

          <div className="space-y-4 pt-8 border-t border-slate-800">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 font-medium">Lucro Líquido (Juros)</span>
              <span className="font-black text-emerald-400">+{formatCurrency(simulation.totalInterest)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 font-medium">Total a Receber</span>
              <span className="font-black text-white text-lg">{formatCurrency(simulation.totalRepayment)}</span>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Vincular a um Cliente</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400 opacity-50" />
                <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} className="w-full bg-slate-800 border-none rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-white outline-none appearance-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer">
                  <option value="">Selecionar Cliente...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Origem do Capital (Carteira)</label>
              <div className="relative">
                <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400 opacity-50" />
                <select value={selectedWalletId} onChange={e => setSelectedWalletId(e.target.value)} className="w-full bg-slate-800 border-none rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-white outline-none appearance-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer">
                  <option value="">Selecionar Carteira...</option>
                  {wallets.map(w => <option key={w.id} value={w.id}>{w.name} ({formatCurrency(w.balance)})</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 pt-10">
          <button 
            onClick={handleSaveLoan} 
            disabled={isSaving || !selectedClientId || !selectedWalletId}
            className="w-full bg-emerald-500 text-slate-900 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-emerald-400 transition-all active:scale-95 disabled:opacity-20 shadow-2xl shadow-emerald-500/20 flex justify-center items-center gap-2"
          >
            {isSaving ? "Processando Contrato..." : <><CheckCircle2 className="size-4" /> Efetivar Empréstimo</>}
          </button>
          
          <AnimatePresence>
            {showSuccess && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute -top-14 left-0 right-0 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-2xl text-[10px] font-bold text-center uppercase tracking-widest flex items-center justify-center gap-2">
                <CheckCircle2 className="size-4" /> Crédito Efetivado e Contrato Gerado!
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}