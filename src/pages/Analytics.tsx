import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { parseAppDate } from '../lib/date';
import { useRealtimeRefresh } from '../lib/useRealtimeRefresh';
import { motion } from 'motion/react';
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Landmark,
  BrainCircuit,
  Sparkles,
  Zap,
  Wallet,
  ShieldAlert,
  TrendingDown,
  RotateCcw,
  Target,
  Layers,
  Activity,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { requestAi } from '../services/aiService';
import { extractLoanWriteOffMeta, isLoanWrittenOff } from '../lib/loanWriteOff';

const STATUS_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#f43f5e', '#0f172a'];
const PERIOD_OPTIONS = [
  { label: '6M', value: '6m' },
  { label: '12M', value: '12m' },
  { label: '24M', value: '24m' },
  { label: 'Tudo', value: 'all' },
] as const;

type PeriodFilter = (typeof PERIOD_OPTIONS)[number]['value'];

type AnalyticsLoan = {
  id: string;
  created_at: string;
  principal_amount: number;
  status: string;
  notes?: string | null;
};

type AnalyticsInstallment = {
  amount: number;
  status: 'upcoming' | 'paid' | 'late' | 'missed';
  due_date: string;
  loan_id?: string | null;
};

type AnalyticsTransaction = {
  amount: number;
  type: 'income' | 'expense';
  category: 'loan_disbursement' | 'payment_received' | 'fee' | 'adjustment' | 'other';
  description: string;
  created_at: string;
  loan_id?: string | null;
  loans?: {
    notes?: string | null;
  } | null;
};

type ChartBucket = {
  key: string;
  month: string;
  concessao: number;
  inadimplencia: number;
  baixas: number;
  recuperado: number;
  recebimentos: number;
};

type SummaryCard = {
  label: string;
  value: string;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  tone: string;
};

type AnalyticsSnapshot = {
  loans: AnalyticsLoan[];
  installments: AnalyticsInstallment[];
  transactions: AnalyticsTransaction[];
};

const EMPTY_SNAPSHOT: AnalyticsSnapshot = {
  loans: [],
  installments: [],
  transactions: [],
};

const isLoanWriteOffTransaction = (tx: Pick<AnalyticsTransaction, 'category' | 'description' | 'type'>) =>
  tx.category === 'adjustment' &&
  tx.type === 'expense' &&
  tx.description.toLowerCase().includes('baixa do emprestimo');

const isRecoveryFromWrittenOffLoan = (tx: AnalyticsTransaction) =>
  tx.type === 'income' &&
  !!tx.loan_id &&
  isLoanWrittenOff(tx.loans?.notes);

const getMonthKey = (value: string | Date) => {
  const date = typeof value === 'string' ? parseAppDate(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabelFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'short',
  year: '2-digit',
});

const getMonthLabel = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return monthLabelFormatter.format(date).replace('.', '');
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const addMonths = (date: Date, amount: number) => new Date(date.getFullYear(), date.getMonth() + amount, 1);

