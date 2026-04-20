import React, { useState, useEffect } from 'react';
import { Plus, Landmark, MoreVertical, Edit2, Trash2, X, AlertCircle, User, Filter, FileText, CheckCircle, ExternalLink, Send } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import Markdown from 'react-markdown';

// --- CONFIGURAÇÃO DE LIMITES DO SAAS ---
const PLAN_LIMITS = {
  free: { maxLoans: 3, label: 'Gratuito' },
  pro: { maxLoans: 50, label: 'Profissional' },
  enterprise: { maxLoans: 999999, label: 'Enterprise' },
};

interface Loan {
  id: string;
  user_id: string;
  client_id: string;
  principal_amount: number;
  interest_rate: number;
  interest_type: 'annual' | 'monthly';
  term_months: number;
  payment_frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  payment_days: string[];
  first_installment_date: string;
  due_date: string;
  category: string;
  notes: string;
  status: 'pending' | 'active' | 'repaid' | 'default';
  monthly_installment: number;
  total_repayment: number;
  created_at: string;
  guarantee_info?: any;
  contract_content?: string;
  legal_validation_status?: 'not_validated' | 'validated';
  sent_to_client?: boolean;
  clients?: {
    full_name: string;
  };
}

interface Client {
  id: string;
  full_name: string;
}

