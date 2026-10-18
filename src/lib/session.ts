import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Business, Role } from '@/lib/types';

/** Devuelve el usuario, su negocio activo y su rol. Redirige si no hay sesión o negocio. */
export const getContext = cache(async () => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: rows } = await supabase
    .from('memberships')
    .select('role, business:businesses(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1);

  const m: any = rows?.[0];
  if (!m?.business) redirect('/onboarding');

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();

  return {
    supabase,
    user,
    userName: (profile?.full_name as string) || user.email || '',
    role: m.role as Role,
    business: m.business as Business,
  };
});

export const isAdminRole = (role: Role) => role === 'owner' || role === 'admin';

export async function requireAdmin() {
  const ctx = await getContext();
  if (!isAdminRole(ctx.role)) redirect('/dashboard');
  return ctx;
}
