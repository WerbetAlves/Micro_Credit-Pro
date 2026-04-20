import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  plan_type: 'free' | 'pro' | 'enterprise';
  has_onboarded: boolean;
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

  // 1. Memoizamos a função para evitar que ela dispare re-renders desnecessários
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) throw error;
      setProfile(data as Profile);
      return data;
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
      setProfile(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      setLoading(true);
      try {
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          // Se o token estiver corrompido, limpa tudo silenciosamente
          localStorage.removeItem('supabase.auth.token');
          setUser(null);
          setSession(null);
        } else if (initialSession && mounted) {
          setSession(initialSession);
          setUser(initialSession.user);
          // 🔥 Sincronia: Aguarda o perfil antes de liberar o loading
          await fetchProfile(initialSession.user.id);
        }
      } catch (error) {
        console.error("Erro na inicialização:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initializeAuth();

    // 2. Ouvinte de estado mais inteligente
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
          // Só busca o perfil se ele ainda não existir ou se o usuário mudou
          if (!profile || profile.id !== currentSession.user.id) {
            await fetchProfile(currentSession.user.id);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, profile]); // Dependências corretas para evitar loops

  const signOut = async () => {
    setLoading(true);
    try {
      // Limpa os dados ANTES para evitar que o router tente carregar dados protegidos
      setProfile(null);
      setUser(null);
      setSession(null);
      
      await supabase.auth.signOut();
      localStorage.clear();
      
      // Redirecionamento limpo
      window.location.replace('/login');
    } catch (error) {
      console.error("Erro ao sair:", error);
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