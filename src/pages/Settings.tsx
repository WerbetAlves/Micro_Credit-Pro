import React, { useState, useEffect } from 'react';
import { CreditCard, Shield, Zap, Check, Star, Settings as SettingsIcon, FileText, Plus, Trash2, Camera, MapPin, Phone, AlertCircle, Download, Upload } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export function Settings() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Use state from navigation or default to 'profile'
  const initialTab = (location.state as any)?.activeTab || 'profile';
  const [activeTab, setActiveTab] = useState<'profile' | 'billing' | 'payments' | 'privacy'>(initialTab);

  const { signOut } = useAuth();

  useEffect(() => {
    if ((location.state as any)?.activeTab) {
      setActiveTab((location.state as any).activeTab);
    }
  }, [location.state]);
  const [profile, setProfile] = useState<any>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [user]);

  async function fetchProfile() {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('*').single();
    if (data) setProfile(data);
  }

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUpdating(true);
    const formData = new FormData(e.currentTarget);
    const updates = {
      full_name: formData.get('full_name'),
      business_name: formData.get('business_name'),
      document_id: formData.get('document_id'),
      phone: formData.get('phone'),
      address: formData.get('address'),
    };
    
    try {
      const { error } = await supabase.from('profiles').update(updates).eq('id', user?.id);
      if (error) throw error;
      await fetchProfile();
      alert('Perfil atualizado com sucesso!');
    } catch (err: any) {
      alert('Erro ao atualizar perfil.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpgrade = async (plan: string) => {
    if (!user || isUpdating) return;
    setIsUpdating(true);
    
    // Simulando tempo de processamento de pagamento
    await new Promise(r => setTimeout(r, 1500));
    
    try {
      const { error } = await supabase.from('profiles').update({ plan_type: plan.toLowerCase() }).eq('id', user.id);
      if (error) throw error;
      await fetchProfile();
      alert(`Parabéns! Você acaba de migrar para o plano ${plan.toUpperCase()}`);
    } catch (e: any) {
      console.error(e);
      alert('Erro ao processar assinatura.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddPaymentMethod = async () => {
    if (!profile) return;
    const newMethod = {
      id: crypto.randomUUID(),
      type: 'credit',
      last4: Math.floor(1000 + Math.random() * 9000).toString(),
      brand: 'mastercard',
      name: 'Cartão Adicionado'
    };
    
    const updatedMethods = [...(profile.payment_methods || []), newMethod];
    try {
      await supabase.from('profiles').update({ payment_methods: updatedMethods }).eq('id', user?.id);
      await fetchProfile();
    } catch (err) {
      alert('Erro ao adicionar método.');
    }
  };

  const handleRemovePaymentMethod = async (id: string) => {
    if (!profile) return;
    const updatedMethods = profile.payment_methods.filter((m: any) => m.id !== id);
    try {
      await supabase.from('profiles').update({ payment_methods: updatedMethods }).eq('id', user?.id);
      await fetchProfile();
    } catch (err) {
      alert('Erro ao remover método.');
    }
  };

  const handleDeleteData = async () => {
    if (!user) return;
    const confirm = window.confirm(t.confirmDeleteData);
    if (!confirm) return;

    setIsUpdating(true);
    try {
      // In a real DB we'd use cascading or multiple deletes
      // In simulation we'll clear specific tables
      const tables = ['installments', 'loans', 'clients', 'transactions', 'notifications', 'support_tickets'];
      
      for (const table of tables) {
        // Mocking the delete of user data
        // In local simulation we'd filter by user_id
        await supabase.from(table).delete().eq('user_id', user.id);
      }
      
      alert(t.deleteDataSuccess);
    } catch (err: any) {
      alert('Error clearing data.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    const confirm = window.confirm(t.confirmDeleteAccount);
    if (!confirm) return;

    setIsUpdating(true);
    try {
      // 1. Delete all data
      const tables = ['installments', 'loans', 'clients', 'transactions', 'notifications', 'support_tickets', 'wallets', 'profiles'];
      for (const table of tables) {
        await supabase.from(table).delete().eq('user_id', user.id);
      }

      // 2. Sign Out
      alert(t.deleteAccountSuccess);
      signOut();
    } catch (err: any) {
      alert('Error deleting account.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    setIsUpdating(true);
    try {
      const tables = ['profiles', 'clients', 'loans', 'installments', 'transactions', 'wallets', 'notifications', 'support_tickets'];
      const backupData: any = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        data: {}
      };

      for (const table of tables) {
        const { data } = await supabase.from(table).select('*');
        backupData.data[table] = data || [];
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `emerald-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Error exporting data.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!window.confirm('Isso irá substituir ou adicionar dados ao seu sistema atual. Deseja continuar?')) {
      e.target.value = '';
      return;
    }

    setIsUpdating(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (!backup.version || !backup.data) {
        throw new Error('Invalid format');
      }

      const tables = Object.keys(backup.data);
      for (const table of tables) {
        const rows = backup.data[table];
        if (Array.isArray(rows) && rows.length > 0) {
          // Simulation upsert
          await supabase.from(table).upsert(rows);
        }
      }

      alert(t.importSuccess);
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert(t.importError);
    } finally {
      setIsUpdating(false);
      e.target.value = '';
    }
  };

  const plans = [
    {
      id: 'free',
      name: 'Gratuito',
      price: 'R$ 0',
      description: 'Ideal para quem está começando agora',
      features: ['Até 3 clientes', '1 Carteira ativa', 'Simulador de crédito básico', 'Suporte via comunidade'],
      color: 'gray'
    },
    {
      id: 'pro',
      name: 'Profissional',
      price: 'R$ 49,90',
      description: 'Perfeito para agiotas e micro-financiadoras',
      features: ['Clientes ilimitados', 'Carteiras ilimitadas', 'Relatórios avançados', 'Notificações WhatsApp'],
      color: 'emerald',
      popular: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 'R$ 199,00',
      description: 'Para grandes operações e redes de crédito',
      features: ['Multi-usuários (suporte)', 'API de integração', 'White-label (sua marca)', 'Gerente de conta'],
      color: 'blue'
    }
  ];

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="flex-1 lg:ml-72 min-h-screen pb-20 transition-all duration-300">
        <Header title={t.settings} onMenuClick={() => setIsSidebarOpen(true)} />

        <div className="px-4 md:px-6 lg:px-8 py-8 max-w-6xl mx-auto space-y-8">
          <div className="flex flex-wrap gap-2 p-1.5 bg-white border border-slate-200 rounded-2xl w-fit">
            <button
              onClick={() => setActiveTab('profile')}
              className={cn(
                "px-5 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2",
                activeTab === 'profile' ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <SettingsIcon className="size-3.5" />
              Perfil
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={cn(
                "px-5 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2",
                activeTab === 'payments' ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <CreditCard className="size-3.5" />
              Meios de Pagamento
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={cn(
                "px-5 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2",
                activeTab === 'billing' ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <Zap className="size-3.5" />
              Assinatura
            </button>
            <button
              onClick={() => setActiveTab('privacy')}
              className={cn(
                "px-5 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2",
                activeTab === 'privacy' ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <Shield className="size-3.5" />
              {t.privacy}
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-8"
              >
                {/* Personal Info & Docs */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 lg:p-12 shadow-sm space-y-10">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-6 pb-2 border-b border-slate-50">
                      <div className="relative group">
                        <div className="size-24 rounded-[2rem] bg-emerald-50 flex items-center justify-center text-emerald-600 overflow-hidden border-4 border-slate-50">
                          {profile?.avatar_url ? (
                            <img src={profile.avatar_url} className="size-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Camera className="size-10 opacity-20" />
                          )}
                        </div>
                        <button className="absolute -bottom-2 -right-2 p-2.5 bg-white shadow-lg border border-slate-100 rounded-xl text-slate-400 hover:text-emerald-500 transition-all">
                          <Camera className="size-4" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-xl font-black text-slate-900">{profile?.full_name}</h3>
                        <p className="text-sm font-medium text-slate-400 capitalize">{profile?.plan_type} Account • Member since 2024</p>
                      </div>
                    </div>

                    <form onSubmit={handleUpdateProfile} className="space-y-8">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                        <div className="space-y-2.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4 flex items-center gap-2">
                            <Star className="size-3 text-amber-500 fill-amber-500" /> Nome Completo
                          </label>
                          <input 
                            name="full_name"
                            defaultValue={profile?.full_name || ''}
                            required
                            className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                          />
                        </div>

                        <div className="space-y-2.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Empresa / Operação</label>
                          <input 
                            name="business_name"
                            defaultValue={profile?.business_name || ''}
                            placeholder="Ex: CrediFácil Ltda"
                            className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                          />
                        </div>

                        <div className="space-y-2.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4 flex items-center gap-2">
                            <FileText className="size-3" /> CPF ou CNPJ
                          </label>
                          <input 
                            name="document_id"
                            defaultValue={profile?.document_id || ''}
                            placeholder="000.000.000-00"
                            className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                          />
                        </div>

                        <div className="space-y-2.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4 flex items-center gap-2">
                            <Phone className="size-3" /> WhatsApp / Telefone
                          </label>
                          <input 
                            name="phone"
                            defaultValue={profile?.phone || ''}
                            className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4 flex items-center gap-2">
                          <MapPin className="size-3" /> Endereço Comercial
                        </label>
                        <input 
                          name="address"
                          defaultValue={profile?.address || ''}
                          className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                        />
                      </div>

                      <div className="pt-4">
                        <button 
                          type="submit"
                          disabled={isUpdating}
                          className="w-full sm:w-auto px-12 bg-slate-900 text-white rounded-2xl py-4 font-black text-xs uppercase tracking-[0.15em] hover:bg-emerald-600 shadow-xl shadow-slate-200 transition-all active:scale-95 disabled:opacity-50"
                        >
                          {isUpdating ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Account Status Sidebar */}
                <div className="space-y-6">
                  <div className="bg-emerald-600 rounded-[2.5rem] p-8 text-white space-y-6 shadow-xl shadow-emerald-100">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Status do Plano</p>
                      <h4 className="text-2xl font-black capitalize">{profile?.plan_type}</h4>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-sm font-medium">
                        <Check className="size-4" /> Verificado
                      </div>
                      <div className="flex items-center gap-3 text-sm font-medium">
                        <Check className="size-4" /> Limites de Cliente: {profile?.plan_type === 'free' ? '3' : 'Ilimitado'}
                      </div>
                    </div>
                    <button 
                      onClick={() => setActiveTab('billing')}
                      className="w-full bg-white text-emerald-600 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform"
                    >
                      Ver Benefícios do Plano
                    </button>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-[2rem] p-6 text-center space-y-4">
                    <div className="size-12 bg-red-50 text-red-500 rounded-xl flex items-center justify-center mx-auto">
                      <Shield className="size-6" />
                    </div>
                    <div className="space-y-1">
                      <h5 className="font-bold text-slate-800">Segurança de Dados</h5>
                      <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Suas informações são criptografadas em repouso conforme os padrões SAE-2.</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'payments' && (
              <motion.div
                key="payments"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-3xl space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black text-slate-900">Cartões e Contas</h2>
                    <p className="text-sm font-medium text-slate-500">Gerencie como você paga sua assinatura.</p>
                  </div>
                  <button 
                    onClick={handleAddPaymentMethod}
                    className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all active:scale-95 shadow-lg shadow-slate-200"
                  >
                    <Plus className="size-4" /> Novo Cartão
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(profile?.payment_methods || []).map((card: any) => (
                    <div key={card.id} className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm hover:border-emerald-200 transition-all group relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => handleRemovePaymentMethod(card.id)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                      <div className="flex items-start justify-between mb-8">
                        <div className="size-12 bg-slate-50 rounded-xl flex items-center justify-center">
                          <CreditCard className="size-6 text-slate-400" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">•••• {card.last4}</span>
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-slate-900 capitalize">{card.name}</h4>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">{card.brand}</p>
                      </div>
                    </div>
                  ))}
                  
                  {(profile?.payment_methods || []).length === 0 && (
                    <div className="col-span-full border-2 border-dashed border-slate-100 rounded-[2.5rem] py-20 flex flex-col items-center justify-center text-slate-300 space-y-4">
                      <CreditCard className="size-12 opacity-20" />
                      <p className="text-sm font-medium">Nenhum cartão cadastrado.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'privacy' && (
              <motion.div
                key="privacy"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-3xl space-y-8"
              >
                <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 lg:p-12 shadow-sm space-y-8">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black text-slate-900">{t.privacy}</h2>
                    <p className="text-sm font-medium text-slate-500">Manage your data and account privacy settings.</p>
                  </div>

                  {/* Backup & Restore */}
                  <div className="p-8 bg-emerald-50/30 rounded-[2rem] border border-emerald-100/50 space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
                        <Download className="size-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{t.dataBackup}</h3>
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest leading-none">Export & Import</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-6 bg-white rounded-2xl border border-emerald-100/30 space-y-4">
                        <div className="space-y-1">
                          <h4 className="text-sm font-black text-slate-900">{t.exportData}</h4>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed">
                            {t.exportDescription}
                          </p>
                        </div>
                        <button 
                          onClick={handleExportData}
                          disabled={isUpdating}
                          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50"
                        >
                          <Download className="size-3.5" />
                          {t.exportData}
                        </button>
                      </div>

                      <div className="p-6 bg-white rounded-2xl border border-emerald-100/30 space-y-4">
                        <div className="space-y-1">
                          <h4 className="text-sm font-black text-slate-900">{t.importData}</h4>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed">
                            {t.importDescription}
                          </p>
                        </div>
                        <div className="relative">
                          <input 
                            type="file" 
                            accept=".json"
                            onChange={handleImportData}
                            disabled={isUpdating}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                          />
                          <button 
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-50 text-emerald-600 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-100 transition-all active:scale-95 disabled:opacity-50"
                          >
                            <Upload className="size-3.5" />
                            {t.importData}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 bg-red-50/50 rounded-[2rem] border border-red-100 space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
                        <AlertCircle className="size-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-red-950 uppercase tracking-tight">{t.dangerZone}</h3>
                        <p className="text-[10px] font-black text-red-400 uppercase tracking-widest leading-none">{t.irreversibleAction}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 pt-4 border-t border-red-100/50">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white rounded-2xl border border-red-100/50">
                        <div className="space-y-1">
                          <h4 className="text-sm font-black text-slate-900">{t.deleteData}</h4>
                          <p className="text-xs text-slate-500 font-medium max-w-sm">
                            Apague todos os clientes, empréstimos e históricos financeiros. Sua conta permanece ativa.
                          </p>
                        </div>
                        <button 
                          onClick={handleDeleteData}
                          disabled={isUpdating}
                          className="px-6 py-3 bg-red-50 text-red-600 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                        >
                          {t.deleteData}
                        </button>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white rounded-2xl border border-red-100/50">
                        <div className="space-y-1">
                          <h4 className="text-sm font-black text-slate-900">{t.deleteAccount}</h4>
                          <p className="text-xs text-slate-500 font-medium max-w-sm">
                            Remova sua conta permanentemente e todos os dados associados do nosso sistema.
                          </p>
                        </div>
                        <button 
                          onClick={handleDeleteAccount}
                          disabled={isUpdating}
                          className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-200 disabled:opacity-50"
                        >
                          {t.deleteAccount}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            {activeTab === 'billing' && (
              <motion.div
                key="billing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="text-center max-w-2xl mx-auto space-y-3">
                  <h2 className="text-3xl font-bold text-slate-900">Escolha o plano ideal para seu negócio</h2>
                  <p className="text-slate-500">Aumente sua produtividade e escale suas cobranças com nossas ferramentas avançadas.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                  {plans.map((plan) => {
                    const isCurrent = (profile?.plan_type || 'free') === plan.id;
                    
                    return (
                      <div 
                        key={plan.name}
                        className={cn(
                          "relative bg-white border rounded-3xl p-8 flex flex-col transition-all duration-300 hover:shadow-xl",
                          isCurrent ? "border-emerald-500 shadow-md ring-4 ring-emerald-50/50" : "border-slate-200 shadow-sm",
                          plan.popular && !isCurrent ? "border-slate-300 scale-105 z-10" : ""
                        )}
                      >
                        {plan.popular && (
                          <div className={cn(
                            "absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg",
                            isCurrent ? "bg-slate-900 text-white" : "bg-emerald-500 text-white"
                          )}>
                            {isCurrent ? 'Seu Plano Atual' : 'Mais Popular'}
                          </div>
                        )}

                        <div className="space-y-4 mb-8">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-slate-800">{plan.name}</h3>
                            {isCurrent && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-600 px-2 py-1 rounded-md uppercase">Ativo</span>}
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-black text-slate-900">{plan.price}</span>
                            <span className="text-slate-500 font-medium text-sm">/mês</span>
                          </div>
                          <p className="text-slate-500 text-sm leading-relaxed">{plan.description}</p>
                        </div>

                        <div className="flex-1 space-y-4">
                          {plan.features.map((feature) => (
                            <div key={feature} className="flex items-center gap-3 text-sm text-slate-600">
                              <div className="flex-shrink-0 size-5 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                                <Check className="size-3" strokeWidth={3} />
                              </div>
                              {feature}
                            </div>
                          ))}
                        </div>

                        <button
                          onClick={() => !isCurrent && handleUpgrade(plan.id)}
                          disabled={isCurrent || isUpdating}
                          className={cn(
                            "mt-10 w-full py-4 rounded-2xl font-bold transition-all transform active:scale-[0.98] flex items-center justify-center gap-2",
                            isCurrent 
                              ? "bg-slate-50 text-slate-400 cursor-not-allowed border border-slate-200" 
                              : "bg-emerald-600 text-white shadow-emerald-200 shadow-lg hover:bg-emerald-700 hover:-translate-y-1"
                          )}
                        >
                          {isUpdating && !isCurrent ? (
                            <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : isCurrent ? 'Plano Ativo' : 'Começar Agora'}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Additional Billing Info */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8 border-t border-slate-200">
                  <div className="space-y-6">
                    <h4 className="text-lg font-black text-slate-900 flex items-center gap-2">
                       <FileText className="size-5 text-emerald-500" /> Detalhes do Faturamento
                    </h4>
                    <div className="bg-white border border-slate-100 rounded-3xl p-6 space-y-4 shadow-sm">
                      <div className="flex justify-between items-center py-2 border-b border-slate-50">
                        <span className="text-sm text-slate-500 font-medium">Situação da Assinatura</span>
                        <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">Ativo • Pagamento em dia</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-50">
                        <span className="text-sm text-slate-500 font-medium">Próxima Cobrança</span>
                        <span className="text-sm font-bold text-slate-700">18 de Maio, 2026</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-slate-500 font-medium">Método de Cobrança</span>
                        <span className="text-sm font-bold text-slate-700 flex items-center gap-2 text-right">
                          {profile?.payment_methods?.[0] ? (
                            <>Cartão •••• {profile.payment_methods[0].last4}</>
                          ) : (
                            <span className="text-amber-500">Nenhum cartão vinculado</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-lg font-black text-slate-900 flex items-center gap-2">
                       <Shield className="size-5 text-emerald-500" /> Histórico de Recibos
                    </h4>
                    <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Data</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Valor</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          <tr className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 text-sm font-bold text-slate-700">18 Abr, 2026</td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-700">R$ {profile?.plan_type === 'pro' ? '49,90' : profile?.plan_type === 'enterprise' ? '199,00' : '0,00'}</td>
                            <td className="px-6 py-4 text-right">
                              <button className="text-emerald-600 hover:text-emerald-700 font-bold text-xs uppercase tracking-widest">Baixar PDF</button>
                            </td>
                          </tr>
                          <tr className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 text-sm font-bold text-slate-500">18 Mar, 2026</td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-500">R$ 0,00</td>
                            <td className="px-6 py-4 text-right">
                              <button className="text-slate-400 hover:text-slate-600 font-bold text-xs uppercase tracking-widest">Recibo</button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
