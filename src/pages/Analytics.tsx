import React, { useState, useEffect } from 'react';
import { Sidebar } from '../components/Sidebar';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, BrainCircuit, Activity, 
  Target, ShieldAlert, Zap, Layers, Landmark, Sparkles,
  ArrowRight
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { cn } from '../lib/utils';

const COLORS = ['#10b981', '#f43f5e', '#f59e0b', '#3b82f6', '#8b5cf6'];

export function Analytics() {
  const { t, formatCurrency } = useLanguage();
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);

  const [stats, setStats] = useState({
    totalPortfolio: 0,
    delinquencyRate: 0,
    expectedRevenue: 0,
    growthRate: 0,
    statusDistribution: [] as any[],
    monthlyVolume: [] as any[],
  });

  useEffect(() => {
    if (user) {
      fetchAnalyticsData();
    }
  }, [user]);

  async function fetchAnalyticsData() {
    setLoading(true);
    try {
      // 1. Fetch Loans & Status Distribution
      const { data: loans, error: loansError } = await supabase
        .from('loans')
        .select('*');
      
      if (loansError) throw loansError;

      // 2. Fetch Installments for Delinquency
      const { data: installments, error: instError } = await supabase
        .from('installments')
        .select('*');

      if (instError) throw instError;

      // Calculations
      const totalPortfolio = loans.reduce((acc, l) => acc + Number(l.principal_amount), 0);
      
      const lateAmount = installments
        .filter(i => i.status === 'late' || i.status === 'missed')
        .reduce((acc, i) => acc + Number(i.amount), 0);
      
      const totalUpcomingAmount = installments
        .reduce((acc, i) => acc + Number(i.amount), 0);

      const delinquencyRate = totalUpcomingAmount > 0 
        ? (lateAmount / totalUpcomingAmount) * 100 
        : 0;

      const expectedRevenue = installments
        .filter(i => i.status === 'upcoming' || i.status === 'late')
        .reduce((acc, i) => acc + Number(i.amount), 0);

      // Status Distribution
      const statusCounts = loans.reduce((acc: any, l) => {
        acc[l.status] = (acc[l.status] || 0) + 1;
        return acc;
      }, {});

      const statusDistribution = Object.entries(statusCounts).map(([name, value]) => ({
        name: t[name as keyof typeof t] || name,
        value
      }));

      // Monthly Volume (Mocking grouping for now, ideally aggregation query)
      const monthlyData = loans.reduce((acc: any, l) => {
        const month = new Date(l.created_at).toLocaleDateString([], { month: 'short' });
        if (!acc[month]) acc[month] = { month, amount: 0 };
        acc[month].amount += Number(l.principal_amount);
        return acc;
      }, {});

      setStats({
        totalPortfolio,
        delinquencyRate,
        expectedRevenue,
        growthRate: 12.5, // Mock value
        statusDistribution,
        monthlyVolume: Object.values(monthlyData),
      });

    } catch (err: any) {
      console.error('Analytics Fetch Error:', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function generateAIInsights() {
    setAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `
        Aja como um consultor estratégico de elite para uma empresa de microcrédito (Emerald Micro-Credit).
        Analise os seguintes dados do negócio e forneça 3 recomendações estratégicas curtas e acionáveis.
        
        Dados Atuais:
        - Carteira Total: ${formatCurrency(stats.totalPortfolio)}
        - Taxa de Inadimplência: ${stats.delinquencyRate.toFixed(2)}%
        - Receita Esperada: ${formatCurrency(stats.expectedRevenue)}
        - Distribuição de Status: ${JSON.stringify(stats.statusDistribution)}
        
        Responda em Português no seguinte formato:
        1. [Título curto] - [Explicação]
        2. [Título curto] - [Explicação]
        3. [Título curto] - [Explicação]
        
        Mantenha o tom profissional e focado em lucro e mitigação de risco.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setAiInsight(response.text);
    } catch (err: any) {
      console.error('Gemini Error:', err.message);
      setAiInsight("Desculpe, não conseguimos conectar com o consultor de IA agora. Verifique sua chave de API.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#f8fafc] overflow-x-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="flex-1 lg:ml-72 min-h-screen pb-20 w-full transition-all duration-300">
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-4 lg:px-8 py-4 lg:py-5">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-500">
              <Landmark className="size-6" />
            </button>
            <h1 className="text-lg lg:text-xl font-bold tracking-tight text-slate-900">{t.analytics}</h1>
          </div>
        </header>

        <div className="px-4 lg:px-8 py-8 w-full space-y-8">
          
          {/* AI Consultant Hero */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden bg-white border border-slate-100 rounded-[2.5rem] p-8 lg:p-10 shadow-sm"
          >
            <div className="relative z-10 grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-4">
                  <BrainCircuit className="size-3" />
                  AI Business Intelligence
                </div>
                <h2 className="text-3xl lg:text-4xl font-black text-slate-900 leading-tight mb-4">
                  Insights Estratégicos com Emerald AI
                </h2>
                <p className="text-slate-500 font-medium mb-8 max-w-md">
                  Nossa inteligência analisa sua carteira em tempo real para identificar riscos ocultos e oportunidades de escala.
                </p>
                <button 
                  onClick={generateAIInsights}
                  disabled={aiLoading}
                  className="group flex items-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold text-sm tracking-tight hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                >
                  {aiLoading ? (
                    <Zap className="size-4 animate-pulse text-amber-400" />
                  ) : (
                    <Sparkles className="size-4 text-emerald-400 group-hover:rotate-12 transition-transform" />
                  )}
                  {aiLoading ? "Consultando Mentoria..." : "Gerar Insights de Negócio"}
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 min-h-[200px] flex items-center justify-center relative">
                {aiLoading ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="size-10 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Processando dados da carteira...</p>
                  </div>
                ) : aiInsight ? (
                  <div className="text-slate-700 font-medium text-sm whitespace-pre-wrap leading-relaxed">
                    {aiInsight}
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    <Target className="size-10 text-slate-200 mx-auto" />
                    <p className="text-xs text-slate-400 font-medium">Clique no botão para iniciar a análise estratégica.</p>
                  </div>
                )}
                <BrainCircuit className="absolute bottom-4 right-4 size-16 text-slate-100 z-0" />
              </div>
            </div>
          </motion.div>

          {/* Strategic KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Yield on Capital', value: '18.4%', icon: TrendingUp, color: 'text-emerald-500' },
              { label: 'Overdue Risk', value: formatCurrency(stats.totalPortfolio * (stats.delinquencyRate/100)), icon: ShieldAlert, color: 'text-rose-500' },
              { label: 'Account Health', value: '94.2/100', icon: Activity, color: 'text-indigo-500' },
              { label: 'Capital Velocity', value: 'x1.4', icon: Zap, color: 'text-amber-500' },
            ].map((kpi, i) => (
              <motion.div 
                key={kpi.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-6 rounded-3xl border border-slate-50 shadow-sm"
              >
                <div className="flex items-center justify-between mb-4">
                   <div className="p-2 bg-slate-50 rounded-xl">
                      <kpi.icon className={cn("size-5", kpi.color)} />
                   </div>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{kpi.label}</p>
                <p className="text-2xl font-black text-slate-900 tracking-tighter">{kpi.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Charts Grid */}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 border border-slate-50 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-8 uppercase tracking-tight flex items-center gap-2">
                <Layers className="size-4 text-emerald-500" />
                Monthly Disbursement Volume
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.monthlyVolume}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                      tickFormatter={(val) => `R$${val/1000}k`}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -1px rgb(0 0 0 / 0.1)' }}
                      cursor={{ fill: '#f8fafc' }}
                    />
                    <Bar dataKey="amount" fill="#10b981" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl shadow-slate-200 overflow-hidden relative">
              <h3 className="text-lg font-black mb-8 uppercase tracking-tight">Portfolio Health</h3>
              <div className="h-[250px] relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {stats.statusDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3 mt-4">
                 {stats.statusDistribution.map((entry, index) => (
                   <div key={entry.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                         <div className="size-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                         <span className="text-slate-400 font-bold uppercase tracking-widest">{entry.name}</span>
                      </div>
                      <span className="font-black">{entry.value} loans</span>
                   </div>
                 ))}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
