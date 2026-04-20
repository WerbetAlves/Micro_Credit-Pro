import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Dashboard } from './pages/Dashboard';
import { Clients } from './pages/Clients';
import { Loans } from './pages/Loans';
import { Payments } from './pages/Payments';
import { Financial } from './pages/Financial';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { Calendar } from './pages/Calendar';
import { Support } from './pages/Support';
import { Admin } from './pages/Admin';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext'; // 🔥 Importante

export default function App() {
  const { loading } = useAuth(); // 🔥 Puxamos o estado de carregamento global

  useEffect(() => {
    console.log('🌐 App Origin:', window.location.origin);
  }, []);

  // 🛡️ TRAVA DE SEGURANÇA: Se o Auth ainda está carregando, não renderiza nenhuma rota.
  // Isso impede que o roteador tente redirecionar você antes de saber quem você é.
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Sincronizando Emerald Pro...
          </p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/clients" 
          element={
            <ProtectedRoute>
              <Clients />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/loans" 
          element={
            <ProtectedRoute>
              <Loans />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/payments" 
          element={
            <ProtectedRoute>
              <Payments />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/financial" 
          element={
            <ProtectedRoute>
              <Financial />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/analytics" 
          element={
            <ProtectedRoute>
              <Analytics />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/calendar" 
          element={
            <ProtectedRoute>
              <Calendar />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/settings" 
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/support" 
          element={
            <ProtectedRoute>
              <Support />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute requireAdmin={true}>
              <Admin />
            </ProtectedRoute>
          } 
        />
        
        {/* Rotas Públicas */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}