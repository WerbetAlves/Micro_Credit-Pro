import { createClient as createSupabaseClient } from '../utils/supabase/client';

// MODO FORGE SAAS: False permite conexão real se as chaves existirem. Fallback seguro.
export const FORCE_SIMULATION = false; 

// Usamos import.meta.env porque este é um projeto Vite
// Também usamos process.env como fallback para compatibilidade com o define do vite.config.ts
// @ts-ignore
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
// @ts-ignore
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '').trim();

// Function to check if the URL is valid
const isValidUrl = (url: string) => {
  try {
    return (url.startsWith('http://') || url.startsWith('https://')) && url.includes('.');
  } catch {
    return false;
  }
};

export const isConfigured = !FORCE_SIMULATION && 
  isValidUrl(supabaseUrl) && 
  supabaseAnonKey !== '' && 
  supabaseAnonKey !== 'undefined' &&
  !supabaseUrl.includes('your-project-url');

if (isConfigured) {
  console.log('✅ Supabase: Conexão de produção ATIVA');
} else {
  console.log('💡 Supabase: Rodando em modo SIMULAÇÃO (Configuração ausente ou incompleta)');
}

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
  : (() => {
      const from = (table: string) => {
        let filters: Array<{ type: string; column: string; value: any }> = [];
        
        const applyFilters = (data: any[]) => {
          let filtered = [...data];
          filters.forEach(f => {
            if (f.type === 'eq') filtered = filtered.filter(item => item[f.column] === f.value);
            if (f.type === 'neq') filtered = filtered.filter(item => item[f.column] !== f.value);
            if (f.type === 'gte') filtered = filtered.filter(item => item[f.column] >= f.value);
            if (f.type === 'lte') filtered = filtered.filter(item => item[f.column] <= f.value);
            if (f.type === 'in') filtered = filtered.filter(item => f.value.includes(item[f.column]));
          });
          return filtered;
        };

        const createChain = () => {
          let operation: 'select' | 'insert' | 'update' | 'delete' | null = null;
          let opArgs: any = null;
          let opOptions: any = null;

          const execute = async () => {
            if (operation === 'select') {
              let baseData = getLocalData(table, []);
              
              // Seed data if empty
              if (table === 'wallets' && baseData.length === 0) {
                baseData = [
                  { id: 'w1', name: 'Carteira Principal', balance: 5000, type: 'bank', user_id: '123', is_connected: false },
                  { id: 'w2', name: 'Cofre Físico', balance: 1200, type: 'physical', user_id: '123', is_connected: false }
                ];
                saveLocalData(table, baseData);
              }
              if (table === 'profiles' && baseData.length === 0) {
                baseData = [{ id: '1 profile', user_id: '123', full_name: 'Usuário Admin Demo', plan_type: 'free' }];
                saveLocalData(table, baseData);
              }

              let filtered = applyFilters(baseData);

              // Handle Joins (Hierarchical support for SaaS Emerald)
              if (opArgs?.includes('loans')) {
                const loans = getLocalData('loans', []);
                const clients = getLocalData('clients', []);
                filtered = filtered.map(item => {
                  const loan = loans.find(l => l.id === item.loan_id);
                  if (loan && opArgs.includes('clients')) {
                    loan.clients = clients.find(c => c.id === loan.client_id);
                  }
                  return { ...item, loans: loan };
                });
              } else if (opArgs?.includes('clients')) {
                const clients = getLocalData('clients', []);
                filtered = filtered.map(item => ({
                  ...item,
                  clients: clients.find(c => c.id === item.client_id)
                }));
              }

              const count = filtered.length;

              if (opOptions?.head) {
                return { data: null, error: null, count };
              }

              return { data: filtered, error: null, count };
            }

            if (operation === 'insert') {
              const current = getLocalData(table, []);
              const newItems = Array.isArray(opArgs) ? opArgs : [opArgs];
              const toInsert = newItems.map(item => ({
                id: crypto.randomUUID(),
                created_at: new Date().toISOString(),
                ...item
              }));
              const updated = [...current, ...toInsert];
              saveLocalData(table, updated);
              return { data: Array.isArray(opArgs) ? toInsert : toInsert[0], error: null };
            }

            if (operation === 'update') {
              const current = getLocalData(table, []);
              const updated = current.map((item: any) => {
                let matches = true;
                filters.forEach(f => {
                  if (f.type === 'eq' && item[f.column] !== f.value) matches = false;
                });
                
                if (matches) {
                  return { ...item, ...opArgs };
                }
                return item;
              });
              saveLocalData(table, updated);
              return { data: opArgs, error: null };
            }

            if (operation === 'delete') {
              const current = getLocalData(table, []);
              const updated = current.filter((item: any) => {
                let matches = true;
                filters.forEach(f => {
                  if (f.type === 'eq' && item[f.column] !== f.value) matches = false;
                });
                return !matches;
              });
              saveLocalData(table, updated);
              return { data: null, error: null };
            }

            return { data: [], error: null };
          };

          const chain: any = {
            then: (resolve: any) => {
              execute().then(resolve);
            },
            select: (columns?: string, options?: { count?: string; head?: boolean }) => {
              operation = 'select';
              opArgs = columns;
              opOptions = options;
              return chain;
            },
            insert: (rows: any | any[]) => {
              operation = 'insert';
              opArgs = rows;
              return chain;
            },
            update: (updates: any) => {
              operation = 'update';
              opArgs = updates;
              return chain;
            },
            delete: () => {
              operation = 'delete';
              return chain;
            },
            eq: (column: string, value: any) => {
              filters.push({ type: 'eq', column, value });
              return chain;
            },
            neq: (column: string, value: any) => {
              filters.push({ type: 'neq', column, value });
              return chain;
            },
            gte: (column: string, value: any) => {
              filters.push({ type: 'gte', column, value });
              return chain;
            },
            lte: (column: string, value: any) => {
              filters.push({ type: 'lte', column, value });
              return chain;
            },
            in: (column: string, value: any[]) => {
              filters.push({ type: 'in', column, value });
              return chain;
            },
            upsert: (rows: any | any[]) => {
              operation = 'insert';
              opArgs = rows;
              return chain;
            },
            order: () => chain,
            limit: () => chain,
            single: async () => {
              const { data, error } = await execute();
              return { data: (data && Array.isArray(data)) ? data[0] : (data || null), error };
            },
            maybeSingle: async () => {
              const { data, error } = await execute();
              return { data: (data && Array.isArray(data)) ? data[0] : (data || null), error };
            }
          };
          return chain;
        };

        return createChain();
      };

      return {
        from,
        auth: {
          signInWithPassword: () => Promise.resolve({ data: { user: { id: '123', email: 'admin@emerald.pro' }, session: { access_token: 'abc' } }, error: null }),
          signInWithOAuth: () => Promise.resolve({ data: { user: { id: '123' } }, error: null }),
          signUp: () => Promise.resolve({ data: { user: { id: '123' } }, error: null }),
          signOut: () => Promise.resolve({ error: null }),
          onAuthStateChange: (cb: any) => {
            setTimeout(() => cb('SIGNED_IN', { user: { id: '123', email: 'admin@emerald.pro' }, session: { access_token: 'abc' } }), 100);
            return { data: { subscription: { unsubscribe: () => {} } } };
          },
          getSession: () => Promise.resolve({ data: { session: { user: { id: '123', email: 'admin@emerald.pro' }, access_token: 'abc' } }, error: null }),
          getUser: () => Promise.resolve({ data: { user: { id: '123', email: 'admin@emerald.pro' } }, error: null }),
          updateUser: (data: any) => Promise.resolve({ data: { user: { id: '123', ...data } }, error: null }),
        },
        storage: {
          from: () => ({
            upload: () => Promise.resolve({ data: { path: 'mock-path' }, error: null }),
            getPublicUrl: () => ({ data: { publicUrl: 'https://picsum.photos/seed/user/200' } }),
          })
        }
      } as any;
    })();