const enumerateMonthKeys = (from: Date, to: Date) => {
  const months: string[] = [];
  const cursor = startOfMonth(from);
  const limit = startOfMonth(to);

  while (cursor <= limit) {
    months.push(getMonthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
};

const getRangeFromPeriod = (period: PeriodFilter, snapshot: AnalyticsSnapshot) => {
  const now = new Date();
  const currentMonth = startOfMonth(now);

  if (period !== 'all') {
    const size = Number(period.replace('m', ''));
    return {
      start: addMonths(currentMonth, -(size - 1)),
      end: currentMonth,
    };
  }

  const dates = [
    ...snapshot.loans.map((loan) => parseAppDate(loan.created_at)),
    ...snapshot.installments.map((installment) => parseAppDate(installment.due_date)),
    ...snapshot.transactions.map((transaction) => parseAppDate(transaction.created_at)),
  ].filter((date) => !Number.isNaN(date.getTime()));

  if (!dates.length) {
    return {
      start: addMonths(currentMonth, -5),
      end: currentMonth,
    };
  }

  dates.sort((a, b) => a.getTime() - b.getTime());

  return {
    start: startOfMonth(dates[0]),
    end: currentMonth,
  };
};

const ChartEmptyState = ({ message }: { message: string }) => (
  <div className="flex h-full items-center justify-center rounded-[2rem] border border-dashed border-slate-200 bg-slate-50/70 text-center">
    <p className="max-w-xs text-sm font-medium text-slate-400">{message}</p>
  </div>
);

const MetricCard = ({ label, value, helper, icon: Icon, color, tone }: SummaryCard) => (
  <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
    <div className="mb-5 flex items-center justify-between">
      <div className={cn('rounded-2xl p-3', tone)}>
        <Icon className={cn('size-5', color)} />
      </div>
    </div>
    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
    <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{value}</p>
    <p className="mt-2 text-xs font-medium text-slate-500">{helper}</p>
  </div>
);

export function Analytics() {
  const { t, formatCurrency } = useLanguage();
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodFilter>('12m');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot>(EMPTY_SNAPSHOT);

  const fetchAnalyticsData = useCallback(async () => {
    if (!user) {
      setSnapshot(EMPTY_SNAPSHOT);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [{ data: loans, error: loansError }, { data: installments, error: installmentsError }, { data: transactions, error: transactionsError }] = await Promise.all([
        supabase
          .from('loans')
          .select('id, created_at, principal_amount, status, notes')
          .eq('user_id', user.id),
        supabase
          .from('installments')
          .select('amount, status, due_date, loan_id, loans!inner(user_id)')
          .eq('loans.user_id', user.id),
        supabase
          .from('transactions')
          .select('amount, type, category, description, created_at, loan_id, loans(notes)')
          .eq('user_id', user.id),
      ]);

      if (loansError) throw loansError;
      if (installmentsError) throw installmentsError;
      if (transactionsError) throw transactionsError;

      setSnapshot({
        loans: (loans || []) as AnalyticsLoan[],
        installments: (installments || []) as AnalyticsInstallment[],
        transactions: (transactions || []) as AnalyticsTransaction[],
      });
    } catch (err: any) {
      console.error('Analytics Fetch Error:', err.message);
      setError('Nao foi possivel atualizar a analise agora.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  useRealtimeRefresh({
    enabled: !!user,
    channelKey: `analytics-${user?.id || 'guest'}`,
    tables: ['loans', 'installments', 'transactions'],
    onRefresh: fetchAnalyticsData,
    intervalMs: 90000,
  });

  const derived = useMemo(() => {
    const { start, end } = getRangeFromPeriod(period, snapshot);
    const monthKeys = enumerateMonthKeys(start, end);
    const monthSet = new Set(monthKeys);
    const monthBuckets = new Map<string, ChartBucket>(
      monthKeys.map((key) => [
        key,
        {
          key,
          month: getMonthLabel(key),
          concessao: 0,
          inadimplencia: 0,
          baixas: 0,
          recuperado: 0,
          recebimentos: 0,
        },
      ])
    );

    const writtenOffIds = new Set(
      snapshot.loans.filter((loan) => isLoanWrittenOff(loan.notes)).map((loan) => loan.id)
    );

    const visibleLoans = snapshot.loans.filter((loan) => !writtenOffIds.has(loan.id));
    const inRangeLoans = snapshot.loans.filter((loan) => monthSet.has(getMonthKey(loan.created_at)));
    const inRangeVisibleLoans = visibleLoans.filter((loan) => monthSet.has(getMonthKey(loan.created_at)));
    const inRangeInstallments = snapshot.installments.filter((installment) => monthSet.has(getMonthKey(installment.due_date)));
    const inRangeTransactions = snapshot.transactions.filter((transaction) => monthSet.has(getMonthKey(transaction.created_at)));

    inRangeVisibleLoans.forEach((loan) => {
      const bucket = monthBuckets.get(getMonthKey(loan.created_at));
      if (bucket) {
        bucket.concessao += Number(loan.principal_amount || 0);
      }
    });

    inRangeInstallments.forEach((installment) => {
      const bucket = monthBuckets.get(getMonthKey(installment.due_date));
      if (!bucket) return;

      if (installment.status === 'late' || installment.status === 'missed') {
        bucket.inadimplencia += Number(installment.amount || 0);
      }
    });

    inRangeTransactions.forEach((transaction) => {
      const bucket = monthBuckets.get(getMonthKey(transaction.created_at));
      if (!bucket) return;

      if (isLoanWriteOffTransaction(transaction)) {
        bucket.baixas += Number(transaction.amount || 0);
      }

      if (isRecoveryFromWrittenOffLoan(transaction)) {
        bucket.recuperado += Number(transaction.amount || 0);
      }

      if (transaction.type === 'income' && transaction.category === 'payment_received') {
        bucket.recebimentos += Number(transaction.amount || 0);
      }
    });

    const activeExposure = visibleLoans
      .filter((loan) => loan.status !== 'repaid')
      .reduce((acc, loan) => acc + Number(loan.principal_amount || 0), 0);

    const totalVisibleInstallments = snapshot.installments
      .filter((installment) => !installment.loan_id || !writtenOffIds.has(installment.loan_id))
      .reduce((acc, installment) => acc + Number(installment.amount || 0), 0);

    const overdueRiskAmount = snapshot.installments
      .filter((installment) => !installment.loan_id || !writtenOffIds.has(installment.loan_id))
      .filter((installment) => installment.status === 'late')
      .reduce((acc, installment) => acc + Number(installment.amount || 0), 0);

    const delinquentAmount = snapshot.installments
      .filter((installment) => !installment.loan_id || !writtenOffIds.has(installment.loan_id))
      .filter((installment) => installment.status === 'late' || installment.status === 'missed')
      .reduce((acc, installment) => acc + Number(installment.amount || 0), 0);

    const delinquencyRate = totalVisibleInstallments > 0 ? (delinquentAmount / totalVisibleInstallments) * 100 : 0;

    const projectedReceivables = snapshot.installments
      .filter((installment) => !installment.loan_id || !writtenOffIds.has(installment.loan_id))
      .filter((installment) => installment.status === 'upcoming' || installment.status === 'late')
      .reduce((acc, installment) => acc + Number(installment.amount || 0), 0);

    const totalWriteOffAmount = snapshot.transactions
      .filter(isLoanWriteOffTransaction)
      .reduce((acc, transaction) => acc + Number(transaction.amount || 0), 0);

    const totalRecoveredAmount = snapshot.transactions
      .filter(isRecoveryFromWrittenOffLoan)
      .reduce((acc, transaction) => acc + Number(transaction.amount || 0), 0);

    const netLoss = Math.max(totalWriteOffAmount - totalRecoveredAmount, 0);
    const recoveryRate = totalWriteOffAmount > 0 ? (totalRecoveredAmount / totalWriteOffAmount) * 100 : 0;

    const receivedInRange = inRangeTransactions
      .filter((transaction) => transaction.type === 'income' && transaction.category === 'payment_received')
      .reduce((acc, transaction) => acc + Number(transaction.amount || 0), 0);

    const writeOffsInRange = inRangeTransactions
      .filter(isLoanWriteOffTransaction)
      .reduce((acc, transaction) => acc + Number(transaction.amount || 0), 0);

    const recoveriesInRange = inRangeTransactions
      .filter(isRecoveryFromWrittenOffLoan)
      .reduce((acc, transaction) => acc + Number(transaction.amount || 0), 0);

    const statusSource = [
      ...visibleLoans.map((loan) => loan.status),
      ...snapshot.loans.filter((loan) => writtenOffIds.has(loan.id)).map(() => 'written_off'),
    ];

    const statusLabels: Record<string, string> = {
      active: t.active,
      pending: t.pending,
      repaid: t.repaid,
      default: t.default,
      written_off: 'Baixado',
    };

    const statusDistribution = Object.entries(
      statusSource.reduce<Record<string, number>>((acc, status) => {
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {})
    )
      .map(([status, value]) => ({
        name: statusLabels[status] || status,
        value,
      }))
      .sort((a, b) => b.value - a.value);

    const topWrittenOffLoans = snapshot.loans
      .map((loan) => {
        const meta = extractLoanWriteOffMeta(loan.notes);
        return {
          id: loan.id,
          amount: Number(meta?.amount || 0),
          reason: meta?.reason || 'Baixa operacional',
          writtenOffAt: meta?.writtenOffAt || loan.created_at,
        };
      })
      .filter((loan) => loan.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);

    const cards: SummaryCard[] = [
      {
        label: 'Carteira ativa',
        value: formatCurrency(activeExposure),
        helper: `${visibleLoans.filter((loan) => loan.status !== 'repaid').length} contratos ainda expostos`,
        icon: Wallet,
        color: 'text-emerald-500',
        tone: 'bg-emerald-50',
      },
      {
        label: 'Risco vencido',
        value: formatCurrency(overdueRiskAmount),
        helper: `${delinquencyRate.toFixed(1)}% da carteira parcelada em atraso`,
        icon: ShieldAlert,
        color: 'text-rose-500',
        tone: 'bg-rose-50',
      },
      {
        label: 'Baixas reconhecidas',
        value: formatCurrency(totalWriteOffAmount),
        helper: `${snapshot.loans.filter((loan) => writtenOffIds.has(loan.id)).length} emprestimos encerrados por perda`,
        icon: TrendingDown,
        color: 'text-amber-500',
        tone: 'bg-amber-50',
      },
      {
        label: 'Recuperado apos baixa',
        value: formatCurrency(totalRecoveredAmount),
        helper: `${recoveryRate.toFixed(1)}% recuperado sobre o valor baixado`,
        icon: RotateCcw,
        color: 'text-sky-500',
        tone: 'bg-sky-50',
      },
    ];

    return {
      rangeLabel:
        period === 'all'
          ? 'Todo o historico'
          : `Ultimos ${period.replace('m', '')} meses`,
      activeExposure,
      overdueRiskAmount,
      delinquencyRate,
      projectedReceivables,
      totalWriteOffAmount,
      totalRecoveredAmount,
      netLoss,
      recoveryRate,
      receivedInRange,
      writeOffsInRange,
      recoveriesInRange,
      issuedInRange: inRangeLoans.reduce((acc, loan) => acc + Number(loan.principal_amount || 0), 0),
      loansIssuedCount: inRangeLoans.length,
      openLoansCount: visibleLoans.filter((loan) => loan.status !== 'repaid').length,
      statusDistribution,
      monthlySeries: Array.from(monthBuckets.values()),
      topWrittenOffLoans,
      cards,
      recoveryGap: Math.max(totalWriteOffAmount - totalRecoveredAmount, 0),
    };
  }, [formatCurrency, period, snapshot, t.active, t.default, t.pending, t.repaid]);

  async function generateAIInsights() {
    setAiLoading(true);

    try {
      const topLossContext = derived.topWrittenOffLoans
        .map((loan, index) => `${index + 1}. ${formatCurrency(loan.amount)} - ${loan.reason}`)
        .join('\n');

      const prompt = `
Aja como um consultor executivo de microcredito.
Analise os indicadores a seguir e retorne 3 recomendacoes curtas, objetivas e acionaveis em Portugues-BR.

Janela analisada: ${derived.rangeLabel}
Carteira ativa: ${formatCurrency(derived.activeExposure)}
Risco vencido: ${formatCurrency(derived.overdueRiskAmount)}
Taxa de inadimplencia: ${derived.delinquencyRate.toFixed(2)}%
Recebivel projetado: ${formatCurrency(derived.projectedReceivables)}
Baixas reconhecidas: ${formatCurrency(derived.totalWriteOffAmount)}
Recuperado apos baixa: ${formatCurrency(derived.totalRecoveredAmount)}
Perda liquida: ${formatCurrency(derived.netLoss)}
Recebimentos no periodo: ${formatCurrency(derived.receivedInRange)}
Top motivos/baixas:
${topLossContext || 'Sem baixas relevantes no periodo.'}

Formato de resposta:
1. [Titulo curto] - [Orientacao pratica]
2. [Titulo curto] - [Orientacao pratica]
3. [Titulo curto] - [Orientacao pratica]
      `.trim();

      const response = await requestAi({
        mode: 'text',
        prompt,
      });

      setAiInsight(response.type === 'text' || response.type === 'message' ? response.text : 'Nenhum insight retornado.');
    } catch (err: any) {
      console.error('OpenAI Error:', err.message);
      setAiInsight('Nao foi possivel consultar a IA agora, mas os indicadores abaixo seguem atualizados.');
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-[#f8fafc]">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="min-h-screen w-full flex-1 pb-20 transition-all duration-300 lg:ml-72">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-100 bg-white/80 px-4 py-4 backdrop-blur-xl lg:px-8 lg:py-5">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-500 lg:hidden">
              <Landmark className="size-6" />
            </button>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 lg:text-xl">{t.analytics}</h1>
              <p className="text-xs font-medium text-slate-400">{derived.rangeLabel}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPeriod(option.value)}
                className={cn(
                  'rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all',
                  period === option.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </header>

        <div className="space-y-8 px-4 py-8 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm lg:p-10"
          >
            <div className="relative z-10 grid items-center gap-8 xl:grid-cols-[1.05fr,0.95fr]">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">
                  <BrainCircuit className="size-3" />
                  Relatorio executivo da carteira
                </div>
                <h2 className="max-w-2xl text-3xl font-black leading-tight text-slate-900 lg:text-4xl">
                  Agora a analise acompanha concessao, inadimplencia, baixas e recuperacao na mesma tela.
                </h2>
                <p className="mt-4 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">
                  Use essa visao para decidir se a operacao esta crescendo com qualidade ou apenas trocando volume por perda.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={generateAIInsights}
                    disabled={aiLoading}
                    className="group flex items-center gap-3 rounded-2xl bg-slate-900 px-7 py-4 text-sm font-bold tracking-tight text-white transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-50"
                  >
                    {aiLoading ? (
                      <Zap className="size-4 animate-pulse text-amber-400" />
                    ) : (
                      <Sparkles className="size-4 text-emerald-400 transition-transform group-hover:rotate-12" />
                    )}
                    {aiLoading ? 'Lendo padroes da carteira...' : 'Gerar leitura da IA'}
                  </button>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Perda liquida consolidada</p>
                    <p className="mt-2 text-xl font-black tracking-tight text-slate-900">{formatCurrency(derived.netLoss)}</p>
                  </div>
                </div>
              </div>

              <div className="relative min-h-[260px] rounded-[2rem] border border-slate-100 bg-slate-50/80 p-6">
                {aiLoading ? (
                  <div className="flex h-full flex-col items-center justify-center gap-4">
                    <div className="size-10 animate-spin rounded-full border-4 border-emerald-500/20 border-t-emerald-500" />
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      Processando dados estrategicos...
                    </p>
                  </div>
                ) : aiInsight ? (
                  <div className="relative z-10 whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-700">
                    {aiInsight}
                  </div>
                ) : (
                  <div className="relative z-10 flex h-full flex-col justify-between">
                    <div className="space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Leitura rapida</p>
                      <div className="rounded-2xl bg-white px-4 py-4">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-500">Risco aberto</p>
                        <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                          {formatCurrency(derived.overdueRiskAmount)}
                        </p>
                        <p className="mt-1 text-xs font-medium text-slate-500">
                          Receita ainda exposta com atraso real na carteira.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-white px-4 py-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-500">Baixas</p>
                        <p className="mt-2 text-lg font-black text-slate-900">{formatCurrency(derived.totalWriteOffAmount)}</p>
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-500">Recuperacao</p>
                        <p className="mt-2 text-lg font-black text-slate-900">{derived.recoveryRate.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                )}

                <BrainCircuit className="pointer-events-none absolute bottom-4 right-4 size-16 text-slate-100" />
              </div>
            </div>
          </motion.div>

          {error && (
            <div className="rounded-[2rem] border border-rose-100 bg-rose-50 px-6 py-5 text-sm font-bold text-rose-600">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {loading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-[168px] animate-pulse rounded-[2rem] border border-slate-100 bg-white" />
                ))
              : derived.cards.map((card) => <MetricCard key={card.label} {...card} />)}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.25fr,0.75fr]">
            <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
              <h3 className="mb-8 flex items-center gap-2 text-lg font-black uppercase tracking-tight text-slate-900">
                <Layers className="size-4 text-emerald-500" />
                Evolucao mensal da operacao
              </h3>
              <div className="h-[320px]">
                {loading ? (
                  <div className="h-full animate-pulse rounded-[2rem] bg-slate-50" />
                ) : derived.monthlySeries.every((item) => item.concessao === 0 && item.recebimentos === 0) ? (
                  <ChartEmptyState message="Ainda nao ha concessoes ou recebimentos suficientes para montar a serie mensal." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={derived.monthlySeries}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} tickFormatter={(value) => `R$${Math.round(Number(value) / 1000)}k`} />
                      <Tooltip
                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value) => formatCurrency(Number(value ?? 0))}
                      />
                      <Bar dataKey="concessao" name="Concessao" fill="#0f172a" radius={[10, 10, 0, 0]} />
                      <Bar dataKey="recebimentos" name="Recebimentos" fill="#10b981" radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded-[2.5rem] border border-slate-100 bg-slate-900 p-8 text-white shadow-xl shadow-slate-200">
              <h3 className="mb-8 flex items-center gap-2 text-lg font-black uppercase tracking-tight">
                <Activity className="size-4 text-emerald-400" />
                Composicao da carteira
              </h3>
              <div className="h-[250px]">
                {loading ? (
                  <div className="h-full animate-pulse rounded-[2rem] bg-slate-800/60" />
                ) : !derived.statusDistribution.length ? (
                  <ChartEmptyState message="Sem contratos suficientes para distribuir os status ainda." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={derived.statusDistribution} cx="50%" cy="50%" innerRadius={58} outerRadius={84} paddingAngle={4} dataKey="value">
                        {derived.statusDistribution.map((entry, index) => (
                          <Cell key={entry.name} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `${Number(value ?? 0)} contratos`} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="mt-4 space-y-3">
                {derived.statusDistribution.map((entry, index) => (
                  <div key={entry.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="size-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[index % STATUS_COLORS.length] }} />
                      <span className="font-bold uppercase tracking-widest text-slate-400">{entry.name}</span>
                    </div>
                    <span className="font-black">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.35fr,0.65fr]">
            <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
              <h3 className="mb-8 flex items-center gap-2 text-lg font-black uppercase tracking-tight text-slate-900">
                <Target className="size-4 text-amber-500" />
                Inadimplencia, baixas e recuperacao
              </h3>
              <div className="h-[330px]">
                {loading ? (
                  <div className="h-full animate-pulse rounded-[2rem] bg-slate-50" />
                ) : derived.monthlySeries.every((item) => item.inadimplencia === 0 && item.baixas === 0 && item.recuperado === 0) ? (
                  <ChartEmptyState message="Ainda nao ha ocorrencias suficientes de risco, baixa ou recuperacao no periodo selecionado." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={derived.monthlySeries}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} tickFormatter={(value) => `R$${Math.round(Number(value) / 1000)}k`} />
                      <Tooltip
                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value) => formatCurrency(Number(value ?? 0))}
                      />
                      <Line type="monotone" dataKey="inadimplencia" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3 }} name="Inadimplencia" />
                      <Line type="monotone" dataKey="baixas" stroke="#f43f5e" strokeWidth={3} dot={{ r: 3 }} name="Baixas" />
                      <Line type="monotone" dataKey="recuperado" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} name="Recuperado" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
              <h3 className="mb-8 text-lg font-black uppercase tracking-tight text-slate-900">Painel executivo</h3>
              <div className="space-y-4">
                <div className="rounded-[1.75rem] bg-slate-900 px-5 py-4 text-white">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Perda liquida</p>
                  <p className="mt-2 text-2xl font-black">{formatCurrency(derived.netLoss)}</p>
                  <p className="mt-2 text-xs font-medium text-slate-400">Baixas menos o que efetivamente voltou para o caixa.</p>
                </div>

                <div className="rounded-[1.75rem] bg-emerald-50 px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-500">Recuperacao acumulada</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{derived.recoveryRate.toFixed(1)}%</p>
                  <p className="mt-2 text-xs font-medium text-slate-500">Quanto das perdas reconhecidas ja retornou.</p>
                </div>

                <div className="rounded-[1.75rem] bg-amber-50 px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-500">Recebivel projetado</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{formatCurrency(derived.projectedReceivables)}</p>
                  <p className="mt-2 text-xs font-medium text-slate-500">Parcelas ainda abertas entre proximas e atrasadas.</p>
                </div>

                <div className="rounded-[1.75rem] bg-rose-50 px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-500">Gap de recuperacao</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{formatCurrency(derived.recoveryGap)}</p>
                  <p className="mt-2 text-xs font-medium text-slate-500">Valor ainda nao recuperado das baixas realizadas.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
            <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
              <h3 className="mb-8 flex items-center gap-2 text-lg font-black uppercase tracking-tight text-slate-900">
                <Sparkles className="size-4 text-sky-500" />
                Fluxo entre perdas e retornos
              </h3>
              <div className="h-[290px]">
                {loading ? (
                  <div className="h-full animate-pulse rounded-[2rem] bg-slate-50" />
                ) : derived.monthlySeries.every((item) => item.baixas === 0 && item.recuperado === 0) ? (
                  <ChartEmptyState message="Sem historico suficiente de baixa e recuperacao para mostrar o fluxo." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={derived.monthlySeries}>
                      <defs>
                        <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.32} />
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="recoveryGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.32} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} tickFormatter={(value) => `R$${Math.round(Number(value) / 1000)}k`} />
                      <Tooltip
                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value) => formatCurrency(Number(value ?? 0))}
                      />
                      <Area type="monotone" dataKey="baixas" stroke="#f43f5e" fillOpacity={1} fill="url(#lossGradient)" strokeWidth={3} />
                      <Area type="monotone" dataKey="recuperado" stroke="#10b981" fillOpacity={1} fill="url(#recoveryGradient)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
              <h3 className="mb-8 text-lg font-black uppercase tracking-tight text-slate-900">Principais baixas registradas</h3>
              <div className="space-y-4">
                {loading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-[78px] animate-pulse rounded-[1.75rem] bg-slate-50" />
                  ))
                ) : derived.topWrittenOffLoans.length === 0 ? (
                  <div className="rounded-[2rem] border border-dashed border-slate-200 bg-slate-50/70 px-6 py-8 text-center">
                    <p className="text-sm font-medium text-slate-400">Nenhuma baixa relevante foi registrada ainda.</p>
                  </div>
                ) : (
                  derived.topWrittenOffLoans.map((loan) => (
                    <div key={loan.id} className="rounded-[1.75rem] border border-slate-100 bg-slate-50/70 px-5 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                            Emprestimo {loan.id.slice(0, 8)}
                          </p>
                          <p className="mt-2 text-sm font-bold text-slate-900">{loan.reason}</p>
                          <p className="mt-1 text-xs font-medium text-slate-500">
                            Baixado em {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(parseAppDate(loan.writtenOffAt))}
                          </p>
                        </div>
                        <p className="text-lg font-black tracking-tight text-rose-500">{formatCurrency(loan.amount)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
