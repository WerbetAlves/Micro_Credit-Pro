import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, 
  Plus, 
  X, 
  Landmark, 
  Banknote, 
  Smartphone,
  ChevronRight,
  PlusCircle,
  Link2
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

interface WalletData {
  id: string;
  name: string;
  type: 'physical' | 'bank' | 'digital';
  balance: number;
}

export function WalletManager() {
  const { t, formatCurrency } = useLanguage();
  const { user } = useAuth();
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<'physical' | 'bank' | 'digital'>('bank');
  const [initialBalance, setInitialBalance] = useState('');

  useEffect(() => {
    fetchWallets();
  }, [user]);

  async function fetchWallets() {
    if (!user) return;
    setLoading(true);
    try {
      // In a real app we'd have a 'wallets' table
      // For this MVP, we'll try to fetch or fallback to a default one
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        // Table might not exist yet, let's show a default one for now
        setWallets([{ id: 'default', name: t.mainPortfolio, type: 'bank', balance: 0 }]);
      } else {
        setWallets(data || []);
      }
    } catch (err) {
      console.error('Error fetching wallets:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const balanceNum = parseFloat(initialBalance) || 0;
      
      const { data: newWallet, error } = await supabase
        .from('wallets')
        .insert([{
          name,
          type,
          balance: balanceNum,
          user_id: user.id
        }])
        .select()
        .single();

      if (error) throw error;

      // If there's an initial balance, record it as a transaction
      if (balanceNum > 0) {
        await supabase.from('transactions').insert([{
          type: 'income',
          category: 'adjustment',
          amount: balanceNum,
          description: `${t.initialBalance} - ${name}`,
          user_id: user.id,
          wallet_id: newWallet.id // Assuming this column exists
        }]);
      }

      setWallets(prev => [...prev, newWallet]);
      setIsModalOpen(false);
      setName('');
      setInitialBalance('');
    } catch (err: any) {
      console.error('Error adding wallet:', err.message);
      // For Demo purposes, if it fails because table doesn't exist, we just add it to local state
      const mockWallet: WalletData = {
        id: Math.random().toString(36).substr(2, 9),
        name,
        type,
        balance: parseFloat(initialBalance) || 0
      };
      setWallets(prev => [...prev, mockWallet]);
      setIsModalOpen(false);
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
          onClick={() => setIsModalOpen(true)}
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
            className="group relative bg-white rounded-[2rem] p-6 border border-slate-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-50 transition-all cursor-pointer"
          >
            <div className="flex items-start justify-between mb-6">
              <div className={cn(
                "p-3 rounded-2xl transition-colors",
                wallet.type === 'physical' ? "bg-amber-50 text-amber-600 group-hover:bg-amber-100" :
                wallet.type === 'bank' ? "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100" :
                "bg-blue-50 text-blue-600 group-hover:bg-blue-100"
              )}>
                {getIcon(wallet.type)}
              </div>
              <ChevronRight className="size-4 text-slate-300 group-hover:text-emerald-400 transform group-hover:translate-x-1 transition-all" />
            </div>
            
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t[wallet.type + 'Wallet'] || wallet.type}</p>
              <h4 className="text-lg font-bold text-slate-900">{wallet.name}</h4>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-50">
              <p className="text-2xl font-black text-slate-900 tracking-tighter">{formatCurrency(wallet.balance)}</p>
            </div>
          </motion.div>
        ))}

        {/* Open Finance Shortcut */}
        <motion.div 
          onClick={() => {}} // Integration point
          className="bg-emerald-600 rounded-[2rem] p-6 text-white relative overflow-hidden shadow-xl shadow-emerald-50 cursor-pointer hover:scale-[1.02] transition-all group"
        >
          <div className="relative z-10 space-y-4">
             <div className="flex items-center gap-2">
                <Link2 className="size-4 text-emerald-200" />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-200 opacity-80">{t.openFinance}</span>
             </div>
             <h3 className="text-lg font-bold leading-tight">{t.connectBank}</h3>
             <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest bg-emerald-500/30 w-fit px-3 py-1.5 rounded-lg border border-emerald-400/20">
                <PlusCircle className="size-3" />
                Auth Secure
             </div>
          </div>
          <Landmark className="absolute -bottom-6 -right-6 size-32 opacity-10 rotate-12 group-hover:scale-110 transition-transform duration-500" />
        </motion.div>
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
                <h3 className="text-xl font-black text-slate-900">{t.addWallet}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl">
                  <X className="size-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleAddWallet} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">{t.walletName}</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ex: Cash flow PT-BR"
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
                        key={opt.id}
                        type="button"
                        onClick={() => setType(opt.id as any)}
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
                    type="number" 
                    step="0.01"
                    value={initialBalance}
                    onChange={e => setInitialBalance(e.target.value)}
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
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
