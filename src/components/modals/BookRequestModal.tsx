import React, { useState } from 'react';
import { X, BookPlus, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const BookRequestModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [topic, setTopic] = useState('Business & Strategy');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          author: author.trim() || undefined,
          topic,
          userId: 'web_reader_' + Math.random().toString(36).substring(2, 7),
        }),
      });

      if (res.ok) {
        setSuccess(true);
        setTitle('');
        setAuthor('');
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 2200);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to submit request');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white text-[#0f1111] rounded-xl shadow-2xl border border-gray-200 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-[#131921] text-white px-6 py-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#f3a847]/20 border border-[#f3a847]/30 text-[#f3a847]">
              <BookPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Request a Book or Paper</h2>
              <p className="text-xs text-gray-300">Suggest titles for community indexing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {success ? (
            <div className="py-8 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto animate-bounce" />
              <h3 className="font-bold text-lg text-gray-900">Request Submitted!</h3>
              <p className="text-xs text-gray-600 max-w-sm mx-auto">
                Thank you! Our curation curators have added your request to the acquisition wishlist.
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Book or Working Paper Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Valuation: Measuring and Managing the Value of Companies"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#f3a847] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Author(s) or Institution (Optional)
                </label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="e.g., McKinsey & Company, Tim Koller"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#f3a847] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Primary Domain / Topic
                </label>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#f3a847] focus:outline-none bg-white"
                >
                  <option value="Business & Strategy">Business & Strategy</option>
                  <option value="Valuation & Corporate Finance">Valuation & Corporate Finance</option>
                  <option value="Investing & Capital Markets">Investing & Capital Markets</option>
                  <option value="Economics & Sovereign Policy">Economics & Sovereign Policy</option>
                  <option value="Leadership & Management">Leadership & Management</option>
                  <option value="Academic Research & Working Papers">Academic Research & Working Papers</option>
                </select>
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
                  disabled={loading || !title.trim()}
                  className="bg-[#febd69] hover:bg-[#f3a847] text-[#0f1111] px-5 py-2 rounded-md font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading ? (
                    'Submitting...'
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Submit Request
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
