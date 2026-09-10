import React, { useState } from 'react';
import { Lock, BookOpen } from 'lucide-react';

export const LoginScreen = ({ onLogin }: { onLogin: (password: string) => void }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      onLogin(password);
    } else {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f111a] flex items-center justify-center p-4">
      <div className="bg-[#1a1d27] border border-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="bg-[#febd69]/10 p-4 rounded-full border border-[#febd69]/20">
            <Lock className="w-10 h-10 text-[#febd69]" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center text-white mb-2">Admin Authentication</h2>
        <p className="text-slate-400 text-center text-sm mb-8">
          Please enter the web dashboard password to access BusiMind Management.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Dashboard Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              className="w-full bg-[#0f111a] border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-[#febd69] focus:ring-1 focus:ring-[#febd69] transition-colors"
              placeholder="Enter admin password..."
              autoFocus
            />
            {error && (
              <p className="text-red-400 text-xs mt-2">Password is required.</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-[#febd69] hover:bg-[#f3a847] text-gray-900 font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <BookOpen className="w-5 h-5" />
            Access Dashboard
          </button>
        </form>
      </div>
    </div>
  );
};
