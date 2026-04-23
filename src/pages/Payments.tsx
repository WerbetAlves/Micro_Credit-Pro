import React, { useState, useEffect } from 'react';
import { Search, Wallet, Calendar, CheckCircle2, Filter, User, MoreVertical, Plus, Edit2, Trash2, X, AlertCircle } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { parseAppDate } from '../lib/date';
import { getInstallmentDisplayStatus, getTodayLocal } from '../lib/installments';

interface Installment {
  id: string;
  loan_id: string;
  due_date: string;
  amount: number;
  status: 'upcoming' | 'paid' | 'late' | 'missed';
  created_at: string;
  loans?: {
    id?: string;
    client_id?: string;
    clients?: {
      full_name: string;
      phone: string;
    };
  };
}

type InstallmentStatus = 'upcoming' | 'paid' | 'late' | 'missed';

export function Payments() {
  const { t, formatCurrency, formatDate } = useLanguage();
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loans, setLoans] = useState<{ id: string; client_id: string; clients?: { full_name: string } }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInstallment, setEditingInstallment] = useState<Installment | null>(null);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [wallets, setWallets] = useState<{ id: string; name: string }[]>([]);
  const [paymentReceivedTotal, setPaymentReceivedTotal] = useState(0);
  const [installmentToPay, setInstallmentToPay] = useState<string | null>(null);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    loan_id: string;
    due_date: string;
    amount: number;
    status: InstallmentStatus;
  }>({
    loan_id: '',
    due_date: new Date().toISOString().split('T')[0],
    amount: 0,
    status: 'upcoming',
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
    else setWallets([{ id: 'default', name: t.mainPortfolio }]);
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
      const { data, error } = await supabase
        .from('installments')
        .select(`
          *,
          loans!inner (
            id,
            user_id,
            client_id,
            clients (
              full_name,
              phone
            )
          )
        `)
        .eq('loans.user_id', user.id)
        .order('due_date', { ascending: true });

      if (error) throw error;

      setInstallments(data || []);

      const { data: paymentTransactions } = await supabase
        .from('transactions')
        .select('amount, category, type')
        .eq('user_id', user.id)
        .eq('category', 'payment_received')
        .eq('type', 'income');

      setPaymentReceivedTotal(
        (paymentTransactions || []).reduce((acc: number, transaction: any) => acc + Number(transaction.amount || 0), 0)
      );
    } catch (err: any) {
      console.error('Error fetching installments:', err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleMarkAsPaid = async (id: string) => {
    const inst = installments.find((i) => i.id === id);
    if (inst) {
      setPaidAmount(inst.amount);
      setInstallmentToPay(id);
      setIsWalletModalOpen(true);
    }
  };

  const confirmPayment = async () => {
    if (!installmentToPay || !user) return;

    setFormLoading(true);
    try {
      const { data: inst } = await supabase
        .from('installments')
        .select('amount, status, loans(id, client_id, clients(full_name))')
        .eq('id', installmentToPay)
        .single();

      if (!inst) throw new Error('Installment not found');

      const isPartial = paidAmount < inst.amount;
      const remaining = inst.amount - paidAmount;

      if (isPartial) {
        await supabase
          .from('installments')
          .update({
            amount: remaining,
            status: remaining <= 0 ? 'paid' : 'late',
          })
          .eq('id', installmentToPay);
      } else {
        await supabase
          .from('installments')
          .update({ status: 'paid' })
          .eq('id', installmentToPay);
      }

      const loan: any = inst.loans;
      await supabase.from('transactions').insert({
        user_id: user.id,
        client_id: loan?.client_id,
        loan_id: loan?.id,
        wallet_id: selectedWalletId === 'default' ? null : selectedWalletId,
        type: 'income',
        category: 'payment_received',
        amount: paidAmount,
        description: `${isPartial ? t.partialPayment : t.fullPayment} - ${loan?.clients?.full_name || ''}`,
      });

      if (selectedWalletId && selectedWalletId !== 'default') {
        const { data: currWallet } = await supabase
          .from('wallets')
          .select('balance')
          .eq('id', selectedWalletId)
          .single();

        if (currWallet) {
          await supabase
            .from('wallets')
            .update({ balance: Number(currWallet.balance) + Number(paidAmount) })
            .eq('id', selectedWalletId);
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
        status: getInstallmentDisplayStatus(inst),
      });
    } else {
      setEditingInstallment(null);
      setFormData({
        loan_id: '',
        due_date: new Date().toISOString().split('T')[0],
        amount: 0,
        status: 'upcoming',
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

  const getInstallmentOrder = (inst: Installment) => {
    const loanInstallments = installments
      .filter((i) => i.loan_id === inst.loan_id)
      .sort((a, b) => parseAppDate(a.due_date).getTime() - parseAppDate(b.due_date).getTime());

    const index = loanInstallments.findIndex((i) => i.id === inst.id);
    return {
      current: index + 1,
      total: loanInstallments.length,
    };
  };

  const handleWhatsApp = (inst: Installment) => {
    const rawPhone = inst.loans?.clients?.phone || '';
    const phone = rawPhone.replace(/\D/g, '');
    if (!phone) {
      alert('Este cliente não possui telefone cadastrado.');
      return;
    }

    const normalizedPhone = phone.startsWith('55') ? phone : `55${phone}`;
    const { current, total } = getInstallmentOrder(inst);
    const message = encodeURIComponent(
      `Olá ${inst.loans?.clients?.full_name}! 👋\n\nSou do financeiro da EmeraldPro. Estou entrando em contato sobre a parcela ${current}/${total} do seu empréstimo, que venceu/vencerá no dia ${formatDate(inst.due_date)}.\n\nValor: ${formatCurrency(inst.amount)}\n\nComo podemos prosseguir com o pagamento hoje?`
    );

    window.open(`https://wa.me/${normalizedPhone}?text=${message}`, '_blank');
  };

  const filteredInstallments = installments.filter((inst) => {
    const clientName = inst.loans?.clients?.full_name || '';
    const displayStatus = getInstallmentDisplayStatus(inst);
    const matchesSearch = clientName.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterStatus === 'all' || displayStatus === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    totalPaid: paymentReceivedTotal,
    totalUpcoming: installments
      .filter((i) => getInstallmentDisplayStatus(i) === 'upcoming')
      .reduce((acc, i) => acc + Number(i.amount), 0),
    totalLate: installments
      .filter((i) => getInstallmentDisplayStatus(i) === 'late')
      .reduce((acc, i) => acc + Number(i.amount), 0),
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
            <span className="hidden sm:inline">{t.addPayment}</span>
          </button>
        </header>

        <div className="px-4 lg:px-8 py-8 w-full">
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
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{t.total} {t.late}</p>
              <p className="text-xl font-black text-red-500">{formatCurrency(stats.totalLate)}</p>
            </div>
          </div>

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

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-50 animate-pulse">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-slate-100 rounded w-1/2" />
                      <div className="h-3 bg-slate-100 rounded w-1/3" />
                    </div>
                  </div>
                  <div className="h-10 bg-slate-100 rounded-xl" />
                </div>
              ))}
            </div>
          ) : filteredInstallments.length === 0 ? (
            <div className="bg-white rounded-[2rem] p-20 text-center border border-slate-50">
              <Calendar className="size-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 font-medium">{t.noInstallments}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredInstallments.map((inst) => {
                const { current, total } = getInstallmentOrder(inst);
                const displayStatus = getInstallmentDisplayStatus(inst);

                return (
                  <motion.div
                    key={inst.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-50 hover:shadow-xl hover:shadow-slate-100/50 transition-all group"
                  >
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
                          <User className="size-6 text-emerald-600" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 truncate max-w-[150px]">
                            {inst.loans?.clients?.full_name}
                          </h4>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {t.installment} {current} {t.of} {total}
                          </span>
                        </div>
                      </div>
                      <div
                        className={cn(
                          'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest',
                          displayStatus === 'paid'
                            ? 'bg-emerald-50 text-emerald-600'
                            : displayStatus === 'upcoming'
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-red-50 text-red-600'
                        )}
                      >
                        {t[displayStatus]}
                      </div>
                    </div>

                    <div className="space-y-4 mb-6">
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.amount}</span>
                        <span className="text-lg font-black text-slate-900">{formatCurrency(inst.amount)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-500 text-xs font-bold px-1 uppercase tracking-widest">
                        <Calendar className="size-4 text-slate-300" />
                        {t.dueDate}: {formatDate(inst.due_date)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {displayStatus !== 'paid' ? (
                        <button
                          onClick={() => handleMarkAsPaid(inst.id)}
                          className="flex-1 py-3 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.15em] shadow-lg shadow-emerald-100 hover:bg-emerald-600 transition-all active:scale-[0.98]"
                        >
                          {t.markAsPaid}
                        </button>
                      ) : (
                        <div className="flex-1 py-3 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2">
                          <CheckCircle2 className="size-3" />
                          {t.paid}
                        </div>
                      )}

                      <button
                        onClick={() => handleWhatsApp(inst)}
                        className="p-3 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-all"
                        title="Contact via WhatsApp"
                      >
                        <svg className="size-5 fill-current" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.412.247-.694.247-1.289.173-1.412-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.393 0 12.029c0 2.119.554 4.187 1.605 6.006L0 24l6.117-1.605a11.79 11.79 0 005.925 1.588h.005c6.632 0 12.031-5.391 12.036-12.029a11.85 11.85 0 00-3.527-8.513z" />
                        </svg>
                      </button>

                      <div className="relative group/menu">
                        <button className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-emerald-500 transition-all">
                          <MoreVertical className="size-4" />
                        </button>
                        <div className="absolute right-0 bottom-full mb-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-20 overflow-hidden">
                          <button
                            onClick={() => handleOpenModal(inst)}
                            className="w-full px-4 py-3 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Edit2 className="size-3.5" /> {t.edit}
                          </button>
                          <button
                            onClick={() => handleDelete(inst.id)}
                            className="w-full px-4 py-3 text-left text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2 border-t border-slate-50"
                          >
                            <Trash2 className="size-3.5" /> {t.delete}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>

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
                      onChange={(e) => setFormData({ ...formData, loan_id: e.target.value })}
                      className="w-full px-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-slate-900 transition-all appearance-none cursor-pointer disabled:opacity-50"
                    >
                      <option value="">{t.selectLoan || 'Select Loan'}</option>
                      {loans.map((l) => (
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
                        onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                        className="w-full px-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-slate-900 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.status}</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as InstallmentStatus })}
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
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
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

              <div className="space-y-4 mb-6">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">{t.receivedAmount}</label>
                  <input
                    type="number"
                    value={paidAmount || ''}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                    className="w-full bg-transparent border-none outline-none text-lg font-black text-slate-900"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.wallets}</label>
                  <div className="space-y-2">
                    {wallets.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => setSelectedWalletId(w.id)}
                        className={cn(
                          'w-full p-4 rounded-2xl flex items-center justify-between border-2 transition-all',
                          selectedWalletId === w.id
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-600'
                            : 'bg-white border-slate-100 text-slate-500 hove:border-slate-200'
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
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setIsWalletModalOpen(false)} className="flex-1 py-3 text-xs font-bold uppercase text-slate-400">
                  {t.cancel}
                </button>
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
