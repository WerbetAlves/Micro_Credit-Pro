export type PlanSlug = 'free' | 'start' | 'pro' | 'business' | 'enterprise';

export type PlanLimits = {
  clients?: number;
  active_loans?: number;
  wallets?: number;
};

export type PlanDefinition = {
  id?: string;
  name: string;
  slug: PlanSlug;
  priceCents: number;
  currency: string;
  billingInterval: 'month' | 'year';
  description: string;
  limits: PlanLimits;
  features: string[];
};

const PLAN_CATALOG: Record<PlanSlug, PlanDefinition> = {
  free: {
    name: 'Free',
    slug: 'free',
    priceCents: 0,
    currency: 'BRL',
    billingInterval: 'month',
    description: 'Plano de entrada para validar a operacao.',
    limits: {
      clients: 3,
      active_loans: 10,
      wallets: 1,
    },
    features: ['ate 3 clientes', '1 carteira', 'simulador basico'],
  },
  start: {
    name: 'Start',
    slug: 'start',
    priceCents: 4990,
    currency: 'BRL',
    billingInterval: 'month',
    description: 'Plano inicial para operacoes pequenas.',
    limits: {
      clients: 50,
      active_loans: 100,
      wallets: 1,
    },
    features: ['ate 50 clientes', 'ate 100 emprestimos ativos', '1 carteira'],
  },
  pro: {
    name: 'Pro',
    slug: 'pro',
    priceCents: 8990,
    currency: 'BRL',
    billingInterval: 'month',
    description: 'Plano para operacoes em crescimento.',
    limits: {
      clients: 300,
      active_loans: 600,
      wallets: 10,
    },
    features: ['ate 300 clientes', 'ate 600 emprestimos ativos', 'multiplas carteiras'],
  },
  business: {
    name: 'Business',
    slug: 'business',
    priceCents: 14990,
    currency: 'BRL',
    billingInterval: 'month',
    description: 'Plano para operacoes maduras com suporte prioritario.',
    limits: {
      clients: 999999,
      active_loans: 999999,
      wallets: 999,
    },
    features: ['limites altos', 'suporte prioritario', 'relatorios avancados'],
  },
  enterprise: {
    name: 'Business',
    slug: 'enterprise',
    priceCents: 14990,
    currency: 'BRL',
    billingInterval: 'month',
    description: 'Alias legado para Business.',
    limits: {
      clients: 999999,
      active_loans: 999999,
      wallets: 999,
    },
    features: ['limites altos', 'suporte prioritario', 'relatorios avancados'],
  },
};

export const normalizePlanSlug = (value?: string | null): PlanSlug => {
  if (!value) return 'free';
  const normalized = value.toLowerCase().trim();

  if (normalized === 'business') return 'business';
  if (normalized === 'enterprise') return 'business';
  if (normalized === 'pro') return 'pro';
  if (normalized === 'start') return 'start';
  return 'free';
};

export const getPlanDefinition = (value?: string | null, overrides?: Partial<PlanDefinition>): PlanDefinition => {
  const slug = normalizePlanSlug(value);
  const base = PLAN_CATALOG[slug];
  return {
    ...base,
    ...overrides,
    slug,
    limits: {
      ...base.limits,
      ...(overrides?.limits || {}),
    },
    features: overrides?.features || base.features,
  };
};

export const getPlanLimit = (plan: Pick<PlanDefinition, 'limits'> | null | undefined, key: keyof PlanLimits) => {
  const value = plan?.limits?.[key];
  return typeof value === 'number' ? value : null;
};

export const hasReachedPlanLimit = (
  plan: Pick<PlanDefinition, 'limits'> | null | undefined,
  key: keyof PlanLimits,
  currentCount: number
) => {
  const limit = getPlanLimit(plan, key);
  if (limit === null) return false;
  return currentCount >= limit;
};

export const getPlanLimitMessage = (
  planName: string,
  key: keyof PlanLimits,
  limit: number
) => {
  const resourceLabel =
    key === 'clients'
      ? 'clientes'
      : key === 'active_loans'
        ? 'emprestimos ativos'
        : 'carteiras';

  return `Seu plano atual (${planName}) permite ate ${limit} ${resourceLabel}. Faca upgrade para continuar.`;
};

export const formatPriceLabel = (priceCents: number, currency = 'BRL') => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(priceCents / 100);
};
