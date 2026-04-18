import React, { useState, useEffect } from 'react';
import { Search, Landmark, Wallet, Plus, Filter, ArrowUpRight, ArrowDownRight, ArrowRight, Calendar, User, FileText, X } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { WalletManager } from '../components/WalletManager';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  category: 'loan_disbursement' | 'payment_received' | 'fee' | 'adjustment' | 'other';
  amount: number;
  description: string;
  created_at: string;
  clients?: {
    full_name: string;
  };
}

export function Financial() {
  const { t, formatCurrency, formatDate } = useLanguage();
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [wallets, setWallets] = useState<{id: string, name: string}[]>([]);

  // Form State
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [category, setCategory] = useState<Transaction['category']>('other');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [walletId, setWalletId] = useState('');

  // Stats
  const [stats, setStats] = useState({
    balance: 0,
    inflow: 0,
    outflow: 0
  });

  useEffect(() => {
    fetchTransactions();
    fetchWallets();
  }, [user]);

  useEffect(() => {
    if (editingTransaction) {
      setType(editingTransaction.type);
      setCategory(editingTransaction.category);
      setAmount(editingTransaction.amount.toString());
      setDescription(editingTransaction.description || '');
      setWalletId(editingTransaction.wallet_id || '');
    } else {
      setType('income');
      setCategory('other');
      setAmount('');
      setDescription('');
      setWalletId('');
    }
  }, [editingTransaction]);

  async function fetchWallets() {
    if (!user) return;
    const { data } = await supabase.from('wallets').select('id, name');
    setWallets(data || []);
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
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const txs = data || [];
      setTransactions(txs);

      // Calculate stats
      const inflow = txs.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
      const outflow = txs.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0);
      setStats({
        balance: inflow - outflow,
        inflow,
        outflow
      });

    } catch (err: any) {
      console.error('Error fetching transactions:', err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const txData = {
        type,
        category,
        amount: parseFloat(amount),
        description,
        wallet_id: walletId || null,
        user_id: user.id
      };

      if (editingTransaction) {
        const { error } = await supabase
          .from('transactions')
          .update(txData)
          .eq('id', editingTransaction.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('transactions')
          .insert([txData]);
        if (error) throw error;
      }

      fetchTransactions();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error saving transaction:', err.message);
      alert('Mock Mode: Connection simulation.');
      setIsModalOpen(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!user || !window.confirm(t.confirmDeleteTransaction)) return;
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
      fetchTransactions();
    } catch (err: any) {
      console.error('Error deleting transaction:', err.message);
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = tx.description?.toLowerCase().includes(search.toLowerCase()) || 
                          tx.clients?.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'all' || tx.type === filterType;
    const matchesCategory = filterCategory === 'all' || tx.category === filterCategory;
    return matchesSearch && matchesType && matchesCategory;
  });

  // Prepare chart data (last 7 days)
  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dateStr = date.toISOString().split('T')[0];
    
    const dayTxs = transactions.filter(t => t.created_at.startsWith(dateStr));
    return {
      name: date.toLocaleDateString([], { weekday: 'short' }),
      income: dayTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0),
      expense: dayTxs.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0)
    };
  });

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
            onClick={() => {
              setEditingTransaction(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 lg:px-6 py-2.5 rounded-xl font-black text-[10px] lg:text-xs uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-100"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">{t.addTransaction}</span>
          </button>
        </header>

        <div className="px-4 lg:px-8 py-8 w-full transition-all space-y-8">
          
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div 
               initial={{opacity: 0, y: 20}}
               animate={{opacity: 1, y: 0}}
               className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-xl shadow-slate-200 relative overflow-hidden"
            >
              <div className="relative z-10">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{t.totalBalance}</p>
                <h2 className="text-3xl lg:text-4xl font-black">{formatCurrency(stats.balance)}</h2>
                <div className="mt-4 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Account Active</span>
                </div>
              </div>
              <Wallet className="absolute -bottom-4 -right-4 size-32 opacity-10 rotate-12" />
            </motion.div>

            <motion.div 
               initial={{opacity: 0, y: 20}}
               animate={{opacity: 1, y: 0}}
               transition={{delay: 0.1}}
               className="bg-white rounded-[2rem] p-8 border border-slate-50 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <ArrowUpRight className="size-5 text-emerald-600" />
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md uppercase tracking-widest">Total</span>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{t.inflow}</p>
              <h2 className="text-2xl font-black text-slate-900">{formatCurrency(stats.inflow)}</h2>
            </motion.div>

            <motion.div 
               initial={{opacity: 0, y: 20}}
               animate={{opacity: 1, y: 0}}
               transition={{delay: 0.2}}
               className="bg-white rounded-[2rem] p-8 border border-slate-50 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                  <ArrowDownRight className="size-5 text-rose-600" />
                </div>
                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-md uppercase tracking-widest">Total</span>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{t.outflow}</p>
              <h2 className="text-2xl font-black text-slate-900">{formatCurrency(stats.outflow)}</h2>
            </motion.div>
          </div>

          <WalletManager />
          
          {/* Chart Section */}
          <div className="bg-white rounded-[2.5rem] p-6 lg:p-10 border border-slate-50 shadow-sm">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{t.cashFlow}</h3>
                <p className="text-xs text-slate-400 font-medium">Last 7 days performance</p>
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip 
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                  <Area type="monotone" dataKey="expense" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Transactions List */}
          <div className="bg-white rounded-[2.5rem] border border-slate-50 shadow-sm overflow-hidden">
            <div className="p-6 lg:p-8 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
               <h3 className="text-lg font-bold text-slate-900">{t.allTransactions}</h3>
               
               <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                 <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-300" />
                    <input 
                      type="text"
                      placeholder={t.searchClients}
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-100 outline-none"
                    />
                 </div>
                 <select 
                   value={filterType}
                   onChange={e => setFilterType(e.target.value)}
                   className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-widest focus:ring-2 focus:ring-emerald-100 outline-none appearance-none cursor-pointer"
                 >
                   <option value="all">All Types</option>
                   <option value="income">{t.income}</option>
                   <option value="expense">{t.expense}</option>
                 </select>
               </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.dueDate}</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.description}</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.category}</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t.amount}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    Array.from({length: 5}).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={4} className="px-6 py-6 h-12 bg-slate-50/20" />
                      </tr>
                    ))
                  ) : filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-20 text-center text-slate-400 font-medium">No transactions found.</td>
                    </tr>
                  ) : (
                    filteredTransactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-5 whitespace-nowrap">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{formatDate(tx.created_at)}</span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                              tx.type === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                            )}>
                              {tx.type === 'income' ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900 leading-tight">
                                {tx.description || t[tx.category]}
                              </p>
                              <p className="text-[10px] text-slate-400 font-medium">{tx.clients?.full_name || 'System'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] bg-slate-50 px-2 py-1 rounded-md">
                            {t[tx.category] || tx.category}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className={cn(
                              "text-sm font-black tracking-tighter",
                              tx.type === 'income' ? "text-emerald-600" : "text-slate-900"
                            )}>
                              {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
                            </span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                              <button 
                                onClick={() => {
                                  setEditingTransaction(tx);
                                  setIsModalOpen(true);
                                }}
                                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                              >
                                <FileText className="size-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteTransaction(tx.id)}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              >
                                <X className="size-4" />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsModalOpen(false)}
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
                    {editingTransaction ? t.editTransaction : t.addTransaction}
                  </h3>
                  <button 
                    onClick={() => {
                      setIsModalOpen(false);
                      setEditingTransaction(null);
                    }} 
                    className="p-2 hover:bg-slate-50 rounded-xl"
                  >
                    <X className="size-5 text-slate-400" />
                  </button>
                </div>

                <form onSubmit={handleSaveTransaction} className="space-y-6">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setType('income')}
                      className={cn(
                        "py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-all",
                        type === 'income' ? "bg-emerald-50 border-emerald-500 text-emerald-600" : "bg-slate-50 border-transparent text-slate-400"
                      )}
                    >
                      {t.income}
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('expense')}
                      className={cn(
                        "py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-all",
                        type === 'expense' ? "bg-rose-50 border-rose-500 text-rose-600" : "bg-slate-50 border-transparent text-slate-400"
                      )}
                    >
                      {t.expense}
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">{t.description}</label>
                    <input 
                      type="text" 
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Ex: Aluguel, Provisão..."
                      className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">{t.amount}</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">{t.category}</label>
                      <select 
                        value={category}
                        onChange={e => setCategory(e.target.value as any)}
                        className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none appearance-none"
                      >
                        <option value="other">{t.other}</option>
                        <option value="fee">{t.fee}</option>
                        <option value="adjustment">{t.adjustment}</option>
                        <option value="loan_disbursement">{t.loan_disbursement}</option>
                        <option value="payment_received">{t.payment_received}</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">{t.selectWallet}</label>
                    <select 
                      value={walletId}
                      onChange={e => setWalletId(e.target.value)}
                      className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none appearance-none"
                    >
                      <option value="">{t.selectWallet}</option>
                      {wallets.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-slate-900 text-white rounded-2xl py-4 font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200 mt-4"
                  >
                    {t.save}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
