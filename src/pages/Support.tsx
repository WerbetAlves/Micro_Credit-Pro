import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Search, 
  Filter, 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MoreVertical, 
  User, 
  Tag, 
  MessageSquareText, 
  Bot,
  ArrowRight
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { AIAssistantDashboard } from '../components/AIAssistantDashboard';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  category: 'technical' | 'billing' | 'feature' | 'other';
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

export function Support() {
  const { t, formatCurrency, formatDate } = useLanguage();
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    priority: 'medium' as const,
    category: 'technical' as const
  });

  useEffect(() => {
    fetchTickets();
  }, [user]);

  async function fetchTickets() {
    if (!user) return;
    setLoading(true);
    try {
      // Robust role check for both user object and metadata
      const isAdmin = (user as any).role === 'admin' || user.user_metadata?.role === 'admin';
      
      let query = supabase
        .from('support_tickets')
        .select(`
          *,
          profiles:user_id (
            full_name,
            email
          )
        `);
      
      if (!isAdmin) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (err: any) {
      console.error('Error fetching tickets:', err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFormLoading(true);
    setFormError(null);

    try {
      const { error } = await supabase.from('support_tickets').insert([{
        user_id: user.id,
        ...formData,
        status: 'open'
      }]);

      if (error) throw error;
      
      setIsModalOpen(false);
      setFormData({
        subject: '',
        description: '',
        priority: 'medium',
        category: 'technical'
      });
      fetchTickets();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateStatus = async (ticketId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status: newStatus })
        .eq('id', ticketId);
      
      if (error) throw error;
      fetchTickets();
    } catch (err: any) {
      console.error('Error updating status:', err.message);
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.subject.toLowerCase().includes(search.toLowerCase()) || 
                          t.description.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <Clock className="size-4 text-amber-500" />;
      case 'in_progress': return <AlertCircle className="size-4 text-blue-500" />;
      case 'resolved': return <CheckCircle2 className="size-4 text-emerald-500" />;
      case 'closed': return <CheckCircle2 className="size-4 text-slate-400" />;
      default: return <Clock className="size-4 text-slate-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-50 text-red-600 border-red-100';
      case 'medium': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'low': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f8fafc] overflow-x-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="flex-1 lg:ml-72 min-h-screen pb-20 w-full transition-all duration-300">
        <Header title={t.supportCenter} onMenuClick={() => setIsSidebarOpen(true)}>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all active:scale-95"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">{t.openTicket}</span>
          </button>
        </Header>

        <div className="px-4 lg:px-8 py-8 w-full">
          {/* AI Banner */}
          <section className="mb-10">
            <div className="bg-slate-900 rounded-[2.5rem] p-8 lg:p-12 text-white relative overflow-hidden shadow-2xl">
              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-xl">
                      <Bot className="size-6 text-emerald-400" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-[0.3em] text-emerald-400">Emerald AI Intelligence</span>
                  </div>
                  <h2 className="text-3xl lg:text-4xl font-black tracking-tight leading-tight">
                    {t.talkToAiFirst.split('.')[0]}? <br/>
                    <span className="text-emerald-400">{t.talkToAiFirst.split('.')[1] || ''}</span>
                  </h2>
                  <p className="text-slate-400 font-medium text-lg leading-relaxed max-w-lg">
                    {t.aiSupportInstruction}
                  </p>
                  <div className="flex items-center gap-4 pt-4">
                    <button 
                      onClick={() => {
                        // In a real app we might open the floating assistant
                        const assistantBtn = document.querySelector('[data-assistant-trigger]');
                        if (assistantBtn instanceof HTMLElement) assistantBtn.click();
                      }}
                      className="bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:scale-105 transition-all active:scale-95 flex items-center gap-3"
                    >
                      <MessageSquareText className="size-4" />
                      {t.startConversation}
                    </button>
                  </div>
                </div>
                <div className="hidden lg:flex justify-end">
                   <div className="relative group">
                      <div className="absolute inset-0 bg-emerald-500/10 blur-[100px] rounded-full group-hover:bg-emerald-500/20 transition-all duration-1000" />
                      <div className="relative size-64 bg-slate-800 rounded-[3rem] border border-slate-700 p-8 flex flex-col justify-center gap-4">
                         <div className="size-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <Bot className="size-6 text-white" />
                         </div>
                         <div className="space-y-2">
                            <div className="h-2 w-32 bg-slate-700 rounded-full" />
                            <div className="h-2 w-24 bg-slate-700/50 rounded-full" />
                         </div>
                         <div className="pt-4 flex gap-2">
                            <div className="size-8 rounded-full bg-emerald-500/10 border border-emerald-500/20" />
                            <div className="size-8 rounded-full bg-emerald-500/10 border border-emerald-500/20" />
                            <div className="size-8 rounded-full bg-emerald-500/10 border border-emerald-500/20" />
                         </div>
                      </div>
                   </div>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-emerald-500/5 to-transparent pointer-events-none" />
            </div>
          </section>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-300" />
              <input 
                type="text" 
                placeholder={t.searchTickets} 
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
                    <option value="all">{t.allStatus}</option>
                    <option value="open">{t.open}</option>
                    <option value="in_progress">{t.inProgress}</option>
                    <option value="resolved">{t.resolved}</option>
                    <option value="closed">{t.closed}</option>
                </select>
            </div>
          </div>

          {/* Tickets List */}
          {loading ? (
             <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{t.loadingTickets}</p>
             </div>
          ) : filteredTickets.length === 0 ? (
            <div className="bg-white rounded-[2.5rem] p-12 text-center border border-slate-50 shadow-sm col-span-full">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300">
                <MessageSquare className="size-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{t.noTickets}</h3>
              <p className="text-sm text-slate-400 max-w-xs mx-auto mb-6">{t.noTicketsDescription}</p>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-emerald-50 text-emerald-600 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-100 transition-all active:scale-95"
              >
                {t.openFirstTicket}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredTickets.map((ticket) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={ticket.id}
                  className="bg-white p-6 rounded-[2rem] border border-slate-50 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                          getPriorityColor(ticket.priority)
                        )}>
                          {ticket.priority}
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-100">
                          <Tag className="size-3" />
                          {ticket.category}
                        </div>
                        <span className="text-[11px] font-bold text-slate-400">#{ticket.id.split('-')[0]}</span>
                      </div>
                      
                      <div>
                        <h4 className="text-lg font-black text-slate-900 group-hover:text-emerald-600 transition-colors">{ticket.subject}</h4>
                        <p className="text-sm text-slate-500 font-medium line-clamp-2 mt-1">{ticket.description}</p>
                      </div>

                      <div className="flex items-center gap-4 text-[11px] font-bold text-slate-400">
                         <div className="flex items-center gap-1.5">
                            <Clock className="size-3.5" />
                            {formatDate(ticket.created_at)}
                         </div>
                         {ticket.profiles && (
                           <div className="flex items-center gap-1.5">
                              <User className="size-3.5" />
                              {ticket.profiles.full_name} ({ticket.profiles.email})
                           </div>
                         )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between lg:justify-end gap-3 pt-6 lg:pt-0 lg:border-l lg:pl-8 lg:min-w-[200px]">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(ticket.status)}
                        <span className="text-xs font-black text-slate-900 uppercase tracking-widest">
                          {t[ticket.status as keyof typeof t] || ticket.status.replace('_', ' ')}
                        </span>
                      </div>
                      
                      {/* Admin Controls */}
                      {((user as any).role === 'admin' || user.user_metadata?.role === 'admin') && (
                        <div className="flex gap-2">
                           {ticket.status === 'open' && (
                             <button 
                               onClick={() => handleUpdateStatus(ticket.id, 'in_progress')}
                               className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all active:scale-90"
                               title={t.markInProgress}
                             >
                               <ArrowRight className="size-4" />
                             </button>
                           )}
                           {(ticket.status === 'open' || ticket.status === 'in_progress') && (
                             <button 
                               onClick={() => handleUpdateStatus(ticket.id, 'resolved')}
                               className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all active:scale-90"
                               title={t.resolveTicket}
                             >
                               <CheckCircle2 className="size-4" />
                             </button>
                           )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Create Ticket Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
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
                className="relative w-full max-w-lg bg-white rounded-[2.5rem] p-8 shadow-2xl overflow-hidden border border-white"
              >
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-3 bg-emerald-50 rounded-2xl">
                    <MessageSquareText className="size-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{t.openTicket}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.newSupportTicket}</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {formError && (
                    <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold leading-relaxed border border-red-100 flex gap-3">
                      <AlertCircle className="size-4 shrink-0" />
                      {formError}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.ticketSubject}</label>
                    <input 
                      type="text"
                      required
                      placeholder={t.subjectPlaceholder}
                      value={formData.subject}
                      onChange={e => setFormData({...formData, subject: e.target.value})}
                      className="w-full px-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-slate-900 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.ticketPriority}</label>
                      <select 
                        value={formData.priority}
                        onChange={e => setFormData({...formData, priority: e.target.value as any})}
                        className="w-full px-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-slate-900 transition-all cursor-pointer"
                      >
                        <option value="low">{t.low}</option>
                        <option value="medium">{t.medium}</option>
                        <option value="high">{t.high}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.category}</label>
                      <select 
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value as any})}
                        className="w-full px-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-slate-900 transition-all cursor-pointer"
                      >
                        <option value="technical">{t.technical}</option>
                        <option value="billing">{t.billing}</option>
                        <option value="feature">{t.feature}</option>
                        <option value="other">{t.other}</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.ticketDescription}</label>
                    <textarea 
                      required
                      rows={4}
                      placeholder={t.descriptionPlaceholder}
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      className="w-full px-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold text-slate-900 transition-all resize-none"
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
                      {formLoading ? t.processing : t.createTicket}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        {/* Floating AI Assistant */}
        <div className="hidden">
           <AIAssistantDashboard />
        </div>
      </main>
    </div>
  );
}
