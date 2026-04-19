import React, { useState, useEffect } from 'react';
import { Search, Landmark, Wallet, Plus, ArrowUpRight, ArrowDownRight, ArrowRight, X } from 'lucide-react';
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

  // Modal State para Nova Transação
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [txCategory, setTxCategory] = useState('other');
  const [txAmount, setTxAmount] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txWalletId, setTxWalletId] = useState('');
  const [availableWallets, setAvailableWallets] = useState<{id: string, name: string}[]>([]);

  // Stats
  const [stats, setStats] = useState({ balance: 0, inflow: 0, outflow: 0 });

  useEffect(() => {
    fetchTransactions();
    fetchWallets();
  }, [user]);

  async function fetchWallets() {
    if (!user) return;
    try {
      const { data } = await supabase.from('wallets').select('id, name').eq('user_id', user.id);
      if (data) setAvailableWallets(data);
    } catch (err) {
      console.error('Error fetching wallets for selection:', err);
    }
  }

  async function fetchTransactions() {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Primeiro tenta buscar com o join de clientes
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
        // Fallback: se o join falhar (ex: coluna faltando), busca sem o join
        console.warn('Join with clients failed, fetching without relationship:', error.message);
        const { data: simpleData, error: simpleError } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (simpleError) throw simpleError;
        setTransactions(simpleData || []);
      } else {
        setTransactions(data || []);
      }
      
      const txs = data || [];
      const inflow = txs.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
      const outflow = txs.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0);
      setStats({ balance: inflow - outflow, inflow, outflow });

    } catch (err: any) {
      console.error('Error fetching transactions:', err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { error } = await supabase.from('transactions').insert([{
        user_id: user.id,
        type: txType,
        category: txCategory,
        amount: parseFloat(txAmount) || 0,
        description: txDescription,
        wallet_id: txWalletId || null
      }]);

      if (error) throw error;
      
      setIsTxModalOpen(false);
      setTxAmount('');
      setTxDescription('');
      setTxWalletId('');
      fetchTransactions(); // Atualiza a lista e os gráficos
    } catch (err: any) {
      console.error('Erro ao adicionar transação:', err.message);
      alert('Falha ao adicionar transação.');
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = tx.description?.toLowerCase().includes(search.toLowerCase()) || 
                          tx.clients?.full_name.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'all' || tx.type === filterType;
    const matchesCategory = filterCategory === 'all' || tx.category === filterCategory;
    return matchesSearch && matchesType && matchesCategory;
  });

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
          
          {/* Botão de Adicionar Transação no Topo */}
          <button 
            onClick={() => setIsTxModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">Nova Transação</span>
          </button>
        </header>

        <div className="px-4 lg:px-8 py-8 w-full transition-all space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-xl shadow-slate-200 relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{t.totalBalance}</p>
                <h2 className="text-3xl lg:text-4xl font-black">{formatCurrency(stats.balance)}</h2>
              </div>
              <Wallet className="absolute -bottom-4 -right-4 size-32 opacity-10 rotate-12" />
            </motion.div>

            <motion.div className="bg-white rounded-[2rem] p-8 border border-slate-50 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <ArrowUpRight className="size-5 text-emerald-600" />
                </div>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{t.inflow}</p>
              <h2 className="text-2xl font-black text-slate-900">{formatCurrency(stats.inflow)}</h2>
            </motion.div>

            <motion.div className="bg-white rounded-[2rem] p-8 border border-slate-50 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                  <ArrowDownRight className="size-5 text-rose-600" />
                </div>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{t.outflow}</p>
              <h2 className="text-2xl font-black text-slate-900">{formatCurrency(stats.outflow)}</h2>
            </motion.div>
          </div>

          <WalletManager />
          
          {/* Chart Section */}
          <div className="bg-white rounded-[2.5rem] p-6 lg:p-10 border border-slate-50 shadow-sm">
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
                  <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
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
                      type="text" placeholder={t.searchClients} value={search} onChange={e => setSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-100 outline-none"
                    />
                 </div>
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
                    <tr><td colSpan={4} className="px-6 py-10 text-center">Carregando...</td></tr>
                  ) : filteredTransactions.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-20 text-center text-slate-400 font-medium">No transactions found.</td></tr>
                  ) : (
                    filteredTransactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-5 whitespace-nowrap"><span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{formatDate(tx.created_at)}</span></td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", tx.type === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                              {tx.type === 'income' ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900 leading-tight">{tx.description || tx.category}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5"><span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] bg-slate-50 px-2 py-1 rounded-md">{t[tx.category] || tx.category}</span></td>
                        <td className="px-6 py-5 text-right">
                          <span className={cn("text-sm font-black tracking-tighter", tx.type === 'income' ? "text-emerald-600" : "text-slate-900")}>
                            {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Modal Nova Transação */}
      <AnimatePresence>
        {isTxModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsTxModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-100">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-slate-900">Registrar Transação</h3>
                <button onClick={() => setIsTxModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl"><X className="size-5 text-slate-400" /></button>
              </div>

              <form onSubmit={handleAddTransaction} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <button type="button" onClick={() => setTxType('income')} className={cn("py-3 rounded-xl border-2 font-bold text-xs uppercase tracking-widest transition-all", txType === 'income' ? "border-emerald-500 bg-emerald-50 text-emerald-600" : "border-slate-100 text-slate-400 hover:bg-slate-50")}>Receita</button>
                  <button type="button" onClick={() => setTxType('expense')} className={cn("py-3 rounded-xl border-2 font-bold text-xs uppercase tracking-widest transition-all", txType === 'expense' ? "border-rose-500 bg-rose-50 text-rose-600" : "border-slate-100 text-slate-400 hover:bg-slate-50")}>Despesa</button>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Descrição</label>
                  <input type="text" value={txDescription} onChange={e => setTxDescription(e.target.value)} placeholder="Ex: Compra de material" className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none" required />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Categoria</label>
                  <select value={txCategory} onChange={e => setTxCategory(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-600 focus:ring-2 focus:ring-emerald-100 outline-none appearance-none">
                    <option value="other">Outros</option>
                    <option value="fee">Taxa / Tarifa</option>
                    <option value="adjustment">Ajuste de Saldo</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Valor</label>
                  <input type="number" step="0.01" value={txAmount} onChange={e => setTxAmount(e.target.value)} placeholder="0.00" className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none" required />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Vincular a uma Carteira</label>
                  <select value={txWalletId} onChange={e => setTxWalletId(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold text-slate-600 focus:ring-2 focus:ring-emerald-100 outline-none appearance-none">
                    <option value="">Nenhuma (Geral)</option>
                    {availableWallets.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <button type="submit" className="w-full bg-slate-900 text-white rounded-2xl py-4 font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200 mt-4">Salvar</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}