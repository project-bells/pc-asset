'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Wrench, Calendar, AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

export default function PmPage() {
  const { data: queue, isLoading, refetch } = useQuery({
    queryKey: ['pm-priority-queue'],
    queryFn: () => apiClient.getPmPriorityQueue(),
  });

  const pmItems = queue || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <Wrench className="w-6 h-6 text-cyan-400" />
            <span>Preventive Maintenance (PM) Priority Queue</span>
          </h1>
          <p className="text-sm text-slate-400">
            ระบบจัดคิวบำรุงรักษาเชิงป้องกัน ตรวจเช็คฮาร์ดแวร์ เป่าฝุ่น และตรวจสอบสุขภาพ S.M.A.R.T. ตามรอบกำหนด
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700"
        >
          <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Queue Table */}
      <div className="rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Endpoint / Hostname</th>
                <th className="py-3 px-4">Assigned User</th>
                <th className="py-3 px-4">Registered Location</th>
                <th className="py-3 px-4">Cycle</th>
                <th className="py-3 px-4">Next Due Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    Loading PM priority queue...
                  </td>
                </tr>
              ) : pmItems.length > 0 ? (
                pmItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-200 font-mono block">{item.hostname}</span>
                      <span className="text-[11px] text-slate-400 font-mono">{item.assetTag || 'Unregistered'}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">{item.assignedUser || 'Unassigned'}</td>
                    <td className="py-3.5 px-4 text-slate-400">{item.location}</td>
                    <td className="py-3.5 px-4 text-slate-300 font-mono">Every {item.frequencyMonths} mos</td>
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-200">{item.nextDueDate}</td>
                    <td className="py-3.5 px-4">
                      {item.isOverdue ? (
                        <span className="px-2 py-0.5 rounded font-bold text-xs bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          Overdue ({Math.abs(item.daysRemaining)} days)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded font-medium text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Due in {item.daysRemaining} days
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/pm/perform/${item.hostname}`}
                        className="inline-block px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"
                      >
                        Perform PM
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    All machines are within healthy maintenance schedules.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
