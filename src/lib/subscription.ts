import { supabase } from './supabase';
import { getPlanDefinition, normalizePlanSlug, type PlanDefinition } from './plans';

export type BillingPlanRow = {
  id: string;
  name: string;
  slug: string;
  price_cents: number;
  currency: string;
  billing_interval: 'month' | 'year';
  description: string | null;
  limits: Record<string, number> | null;
  features: string[] | null;
  is_active: boolean;
};

export type SubscriptionRow = {
  id: string;
  user_id: string;
  plan_id: string | null;
  status: 'pending' | 'active' | 'trialing' | 'canceled' | 'past_due' | 'inactive';
  gateway: string;
  gateway_customer_id?: string | null;
  gateway_subscription_id?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  created_at?: string;
  updated_at?: string;
  plans?: BillingPlanRow | null;
};

export type PlanContext = {
  plan: PlanDefinition;
  subscription: SubscriptionRow | null;
  profilePlanType: string | null;
};

export type LimitedResource = 'clients' | 'active_loans' | 'wallets';

export type ResourceCounts = {
  clients: number;
  active_loans: number;
  wallets: number;
};

const CURRENT_SUBSCRIPTION_STATUSES: SubscriptionRow['status'][] = ['active', 'trialing', 'pending', 'past_due', 'canceled', 'inactive'];
const ACTIVE_PLAN_STATUSES: SubscriptionRow['status'][] = ['active', 'trialing', 'past_due'];

const mapBillingPlan = (row: BillingPlanRow | null | undefined): PlanDefinition | null => {
  if (!row) return null;

  return getPlanDefinition(row.slug, {
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    currency: row.currency,
    billingInterval: row.billing_interval,
    description: row.description || '',
    limits: (row.limits || {}) as any,
    features: Array.isArray(row.features) ? row.features : [],
  });
};

export async function fetchBillingPlans() {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('price_cents', { ascending: true });

  if (error) throw error;

  return ((data || []) as BillingPlanRow[]).map((row) => mapBillingPlan(row)!).filter(Boolean);
}

export async function fetchPlanContext(userId: string): Promise<PlanContext> {
  const [{ data: profile, error: profileError }, { data: subscriptionRows, error: subscriptionError }] = await Promise.all([
    supabase
      .from('profiles')
      .select('plan_type')
      .eq('id', userId)
      .single(),
    supabase
      .from('subscriptions')
      .select(`
        *,
        plans (*)
      `)
      .eq('user_id', userId)
      .in('status', CURRENT_SUBSCRIPTION_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  if (profileError) throw profileError;
  if (subscriptionError) throw subscriptionError;

  const subscription = ((subscriptionRows || [])[0] || null) as SubscriptionRow | null;
  const activePlan =
    subscription && ACTIVE_PLAN_STATUSES.includes(subscription.status)
      ? mapBillingPlan(subscription?.plans || null)
      : null;

  return {
    plan: activePlan || getPlanDefinition(profile?.plan_type),
    subscription,
    profilePlanType: profile?.plan_type || null,
  };
}

export const getSubscriptionStatusLabel = (status?: string | null) => {
  switch (status) {
    case 'active':
      return 'Ativa';
    case 'trialing':
      return 'Em teste';
    case 'pending':
      return 'Aguardando pagamento';
    case 'past_due':
      return 'Pagamento pendente';
    case 'canceled':
      return 'Cancelada';
    case 'inactive':
      return 'Inativa';
    default:
      return 'Sem assinatura';
  }
};

export const getCurrentPlanSlug = (context: PlanContext | null | undefined) => {
  return normalizePlanSlug(context?.subscription?.plans?.slug || context?.profilePlanType || context?.plan?.slug);
};

export async function fetchResourceCounts(userId: string): Promise<ResourceCounts> {
  const [{ count: clients }, { count: activeLoans }, { count: wallets }] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase
      .from('loans')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active'),
    supabase.from('wallets').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  return {
    clients: clients || 0,
    active_loans: activeLoans || 0,
    wallets: wallets || 0,
  };
}

export async function fetchBillingEvents(userId: string, limit = 10) {
  const { data, error } = await supabase
    .from('billing_events')
    .select('id, event_type, created_at, payload')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return data || [];
}
