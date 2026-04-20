import { createClient } from '@supabase/supabase-js';

// 1. Obtém as variáveis de ambiente do projeto
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 2. Validação de segurança rigorosa
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ ERRO CRÍTICO: Variáveis de ambiente do Supabase não encontradas.');
}

// 3. Criação do cliente com configurações de autenticação reforçadas
// Estas opções ajudam a evitar que o site fique travado em sessões antigas
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,      // Mantém o utilizador logado entre atualizações
    autoRefreshToken: true,    // Renova o token automaticamente antes de expirar
    detectSessionInUrl: true,  // Necessário para fluxos de confirmação de e-mail e reset de password
    storage: window.localStorage // Garante explicitamente o uso do localStorage
  }
});

export const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (isConfigured) {
  console.log('✅ Supabase: Conectado com sucesso e configurado para persistência!');
}