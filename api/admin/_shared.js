export function hasAdminAccess(user, profile) {
  return Boolean(
    profile?.is_admin ||
    user?.role === 'admin' ||
    user?.app_metadata?.role === 'admin' ||
    user?.user_metadata?.role === 'admin' ||
    user?.app_metadata?.is_admin === true ||
    user?.user_metadata?.is_admin === true
  );
}

