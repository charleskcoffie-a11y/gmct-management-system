import React, { useState, useEffect, useMemo } from 'react';
import type { Asset, AssetCategory, AssetCondition, AssetStatus, Settings, User, SyncStatus, AssetMaintenance } from '../types';
import { loadAssetsFromSupabase, saveAssetToSupabase, deleteAssetFromSupabase, loadAssetMaintenanceFromSupabase } from '../services/supabase';
import { formatCurrency } from '../utils';
import { v4 as uuidv4 } from 'uuid';

interface AssetsProps {
    settings: Settings;
    currentUser: User;
    syncStatus: SyncStatus;
}

const ASSET_CATEGORIES: { value: AssetCategory; label: string; icon: string }[] = [
    { value: 'building', label: 'Buildings & Facilities', icon: '🏢' },
    { value: 'technology', label: 'Technology', icon: '💻' },
    { value: 'musical-instrument', label: 'Musical Instruments', icon: '🎵' },
    { value: 'furniture', label: 'Furniture', icon: '🪑' },
    { value: 'vehicle', label: 'Vehicles', icon: '🚗' },
    { value: 'kitchen', label: 'Kitchen Equipment', icon: '🍽️' },
    { value: 'library', label: 'Library & Books', icon: '📚' },
    { value: 'art', label: 'Art & Decorations', icon: '🎨' },
    { value: 'tools', label: 'Tools & Equipment', icon: '🔧' },
    { value: 'hvac', label: 'HVAC Systems', icon: '❄️' },
    { value: 'other', label: 'Other', icon: '📦' },
];

const CONDITIONS: { value: AssetCondition; label: string; color: string }[] = [
    { value: 'excellent', label: 'Excellent', color: 'green' },
    { value: 'good', label: 'Good', color: 'blue' },
    { value: 'fair', label: 'Fair', color: 'yellow' },
    { value: 'poor', label: 'Poor', color: 'orange' },
    { value: 'needs-repair', label: 'Needs Repair', color: 'red' },
];

const STATUSES: { value: AssetStatus; label: string }[] = [
    { value: 'active', label: 'Active' },
    { value: 'storage', label: 'In Storage' },
    { value: 'repair', label: 'Under Repair' },
    { value: 'disposed', label: 'Disposed' },
];

