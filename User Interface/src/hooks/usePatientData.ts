import { useState, useEffect, useCallback } from 'react';

const BASE = '/api';

export interface StageReadiness {
  key: string;
  name: string;
  ready: boolean;
  have: number;
  need: number;
  note: string;
}

export interface DatasetReport {
  days_logged: number;
  days_with_features: number;
  analysis_records: number;
  first_date: string | null;
  last_date: string | null;
  span_days: number;
  missing_days: number;
  current_streak: number;
  longest_streak: number;
  days_with_health: number;
  days_with_voice: number;
  sources: Record<string, number>;
  stages: StageReadiness[];
  can_analyze: boolean;
}

export interface PatientStatus {
  entry_count: number;
  entries_needed: number;
  calibrated: boolean;
  calibration_progress: string;
  progress_pct: number;
  history: HistoryEntry[];
  dataset?: DatasetReport;
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
  sources?: string[];
}

export function usePatientData(userId: string) {
  const [status, setStatus] = useState<PatientStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetch(`${BASE}/daily/status?user_id=${encodeURIComponent(userId)}`, {
        credentials: 'include',
      });
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
        credentials: 'include',
        body: JSON.stringify({ user_id: userId }),
      });
      if (r.ok) await refresh();
      return true;
    } catch { return false; }
  }, [userId, refresh]);

  return { status, loading, error, refresh, deleteData };
}
