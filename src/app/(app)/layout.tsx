import { AppShell } from '@/components/app-shell';
import { getContext } from '@/lib/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { business, userName, role } = await getContext();
  return (
    <AppShell businessId={business.id} businessName={business.name} userName={userName} role={role}>
      {children}
    </AppShell>
  );
}
