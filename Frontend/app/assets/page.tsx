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
  Sparkles,
  Wifi,
  Activity,
  Layers,
  ChevronRight,
  AlertCircle
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
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Binding Form States
  const [bindAssetTag, setBindAssetTag] = useState('');
  const [bindAssignedUser, setBindAssignedUser] = useState('');
  const [bindLocationId, setBindLocationId] = useState('loc-b1f6-01');
  const [bindStatus, setBindStatus] = useState<AssetStatus>('Active');
  const [bindPurchaseDate, setBindPurchaseDate] = useState('');
  const [bindWarrantyDate, setBindWarrantyDate] = useState('');
  const [bindError, setBindError] = useState<string | null>(null);

  // Query: Assets list
  const { data, isLoading, refetch, isFetching } = useQuery({
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
      queryClient.invalidateQueries({ queryKey: ['all-assets-executive'] });
      setSelectedAssetForBinding(null);
      resetBindingForm();
      const message = `ลงทะเบียนสำเร็จ! รหัสทรัพย์สิน ${updated?.asset_tag || bindAssetTag} เปลี่ยนสถานะเป็น Active เรียบร้อยแล้ว`;
      setSuccessToast(message);
      setTimeout(() => setSuccessToast(null), 5000);
      if (typeof window !== 'undefined') {
        alert(message);
      }
    },
    onError: (err: any) => {
      setBindError(err.message || 'เกิดข้อผิดพลาดในการลงทะเบียนทรัพย์สิน');
    },
  });

  const resetBindingForm = () => {
    setBindAssetTag('');
    setBindAssignedUser('');
    setBindLocationId('loc-b1f6-01');
    setBindStatus('Active');
    setBindPurchaseDate('');
    setBindWarrantyDate('');
    setBindError(null);
  };

  const handleOpenBinding = (asset: Asset) => {
    setSelectedAssetForBinding(asset);
    setBindAssetTag(`IT-PC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setBindAssignedUser(
      asset.last_logged_in_user?.replace('COMPANY\\', '') || asset.assigned_user || ''
    );
    setBindLocationId(locations?.[0]?.id || 'loc-b1f6-01');
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
      setBindError('กรุณาระบุ Accounting Asset Tag');
      return;
    }

    const payloadLocation = bindLocationId || locations?.[0]?.id || 'loc-b1f6-01';

    bindMutation.mutate({
      id: selectedAssetForBinding.id,
      payload: {
        assetTag: bindAssetTag.trim(),
        assignedUser: bindAssignedUser.trim() || undefined,
        locationId: payloadLocation,
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
          <span className="glass-pill px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 w-max">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Active
          </span>
        );
      case 'Unregistered':
        return (
          <span className="glass-pill px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 w-max">
            <HelpCircle className="w-3 h-3 text-amber-400" />
            Unregistered
          </span>
        );
      case 'Repair':
        return (
          <span className="glass-pill px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1 w-max">
            Repair
          </span>
        );
      case 'Retired':
        return (
          <span className="glass-pill px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-400 border border-slate-500/30 flex items-center gap-1 w-max">
            Retired
          </span>
        );
      case 'Lost':
        return (
          <span className="glass-pill px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1 w-max">
            Lost
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Success Toast */}
      {successToast && (
        <div className="fixed top-5 right-5 z-50 p-4 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 backdrop-blur-xl text-emerald-200 text-xs shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-medium">{successToast}</span>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Page Title & Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
            <Link href="/dashboard" className="hover:underline">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-slate-300 font-semibold">Master Asset Inventory</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2.5">
            <Server className="w-7 h-7 text-emerald-400" />
            <span className="text-gradient-blue-emerald">Master Asset Inventory</span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Automated Windows telemetry ingestion, hardware serials, and official accounting asset tag bindings.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/assets/print-qr"
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 rounded-xl transition-all shadow-md shadow-blue-600/20 hover:shadow-glow-blue border border-white/10"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print QR Stickers</span>
          </Link>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-200 glass-card hover:border-emerald-500/40 rounded-xl transition-all border border-white/10 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search hostname, tag, serial, user..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl glass-input placeholder-slate-500 font-medium"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-cyan-400" />
          <span className="text-xs text-slate-300 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 text-xs rounded-xl glass-input font-medium cursor-pointer"
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

      {/* Asset Master Table */}
      <div className="glass-panel rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-300 font-semibold uppercase tracking-wider border-b border-white/10 text-[11px]">
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
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-mono">
                    Querying master inventory...
                  </td>
                </tr>
              ) : data && data.items.length > 0 ? (
                data.items.map((asset) => {
                  const online = isOnline(asset.last_seen_at);
                  return (
                    <tr key={asset.id} className="hover:bg-blue-950/20 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              online ? 'bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse' : 'bg-slate-600'
                            }`}
                            title={online ? 'Online (seen < 15 min)' : 'Offline'}
                          />
                          <div>
                            <span className="font-bold text-slate-100 font-mono text-sm block">
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
                          <span className="font-mono font-bold text-cyan-300 bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/30">
                            {asset.asset_tag}
                          </span>
                        ) : (
                          <span className="text-amber-400 font-mono text-[11px] italic font-semibold">Not Bound</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-200 font-medium">{asset.manufacturer} {asset.model}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {Math.round(asset.ram_total_gb || 16)} GB RAM | {(asset.cpu_name || 'Intel Core').split('@')[0].slice(0, 24)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        {asset.assigned_user ? (
                          <span className="font-medium">{asset.assigned_user}</span>
                        ) : (
                          <span className="text-slate-500 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-slate-200">{asset.ip_address || '—'}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {asset.lan_speed_mbps ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {asset.lan_speed_mbps} Mbps
                            </span>
                          ) : (
                            'Wi-Fi'
                          )}
                        </div>
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
                              className="px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-amber-500/20 to-emerald-500/20 text-emerald-300 hover:from-amber-500/30 hover:to-emerald-500/30 border border-emerald-500/40 rounded-xl flex items-center gap-1.5 transition-all shadow-sm shadow-emerald-500/20 hover:shadow-glow-emerald cursor-pointer"
                              title="ลงทะเบียนผูกรหัสทรัพย์สินให้กับเครื่องใหม่นี้"
                            >
                              <Tag className="w-3.5 h-3.5 text-amber-400" />
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
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5 hover:shadow-glow-blue cursor-pointer"
                              title="เปิดรีโมทหน้าจอ UltraVNC ผ่าน Guacamole Gateway"
                            >
                              <Monitor className="w-3.5 h-3.5" />
                              <span>Remote VNC</span>
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedAssetForDetails(asset)}
                            className="px-3 py-1.5 text-xs font-medium text-slate-300 glass-card hover:border-emerald-500/40 rounded-xl transition-colors cursor-pointer"
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
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-mono">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-950/90 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl p-6 relative">
            <button
              onClick={() => setSelectedAssetForDetails(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <h2 className="text-xl font-bold text-slate-100">{selectedAssetForDetails.hostname}</h2>
              <span className="font-mono text-xs text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 font-bold">
                {selectedAssetForDetails.asset_tag || 'Unregistered'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mb-4">
              UUID: {selectedAssetForDetails.hardware_uuid} • SN: {selectedAssetForDetails.pc_serial_number}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-5">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Processor</span>
                <span className="text-slate-200 font-medium line-clamp-2 mt-0.5">{selectedAssetForDetails.cpu_name}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Memory</span>
                <span className="text-slate-200 font-bold font-mono text-sm mt-0.5">{selectedAssetForDetails.ram_total_gb} GB RAM</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">OS Build</span>
                <span className="text-slate-200 font-medium mt-0.5 block truncate">{selectedAssetForDetails.os_name}</span>
                <span className="text-[10px] text-cyan-400 font-mono">Build {selectedAssetForDetails.os_build}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Primary Disk</span>
                <span className="text-slate-200 font-bold font-mono text-sm mt-0.5">
                  {selectedAssetForDetails.disks_json?.[0]?.freeGb ?? '—'} GB Free
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold block">SMART Healthy</span>
              </div>
            </div>

            {/* Remote VNC Callout inside details */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/40 to-emerald-950/30 border border-cyan-500/30 flex items-center justify-between mb-5">
              <div>
                <span className="font-semibold text-xs text-cyan-300 flex items-center gap-1.5">
                  <Monitor className="w-4 h-4 text-cyan-400" />
                  UltraVNC Remote Assistance Gateway
                </span>
                <span className="text-[11px] text-slate-400">
                  Target IP: {selectedAssetForDetails.ip_address || '127.0.0.1'} : {selectedAssetForDetails.vnc_port || 5900}
                </span>
              </div>
              <button
                onClick={() => {
                  setVncAsset(selectedAssetForDetails);
                  setIsVncModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-md shadow-blue-600/30 transition-all flex items-center gap-1.5"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Launch Remote VNC</span>
              </button>
            </div>

            {/* Software Inventory */}
            <div>
              <h3 className="text-sm font-bold text-slate-200 mb-2 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Installed Software ({(selectedAssetForDetails.installed_software_json || []).length} Titles)</span>
              </h3>
              <div className="max-h-60 overflow-y-auto space-y-1.5 text-xs pr-1">
                {selectedAssetForDetails.installed_software_json && selectedAssetForDetails.installed_software_json.length > 0 ? (
                  selectedAssetForDetails.installed_software_json.map((sw, idx) => (
                    <div key={idx} className="flex justify-between py-1.5 px-3 rounded-lg bg-slate-900/60 text-slate-300 border border-white/5">
                      <span className="truncate pr-2">{sw.name}</span>
                      <span className="font-mono text-[11px] text-slate-400 shrink-0">{sw.version || '—'}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 italic">No software items captured.</p>
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedAssetForDetails(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 glass-card hover:bg-slate-800 transition-colors"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asset Binding Modal for Unregistered PCs */}
      {selectedAssetForBinding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-lg bg-slate-950/90 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl p-6 relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setSelectedAssetForBinding(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-1">
              <Tag className="w-5 h-5 text-amber-400" />
              <span>ลงทะเบียนผูกรหัสทรัพย์สิน (Bind Official Asset Tag)</span>
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Register auto-discovered PC <strong className="text-cyan-300 font-mono">{selectedAssetForBinding.hostname}</strong> into the corporate asset database.
            </p>

            <form onSubmit={handleBindingSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Accounting Asset Tag *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. IT-PC-2026-2175"
                  value={bindAssetTag}
                  onChange={(e) => setBindAssetTag(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-slate-100 font-mono font-bold focus:border-emerald-500"
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
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-slate-200 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Physical Location
                </label>
                <select
                  value={bindLocationId}
                  onChange={(e) => setBindLocationId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-slate-200 focus:border-emerald-500 cursor-pointer"
                >
                  <option value="">เลือกอาคาร / สถานที่ (Select Building / Room)</option>
                  {(locations || [
                    { id: 'loc-b1f6-01', building: 'อาคาร 1 (โรงพยาบาลเอกชล)', floor: 'ชั้น 6', room_name: 'ห้องประชุมใหญ่ (Meeting Room B1F601)' },
                    { id: 'loc-b1f6-02', building: 'อาคาร 1 (โรงพยาบาลเอกชล)', floor: 'ชั้น 6', room_name: 'ศูนย์ควบคุมระบบ IT (B1F602)' },
                    { id: 'loc-b1f1-01', building: 'อาคาร 1 (โรงพยาบาลเอกชล)', floor: 'ชั้น 1', room_name: 'แผนกต้อนรับส่วนหน้า (Main Lobby B1F101)' }
                  ]).map((loc) => (
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
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-slate-200 focus:border-emerald-500"
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
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-slate-200 focus:border-emerald-500"
                  />
                </div>
              </div>

              {bindError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{bindError}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setSelectedAssetForBinding(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 glass-card hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bindMutation.isPending}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 disabled:opacity-50 shadow-lg shadow-emerald-600/30 hover:shadow-glow-emerald transition-all flex items-center gap-2 cursor-pointer"
                >
                  {bindMutation.isPending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังบันทึกและเปิดใช้งาน...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>ยืนยันลงทะเบียน &amp; เปิดใช้งาน (Confirm Binding &amp; Activate)</span>
                    </>
                  )}
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
    <React.Suspense fallback={<div className="p-8 text-center text-slate-400 font-mono text-xs">Loading master asset inventory...</div>}>
      <AssetsContent />
    </React.Suspense>
  );
}
