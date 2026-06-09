import { getSupabaseClients, requireAuthenticatedUser } from '../billing/_shared.js';
import { hasAdminAccess } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const user = await requireAuthenticatedUser(req);
    const { adminClient } = getSupabaseClients();

    const { data: profile, error } = await adminClient
      .from('profiles')
      .select('id, is_admin')
      .eq('id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    const allowed = hasAdminAccess(user, profile);
    res.status(200).json({ allowed });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao validar acesso administrativo.';
    res.status(500).json({ error: message });
  }
}
