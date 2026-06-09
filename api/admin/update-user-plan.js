import { getSupabaseClients, requireAuthenticatedUser } from '../billing/_shared.js';
import { hasAdminAccess } from './_shared.js';

const ALLOWED_PLANS = ['free', 'start', 'pro', 'business'];

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
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const user = await requireAuthenticatedUser(req);
    const { adminClient } = getSupabaseClients();

    await requireAdminAccess(adminClient, user);

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const userId = String(body.userId || '').trim();
    const planType = String(body.planType || '').trim();

    if (!userId || !ALLOWED_PLANS.includes(planType)) {
      res.status(400).json({ error: 'Parametros invalidos para atualizar o plano.' });
      return;
    }

    const { data, error } = await adminClient
      .from('profiles')
      .update({ plan_type: planType })
      .eq('id', userId)
      .select('id, plan_type')
      .single();

    if (error || !data) {
      throw error || new Error('Nao foi possivel atualizar o plano do usuario.');
    }

    res.status(200).json({ success: true, user: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao atualizar plano.';
    const status = message.includes('negado') || message.includes('autentic') ? 403 : 500;
    res.status(status).json({ error: message });
  }
}
