import { createClient } from '@supabase/supabase-js';

// 1. Pega as variáveis do ficheiro .env que você acabou de criar
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 2. Trava de segurança para garantir que as variáveis foram carregadas
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ ERRO CRÍTICO: Variáveis de ambiente do Supabase não encontradas.');
  console.error('Certifique-se de que o arquivo .env existe na raiz do projeto com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
}

// 3. Cria a conexão única (Singleton) com o banco de dados real
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

export const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (isConfigured) {
  console.log('✅ Supabase: Conectado com sucesso ao projeto real!');
}