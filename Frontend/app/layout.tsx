import type { Metadata } from 'next';
import './globals.css';
import Providers from '@/components/Providers';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'Enterprise IT Asset Guard | Monitoring & PM System',
  description: 'Enterprise IT Asset Management, Annual Audit & Preventive Maintenance System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen">
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

