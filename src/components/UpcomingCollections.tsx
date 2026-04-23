import { useState, useEffect } from 'react';
import { MessageSquare, ChevronRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useRealtimeRefresh } from '../lib/useRealtimeRefresh';

interface CollectionItem {
  id: string;
  name: string;
  date: string;
  amount: number;
  phone: string;
}

export function UpcomingCollections() {
  const { t, formatCurrency, formatDate } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchUpcomingCollections();
  }, [user]);

  useRealtimeRefresh({
    enabled: !!user,
    channelKey: `upcoming-collections-${user?.id || 'guest'}`,
    tables: ['installments', 'loans', 'clients'],
    onRefresh: () => fetchUpcomingCollections(true),
  });

  async function fetchUpcomingCollections(silent = false) {
    if (!user) return;
    try {
      if (!silent) {
        setLoading(true);
      }

      const { data, error } = await supabase
        .from('installments')
        .select(`
          id,
          due_date,
          amount,
          loans!inner (
            user_id,
            clients (
              full_name,
              phone
            )
          )
        `)
        .eq('loans.user_id', user.id)
        .eq('status', 'upcoming')
        .order('due_date', { ascending: true })
        .limit(5);

      if (error) throw error;

      const formatted = (data || []).map((item: any) => ({
        id: item.id,
        name: item.loans?.clients?.full_name || 'Unknown',
        date: item.due_date,
        amount: Number(item.amount || 0),
        phone: item.loans?.clients?.phone || '',
      }));

      setCollections(formatted);
    } catch (err: any) {
      console.error('Error fetching collections:', err.message);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  const getWhatsAppLink = (name: string, amount: number, date: string, phone: string) => {
    const formattedAmount = formatCurrency(amount);
    const formattedDate = formatDate(date);
    const message = t.waMessage
      .replace('{name}', name)
      .replace('{nome}', name)
      .replace('{amount}', formattedAmount)
      .replace('{valor}', formattedAmount)
      .replace('{date}', formattedDate)
      .replace('{data}', formattedDate);

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <section className="bg-white rounded-[2rem] shadow-sm border border-slate-50 overflow-hidden">
      <div className="p-6 lg:p-8 flex items-center justify-between">
        <h3 className="text-lg lg:text-xl font-bold tracking-tight text-slate-900">{t.upcomingCollections}</h3>
        <button
          onClick={() => navigate('/calendar')}
          className="text-emerald-500 font-bold text-xs uppercase tracking-widest hover:underline flex items-center gap-1"
        >
          {t.viewAll} <ChevronRight className="size-3" />
        </button>
      </div>

      <div className="px-6 lg:px-8 pb-6 lg:pb-8 overflow-hidden">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={`collections-skeleton-${index}`} className="p-5 bg-slate-50/60 rounded-2xl animate-pulse space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-200" />
                    <div className="space-y-2">
                      <div className="h-3 w-28 rounded-full bg-slate-200" />
                      <div className="h-2.5 w-16 rounded-full bg-slate-100" />
                    </div>
                  </div>
                  <div className="h-4 w-20 rounded-full bg-slate-200" />
                </div>
                <div className="h-11 w-full rounded-xl bg-slate-200" />
              </div>
            ))}
          </div>
        ) : collections.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
            <p className="text-sm font-bold text-slate-900">Nenhuma cobranca futura encontrada.</p>
            <p className="mt-2 text-xs font-medium text-slate-500">
              Quando houver parcelas a receber nos proximos dias, elas aparecerao aqui.
            </p>
          </div>
        ) : (
          <>
            <div className="lg:hidden space-y-4">
              {collections.map((item) => (
                <div key={item.id} className="p-5 bg-slate-50/50 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-black text-xs">
                        {item.name
                          .split(' ')
                          .map((namePart) => namePart[0])
                          .join('')}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900">{item.name}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {formatDate(item.date)}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm font-black text-slate-900">{formatCurrency(item.amount)}</p>
                  </div>

                  <a
                    href={getWhatsAppLink(item.name, item.amount, item.date, item.phone)}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl text-[10px] font-black transition-all shadow-md shadow-emerald-100 active:scale-95 uppercase tracking-widest"
                  >
                    <MessageSquare className="size-3" />
                    {t.whatsapp}
                  </a>
                </div>
              ))}
            </div>

            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-[0.15em]">
                    <th className="pb-4 font-bold">{t.clientName}</th>
                    <th className="pb-4 font-bold">{t.dueDate}</th>
                    <th className="pb-4 font-bold">{t.amount}</th>
                    <th className="pb-4 font-bold text-right">{t.action}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50/50">
                  {collections.map((item) => (
                    <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold text-xs group-hover:bg-emerald-100 transition-colors">
                            {item.name
                              .split(' ')
                              .map((namePart) => namePart[0])
                              .join('')}
                          </div>
                          <span className="text-sm font-bold text-slate-900">{item.name}</span>
                        </div>
                      </td>
                      <td className="py-6 text-sm text-slate-500 font-medium">{formatDate(item.date)}</td>
                      <td className="py-6 text-sm font-black text-slate-900">{formatCurrency(item.amount)}</td>
                      <td className="py-6 text-right">
                        <a
                          href={getWhatsAppLink(item.name, item.amount, item.date, item.phone)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-bold transition-all shadow-md shadow-emerald-100 active:scale-95 uppercase tracking-wider"
                        >
                          <MessageSquare className="size-3" />
                          {t.whatsapp}
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
