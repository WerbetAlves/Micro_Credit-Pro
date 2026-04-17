import React, { useState, useEffect } from 'react';
import { Search, Plus, User, Phone, MapPin, MoreVertical, Edit2, Trash2, X, AlertCircle } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Client {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  document_id: string | null;
  address: string | null;
  credit_score: number;
  status: 'active' | 'inactive' | 'blocked';
  created_at: string;
}

export function Clients() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    document_id: '',
    address: '',
    credit_score: 500,
    status: 'active' as const
  });

  useEffect(() => {
    fetchClients();
  }, [user]);

  async function fetchClients() {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (err: any) {
      console.error('Error fetching clients:', err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleOpenModal = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        full_name: client.full_name,
        email: client.email || '',
        phone: client.phone,
        document_id: client.document_id || '',
        address: client.address || '',
        credit_score: client.credit_score,
        status: client.status
      });
    } else {
      setEditingClient(null);
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        document_id: '',
        address: '',
        credit_score: 500,
        status: 'active'
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

    const clientData = {
      ...formData,
      user_id: user.id
    };

    try {
      if (editingClient) {
        const { error } = await supabase
          .from('clients')
          .update(clientData)
          .eq('id', editingClient.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('clients')
          .insert([clientData]);
        if (error) throw error;
      }
      
      setIsModalOpen(false);
      fetchClients();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t.confirmDelete)) return;
    
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      fetchClients();
    } catch (err: any) {
      console.error('Error deleting client:', err.message);
    }
  };

  const filteredClients = clients.filter(c => 
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  return (
    <div className="flex min-h-screen bg-[#f8fafc] overflow-x-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="flex-1 lg:ml-72 min-h-screen pb-20 w-full transition-all duration-300">
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-4 lg:px-8 py-4 lg:py-5">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-500">
              <Plus className="size-6 rotate-45" />
            </button>
            <h1 className="text-lg lg:text-xl font-bold tracking-tight text-slate-900 truncate">{t.manageClients}</h1>
          </div>
          
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all active:scale-95"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">{t.addClient}</span>
          </button>
        </header>

        <div className="px-4 lg:px-8 py-8 w-full">
          {/* Search & Stats */}
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
          </div>

          {/* Clients List */}
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-400">{t.clientName}</th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-400">{t.phone}</th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-400">{t.creditScore}</th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-slate-400">{t.clientStatus}</th>
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
                  ) : filteredClients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                            <User className="size-8 text-slate-200" />
                          </div>
                          <p className="text-slate-400 text-sm font-medium">{t.noClients}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredClients.map((client) => (
                      <tr key={client.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                              <span className="text-emerald-600 font-bold text-sm">
                                {client.full_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">{client.full_name}</p>
                              <p className="text-xs text-slate-400 truncate">{client.email || 'No email'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                            <Phone className="size-3.5 text-slate-300" />
                            {client.phone}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={cn(
                                  "h-full rounded-full",
                                  client.credit_score > 700 ? "bg-emerald-500" : client.credit_score > 400 ? "bg-amber-500" : "bg-red-500"
                                )}
                                style={{ width: `${(client.credit_score / 1000) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-600">{client.credit_score}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            client.status === 'active' ? "bg-emerald-50 text-emerald-600" :
                            client.status === 'inactive' ? "bg-slate-100 text-slate-400" : "bg-red-50 text-red-600"
                          )}>
                            {t[client.status]}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleOpenModal(client)}
                              className="p-2 text-slate-400 hover:text-emerald-500 transition-colors"
                            >
                              <Edit2 className="size-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(client.id)}
                              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                          <button className="p-2 text-slate-300 lg:group-hover:hidden">
                            <MoreVertical className="size-4" />
                          </button>
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

      {/* Client Modal */}
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
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden shadow-emerald-900/10 border border-white"
            >
              <div className="p-8 lg:p-10">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
                    {editingClient ? t.editClient : t.addClient}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.fullName}</label>
                      <input 
                        required
                        value={formData.full_name}
                        onChange={e => setFormData({...formData, full_name: e.target.value})}
                        className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium text-slate-900 transition-all" 
                        placeholder="John Borrower"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.email}</label>
                      <input 
                        type="email"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium text-slate-900 transition-all"
                        placeholder="john@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.phone}</label>
                      <input 
                        required
                        value={formData.phone}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                        className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium text-slate-900 transition-all"
                        placeholder="+55 11 98888-8888"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.documentId}</label>
                      <input 
                        value={formData.document_id}
                        onChange={e => setFormData({...formData, document_id: e.target.value})}
                        className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium text-slate-900 transition-all"
                        placeholder="000.000.000-00"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.address}</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-300" />
                      <input 
                        value={formData.address}
                        onChange={e => setFormData({...formData, address: e.target.value})}
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium text-slate-900 transition-all"
                        placeholder="Av. Paulista, 1000 - SP"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.creditScore} ({formData.credit_score})</label>
                      <input 
                        type="range"
                        min="0"
                        max="1000"
                        value={formData.credit_score}
                        onChange={e => setFormData({...formData, credit_score: Number(e.target.value)})}
                        className="w-full h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">{t.clientStatus}</label>
                      <select 
                        value={formData.status}
                        onChange={e => setFormData({...formData, status: e.target.value as any})}
                        className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium text-slate-900 transition-all"
                      >
                        <option value="active">{t.active}</option>
                        <option value="inactive">{t.inactive}</option>
                        <option value="blocked">{t.blocked}</option>
                      </select>
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
    </div>
  );
}
