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

  // 1. Enquanto o AuthContext estiver a sincronizar (User + Profile), mostramos o Loading.
  // Isso evita que o Router tome decisões precipitadas.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Verificando Credenciais...</p>
        </div>
      </div>
    );
  }

  // 2. Barreira de Autenticação: Sem utilizador? Login direto.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 3. Barreira de Administração: 
  // Se a rota exige admin, mas o perfil não existe ou is_admin não é true.
  // Usamos !profile?.is_admin para capturar tanto o 'false' quanto o 'null'.
  if (requireAdmin && !profile?.is_admin) {
    console.warn("Acesso negado: Utilizador não é administrador.");
    return <Navigate to="/" replace />;
  }

  // Se chegou aqui, as credenciais são válidas.
  return <>{children}</>;
}