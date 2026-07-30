import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Stethoscope } from 'lucide-react';
import NeuralBackground from '../NeuralBackground';

export default function UserDetails() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const nav = useNavigate();

  const getUserId = () => {
    let id = localStorage.getItem('userId');
    if (!id) {
      id = `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      localStorage.setItem('userId', id);
    }
    return id;
  };
  const userId = getUserId();

  async function pickRole(role: 'admin' | 'patient') {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: userId, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }
      localStorage.setItem('role', role);
      localStorage.setItem('userId', userId);
      nav(role === 'admin' ? '/admin' : '/patient');
    } catch {
      setError('Connection failed');
      setLoading(false);
    }
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

        <>
          <p className="text-xs text-gray-500 text-center mb-4 uppercase tracking-widest">
            Select your role
          </p>

          {error && (
            <p className="text-red-400 text-xs text-center mb-4">{error}</p>
          )}

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
      </div>
    </div>
  );
}
