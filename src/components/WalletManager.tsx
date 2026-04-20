import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, Plus, X, Landmark, Banknote, Smartphone, ChevronRight, Link2, Trash2, Edit2, ShieldCheck, RefreshCw, Search, Zap, Lock
} from 'lucide-react';

const POPULAR_BANKS = [
  { id: 'nubank', name: 'Nubank', color: 'bg-purple-600' },
  { id: 'itau', name: 'Itaú', color: 'bg-orange-600' },
  { id: 'bradesco', name: 'Bradesco', color: 'bg-red-600' },
  { id: 'inter', name: 'Inter', color: 'bg-orange-500' },
  { id: 'santander', name: 'Santander', color: 'bg-red-700' },
  { id: 'btg', name: 'BTG Pactual', color: 'bg-indigo-900' }
];
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

interface WalletData {
  id: string;
  name: string;
  type: 'physical' | 'bank' | 'digital';
  balance: number;
  is_connected?: boolean;
  last_sync?: string;
}

export function WalletManager() {
  const { t, formatCurrency } = useLanguage();
  const { user } = useAuth();
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form State
  const [editingWallet, setEditingWallet] = useState<WalletData | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<'physical' | 'bank' | 'digital'>('bank');
  const [initialBalance, setInitialBalance] = useState('');

  // Open Finance Integration State
  const [isConnectingBank, setIsConnectingBank] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [syncingId, setSyncingId] = useState<string | null>(null);

  useEffect(() => {
    fetchWallets();
  }, [user]);

  async function fetchWallets() {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setWallets(data || []);
    } catch (err) {
      console.error('Error fetching wallets:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleSync = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSyncingId(id);
    // Simulate sync
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      const { error } = await supabase
        .from('wallets')
        .update({ 
          last_sync: new Date().toISOString(),
          balance: Math.random() * 5000 + 100 // Simulate balance update
        })
        .eq('id', id);
      
      if (error) throw error;
      await fetchWallets();
    } catch (err) {
      console.error(err);
    } finally {
      setSyncingId(null);
    }
  };

  const handleConnectBank = async (bank: typeof POPULAR_BANKS[0]) => {
    if (!user) return;
    setIsModalOpen(false);
    setIsConnectingBank(false);
    setLoading(true);

    // Simulate Auth flow
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      const { data: newWallet, error } = await supabase.from('wallets').insert([{
        user_id: user.id,
        name: bank.name,
        type: 'bank',
        is_connected: true,
        last_sync: new Date().toISOString(),
        balance: Math.random() * 25000 + 5000
      }]).select().single();

      if (error) throw error;
      
      // Auto-create a connection record too (to keep schemas aligned)
      await supabase.from('bank_connections').insert([{
        user_id: user.id,
        institution_name: bank.name,
        institution_id: bank.id,
        status: 'connected',
        last_sync: new Date().toISOString(),
        balance: newWallet.balance,
        wallet_id: newWallet.id
      }]);

      await fetchWallets();
    } catch (err: any) {
      console.error(err);
      alert('Error connecting bank.');
    } finally {
      setLoading(false);
    }
  };

  const filteredBanks = POPULAR_BANKS.filter(b => 
    b.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  const openAddModal = () => {
    setEditingWallet(null);
    setName('');
    setType('bank');
    setInitialBalance('');
    setIsModalOpen(true);
  };

  const openEditModal = (wallet: WalletData, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingWallet(wallet);
    setName(wallet.name);
    setType(wallet.type);
    setInitialBalance(wallet.balance.toString());
    setIsModalOpen(true);
  };

  const handleDeleteWallet = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
      if (confirm(t.confirmDeleteWallet)) {
      try {
        const { error } = await supabase.from('wallets').delete().eq('id', id);
        if (error) throw error;
        setWallets(prev => prev.filter(w => w.id !== id));
      } catch (err: any) {
        console.error('Error deleting wallet:', err.message);
        alert(t.errorTitle || "Erro");
      }
    }
  };

  const handleSaveWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const balanceNum = parseFloat(initialBalance) || 0;
      
      if (editingWallet) {
        // Atualizar carteira existente
        const { data, error } = await supabase
          .from('wallets')
          .update({ name, type, balance: balanceNum })
          .eq('id', editingWallet.id)
          .select()
          .single();

        if (error) throw error;
        setWallets(prev => prev.map(w => w.id === editingWallet.id ? data : w));
      } else {
        // Criar nova carteira
        const { data: newWallet, error } = await supabase
          .from('wallets')
          .insert([{ name, type, balance: balanceNum, user_id: user.id }])
          .select()
          .single();

        if (error) throw error;

        if (balanceNum > 0) {
          await supabase.from('transactions').insert([{
            type: 'income', category: 'adjustment', amount: balanceNum,
            description: `Saldo Inicial - ${name}`, user_id: user.id, wallet_id: newWallet.id
          }]);
        }
        setWallets(prev => [...prev, newWallet]);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error saving wallet:', err.message);
      alert("Erro ao salvar carteira. Verifique se as tabelas foram criadas no banco de dados.");
    }
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'physical': return <Banknote className="size-5" />;
      case 'bank': return <Landmark className="size-5" />;
      case 'digital': return <Smartphone className="size-5" />;
      default: return <Wallet className="size-5" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
          <div className="p-2 bg-slate-900 rounded-xl">
             <Wallet className="size-5 text-emerald-400" />
          </div>
          {t.myWallets}
        </h3>
        <button 
          onClick={openAddModal}
          className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
        >
          <Plus className="size-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {wallets.map((wallet) => (
          <motion.div 
            key={wallet.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="group relative bg-white rounded-[2rem] p-6 border border-slate-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-50 transition-all cursor-pointer overflow-hidden"
          >
            {/* Ações Rápidas (Editar / Excluir) que aparecem ao passar o mouse */}
            <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
               <button onClick={(e) => openEditModal(wallet, e)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors">
                  <Edit2 className="size-4" />
               </button>
               <button onClick={(e) => handleDeleteWallet(wallet.id, e)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors">
                  <Trash2 className="size-4" />
               </button>
            </div>

            <div className="flex items-start justify-between mb-6">
              <div className={cn(
                "p-3 rounded-2xl transition-colors",
                wallet.type === 'physical' ? "bg-amber-50 text-amber-600 group-hover:bg-amber-100" :
                wallet.type === 'bank' ? "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100" :
                "bg-blue-50 text-blue-600 group-hover:bg-blue-100"
              )}>
                {getIcon(wallet.type)}
              </div>

              {wallet.type === 'bank' && (
                <div className="flex items-center gap-2">
                  {wallet.is_connected && (
                    <button 
                      onClick={(e) => handleSync(wallet.id, e)}
                      disabled={syncingId === wallet.id}
                      className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all active:scale-95 disabled:opacity-50"
                      title={t.syncNow}
                    >
                      <RefreshCw className={cn("size-4", syncingId === wallet.id && "animate-spin")} />
                    </button>
                  )}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[8px] font-black uppercase tracking-widest">
                      {wallet.is_connected ? 'Live Sync' : 'Static'}
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t[wallet.type + 'Wallet'] || wallet.type}</p>
              <h4 className="text-lg font-bold text-slate-900 pr-16 truncate">{wallet.name}</h4>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-50">
              <p className="text-2xl font-black text-slate-900 tracking-tighter">{formatCurrency(wallet.balance)}</p>
            </div>
          </motion.div>
        ))}

        <motion.div 
          onClick={openAddModal}
          className="bg-emerald-50/50 rounded-[2rem] p-6 text-emerald-600 border-2 border-dashed border-emerald-200 flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-50 hover:border-emerald-300 transition-all min-h-[180px]"
        >
           <Plus className="size-8 mb-2 opacity-50" />
           <span className="text-sm font-bold tracking-tight">{t.addWallet}</span>
        </motion.div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-slate-900">
                  {isConnectingBank ? t.selectBank : (editingWallet ? t.editWallet : t.addWallet)}
                </h3>
                <button onClick={() => {
                  if (isConnectingBank) setIsConnectingBank(false);
                  else setIsModalOpen(false);
                }} className="p-2 hover:bg-slate-50 rounded-xl">
                  {isConnectingBank ? <ChevronRight className="size-5 text-slate-400 rotate-180" /> : <X className="size-5 text-slate-400" />}
                </button>
              </div>

              <AnimatePresence mode="wait">
                {isConnectingBank ? (
                  <motion.div 
                    key="bank-list"
                    initial={{ x: 100, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -100, opacity: 0 }}
                    className="space-y-6"
                  >
                    <div className="relative mb-6">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-300" />
                      <input 
                        type="text" 
                        placeholder="Buscar banco..." 
                        value={bankSearch}
                        onChange={e => setBankSearch(e.target.value)}
                        className="w-full bg-slate-50 border-none rounded-xl pl-12 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {filteredBanks.map(bank => (
                        <button
                          key={bank.id}
                          onClick={() => handleConnectBank(bank)}
                          className="p-4 bg-slate-50 border border-transparent rounded-2xl hover:border-emerald-500 hover:bg-emerald-50/50 transition-all flex flex-col items-center gap-3 group"
                        >
                          <div className={cn(
                            "size-12 rounded-xl flex items-center justify-center text-white text-lg font-black shadow-lg transform group-hover:scale-110 transition-transform",
                            bank.color
                          )}>
                            {bank.name.charAt(0)}
                          </div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover:text-emerald-600 text-center">{bank.name}</span>
                        </button>
                      ))}
                    </div>

                    <div className="pt-6 border-t border-slate-50 flex items-center gap-3 text-emerald-500">
                      <ShieldCheck className="size-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Conexão 100% Criptografada</span>
                    </div>
                  </motion.div>
                ) : (
                  <motion.form 
                    key="manual-form"
                    initial={{ x: -100, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 100, opacity: 0 }}
                    onSubmit={handleSaveWallet} 
                    className="space-y-6"
                  >
                    {!editingWallet && (
                      <button 
                        type="button"
                        onClick={() => setIsConnectingBank(true)}
                        className="w-full bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-2xl p-6 flex flex-col items-center gap-2 group hover:bg-emerald-100 transition-all"
                      >
                        <Zap className="size-6 group-hover:scale-110 transition-transform" />
                        <div className="text-center">
                          <p className="text-xs font-black uppercase tracking-widest">Conectar via Open Finance</p>
                          <p className="text-[10px] font-medium opacity-70">Sincronização automática em tempo real</p>
                        </div>
                      </button>
                    )}

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">{t.walletName}</label>
                      <input 
                        type="text" value={name} onChange={e => setName(e.target.value)}
                        placeholder="Ex: Minha Conta Nubank"
                        className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">{t.walletType}</label>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { id: 'bank', icon: Landmark, label: t.bankAccount },
                          { id: 'physical', icon: Banknote, label: t.physicalWallet },
                          { id: 'digital', icon: Smartphone, label: t.digitalWallet }
                        ].map((opt) => (
                          <button
                            key={opt.id} type="button" onClick={() => setType(opt.id as any)}
                            className={cn(
                              "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                              type === opt.id ? "bg-emerald-50 border-emerald-500 text-emerald-600" : "bg-slate-50 border-transparent text-slate-400"
                            )}
                          >
                            <opt.icon className="size-5" />
                            <span className="text-[8px] font-black uppercase tracking-tight text-center">{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">{t.initialBalance}</label>
                      <input 
                        type="number" step="0.01" value={initialBalance} onChange={e => setInitialBalance(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none"
                      />
                    </div>

                    <button 
                      type="submit"
                      className="w-full bg-slate-900 text-white rounded-2xl py-4 font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200 mt-4"
                    >
                      {t.save}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}