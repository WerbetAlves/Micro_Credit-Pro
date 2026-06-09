import { getSupabaseClients, requireAuthenticatedUser } from '../billing/_shared.js';
import { hasAdminAccess } from './_shared.js';

async function requireAdminProfile(adminClient, userId) {
  const { data: profile, error } = await adminClient
    .from('profiles')
    .select('id, is_admin')
    .eq('id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return profile || null;
}

async function requireAdminAccess(adminClient, user) {
  const profile = await requireAdminProfile(adminClient, user.id);

  if (!hasAdminAccess(user, profile)) {
    throw new Error('Acesso administrativo negado.');
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const user = await requireAuthenticatedUser(req);
    const { adminClient } = getSupabaseClients();

    await requireAdminAccess(adminClient, user);

    const [{ data: profiles, error: profilesError }, { data: loans, error: loansError }] = await Promise.all([
      adminClient
        .from('profiles')
        .select('id, full_name, email, avatar_url, created_at, plan_type, is_admin')
        .order('created_at', { ascending: false }),
      adminClient
        .from('loans')
        .select('principal_amount, status'),
    ]);

    if (profilesError) throw profilesError;
    if (loansError) throw loansError;

    const safeProfiles = profiles || [];
    const safeLoans = loans || [];
    const activeLoans = safeLoans.filter((loan) => loan.status === 'active');
    const totalVolume = safeLoans.reduce((acc, curr) => acc + Number(curr.principal_amount || 0), 0);

    res.status(200).json({
      users: safeProfiles,
      stats: {
        totalUsers: safeProfiles.length,
        activeLoans: activeLoans.length,
        totalVolume,
        systemHealth: 99.8,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao carregar painel administrativo.';
    const status = message.includes('negado') || message.includes('autentic') ? 403 : 500;
    res.status(status).json({ error: message });
  }
}
