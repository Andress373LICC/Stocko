'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MailCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    setLoading(true);
    setError('');
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: { data: { full_name: name }, emailRedirectTo: `${location.origin}/auth/callback?next=/onboarding` },
    });
    if (error) {
      setError(error.message.includes('already') ? 'Ya existe una cuenta con ese correo.' : error.message);
      setLoading(false);
      return;
    }
    if (data.session) {
      router.replace('/onboarding');
      router.refresh();
    } else {
      setSent(true);
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600"><MailCheck /></div>
        <h1 className="text-xl font-bold">Revisa tu correo</h1>
        <p className="mt-2 text-sm text-slate-600">Enviamos un enlace de confirmación a <b>{email}</b>. Ábrelo para activar tu cuenta.</p>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-xl font-bold">Crea tu cuenta</h1>
      <p className="mt-1 text-sm text-slate-500">Es gratis y toma menos de un minuto.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="name">Tu nombre</label>
          <input id="name" required autoComplete="name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="email">Correo electrónico</label>
          <input id="email" type="email" required autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">Contraseña</label>
          <input id="password" type="password" required autoComplete="new-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="hint">Mínimo 8 caracteres.</p>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>{loading ? 'Creando cuenta…' : 'Crear cuenta'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        ¿Ya tienes cuenta? <Link href="/login" className="font-semibold text-brand-700 hover:underline">Inicia sesión</Link>
      </p>
    </>
  );
}
