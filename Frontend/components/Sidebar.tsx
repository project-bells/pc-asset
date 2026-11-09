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
} from 'lucide-react';
import { useAuth, UserRole } from '@/context/AuthContext';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, role, loginAs, logout } = useAuth();

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'TECHNICIAN', 'VIEWER'] },
    { name: 'Hardware Alerts', href: '/alerts', icon: ShieldAlert, roles: ['ADMIN', 'TECHNICIAN', 'VIEWER'], badge: '3' },
    { name: 'Asset Inventory', href: '/assets', icon: Server, roles: ['ADMIN', 'TECHNICIAN', 'VIEWER'] },
    { name: 'Annual Audit', href: '/audit', icon: FileCheck, roles: ['ADMIN', 'TECHNICIAN'] },
    { name: 'PM Schedules', href: '/pm', icon: Wrench, roles: ['ADMIN', 'TECHNICIAN'] },
    { name: 'Mobile QR Scan', href: '/scan', icon: QrCode, roles: ['ADMIN', 'TECHNICIAN'] },
  ];

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-800 bg-slate-900/90 backdrop-blur-md min-h-screen p-4 justify-between fixed left-0 top-0 bottom-0 z-30">
        <div>
          {/* Logo & Header */}
          <div className="flex items-center gap-3 px-2 py-3 mb-6">
            <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/30 text-white">
              <Laptop className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-wide text-slate-100">IT Asset Guard</h1>
              <p className="text-xs text-slate-400 font-mono">Enterprise v1.2</p>
            </div>
          </div>

          {/* Navigation links */}
          <nav className="space-y-1">
            {navItems
              .filter((item) => item.roles.includes(role))
              .map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
          </nav>
        </div>

        {/* User Profile & Role Switcher */}
        <div className="pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Active Role</span>
            <span
              className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
                role === 'ADMIN'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : role === 'TECHNICIAN'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {role}
            </span>
          </div>

          {/* Role switcher buttons for pairing demo */}
          <div className="grid grid-cols-3 gap-1 mb-4 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[10px]">
            {(['ADMIN', 'TECHNICIAN', 'VIEWER'] as UserRole[]).map((r) => (
              <button
                key={r}
                onClick={() => loginAs(r)}
                className={`py-1 rounded font-medium transition-all ${
                  role === r ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {r.slice(0, 4)}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-800/40 border border-slate-800">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                {user?.fullName.charAt(0) || 'U'}
              </div>
              <div className="truncate text-xs">
                <p className="font-medium text-slate-200 truncate">{user?.fullName || 'Technician'}</p>
                <p className="text-slate-500 truncate text-[11px]">{user?.email}</p>
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

      {/* Mobile Bottom Navigation (visible on mobile only) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 z-50 px-2 py-1.5 flex justify-around items-center">
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
                className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium transition-colors ${
                  isActive ? 'text-indigo-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
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

