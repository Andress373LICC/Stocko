import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Logo } from '@/components/logo';
import { OnboardingForm } from './onboarding-form';

export const metadata = { title: 'Configura tu negocio' };

export default async function OnboardingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: existing } = await supabase.from('memberships').select('business_id').eq('user_id', user.id).limit(1);
  if (existing && existing.length > 0) redirect('/dashboard');

  // Vercel entrega el país del visitante en este encabezado (detección automática por IP).
  const detectedCountry = headers().get('x-vercel-ip-country') ?? '';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-50 to-slate-50 px-4 py-10">
      <div className="mb-6"><Logo href="/onboarding" /></div>
      <div className="card w-full max-w-lg p-7">
        <OnboardingForm detectedCountry={detectedCountry} />
      </div>
      <form action="/auth/signout" method="post" className="mt-4">
        <button className="text-sm text-slate-500 hover:underline">Cerrar sesión</button>
      </form>
    </div>
  );
}
