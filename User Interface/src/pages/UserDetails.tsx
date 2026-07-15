import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NeuralBackground from '../NeuralBackground';

export default function UserDetails() {
  const [userId, setUserId] = useState('rohith_ms');
  const nav = useNavigate();

  function pickRole(role: 'admin' | 'patient') {
    localStorage.setItem('role', role);
    localStorage.setItem('userId', userId);
    nav(role === 'admin' ? '/admin' : '/patient');
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

        <div className="bg-[#11131C]/80 backdrop-blur-sm border border-[#1A202C] rounded-2xl p-8 mb-6">
          <label className="block text-xs text-gray-500 mb-2 font-medium tracking-wider uppercase">
            User ID
          </label>
          <input
            type="text"
            value={userId}
            onChange={e => setUserId(e.target.value)}
            className="w-full bg-[#0B0E14] border border-[#1A202C] rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-gray-500 transition-colors"
            placeholder="e.g. patient_001"
          />
        </div>

        <p className="text-xs text-gray-500 text-center mb-4 uppercase tracking-widest">
          Select your role
        </p>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => pickRole('admin')}
            className="bg-[#11131C]/80 backdrop-blur-sm border border-[#1A202C] rounded-2xl p-8 text-center hover:border-gray-600 transition-all group cursor-pointer"
          >
            <div className="text-3xl mb-3">&#x1F4CA;</div>
            <div className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">Admin</div>
            <div className="text-[10px] text-gray-500 mt-2 leading-relaxed">
              Full analytics dashboard with charts, risk scores, and anomaly detection
            </div>
          </button>
          <button
            onClick={() => pickRole('patient')}
            className="bg-[#11131C]/80 backdrop-blur-sm border border-[#1A202C] rounded-2xl p-8 text-center hover:border-gray-600 transition-all group cursor-pointer"
          >
            <div className="text-3xl mb-3">&#x1F9EC;</div>
            <div className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">Patient</div>
            <div className="text-[10px] text-gray-500 mt-2 leading-relaxed">
              Daily check-in portal with health tracking and calibration progress
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
