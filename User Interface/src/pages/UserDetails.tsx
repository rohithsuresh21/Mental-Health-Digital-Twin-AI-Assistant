import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Stethoscope } from 'lucide-react';
import NeuralBackground from '../NeuralBackground';

export default function UserDetails() {
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const generateUserId = () => `user_${Date.now().toString(36)}`;
  const userId = generateUserId();

  async function pickRole(role: 'admin' | 'patient') {
    if (role === 'admin') {
      setShowPassword(true);
      setError('');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: userId, role: 'patient' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }
      localStorage.setItem('role', role);
      localStorage.setItem('userId', userId);
      nav('/patient');
    } catch {
      setError('Connection failed');
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: userId, role: 'admin', password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Incorrect password');
        setPassword('');
        setLoading(false);
        return;
      }
      localStorage.setItem('role', 'admin');
      localStorage.setItem('userId', userId);
      nav('/admin');
    } catch {
      setError('Connection failed');
      setLoading(false);
    }
  }

  function cancelPassword() {
    setShowPassword(false);
    setPassword('');
    setError('');
  }

  return (
    <div className="min-h-screen bg-[#06080C] relative flex items-center justify-center p-6">
      <NeuralBackground />
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-light text-gray-100 tracking-tight">
            Mental Health Digital Twin
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            Your personal mental health monitoring system
          </p>
        </div>

        {showPassword ? (
          <div className="bg-[#11131C]/80 backdrop-blur-sm border border-[#1A202C] rounded-2xl p-8 mb-6">
            <label className="block text-xs text-gray-500 mb-4 font-medium tracking-wider uppercase text-center">
              Admin Password
            </label>
            <form onSubmit={handlePasswordSubmit}>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                className="w-full bg-[#0B0E14] border border-[#1A202C] rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-gray-500 transition-colors mb-4 text-center"
                placeholder="Enter admin password"
                autoFocus
              />
              {error && (
                <p className="text-red-400 text-xs text-center mb-4">{error}</p>
              )}
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={cancelPassword}
                  disabled={loading}
                  className="bg-[#11131C]/80 backdrop-blur-sm border border-[#1A202C] rounded-xl py-3 text-sm text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#11131C]/80 backdrop-blur-sm border border-[#1A202C] rounded-xl py-3 text-sm text-gray-200 hover:text-white hover:border-gray-400 transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Enter'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 text-center mb-4 uppercase tracking-widest">
              Select your role
            </p>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => pickRole('admin')}
                disabled={loading}
                className="bg-[#11131C]/80 backdrop-blur-sm border border-[#1A202C] rounded-2xl p-8 text-center hover:border-gray-600 transition-all group cursor-pointer disabled:opacity-50"
              >
                <div className="mb-3 flex justify-center"><BarChart3 className="h-8 w-8 text-blue-400 group-hover:text-blue-300 transition-colors" /></div>
                <div className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">Admin</div>
                <div className="text-[10px] text-gray-500 mt-2 leading-relaxed">
                  Full analytics dashboard with charts, risk scores, and anomaly detection
                </div>
              </button>
              <button
                onClick={() => pickRole('patient')}
                disabled={loading}
                className="bg-[#11131C]/80 backdrop-blur-sm border border-[#1A202C] rounded-2xl p-8 text-center hover:border-gray-600 transition-all group cursor-pointer disabled:opacity-50"
              >
                <div className="mb-3 flex justify-center"><Stethoscope className="h-8 w-8 text-emerald-400 group-hover:text-emerald-300 transition-colors" /></div>
                <div className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">Patient</div>
                <div className="text-[10px] text-gray-500 mt-2 leading-relaxed">
                  Daily check-in portal with health tracking and calibration progress
                </div>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
