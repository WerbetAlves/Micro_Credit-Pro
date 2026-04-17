import React, { useState, useEffect } from 'react';
import { Search, Wallet, Calendar, CheckCircle2, XCircle, Clock, Filter, User, MoreVertical, Plus, Edit2, Trash2, X, AlertCircle } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Installment {
  id: string;
  loan_id: string;
  due_date: string;
  amount: number;
  status: 'upcoming' | 'paid' | 'late' | 'missed';
  created_at: string;
  loans?: {
    clients?: {
      full_name: string;
    };
  };
}

export function Payments() {
  const { t, formatCurrency, formatDate } = useLanguage();
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loans, setLoans] = useState<{id: string, client_id: string, clients?: {full_name: string}}[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInstallment, setEditingInstallment] = useState<Installment | null>(null);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [wallets, setWallets] = useState<{id: string, name: string}[]>([]);
  const [installmentToPay, setInstallmentToPay] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    loan_id: '',
    due_date: new Date().toISOString().split('T')[0],
    amount: 0,
    status: 'upcoming' as const
  });

  useEffect(() => {
    fetchInstallments();
    fetchLoans();
    fetchWallets();
  }, [user]);

  async function fetchWallets() {
    if (!user) return;
    const { data } = await supabase
      .from('wallets')
      .select('id, name')
      .eq('user_id', user.id);
    if (data) setWallets(data);
    else setWallets([{id: 'default', name: t.mainPortfolio}]);
  }

  async function fetchLoans() {
    if (!user) return;
    const { data } = await supabase
      .from('loans')
      .select('id, client_id, clients(full_name)')
      .eq('user_id', user.id);
    if (data) setLoans(data as any);
  }

  async function fetchInstallments() {
    if (!user) return;
    setLoading(true);
    try {
      // Joining installments -> loans -> clients
      const { data, error } = await supabase
        .from('installments')
        .select(`
          *,
          loans (
            id,
            user_id,
            clients (
              full_name
            )
          )
        `)
        .order('due_date', { ascending: true });

      if (error) throw error;
      
      // Filter by current user in memory since we need to join deeply 
      // (Supabase RLS handles this but for robustness we filter or adjust query)
      const userInstallments = (data || []).filter((inst: any) => inst.loans?.user_id === user.id);
      setInstallments(userInstallments);
    } catch (err: any) {
      console.error('Error fetching installments:', err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleMarkAsPaid = async (id: string) => {
    setInstallmentToPay(id);
    setIsWalletModalOpen(true);
  };

  const confirmPayment = async () => {
    if (!installmentToPay || !user) return;
    
    setFormLoading(true);
    try {
      // Find installment
      const { data: inst } = await supabase
        .from('installments')
        .select('amount, lonals:loans(id, client_id)')
        .eq('id', installmentToPay)
        .single();
      
      const { error } = await supabase
        .from('installments')
        .update({ status: 'paid' })
        .eq('id', installmentToPay);
      
      if (error) throw error;

      if (inst) {
        const loan: any = inst.lonals;
        await supabase.from('transactions').insert({
          user_id: user.id,
          client_id: loan?.client_id,
          loan_id: loan?.id,
          installment_id: installmentToPay,
          wallet_id: selectedWalletId === 'default' ? null : selectedWalletId,
          type: 'income',
          category: 'payment_received',
          amount: inst.amount,
          description: `Recebimento de parcela: ${installmentToPay.split('-')[0]}`
        });

        // Update Wallet Balance
        if (selectedWalletId && selectedWalletId !== 'default') {
           const { data: currWallet } = await supabase.from('wallets').select('balance').eq('id', selectedWalletId).single();
           if (currWallet) {
             await supabase.from('wallets').update({ balance: Number(currWallet.balance) + Number(inst.amount) }).eq('id', selectedWalletId);
           }
        }
      }

      setIsWalletModalOpen(false);
      setInstallmentToPay(null);
      fetchInstallments();
    } catch (err: any) {
      console.error('Error marking as paid:', err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleOpenModal = (inst?: Installment) => {
    if (inst) {
      setEditingInstallment(inst);
      setFormData({
        loan_id: inst.loan_id,
        due_date: inst.due_date,
        amount: inst.amount,
        status: inst.status
      });
    } else {
      setEditingInstallment(null);
      setFormData({
        loan_id: '',
        due_date: new Date().toISOString().split('T')[0],
        amount: 0,
        status: 'upcoming'
      });
    }
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFormLoading(true);
    setFormError(null);

    try {
      if (editingInstallment) {
        const { error } = await supabase
          .from('installments')
          .update(formData)
          .eq('id', editingInstallment.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('installments')
          .insert([formData]);
        if (error) throw error;
      }
      
      setIsModalOpen(false);
      fetchInstallments();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t.confirmDeleteInstallment || 'Delete this installment?')) return;
    try {
      const { error } = await supabase.from('installments').delete().eq('id', id);
      if (error) throw error;
      fetchInstallments();
    } catch (err: any) {
      console.error('Delete error:', err.message);
    }
  };

  const filteredInstallments = installments.filter(inst => {
    const clientName = inst.loans?.clients?.full_name || '';
    const matchesSearch = clientName.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterStatus === 'all' || inst.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    totalPaid: installments.filter(i => i.status === 'paid').reduce((acc, i) => acc + Number(i.amount), 0),
    totalUpcoming: installments.filter(i => i.status === 'upcoming').reduce((acc, i) => acc + Number(i.amount), 0),
    totalLate: installments.filter(i => i.status === 'late').reduce((acc, i) => acc + Number(i.amount), 0),
  };

  return (
    <div className="flex min-h-screen bg-[#f8fafc] overflow-x-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="flex-1 lg:ml-72 min-h-screen pb-20 w-full transition-all duration-300">
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-4 lg:px-8 py-4 lg:py-5">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-500">
              <Wallet className="size-6" />
            </button>
            <h1 className="text-lg lg:text-xl font-bold tracking-tight text-slate-900 truncate">{t.paymentsManagement}</h1>
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all active:scale-95"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">{t.addPayment || 'Add Payment'}</span>
          </button>
        </header>

        <div className="px-4 lg:px-8 py-8 w-full">
          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-white p-6 rounded-[1.5rem] border border-slate-50 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{t.totalCollected}</p>
                <p className="text-xl font-black text-emerald-600">{formatCurrency(stats.totalPaid)}</p>
            </div>
            <div className="bg-white p-6 rounded-[1.5rem] border border-slate-50 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{t.pendingCollection}</p>
                <p className="text-xl font-black text-amber-500">{formatCurrency(stats.totalUpcoming)}</p>
            </div>
            <div className="bg-white p-6 rounded-[1.5rem] border border-slate-50 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Total {t.late}</p>
                <p className="text-xl font-black text-red-500">{formatCurrency(stats.totalLate)}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-300" />
              <input 
                type="text" 
                placeholder={t.searchClients} 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-[1.5rem] shadow-sm focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm font-medium text-slate-600"
              />
            </div>
            <div className="flex items-center gap-2 bg-white px-4 py-2 border border-slate-100 rounded-[1.5rem] shadow-sm">
                <Filter className="size-4 text-slate-400" />
                <select 
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-transparent border-none outline-none text-xs font-bold text-slate-500 uppercase tracking-widest cursor-pointer focus:ring-0"
                >
                    <option value="all">{t.filterByStatus}</option>
                    <option value="upcoming">{t.upcoming}</option>
                    <option value="paid">{t.paid}</option>
                    <option value="late">{t.late}</option>
                </select>
            </div>
          </div>

          {/* Installments Table */}
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-400">{t.clientName}</th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-400">{t.dueDate}</th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-400">{t.amount}</th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-400">{t.status}</th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">{t.action}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={5} className="px-6 py-8"><div className="h-4 bg-slate-100 rounded w-1/3"></div></td>
                      </tr>
                    ))
                  ) : filteredInstallments.length === 0 ? (
                    <tr>
                        <td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-medium">
                            {t.noInstallments}
                        </td>
                    </tr>
                  ) : (
                    filteredInstallments.map((inst) => (
                      <tr key={inst.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                                <User className="size-4 text-emerald-600" />
                            </div>
                            <span className="text-sm font-bold text-slate-900 truncate">
                                {inst.loans?.clients?.full_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                            <Calendar className="size-3.5 text-slate-300" />
                            {formatDate(inst.due_date)}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm font-black text-slate-900">{formatCurrency(inst.amount)}</span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                             {inst.status === 'paid' && <CheckCircle2 className="size-3.5 text-emerald-500" />}
                             {inst.status === 'late' && <XCircle className="size-3.5 text-red-500" />}
                             {inst.status === 'upcoming' && <Clock className="size-3.5 text-amber-500" />}
                             <span className={cn(
                                "text-[10px] font-bold uppercase tracking-wider",
                                inst.status === 'paid' ? "text-emerald-600" :
                                inst.status === 'upcoming' ? "text-amber-600" : "text-red-600"
                              )}>
                                {t[inst.status]}
                              </span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {inst.status !== 'paid' && (
                              <button 
                                onClick={() => handleMarkAsPaid(inst.id)}
                                className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-md shadow-emerald-100 hover:bg-emerald-600 transition-all active:scale-95"
                              >
                                {t.markAsPaid}
                              </button>
                            )}
                            <div className="flex gap-1 opacity-10 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleOpenModal(inst)} className="p-2 text-slate-400 hover:text-emerald-500 transition-colors">
                                <Edit2 className="size-4" />
                              </button>
                              <button onClick={() => handleDelete(inst.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                                <Trash2 className="size-4" />
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
      </main>

      {/* Payment/Installment Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
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
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white"
            >
              <div className="p-8 lg:p-10">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
                    {editingInstallment ? t.editInstallment || 'Edit Installment' : t.addPayment || 'Add Payment'}
                  </h3>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600">
                    <X className="size-6" />
                  </button>
                </div>

                {formError && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-medium">
                    <AlertCircle className="size-5 shrink-0" />
                    {formError}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.loanDetails}</label>
                    <select 
                      required
                      disabled={!!editingInstallment}
                      value={formData.loan_id}
                      onChange={e => setFormData({...formData, loan_id: e.target.value})}
                      className="w-full px-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-slate-900 transition-all appearance-none cursor-pointer disabled:opacity-50"
                    >
                      <option value="">{t.selectLoan || 'Select Loan'}</option>
                      {loans.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.clients?.full_name} - {l.id.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.amount}</label>
                      <input 
                        type="number"
                        required
                        value={formData.amount}
                        onChange={e => setFormData({...formData, amount: Number(e.target.value)})}
                        className="w-full px-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-slate-900 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.status}</label>
                      <select 
                        value={formData.status}
                        onChange={e => setFormData({...formData, status: e.target.value as any})}
                        className="w-full px-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-slate-900 transition-all appearance-none cursor-pointer"
                      >
                        <option value="upcoming">{t.upcoming}</option>
                        <option value="paid">{t.paid}</option>
                        <option value="late">{t.late}</option>
                        <option value="missed">{t.missed}</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.dueDate}</label>
                    <input 
                      type="date"
                      required
                      value={formData.due_date}
                      onChange={e => setFormData({...formData, due_date: e.target.value})}
                      className="w-full px-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-slate-900 transition-all"
                    />
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 px-6 py-4 bg-slate-50 text-slate-500 font-bold rounded-2xl hover:bg-slate-100 transition-all uppercase tracking-widest text-xs"
                    >
                      {t.cancel}
                    </button>
                    <button 
                      type="submit"
                      disabled={formLoading}
                      className="flex-3 px-10 py-4 bg-emerald-500 text-white font-black rounded-2xl hover:bg-emerald-600 shadow-lg shadow-emerald-200 transition-all active:scale-[0.98] disabled:opacity-50 uppercase tracking-[0.15em] text-xs"
                    >
                      {formLoading ? t.processing : t.save}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Wallet Selection Modal */}
      <AnimatePresence>
        {isWalletModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsWalletModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-white rounded-[2rem] p-8 shadow-2xl"
            >
              <h3 className="text-lg font-black text-slate-900 mb-6">{t.selectWallet}</h3>
              <div className="space-y-3 mb-8">
                {wallets.map(w => (
                  <button
                    key={w.id}
                    onClick={() => setSelectedWalletId(w.id)}
                    className={cn(
                      "w-full p-4 rounded-2xl flex items-center justify-between border-2 transition-all",
                      selectedWalletId === w.id ? "bg-emerald-50 border-emerald-500 text-emerald-600" : "bg-slate-50 border-transparent text-slate-500"
                    )}
                  >
                    <div className="flex items-center gap-3 font-bold text-sm">
                      <Wallet className="size-4" />
                      {w.name}
                    </div>
                    {selectedWalletId === w.id && <CheckCircle2 className="size-4" />}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                 <button onClick={() => setIsWalletModalOpen(false)} className="flex-1 py-3 text-xs font-bold uppercase text-slate-400">{t.cancel}</button>
                 <button 
                  onClick={confirmPayment}
                  disabled={!selectedWalletId || formLoading}
                  className="flex-2 py-3 bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-50"
                 >
                   {formLoading ? t.processing : t.confirmPayment}
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
