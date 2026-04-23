import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Users, Landmark, Wallet, CalendarDays, LifeBuoy } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';

type SearchSection = {
  title: string;
  route: string;
  icon: any;
  items: Array<{
    id: string;
    title: string;
    subtitle: string;
  }>;
};

export function SearchResults() {
  const { user } = useAuth();
  const { formatCurrency } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = (searchParams.get('q') || '').trim();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sections, setSections] = useState<SearchSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResults();
  }, [user, query]);

  async function fetchResults() {
    if (!user) return;

    if (!query) {
      setSections([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const normalized = query.toLowerCase();
      const [{ data: clients }, { data: loans }, { data: wallets }, { data: installments }, { data: tickets }] =
        await Promise.all([
          supabase.from('clients').select('id, full_name, phone, email').eq('user_id', user.id),
          supabase.from('loans').select('id, principal_amount, status, clients(full_name)').eq('user_id', user.id),
          supabase.from('wallets').select('id, name, balance, type').eq('user_id', user.id),
          supabase
            .from('installments')
            .select('id, due_date, amount, status, loans!inner(user_id, clients(full_name))')
            .eq('loans.user_id', user.id),
          supabase.from('support_tickets').select('id, subject, status, description').eq('user_id', user.id),
        ]);

      const resultSections: SearchSection[] = [
        {
          title: 'Clientes',
          route: '/clients',
          icon: Users,
          items: ((clients || []) as any[])
            .filter((client) =>
              [client.full_name, client.phone, client.email || ''].some((value) =>
                String(value).toLowerCase().includes(normalized)
              )
            )
            .slice(0, 8)
            .map((client) => ({
              id: client.id,
              title: client.full_name,
              subtitle: `${client.phone}${client.email ? ` • ${client.email}` : ''}`,
            })),
        },
        {
          title: 'Emprestimos',
          route: '/loans',
          icon: Landmark,
          items: ((loans || []) as any[])
            .filter((loan) =>
              [loan.clients?.full_name || '', loan.status, String(loan.principal_amount || '')].some((value) =>
                String(value).toLowerCase().includes(normalized)
              )
            )
            .slice(0, 8)
            .map((loan) => ({
              id: loan.id,
              title: loan.clients?.full_name || 'Emprestimo sem cliente',
              subtitle: `${formatCurrency(Number(loan.principal_amount || 0))} • ${loan.status}`,
            })),
        },
        {
          title: 'Carteiras',
          route: '/financial',
          icon: Wallet,
          items: ((wallets || []) as any[])
            .filter((wallet) =>
              [wallet.name, wallet.type, String(wallet.balance || '')].some((value) =>
                String(value).toLowerCase().includes(normalized)
              )
            )
            .slice(0, 8)
            .map((wallet) => ({
              id: wallet.id,
              title: wallet.name,
              subtitle: `${formatCurrency(Number(wallet.balance || 0))} • ${wallet.type}`,
            })),
        },
        {
          title: 'Parcelas',
          route: '/payments',
          icon: CalendarDays,
          items: ((installments || []) as any[])
            .filter((installment) =>
              [
                installment.loans?.clients?.full_name || '',
                installment.status,
                installment.due_date,
                String(installment.amount || ''),
              ].some((value) => String(value).toLowerCase().includes(normalized))
            )
            .slice(0, 8)
            .map((installment) => ({
              id: installment.id,
              title: installment.loans?.clients?.full_name || 'Parcela',
              subtitle: `${formatCurrency(Number(installment.amount || 0))} • ${installment.status} • ${installment.due_date}`,
            })),
        },
        {
          title: 'Suporte',
          route: '/support',
          icon: LifeBuoy,
          items: ((tickets || []) as any[])
            .filter((ticket) =>
              [ticket.subject, ticket.status, ticket.description || ''].some((value) =>
                String(value).toLowerCase().includes(normalized)
              )
            )
            .slice(0, 8)
            .map((ticket) => ({
              id: ticket.id,
              title: ticket.subject,
              subtitle: ticket.status,
            })),
        },
      ].filter((section) => section.items.length > 0);

      setSections(resultSections);
    } catch (error) {
      console.error('Error fetching global search results:', error);
      setSections([]);
    } finally {
      setLoading(false);
    }
  }

  const totalResults = useMemo(
    () => sections.reduce((acc, section) => acc + section.items.length, 0),
    [sections]
  );

  return (
    <div className="flex min-h-screen bg-[#f8fafc] overflow-x-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="flex-1 lg:ml-72 min-h-screen pb-20 w-full transition-all duration-300">
        <Header title="Busca Global" onMenuClick={() => setIsSidebarOpen(true)} />

        <div className="px-4 md:px-6 lg:px-8 py-6 lg:py-10 w-full max-w-[1200px] mx-auto space-y-6">
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 lg:p-8">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-2xl bg-slate-50 flex items-center justify-center text-emerald-500">
                <Search className="size-5" />
              </div>
              <div>
                <h2 className="text-lg lg:text-xl font-black text-slate-900">Resultados para “{query || '...'}”</h2>
                <p className="text-sm text-slate-500">{totalResults} resultado(s) encontrados.</p>
              </div>
            </div>
          </div>

          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 lg:p-8 animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-1/4 mb-6" />
                <div className="space-y-4">
                  <div className="h-12 bg-slate-100 rounded-2xl" />
                  <div className="h-12 bg-slate-100 rounded-2xl" />
                </div>
              </div>
            ))
          ) : sections.length === 0 ? (
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-12 text-center text-slate-400 font-medium">
              Nenhum resultado encontrado para sua busca.
            </div>
          ) : (
            sections.map((section) => {
              const Icon = section.icon;

              return (
                <div key={section.title} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-6 lg:px-8 py-5 border-b border-slate-100 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-2xl bg-slate-50 flex items-center justify-center text-emerald-500">
                        <Icon className="size-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">{section.title}</h3>
                        <p className="text-xs text-slate-400">{section.items.length} resultado(s)</p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(section.route)}
                      className="text-[10px] font-black uppercase tracking-widest text-emerald-600"
                    >
                      Abrir pagina
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {section.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => navigate(section.route)}
                        className="w-full text-left px-6 lg:px-8 py-4 hover:bg-slate-50 transition-colors"
                      >
                        <p className="text-sm font-bold text-slate-900">{item.title}</p>
                        <p className="text-sm text-slate-500 mt-1">{item.subtitle}</p>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
