import { createClient as createSupabaseClient } from '../utils/supabase/client';

// MODO FORGE SAAS: False permite conexao real se as chaves existirem. Fallback seguro.
export const FORCE_SIMULATION = false;

// Usamos import.meta.env porque este e um projeto Vite
// Tambem usamos process.env como fallback para compatibilidade com o define do vite.config.ts
// @ts-ignore
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
// @ts-ignore
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '').trim();

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
  console.log('Supabase: conexao de producao ativa');
} else {
  console.log('Supabase: rodando em modo simulacao');
}

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
      const mockSessionKey = 'sim_auth_session';
      const authListeners = new Set<(event: string, session: any) => void>();

      const buildMockSession = (user: any) => ({
        access_token: 'abc',
        refresh_token: 'mock-refresh-token',
        token_type: 'bearer',
        user,
      });

      const getStoredSession = () => {
        const saved = localStorage.getItem(mockSessionKey);
        return saved ? JSON.parse(saved) : null;
      };

      const setStoredSession = (session: any) => {
        if (session) {
          localStorage.setItem(mockSessionKey, JSON.stringify(session));
        } else {
          localStorage.removeItem(mockSessionKey);
        }
      };

      const getDefaultUser = () => ({
        id: '123',
        email: 'admin@emerald.pro',
        user_metadata: {
          full_name: 'Usuario Admin Demo',
        }
      });

      const getCurrentSession = () => {
        const stored = getStoredSession();
        if (stored) return stored;

        const session = buildMockSession(getDefaultUser());
        setStoredSession(session);
        return session;
      };

      const notifyAuthListeners = (event: string, session: any) => {
        authListeners.forEach(listener => listener(event, session));
      };

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
          let shouldReturnRows = false;

          const execute = async () => {
            if (operation === 'select') {
              let baseData = getLocalData(table, []);

              if (table === 'wallets' && baseData.length === 0) {
                baseData = [
                  { id: 'w1', name: 'Carteira Principal', balance: 5000, type: 'bank', user_id: '123', is_connected: false },
                  { id: 'w2', name: 'Cofre Fisico', balance: 1200, type: 'physical', user_id: '123', is_connected: false }
                ];
                saveLocalData(table, baseData);
              }

              if (table === 'profiles' && baseData.length === 0) {
                baseData = [{ id: '123', user_id: '123', full_name: 'Usuario Admin Demo', plan_type: 'free' }];
                saveLocalData(table, baseData);
              }

              let filtered = applyFilters(baseData);

              if (opArgs?.includes('loans')) {
                const loans = getLocalData('loans', []);
                const clients = getLocalData('clients', []);
                filtered = filtered.map(item => {
                  const loan = loans.find((l: any) => l.id === item.loan_id);
                  if (loan && opArgs.includes('clients')) {
                    loan.clients = clients.find((c: any) => c.id === loan.client_id);
                  }
                  return { ...item, loans: loan };
                });
              } else if (opArgs?.includes('clients')) {
                const clients = getLocalData('clients', []);
                filtered = filtered.map(item => ({
                  ...item,
                  clients: clients.find((c: any) => c.id === item.client_id)
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
              return {
                data: shouldReturnRows ? toInsert : (Array.isArray(opArgs) ? toInsert : toInsert[0]),
                error: null
              };
            }

            if (operation === 'update') {
              const current = getLocalData(table, []);
              const updatedRows: any[] = [];
              const updated = current.map((item: any) => {
                let matches = true;
                filters.forEach(f => {
                  if (f.type === 'eq' && item[f.column] !== f.value) matches = false;
                });

                if (matches) {
                  const merged = { ...item, ...opArgs };
                  updatedRows.push(merged);
                  return merged;
                }

                return item;
              });
              saveLocalData(table, updated);
              return { data: shouldReturnRows ? updatedRows : opArgs, error: null };
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
              if (operation === 'insert' || operation === 'update' || operation === 'delete') {
                shouldReturnRows = true;
              } else {
                operation = 'select';
                opArgs = columns;
                opOptions = options;
              }
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
              return { data: Array.isArray(data) ? data[0] : (data || null), error };
            },
            maybeSingle: async () => {
              const { data, error } = await execute();
              return { data: Array.isArray(data) ? data[0] : (data || null), error };
            }
          };

          return chain;
        };

        return createChain();
      };

      return {
        from,
        auth: {
          signInWithPassword: ({ email }: { email: string }) => {
            const session = buildMockSession({
              ...getDefaultUser(),
              email: email || 'admin@emerald.pro',
            });
            setStoredSession(session);
            notifyAuthListeners('SIGNED_IN', session);
            return Promise.resolve({ data: { user: session.user, session }, error: null });
          },
          signInWithOAuth: () => {
            const session = getCurrentSession();
            notifyAuthListeners('SIGNED_IN', session);
            return Promise.resolve({ data: { user: session.user, session }, error: null });
          },
          signUp: ({ email, options }: any) => {
            const session = buildMockSession({
              ...getDefaultUser(),
              email: email || 'admin@emerald.pro',
              user_metadata: {
                full_name: options?.data?.full_name || 'Usuario Admin Demo',
              }
            });
            setStoredSession(session);
            notifyAuthListeners('SIGNED_IN', session);
            return Promise.resolve({ data: { user: session.user, session }, error: null });
          },
          signOut: () => {
            setStoredSession(null);
            notifyAuthListeners('SIGNED_OUT', null);
            return Promise.resolve({ error: null });
          },
          onAuthStateChange: (cb: any) => {
            authListeners.add(cb);
            return {
              data: {
                subscription: {
                  unsubscribe: () => authListeners.delete(cb)
                }
              }
            };
          },
          getSession: () => Promise.resolve({ data: { session: getStoredSession() }, error: null }),
          getUser: () => {
            const session = getStoredSession();
            return Promise.resolve({ data: { user: session?.user ?? null }, error: null });
          },
          updateUser: (data: any) => {
            const currentSession = getCurrentSession();
            const updatedSession = {
              ...currentSession,
              user: {
                ...currentSession.user,
                ...data,
              }
            };
            setStoredSession(updatedSession);
            notifyAuthListeners('USER_UPDATED', updatedSession);
            return Promise.resolve({ data: { user: updatedSession.user }, error: null });
          },
        },
        storage: {
          from: () => ({
            upload: () => Promise.resolve({ data: { path: 'mock-path' }, error: null }),
            getPublicUrl: () => ({ data: { publicUrl: 'https://picsum.photos/seed/user/200' } }),
          })
        }
      } as any;
    })();
