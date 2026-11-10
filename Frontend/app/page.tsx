'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, RefreshCw } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4">
      <div className="relative">
        <ShieldCheck className="w-12 h-12 text-emerald-400 animate-pulse" />
        <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin absolute -bottom-1 -right-1" />
      </div>
      <div className="text-center space-y-1">
        <h2 className="text-lg font-bold text-slate-100">Enterprise IT Asset Guard</h2>
        <p className="text-xs text-slate-400 font-mono">Redirecting to Glassy Dashboard...</p>
      </div>
    </div>
  );
}
