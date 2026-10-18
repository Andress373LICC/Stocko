import { requireAdmin } from '@/lib/session';
import { PageHeader } from '@/components/ui';
import { SettingsClient } from '@/components/settings-client';

export const metadata = { title: 'Configuración' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { supabase, business, role, user } = await requireAdmin();
  const { data: members } = await supabase
    .from('memberships')
    .select('user_id, role, created_at, profiles(full_name, email)')
    .eq('business_id', business.id)
    .order('created_at');

  return (
    <>
      <PageHeader title="Configuración" description="Datos del negocio, moneda, impuestos y equipo." />
      <SettingsClient business={business} role={role} currentUserId={user.id} members={(members as any) ?? []} />
    </>
  );
}
