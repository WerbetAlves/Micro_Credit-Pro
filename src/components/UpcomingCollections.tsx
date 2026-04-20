import { useState, useEffect, useMemo } from 'react';
import { MessageSquare, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils'; // 🔥 Caminho corrigido
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface CollectionItem {
  id: string;
  name: string;
  date: string;
  amount: number;
  phone: string;
}

// 🔥 Definimos a interface para aceitar o termo de busca
interface UpcomingCollectionsProps {
  searchTerm: string;
}

export function UpcomingCollections({ searchTerm }: UpcomingCollectionsProps) {
  const { t, formatCurrency, formatDate } = useLanguage();
  const { user } = useAuth();
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUpcomingCollections();
  }, [user]);

  async function fetchUpcomingCollections() {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('installments')
        .select(`
          id,
          due_date,
          amount,
          loans (
            user_id,
            clients (
              full_name,
              phone
            )
          )
        `)
        .eq('status', 'upcoming')
        .order('due_date', { ascending: true })
        .limit(10); // Aumentamos o limite para permitir busca local mais rica

      if (error) throw error;

      const formatted = (data || [])
        .filter((i: any) => i.loans?.user_id === user.id)
        .map((i: any) => ({
          id: i.id,
          name: i.loans?.clients?.full_name || 'Unknown',
          date: i.due_date,
          amount: i.amount,
          phone: i.loans?.clients?.phone || ''
        }));

      setCollections(formatted);
    } catch (err: any) {
      console.error('Error fetching collections:', err.message);
    } finally {
      setLoading(false);
    }
  }

  // 🔥 Lógica de filtragem baseada no que o usuário digita no Dashboard
  const filteredCollections = useMemo(() => {
    if (!searchTerm) return collections;
    return collections.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [collections, searchTerm]);

  const getWhatsAppLink = (name: string, amount: number, date: string, phone: string) => {
    const formattedAmount = formatCurrency(amount);
    const formattedDate = formatDate(date);
    const message = t.waMessage
      .replace('{name}', name)
      .replace('{amount}', formattedAmount)
      .replace('{date}', formattedDate);
      
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <section className="bg-white rounded-[2rem] shadow-sm border border-slate-50 overflow-hidden">
      <div className="p-6 lg:p-8 flex items-center justify-between">
        <h3 className="text-lg lg:text-xl font-bold tracking-tight text-slate-900">{t.upcomingCollections}</h3>
        <button className="text-emerald-500 font-bold text-xs uppercase tracking-widest hover:underline flex items-center gap-1">
          {t.viewAll} <ChevronRight className="size-3" />
        </button>
      </div>
      
      <div className="px-6 lg:px-8 pb-6 lg:pb-8">
        {loading ? (
          <div className="py-10 text-center text-slate-400 animate-pulse">{t.processing}</div>
        ) : filteredCollections.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm font-medium">
            {searchTerm ? "Nenhum cliente encontrado" : t.noReceiptsToday}
          </div>
        ) : (
          <>
            {/* Mobile View */}
            <div className="lg:hidden space-y-4">
              {filteredCollections.map((item) => (
                <div key={item.id} className="p-5 bg-slate-50/50 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-black text-xs">
                        {item.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900">{item.name}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(item.date)}</span>
                      </div>
                    </div>
                    <p className="text-sm font-black text-slate-900">{formatCurrency(item.amount)}</p>
                  </div>
                  <a href={getWhatsAppLink(item.name, item.amount, item.date, item.phone)} target="_blank" rel="noreferrer" className="w-full inline-flex items-center justify-center gap-2 bg-emerald-500 text-white py-3 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest">
                    <MessageSquare className="size-3" /> {t.whatsapp}
                  </a>
                </div>
              ))}
            </div>

            {/* Desktop View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-[0.15em]">
                    <th className="pb-4">{t.clientName}</th>
                    <th className="pb-4">{t.dueDate}</th>
                    <th className="pb-4">{t.amount}</th>
                    <th className="pb-4 text-right">{t.action}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50/50">
                  {filteredCollections.map((item) => (
                    <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold text-xs group-hover:bg-emerald-100 transition-colors">
                            {item.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="text-sm font-bold text-slate-900">{item.name}</span>
                        </div>
                      </td>
                      <td className="py-6 text-sm text-slate-500 font-medium">{formatDate(item.date)}</td>
                      <td className="py-6 text-sm font-black text-slate-900">{formatCurrency(item.amount)}</td>
                      <td className="py-6 text-right">
                        <a href={getWhatsAppLink(item.name, item.amount, item.date, item.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-[10px] font-bold transition-all uppercase tracking-wider">
                          <MessageSquare className="size-3" /> {t.whatsapp}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}