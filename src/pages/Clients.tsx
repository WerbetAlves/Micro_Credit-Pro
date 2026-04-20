import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  User, 
  Phone, 
  MapPin, 
  FileText, 
  Star, 
  Edit2, 
  Trash2, 
  X, 
  AlertCircle, 
  ShieldCheck, 
  Filter 
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

// --- Interface do Cliente ---
interface Client {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  document_id: string;
  address: string;
  city: string;
  state: string;
  reference_point: string;
  credit_score: number;
  status: 'active' | 'inactive' | 'blocked';
  created_at: string;
}

export function Clients() {
  const { t, formatDate } = useLanguage();
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(''); // 🔥 Controlado pelo Header
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 🔥 Estado do formulário com Tipagem Explícita para evitar erros de status
  const [formData, setFormData] = useState<{
    full_name: string;
    email: string;
    phone: string;
    document_id: string;
    address: string;
    city: string;
    state: string;
    reference_point: string;
    credit_score: number;
    status: 'active' | 'inactive' | 'blocked';
  }>({
    full_name: '',
    email: '',
    phone: '',
    document_id: '',
    address: '',
    city: '',
    state: '',
    reference_point: '',
    credit_score: 500,
    status: 'active'
  });

  useEffect(() => {
    if (user) fetchClients();
  }, [user]);

  async function fetchClients() {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .order('full_name');
      if (error) throw error;
      setClients(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar clientes:', err.message);
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
        phone: client.phone || '',
        document_id: client.document_id || '',
        address: client.address || '',
        city: client.city || '',
        state: client.state || '',
        reference_point: client.reference_point || '',
        credit_score: client.credit_score || 500,
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
        city: '',
        state: '',
        reference_point: '',
        credit_score: 500,
        status: 'active'
      });
    }
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFormLoading(true);
    setFormError(null);

    try {
      if (editingClient) {
        const { error } = await supabase.from('clients').update(formData).eq('id', editingClient.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('clients').insert([{ ...formData, user_id: user.id }]);
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
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      fetchClients();
    } catch (err: any) {
      console.error('Erro ao deletar:', err.message);
    }
  };

  // 🔥 Lógica de filtragem (Pesquisa + Status)
  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const lowerSearch = search.toLowerCase();
      const matchesSearch = 
        c.full_name.toLowerCase().includes(lowerSearch) || 
        c.document_id?.toLowerCase().includes(lowerSearch) ||
        c.city?.toLowerCase().includes(lowerSearch);
      
      const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [clients, search, filterStatus]);

  return (
    <div className="flex min-h-screen bg-[#f8fafc] overflow-x-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="flex-1 lg:ml-72 min-h-screen pb-20 w-full transition-all duration-300">
        <Header 
          title={t.manageClients} 
          onMenuClick={() => setIsSidebarOpen(true)}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t.searchClients}
        >
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all active:scale-95"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">{t.addClient}</span>
          </button>
        </Header>

        <div className="px-4 lg:px-8 py-8 w-full max-w-[1600px] mx-auto">
          {/* Filtro de Status lateral */}
          <div className="flex justify-end mb-8">
            <div className="flex items-center gap-2 bg-white px-4 py-2 border border-slate-100 rounded-2xl shadow-sm">
              <Filter className="size-4 text-slate-400" />
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-transparent border-none outline-none text-xs font-bold text-slate-500 uppercase tracking-widest cursor-pointer focus:ring-0"
              >
                <option value="all">{t.allClients}</option>
                <option value="active">{t.active}</option>
                <option value="inactive">{t.inactive}</option>
                <option value="blocked">{t.blocked}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-[2.5rem] p-8 animate-pulse border border-slate-50 h-64" />
                ))
              ) : filteredClients.length === 0 ? (
                <div className="col-span-full py-20 bg-white rounded-[2rem] border border-slate-50 border-dashed text-center">
                  <p className="text-slate-400 font-medium">{search ? 'Nenhum cliente encontrado' : t.noClients}</p>
                </div>
              ) : (
                filteredClients.map((client) => (
                  <motion.div
                    key={client.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-[2.5rem] p-6 lg:p-8 border border-slate-50 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-black">
                          {client.full_name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors uppercase text-sm tracking-tight">{client.full_name}</h4>
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md",
                            client.status === 'active' ? "bg-emerald-50 text-emerald-600" : 
                            client.status === 'blocked' ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-400"
                          )}>
                            {t[client.status as keyof typeof t] || client.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleOpenModal(client)} className="p-2 text-slate-300 hover:text-emerald-500 transition-all"><Edit2 className="size-4" /></button>
                        <button onClick={() => handleDelete(client.id)} className="p-2 text-slate-300 hover:text-red-500 transition-all"><Trash2 className="size-4" /></button>
                      </div>
                    </div>

                    <div className="space-y-4 mb-6">
                      <div className="flex items-center gap-3 text-slate-500 text-xs font-medium">
                        <Phone className="size-4 opacity-40 text-emerald-500" /> {client.phone || 'Sem telefone'}
                      </div>
                      <div className="flex items-center gap-3 text-slate-500 text-xs font-medium">
                        <MapPin className="size-4 opacity-40 text-emerald-500" /> {client.city ? `${client.city}, ${client.state}` : 'Sem localização'}
                      </div>
                      <div className="flex items-center gap-3 text-slate-500 text-xs font-medium">
                        <ShieldCheck className="size-4 opacity-40 text-emerald-500" /> Score: <span className={cn("font-bold", client.credit_score > 700 ? "text-emerald-600" : "text-amber-600")}>{client.credit_score}</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-50 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <span>Registrado em:</span>
                      <span>{formatDate(client.created_at)}</span>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Modal de Cliente Premium */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white max-h-[90vh] overflow-y-auto"
            >
              <div className="p-8 lg:p-10">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">{editingClient ? t.editClient : t.addClient}</h3>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 transition-all"><X className="size-6" /></button>
                </div>

                <form onSubmit={handleSave} className="space-y-8">
                  {formError && (
                    <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold flex gap-3 border border-red-100">
                      <AlertCircle className="size-4 shrink-0" /> {formError}
                    </div>
                  )}

                  {/* Seção: Dados Pessoais */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-4">Informações de Contato</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-4">{t.fullName}</label>
                        <input type="text" required value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none transition-all" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-4">{t.phone}</label>
                        <input type="text" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="+351 000 000 000" className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none transition-all" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-4">{t.documentId}</label>
                        <input type="text" value={formData.document_id} onChange={e => setFormData({...formData, document_id: e.target.value})} placeholder="NIF / CPF / CNPJ" className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none transition-all" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-4">{t.email}</label>
                        <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none transition-all" />
                      </div>
                    </div>
                  </div>

                  {/* Seção: Endereço */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-4">Localização</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-4">{t.city}</label>
                        <input type="text" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none transition-all" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-4">{t.state}</label>
                        <input type="text" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none transition-all" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-4">{t.address}</label>
                      <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none transition-all" />
                    </div>
                  </div>

                  {/* Seção: Score e Status */}
                  <div className="p-6 bg-slate-50 rounded-[2rem] space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                          <Star className="size-3 text-amber-500 fill-amber-500" /> {t.creditScore} ({formData.credit_score})
                        </label>
                        <input type="range" min="0" max="1000" step="10" value={formData.credit_score} onChange={e => setFormData({...formData, credit_score: parseInt(e.target.value)})} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                        <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                          <span>Risco Alto</span>
                          <span>Score Médio</span>
                          <span>Excelente</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-4">{t.clientStatus}</label>
                        <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as 'active' | 'inactive' | 'blocked'})} className="w-full bg-white border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none transition-all appearance-none cursor-pointer">
                          <option value="active">{t.active}</option>
                          <option value="inactive">{t.inactive}</option>
                          <option value="blocked">{t.blocked}</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-4 bg-slate-50 text-slate-500 font-bold rounded-2xl hover:bg-slate-100 transition-all uppercase tracking-widest text-xs">{t.cancel}</button>
                    <button type="submit" disabled={formLoading} className="flex-2 px-10 py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-emerald-600 shadow-xl shadow-slate-200 transition-all active:scale-95 disabled:opacity-50 uppercase tracking-[0.15em] text-xs">
                      {formLoading ? 'Salvando...' : t.save}
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