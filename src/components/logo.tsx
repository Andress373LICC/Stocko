import { Boxes } from 'lucide-react';
import Link from 'next/link';

export function Logo({ href = '/', dark = false }: { href?: string; dark?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
        <Boxes size={18} />
      </span>
      <span className={`text-xl font-bold tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>Stockery</span>
    </Link>
  );
}
