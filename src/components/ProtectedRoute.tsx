import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function ProtectedRoute({ 
  children, 
  requireAdmin = false 
}: { 
  children: React.ReactNode;
  requireAdmin?: boolean;
}) {
  // Agora simplesmente pegamos o "profile" que já vem pronto do AuthContext!
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  // 1ª Barreira: O utilizador não está logado? Vai para o login.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 2ª Barreira: A rota exige admin, mas o campo is_admin do perfil é falso? Vai para o Dashboard.
  // Note como ficou mais fácil ler o profile?.is_admin diretamente!
  if (requireAdmin && profile?.is_admin === false) {
    return <Navigate to="/" replace />;
  }

  // Se passou por todas as barreiras, pode entrar!
  return <>{children}</>;
}