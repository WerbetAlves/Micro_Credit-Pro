import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Landmark, Wallet, Plus, ArrowUpRight, ArrowDownRight, X, Filter, MoreVertical, Pencil, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { WalletManager } from '../components/WalletManager';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { ResponsiveContainer, Tooltip, AreaChart, Area, XAxis } from 'recharts';
import { parseAppDate } from '../lib/date';

type TransactionCategory = 'loan_disbursement' | 'payment_received' | 'fee' | 'adjustment' | 'other';
type TransactionType = 'income' | 'expense';

interface Transaction {
  id: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  description: string;
  created_at: string;
  wallet_id?: string | null;
  loan_id?: string | null;
  client_id?: string | null;
  clients?: {
    full_name: string;
  };
}

interface WalletOption {
  id: string;
  name: string;
  balance?: number;
}

type TransactionOrigin = 'manual' | 'loan' | 'system';
type ReversalState = 'normal' | 'reversal' | 'reversed_original';

const getSignedAmount = (tx: Pick<Transaction, 'type' | 'amount'>) => (
  tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount)
);

const isReversalDescription = (description: string) => description.startsWith('[ESTORNO]');
const isReversedOriginalDescription = (description: string) => description.startsWith('[ESTORNADA]');
const isInitialBalanceDescription = (description: string) => description.startsWith('Saldo Inicial -');

const getTransactionOrigin = (tx: Transaction): TransactionOrigin => {
  if (tx.category === 'loan_disbursement' || tx.category === 'payment_received') {
    return 'loan';
  }

  if (isInitialBalanceDescription(tx.description) || isReversalDescription(tx.description) || isReversedOriginalDescription(tx.description)) {
    return 'system';
  }

  return 'manual';
};

const getReversalState = (description: string): ReversalState => {
  if (isReversalDescription(description)) return 'reversal';
  if (isReversedOriginalDescription(description)) return 'reversed_original';
  return 'normal';
};

