import { useState, useEffect, useCallback } from 'react';

const BASE = 'http://127.0.0.1:5000';

export interface PatientStatus {
  entry_count: number;
  entries_needed: number;
  calibrated: boolean;
  calibration_progress: string;
  progress_pct: number;
  history: HistoryEntry[];
}

export interface HistoryEntry {
  id: number;
  entry_date: string;
  has_text: boolean;
  has_audio: boolean;
  sleep_hours: number | null;
  sleep_quality: number | null;
  activity_level: number | null;
  music_mood_score: number | null;
  features_extracted: boolean;
}

export function usePatientData(userId: string) {
  const [status, setStatus] = useState<PatientStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetch(`${BASE}/daily/status?user_id=${encodeURIComponent(userId)}`);
      if (!r.ok) { setError(`HTTP ${r.status}`); return; }
      const d = await r.json();
      setStatus(d);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  const deleteData = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/daily/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      if (r.ok) await refresh();
      return true;
    } catch { return false; }
  }, [userId, refresh]);

  return { status, loading, error, refresh, deleteData };
}
