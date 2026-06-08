import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, Landmark, LifeBuoy, Search, Users, Wallet } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getInstallmentDisplayStatus } from '../lib/installments';
import { supabase } from '../lib/supabase';

type SearchItem = {
  id: string;
  title: string;
  subtitle: string;
  target: string;
};

type SearchSection = {
  title: string;
  route: string;
  icon: React.ComponentType<{ className?: string }>;
  items: SearchItem[];
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
    void fetchResults();
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
              target: `/clients?client=${encodeURIComponent(client.id)}&search=${encodeURIComponent(client.full_name)}`,
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
              target: `/loans?loan=${encodeURIComponent(loan.id)}&search=${encodeURIComponent(loan.clients?.full_name || '')}`,
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
              target: `/financial?wallet=${encodeURIComponent(wallet.id)}&search=${encodeURIComponent(wallet.name)}`,
            })),
        },
        {
          title: 'Parcelas',
          route: '/payments',
          icon: CalendarDays,
          items: ((installments || []) as any[])
            .filter((installment) => {
              const displayStatus = getInstallmentDisplayStatus(installment);

              return [
                installment.loans?.clients?.full_name || '',
                displayStatus,
                installment.due_date,
                String(installment.amount || ''),
              ].some((value) => String(value).toLowerCase().includes(normalized));
            })
            .slice(0, 8)
            .map((installment) => {
              const displayStatus = getInstallmentDisplayStatus(installment);

              return {
                id: installment.id,
                title: installment.loans?.clients?.full_name || 'Parcela',
                subtitle: `${formatCurrency(Number(installment.amount || 0))} • ${displayStatus} • ${installment.due_date}`,
                target: `/payments?installment=${encodeURIComponent(installment.id)}&search=${encodeURIComponent(installment.loans?.clients?.full_name || '')}`,
              };
            }),
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
              target: `/support?ticket=${encodeURIComponent(ticket.id)}&search=${encodeURIComponent(ticket.subject)}`,
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

        <div className="mx-auto w-full max-w-[1200px] space-y-6 px-4 py-6 md:px-6 lg:px-8 lg:py-10">
          <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm lg:p-8">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-50 text-emerald-500">
                <Search className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 lg:text-xl">Resultados para "{query || '...'}"</h2>
                <p className="text-sm text-slate-500">{totalResults} resultado(s) encontrados.</p>
              </div>
            </div>
          </div>

          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm lg:p-8">
                <div className="mb-6 h-4 w-1/4 rounded bg-slate-100" />
                <div className="space-y-4">
                  <div className="h-12 rounded-2xl bg-slate-100" />
                  <div className="h-12 rounded-2xl bg-slate-100" />
                </div>
              </div>
            ))
          ) : sections.length === 0 ? (
            <div className="rounded-[2rem] border border-slate-100 bg-white p-12 text-center font-medium text-slate-400">
              Nenhum resultado encontrado para sua busca.
            </div>
          ) : (
            sections.map((section) => {
              const Icon = section.icon;

              return (
                <div key={section.title} className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm">
                  <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-5 lg:px-8">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-2xl bg-slate-50 text-emerald-500">
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
                        onClick={() => navigate(item.target)}
                        className="w-full px-6 py-4 text-left transition-colors hover:bg-slate-50 lg:px-8"
                      >
                        <p className="text-sm font-bold text-slate-900">{item.title}</p>
                        <p className="mt-1 text-sm text-slate-500">{item.subtitle}</p>
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
