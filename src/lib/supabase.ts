import { createClient as createSupabaseClient } from '../utils/supabase/client';

// MODO FORGE SAAS: Força o uso da simulação para focarmos na estrutura sem erros de banco
export const FORCE_SIMULATION = true; 

// Usamos import.meta.env porque este é um projeto Vite
// @ts-ignore
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
// @ts-ignore
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Function to check if the URL is valid
const isValidUrl = (url: string) => {
  try {
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
};

export const isConfigured = !FORCE_SIMULATION && isValidUrl(supabaseUrl) && supabaseAnonKey && !supabaseUrl.includes('your-project-url');

// HELPER: Simulação com Persistência em LocalStorage para desenvolvimento do SaaS
const getLocalData = (key: string, initial: any[]) => {
  const saved = localStorage.getItem(`sim_db_${key}`);
  if (saved) return JSON.parse(saved);
  localStorage.setItem(`sim_db_${key}`, JSON.stringify(initial));
  return initial;
};

const saveLocalData = (key: string, data: any[]) => {
  localStorage.setItem(`sim_db_${key}`, JSON.stringify(data));
};

export const supabase = isConfigured
  ? createSupabaseClient()
  : ({
      from: (table: string) => {
        const createChain = (data: any[]) => {
          const res = { data, error: null };
          const p = Promise.resolve(res);
          return Object.assign(p, {
            insert: (newRows: any[]) => {
              const current = getLocalData(table, []);
              const updated = [...current, ...newRows.map(r => ({ ...r, id: crypto.randomUUID(), created_at: new Date().toISOString() }))];
              saveLocalData(table, updated);
              return Promise.resolve({ data: newRows[0], error: null });
            },
            select: (query?: string) => {
              // Simulação básica de joins e tabelas específicas
              let baseData = getLocalData(table, []);
              
              if (table === 'wallets' && baseData.length === 0) {
                baseData = [{ id: 'w1', name: 'Carteira Principal', balance: 5000, type: 'cash', user_id: '123' }];
              }
              
              if (table === 'profiles' && baseData.length === 0) {
                baseData = [{ 
                  id: '123', 
                  full_name: 'Usuário Admin Demo', 
                  business_name: 'Minha Fomentadora',
                  document_id: '123.456.789-00',
                  phone: '(11) 98888-7777',
                  address: 'Av. Paulista, 1000 - São Paulo, SP',
                  plan_type: 'free', 
                  subscription_status: 'active',
                  role: 'admin',
                  payment_methods: [
                    { id: '1', type: 'credit', last4: '4242', brand: 'visa', name: 'Cartão Pessoal' }
                  ]
                }];
              }

              if (table === 'loans') {
                baseData = baseData.map((d: any) => ({
                  ...d,
                  legal_validation_status: d.legal_validation_status || 'not_validated',
                  sent_to_client: d.sent_to_client || false
                }));
              }

              if (table === 'notifications' && baseData.length === 0) {
                baseData = [
                  { id: '1', user_id: '123', type: 'payment', title: 'Pagamento Recebido', message: 'João Silva pagou a parcela #04.', created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), is_read: false },
                  { id: '2', user_id: '123', type: 'alert', title: 'Atraso Detectado', message: 'A parcela de Maria Oliveira está 3 dias atrasada.', created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), is_read: false },
                  { id: '3', user_id: '123', type: 'loan', title: 'Novo Empréstimo', message: 'Contrato de Carlos Mendes gerado com sucesso.', created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), is_read: true },
                ];
              }

              if (query?.includes('clients')) {
                const clients = getLocalData('clients', []);
                baseData = baseData.map((d: any) => ({ ...d, clients: clients.find((c: any) => c.id === d.client_id) }));
              }
              return createChain(baseData);
            },
            update: (updates: any) => {
              const current = getLocalData(table, []);
              const updated = current.map((item: any) => ({ ...item, ...updates }));
              saveLocalData(table, updated);
              return Promise.resolve({ data: updates, error: null });
            },
            delete: () => Promise.resolve({ data: null, error: null }),
            eq: () => createChain(data),
            order: () => createChain(data),
            single: () => Promise.resolve({ data: data[0] || null, error: null }),
            gte: () => createChain(data),
            lte: () => createChain(data),
            limit: () => createChain(data),
          });
        };

        return createChain([]);
      },
      auth: {
        signInWithPassword: () => Promise.resolve({ data: { user: { id: '123', email: 'contato@suaempresa.com', user_metadata: { full_name: 'Usuário Admin Demo' } }, session: { access_token: 'mock-token' } }, error: null }),
        signInWithOAuth: () => Promise.resolve({ data: { user: { id: '123', email: 'contato@suaempresa.com' }, session: { access_token: 'mock-token' } }, error: null }),
        signUp: () => Promise.resolve({ data: { user: { id: '123', email: 'contato@suaempresa.com' }, session: { access_token: 'mock-token' } }, error: null }),
        signOut: () => Promise.resolve({ error: null }),
        onAuthStateChange: (cb: any) => {
          setTimeout(() => cb('SIGNED_IN', { user: { id: '123', email: 'contato@suaempresa.com', user_metadata: { full_name: 'Usuário Admin Demo' }, role: 'admin' }, session: { access_token: 'mock-token' } }), 100);
          return { data: { subscription: { unsubscribe: () => {} } } };
        },
        getSession: () => Promise.resolve({ data: { session: { user: { id: '123', email: 'contato@suaempresa.com' }, access_token: 'mock-token' } }, error: null }),
        updateUser: (data: any) => Promise.resolve({ data: { user: { id: '123', ...data } }, error: null }),
        getUser: () => Promise.resolve({ data: { user: { id: '123', email: 'contato@suaempresa.com' } }, error: null }),
      }
    } as any);
