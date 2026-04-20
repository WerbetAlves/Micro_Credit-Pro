import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  plan_type: 'free' | 'pro' | 'enterprise';
  has_onboarded: boolean; // 🔥 Controla a animação de boas-vindas
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Função para buscar perfil com tratamento de erro
  async function fetchProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle(); 
        
      if (error) throw error;
      setProfile(data as Profile);
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
      setProfile(null);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        // 1. Tenta recuperar a sessão atual do localStorage
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Erro de sessão corrompida:", sessionError);
          await supabase.auth.signOut();
          throw sessionError;
        }

        if (mounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          
          if (initialSession?.user) {
            await fetchProfile(initialSession.user.id);
          }
        }
      } catch (error) {
        console.error("Erro na inicialização do Auth:", error);
      } finally {
        // 🔥 GARANTE que o loading pare, mesmo se o banco de dados falhar
        if (mounted) setLoading(false);
      }
    }

    initializeAuth();

    // Ouvinte para mudanças de estado (Login, Logout, etc)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setSession(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
        await fetchProfile(currentSession.user.id);
      }

      // 🔥 Libera o ecrã sempre após processar a mudança
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Erro ao sair:", error);
    } finally {
      // Limpeza manual de segurança
      setProfile(null);
      setUser(null);
      setSession(null);
      localStorage.clear(); // Limpa tokens antigos para evitar o loop de carregamento
      setLoading(false);
      window.location.href = '/login';
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}