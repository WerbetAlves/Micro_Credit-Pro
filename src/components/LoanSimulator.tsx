import { useState, useEffect, useMemo } from 'react';
import { Calculator, DollarSign, Calendar, Percent, User, CheckCircle2, Wallet, Shield } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { generateLoanContract } from '../services/contractService';
import { cn } from '../lib/utils';

type Client = {
  id: string;
  full_name: string;
};

type Wallet = {
  id: string;
  name: string;
  balance: number;
};

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

const parseLocalDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const diffDaysInclusive = (startDate: string, endDate: string) => {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(diffDays, 1);
};

export function LoanSimulator() {
  const { formatCurrency } = useLanguage();
  const { user, profile } = useAuth();

  const [amount, setAmount] = useState('5000');
  const [rate, setRate] = useState('5');
  const [duration, setDuration] = useState('12');
  const [interestType, setInterestType] = useState<'monthly' | 'annual'>('monthly');
  const [paymentFrequency, setPaymentFrequency] = useState<'monthly' | 'daily' | 'weekly' | 'biweekly'>('monthly');
  const [paymentDays, setPaymentDays] = useState<string[]>([]);
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [firstInstallmentDueDate, setFirstInstallmentDueDate] = useState(
    new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('Microcrédito');

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState('');
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
    const { data } = await supabase
      .from('wallets')
      .select('id, name, balance')
      .eq('user_id', user?.id);

    if (data) {
      setWallets(data);
      if (data.length > 0) setSelectedWalletId(data[0].id);
    }
  }

  async function fetchClients() {
    const { data } = await supabase
      .from('clients')
      .select('id, full_name')
      .eq('user_id', user?.id)
      .eq('status', 'active');

    if (data) setClients(data);
  }

  const weekDays = [
    { id: 'sunday', label: 'DOM' },
    { id: 'monday', label: 'SEG' },
    { id: 'tuesday', label: 'TER' },
    { id: 'wednesday', label: 'QUA' },
    { id: 'thursday', label: 'QUI' },
    { id: 'friday', label: 'SEX' },
    { id: 'saturday', label: 'SAB' },
  ];

  const toggleDay = (dayId: string) => {
    if (paymentFrequency === 'daily') {
      setPaymentDays((prev) =>
        prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId]
      );
    } else {
      setPaymentDays([dayId]);
    }
  };

  const simulation = useMemo(() => {
    const numAmount = parseFloat(amount) || 0;
    const numRate = parseFloat(rate) || 0;
    const numDuration = Math.max(parseInt(duration) || 1, 1);
    const totalPeriodDays = diffDaysInclusive(firstInstallmentDate, firstInstallmentDueDate);
    const monthlyRate = interestType === 'monthly' ? numRate / 100 : (numRate / 12) / 100;

    const equivalentMonths = paymentFrequency === 'monthly' ? numDuration : totalPeriodDays / 30;
    const installmentCount = numDuration;
    const totalInterest = numAmount * monthlyRate * equivalentMonths;
    const totalAmount = numAmount + totalInterest;
    const installmentValue = installmentCount > 0 ? totalAmount / installmentCount : totalAmount;

    return {
      numAmount,
      numRate,
      numDuration,
      totalPeriodDays,
      equivalentMonths,
      installmentCount,
      totalInterest,
      totalAmount,
      installmentValue,
    };
  }, [amount, rate, duration, interestType, paymentFrequency, firstInstallmentDate, firstInstallmentDueDate]);

  const {
    numAmount,
    numRate,
    numDuration,
    totalPeriodDays,
    equivalentMonths,
    installmentCount,
    totalInterest,
    totalAmount,
    installmentValue,
  } = simulation;

  const handleSaveLoan = async () => {
    if (!user || !selectedClientId) {
      alert('Por favor, selecione um cliente para vincular o empréstimo.');
      return;
    }

    setIsSaving(true);

    try {
      const { data: client } = await supabase
        .from('clients')
        .select('*')
        .eq('id', selectedClientId)
        .single();

      if (!client) throw new Error('Cliente não encontrado.');

      const contractContent = await generateLoanContract(
        {
          principal_amount: numAmount,
          interest_rate: numRate,
          interest_type: interestType,
          term_months: paymentFrequency === 'monthly' ? numDuration : Math.max(1, Math.ceil(equivalentMonths)),
          monthly_installment: installmentValue,
          total_repayment: totalAmount,
          payment_frequency: paymentFrequency,
          category,
          guarantee_info: hasGuarantee
            ? { type: guaranteeType, description: guaranteeDescription }
            : null,
        },
        client,
        profile
      );

      const { data: loan, error: loanError } = await supabase
        .from('loans')
        .insert([
          {
            user_id: user.id,
            client_id: selectedClientId,
            principal_amount: numAmount,
            interest_rate: numRate,
            interest_type: interestType,
            payment_frequency: paymentFrequency,
            payment_days: paymentDays,
            first_installment_date: firstInstallmentDate,
            due_date: firstInstallmentDueDate,
            category,
            notes,
            term_months: paymentFrequency === 'monthly' ? numDuration : Math.max(1, Math.ceil(equivalentMonths)),
            term_days: paymentFrequency === 'monthly' ? numDuration * 30 : totalPeriodDays,
            monthly_installment: installmentValue,
            total_repayment: totalAmount,
            status: 'active',
            guarantee_info: hasGuarantee
              ? {
                  type: guaranteeType,
                  description: guaranteeDescription,
                }
              : null,
            legal_validation_status: 'not_validated',
            sent_to_client: true,
            contract_content: contractContent,
          },
        ])
        .select()
        .single();

      if (loanError) throw loanError;

      const installments = [];

      if (paymentFrequency === 'monthly') {
        let currentDate = parseLocalDate(firstInstallmentDueDate);

        for (let i = 0; i < installmentCount; i++) {
          installments.push({
            loan_id: loan.id,
            amount: installmentValue,
            due_date: formatLocalDate(currentDate),
            status: 'upcoming',
          });
          currentDate.setMonth(currentDate.getMonth() + 1);
        }
      } else if (paymentFrequency === 'daily') {
        const endDate = parseLocalDate(firstInstallmentDueDate);
        let currentDate = parseLocalDate(firstInstallmentDate);
        let created = 0;

        while (created < installmentCount) {
          const dayName = DAY_NAMES[currentDate.getDay()];
          const canCharge = paymentDays.length === 0 || paymentDays.includes(dayName);

          if (canCharge) {
            installments.push({
              loan_id: loan.id,
              amount: installmentValue,
              due_date: formatLocalDate(currentDate),
              status: 'upcoming',
            });
            created++;
          }

          currentDate.setDate(currentDate.getDate() + 1);

          if (currentDate > endDate && created < installmentCount) {
            continue;
          }
        }
      } else if (paymentFrequency === 'weekly') {
        let currentDate = parseLocalDate(firstInstallmentDueDate);
        let created = 0;

        while (created < installmentCount) {
          if (paymentDays.length > 0) {
            while (DAY_NAMES[currentDate.getDay()] !== paymentDays[0]) {
              currentDate.setDate(currentDate.getDate() + 1);
            }
          }

          installments.push({
            loan_id: loan.id,
            amount: installmentValue,
            due_date: formatLocalDate(currentDate),
            status: 'upcoming',
          });
          created++;
          currentDate.setDate(currentDate.getDate() + 7);
        }
      } else {
        let currentDate = parseLocalDate(firstInstallmentDueDate);
        let created = 0;

        while (created < installmentCount) {
          if (paymentDays.length > 0) {
            while (DAY_NAMES[currentDate.getDay()] !== paymentDays[0]) {
              currentDate.setDate(currentDate.getDate() + 1);
            }
          }

          installments.push({
            loan_id: loan.id,
            amount: installmentValue,
            due_date: formatLocalDate(currentDate),
            status: 'upcoming',
          });
          created++;
          currentDate.setDate(currentDate.getDate() + 14);
        }
      }

      const { error: instError } = await supabase.from('installments').insert(installments);
      if (instError) throw instError;

      await supabase.from('transactions').insert([
        {
          user_id: user.id,
          client_id: selectedClientId,
          loan_id: loan.id,
          wallet_id: selectedWalletId || null,
          type: 'expense',
          category: 'loan_disbursement',
          amount: numAmount,
          description: `Empréstimo Liberado: ${client.full_name}`,
        },
      ]);

      const currentWallet = wallets.find((w) => w.id === selectedWalletId);
      if (currentWallet) {
        const newBalance = currentWallet.balance - numAmount;
        await supabase.from('wallets').update({ balance: newBalance }).eq('id', selectedWalletId);

        setWallets((prev) =>
          prev.map((w) => (w.id === selectedWalletId ? { ...w, balance: newBalance } : w))
        );
      }

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
      setSelectedClientId('');
      setNotes('');
    } catch (error: any) {
      console.error('Erro ao efetivar empréstimo:', error.message);
      alert('Ocorreu um erro. Verifique as configurações do banco de dados.');
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
              <input
                type="number"
                value={amount || ''}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-2xl pl-12 pr-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Taxa (%)</label>
              <div className="relative">
                <Percent className="absolute left-5 top-1/2 -translate-y-1/2 size-4 text-slate-300" />
                <input
                  type="number"
                  value={rate || ''}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setRate(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-2xl pl-12 pr-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Tipo Juros</label>
              <select
                value={interestType}
                onChange={(e) => setInterestType(e.target.value as 'monthly' | 'annual')}
                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none appearance-none"
              >
                <option value="monthly">Ao Mês</option>
                <option value="annual">Ao Ano</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Freq. Pagamento</label>
              <select
                value={paymentFrequency}
                onChange={(e) => setPaymentFrequency(e.target.value as 'monthly' | 'daily' | 'weekly' | 'biweekly')}
                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none appearance-none"
              >
                <option value="daily">Diário</option>
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quinzenal</option>
                <option value="monthly">Mensal</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none appearance-none"
              >
                <option value="Microcrédito">Microcrédito</option>
                <option value="Pessoal">Pessoal</option>
                <option value="Comercial">Comercial</option>
                <option value="Emergencial">Emergencial</option>
                <option value="Educação">Educação</option>
                <option value="Saúde">Saúde</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
          </div>

          {(paymentFrequency === 'daily' || paymentFrequency === 'weekly' || paymentFrequency === 'biweekly') && (
            <div className="space-y-2 pt-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Dias de Cobrança</label>
              <div className="flex flex-wrap gap-2 px-2">
                {weekDays.map((day) => (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => toggleDay(day.id)}
                    className={cn(
                      'size-10 rounded-xl text-[10px] font-black transition-all border-2',
                      paymentDays.includes(day.id)
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100'
                        : 'bg-white border-slate-100 text-slate-400 hover:border-emerald-200'
                    )}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Data Início</label>
              <input
                type="date"
                value={firstInstallmentDate}
                onChange={(e) => setFirstInstallmentDate(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Venc. 1ª Parcela</label>
              <input
                type="date"
                value={firstInstallmentDueDate}
                onChange={(e) => setFirstInstallmentDueDate(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
              Prazo ({paymentFrequency === 'monthly' ? 'Meses' : paymentFrequency === 'daily' ? 'Dias' : 'Parcelas'})
            </label>
            <div className="relative">
              <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 size-4 text-slate-300" />
              <input
                type="number"
                value={duration || ''}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-2xl pl-12 pr-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Observações</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas internas sobre este crédito..."
              className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none min-h-[100px] resize-none"
            />
          </div>

          <div className="pt-6 border-t border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="size-4 text-emerald-500" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-700">Garantia Colateral</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasGuarantee}
                  onChange={(e) => setHasGuarantee(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <AnimatePresence>
              {hasGuarantee && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden space-y-4 pt-2"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Tipo</label>
                      <select
                        value={guaranteeType}
                        onChange={(e) => setGuaranteeType(e.target.value)}
                        className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none appearance-none"
                      >
                        <option value="celular">Celular / Smartphone</option>
                        <option value="eletronico">TV / Eletrônico</option>
                        <option value="veiculo">Carro / Moto</option>
                        <option value="imovel">Imóvel</option>
                        <option value="outro">Outro Bem</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Modelo / Descrição</label>
                      <input
                        type="text"
                        placeholder="Ex: iPhone 13 Pro"
                        value={guaranteeDescription}
                        onChange={(e) => setGuaranteeDescription(e.target.value)}
                        className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium italic ml-4">
                    * A garantia será registrada no contrato deste empréstimo.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="flex-[0.8] bg-slate-900 p-6 lg:p-10 text-white relative overflow-hidden flex flex-col justify-between">
        <Calculator className="absolute -bottom-10 -right-10 size-64 opacity-5 rotate-12 pointer-events-none" />

        <div className="relative z-10 space-y-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Parcela ({paymentFrequency})</p>
            <h2 className="text-4xl lg:text-5xl font-black text-emerald-400">{formatCurrency(installmentValue)}</h2>
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
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Origem do Capital (Carteira)</label>
            <div className="relative">
              <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <select
                value={selectedWalletId}
                onChange={(e) => setSelectedWalletId(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl pl-10 pr-6 py-3 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none appearance-none text-white"
              >
                <option value="">Selecione uma carteira...</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            {wallets.length === 0 && (
              <p className="text-[8px] text-rose-400 font-bold ml-4 uppercase">Nenhuma carteira encontrada. Crie uma na aba Financeiro.</p>
            )}
          </div>

          <button
            onClick={handleSaveLoan}
            disabled={isSaving || !selectedClientId}
            className="w-full bg-emerald-500 text-slate-900 rounded-2xl py-4 font-black text-xs uppercase tracking-widest hover:bg-emerald-400 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
          >
            {isSaving ? (
              'Processando...'
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                Efetivar Empréstimo
              </>
            )}
          </button>

          <AnimatePresence>
            {showSuccess && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
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
