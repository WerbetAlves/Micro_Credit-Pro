export const PLAN_LIMITS = {
  free: {
    maxClients: 5,
    maxLoans: 3,
    support: 'email',
    features: ['basic_analytics']
  },
  pro: {
    maxClients: 100,
    maxLoans: 500,
    support: 'priority',
    features: ['advanced_analytics', 'custom_contracts']
  },
  enterprise: {
    maxClients: Infinity,
    maxLoans: Infinity,
    support: '24/7',
    features: ['all']
  }
};

export type PlanType = keyof typeof PLAN_LIMITS;