const Assets: React.FC<AssetsProps> = ({ settings, currentUser, syncStatus }) => {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [maintenanceRecords, setMaintenanceRecords] = useState<AssetMaintenance[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<AssetCategory | 'all'>('all');
    const [conditionFilter, setConditionFilter] = useState<AssetCondition | 'all'>('all');
    const [statusFilter, setStatusFilter] = useState<AssetStatus | 'all'>('all');
    const [showDisposed, setShowDisposed] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
    const [selectedAssetForMaintenance, setSelectedAssetForMaintenance] = useState<string | null>(null);

    const isConnected = !!settings.supabaseUrl && !!settings.supabaseKey && syncStatus?.state === 'synced';

    useEffect(() => {
        if (!isConnected) {
            setIsLoading(false);
            return;
        }
        loadData();
    }, [isConnected, settings.supabaseUrl, settings.supabaseKey]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [assetsData, maintenanceData] = await Promise.all([
                loadAssetsFromSupabase(settings.supabaseUrl, settings.supabaseKey),
                loadAssetMaintenanceFromSupabase(settings.supabaseUrl, settings.supabaseKey)
            ]);
            setAssets(assetsData);
            setMaintenanceRecords(maintenanceData);
        } catch (err) {
            console.error('Failed to load assets:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredAssets = useMemo(() => {
        return assets.filter(asset => {
            if (!showDisposed && asset.status === 'disposed') return false;
            if (asset.deleted) return false;
            if (categoryFilter !== 'all' && asset.category !== categoryFilter) return false;
            if (conditionFilter !== 'all' && asset.condition !== conditionFilter) return false;
            if (statusFilter !== 'all' && asset.status !== statusFilter) return false;
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                return asset.name.toLowerCase().includes(query) ||
                    asset.serialNumber?.toLowerCase().includes(query) ||
                    asset.location?.toLowerCase().includes(query) ||
                    asset.description?.toLowerCase().includes(query);
            }
            return true;
        });
    }, [assets, categoryFilter, conditionFilter, statusFilter, searchQuery, showDisposed]);

    const stats = useMemo(() => {
        const activeAssets = assets.filter(a => !a.deleted && a.status === 'active');
        const totalValue = activeAssets.reduce((sum, a) => sum + (a.currentValue || a.purchasePrice || 0), 0);
        const needsMaintenance = activeAssets.filter(a => a.condition === 'needs-repair').length;
        const categoryBreakdown = ASSET_CATEGORIES.map(cat => ({
            ...cat,
            count: activeAssets.filter(a => a.category === cat.value).length,
            value: activeAssets.filter(a => a.category === cat.value).reduce((sum, a) => sum + (a.currentValue || a.purchasePrice || 0), 0)
        })).filter(c => c.count > 0);

        const highValue = activeAssets.filter(a => (a.currentValue || a.purchasePrice || 0) > 5000).length;

        return { totalValue, totalCount: activeAssets.length, needsMaintenance, categoryBreakdown, highValue };
    }, [assets]);

    const handleSaveAsset = async (asset: Asset) => {
        if (!isConnected) {
            alert('Please ensure you are connected to the cloud.');
            return;
        }
        setIsSaving(true);
        try {
            await saveAssetToSupabase(settings.supabaseUrl, settings.supabaseKey, asset);
            await loadData();
            setIsModalOpen(false);
            setSelectedAsset(null);
        } catch (e: any) {
            alert(`Failed to save asset: ${e.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteAsset = async (id: string) => {
        if (!confirm('Are you sure you want to delete this asset?')) return;
        if (!isConnected) {
            alert('Please ensure you are connected to the cloud.');
            return;
        }
        try {
            await deleteAssetFromSupabase(settings.supabaseUrl, settings.supabaseKey, id);
            await loadData();
        } catch (e: any) {
            alert(`Failed to delete asset: ${e.message}`);
        }
    };

    const calculateDepreciation = (asset: Asset): number => {
        if (!asset.purchaseDate || !asset.purchasePrice || !asset.usefulLifeYears) return asset.purchasePrice || 0;
        const purchaseYear = new Date(asset.purchaseDate).getFullYear();
        const currentYear = new Date().getFullYear();
        const yearsOwned = currentYear - purchaseYear;
        const annualDepreciation = asset.purchasePrice / asset.usefulLifeYears;
        const accumulated = annualDepreciation * yearsOwned;
        const currentValue = Math.max(0, asset.purchasePrice - accumulated);
        return currentValue;
    };

    const getCategoryIcon = (category: AssetCategory) => {
        return ASSET_CATEGORIES.find(c => c.value === category)?.icon || '📦';
    };

    const getConditionColor = (condition: AssetCondition) => {
        return CONDITIONS.find(c => c.value === condition)?.color || 'gray';
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="text-center">
                    <svg className="animate-spin h-12 w-12 text-indigo-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-slate-600 font-medium">Loading assets...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="bg-gradient-to-br from-slate-50 to-purple-50 p-8 rounded-2xl shadow-lg border-2 border-slate-200">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                            <span className="bg-gradient-to-br from-purple-500 to-indigo-600 p-3 rounded-xl shadow-md text-white">
                                🏛️
                            </span>
                            Asset Management
                        </h2>
                        <p className="text-slate-600 mt-2">Track and manage church assets, equipment, and property</p>
                    </div>
                    <button
                        onClick={() => { setSelectedAsset(null); setIsModalOpen(true); }}
                        disabled={!isConnected}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        Add Asset
                    </button>
                </div>

                {/* Stats Dashboard */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-blue-500 to-cyan-600 p-5 rounded-xl shadow-lg text-white">
                        <div className="text-sm font-bold uppercase mb-1">Total Assets</div>
                        <div className="text-3xl font-bold">{stats.totalCount}</div>
                    </div>
                    <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-5 rounded-xl shadow-lg text-white">
                        <div className="text-sm font-bold uppercase mb-1">Total Value</div>
                        <div className="text-3xl font-bold">{formatCurrency(stats.totalValue, settings.currency)}</div>
                    </div>
                    <div className="bg-gradient-to-br from-orange-500 to-red-600 p-5 rounded-xl shadow-lg text-white">
                        <div className="text-sm font-bold uppercase mb-1">Needs Maintenance</div>
                        <div className="text-3xl font-bold">{stats.needsMaintenance}</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-5 rounded-xl shadow-lg text-white">
                        <div className="text-sm font-bold uppercase mb-1">High Value (&gt;$5k)</div>
                        <div className="text-3xl font-bold">{stats.highValue}</div>
                    </div>
                </div>
            </div>

            {/* Filters & Controls */}
            <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                    <input
                        type="text"
                        placeholder="Search assets..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="border-2 border-slate-300 rounded-lg py-2 px-4 font-medium focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                    <select
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value as any)}
                        className="border-2 border-slate-300 rounded-lg py-2 px-4 font-medium focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="all">All Categories</option>
                        {ASSET_CATEGORIES.map(cat => (
                            <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
                        ))}
                    </select>
                    <select
                        value={conditionFilter}
                        onChange={e => setConditionFilter(e.target.value as any)}
                        className="border-2 border-slate-300 rounded-lg py-2 px-4 font-medium focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="all">All Conditions</option>
                        {CONDITIONS.map(cond => (
                            <option key={cond.value} value={cond.value}>{cond.label}</option>
                        ))}
                    </select>
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as any)}
                        className="border-2 border-slate-300 rounded-lg py-2 px-4 font-medium focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="all">All Statuses</option>
                        {STATUSES.map(stat => (
                            <option key={stat.value} value={stat.value}>{stat.label}</option>
                        ))}
                    </select>
                    <label className="flex items-center gap-2 border-2 border-slate-300 rounded-lg py-2 px-4 font-medium cursor-pointer hover:bg-slate-50">
                        <input
                            type="checkbox"
                            checked={showDisposed}
                            onChange={e => setShowDisposed(e.target.checked)}
                            className="w-4 h-4"
                        />
                        <span>Show Disposed</span>
                    </label>
                </div>
                <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-600 font-medium">
                        Showing {filteredAssets.length} of {assets.filter(a => !a.deleted).length} assets
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${viewMode === 'grid' ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-700'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM13 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2z" />
                            </svg>
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={`px-4 py-2 rounded-lg font-bold transition-all ${viewMode === 'table' ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-700'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Assets Display */}
            {filteredAssets.length === 0 ? (
                <div className="bg-white p-12 rounded-xl shadow-lg border-2 border-slate-200 text-center">
                    <div className="text-6xl mb-4">📦</div>
                    <p className="text-xl font-bold text-slate-600 mb-2">No assets found</p>
                    <p className="text-slate-500">Try adjusting your filters or add your first asset</p>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAssets.map(asset => {
                        const value = asset.currentValue || calculateDepreciation(asset);
                        const condColor = getConditionColor(asset.condition);
                        
                        return (
                            <div key={asset.id} className="bg-white rounded-xl shadow-lg border-2 border-slate-200 overflow-hidden hover:shadow-xl transition-all">
                                <div className="h-48 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-6xl">
                                    {asset.photoUrl ? <img src={asset.photoUrl} alt={asset.name} className="w-full h-full object-cover" /> : getCategoryIcon(asset.category)}
                                </div>
                                <div className="p-5">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h3 className="text-xl font-bold text-slate-800 mb-1">{asset.name}</h3>
                                            <p className="text-sm text-slate-500">{ASSET_CATEGORIES.find(c => c.value === asset.category)?.label}</p>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold bg-${condColor}-100 text-${condColor}-700`}>
                                            {CONDITIONS.find(c => c.value === asset.condition)?.label}
                                        </span>
                                    </div>
                                    <div className="space-y-2 mb-4 text-sm">
                                        {asset.location && <div className="flex items-center gap-2 text-slate-600"><span>📍</span>{asset.location}</div>}
                                        {asset.serialNumber && <div className="flex items-center gap-2 text-slate-600"><span>#</span>{asset.serialNumber}</div>}
                                        <div className="text-2xl font-bold text-purple-600">{formatCurrency(value, settings.currency)}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setSelectedAsset(asset); setIsModalOpen(true); }}
                                            className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-purple-700 transition-all"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => { setSelectedAssetForMaintenance(asset.id); setShowMaintenanceModal(true); }}
                                            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition-all"
                                        >
                                            Maintenance
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-lg border-2 border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                                <tr>
                                    <th className="px-6 py-3 text-left text-sm font-bold uppercase">Asset</th>
                                    <th className="px-6 py-3 text-left text-sm font-bold uppercase">Category</th>
                                    <th className="px-6 py-3 text-left text-sm font-bold uppercase">Location</th>
                                    <th className="px-6 py-3 text-left text-sm font-bold uppercase">Value</th>
                                    <th className="px-6 py-3 text-left text-sm font-bold uppercase">Condition</th>
                                    <th className="px-6 py-3 text-left text-sm font-bold uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-sm font-bold uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredAssets.map(asset => {
                                    const value = asset.currentValue || calculateDepreciation(asset);
                                    const condColor = getConditionColor(asset.condition);
                                    
                                    return (
                                        <tr key={asset.id} className="hover:bg-purple-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-2xl">{getCategoryIcon(asset.category)}</span>
                                                    <div>
                                                        <div className="font-bold text-slate-800">{asset.name}</div>
                                                        {asset.serialNumber && <div className="text-xs text-slate-500">SN: {asset.serialNumber}</div>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-700">{ASSET_CATEGORIES.find(c => c.value === asset.category)?.label}</td>
                                            <td className="px-6 py-4 text-slate-700">{asset.location || '-'}</td>
                                            <td className="px-6 py-4 font-bold text-purple-600">{formatCurrency(value, settings.currency)}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold bg-${condColor}-100 text-${condColor}-700`}>
                                                    {CONDITIONS.find(c => c.value === asset.condition)?.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                                                    {STATUSES.find(s => s.value === asset.status)?.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => { setSelectedAsset(asset); setIsModalOpen(true); }}
                                                        className="text-purple-600 hover:text-purple-700 font-bold"
                                                        title="Edit"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        onClick={() => { setSelectedAssetForMaintenance(asset.id); setShowMaintenanceModal(true); }}
                                                        className="text-blue-600 hover:text-blue-700 font-bold"
                                                        title="Maintenance"
                                                    >
                                                        🔧
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteAsset(asset.id)}
                                                        className="text-red-600 hover:text-red-700 font-bold"
                                                        title="Delete"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Asset Modal */}
            {isModalOpen && (
                <AssetModal
                    asset={selectedAsset}
                    categories={ASSET_CATEGORIES}
                    conditions={CONDITIONS}
                    statuses={STATUSES}
                    onSave={handleSaveAsset}
                    onClose={() => { setIsModalOpen(false); setSelectedAsset(null); }}
                    isSaving={isSaving}
                    currentUser={currentUser}
                    currency={settings.currency}
                />
            )}

            {/* Maintenance Modal */}
            {showMaintenanceModal && selectedAssetForMaintenance && (
                <MaintenanceModal
                    assetId={selectedAssetForMaintenance}
                    asset={assets.find(a => a.id === selectedAssetForMaintenance)!}
                    maintenanceRecords={maintenanceRecords.filter(m => m.assetId === selectedAssetForMaintenance)}
                    settings={settings}
                    currentUser={currentUser}
                    onClose={() => { setShowMaintenanceModal(false); setSelectedAssetForMaintenance(null); }}
                    onRefresh={loadData}
                />
            )}
        </div>
    );
};

// Asset Modal Component
const AssetModal: React.FC<{
    asset: Asset | null;
    categories: any[];
    conditions: any[];
    statuses: any[];
    onSave: (asset: Asset) => void;
    onClose: () => void;
    isSaving: boolean;
    currentUser: User;
    currency: string;
}> = ({ asset, categories, conditions, statuses, onSave, onClose, isSaving, currentUser, currency }) => {
    const [formData, setFormData] = useState<Asset>(asset || {
        id: uuidv4(),
        name: '',
        category: 'other',
        condition: 'good',
        status: 'active',
        createdBy: currentUser.username,
        createdAt: new Date().toISOString(),
    } as Asset);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            ...formData,
            updatedBy: currentUser.username,
            updatedAt: new Date().toISOString(),
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-8">
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white rounded-t-2xl">
                    <h3 className="text-2xl font-bold">{asset ? 'Edit Asset' : 'Add New Asset'}</h3>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Asset Name *</label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full border-2 border-slate-300 rounded-lg py-2 px-4 font-medium focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Category *</label>
                            <select
                                required
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value as AssetCategory })}
                                className="w-full border-2 border-slate-300 rounded-lg py-2 px-4 font-medium focus:ring-2 focus:ring-purple-500"
                            >
                                {categories.map(cat => (
                                    <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Location</label>
                            <input
                                type="text"
                                value={formData.location || ''}
                                onChange={e => setFormData({ ...formData, location: e.target.value })}
                                className="w-full border-2 border-slate-300 rounded-lg py-2 px-4 font-medium focus:ring-2 focus:ring-purple-500"
                                placeholder="e.g., Sanctuary, Office, Storage"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Serial Number</label>
                            <input
                                type="text"
                                value={formData.serialNumber || ''}
                                onChange={e => setFormData({ ...formData, serialNumber: e.target.value })}
                                className="w-full border-2 border-slate-300 rounded-lg py-2 px-4 font-medium focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Model</label>
                            <input
                                type="text"
                                value={formData.model || ''}
                                onChange={e => setFormData({ ...formData, model: e.target.value })}
                                className="w-full border-2 border-slate-300 rounded-lg py-2 px-4 font-medium focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Purchase Date</label>
                            <input
                                type="date"
                                value={formData.purchaseDate || ''}
                                onChange={e => setFormData({ ...formData, purchaseDate: e.target.value })}
                                className="w-full border-2 border-slate-300 rounded-lg py-2 px-4 font-medium focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Purchase Price ({currency})</label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.purchasePrice || ''}
                                onChange={e => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })}
                                className="w-full border-2 border-slate-300 rounded-lg py-2 px-4 font-medium focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Current Value ({currency})</label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.currentValue || ''}
                                onChange={e => setFormData({ ...formData, currentValue: parseFloat(e.target.value) || 0 })}
                                className="w-full border-2 border-slate-300 rounded-lg py-2 px-4 font-medium focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Useful Life (Years)</label>
                            <input
                                type="number"
                                value={formData.usefulLifeYears || ''}
                                onChange={e => setFormData({ ...formData, usefulLifeYears: parseInt(e.target.value) || 0 })}
                                className="w-full border-2 border-slate-300 rounded-lg py-2 px-4 font-medium focus:ring-2 focus:ring-purple-500"
                                placeholder="For depreciation calculation"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Condition *</label>
                            <select
                                required
                                value={formData.condition}
                                onChange={e => setFormData({ ...formData, condition: e.target.value as AssetCondition })}
                                className="w-full border-2 border-slate-300 rounded-lg py-2 px-4 font-medium focus:ring-2 focus:ring-purple-500"
                            >
                                {conditions.map(cond => (
                                    <option key={cond.value} value={cond.value}>{cond.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Status *</label>
                            <select
                                required
                                value={formData.status}
                                onChange={e => setFormData({ ...formData, status: e.target.value as AssetStatus })}
                                className="w-full border-2 border-slate-300 rounded-lg py-2 px-4 font-medium focus:ring-2 focus:ring-purple-500"
                            >
                                {statuses.map(stat => (
                                    <option key={stat.value} value={stat.value}>{stat.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Assigned To</label>
                            <input
                                type="text"
                                value={formData.assignedTo || ''}
                                onChange={e => setFormData({ ...formData, assignedTo: e.target.value })}
                                className="w-full border-2 border-slate-300 rounded-lg py-2 px-4 font-medium focus:ring-2 focus:ring-purple-500"
                                placeholder="Person or department"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Warranty Expires</label>
                            <input
                                type="date"
                                value={formData.warrantyExpires || ''}
                                onChange={e => setFormData({ ...formData, warrantyExpires: e.target.value })}
                                className="w-full border-2 border-slate-300 rounded-lg py-2 px-4 font-medium focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Insurance Policy #</label>
                            <input
                                type="text"
                                value={formData.insurancePolicy || ''}
                                onChange={e => setFormData({ ...formData, insurancePolicy: e.target.value })}
                                className="w-full border-2 border-slate-300 rounded-lg py-2 px-4 font-medium focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Insurance Coverage ({currency})</label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.insuranceCoverage || ''}
                                onChange={e => setFormData({ ...formData, insuranceCoverage: parseFloat(e.target.value) || 0 })}
                                className="w-full border-2 border-slate-300 rounded-lg py-2 px-4 font-medium focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Insurance Expires</label>
                            <input
                                type="date"
                                value={formData.insuranceExpires || ''}
                                onChange={e => setFormData({ ...formData, insuranceExpires: e.target.value })}
                                className="w-full border-2 border-slate-300 rounded-lg py-2 px-4 font-medium focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
                        <textarea
                            value={formData.description || ''}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            className="w-full border-2 border-slate-300 rounded-lg py-2 px-4 font-medium focus:ring-2 focus:ring-purple-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Notes</label>
                        <textarea
                            value={formData.notes || ''}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            rows={2}
                            className="w-full border-2 border-slate-300 rounded-lg py-2 px-4 font-medium focus:ring-2 focus:ring-purple-500"
                        />
                    </div>
                    <div className="flex gap-4 pt-4">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                        >
                            {isSaving ? 'Saving...' : 'Save Asset'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold hover:bg-slate-300 transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Maintenance Modal Component (placeholder - to be expanded)
const MaintenanceModal: React.FC<{
    assetId: string;
    asset: Asset;
    maintenanceRecords: AssetMaintenance[];
    settings: Settings;
    currentUser: User;
    onClose: () => void;
    onRefresh: () => void;
}> = ({ assetId, asset, maintenanceRecords, settings, currentUser, onClose, onRefresh }) => {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-y-auto">
                <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-white rounded-t-2xl">
                    <h3 className="text-2xl font-bold">Maintenance History: {asset.name}</h3>
                </div>
                <div className="p-6">
                    {maintenanceRecords.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <p className="text-lg font-bold mb-2">No maintenance records yet</p>
                            <p>Maintenance tracking coming soon</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {maintenanceRecords.map(record => (
                                <div key={record.id} className="border-2 border-slate-200 rounded-lg p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-bold text-slate-800">{record.description}</div>
                                        <div className="text-sm text-slate-500">{new Date(record.maintenanceDate).toLocaleDateString()}</div>
                                    </div>
                                    {record.cost && <div className="text-purple-600 font-bold">{formatCurrency(record.cost, settings.currency)}</div>}
                                    {record.serviceProvider && <div className="text-sm text-slate-600">Provider: {record.serviceProvider}</div>}
                                </div>
                            ))}
                        </div>
                    )}
                    <button
                        onClick={onClose}
                        className="w-full mt-6 bg-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold hover:bg-slate-300 transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Assets;
