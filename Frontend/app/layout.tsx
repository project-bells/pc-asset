import type { Metadata } from 'next';
import './globals.css';
import Providers from '@/components/Providers';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'Enterprise IT Asset Guard | Glassy Monitoring & PM System',
  description: 'Enterprise IT Asset Management, Annual Audit & Preventive Maintenance System with Glassmorphic Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen relative overflow-x-hidden selection:bg-cyan-500/20 selection:text-cyan-200">
        {/* Ambient Glowing Gradient Orbs for Glassmorphism (Blue & Emerald) */}
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
          {/* Top-Left Ocean Blue Glow */}
          <div className="absolute -top-40 -left-40 w-[550px] h-[550px] bg-sky-600/15 rounded-full blur-[140px] transform-gpu" />
          {/* Top-Right Emerald Green Glow */}
          <div className="absolute top-10 -right-40 w-[500px] h-[500px] bg-emerald-500/12 rounded-full blur-[150px] transform-gpu" />
          {/* Bottom-Center Deep Cyan Glow */}
          <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[160px] transform-gpu" />
          {/* Mid-Left Subtle Mint Glow */}
          <div className="absolute top-1/2 -left-60 w-[400px] h-[400px] bg-teal-500/8 rounded-full blur-[130px] transform-gpu" />
        </div>

        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 md:pl-64 pb-20 md:pb-8 p-4 md:p-8 overflow-y-auto">
              <div className="max-w-7xl mx-auto">{children}</div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