export function Loans() {
  const { t, formatCurrency, formatDate } = useLanguage();
  const { user, profile } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(''); // 🔥 Estado da pesquisa
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [selectedLoanForContract, setSelectedLoanForContract] = useState<Loan | null>(null);
  const [isValidatingContract, setIsValidatingContract] = useState(false);

  const [formData, setFormData] = useState<{
    client_id: string;
    principal_amount: number;
    interest_rate: number;
    interest_type: 'annual' | 'monthly';
    term_months: number;
    payment_frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    payment_days: string[];
    first_installment_date: string;
    due_date: string;
    category: string;
    notes: string;
    status: 'pending' | 'active' | 'repaid' | 'default';
  }>({
    client_id: '',
    principal_amount: 15000,
    interest_rate: 4.25,
    interest_type: 'monthly',
    term_months: 12,
    payment_frequency: 'monthly',
    payment_days: [],
    first_installment_date: new Date().toISOString().split('T')[0],
    due_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
    category: 'Microcrédito',
    notes: '',
    status: 'pending'
  });

  useEffect(() => {
    if (user) {
      fetchLoans();
      fetchClients();
    }
  }, [user]);

  const handleValidateContract = async (loanId: string) => {
    setIsValidatingContract(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    try {
      await supabase.from('loans').update({ legal_validation_status: 'validated' }).eq('id', loanId);
      if (selectedLoanForContract?.id === loanId) {
        setSelectedLoanForContract(prev => prev ? { ...prev, legal_validation_status: 'validated' } : null);
      }
      fetchLoans();
    } catch (err) {
      console.error("Error validating contract:", err);
    } finally {
      setIsValidatingContract(false);
    }
  };

  async function fetchClients() {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, full_name')
        .eq('user_id', user.id)
        .order('full_name');
      if (error) throw error;
      setClients(data || []);
    } catch (err: any) {
      console.error('Error fetching clients for loans:', err.message);
    }
  }

  async function fetchLoans() {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('loans')
        .select(`
          *,
          clients (
            full_name
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLoans(data || []);
    } catch (err: any) {
      console.error('Error fetching loans:', err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleOpenModal = (loan?: Loan) => {
    if (loan) {
      setEditingLoan(loan);
      setFormData({
        client_id: loan.client_id,
        principal_amount: loan.principal_amount,
        interest_rate: loan.interest_rate,
        interest_type: loan.interest_type || 'annual',
        term_months: loan.term_months,
        payment_frequency: loan.payment_frequency || 'monthly',
        payment_days: loan.payment_days || [],
        first_installment_date: loan.first_installment_date || new Date().toISOString().split('T')[0],
        due_date: loan.due_date || new Date().toISOString().split('T')[0],
        category: loan.category || 'Microcrédito',
        notes: loan.notes || '',
        status: loan.status
      });
    } else {
      const userPlan = profile?.plan_type || 'free';
      const limit = PLAN_LIMITS[userPlan as keyof typeof PLAN_LIMITS].maxLoans;

      if (loans.length >= limit) {
        alert(
          `Limite atingido! O seu plano ${PLAN_LIMITS[userPlan as keyof typeof PLAN_LIMITS].label} permite apenas ${limit} empréstimos criados.\n\nFaça upgrade para conceder empréstimos ilimitados!`
        );
        return;
      }

      setEditingLoan(null);
      setFormData({
        client_id: '',
        principal_amount: 15000,
        interest_rate: 4.25,
        interest_type: 'monthly',
        term_months: 12,
        payment_frequency: 'monthly',
        payment_days: [],
        first_installment_date: new Date().toISOString().split('T')[0],
        due_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
        category: 'Microcrédito',
        notes: '',
        status: 'pending'
      });
    }
    setFormError(null);
    setIsModalOpen(true);
  };

  const calculateLoan = (principal: number, rate: number, term: number, type: 'annual' | 'monthly', frequency: string = 'monthly') => {
    if (!principal || !term || isNaN(principal) || isNaN(term)) {
      return { totalRepay: 0, monthlyInstal: 0 };
    }

    let interestFactor = 0;
    const baseRate = type === 'monthly' ? rate : rate / 12;

    if (frequency === 'monthly') {
      interestFactor = (baseRate / 100) * term;
    } else if (frequency === 'daily') {
      interestFactor = (baseRate / 30 / 100) * term;
    } else if (frequency === 'weekly') {
      interestFactor = (baseRate / 4 / 100) * term;
    } else if (frequency === 'biweekly') {
      interestFactor = (baseRate / 2 / 100) * term;
    }

    const totalRepay = principal + (principal * interestFactor);
    const monthlyInstal = totalRepay / term;
    return { totalRepay, monthlyInstal };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFormLoading(true);
    setFormError(null);

    const { totalRepay, monthlyInstal } = calculateLoan(
      formData.principal_amount, 
      formData.interest_rate, 
      formData.term_months,
      formData.interest_type,
      formData.payment_frequency
    );

    const loanData = {
      ...formData,
      user_id: user.id,
      monthly_installment: monthlyInstal,
      total_repayment: totalRepay
    };

    try {
      if (editingLoan) {
        const { error } = await supabase
          .from('loans')
          .update(loanData)
          .eq('id', editingLoan.id);
        if (error) throw error;
      } else {
        const { data: newLoan, error } = await supabase
          .from('loans')
          .insert([loanData])
          .select()
          .single();
        if (error) throw error;

        if (newLoan) {
          await supabase.from('transactions').insert({
            user_id: user.id,
            client_id: newLoan.client_id,
            loan_id: newLoan.id,
            type: 'expense',
            category: 'loan_disbursement',
            amount: newLoan.principal_amount,
            description: `Empréstimo concedido: ${newLoan.id.split('-')[0]}`
          });

          const installmentsList = [];
          let currentDate = new Date(formData.due_date);
          let installmentsCreated = 0;
          const numDuration = formData.term_months;
          const frequency = formData.payment_frequency;
          const paymentDays = formData.payment_days;

          while (installmentsCreated < numDuration) {
            let isPaymentDay = true;
            if (frequency === 'daily' && paymentDays.length > 0) {
              const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][currentDate.getDay()];
              isPaymentDay = paymentDays.includes(dayName);
            }

            if (isPaymentDay) {
              installmentsList.push({
                loan_id: newLoan.id,
                amount: monthlyInstal,
                due_date: currentDate.toISOString().split('T')[0],
                status: 'upcoming'
              });
              installmentsCreated++;
            }

            if (installmentsCreated >= numDuration) break;

            if (frequency === 'monthly') {
              currentDate.setMonth(currentDate.getMonth() + 1);
            } else if (frequency === 'daily') {
              currentDate.setDate(currentDate.getDate() + 1);
            } else if (frequency === 'weekly') {
              currentDate.setDate(currentDate.getDate() + 7);
            } else {
              currentDate.setDate(currentDate.getDate() + 15);
            }
          }

          if (installmentsList.length > 0) {
            await supabase.from('installments').insert(installmentsList);
          }
        }
      }

      setIsModalOpen(false);
      fetchLoans();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t.confirmDeleteLoan)) return;
    
    try {
      const { error } = await supabase
        .from('loans')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      fetchLoans();
    } catch (err: any) {
      console.error('Error deleting loan:', err.message);
    }
  };

  // 🔥 Lógica de filtragem funcional
  const filteredLoans = loans.filter(l => {
    const matchesSearch = l.clients?.full_name?.toLowerCase().includes(search.toLowerCase()) || 
                         l.id.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterStatus === 'all' || l.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex min-h-screen bg-[#f8fafc] overflow-x-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="flex-1 lg:ml-72 min-h-screen pb-20 w-full transition-all duration-300">
        {/* 🔥 Header agora recebe as props da pesquisa */}
        <Header 
          title={t.loanList} 
          onMenuClick={() => setIsSidebarOpen(true)}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t.searchClients}
        >
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-primary-200 hover:bg-primary-600 transition-all active:scale-95"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">{t.addLoan}</span>
          </button>
        </Header>

        <div className="px-4 lg:px-8 py-8 w-full transition-all">
          {/* Filters & Plan Indicator */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            {/* 🔥 Removida a barra de pesquisa redundante daqui, pois agora está no Header */}
            
            {/* Indicador do Plano */}
            <div className="px-6 py-4 bg-white rounded-[1.5rem] border border-slate-100 flex items-center gap-3">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                 Plano: {profile?.plan_type || 'A carregar...'}
               </span>
            </div>

            <div className="flex items-center gap-2 bg-white px-4 py-2 border border-slate-100 rounded-[1.5rem] shadow-sm ml-auto">
                <Filter className="size-4 text-slate-400" />
                <select 
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-transparent border-none outline-none text-xs font-bold text-slate-500 uppercase tracking-widest cursor-pointer focus:ring-0"
                >
                    <option value="all">{t.allClients}</option>
                    <option value="pending">{t.pending}</option>
                    <option value="active">{t.active}</option>
                    <option value="repaid">{t.repaid}</option>
                    <option value="default">{t.default}</option>
                </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
                {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-[2rem] p-8 animate-pulse border border-slate-50 shadow-sm h-64" />
                    ))
                ) : filteredLoans.length === 0 ? (
                    <div className="col-span-full py-20 bg-white rounded-[2rem] border border-slate-50 border-dashed text-center">
                        <p className="text-slate-400 font-medium">{t.noInstallments}</p>
                    </div>
                ) : (
                    filteredLoans.map((loan) => (
                        <motion.div
                            key={loan.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-[2rem] p-6 lg:p-8 border border-slate-50 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group relative overflow-hidden"
                        >
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                                            <User className="size-5 text-emerald-600" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors uppercase tracking-tight text-sm">
                                                {loan.clients?.full_name}
                                            </h4>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{formatDate(loan.created_at)}</p>
                                        </div>
                                    </div>
                                    <span className={cn(
                                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                        loan.status === 'active' ? "bg-emerald-50 text-emerald-600" :
                                        loan.status === 'pending' ? "bg-amber-50 text-amber-600" :
                                        loan.status === 'repaid' ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600"
                                    )}>
                                        {t[loan.status as keyof typeof t] || loan.status}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t.principalAmount}</p>
                                        <p className="text-lg font-black text-slate-900">{formatCurrency(loan.principal_amount)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t.monthlyInstallment}</p>
                                        <p className="text-lg font-black text-emerald-600">{formatCurrency(loan.monthly_installment)}</p>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-slate-50 flex justify-between items-center bg-slate-50/50 -mx-6 lg:-mx-8 px-8 -mb-6 lg:-mb-8 py-4 mt-2">
                                    <div className="flex flex-col">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                            {loan.term_months} {t.months} @ {loan.interest_rate}% ({loan.interest_type === 'monthly' ? t.monthly : t.annual})
                                        </p>
                                    </div>
                                    <div className="flex gap-1">
                                        <button 
                                          onClick={() => {
                                            setSelectedLoanForContract(loan);
                                            setIsContractModalOpen(true);
                                          }}
                                          className="p-2 text-slate-300 hover:text-primary-500 transition-colors"
                                          title="Ver Contrato"
                                        >
                                            <FileText className="size-4" />
                                        </button>
                                        <button onClick={() => handleOpenModal(loan)} className="p-2 text-slate-300 hover:text-emerald-500 transition-colors">
                                            <Edit2 className="size-4" />
                                        </button>
                                        <button onClick={() => handleDelete(loan.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                                            <Trash2 className="size-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <Landmark className="absolute -bottom-4 -right-4 size-24 opacity-5 rotate-12 group-hover:scale-110 transition-transform" />
                        </motion.div>
                    ))
                )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Loan Modal */}
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
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden shadow-emerald-900/10 border border-white max-h-[90vh] overflow-y-auto"
            >
              <div className="p-8 lg:p-10">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
                    {editingLoan ? t.editLoan : t.addLoan}
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
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.clientName}</label>
                    <select 
                      required
                      value={formData.client_id}
                      onChange={e => setFormData({...formData, client_id: e.target.value})}
                      className="w-full px-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-slate-900 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">{t.searchClients}</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.full_name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.principalAmount}</label>
                      <input 
                        type="number"
                        required
                        value={formData.principal_amount || ''}
                        onFocus={e => (e.target as HTMLInputElement).select()}
                        onChange={e => setFormData({...formData, principal_amount: Number(e.target.value)})}
                        className="w-full px-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-slate-900 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.loanStatus}</label>
                      <select 
                        value={formData.status}
                        onChange={e => setFormData({...formData, status: e.target.value as any})}
                        className="w-full px-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-slate-900 transition-all appearance-none cursor-pointer"
                      >
                        <option value="pending">{t.pending}</option>
                        <option value="active">{t.active}</option>
                        <option value="repaid">{t.repaid}</option>
                        <option value="default">{t.default}</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.interestRate} (%)</label>
                      <input 
                        type="number"
                        step="0.01"
                        required
                        value={formData.interest_rate || ''}
                        onFocus={e => (e.target as HTMLInputElement).select()}
                        onChange={e => setFormData({...formData, interest_rate: Number(e.target.value)})}
                        className="w-full px-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-slate-900 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.interestPeriod}</label>
                      <select 
                        value={formData.interest_type}
                        onChange={e => setFormData({...formData, interest_type: e.target.value as any})}
                        className="w-full px-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-slate-900 transition-all appearance-none cursor-pointer"
                      >
                        <option value="monthly">{t.monthly}</option>
                        <option value="annual">{t.annual}</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.term} ({t.months})</label>
                       <div className="flex gap-2">
                         <input 
                           type="number"
                           min="1"
                           max="120"
                           required
                           value={formData.term_months || ''}
                           onFocus={e => (e.target as HTMLInputElement).select()}
                           onChange={e => setFormData({...formData, term_months: Number(e.target.value)})}
                           className="flex-1 px-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-slate-900 transition-all"
                         />
                       </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.category}</label>
                      <select 
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value})}
                        className="w-full px-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-slate-900 transition-all appearance-none cursor-pointer"
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.paymentFrequency}</label>
                      <select 
                        required
                        value={formData.payment_frequency}
                        onChange={e => setFormData({...formData, payment_frequency: e.target.value as any})}
                        className="w-full px-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-bold text-slate-900 transition-all appearance-none cursor-pointer"
                      >
                        <option value="daily">{t.daily}</option>
                        <option value="weekly">{t.weekly}</option>
                        <option value="biweekly">{t.biweekly}</option>
                        <option value="monthly">{t.monthly_f}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.loanStatus}</label>
                      <select 
                        value={formData.status}
                        onChange={e => setFormData({...formData, status: e.target.value as any})}
                        className="w-full px-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-slate-900 transition-all appearance-none cursor-pointer"
                      >
                        <option value="pending">{t.pending}</option>
                        <option value="active">{t.active}</option>
                        <option value="repaid">{t.repaid}</option>
                        <option value="default">{t.default}</option>
                      </select>
                    </div>
                  </div>

                  {(formData.payment_frequency === 'daily' || formData.payment_frequency === 'weekly' || formData.payment_frequency === 'biweekly') && (
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.selectDays}</label>
                      <div className="flex flex-wrap gap-2">
                        {['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map(day => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              if (formData.payment_frequency === 'daily') {
                                const days = formData.payment_days.includes(day)
                                  ? formData.payment_days.filter(d => d !== day)
                                  : [...formData.payment_days, day];
                                setFormData({ ...formData, payment_days: days });
                              } else {
                                setFormData({ ...formData, payment_days: [day] });
                              }
                            }}
                            className={cn(
                              "px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all text-center min-w-[50px]",
                              formData.payment_days.includes(day)
                                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200"
                                : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                            )}
                          >
                            {t[day as keyof typeof t] || day}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.startDate}</label>
                       <input 
                         type="date"
                         required
                         value={formData.first_installment_date}
                         onChange={e => setFormData({...formData, first_installment_date: e.target.value})}
                         className="w-full px-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-slate-900 transition-all"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.firstInstallmentDue}</label>
                       <input 
                         type="date"
                         required
                         value={formData.due_date}
                         onChange={e => setFormData({...formData, due_date: e.target.value})}
                         className="w-full px-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-slate-900 transition-all"
                       />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.observations}</label>
                    <textarea 
                      value={formData.notes}
                      onChange={e => setFormData({...formData, notes: e.target.value})}
                      className="w-full px-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-slate-900 transition-all min-h-[80px] resize-none"
                      placeholder="..."
                    />
                  </div>

                  <div className="p-6 bg-slate-900 rounded-3xl text-white">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">{t.monthlyInstallment}</span>
                        <span className="text-xl font-black text-emerald-400">
                            {formatCurrency(calculateLoan(formData.principal_amount, formData.interest_rate, formData.term_months, formData.interest_type, formData.payment_frequency).monthlyInstal)}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">{t.totalRepayment}</span>
                        <span className="text-sm font-bold">
                            {formatCurrency(calculateLoan(formData.principal_amount, formData.interest_rate, formData.term_months, formData.interest_type, formData.payment_frequency).totalRepay)}
                        </span>
                    </div>
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

      {/* Contract View/Validation Modal */}
      <AnimatePresence>
        {isContractModalOpen && selectedLoanForContract && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsContractModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-white"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                    <FileText className="size-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                      {t.loanContract}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      ID: {selectedLoanForContract.id.split('-')[0]} • {selectedLoanForContract.clients?.full_name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   {selectedLoanForContract.legal_validation_status === 'validated' && (
                     <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                       <CheckCircle className="size-3" />
                       {t.legallyValidated}
                     </div>
                   )}
                   {selectedLoanForContract.sent_to_client && (
                     <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">
                       <Send className="size-3" />
                       {t.sentToClient}
                     </div>
                   )}
                   <button onClick={() => setIsContractModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600">
                     <X className="size-6" />
                   </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-8 lg:p-12 bg-slate-50/50">
                <div className="bg-white p-10 lg:p-16 rounded-[2rem] shadow-sm border border-slate-100 max-w-3xl mx-auto min-h-[1000px]">
                  <div className="prose prose-slate prose-sm sm:prose-base max-w-none">
                    <Markdown>{selectedLoanForContract.contract_content || t.processing}</Markdown>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-6 border-t border-slate-100 bg-white flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-4">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest max-w-[200px]">
                    {t.contractAiNotice}
                  </p>
                </div>
                
                <div className="flex gap-3 w-full sm:w-auto">
                   <button 
                    onClick={() => handleValidateContract(selectedLoanForContract!.id)}
                    disabled={isValidatingContract || selectedLoanForContract!.legal_validation_status === 'validated'}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50"
                  >
                    {isValidatingContract ? (
                      t.validating
                    ) : selectedLoanForContract!.legal_validation_status === 'validated' ? (
                      <>
                        <CheckCircle className="size-4" />
                        {t.validated}
                      </>
                    ) : (
                      <>
                        <Landmark className="size-4" />
                        {t.validateLegally}
                      </>
                    )}
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all"
                  >
                    <ExternalLink className="size-4" />
                    {t.exportPdf}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}