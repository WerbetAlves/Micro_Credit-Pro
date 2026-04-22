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
  const { user, profile, loading } = useAuth();

  // 1. Enquanto o AuthContext estiver a sincronizar (User + Profile), 
  // não tomamos NENHUMA decisão de rota e não renderizamos nada.
  // (O spinner de "Sincronizando Emerald Pro" já está a ser mostrado no App.tsx)
  if (loading) {
    return null; 
  }

  // 2. Barreira de Autenticação: Sem utilizador? Login direto.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 3. Barreira de Administração: 
  // Se a rota exige admin, mas o perfil não existe ou is_admin não é true.
  if (requireAdmin && !profile?.is_admin) {
    console.warn("Acesso negado: Utilizador não é administrador.");
    return <Navigate to="/" replace />;
  }

  // Se passou por todas as barreiras, pode entrar!
  return <>{children}</>;
}