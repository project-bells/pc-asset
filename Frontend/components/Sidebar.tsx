'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShieldAlert,
  Server,
  QrCode,
  Wrench,
  FileCheck,
  UserCheck,
  LogOut,
  Laptop,
  BarChart3,
  Video,
  Sparkles,
} from 'lucide-react';
import { useAuth, UserRole } from '@/context/AuthContext';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, role, loginAs, logout } = useAuth();

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'TECHNICIAN', 'VIEWER'] },
    { name: 'Executive Analytics', href: '/dashboard/executive', icon: BarChart3, roles: ['ADMIN', 'TECHNICIAN', 'VIEWER'] },
    { name: 'Hardware Alerts', href: '/alerts', icon: ShieldAlert, roles: ['ADMIN', 'TECHNICIAN', 'VIEWER'], badge: '3' },
    { name: 'Asset Inventory', href: '/assets', icon: Server, roles: ['ADMIN', 'TECHNICIAN', 'VIEWER'] },
    { name: 'Remote Audit Logs', href: '/audit-remote', icon: Video, roles: ['ADMIN', 'TECHNICIAN', 'VIEWER'] },
    { name: 'Annual Audit', href: '/audit', icon: FileCheck, roles: ['ADMIN', 'TECHNICIAN'] },
    { name: 'PM Schedules', href: '/pm', icon: Wrench, roles: ['ADMIN', 'TECHNICIAN'] },
    { name: 'Mobile QR Scan', href: '/scan', icon: QrCode, roles: ['ADMIN', 'TECHNICIAN'] },
  ];

  return (
    <>
      {/* Desktop Frosted Glass Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-white/10 bg-slate-950/65 backdrop-blur-2xl min-h-screen p-4 justify-between fixed left-0 top-0 bottom-0 z-30 shadow-2xl shadow-blue-950/40">
        <div>
          {/* Logo & Header with Blue-Emerald Gradient */}
          <div className="flex items-center gap-3 px-2 py-3 mb-6">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-emerald-500 shadow-lg shadow-blue-500/25 text-white ring-1 ring-white/20">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-base tracking-wide text-slate-100">IT Asset Guard</h1>
                <Sparkles className="w-3 h-3 text-emerald-400" />
              </div>
              <p className="text-[11px] font-mono font-medium text-gradient-blue-emerald">Glassy v2.0 Enterprise</p>
            </div>
          </div>

          {/* Navigation Links with Glassy Highlight */}
          <nav className="space-y-1.5">
            {navItems
              .filter((item) => item.roles.includes(role))
              .map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-600/90 to-emerald-600/85 text-white shadow-lg shadow-blue-600/20 border border-white/20 backdrop-blur-xl'
                        : 'text-slate-400 hover:text-cyan-200 hover:bg-white/[0.04] border border-transparent hover:border-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
          </nav>
        </div>

        {/* User Profile & Role Switcher */}
        <div className="pt-4 border-t border-white/10 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Active Role</span>
            <span
              className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold tracking-wide border ${
                role === 'ADMIN'
                  ? 'bg-blue-500/15 text-blue-300 border-blue-500/30 shadow-sm shadow-blue-500/20'
                  : role === 'TECHNICIAN'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-sm shadow-emerald-500/20'
                  : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
              }`}
            >
              {role}
            </span>
          </div>

          {/* Role switcher buttons */}
          <div className="grid grid-cols-3 gap-1 bg-slate-950/80 p-1 rounded-xl border border-white/10 text-[10px]">
            {(['ADMIN', 'TECHNICIAN', 'VIEWER'] as UserRole[]).map((r) => (
              <button
                key={r}
                onClick={() => loginAs(r)}
                className={`py-1 rounded-lg font-medium transition-all ${
                  role === r
                    ? 'bg-gradient-to-r from-blue-600 to-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {r.slice(0, 4)}
              </button>
            ))}
          </div>

          {/* User Badge */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/50 border border-white/5 backdrop-blur-md">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm">
                {user?.fullName.charAt(0) || 'U'}
              </div>
              <div className="truncate text-xs">
                <p className="font-semibold text-slate-200 truncate">{user?.fullName || 'Technician'}</p>
                <p className="text-slate-500 truncate text-[10px] font-mono">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="text-slate-500 hover:text-rose-400 transition-colors p-1"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation (Glassy) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/85 backdrop-blur-2xl border-t border-white/10 z-50 px-2 py-1.5 flex justify-around items-center">
        {navItems
          .filter((item) => item.roles.includes(role))
          .slice(0, 5)
          .map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-medium transition-colors ${
                  isActive ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5 mb-0.5" />
                  {item.badge && (
                    <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-rose-500" />
                  )}
                </div>
                <span>{item.name.split(' ')[0]}</span>
              </Link>
            );
          })}
      </nav>
    </>
  );
}
