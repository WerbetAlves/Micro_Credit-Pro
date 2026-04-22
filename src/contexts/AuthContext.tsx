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

  // 1. fetchProfile memoizado com useCallback para evitar re-renders e loops infinitos
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) throw error;
      return data as Profile;
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (initialSession && mounted) {
          const userProfile = await fetchProfile(initialSession.user.id);
          if (mounted) {
            setSession(initialSession);
            setUser(initialSession.user);
            setProfile(userProfile);
          }
        }
      } catch (error) {
        console.error("Erro na inicialização:", error);
      } finally {
        // Liberta a tela de loading quer tenha sucesso ou falhe
        if (mounted) setLoading(false);
      }
    }

    initializeAuth();

    // 2. Ouvinte de estado reativo (não depende mais de 'profile' para não entrar em loop)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (currentSession) {
          const userProfile = await fetchProfile(currentSession.user.id);
          if (mounted) {
            setSession(currentSession);
            setUser(currentSession.user);
            setProfile(userProfile);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
      }
      
      // Garante que o loading para após qualquer evento do Supabase
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]); // Apenas fetchProfile na dependência (seguro pois está memoizado)

  const signOut = async () => {
    setLoading(true);
    try {
      // 1. Limpa os estados locais instantaneamente para que a UI reaja
      setProfile(null);
      setUser(null);
      setSession(null);
      
      // 2. Desloga do Supabase
      await supabase.auth.signOut();
      
      // 3. Limpa qualquer cache "fantasma" do navegador
      localStorage.clear();
      
      // 4. Redirecionamento forçado e limpo
      window.location.replace('/login');
    } catch (error) {
      console.error('Erro no logout:', error);
      window.location.href = '/login';
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const updatedProfile = await fetchProfile(user.id);
      setProfile(updatedProfile);
    }
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