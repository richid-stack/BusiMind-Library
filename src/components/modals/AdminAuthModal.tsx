import React, { useState } from 'react';
import { X, Lock, KeyRound, AlertCircle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminAuthModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError(null);

    try {
      // Temporarily store to test with apiFetch
      localStorage.setItem('WEB_ADMIN_PASSWORD', password);

      const res = await apiFetch('/api/auth/verify', {
        method: 'POST',
      });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        localStorage.removeItem('WEB_ADMIN_PASSWORD');
        setError('Incorrect curator access key. Access denied.');
      }
    } catch (err: any) {
      localStorage.removeItem('WEB_ADMIN_PASSWORD');
      setError(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white text-[#0f1111] rounded-xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-[#131921] text-white px-6 py-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#ffd814]/20 border border-[#ffd814]/30 text-[#ffd814]">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Curator & Admin Portal</h2>
              <p className="text-xs text-gray-300">Authorized personnel only</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2.5 text-xs text-slate-700">
            <ShieldAlert className="w-4 h-4 text-[#de7921] shrink-0 mt-0.5" />
            <p>
              Administrative access unlocks bot token configuration, raw channel webhook monitors, book deletion controls, and batch metadata enrichment.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Curator Access Key
            </label>
            <div className="relative">
              <input
                type="password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#f3a847] focus:outline-none"
              />
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !password}
              className="bg-[#131921] hover:bg-[#232f3e] text-white px-5 py-2 rounded-md font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Unlock Admin Mode'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
