'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Server,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ExternalLink,
  Tag,
  Shield,
  Monitor,
  HardDrive,
  Cpu,
  X,
  PlusCircle,
  HelpCircle,
  RefreshCw,
  QrCode,
  Printer,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { Asset, AssetStatus, BindAssetPayload, LocationOption } from '@/types/asset';
import { useAuth } from '@/context/AuthContext';
import RemoteVncModal from '@/components/RemoteVncModal';

function AssetsContent() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status') || 'ALL';
  const initialSearch = searchParams.get('search') || '';

  const queryClient = useQueryClient();
  const { role } = useAuth();

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [selectedAssetForDetails, setSelectedAssetForDetails] = useState<Asset | null>(null);
  const [selectedAssetForBinding, setSelectedAssetForBinding] = useState<Asset | null>(null);
  const [vncAsset, setVncAsset] = useState<Asset | null>(null);
  const [isVncModalOpen, setIsVncModalOpen] = useState(false);

  // Binding Form States
  const [bindAssetTag, setBindAssetTag] = useState('');
  const [bindAssignedUser, setBindAssignedUser] = useState('');
  const [bindLocationId, setBindLocationId] = useState('');
  const [bindStatus, setBindStatus] = useState<AssetStatus>('Active');
  const [bindPurchaseDate, setBindPurchaseDate] = useState('');
  const [bindWarrantyDate, setBindWarrantyDate] = useState('');
  const [bindError, setBindError] = useState<string | null>(null);

  // Query: Assets list
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['assets', searchTerm, statusFilter],
    queryFn: () =>
      apiClient.getAssets({
        search: searchTerm || undefined,
        status: statusFilter,
      }),
  });

  // Query: Locations
  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => apiClient.getLocations(),
  });

  // Mutation: Bind Asset
  const bindMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: BindAssetPayload }) =>
      apiClient.bindAsset(id, payload),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      setSelectedAssetForBinding(null);
      resetBindingForm();
      if (typeof window !== 'undefined') {
        alert(`ลงทะเบียนสำเร็จ! รหัสทรัพย์สิน ${updated?.asset_tag || ''} เปลี่ยนสถานะเป็น Active เรียบร้อยแล้ว`);
      }
    },
    onError: (err: any) => {
      setBindError(err.message || 'เกิดข้อผิดพลาดในการลงทะเบียนทรัพย์สิน');
    },
  });

  const resetBindingForm = () => {
    setBindAssetTag('');
    setBindAssignedUser('');
    setBindLocationId('');
    setBindStatus('Active');
    setBindPurchaseDate('');
    setBindWarrantyDate('');
    setBindError(null);
  };

  const handleOpenBinding = (asset: Asset) => {
    setSelectedAssetForBinding(asset);
    setBindAssetTag(`IT-PC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setBindAssignedUser(asset.last_logged_in_user?.replace('COMPANY\\', '') || '');
    setBindLocationId(locations?.[0]?.id || '');
    setBindStatus('Active');
    setBindPurchaseDate(new Date().toISOString().split('T')[0]);
    // 3 years warranty default
    const wDate = new Date();
    wDate.setFullYear(wDate.getFullYear() + 3);
    setBindWarrantyDate(wDate.toISOString().split('T')[0]);
    setBindError(null);
  };

  const handleBindingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetForBinding) return;
    if (!bindAssetTag.trim()) {
      setBindError('Asset Tag is required.');
      return;
    }

    bindMutation.mutate({
      id: selectedAssetForBinding.id,
      payload: {
        assetTag: bindAssetTag.trim(),
        assignedUser: bindAssignedUser.trim() || undefined,
        locationId: bindLocationId || undefined,
        status: bindStatus,
        purchaseDate: bindPurchaseDate || undefined,
        warrantyExpiryDate: bindWarrantyDate || undefined,
      },
    });
  };

  const isOnline = (lastSeenAt: string | null) => {
    if (!lastSeenAt) return false;
    const diffMs = Date.now() - new Date(lastSeenAt).getTime();
    return diffMs < 15 * 60 * 1000;
  };

  const getStatusBadge = (status: AssetStatus) => {
    switch (status) {
      case 'Active':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            Active
          </span>
        );
      case 'Unregistered':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
            <HelpCircle className="w-3 h-3" />
            Unregistered
          </span>
        );
      case 'Repair':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            Repair
          </span>
        );
      case 'Retired':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/20 text-slate-400 border border-slate-500/30">
            Retired
          </span>
        );
      case 'Lost':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            Lost
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Search Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <Server className="w-6 h-6 text-indigo-400" />
            <span>Master Asset Inventory</span>
          </h1>
          <p className="text-sm text-slate-400">
            Automated Windows telemetry ingestion, hardware serials, and official accounting asset tag bindings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/assets/print-qr"
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-200 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print QR Stickers</span>
          </Link>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search hostname, tag, serial, user..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
          >
            <option value="ALL">All Statuses</option>
            <option value="Unregistered">Unregistered Only</option>
            <option value="Active">Active</option>
            <option value="Repair">Repair</option>
            <option value="Retired">Retired</option>
            <option value="Lost">Lost</option>
          </select>
        </div>
      </div>

      {/* Asset Table */}
      <div className="rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Endpoint / Hostname</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Asset Tag</th>
                <th className="py-3 px-4">Hardware Specs</th>
                <th className="py-3 px-4">Assigned User</th>
                <th className="py-3 px-4">Network / IP</th>
                <th className="py-3 px-4">Last Telemetry</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    Querying master inventory...
                  </td>
                </tr>
              ) : data && data.items.length > 0 ? (
                data.items.map((asset) => {
                  const online = isOnline(asset.last_seen_at);
                  return (
                    <tr key={asset.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              online ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-slate-600'
                            }`}
                            title={online ? 'Online (seen < 15 min)' : 'Offline'}
                          />
                          <div>
                            <span className="font-semibold text-slate-200 font-mono text-sm block">
                              {asset.hostname}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              SN: {asset.pc_serial_number}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">{getStatusBadge(asset.status)}</td>
                      <td className="py-3.5 px-4">
                        {asset.asset_tag ? (
                          <span className="font-mono font-medium text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                            {asset.asset_tag}
                          </span>
                        ) : (
                          <span className="text-amber-400 font-mono text-[11px] italic">Not Bound</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-200 font-medium">{asset.manufacturer} {asset.model}</div>
                        <div className="text-[11px] text-slate-400">
                          {Math.round(asset.ram_total_gb || 16)} GB RAM | {(asset.cpu_name || 'Intel Core').split('@')[0].slice(0, 24)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        {asset.assigned_user ? (
                          <span>{asset.assigned_user}</span>
                        ) : (
                          <span className="text-slate-600">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-slate-300">{asset.ip_address || '—'}</div>
                        <div className="text-[10px] text-slate-500">{asset.lan_speed_mbps ? `${asset.lan_speed_mbps} Mbps` : 'Wi-Fi'}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {asset.last_seen_at ? new Date(asset.last_seen_at).toLocaleTimeString() : 'Never'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* If Unregistered and user has Admin/Tech role, show Bind button */}
                          {asset.status === 'Unregistered' && role !== 'VIEWER' && (
                            <button
                              onClick={() => handleOpenBinding(asset)}
                              className="px-3 py-1.5 text-xs font-semibold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 rounded-lg flex items-center gap-1.5 transition-all shadow-sm shadow-amber-500/20"
                              title="ลงทะเบียนผูกรหัสทรัพย์สินให้กับเครื่องใหม่นี้"
                            >
                              <Tag className="w-3.5 h-3.5" />
                              <span>ลงทะเบียน (Bind Tag)</span>
                            </button>
                          )}
                          {/* Remote VNC Launch Button */}
                          {role !== 'VIEWER' && (
                            <button
                              onClick={() => {
                                setVncAsset(asset);
                                setIsVncModalOpen(true);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-indigo-300 bg-indigo-500/15 hover:bg-indigo-500/25 rounded-lg transition-colors border border-indigo-500/30 flex items-center gap-1.5 shadow-sm shadow-indigo-500/10"
                              title="เปิดรีโมทหน้าจอ UltraVNC ผ่าน Guacamole Gateway"
                            >
                              <Monitor className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Remote VNC</span>
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedAssetForDetails(asset)}
                            className="px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No matching endpoint records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Asset Full Inspection Drawer / Modal */}
      {selectedAssetForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 relative">
            <button
              onClick={() => setSelectedAssetForDetails(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
                <Server className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-100 font-mono">
                  {selectedAssetForDetails.hostname}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  {getStatusBadge(selectedAssetForDetails.status)}
                  <span className="text-xs text-slate-400 font-mono">
                    UUID: {selectedAssetForDetails.hardware_uuid}
                  </span>
                </div>
              </div>
            </div>

            {/* Spec Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5 text-xs">
              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <span className="font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  System & BIOS
                </span>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-500">Manufacturer & Model:</span>
                  <span className="text-slate-200 font-medium">
                    {selectedAssetForDetails.manufacturer} {selectedAssetForDetails.model}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-500">PC Serial Number:</span>
                  <span className="text-slate-200 font-mono">{selectedAssetForDetails.pc_serial_number}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-500">OS Name & Build:</span>
                  <span className="text-slate-200">
                    {selectedAssetForDetails.os_name} ({selectedAssetForDetails.os_build})
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Agent Version:</span>
                  <span className="text-slate-200 font-mono">v{selectedAssetForDetails.agent_version || '1.0.0'}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <span className="font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Processor & Memory
                </span>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-500">CPU Model:</span>
                  <span className="text-slate-200">{selectedAssetForDetails.cpu_name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-500">Physical Cores:</span>
                  <span className="text-slate-200 font-mono">{selectedAssetForDetails.cpu_cores} Cores</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Total Installed RAM:</span>
                  <span className="text-slate-200 font-mono font-bold text-emerald-400">
                    {selectedAssetForDetails.ram_total_gb} GB
                  </span>
                </div>
              </div>
            </div>

            {/* Storage & Disks */}
            <div className="mb-5 p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
              <span className="font-bold text-slate-300 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-indigo-400" />
                <span>Storage & S.M.A.R.T. Health</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedAssetForDetails.disks_json && selectedAssetForDetails.disks_json.length > 0 ? (
                  selectedAssetForDetails.disks_json.map((disk, idx) => (
                    <div key={idx} className="p-2.5 rounded bg-slate-900 border border-slate-800">
                      <div className="flex justify-between font-mono font-semibold text-slate-200 mb-1">
                        <span>Drive {disk.driveLetter || idx} ({disk.totalGb} GB)</span>
                        <span className={disk.smartStatus === 'Healthy' ? 'text-emerald-400' : 'text-rose-400'}>
                          {disk.smartStatus || 'Healthy'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">{disk.model || 'Solid State Drive'}</div>
                      {disk.freeGb !== undefined && (
                        <div className="text-[11px] text-slate-500 mt-1">
                          Free Space: {disk.freeGb} GB ({disk.freePercent}%)
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500">No disk information reported.</p>
                )}
              </div>
            </div>

            {/* Monitors & Displays */}
            <div className="mb-5 p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
              <span className="font-bold text-slate-300 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <Monitor className="w-4 h-4 text-amber-400" />
                <span>Connected Displays (Hardware Serial Tamper Tracing)</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedAssetForDetails.monitors_json && selectedAssetForDetails.monitors_json.length > 0 ? (
                  selectedAssetForDetails.monitors_json.map((mon, idx) => (
                    <div key={idx} className="p-2.5 rounded bg-slate-900 border border-slate-800">
                      <div className="font-semibold text-slate-200">{mon.manufacturer} {mon.model}</div>
                      <div className="font-mono text-slate-400 text-[11px] mt-0.5">
                        Serial: <strong className="text-amber-300">{mon.serialNumber}</strong>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500">No external monitors connected.</p>
                )}
              </div>
            </div>

            {/* Installed Software List */}
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
              <span className="font-bold text-slate-300 uppercase tracking-wider block mb-2">
                Installed Software Inventory ({selectedAssetForDetails.installed_software_json?.length || 0} applications)
              </span>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {selectedAssetForDetails.installed_software_json && selectedAssetForDetails.installed_software_json.length > 0 ? (
                  selectedAssetForDetails.installed_software_json.map((sw, idx) => (
                    <div key={idx} className="flex justify-between py-1 px-2 rounded bg-slate-900/60 text-slate-300">
                      <span className="truncate pr-2">{sw.name}</span>
                      <span className="font-mono text-[11px] text-slate-500 shrink-0">{sw.version || '—'}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500">No software items captured.</p>
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedAssetForDetails(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asset Binding Modal for Unregistered PCs */}
      {selectedAssetForBinding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 relative">
            <button
              onClick={() => setSelectedAssetForBinding(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-1">
              <Tag className="w-5 h-5 text-amber-400" />
              <span>ลงทะเบียนผูกรหัสทรัพย์สิน (Bind Official Asset Tag)</span>
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Register auto-discovered PC <strong className="text-slate-200 font-mono">{selectedAssetForBinding.hostname}</strong> into the corporate asset database.
            </p>

            <form onSubmit={handleBindingSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Accounting Asset Tag *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. IT-PC-2026-0129"
                  value={bindAssetTag}
                  onChange={(e) => setBindAssetTag(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-mono font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Assigned Employee / User
                </label>
                <input
                  type="text"
                  placeholder="e.g. somchai.p@company.local"
                  value={bindAssignedUser}
                  onChange={(e) => setBindAssignedUser(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Physical Location
                </label>
                <select
                  value={bindLocationId}
                  onChange={(e) => setBindLocationId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select Building / Room</option>
                  {locations?.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.building} - {loc.floor} ({loc.room_name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    value={bindPurchaseDate}
                    onChange={(e) => setBindPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Warranty Expiry Date
                  </label>
                  <input
                    type="date"
                    value={bindWarrantyDate}
                    onChange={(e) => setBindWarrantyDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {bindError && (
                <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded border border-rose-500/20">
                  {bindError}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedAssetForBinding(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bindMutation.isPending}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 shadow-md shadow-amber-600/30"
                >
                  {bindMutation.isPending ? 'กำลังบันทึกข้อมูล...' : 'ยืนยันลงทะเบียน & ใช้งาน (Confirm Binding & Activate)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remote VNC Modal */}
      <RemoteVncModal
        asset={vncAsset}
        isOpen={isVncModalOpen}
        onClose={() => {
          setIsVncModalOpen(false);
          setVncAsset(null);
        }}
      />
    </div>
  );
}

export default function AssetsPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-slate-500 font-mono text-xs">Loading master asset inventory...</div>}>
      <AssetsContent />
    </React.Suspense>
  );
}