export function Financial() {
  const { t, formatCurrency, formatDate } = useLanguage();
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterWalletId, setFilterWalletId] = useState<string>('all');
  const [filterOrigin, setFilterOrigin] = useState<string>('all');

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [txType, setTxType] = useState<TransactionType>('expense');
  const [txCategory, setTxCategory] = useState<TransactionCategory>('other');
  const [txAmount, setTxAmount] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txWalletId, setTxWalletId] = useState('');
  const [availableWallets, setAvailableWallets] = useState<WalletOption[]>([]);
  const [txError, setTxError] = useState('');
  const [submittingTx, setSubmittingTx] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const [stats, setStats] = useState({ balance: 0, inflow: 0, outflow: 0 });

  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchTransactions();
    fetchWallets();
  }, [user]);

  useEffect(() => {
    if (!menuOpenId) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [menuOpenId]);

  async function fetchWallets() {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('wallets')
        .select('id, name, balance')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (data) setAvailableWallets(data);
    } catch (err) {
      console.error('Error fetching wallets for selection:', err);
    }
  }

  const getWalletName = (walletId?: string | null) => {
    if (!walletId) return 'Sem carteira';
    return availableWallets.find((wallet) => wallet.id === walletId)?.name || 'Carteira desconhecida';
  };

  async function adjustWalletBalance(walletId: string | null | undefined, delta: number) {
    if (!walletId || !delta) return;

    const wallet = availableWallets.find((item) => item.id === walletId);
    if (!wallet) return;

    const newBalance = Number(wallet.balance || 0) + delta;
    const { error } = await supabase
      .from('wallets')
      .update({ balance: newBalance })
      .eq('id', walletId);

    if (error) throw error;

    setAvailableWallets((prev) =>
      prev.map((item) => (item.id === walletId ? { ...item, balance: newBalance } : item))
    );
  }

  async function fetchTransactions() {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          clients (
            full_name
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        const { data: simpleData, error: simpleError } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (simpleError) throw simpleError;
        setTransactions(simpleData || []);
        calculateStats(simpleData || []);
      } else {
        setTransactions(data || []);
        calculateStats(data || []);
      }
    } catch (err: any) {
      console.error('Error fetching transactions:', err.message);
    } finally {
      setLoading(false);
    }
  }

  const calculateStats = (txs: Transaction[]) => {
    const inflow = txs.filter((t) => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
    const outflow = txs.filter((t) => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0);
    setStats({ balance: inflow - outflow, inflow, outflow });
  };

  const openCreateModal = () => {
    setEditingTransaction(null);
    setTxType('expense');
    setTxCategory('other');
    setTxAmount('');
    setTxDescription('');
    setTxWalletId('');
    setTxError('');
    setIsTxModalOpen(true);
  };

  const openEditModal = (tx: Transaction) => {
    setEditingTransaction(tx);
    setTxType(tx.type);
    setTxCategory(tx.category);
    setTxAmount(String(tx.amount));
    setTxDescription(tx.description);
    setTxWalletId(tx.wallet_id || '');
    setTxError('');
    setMenuOpenId(null);
    setIsTxModalOpen(true);
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!txWalletId) {
      setTxError('Selecione uma carteira para esta movimentação.');
      return;
    }

    setSubmittingTx(true);
    setTxError('');

    try {
      const amount = parseFloat(txAmount) || 0;
      const nextPayload = {
        type: txType,
        category: txCategory,
        amount,
        description: txDescription,
        wallet_id: txWalletId,
      };

      if (editingTransaction) {
        const previousSignedAmount = getSignedAmount(editingTransaction);
        const nextSignedAmount = getSignedAmount({ type: txType, amount });

        if (editingTransaction.wallet_id !== txWalletId) {
          await adjustWalletBalance(editingTransaction.wallet_id, -previousSignedAmount);
          await adjustWalletBalance(txWalletId, nextSignedAmount);
        } else {
          await adjustWalletBalance(txWalletId, nextSignedAmount - previousSignedAmount);
        }

        const { error } = await supabase
          .from('transactions')
          .update(nextPayload)
          .eq('id', editingTransaction.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('transactions')
          .insert([
            {
              user_id: user.id,
              ...nextPayload,
            },
          ]);

        if (error) throw error;
        await adjustWalletBalance(txWalletId, getSignedAmount({ type: txType, amount }));
      }

      setIsTxModalOpen(false);
      fetchTransactions();
      fetchWallets();
    } catch (err: any) {
      console.error('Erro ao salvar transação:', err.message);
      setTxError('Falha ao salvar transação.');
    } finally {
      setSubmittingTx(false);
    }
  };

  const handleDeleteManualTransaction = async (tx: Transaction) => {
    if (!confirm(t.confirmDeleteTransaction)) return;

    try {
      await adjustWalletBalance(tx.wallet_id, -getSignedAmount(tx));
      const { error } = await supabase.from('transactions').delete().eq('id', tx.id);
      if (error) throw error;
      setMenuOpenId(null);
      fetchTransactions();
      fetchWallets();
    } catch (err: any) {
      console.error('Erro ao excluir transação:', err.message);
      alert('Não foi possível excluir a transação.');
    }
  };

  const reversePaymentTransaction = async (tx: Transaction) => {
    if (!tx.loan_id) {
      throw new Error('Esta transação antiga não possui vínculo suficiente para estorno automático.');
    }

    const { data: installments, error } = await supabase
      .from('installments')
      .select('*')
      .eq('loan_id', tx.loan_id)
      .eq('status', 'paid')
      .order('due_date', { ascending: false });

    if (error) throw error;

    const candidates = (installments || []).filter((inst: any) => Number(inst.amount) === Number(tx.amount));
    const installment = candidates[0] || installments?.[0];

    if (!installment) {
      throw new Error('Nenhuma parcela paga correspondente foi encontrada para estorno.');
    }

    const dueDate = parseAppDate(installment.due_date);
    dueDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextStatus = dueDate < today ? 'late' : 'upcoming';

    const { error: updateInstallmentError } = await supabase
      .from('installments')
      .update({ status: nextStatus })
      .eq('id', installment.id);

    if (updateInstallmentError) throw updateInstallmentError;

    await adjustWalletBalance(tx.wallet_id, -getSignedAmount(tx));
  };

  const reverseLoanDisbursementTransaction = async (tx: Transaction) => {
    if (!tx.loan_id) {
      throw new Error('Esta concessão não possui vínculo suficiente para estorno automático.');
    }

    const { data: installments, error } = await supabase
      .from('installments')
      .select('*')
      .eq('loan_id', tx.loan_id);

    if (error) throw error;

    const hasPaidInstallments = (installments || []).some((inst: any) => inst.status === 'paid');
    if (hasPaidInstallments) {
      throw new Error('Não é possível estornar uma concessão que já possui parcelas pagas.');
    }

    if ((installments || []).length > 0) {
      const { error: deleteInstallmentsError } = await supabase
        .from('installments')
        .delete()
        .eq('loan_id', tx.loan_id);

      if (deleteInstallmentsError) throw deleteInstallmentsError;
    }

    const { error: updateLoanError } = await supabase
      .from('loans')
      .update({ status: 'pending' })
      .eq('id', tx.loan_id);

    if (updateLoanError) throw updateLoanError;

    await adjustWalletBalance(tx.wallet_id, -getSignedAmount(tx));
  };

  const handleReverseTransaction = async (tx: Transaction) => {
    if (isReversalDescription(tx.description) || isReversedOriginalDescription(tx.description)) {
      alert('Esta transação já foi estornada.');
      return;
    }

    if (!confirm('Confirmar o estorno desta transação?')) return;

    try {
      const origin = getTransactionOrigin(tx);

      if (origin === 'loan') {
        if (tx.category === 'payment_received') {
          await reversePaymentTransaction(tx);
        } else {
          await reverseLoanDisbursementTransaction(tx);
        }
      } else {
        await adjustWalletBalance(tx.wallet_id, -getSignedAmount(tx));
      }

      const reversalType: TransactionType = tx.type === 'income' ? 'expense' : 'income';
      const reversalDescription = `[ESTORNO] ${tx.description}`;

      const { error: reversalError } = await supabase
        .from('transactions')
        .insert([
          {
            user_id: user?.id,
            client_id: tx.client_id || null,
            loan_id: tx.loan_id || null,
            wallet_id: tx.wallet_id || null,
            type: reversalType,
            category: 'adjustment',
            amount: tx.amount,
            description: reversalDescription,
          },
        ]);

      if (reversalError) throw reversalError;

      const { error: markOriginalError } = await supabase
        .from('transactions')
        .update({ description: `[ESTORNADA] ${tx.description}` })
        .eq('id', tx.id);

      if (markOriginalError) throw markOriginalError;

      setMenuOpenId(null);
      fetchTransactions();
      fetchWallets();
    } catch (err: any) {
      console.error('Erro ao estornar transação:', err.message);
      alert(err.message || 'Não foi possível estornar a transação.');
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const origin = getTransactionOrigin(tx);
      const matchesSearch =
        tx.description?.toLowerCase().includes(search.toLowerCase()) ||
        tx.clients?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        getWalletName(tx.wallet_id).toLowerCase().includes(search.toLowerCase());
      const matchesType = filterType === 'all' || tx.type === filterType;
      const matchesCategory = filterCategory === 'all' || tx.category === filterCategory;
      const matchesWallet = filterWalletId === 'all' || tx.wallet_id === filterWalletId;
      const matchesOrigin = filterOrigin === 'all' || origin === filterOrigin;
      return matchesSearch && matchesType && matchesCategory && matchesWallet && matchesOrigin;
    });
  }, [transactions, search, filterType, filterCategory, filterWalletId, filterOrigin, availableWallets]);

  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dateStr = date.toISOString().split('T')[0];

    const dayTxs = transactions.filter((t) => t.created_at.startsWith(dateStr));
    return {
      name: date.toLocaleDateString([], { weekday: 'short' }),
      income: dayTxs.filter((t) => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0),
      expense: dayTxs.filter((t) => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0),
    };
  });

  const categories: TransactionCategory[] = ['loan_disbursement', 'payment_received', 'fee', 'adjustment', 'other'];

  return (
    <div className="flex min-h-screen bg-[#f8fafc] overflow-x-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="flex-1 lg:ml-72 min-h-screen pb-20 w-full transition-all duration-300">
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-4 lg:px-8 py-4 lg:py-5">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-500">
              <Landmark className="size-6" />
            </button>
            <h1 className="text-lg lg:text-xl font-bold tracking-tight text-slate-900 truncate">{t.financialOverview}</h1>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">{t.newTransaction}</span>
          </button>
        </header>

        <div className="px-4 lg:px-8 py-8 w-full transition-all space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.button
              type="button"
              onClick={() => setFilterType('all')}
              className={cn(
                'bg-slate-900 rounded-[2rem] p-8 text-white shadow-xl shadow-slate-200 relative overflow-hidden text-left',
                filterType === 'all' && 'ring-2 ring-emerald-400'
              )}
            >
              <div className="relative z-10">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{t.totalBalance}</p>
                <h2 className="text-3xl lg:text-4xl font-black">{formatCurrency(stats.balance)}</h2>
              </div>
              <Wallet className="absolute -bottom-4 -right-4 size-32 opacity-10 rotate-12" />
            </motion.button>

            <motion.button
              type="button"
              onClick={() => setFilterType(filterType === 'income' ? 'all' : 'income')}
              className={cn(
                'bg-white rounded-[2rem] p-8 border border-slate-50 shadow-sm text-left',
                filterType === 'income' && 'ring-2 ring-emerald-400'
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <ArrowUpRight className="size-5 text-emerald-600" />
                </div>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{t.inflow}</p>
              <h2 className="text-2xl font-black text-slate-900">{formatCurrency(stats.inflow)}</h2>
            </motion.button>

            <motion.button
              type="button"
              onClick={() => setFilterType(filterType === 'expense' ? 'all' : 'expense')}
              className={cn(
                'bg-white rounded-[2rem] p-8 border border-slate-50 shadow-sm text-left',
                filterType === 'expense' && 'ring-2 ring-rose-400'
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                  <ArrowDownRight className="size-5 text-rose-600" />
                </div>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{t.outflow}</p>
              <h2 className="text-2xl font-black text-slate-900">{formatCurrency(stats.outflow)}</h2>
            </motion.button>
          </div>

          <WalletManager />

          <div className="bg-white rounded-[2.5rem] p-6 lg:p-10 border border-slate-50 shadow-sm">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                  <Area type="monotone" dataKey="expense" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-50 shadow-sm overflow-hidden">
            <div className="p-6 lg:p-8 border-b border-slate-100 space-y-4">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">{t.allTransactions}</h3>
                <div className="relative flex-1 md:max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-300" />
                  <input
                    type="text"
                    placeholder={t.searchClients}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-100 outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  <Filter className="size-3.5" />
                  Filtros
                </div>

                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-600 outline-none"
                >
                  <option value="all">{t.filterByCategory}</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {t[category] || category}
                    </option>
                  ))}
                </select>

                <select
                  value={filterOrigin}
                  onChange={(e) => setFilterOrigin(e.target.value)}
                  className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-600 outline-none"
                >
                  <option value="all">Todas as origens</option>
                  <option value="manual">Lançamento manual</option>
                  <option value="loan">Empréstimo / pagamento</option>
                  <option value="system">Sistema</option>
                </select>

                <select
                  value={filterWalletId}
                  onChange={(e) => setFilterWalletId(e.target.value)}
                  className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-600 outline-none"
                >
                  <option value="all">Todas as carteiras</option>
                  {availableWallets.map((wallet) => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.name}
                    </option>
                  ))}
                </select>
              </div>

              {availableWallets.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setFilterWalletId('all')}
                    className={cn(
                      'px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                      filterWalletId === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500'
                    )}
                  >
                    Todas
                  </button>
                  {availableWallets.map((wallet) => (
                    <button
                      type="button"
                      key={wallet.id}
                      onClick={() => setFilterWalletId((prev) => (prev === wallet.id ? 'all' : wallet.id))}
                      className={cn(
                        'px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                        filterWalletId === wallet.id ? 'bg-emerald-500 text-white' : 'bg-slate-50 text-slate-500 hover:bg-emerald-50'
                      )}
                    >
                      {wallet.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.dueDate}</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.description}</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.category}</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Carteira</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Origem</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.amount}</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center">{t.processing}</td>
                    </tr>
                  ) : filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-20 text-center text-slate-400 font-medium">
                        {t.noTransactions || 'No transactions found.'}
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => {
                      const origin = getTransactionOrigin(tx);
                      const isManual = origin === 'manual';
                      const isSystem = origin !== 'manual';
                      const reversalState = getReversalState(tx.description);
                      const isReversed = reversalState !== 'normal';

                      return (
                        <tr
                          key={tx.id}
                          className={cn(
                            'transition-colors',
                            reversalState === 'reversal' && 'bg-emerald-50/35 hover:bg-emerald-50/60',
                            reversalState === 'reversed_original' && 'bg-amber-50/40 hover:bg-amber-50/70',
                            reversalState === 'normal' && 'hover:bg-slate-50/50'
                          )}
                        >
                          <td className="px-6 py-5 whitespace-nowrap">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                              {formatDate(tx.created_at)}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', tx.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600')}>
                                {tx.type === 'income' ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-xs font-bold text-slate-900 leading-tight">{tx.description || tx.category}</p>
                                  {reversalState === 'reversal' && (
                                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                                      Estorno
                                    </span>
                                  )}
                                  {reversalState === 'reversed_original' && (
                                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                                      Original Estornada
                                    </span>
                                  )}
                                </div>
                                {tx.clients?.full_name && (
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                                    {tx.clients.full_name}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] bg-slate-50 px-2 py-1 rounded-md">
                              {t[tx.category] || tx.category}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <button
                              type="button"
                              onClick={() => setFilterWalletId((prev) => (prev === tx.wallet_id ? 'all' : tx.wallet_id || 'all'))}
                              className={cn(
                                'text-xs font-bold rounded-lg px-2 py-1 transition-all',
                                filterWalletId === tx.wallet_id
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'text-slate-600 hover:bg-slate-100'
                              )}
                            >
                              {getWalletName(tx.wallet_id)}
                            </button>
                          </td>
                          <td className="px-6 py-5">
                            <span
                              className={cn(
                                'text-[10px] font-black uppercase tracking-[0.15em] px-2 py-1 rounded-md',
                                origin === 'manual'
                                  ? 'bg-blue-50 text-blue-600'
                                  : origin === 'loan'
                                    ? 'bg-amber-50 text-amber-600'
                                    : 'bg-slate-100 text-slate-500'
                              )}
                            >
                              {origin === 'manual' ? 'Manual' : origin === 'loan' ? 'Empréstimo' : 'Sistema'}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <span className={cn('text-sm font-black tracking-tighter', tx.type === 'income' ? 'text-emerald-600' : 'text-slate-900')}>
                              {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <div ref={menuOpenId === tx.id ? actionMenuRef : null} className="relative inline-flex justify-end">
                              <button
                                type="button"
                                onClick={() => setMenuOpenId((prev) => (prev === tx.id ? null : tx.id))}
                                className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-emerald-500"
                              >
                                <MoreVertical className="size-4" />
                              </button>

                              {menuOpenId === tx.id && (
                                <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-slate-100 rounded-2xl shadow-xl z-20 overflow-hidden">
                                  {isManual && !isReversed && (
                                    <button
                                      type="button"
                                      onClick={() => openEditModal(tx)}
                                      className="w-full px-4 py-3 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                                    >
                                      <Pencil className="size-3.5" />
                                      Editar lançamento
                                    </button>
                                  )}

                                  {!isReversed && (
                                    <button
                                      type="button"
                                      onClick={() => handleReverseTransaction(tx)}
                                      className="w-full px-4 py-3 text-left text-xs font-bold text-amber-600 hover:bg-amber-50 flex items-center gap-2"
                                    >
                                      <RotateCcw className="size-3.5" />
                                      Estornar lançamento
                                    </button>
                                  )}

                                  {isManual && !isReversed && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteManualTransaction(tx)}
                                      className="w-full px-4 py-3 text-left text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2 border-t border-slate-50"
                                    >
                                      <Trash2 className="size-3.5" />
                                      Excluir lançamento
                                    </button>
                                  )}

                                  {isSystem && (
                                    <div className="px-4 py-3 border-t border-slate-50 bg-slate-50/70 flex items-start gap-2 text-[10px] font-bold text-slate-500">
                                      <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                                      {origin === 'loan'
                                        ? 'Lançamentos do empréstimo não podem ser excluídos.'
                                        : 'Este lançamento do sistema não pode ser excluído.'}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {isTxModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTxModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-100"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-slate-900">
                  {editingTransaction ? t.editTransaction : t.registerTransaction}
                </h3>
                <button onClick={() => setIsTxModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl">
                  <X className="size-5 text-slate-400" />
                </button>
              </div>

              {txError && (
                <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-sm font-bold">
                  {txError}
                </div>
              )}

              <form onSubmit={handleSaveTransaction} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setTxType('income')}
                    className={cn(
                      'py-3 rounded-xl border-2 font-bold text-xs uppercase tracking-widest transition-all',
                      txType === 'income' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-100 text-slate-400 hover:bg-slate-50'
                    )}
                  >
                    {t.income}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxType('expense')}
                    className={cn(
                      'py-3 rounded-xl border-2 font-bold text-xs uppercase tracking-widest transition-all',
                      txType === 'expense' ? 'border-rose-500 bg-rose-50 text-rose-600' : 'border-slate-100 text-slate-400 hover:bg-slate-50'
                    )}
                  >
                    {t.expense}
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">{t.description}</label>
                  <input
                    type="text"
                    value={txDescription}
                    onChange={(e) => setTxDescription(e.target.value)}
                    placeholder="Ex: Compra de material"
                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">{t.category}</label>
                  <select
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value as TransactionCategory)}
                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-600 focus:ring-2 focus:ring-emerald-100 outline-none appearance-none"
                  >
                    <option value="other">{t.other}</option>
                    <option value="fee">{t.fee}</option>
                    <option value="adjustment">{t.adjustment}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">{t.amount}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">{t.linkWallet}</label>
                  <select
                    value={txWalletId}
                    onChange={(e) => setTxWalletId(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-600 focus:ring-2 focus:ring-emerald-100 outline-none appearance-none"
                    required
                  >
                    <option value="">Selecione uma carteira...</option>
                    {availableWallets.map((wallet) => (
                      <option key={wallet.id} value={wallet.id}>
                        {wallet.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={submittingTx}
                  className="w-full bg-slate-900 text-white rounded-2xl py-4 font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200 mt-4 disabled:opacity-50"
                >
                  {submittingTx ? t.processing : t.save}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
