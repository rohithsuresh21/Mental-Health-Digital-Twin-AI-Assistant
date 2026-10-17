import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import { 
  Activity, 
  Bell, 
  FileText, 
  User, 
  Clock, 
  Settings, 
  Shield, 
  Upload, 
  Mic, 
  Brain, 
  Search, 
  ArrowUpRight, 
  ArrowRight,
  Loader2, 
  File, 
  AlertTriangle,
  RefreshCw,
  Compass,
  Database,
  Plus,
  Minus,
  Sun,
  Moon,
  ScrollText,
  X,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Cloud,
  Zap,
  Info,
  Radar,
  Network,
  ScatterChart,
  BarChart3,
  Sparkles,
  Target,
  Eye,
  Gauge,
  CalendarDays,
  Lock
} from 'lucide-react';
import { IngestionInput, DiagnosticData } from './types';
import { defaultDiagnosticData } from './defaultData';
import { mapFlaskRunResponse } from './diagnosisEngine';
import PatientIntakePortal from './components/PatientIntakePortal';
import PatientTelemetry from './components/PatientTelemetry';
import ResultsPage from './insights/ResultsPage';
import ExplainPage from './insights/ExplainPage';
import ForecastPage from './insights/ForecastPage';
import { C as INS } from './insights/theme';
import Guide from './guide/Guide';
import { onEvent, spotlight, type NavAction } from './guide/bus';

function NoResultsYet({ onGo, isPatient }: { onGo: () => void; isPatient: boolean }) {
  return (
    <div className="insights mx-auto max-w-[640px] py-24 text-center" style={{ color: INS.text }}>
      <h1 className="font-serif text-[34px] leading-tight">Run an analysis first</h1>
      <p className="mt-3 text-[14px]" style={{ color: INS.text2 }}>
        {isPatient ? 'Once your baseline is calibrated, run the analysis from the Analysis page.' : 'Upload journal entries and start the analysis to see results here.'}
      </p>
      <button onClick={onGo} className="mt-8 rounded-xl px-5 py-2.5 text-[13px] cursor-pointer" style={{ background: INS.raised, color: INS.text }}>
        {isPatient ? 'Go to Analysis' : 'Go to upload'}
      </button>
    </div>
  );
}
import { usePatientData } from './hooks/usePatientData';

interface ClinicalAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const API = "http://localhost:3000";

export default function App() {
  const role = localStorage.getItem('role') || 'admin';
  const userId = localStorage.getItem('userId') || 'Alex@1996';
  const isPatient = role === 'patient';

  // Browser protection: disable right-click and dev tools shortcuts
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C'))) {
        e.preventDefault();
      }
    };
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Session verification on load
  useEffect(() => {
    fetch('/api/auth/verify', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('unauth'); return r.json(); })
      .then(d => {
        if (d.authenticated && d.user_id !== userId) {
          localStorage.setItem('userId', d.user_id);
        }
      })
      .catch(() => {
        // Session expired — redirect to login
        localStorage.removeItem('role');
        localStorage.removeItem('userId');
        window.location.href = '/';
      });
  }, []);

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  type Tab = 'dashboard' | 'clinical' | 'analytics' | 'explainable' | 'forecast' | 'profile' | 'intake';
  const [activeTab, setActiveTabState] = useState<Tab>('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [modalContent, setModalContent] = useState<'docs' | 'privacy' | 'terms' | null>(null);
  const [tabTransitionKey, setTabTransitionKey] = useState(0);
  const [heroTransition, setHeroTransition] = useState<'idle' | 'compressing' | 'radiating' | 'revealing' | 'done'>('idle');

  // Browser back/forward: sync tab with history
  const setActiveTab = (tab: Tab) => {
    setActiveTabState(tab);
    setTabTransitionKey(k => k + 1);
    history.pushState({ tab }, '', `#${tab}`);
  };

  // Cinematic hero transition: compress -> radiate -> reveal -> switch
  const handleGetStarted = () => {
    if (heroTransition !== 'idle') return;
    setHeroTransition('compressing');
    setTimeout(() => setHeroTransition('radiating'), 400);
    setTimeout(() => setHeroTransition('revealing'), 1100);
    setTimeout(() => {
      setHeroTransition('done');
      setActiveTab('profile');
    }, 1700);
  };

  useEffect(() => {
    // Set initial hash
    const initialHash = window.location.hash.replace('#', '') as Tab;
    if (initialHash && ['dashboard','clinical','analytics','explainable','forecast','profile','intake'].includes(initialHash)) {
      setActiveTabState(initialHash);
    }

    const handlePopState = (e: PopStateEvent) => {
      if (e.state?.tab) {
        setActiveTabState(e.state.tab);
      } else {
        const hash = window.location.hash.replace('#', '') as Tab;
        if (hash && ['dashboard','clinical','analytics','explainable','forecast','profile','intake'].includes(hash)) {
          setActiveTabState(hash);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStage, setAnalysisStage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatchCount, setSearchMatchCount] = useState(0);
  const [searchCurrentIdx, setSearchCurrentIdx] = useState(-1);
  const searchHighlightsRef = useRef<HTMLElement[]>([]);

  // Real-time search highlighting
  useEffect(() => {
    // Clear previous highlights
    searchHighlightsRef.current.forEach(el => {
      (el as HTMLElement).style.outline = '';
      (el as HTMLElement).style.outlineOffset = '';
    });
    searchHighlightsRef.current = [];

    if (!searchQuery.trim() || activeTab !== 'analytics') {
      setSearchMatchCount(0);
      setSearchCurrentIdx(-1);
      return;
    }

    const q = searchQuery.toLowerCase();
    const matches: HTMLElement[] = [];
    const searchableTags = document.querySelectorAll('#analytics-tab h2, #analytics-tab h3, #analytics-tab h4, #analytics-tab p, #analytics-tab span, #analytics-tab button, #analytics-tab [data-searchable]');
    
    for (const el of searchableTags) {
      const text = el.textContent?.toLowerCase() || '';
      const id = el.id?.toLowerCase() || '';
      if (text.includes(q) || id.includes(q)) {
        matches.push(el as HTMLElement);
      }
    }

    setSearchMatchCount(matches.length);
    searchHighlightsRef.current = matches;

    if (matches.length > 0) {
      setSearchCurrentIdx(0);
      // Highlight first match
      matches[0].style.outline = '2px solid #3b82f6';
      matches[0].style.outlineOffset = '2px';
      matches[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      setSearchCurrentIdx(-1);
    }
  }, [searchQuery, activeTab]);

  // Navigate search results
  const navigateSearch = (direction: 'next' | 'prev') => {
    const matches = searchHighlightsRef.current;
    if (matches.length === 0) return;

    // Remove current highlight
    if (searchCurrentIdx >= 0 && searchCurrentIdx < matches.length) {
      matches[searchCurrentIdx].style.outline = '';
      matches[searchCurrentIdx].style.outlineOffset = '';
    }

    let nextIdx = searchCurrentIdx;
    if (direction === 'next') {
      nextIdx = (searchCurrentIdx + 1) % matches.length;
    } else {
      nextIdx = (searchCurrentIdx - 1 + matches.length) % matches.length;
    }

    setSearchCurrentIdx(nextIdx);
    matches[nextIdx].style.outline = '2px solid #3b82f6';
    matches[nextIdx].style.outlineOffset = '2px';
    matches[nextIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Clear search on tab change
  useEffect(() => {
    if (activeTab !== 'analytics') {
      setSearchQuery('');
      setSearchMatchCount(0);
      setSearchCurrentIdx(-1);
    }
  }, [activeTab]);
  // Dynamic diagnostic data (starts with default, updated upon form submission)
  const [diagnosticData, setDiagnosticData] = useState<DiagnosticData>(defaultDiagnosticData);
  const [hasRunAnalysis, setHasRunAnalysis] = useState(false);
  const [pipelineRaw, setPipelineRaw] = useState<any>(null);
  const pipelineRawRef = useRef<any>(null); pipelineRawRef.current = pipelineRaw;

  // Patient data from daily portal
  const patientData = usePatientData(isPatient ? userId : '');
  const [patientFullView, setPatientFullView] = useState(false);
  const [patientAnalyzing, setPatientAnalyzing] = useState(false);
  const [patientAnalysisError, setPatientAnalysisError] = useState<string | null>(null);
  // The Guide drives the app: switch page, open the right sub-tab, scroll + highlight, focus a day / row
  useEffect(() => onEvent<NavAction>('mhdt:navigate', a => {
    if (a.tab === 'analytics' && isPatient) setPatientFullView(!!pipelineRawRef.current);
    setActiveTab(a.tab as any);
    setIsMenuOpen(false);
    if (a.intakeTab) setTimeout(() => window.dispatchEvent(new CustomEvent('mhdt:intake-tab', { detail: a.intakeTab })), 120);
    if (a.target) setTimeout(() => spotlight(a.target!), 380);
    if (a.day != null) setTimeout(() => window.dispatchEvent(new CustomEvent('mhdt:focus-day', { detail: a.day })), 700);
    if (a.row) setTimeout(() => window.dispatchEvent(new CustomEvent('mhdt:open-row', { detail: a.row })), 1600);
  }), [isPatient]);

  // Profile photo
  const [avatarUrl, setAvatarUrl] = useState<string>(() => {
    return localStorage.getItem(`avatar_${userId}`) || '';
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('avatar', file);
    try {
      const res = await fetch('/api/auth/avatar', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const data = await res.json();
      if (data.success && data.avatar_url) {
        const url = `${data.avatar_url}?t=${Date.now()}`;
        setAvatarUrl(url);
        localStorage.setItem(`avatar_${userId}`, url);
      }
    } catch (err) {
      console.error('Avatar upload failed:', err);
    }
  };

  // Clinical Alerts state — reset on fresh page load via sessionStorage
  const [clinicalAlerts, setClinicalAlerts] = useState<ClinicalAlert[]>(() => {
    try {
      const saved = sessionStorage.getItem('clinicalAlerts');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [isAlertsDropdownOpen, setIsAlertsDropdownOpen] = useState(false);
  const alertsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (alertsDropdownRef.current && !alertsDropdownRef.current.contains(event.target as Node)) {
        const bellButton = document.getElementById('header-bell-button');
        if (bellButton && bellButton.contains(event.target as Node)) {
          return;
        }
        setIsAlertsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Persist notifications to sessionStorage (resets on tab close)
  useEffect(() => {
    sessionStorage.setItem('clinicalAlerts', JSON.stringify(clinicalAlerts));
  }, [clinicalAlerts]);

  // Form input states with personal details
  const [inputs, setInputs] = useState<IngestionInput>({
    fullName: '',
    age: 0,
    gender: '',
    bloodType: '',
    medicalHistory: '',
    symptoms: '',
    communicationLogs: '',
    sleepDuration: 0,
    sleepQuality: 0,
    physicalActivity: 0,
    lookaheadHorizon: '5 days',
    voiceRecordingsText: '',
    clinicalReportsText: '',
    dobDay: '',
    dobMonth: '',
    dobYear: ''
  });

  // File upload refs and state
  const audioInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [audioFile, setAudioFile] = useState<string | null>(null);
  const [audioFileObj, setAudioFileObj] = useState<File | null>(null);
  const [docFile, setDocFile] = useState<string | null>(null);
  const [docFileObj, setDocFileObj] = useState<File | null>(null);

  // Collapsed sections in Analytics Dashboard
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    moodRisk: false,
    baseline: false,
    cusum: false,
    whatsDriving: false,
    techDetails: true,
    tftForecast: true,
  });


  // Collapsed sections in Explainable AI
  const [explainWhyPredictionCollapsed, setExplainWhyPredictionCollapsed] = useState(false);
  const [explainRootCauseCollapsed, setExplainRootCauseCollapsed] = useState(false);

  // SHAP explanation state
  const [shapData, setShapData] = useState<any>(null);
  const [shapLoading, setShapLoading] = useState(false);
  const [shapError, setShapError] = useState<string | null>(null);

  // Fetch SHAP explanation when Explainable AI tab is opened
  useEffect(() => {
    if (activeTab !== 'explainable' || !hasRunAnalysis) return;
    // Prefer data from diagnose response
    if (diagnosticData.pipelineShapExplanation) {
      setShapData(diagnosticData.pipelineShapExplanation);
      return;
    }
    let cancelled = false;
    setShapLoading(true);
    setShapError(null);
    fetch('/api/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ user_id: userId }),
      signal: AbortSignal.timeout(30000),
    })
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(data => { if (!cancelled) setShapData(data.explanation || null); })
      .catch(e => { if (!cancelled) setShapError(e.message || 'Failed to load explanation'); })
      .finally(() => { if (!cancelled) setShapLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, hasRunAnalysis]);

  // Selected detector tab in What's Driving That Signal
  const [selectedDetector, setSelectedDetector] = useState(0);
  const [detectorInfoKey, setDetectorInfoKey] = useState<string | null>(null);

  // Lock body scroll while the detector info panel is open
  useEffect(() => {
    if (detectorInfoKey) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prevOverflow; };
    }
  }, [detectorInfoKey]);

  // Global hover state for longitudinal charts
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [chartMouseXPct, setChartMouseXPct] = useState(50);
  const [cusumMouseXPct, setCusumMouseXPct] = useState(50);
  const [forecastMouseXPct, setForecastMouseXPct] = useState(50);
  const [detectorMouseXPct, setDetectorMouseXPct] = useState(50);

  // Hover state for individual detector sparkline charts
  const [detectorHoveredIndex, setDetectorHoveredIndex] = useState<number | null>(null);

  // Detector chart viewport: [startIndex, endIndex] for zoom/scroll
  const [detectorViewport, setDetectorViewport] = useState<[number, number]>([-1, -1]);
  const [detectorTimeMode, setDetectorTimeMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Chart viewport: [startIndex, endIndex] for zoom/scroll
  const [chartViewport, setChartViewport] = useState<[number, number]>([-1, -1]);

  // CUSUM independent viewport
  const [cusumViewport, setCusumViewport] = useState<[number, number]>([-1, -1]);

  // TFT Forecast viewport
  // Detector forecasts
  const [isForecastingDetectors, setIsForecastingDetectors] = useState(false);
  const [detectorForecastData, setDetectorForecastData] = useState<Record<string, number[]> | null>(null);
  const [detectorForecastError, setDetectorForecastError] = useState<string | null>(null);
  const [selectedDetectorTab, setSelectedDetectorTab] = useState<string>('mahalanobis');
  const [forecastHoverIdx, setForecastHoverIdx] = useState<number | null>(null);

  // CUSUM toggle tab: 0=Upper, 1=Lower, 2=Both
  const [selectedCusumTab, setSelectedCusumTab] = useState(2);

  // Compile & download medical summary as PDF
  const compileMedicalSummary = async () => {
    try {
      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ diagnosticData, inputs }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `Server responded ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `Medical_Summary_${inputs.fullName?.replace(/\s+/g, '_') || 'Patient'}_${dateStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('PDF generation failed:', err);
      alert(`Failed to generate PDF: ${err.message}`);
    }
  };

  // Reset viewport when analysis runs with new data
  const prevDataRef = useRef(diagnosticData);
  useEffect(() => {
    if (diagnosticData !== prevDataRef.current) {
      prevDataRef.current = diagnosticData;
      setChartViewport([-1, -1]);
      setCusumViewport([-1, -1]);
    }
  }, [diagnosticData]);

  // Initialize chart viewport when data loads — zoomed in to last ~20% by default
  useEffect(() => {
    if (chartViewport[0] === -1) {
      const dates = diagnosticData.pipelineTimestamps || [];
      if (dates.length > 0) {
        const visibleCount = Math.max(6, Math.round(dates.length * 0.2));
        const end = dates.length - 1;
        const start = Math.max(0, end - visibleCount + 1);
        setChartViewport([start, end]);
      }
    }
  }, [chartViewport, diagnosticData.pipelineTimestamps]);

  // Initialize CUSUM viewport when data loads — full range by default
  useEffect(() => {
    if (cusumViewport[0] === -1) {
      const upper = diagnosticData.pipelineCusumUpper || [];
      const lower = diagnosticData.pipelineCusumLower || [];
      const len = Math.max(upper.length, lower.length);
      if (len > 0) {
        setCusumViewport([0, len - 1]);
      }
    }
  }, [cusumViewport, diagnosticData.pipelineCusumUpper, diagnosticData.pipelineCusumLower]);

  // Canvas constellation animation background
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Canvas atmospheric glow — pure volumetric gradient, no visible lines
  const atmosphereCanvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = atmosphereCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrameId: number;
    const W = 1600;
    const H = 700;
    canvas.width = W;
    canvas.height = H;

    const draw = (t: number) => {
      const time = t * 0.001;
      ctx.clearRect(0, 0, W, H);

      // Slow-breathing pulse for the entire glow
      const pulse = 1 + Math.sin(time * 0.3) * 0.15;

      // ─── LAYER 1: Wide base glow — very faint, fills most of the canvas ───
      const g1 = ctx.createRadialGradient(W * 0.5, H * 0.85, 0, W * 0.5, H * 0.85, W * 0.65 * pulse);
      g1.addColorStop(0, 'rgba(30, 90, 180, 0.06)');
      g1.addColorStop(0.3, 'rgba(20, 60, 140, 0.035)');
      g1.addColorStop(0.6, 'rgba(12, 35, 90, 0.015)');
      g1.addColorStop(1, 'rgba(5, 12, 40, 0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, W, H);

      // ─── LAYER 2: Mid glow — slightly brighter, narrower ───
      const g2 = ctx.createRadialGradient(W * 0.5, H * 0.9, 0, W * 0.5, H * 0.9, W * 0.4 * pulse);
      g2.addColorStop(0, 'rgba(45, 130, 220, 0.08)');
      g2.addColorStop(0.35, 'rgba(30, 100, 190, 0.04)');
      g2.addColorStop(0.7, 'rgba(15, 55, 130, 0.01)');
      g2.addColorStop(1, 'rgba(5, 15, 50, 0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, W, H);

      // ─── LAYER 3: Tight core — subtle bright center at horizon ───
      const g3 = ctx.createRadialGradient(W * 0.5, H * 0.92, 0, W * 0.5, H * 0.92, W * 0.18 * pulse);
      g3.addColorStop(0, 'rgba(70, 160, 255, 0.05)');
      g3.addColorStop(0.4, 'rgba(50, 130, 230, 0.025)');
      g3.addColorStop(1, 'rgba(20, 60, 140, 0)');
      ctx.fillStyle = g3;
      ctx.fillRect(0, 0, W, H);

      // ─── LAYER 4: Very subtle side wisps for depth ───
      const g4L = ctx.createRadialGradient(W * 0.2, H * 0.75, 0, W * 0.2, H * 0.75, W * 0.3);
      g4L.addColorStop(0, 'rgba(25, 80, 160, 0.02)');
      g4L.addColorStop(0.5, 'rgba(15, 50, 120, 0.008)');
      g4L.addColorStop(1, 'rgba(5, 15, 50, 0)');
      ctx.fillStyle = g4L;
      ctx.fillRect(0, 0, W, H);

      const g4R = ctx.createRadialGradient(W * 0.8, H * 0.75, 0, W * 0.8, H * 0.75, W * 0.3);
      g4R.addColorStop(0, 'rgba(25, 80, 160, 0.02)');
      g4R.addColorStop(0.5, 'rgba(15, 50, 120, 0.008)');
      g4R.addColorStop(1, 'rgba(5, 15, 50, 0)');
      ctx.fillStyle = g4R;
      ctx.fillRect(0, 0, W, H);

      animFrameId = requestAnimationFrame(draw);
    };

    animFrameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameId);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    const isMobile = window.innerWidth < 640;
    const alpha = isMobile ? 0.7 : 1.0;

    // ArtificialNeuron represents a mathematical parameter/neuron in an LLM layer
    class ArtificialNeuron {
      id: number;
      layer: number;
      index: number;
      baseX: number;
      baseY: number;
      x: number;
      y: number;
      vx: number;
      vy: number;
      activation: number; // 0.0 to 1.0
      size: number;
      label: string;

      constructor(id: number, layer: number, index: number, baseX: number, baseY: number) {
        this.id = id;
        this.layer = layer;
        this.index = index;
        this.baseX = baseX;
        this.baseY = baseY;
        this.x = baseX;
        this.y = baseY;
        this.vx = 0;
        this.vy = 0;
        this.activation = Math.random() * 0.15;
        this.size = isMobile ? 2 + Math.random() * 1.5 : 3.5 + Math.random() * 2.5;

        // Custom mathematical symbols mimicking transformer architecture
        const labels = ['x', 'W_Q', 'W_K', 'h_t', 'FFN', 'y_hat'];
        const baseSymbol = labels[layer % labels.length];
        this.label = `${baseSymbol}[${index}]`;
      }

      update(time: number, mouseX: number, mouseY: number, isDragged: boolean) {
        // Dynamic target floating rest baseline position
        const oscX = isMobile ? 4 : 6;
        const oscY = isMobile ? 5 : 8;
        const targetX = this.baseX + Math.sin(time * 0.4 + this.id * 1.5) * oscX;
        const targetY = this.baseY + Math.cos(time * 0.35 + this.id * 2.2) * oscY;

        if (isDragged) {
          // Compute velocity while dragging so there's an inertia kick on release
          this.vx = mouseX - this.x;
          this.vy = mouseY - this.y;
          this.x = mouseX;
          this.y = mouseY;
          this.activation = Math.min(1.0, this.activation + 0.06);
          return;
        }

        // Spring return force pulling back to target rest positions
        const springK = 0.08; // Crisp elastic return stiffness
        const damping = 0.81; // Soft overshoot bouncing

        const axSpring = (targetX - this.x) * springK;
        const aySpring = (targetY - this.y) * springK;

        this.vx += axSpring;
        this.vy += aySpring;

        this.vx *= damping;
        this.vy *= damping;

        this.x += this.vx;
        this.y += this.vy;

        // Decaying activation back to stable passive level
        if (this.activation > 0.02) {
          this.activation -= 0.015;
        } else {
          this.activation = 0.01 + Math.sin(time * 0.6 + this.id) * 0.015; // idle breathing twinkle
        }
      }

      draw(c: CanvasRenderingContext2D) {
        const actGlow = this.activation * 14;
        const isLightTheme = document.getElementById('app-root-container')?.classList.contains('light-theme');

        // Glowing backdrop aura
        if (actGlow > 0) {
          c.beginPath();
          c.arc(this.x, this.y, this.size + actGlow + 3, 0, Math.PI * 2);
          const grad = c.createRadialGradient(this.x, this.y, this.size - 1, this.x, this.y, this.size + actGlow + 3);
          const glowColor = isLightTheme ? '59, 130, 246' : '165, 192, 255';
          grad.addColorStop(0, `rgba(${glowColor}, ${(0.12 + this.activation * 0.22) * alpha})`);
          grad.addColorStop(1, `rgba(${glowColor}, 0)`);
          c.fillStyle = grad;
          c.fill();
        }

        // Inner core membrane
        c.beginPath();
        c.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        c.fillStyle = isLightTheme 
          ? `rgba(59, 130, 246, ${(0.18 + this.activation * 0.62) * alpha})`
          : `rgba(147, 197, 253, ${(0.14 + this.activation * 0.62) * alpha})`;
        c.strokeStyle = isLightTheme
          ? `rgba(59, 130, 246, ${(0.45 + this.activation * 0.48) * alpha})`
          : `rgba(165, 192, 255, ${(0.32 + this.activation * 0.48) * alpha})`;
        c.lineWidth = 1.0;
        c.fill();
        c.stroke();
      }
    }

    // ActivationPulse represents dynamic tensor activations flowing forward through layers
    class ActivationPulse {
      fromNode: ArtificialNeuron;
      toNode: ArtificialNeuron;
      progress: number;
      speed: number;
      color: string;

      constructor(fromNode: ArtificialNeuron, toNode: ArtificialNeuron, speed = 0.015 + Math.random() * 0.012) {
        this.fromNode = fromNode;
        this.toNode = toNode;
        this.progress = 0;
        this.speed = speed;
        this.color = '#bae6fd'; // soft blue/sky color
      }

      update() {
        this.progress += this.speed;
      }

      getPosition() {
        return {
          x: this.fromNode.x + (this.toNode.x - this.fromNode.x) * this.progress,
          y: this.fromNode.y + (this.toNode.y - this.fromNode.y) * this.progress
        };
      }
    }

    const layerDistribution = isMobile ? [2, 2, 2, 2, 2] : [3, 4, 4, 4, 3];
    const layerCount = layerDistribution.length;
    let neurons: ArtificialNeuron[] = [];
    let pulses: ActivationPulse[] = [];
    let draggedNode: ArtificialNeuron | null = null;

    const rebuildNetwork = (w: number, h: number) => {
      neurons = [];
      pulses = []; // Reset pulses
      let globalId = 0;
      for (let l = 0; l < layerCount; l++) {
        const nodeCount = layerDistribution[l];
        const padX = isMobile ? 30 : 70;
        const padY1 = isMobile ? 40 : 90;
        const padY2 = isMobile ? 40 : 180;
        const x = padX + (l / (layerCount - 1)) * (w - padX * 2);
        for (let i = 0; i < nodeCount; i++) {
          const y = padY1 + (i / (nodeCount - 1 || 1)) * (h - padY1 - padY2);
          neurons.push(new ArtificialNeuron(globalId++, l, i, x, y));
        }
      }
    };

    // Build the initial network topology
    rebuildNetwork(width, height);

    const handleResize = () => {
      if (!canvas) return;
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      width = canvas.width = newWidth;
      height = canvas.height = newHeight;
      rebuildNetwork(newWidth, newHeight);
    };
    window.addEventListener('resize', handleResize);

    // Propagate activation down the network forward layers
    const triggerForwardCascade = (fromNeuron: ArtificialNeuron) => {
      if (fromNeuron.layer >= layerCount - 1) return; // reached output layer
      
      const nextLayerNodes = neurons.filter(n => n.layer === fromNeuron.layer + 1);
      if (nextLayerNodes.length === 0) return;

      // Select 1 or 2 random target parameters in the next layer to fire to
      const targetCount = 1;
      const shuffled = [...nextLayerNodes].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, Math.min(targetCount, shuffled.length));

      selected.forEach(target => {
        // Enforce a safe cap on parallel pulse entities to prevent rendering bottlenecks
        const maxPulses = isMobile ? 12 : 20;
        if (pulses.length < maxPulses) {
          pulses.push(new ActivationPulse(fromNeuron, target));
        }
      });
    };

    // Shared activation logic on user interactions (click or touch)
    const triggerInteraction = (clientX: number, clientY: number) => {
      let closestNode: ArtificialNeuron | null = null;
      let minDist = Infinity;

      neurons.forEach(n => {
        const dx = n.x - clientX;
        const dy = n.y - clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          closestNode = n;
        }
      });

      const clickRadius = isMobile ? 120 : 220;
      if (closestNode && minDist < clickRadius) {
        (closestNode as ArtificialNeuron).activation = 1.0;
        triggerForwardCascade(closestNode);
      }
    };

    const findClosestNode = (clientX: number, clientY: number, maxDistance = 45): any => {
      let closestNode: any = null;
      let minDist = Infinity;

      neurons.forEach((n: any) => {
        const dx = n.x - clientX;
        const dy = n.y - clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          closestNode = n;
        }
      });

      if (closestNode && minDist < maxDistance) {
        return closestNode;
      }
      return null;
    };

    const handleMouseDownGlobal = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      const node: any = findClosestNode(e.clientX, e.clientY, 55);
      if (node) {
        draggedNode = node;
        node.activation = 1.0;
        triggerForwardCascade(node);
      }
    };

    const handleMouseUpGlobal = () => {
      draggedNode = null;
    };

    const handleMouseClickGlobal = (e: MouseEvent) => {
      if (!draggedNode) {
        triggerInteraction(e.clientX, e.clientY);
      }
    };

    const handleTouchStartGlobal = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        mouse.x = touch.clientX;
        mouse.y = touch.clientY;
        const node: any = findClosestNode(touch.clientX, touch.clientY, 65);
        if (node) {
          draggedNode = node;
          node.activation = 1.0;
          triggerForwardCascade(node);
        } else {
          triggerInteraction(touch.clientX, touch.clientY);
        }
      }
    };

    const handleTouchMoveGlobal = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        mouse.x = touch.clientX;
        mouse.y = touch.clientY;
      }
    };

    const handleTouchEndGlobal = () => {
      draggedNode = null;
      mouse.x = -1000;
      mouse.y = -1000;
    };

    window.addEventListener('click', handleMouseClickGlobal);
    window.addEventListener('mousedown', handleMouseDownGlobal);
    window.addEventListener('mouseup', handleMouseUpGlobal);
    window.addEventListener('touchstart', handleTouchStartGlobal, { passive: true });
    window.addEventListener('touchmove', handleTouchMoveGlobal, { passive: true });
    window.addEventListener('touchend', handleTouchEndGlobal, { passive: true });

    // Track cursor presence
    let mouse = { x: -1000, y: -1000 };
    const handleMouseMoveGlobal = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const handleMouseLeaveGlobal = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };
    window.addEventListener('mousemove', handleMouseMoveGlobal);
    window.addEventListener('mouseleave', handleMouseLeaveGlobal);

    // Feedforward network periodic excitation (simulates background LLM token inference streams)
    let lastInferenceTime = Date.now();

    const drawConstellation = () => {
      ctx.clearRect(0, 0, width, height);
      const isLightTheme = document.getElementById('app-root-container')?.classList.contains('light-theme');
      ctx.fillStyle = isLightTheme ? '#f8fafc' : '#06070a'; // Midnight or Light clinic digital canvas
      ctx.fillRect(0, 0, width, height);

      const time = Date.now() * 0.001;

      // Periodic background signal generation
      if (Date.now() - lastInferenceTime > (isMobile ? 2500 : 1400)) {
        const inputNodes = neurons.filter(n => n.layer === 0);
        if (inputNodes.length > 0) {
          const randInput = inputNodes[Math.floor(Math.random() * inputNodes.length)];
          randInput.activation = 1.0;
          triggerForwardCascade(randInput);
        }
        lastInferenceTime = Date.now();
      }

      // Draw mathematical synaptic connection lines (synapses)
      for (let i = 0; i < neurons.length; i++) {
        const n1 = neurons[i];
        if (n1.layer === layerCount - 1) continue; // output layer doesn't connect forward

        const adjacentNodes = neurons.filter(n2 => n2.layer === n1.layer + 1);
        adjacentNodes.forEach(n2 => {
          const dx = n1.x - n2.x;
          const dy = n1.y - n2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          ctx.beginPath();
          ctx.moveTo(n1.x, n1.y);
          ctx.lineTo(n2.x, n2.y);

          // Synapse glow intensity matches connected node activations
          const connectionAlpha = 0.015 + (n1.activation + n2.activation) * 0.045;
          ctx.strokeStyle = isLightTheme
            ? `rgba(59, 130, 246, ${Math.min(0.25, connectionAlpha * 1.8 * alpha)})`
            : `rgba(165, 192, 255, ${Math.min(0.18, connectionAlpha * alpha)})`;
          ctx.lineWidth = 0.55;
          ctx.stroke();
        });
      }

      // Draw interactive mouse proximity strands (faint local focus field)
      if (mouse.x > -1000 && mouse.y > -1000) {
        // Draw crisp cursor diagnostic dot
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, isMobile ? 2.5 : 4.0, 0, Math.PI * 2);
        ctx.fillStyle = isLightTheme ? `rgba(59, 130, 246, ${0.82 * alpha})` : `rgba(165, 192, 255, ${0.82 * alpha})`;
        ctx.shadowBlur = isMobile ? 6 : 12;
        ctx.shadowColor = isLightTheme ? '#3b82f6' : '#a5c0ff';
        ctx.fill();
        ctx.shadowBlur = 0;

        neurons.forEach(n => {
          const dx = n.x - mouse.x;
          const dy = n.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 180) {
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = isLightTheme
              ? `rgba(59, 130, 246, ${0.08 * (1 - dist / 180) * alpha})`
              : `rgba(165, 192, 255, ${0.04 * (1 - dist / 180) * alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();

            // Symmetrical slight static activation from proximity focus
            n.activation = Math.min(1.0, n.activation + (isMobile ? 0.003 : 0.005));
          }
        });
      }

      // Update and draw active pulses
      for (let pIdx = pulses.length - 1; pIdx >= 0; pIdx--) {
        const pulse = pulses[pIdx];
        pulse.update();

        // Draw pulse particle
        const pos = pulse.getPosition();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, isMobile ? 1.3 : 2.0, 0, Math.PI * 2);
        ctx.fillStyle = pulse.color;
        ctx.shadowBlur = isMobile ? 3 : 6;
        ctx.shadowColor = pulse.color;
        ctx.fill();
        ctx.shadowBlur = 0;

        // On completion: activate next neuron and queue cascading downstream fires
        if (pulse.progress >= 1.0) {
          pulse.toNode.activation = 1.0;
          triggerForwardCascade(pulse.toNode);
          pulses.splice(pIdx, 1);
        }
      }

      // Draw the artificial parameter nodes
      neurons.forEach(n => {
        n.update(time, mouse.x, mouse.y, n === draggedNode);
        n.draw(ctx);
      });

      animationFrameId = requestAnimationFrame(drawConstellation);
    };

    drawConstellation();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMoveGlobal);
      window.removeEventListener('mouseleave', handleMouseLeaveGlobal);
      window.removeEventListener('click', handleMouseClickGlobal);
      window.removeEventListener('mousedown', handleMouseDownGlobal);
      window.removeEventListener('mouseup', handleMouseUpGlobal);
      window.removeEventListener('touchstart', handleTouchStartGlobal);
      window.removeEventListener('touchmove', handleTouchMoveGlobal);
      window.removeEventListener('touchend', handleTouchEndGlobal);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Generate input-derived synthetic pipeline data
  // Submit ingestion form
  // Patient: run all stages on their stored daily check-ins + imported chats (server builds the dataset)
  const runPatientAnalysis = async () => {
    setPatientAnalyzing(true);
    setPatientAnalysisError(null);
    const steps = ['Building your 30-day dataset…', 'Extracting features (Stage 1)…', 'Normalising to your baseline (Stage 2)…',
      'Detecting unusual patterns (Stage 4)…', 'Forecasting the next 7 days (Stage 3)…', 'Estimating risk (Stage 5)…', 'Explaining the result…'];
    let i = 0;
    setAnalysisStage(steps[0]);
    const tick = setInterval(() => { i = Math.min(i + 1, steps.length - 1); setAnalysisStage(steps[i]); }, 6000);
    try {
      const payload: any = { fullName: inputs.fullName || '', user_id: userId };
      const res = await fetch('/api/diagnose', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(payload), signal: AbortSignal.timeout(900000),
      });
      const raw = await res.json();
      if (!res.ok) throw new Error(raw.error || `Server responded ${res.status}`);
      const result = mapFlaskRunResponse(raw, payload);
      setPipelineRaw(raw);
      setDiagnosticData(result);
      setHasRunAnalysis(true);
      setClinicalAlerts(prev => [{
        id: `alert-${Date.now()}`,
        type: result.anomalyBehaviourScore > 75 ? 'critical' : (result.anomalyBehaviourScore > 40 ? 'warning' : 'info'),
        title: 'Your analysis is ready',
        message: `Analysed ${raw.n_entries} days. ${result.anomalyStatus || ''}`.trim(),
        time: 'Just now', read: false,
      }, ...prev]);
      setPatientFullView(true);
    } catch (err: any) {
      setPatientAnalysisError(err.name === 'TimeoutError' ? 'The analysis took too long. Try again.' : (err.message || 'Analysis failed'));
    } finally {
      clearInterval(tick);
      setAnalysisStage('');
      setPatientAnalyzing(false);
    }
  };

  const handleInitializeDiagnosis = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAnalyzing(true);
    setAnalysisProgress(5);
    setAnalysisStage('Connecting to inference pipeline...');

    const stages = [
      { progress: 15, stage: 'Initializing ML models...', delay: 800 },
      { progress: 25, stage: 'Extracting text features (Stage 1)...', delay: 1500 },
      { progress: 35, stage: 'Normalizing feature vectors (Stage 2)...', delay: 2000 },
      { progress: 45, stage: 'Running temporal forecasting (Stage 3)...', delay: 3000 },
      { progress: 55, stage: 'Computing anomaly consensus (Stage 4)...', delay: 2500 },
      { progress: 65, stage: 'Training TFT model & latent embeddings...', delay: 4000 },
      { progress: 72, stage: 'Running XGBoost risk classifier (Stage 5)...', delay: 2000 },
      { progress: 80, stage: 'Computing CUSUM baseline drift...', delay: 1500 },
      { progress: 85, stage: 'Finalizing risk assessment...', delay: 1000 },
    ];

    let stageIdx = 0;
    const progressInterval = setInterval(() => {
      if (stageIdx < stages.length) {
        setAnalysisProgress(stages[stageIdx].progress);
        setAnalysisStage(stages[stageIdx].stage);
        stageIdx++;
      }
    }, 2000);

    try {
      let payload: any = { ...inputs, user_id: userId };

      if (docFileObj) {
        const fileText = await docFileObj.text();
        payload = { ...payload, docFileContent: fileText, docFileName: docFileObj.name };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000);
      const res = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      clearInterval(progressInterval);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `Server responded ${res.status}`);
      }
      const rawResult = await res.json();
      const result = mapFlaskRunResponse(rawResult, payload);
      setPipelineRaw(rawResult);

      setAnalysisProgress(95);
      setAnalysisStage('Rendering analytics dashboard...');
      await new Promise(r => setTimeout(r, 300));
      setDiagnosticData(result);
      setHasRunAnalysis(true);
      setAnalysisProgress(100);
      setAnalysisStage('Analysis complete!');

      const generated = result;
      const lastScores = generated.pipelineDetectorScores?.[generated.pipelineDetectorScores.length - 1];
      const newAlerts: ClinicalAlert[] = [{
        id: `alert-${Date.now()}`,
        type: generated.anomalyBehaviourScore > 75 ? 'critical' : (generated.anomalyBehaviourScore > 40 ? 'warning' : 'info'),
        title: 'Pipeline Analysis Complete',
        message: `Behavioral anomaly score: ${generated.anomalyBehaviourScore}%. ${generated.anomalyStatus || 'Stable profile detected.'}`,
        time: 'Just now',
        read: false
      }];
      if (lastScores) {
        const detNames: Record<string, string> = { mahalanobis: 'Pattern Deviation', copula: 'Behavioral Shift', isolation_forest: 'Outlier Spike', knn: 'Cluster Drift' };
        Object.entries(lastScores).forEach(([key, val]) => {
          const pct = Math.round((val as number) * 100);
          if (pct >= 40) {
            newAlerts.push({
              id: `alert-det-${key}-${Date.now()}`,
              type: pct >= 80 ? 'critical' : (pct >= 60 ? 'warning' : 'info'),
              title: detNames[key] || key,
              message: `${detNames[key] || key} score at ${pct}% — driving risk elevation.`,
              time: 'Just now',
              read: false
            });
          }
        });
      }
      setClinicalAlerts(prev => [...newAlerts, ...prev]);
      await new Promise(r => setTimeout(r, 500));
      setIsAnalyzing(false);
      setActiveTab('analytics');
    } catch (err: any) {
      console.error('Pipeline error:', err);
      clearInterval(progressInterval);
      const msg = err.name === 'AbortError'
        ? 'Backend took too long (2 min timeout). Falling back to local mock.'
        : err.message || 'Pipeline unavailable';
      setDiagnosticData(prev => ({ ...prev, apiError: msg }));
      setIsAnalyzing(false);
      setAnalysisStage(msg);
      setTimeout(() => setAnalysisStage(''), 5000);
    }
  };

  // Render SVG Sparkline
  const renderDetectorChart = (points: number[], color: string, dates: string[], label: string) => {
    if (!points || points.length === 0 || !dates || dates.length === 0) return null;
    const width = 500;
    const height = 132;
    const pad = { top: 12, bottom: 24, left: 36, right: 8 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    const yMax = 100;
    const yMin = 0;
    const yRange = yMax - yMin;

    const n = points.length;
    const lastIdx = n - 1;

    const yTicks = [0, 50, 100];

    const maxXLabels = 6;
    const xLabelIndices: number[] = [];
    if (n <= maxXLabels) {
      for (let i = 0; i < n; i++) xLabelIndices.push(i);
    } else {
      const step = lastIdx / (maxXLabels - 1);
      for (let i = 0; i < maxXLabels; i++) xLabelIndices.push(Math.round(i * step));
    }

    const getX = (i: number) => pad.left + (i / lastIdx) * plotW;
    const getY = (v: number) => pad.top + (1 - (v - yMin) / yRange) * plotH;

    const pointsArr = points.map((v, i) => ({ x: getX(i), y: getY(v) }));

    const linePath = pointsArr.map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = pointsArr[i - 1];
      const cpx1 = prev.x + (p.x - prev.x) / 3;
      const cpx2 = prev.x + (p.x - prev.x) * 2 / 3;
      return `C ${cpx1} ${prev.y} ${cpx2} ${p.y} ${p.x} ${p.y}`;
    }).join(' ');

    const lastP = pointsArr[lastIdx];
    const fillPath = `${linePath} L ${lastP.x} ${pad.top + plotH} L ${getX(0)} ${pad.top + plotH} Z`;

    const filterId = `glow-${label.replace(/[^a-zA-Z0-9]/g, '')}`;

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mousePct = Math.max(0, Math.min(100, (mouseX / rect.width) * 100));
      setDetectorMouseXPct(mousePct);
      const svgWidth = rect.width;
      const scaleX = width / svgWidth;
      const svgMouseX = mouseX * scaleX;
      const relativeX = svgMouseX - pad.left;
      const percentage = relativeX / plotW;
      const closestIndex = Math.min(lastIdx, Math.max(0, Math.round(percentage * lastIdx)));
      setDetectorHoveredIndex(closestIndex);
    };

    const handleMouseLeave = () => {
      setDetectorHoveredIndex(null);
    };

    const lineColor = Math.max(...points) > 60 ? '#f97316' : Math.max(...points) > 30 ? '#f59e0b' : '#4fc3f7';

    return (
      <div className="space-y-2 relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto cursor-crosshair" preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id={`fill-${filterId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.08" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>
          {yTicks.map(t => {
            const y = getY(t);
            return (
              <g key={t}>
                <line x1={pad.left} y1={y} x2={pad.left + plotW} y2={y} stroke="#ffffff10" strokeWidth="0.5" strokeDasharray="3 3" />
                <text x={pad.left - 5} y={y + 2.5} fill="#6b7280" fontSize="8" textAnchor="end" fontFamily="monospace">{t}%</text>
              </g>
            );
          })}
          {xLabelIndices.map(i => {
            const x = getX(i);
            const dateLabel = dates[i] ? dates[i].slice(5).replace('-', '/') : '';
            return (
              <g key={i}>
                <text x={x} y={height - 5} fill="#6b7280" fontSize="7" textAnchor="middle" fontFamily="monospace">{dateLabel}</text>
              </g>
            );
          })}
          <path d={fillPath} fill={`url(#fill-${filterId})`} />
          <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.6" />
          <path d={linePath} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          {detectorHoveredIndex !== null && (
            <g>
              <line x1={getX(detectorHoveredIndex)} y1={pad.top} x2={getX(detectorHoveredIndex)} y2={pad.top + plotH} stroke={lineColor} strokeWidth="1" strokeDasharray="2 2" opacity="0.4" />
              <circle cx={getX(detectorHoveredIndex)} cy={getY(points[detectorHoveredIndex])} r="3" fill={lineColor} stroke="#0d1117" strokeWidth="1.5" />
              {(() => {
                const hv = points[detectorHoveredIndex];
                const hLabel = hv >= 60 ? 'Elevated' : hv >= 30 ? 'Moderate' : 'Stable';
                const hColor = hv >= 60 ? '#f97316' : hv >= 30 ? '#f59e0b' : '#4fc3f7';
                return (
                  <g>
                    <rect x={getX(detectorHoveredIndex) + 8} y={getY(hv) - 12} width="52" height="20" rx="4" fill="#1e2a3a" opacity="0.95" />
                    <text x={getX(detectorHoveredIndex) + 12} y={getY(hv) - 1} fill="#e5e7eb" fontSize="8" fontFamily="monospace" fontWeight="bold">{Math.round(hv)}%</text>
                    <text x={getX(detectorHoveredIndex) + 30} y={getY(hv) - 1} fill={hColor} fontSize="7" fontFamily="sans-serif">{hLabel}</text>
                  </g>
                );
              })()}
            </g>
          )}
        </svg>
      </div>
    );
  };

  // Sidebar styling configurations based on the active tab/theme depicted in the screenshots
  const getSidebarHeader = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="p-6 border-b border-[#1A202C]">
            <div className="text-[10px] tracking-widest text-blue-400 font-bold uppercase mb-1">Gateway</div>
            <div className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              <Compass className="h-5 w-5 text-blue-500 shadow-[0_0_8px_#3b82f6]" />
              PORTAL GATEWAY
            </div>
          </div>
        );
      case 'profile':
        return (
          <div className="p-6 border-b border-[#1A202C]">
            <div className="text-[10px] tracking-widest text-indigo-400 font-bold uppercase mb-1">Settings</div>
            <div className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              <User className="h-5 w-5 text-indigo-500 shadow-[0_0_8px_#6366f1]" />
              USER PROFILE
            </div>
          </div>
        );
      case 'clinical':
        return (
          <div className="p-6 border-b border-[#1A202C]">
            <div className="text-[10px] tracking-widest text-blue-400 font-bold uppercase mb-1">Platform</div>
            <div className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              <User className="h-5 w-5 text-blue-500 shadow-[0_0_8px_#3b82f6]" />
              CLINICAL PORTAL
            </div>
          </div>
        );
      case 'analytics':
        return (
          <div className="p-6 border-b border-[#1A202C]">
            <div className="text-[10px] tracking-widest text-emerald-400 font-bold uppercase mb-1">Diagnostics</div>
            <div className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-500 shadow-[0_0_8px_#10b981]" />
              CLINICAL_OS
            </div>
          </div>
        );
      case 'explainable':
        return (
          <div className="p-6 border-b border-[#1A202C]">
            <div className="text-[10px] tracking-widest text-purple-400 font-bold uppercase mb-1">Explainability</div>
            <div className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500 shadow-[0_0_8px_#a855f7]" />
              MODEL EXPLAINER
            </div>
          </div>
        );
    }
  };

  const getSidebarProfile = () => {
    return (
      <div 
        onClick={() => { setActiveTab('profile'); setIsMenuOpen(false); }}
        className="p-4 border-t border-[#1A202C] flex items-center gap-3 hover:bg-gray-800/30 cursor-pointer transition-all duration-150 group"
      >
        <div className="relative h-9 w-9 rounded-full bg-blue-900/40 border border-blue-500/50 flex items-center justify-center text-blue-300 group-hover:border-blue-400 group-hover:scale-105 transition-all overflow-hidden shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            <User className="h-4.5 w-4.5 text-blue-400" />
          )}
        </div>
        <div className="flex-grow min-w-0">
          <div className="text-xs font-bold text-gray-200 truncate group-hover:text-white transition-colors">
            {inputs.fullName || userId}
          </div>
          <div className="text-[10px] text-gray-500 flex items-center gap-1.5 font-sans">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {isPatient ? 'PATIENT' : 'SYSTEM_ADMIN'}
          </div>
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 text-gray-600 group-hover:text-blue-400 transition-colors" />
      </div>
    );
  };

  return (
    <div className={`min-h-screen flex font-sans relative overflow-hidden transition-colors duration-300 ${theme === 'light' ? 'light-theme bg-slate-50 text-slate-900' : 'dark-theme bg-[#0B0D13] text-gray-100'}`} id="app-root-container">
      {/* Background canvas Constellation lines */}
      <canvas ref={canvasRef} className={`fixed inset-0 pointer-events-none z-0 transition-opacity duration-500 ${activeTab === 'analytics' || activeTab === 'explainable' || activeTab === 'forecast' ? 'opacity-0' : 'opacity-100'}`} />

      {/* FLOATING SIDEBAR TRIGGER */}
      <div className="fixed top-3 left-4 z-40">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="h-10 px-4 bg-[#11131C]/85 hover:bg-[#11131C] backdrop-blur-xl border border-[#1B2030]/60 rounded-xl flex items-center gap-2.5 transition-all duration-200 active:scale-95 text-[#A5C0FF] hover:text-white shadow-xl shadow-blue-950/15 cursor-pointer"
          id="sidebar-toggle-btn"
        >
          <div className="flex flex-col gap-1 w-4 justify-center items-center">
            <span className={`h-0.5 w-4 bg-current transition-all duration-300 ${isMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
            <span className={`h-0.5 w-3 bg-current transition-all duration-300 ${isMenuOpen ? 'opacity-0' : ''}`} />
            <span className={`h-0.5 w-4 bg-current transition-all duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
          </div>
          <span className="text-[11px] font-bold tracking-widest uppercase font-sans">System Menu</span>
        </button>
      </div>

      {/* ELEGANT POP-UP SIDEBAR MENU OVERLAY */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-[#06080C]/85 backdrop-blur-md z-30 transition-opacity duration-300 flex items-start"
          onClick={() => setIsMenuOpen(false)}
          id="sidebar-overlay"
        >
          <div 
            className="absolute top-16 left-4 w-72 bg-[#11131C] backdrop-blur-3xl border border-[#1B2030]/80 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden max-h-[calc(100vh-6rem)] animate-in fade-in slide-in-from-top-4 duration-300"
            onClick={(e) => e.stopPropagation()}
            id="sidebar-popup-card"
          >
            {/* Sidebar Header */}
            {getSidebarHeader()}

            {/* Navigation Items */}
            <nav className="flex-1 px-4 py-6 space-y-1.5">
              {isPatient ? (
                <>
                  <div className="text-[9px] text-gray-500 tracking-widest uppercase px-4 pb-2 font-bold">Patient Portal</div>

                  <button id="tab-dashboard"
                    onClick={() => { setActiveTab('dashboard'); setIsMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer ${
                      activeTab === 'dashboard' 
                        ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' 
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                    }`}
                  >
                    <Compass className="h-4 w-4" />
                    Dashboard
                  </button>

                  <button id="tab-patient-profile"
                    onClick={() => { setActiveTab('profile'); setIsMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer ${
                      activeTab === 'profile' 
                        ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' 
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                    }`}
                  >
                    <User className="h-4 w-4" />
                    Patient Profile Settings
                  </button>

                  <button id="tab-intake"
                    onClick={() => { setActiveTab('intake'); setIsMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer ${
                      activeTab === 'intake' 
                        ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' 
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                    }`}
                  >
                    <FileText className="h-4 w-4" />
                    Clinical Patient Intake Portal
                  </button>

                  <button id="tab-patient-analysis"
                    onClick={() => { 
                      if (patientData.status?.calibrated) { setActiveTab('analytics'); setIsMenuOpen(false); }
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer ${
                      activeTab === 'analytics' 
                        ? 'bg-gray-800 text-white border-l-2 border-blue-500' 
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                    }`}
                  >
                    <Activity className="h-4 w-4" />
                    Analysis {!patientData.status?.calibrated && <span className="text-[9px] text-gray-600 ml-auto">Locked</span>}
                  </button>

                  <button id="tab-patient-forecast"
                    onClick={() => { 
                      if (patientData.status?.calibrated) { setActiveTab('forecast'); setIsMenuOpen(false); }
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer ${
                      activeTab === 'forecast' 
                        ? 'bg-gray-800 text-white border-l-2 border-purple-500' 
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                    }`}
                  >
                    <Cloud className="h-4 w-4" />
                    Risk Forecast {!patientData.status?.calibrated && <span className="text-[9px] text-gray-600 ml-auto">Locked</span>}
                  </button>
                </>
              ) : (
                <>
                  <button id="tab-dashboard"
                    onClick={() => { setActiveTab('dashboard'); setIsMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer ${
                      activeTab === 'dashboard' 
                        ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' 
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                    }`}
                  >
                    <Compass className="h-4 w-4" />
                    Dashboard
                  </button>

                  <button id="tab-profile"
                    onClick={() => { setActiveTab('profile'); setIsMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer ${
                      activeTab === 'profile' 
                        ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' 
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                    }`}
                  >
                    <User className="h-4 w-4" />
                    User Profile
                  </button>

                  <button id="tab-overview"
                    onClick={() => { setActiveTab('clinical'); setIsMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer ${
                      activeTab === 'clinical' 
                        ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' 
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                    }`}
                  >
                    <User className="h-4 w-4" />
                    Clinical Details
                  </button>

                  <button id="tab-analytics"
                    onClick={() => { 
                      if (hasRunAnalysis) { setActiveTab('analytics'); setIsMenuOpen(false); }
                      else { setActiveTab('clinical'); setIsMenuOpen(false); }
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer ${
                      activeTab === 'analytics' 
                        ? 'bg-gray-800 text-white border-l-2 border-blue-500' 
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                    }`}
                  >
                    <Activity className="h-4 w-4" />
                    Analytics {!hasRunAnalysis && <span className="text-[9px] text-gray-600 ml-auto">Locked</span>}
                  </button>

                  <button id="tab-forecast"
                    onClick={() => { 
                      if (hasRunAnalysis) { setActiveTab('forecast'); setIsMenuOpen(false); }
                      else { setActiveTab('clinical'); setIsMenuOpen(false); }
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer ${
                      activeTab === 'forecast' 
                        ? 'bg-gray-800 text-white border-l-2 border-purple-500' 
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                    }`}
                  >
                    <Cloud className="h-4 w-4" />
                    Risk Forecast {!hasRunAnalysis && <span className="text-[9px] text-gray-600 ml-auto">Locked</span>}
                  </button>
                </>
              )}
            </nav>

            {/* Profile */}
            {getSidebarProfile()}
          </div>
        </div>
      )}

      {/* MAIN DISPLAY CONTAINER */}
      <main className="flex-1 flex flex-col min-w-0 z-10" id="main-content-panel">
        
        {/* HEADER BAR */}
        <header className="h-16 border-b border-[#1A202C]/15 bg-transparent pl-56 pr-8 flex items-center justify-between select-none shrink-0" id="main-header">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {activeTab === 'dashboard' && (
              <>
                <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6] animate-pulse" />
                <h1 className="text-sm font-extrabold tracking-widest bg-gradient-to-r from-blue-400 via-indigo-200 to-white bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(59,130,246,0.3)] uppercase font-sans">
                  {isPatient ? 'Patient Dashboard' : 'Clinical Provider Workspace'}
                </h1>
              </>
            )}
            {activeTab === 'clinical' && (
              <>
                <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6] animate-pulse" />
                <h1 className="text-sm font-extrabold tracking-widest bg-gradient-to-r from-blue-400 via-indigo-200 to-white bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(59,130,246,0.3)] uppercase font-sans">
                  Clinical Provider Workspace — Document Upload & Analysis
                </h1>
              </>
            )}
            {activeTab === 'profile' && (
              <>
                <span className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_8px_#6366f1] animate-pulse" />
                <h1 className="text-sm font-extrabold tracking-widest bg-gradient-to-r from-indigo-400 via-purple-200 to-white bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(99,102,241,0.3)] uppercase font-sans">
                  Clinical Provider Workspace — Patient Profile
                </h1>
              </>
            )}
            {activeTab === 'analytics' && (
              <>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-[10px] font-mono text-[#6b7280] tracking-widest cursor-default">SYSTEM MENU</span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 ml-6">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" />
                  <div>
                    <h1 className="text-sm font-extrabold tracking-widest text-white uppercase font-sans">
                      {isPatient ? 'My Analysis' : 'Clinical Provider Workspace — Patient Analytics'}
                    </h1>
                    <p className="text-[10px] font-mono text-[#4b5563]">PATIENT: [ID] · MODEL: TFT+SHAP · SESSION ACTIVE</p>
                  </div>
                </div>
                <div className="relative max-w-xs flex-1 ml-auto">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                  <input type="text" placeholder="Search keyword..." value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (searchMatchCount > 0) navigateSearch(e.shiftKey ? 'prev' : 'next'); } if (e.key === 'Escape') setSearchQuery(''); }}
                    className="w-full bg-[#0d1117] border border-[#1e2a3a] rounded-md pl-9 pr-20 py-1.5 text-xs text-white placeholder-[#374151] font-mono focus:outline-none focus:border-blue-500"
                  />
                  {searchQuery.trim() && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <span className="text-[10px] text-gray-500 font-mono">{searchMatchCount > 0 ? `${searchCurrentIdx + 1}/${searchMatchCount}` : '0 found'}</span>
                      {searchMatchCount > 1 && (<><button onClick={() => navigateSearch('prev')} className="text-gray-500 hover:text-gray-300 cursor-pointer"><ChevronLeft className="h-3.5 w-3.5" /></button><button onClick={() => navigateSearch('next')} className="text-gray-500 hover:text-gray-300 cursor-pointer"><ChevronRight className="h-3.5 w-3.5" /></button></>)}
                      <button onClick={() => setSearchQuery('')} className="text-gray-500 hover:text-gray-300 cursor-pointer ml-0.5"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                </div>
              </>
            )}
            {activeTab === 'explainable' && (
              <>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-[10px] font-mono text-[#6b7280] tracking-widest cursor-default">SYSTEM MENU</span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 ml-6">
                  <span className="h-2 w-2 rounded-full bg-purple-500 shadow-[0_0_8px_#a855f7] animate-pulse" />
                  <div>
                    <h1 className="text-sm font-extrabold tracking-widest text-white uppercase font-sans">
                      {isPatient ? 'My Analysis — Explainable AI' : 'Clinical Provider Workspace — Explainable AI'}
                    </h1>
                    <p className="text-[10px] font-mono text-[#4b5563]">PATIENT: [ID] · SESSION: ACTIVE · MODEL: TREESHAP v2.1</p>
                  </div>
                </div>
                <div className="relative max-w-xs flex-1 ml-auto">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                  <input type="text" placeholder="QUERY_PATIENT_ID..." className="w-full bg-[#0d1117] border border-[#1e2a3a] rounded-md pl-9 pr-4 py-1.5 text-xs text-white placeholder-[#374151] font-mono focus:outline-none focus:border-blue-500" />
                </div>
              </>
            )}
            {activeTab === 'forecast' && (
              <>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="h-2 w-2 rounded-full bg-purple-500 shadow-[0_0_8px_#a855f7] animate-pulse" />
                  <h1 className="text-sm font-extrabold tracking-widest bg-gradient-to-r from-purple-400 via-violet-200 to-white bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(168,85,247,0.3)] uppercase font-sans">
                    {isPatient ? 'My 7-Day Forecast' : 'Clinical Provider Workspace — Risk Forecast Engine'}
                  </h1>
                </div>
              </>
            )}
            {activeTab === 'intake' && (
              <>
                <span className="h-2 w-2 rounded-full bg-sky-500 shadow-[0_0_8px_#0ea5e9] animate-pulse" />
                <h1 className="text-sm font-extrabold tracking-widest bg-gradient-to-r from-sky-400 via-blue-200 to-white bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(14,165,233,0.3)] uppercase font-sans">
                  Patient Intake Portal
                </h1>
              </>
            )}
          </div>

          <div className="flex items-center gap-4 relative shrink-0">
            {hasRunAnalysis && (
              <button data-guide="pdf"
                onClick={compileMedicalSummary}
                className="text-xs bg-indigo-600/20 border border-indigo-500/50 text-indigo-300 hover:bg-indigo-600/40 hover:border-indigo-400 px-3 py-1.5 rounded-lg transition cursor-pointer font-bold flex items-center gap-1.5"
              >
                <FileText className="h-3.5 w-3.5" />
                Download PDF Report
              </button>
            )}
            <button 
              className="p-1.5 text-gray-400 hover:text-white rounded-full relative cursor-pointer" 
              id="header-bell-button"
              onClick={() => setIsAlertsDropdownOpen(!isAlertsDropdownOpen)}
            >
              <Bell className="h-5 w-5" />
              <span className={`absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-rose-500 text-[9px] font-extrabold text-white flex items-center justify-center px-1 border border-slate-950 shadow-md transition-all duration-300 ${clinicalAlerts.filter(a => !a.read).length > 0 ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>
                {clinicalAlerts.filter(a => !a.read).length}
              </span>
            </button>

            {/* Alerts Dropdown */}
            {isAlertsDropdownOpen && (
              <div 
                ref={alertsDropdownRef}
                className="absolute right-8 top-12 w-80 bg-slate-950/95 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl z-50 text-left overflow-hidden ring-1 ring-black/50"
              >
                <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Clinical Alerts</span>
                  {clinicalAlerts.filter(a => !a.read).length > 0 && (
                    <button 
                      onClick={() => {
                        setClinicalAlerts(prev => prev.map(a => ({ ...a, read: true })));
                      }}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-wider cursor-pointer transition"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/60">
                  {clinicalAlerts.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      No recent clinical alerts.
                    </div>
                  ) : (
                    clinicalAlerts.map(alert => (
                      <div 
                        key={alert.id}
                        onClick={() => {
                          setClinicalAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, read: true } : a));
                        }}
                        className={`p-3 text-xs transition duration-150 cursor-pointer flex gap-2.5 items-start ${
                          alert.read 
                            ? 'bg-transparent hover:bg-slate-800/40' 
                            : 'bg-blue-950/25 hover:bg-blue-950/40 border-l-2 border-blue-500 pl-2.5'
                        }`}
                      >
                        {alert.type === 'critical' ? (
                          <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                        ) : alert.type === 'warning' ? (
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        ) : (
                          <Brain className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 space-y-0.5 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="font-bold text-slate-200 truncate">{alert.title}</span>
                            <span className="text-[9px] text-slate-500 whitespace-nowrap shrink-0">{alert.time}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed break-words">{alert.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-2 border-t border-slate-800 bg-slate-900/40 text-center">
                  <span className="text-[10px] text-slate-500">
                    {clinicalAlerts.filter(a => !a.read).length} unread • {clinicalAlerts.length} total alerts
                  </span>
                </div>
              </div>
            )}

            <button 
              className="p-1.5 text-gray-400 hover:text-white rounded-full cursor-pointer relative" 
              id="header-settings-button"
              onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5 text-amber-400" />
              ) : (
                <div className="relative">
                  <Moon className="h-5 w-5 text-slate-700 hover:text-slate-900" />
                  <svg className="absolute inset-0 opacity-0 pointer-events-none h-5 w-5">
                    <circle cx="12" cy="12" r="1" />
                  </svg>
                </div>
              )}
            </button>
          </div>
        </header>

        {/* SCREEN SCROLL CONTAINER */}
        <div className={`flex-1 overflow-y-auto relative ${activeTab === 'dashboard' ? 'p-0' : 'px-10 py-8'}`}>

          {/* PERMANENT ATMOSPHERIC BACKGROUND — always rendered, visible on all tabs */}
          <div className={`absolute inset-0 pointer-events-none z-0 overflow-hidden transition-opacity duration-700 ${activeTab === 'dashboard' ? 'opacity-100' : 'opacity-10'}`}>
            <canvas 
              ref={atmosphereCanvasRef} 
              className="w-full h-full"
              style={{ imageRendering: 'auto' }}
            />
          </div>

          {/* TAB CONTENT — animated on tab switch */}
          <div key={tabTransitionKey} className="tab-transition-enter relative z-10">
          
          {/* TAB 0: PORTAL GATEWAY DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className={`w-full min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center relative overflow-hidden px-8 py-16 bg-transparent transition-opacity duration-700 ${heroTransition === 'radiating' || heroTransition === 'revealing' ? 'opacity-0' : ''}`} id="dashboard-landing">

              {/* Static ambient blue light node */}
              <div className="absolute top-12 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#a5c0ff] shadow-[0_0_12px_#a5c0ff,0_0_24px_#3b82f6] opacity-65" />

              {/* Radial mask reveal overlay */}
              {heroTransition === 'revealing' && (
                <div className="fixed inset-0 z-50 pointer-events-none" style={{
                  background: 'radial-gradient(circle at 50% 50%, transparent 0%, rgba(3,4,10,0.95) 0%)',
                  animation: 'heroRadialReveal 0.6s cubic-bezier(0.22,1,0.36,1) forwards'
                }} />
              )}

              {/* CENTERED HERO SECTION */}
              <div className={`text-center z-10 max-w-4xl px-4 flex flex-col items-center my-auto transition-all duration-700 ${
                heroTransition === 'compressing' || heroTransition === 'radiating' 
                  ? 'scale-[0.97] opacity-60 blur-[1px]' 
                  : heroTransition === 'revealing' 
                    ? 'scale-95 opacity-0 blur-[3px]' 
                    : ''
              }`}>
                {/* Hero heading with cinematic text transformation */}
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-sans font-extrabold tracking-tight text-white mb-8 leading-tight drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)]">
                  <span className={`inline-block transition-all duration-500 ${
                    heroTransition === 'radiating' || heroTransition === 'revealing'
                      ? 'opacity-0 -translate-y-4'
                      : ''
                  }`}>Your Personal </span>
                  <span className={`font-sans font-normal italic text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300 drop-shadow-[0_0_25px_rgba(59,130,246,0.45)] px-1 inline-block transition-all duration-700 ${
                    heroTransition === 'compressing'
                      ? 'drop-shadow-[0_0_40px_rgba(59,130,246,0.8)] scale-105'
                      : heroTransition === 'radiating'
                        ? 'drop-shadow-[0_0_60px_rgba(59,130,246,1)] scale-110 brightness-150'
                        : heroTransition === 'revealing'
                          ? 'opacity-0 scale-110'
                          : ''
                  }`}>Digital Health</span>
                  <span className={`inline-block transition-all duration-500 ${
                    heroTransition === 'radiating' || heroTransition === 'revealing'
                      ? 'opacity-0 -translate-y-4'
                      : ''
                  }`}> AI Assistant</span>
                </h1>

                {/* HELLO THERE greeting */}
                <p className={`text-lg md:text-xl font-semibold text-sky-200 tracking-wider mb-12 select-none font-sans uppercase transition-all duration-500 ${
                  heroTransition === 'radiating' || heroTransition === 'revealing'
                    ? 'opacity-0 -translate-y-3'
                    : ''
                }`}>
                  {inputs.fullName && inputs.fullName.trim() !== "" ? `Hello there, ${inputs.fullName}!` : "Hello there!"}
                </p>

                {/* MAIN GET STARTED BUTTON */}
                <button
                  onClick={handleGetStarted}
                  className={`group relative inline-flex items-center gap-3 px-10 py-4 bg-blue-600 text-white font-bold text-xs uppercase tracking-widest rounded-xl cursor-pointer overflow-hidden z-20 transition-all duration-400 ${
                    heroTransition === 'compressing'
                      ? 'scale-90 shadow-[0_0_50px_rgba(37,99,235,0.8)] bg-blue-500'
                      : heroTransition === 'radiating'
                        ? 'scale-95 shadow-[0_0_80px_rgba(37,99,235,1)] bg-blue-400'
                        : heroTransition === 'revealing'
                          ? 'scale-110 opacity-0'
                          : 'hover:bg-blue-500 hover:shadow-[0_0_35px_rgba(37,99,235,0.6)] active:scale-95 shadow-lg shadow-blue-950/20'
                  }`}
                >
                  <span className="relative z-10">Let's Get Started</span>
                  <Compass className="h-4.5 w-4.5 relative z-10 group-hover:rotate-45 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  {/* Blue light ripple effect */}
                  {heroTransition === 'radiating' && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-4 h-4 rounded-full bg-blue-400/60" style={{ animation: 'heroRipple 0.7s ease-out forwards' }} />
                    </div>
                  )}
                </button>
              </div>

            </div>
          )}

          {/* TAB INTAKE: Clinical Patient Intake Portal (patient daily alignment) */}
          {activeTab === 'intake' && (
            <div className="max-w-2xl mx-auto my-2 animate-in fade-in duration-200" id="intake-portal-container">
              <div className="glass-panel rounded-2xl p-6">
                <PatientIntakePortal userId={userId} onCalibrated={() => patientData.refresh()} onNavigateToAnalysis={() => setActiveTab('analytics')} />
              </div>
            </div>
          )}

          {/* TAB 0.5: USER PROFILE — REDESIGNED */}
          {activeTab === 'profile' && (() => {
            const dobStr = inputs.dobYear ? inputs.dobYear + '-' + (inputs.dobMonth || '01') + '-' + (inputs.dobDay || '01') : '';
            const age = dobStr ? Math.max(0, Math.floor((Date.now() - new Date(dobStr).getTime()) / (365.25 * 24 * 60 * 60 * 1000))) : 0;
            const isNameValid = Boolean((inputs.fullName || '').trim());
            const isDobValid = Boolean(inputs.dobMonth && inputs.dobDay && inputs.dobYear);
            const isGenderValid = Boolean(inputs.gender);
            const isBloodValid = Boolean(inputs.bloodType);
            const isSymptomsValid = Boolean((inputs.symptoms || '').trim());
            const isHistoryValid = Boolean((inputs.medicalHistory || '').trim());
            const totalFields = 6;
            const filledFields = [isNameValid, isDobValid, isGenderValid, isBloodValid, isSymptomsValid, isHistoryValid].filter(Boolean).length;
            const progressPct = Math.round((filledFields / totalFields) * 100);
            return (
            <div className="max-w-3xl mx-auto my-2 animate-in fade-in duration-200" id="profile-portal-container">
              <div className="bg-[#0d1117] border border-white/[0.06] rounded-2xl p-8 relative overflow-hidden">
                {/* Progress bar at top */}
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#1e2a3a]">
                  <div className="h-full transition-all duration-500 ease-out" style={{ width: `${progressPct}%`, background: 'linear-gradient(to right, #7c3aed, #a78bfa)' }} />
                </div>

                {/* Header with avatar */}
                <div className="flex items-center gap-5 mb-8 mt-2">
                  <div className="relative" style={{ animation: 'fade-in 0.3s ease-out' }}>
                    <div className="h-20 w-20 rounded-2xl bg-[#0f0a1e] border-2 border-dashed border-[#7c3aed] flex items-center justify-center text-[#7c3aed] overflow-hidden transition-all duration-200 hover:border-solid hover:shadow-[0_0_16px_#7c3aed44]"
                      style={{ borderRadius: '16px' }}
                    >
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-8 w-8" />
                      )}
                    </div>
                    <label className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-[#7c3aed] border-2 border-[#0d1117] flex items-center justify-center cursor-pointer hover:bg-[#6d28d9] transition-colors shadow-lg">
                      <Upload className="h-3.5 w-3.5 text-white" />
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                    </label>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-[#a78bfa] to-[#7c3aed] bg-clip-text text-transparent">Initialize Patient Profile</h2>
                    <p className="text-[14px] text-[#94a3b8] mt-1">Establish the baseline information required for personalized longitudinal health analysis.</p>
                    <div className="flex items-center gap-2 mt-2">
                      {['Encrypted', 'AI Baseline', 'HIPAA'].map(chip => (
                        <span key={chip} className="text-[11px] text-[#6b7280] bg-[#111827] px-2 py-0.5 rounded">{chip}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* PATIENT IDENTITY */}
                  <div className="space-y-4">
                    <div style={{ animation: 'fade-in 0.3s ease-out' }}>
                      <label className="block text-[9px] tracking-widest text-gray-400 font-bold uppercase mb-2">Full Name</label>
                      <div className="relative">
                        <input 
                          type="text"
                          placeholder="e.g. Dr. Alexander Mercer"
                          value={inputs.fullName}
                          onChange={(e) => setInputs({...inputs, fullName: e.target.value})}
                          className={`w-full bg-[#080c14] border rounded-[10px] px-4 py-3 pr-9 text-sm text-gray-200 placeholder-gray-600 transition-all duration-150 outline-none ${isNameValid ? 'border-[#4ade80]' : 'border-[#1e2a3a] focus:border-[#7c3aed] focus:shadow-[0_0_0_3px_#7c3aed18]'}`}
                          required
                        />
                        {isNameValid && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4ade80] text-sm">✓</span>}
                      </div>
                      <p className="text-[11px] text-[#475569] mt-1">Enter the patient's legal full name as it appears on medical records.</p>
                    </div>

                    <div style={{ animation: 'fade-in 0.3s ease-out 0.1s both' }}>
                      <label className="block text-[9px] tracking-widest text-gray-400 font-bold uppercase mb-2">Date of Birth</label>
                      <div className="grid grid-cols-3 gap-3">
                        <select
                          value={inputs.dobMonth || ''}
                          onChange={(e) => setInputs({...inputs, dobMonth: e.target.value})}
                          className={`w-full bg-[#080c14] border rounded-[10px] px-3 py-3 text-sm text-gray-200 transition-all duration-150 outline-none cursor-pointer ${isDobValid ? 'border-[#4ade80]' : 'border-[#1e2a3a] focus:border-[#7c3aed] focus:shadow-[0_0_0_3px_#7c3aed18]'}`}
                        >
                          <option value="" className="select-placeholder">Month</option>
                          {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                            <option key={i+1} value={String(i+1).padStart(2,'0')}>{m}</option>
                          ))}
                        </select>
                        <select
                          value={inputs.dobDay || ''}
                          onChange={(e) => setInputs({...inputs, dobDay: e.target.value})}
                          className={`w-full bg-[#080c14] border rounded-[10px] px-3 py-3 text-sm text-gray-200 transition-all duration-150 outline-none cursor-pointer ${isDobValid ? 'border-[#4ade80]' : 'border-[#1e2a3a] focus:border-[#7c3aed] focus:shadow-[0_0_0_3px_#7c3aed18]'}`}
                        >
                          <option value="" className="select-placeholder">Day</option>
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                            <option key={d} value={String(d).padStart(2,'0')}>{d}</option>
                          ))}
                        </select>
                        <select
                          value={inputs.dobYear || ''}
                          onChange={(e) => setInputs({...inputs, dobYear: e.target.value})}
                          className={`w-full bg-[#080c14] border rounded-[10px] px-3 py-3 text-sm text-gray-200 transition-all duration-150 outline-none cursor-pointer ${isDobValid ? 'border-[#4ade80]' : 'border-[#1e2a3a] focus:border-[#7c3aed] focus:shadow-[0_0_0_3px_#7c3aed18]'}`}
                        >
                          <option value="" className="select-placeholder">Year</option>
                          {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                      {isDobValid && <span className="text-[12px] text-[#4ade80] mt-1 block">Age: {age} years</span>}
                      <p className="text-[11px] text-[#475569] mt-1">Select the patient's date of birth for age-based baseline calculation.</p>
                    </div>

                    <div style={{ animation: 'fade-in 0.3s ease-out 0.2s both' }}>
                      <label className="block text-[9px] tracking-widest text-gray-400 font-bold uppercase mb-2">Gender</label>
                      <div className="flex gap-2">
                        {['Male', 'Female', 'Non-binary', 'Prefer not to say'].map(opt => (
                          <button key={opt} type="button" onClick={() => setInputs({...inputs, gender: inputs.gender === opt ? '' : opt})}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer ${inputs.gender === opt ? 'bg-[#1e1040] border border-[#7c3aed] text-[#a78bfa]' : 'bg-[#111827] text-[#6b7280] hover:text-gray-300'}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-[#475569] mt-1">Used for population-level baseline comparisons and risk normalization.</p>
                    </div>
                  </div>

                  {/* CLINICAL BASELINE */}
                  <div className="space-y-4 pt-4 border-t border-[#1B2030]/40">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div style={{ animation: 'fade-in 0.3s ease-out 0.3s both' }}>
                        <label className="block text-[9px] tracking-widest text-gray-400 font-bold uppercase mb-2">Blood Type</label>
                        <select
                          value={inputs.bloodType}
                          onChange={(e) => setInputs({...inputs, bloodType: e.target.value})}
                          className={`w-full bg-[#080c14] border rounded-[10px] px-4 py-3 pr-10 text-sm text-gray-200 transition-all duration-150 outline-none cursor-pointer ${isBloodValid ? 'border-[#4ade80]' : 'border-[#1e2a3a] focus:border-[#7c3aed] focus:shadow-[0_0_0_3px_#7c3aed18]'}`}
                        >
                          <option value="" className="select-placeholder">Select...</option>
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                        </select>
                        <p className="text-[11px] text-[#475569] mt-1">Blood type is used for physiological baseline calibration.</p>
                      </div>
                      <div style={{ animation: 'fade-in 0.3s ease-out 0.35s both' }}>
                        <label className="block text-[9px] tracking-widest text-gray-400 font-bold uppercase mb-2">Cognitive Latency / Clinical Symptoms</label>
                        <div className="relative">
                          <input 
                            type="text"
                            placeholder="e.g. Mild short-term memory latency"
                            value={inputs.symptoms}
                            onChange={(e) => setInputs({...inputs, symptoms: e.target.value})}
                            className={`w-full bg-[#080c14] border rounded-[10px] px-4 py-3 pr-9 text-sm text-gray-200 placeholder-gray-600 transition-all duration-150 outline-none ${isSymptomsValid ? 'border-[#4ade80]' : 'border-[#1e2a3a] focus:border-[#7c3aed] focus:shadow-[0_0_0_3px_#7c3aed18]'}`}
                          />
                          {isSymptomsValid && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4ade80] text-sm">✓</span>}
                        </div>
                        <p className="text-[11px] text-[#475569] mt-1">Note any observed cognitive or clinical symptoms for baseline tracking.</p>
                      </div>
                    </div>

                    <div style={{ animation: 'fade-in 0.3s ease-out 0.4s both' }}>
                      <label className="block text-[9px] tracking-widest text-gray-400 font-bold uppercase mb-2">Pre-existing Medical History & Conditions</label>
                      <div className="relative">
                        <textarea 
                          placeholder="Detail relevant prior medical conditions, research, or observations..."
                          value={inputs.medicalHistory}
                          onChange={(e) => setInputs({...inputs, medicalHistory: e.target.value})}
                          className={`w-full bg-[#080c14] border rounded-[10px] p-4 pr-16 text-sm text-gray-200 placeholder-gray-600 transition-all duration-150 outline-none h-24 resize-none ${isHistoryValid ? 'border-[#4ade80]' : 'border-[#1e2a3a] focus:border-[#7c3aed] focus:shadow-[0_0_0_3px_#7c3aed18]'}`}
                        />
                        <span className="absolute top-3 right-3 text-[11px] font-mono text-[#4b5563]">{(inputs.medicalHistory || '').length} / 500</span>
                      </div>
                      <p className="text-[11px] text-[#475569] mt-1">Include all relevant prior conditions for comprehensive baseline establishment.</p>
                    </div>
                  </div>

                  {/* FOOTER */}
                  <div className="pt-6 border-t border-[#1B2030]/60 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-[#4fc3f7]" />
                      <span className="text-[13px] text-[#6b7280]">Your information is securely saved to this patient profile.</span>
                    </div>
                    <div className="flex items-center gap-6">
                      <button className="text-[13px] text-[#4fc3f7] hover:text-[#4fc3f7]/80 transition-colors cursor-pointer bg-transparent border-none p-0 font-inherit">View Privacy Protocol →</button>
                      <button
                        onClick={() => {
                          const dobStr2 = inputs.dobYear ? inputs.dobYear + '-' + (inputs.dobMonth || '01') + '-' + (inputs.dobDay || '01') : '';
                          const age2 = dobStr2 ? Math.max(0, Math.floor((Date.now() - new Date(dobStr2).getTime()) / (365.25 * 24 * 60 * 60 * 1000))) : 0;
                          fetch('/api/user-activity', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({
                              action: 'save_profile',
                              fullName: inputs.fullName || '',
                              age: age2,
                              gender: inputs.gender || '',
                              bloodType: inputs.bloodType || '',
                              dob: dobStr2
                            })
                          }).catch(() => {});
                          setActiveTab(isPatient ? 'intake' : 'clinical');
                        }}
                        disabled={!isNameValid}
                        className={'w-full sm:w-auto px-6 py-3 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ' + (isNameValid ? 'bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] hover:brightness-110 hover:shadow-[0_0_20px_#7c3aed44] active:scale-[0.98]' : 'bg-[#1f2937] text-gray-500 cursor-not-allowed')}
                      >
                        Save Profile & Continue
                        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            );
          })()}

          {/* TAB 1: CLINICAL DETAILS */}
          {activeTab === 'clinical' && (
            <div className="max-w-3xl mx-auto my-2 animate-in fade-in duration-200" id="ingestion-portal-container">
              <div className="glass-panel rounded-2xl p-8 relative overflow-hidden">
                
                {/* BLUE FLOWING DOT */}
                <div className="animate-flow-dot" />
                
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-indigo-200 to-white bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(59,130,246,0.25)]">Clinical Documents Upload</h2>
                </div>
                <p className="text-[#A5C0FF]/60 text-xs mb-8">Share patient journal entries, voice recordings, and clinical documents for analysis.</p>

                <form onSubmit={handleInitializeDiagnosis} className="space-y-6">
                  
                  {/* CLINICAL DATA STREAM */}
                  <div className="space-y-6 pt-2">
                    <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest font-sans">Journal & Clinical Data Upload</h3>
                    
                    {/* COMMUNICATION LOGS */}
                    <div>
                      <label className="block text-[9px] tracking-widest text-gray-400 font-bold uppercase mb-2">COMMUNICATION / LINGUISTIC LOGS</label>
                      <textarea 
                        placeholder="Paste sample patient speech logs, text logs, or diagnostic interactions..." 
                        value={inputs.communicationLogs}
                        onChange={(e) => setInputs({...inputs, communicationLogs: e.target.value})}
                        className="w-full bg-[#0D1017]/40 border border-[#232B3B]/60 rounded-xl p-4 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-32 resize-none"
                      />
                    </div>

                    {/* DRAG AND DROP PANELS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* VOICE RECORDINGS */}
                      <div>
                        <label className="block text-[9px] tracking-widest text-gray-400 font-bold uppercase mb-2">VOICE RECORDINGS (.MP3/.WAV/.CSV)</label>
                        <input
                          ref={audioInputRef}
                          type="file"
                          accept=".mp3,.wav,.m4a,.ogg,.csv"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setAudioFile(file.name);
                              setAudioFileObj(file);
                              setInputs({ ...inputs, voiceRecordingsText: `[Audio file: ${file.name}]` });
                            } else {
                              setAudioFile(null);
                              setAudioFileObj(null);
                            }
                          }}
                        />
                        <div 
                          onClick={() => {
                            if (audioFile) {
                              setAudioFile(null);
                              setAudioFileObj(null);
                              setInputs({ ...inputs, voiceRecordingsText: '' });
                              if (audioInputRef.current) audioInputRef.current.value = '';
                            } else {
                              audioInputRef.current?.click();
                            }
                          }}
                          className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all ${
                            audioFile ? 'border-blue-500 bg-blue-950/25' : 'border-[#232B3B]/60 hover:border-gray-500 bg-[#0D1017]/40'
                          }`}
                        >
                          <Mic className={`h-6 w-6 mb-2 ${audioFile ? 'text-blue-400 animate-pulse' : 'text-gray-500'}`} />
                          <span className="text-xs text-gray-300 font-semibold">
                            {audioFile || "Drag & Drop Audio"}
                          </span>
                          <span className="text-[10px] text-gray-500 mt-1">
                            {audioFile ? "Click to remove file" : "or click to upload audio"}
                          </span>
                        </div>
                        {audioFile && (
                          <div className="mt-2">
                            <textarea
                              placeholder="Enter voice recording transcript text..."
                              value={inputs.voiceRecordingsText || ''}
                              onChange={(e) => setInputs({ ...inputs, voiceRecordingsText: e.target.value })}
                              className="w-full bg-[#0D1017]/40 border border-[#232B3B]/60 rounded-xl p-3 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 h-20 resize-none"
                            />
                          </div>
                        )}
                      </div>

                      {/* CLINICAL REPORTS */}
                      <div>
                        <label className="block text-[9px] tracking-widest text-gray-400 font-bold uppercase mb-2">CLINICAL REPORTS (.PDF/.DOCX/.TXT)</label>
                        <input
                          ref={docInputRef}
                          type="file"
                          accept=".pdf,.docx,.doc,.txt,.csv,.json"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setDocFile(file.name);
                              setDocFileObj(file);
                            } else {
                              setDocFile(null);
                              setDocFileObj(null);
                            }
                          }}
                        />
                        <div 
                          onClick={() => {
                            if (docFile) {
                              setDocFile(null);
                              setDocFileObj(null);
                              if (docInputRef.current) docInputRef.current.value = '';
                            } else {
                              docInputRef.current?.click();
                            }
                          }}
                          className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all ${
                            docFile ? 'border-blue-500 bg-blue-950/25' : 'border-[#232B3B]/60 hover:border-gray-500 bg-[#0D1017]/40'
                          }`}
                        >
                          <File className={`h-6 w-6 mb-2 ${docFile ? 'text-blue-400' : 'text-gray-500'}`} />
                          <span className="text-xs text-gray-300 font-semibold">
                            {docFile || "Drag & Drop Documents"}
                          </span>
                          <span className="text-[10px] text-gray-500 mt-1">
                            {docFile ? "Click to remove file" : "or click to upload CSV/JSON/PDF/DOCX"}
                          </span>
                        </div>
                      </div>

                    </div>

                    {/* INITIALIZE BUTTON */}
                    <button 
                      type="submit"
                      disabled={isAnalyzing}
                      className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest text-xs transition duration-200 shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                        isAnalyzing 
                          ? 'bg-blue-900/40 text-blue-300 border border-blue-500/25 cursor-not-allowed' 
                          : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white hover:shadow-blue-500/20'
                      }`}
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                          <span>SYNTHESIZING PROFILE...</span>
                        </>
                      ) : (
                        <span>SYNTHESIZE & ANALYZE PROFILE</span>
                      )}
                    </button>

                  </div>
                </form>

              </div>
            </div>
          )}

          {/* TAB 2: ANALYTICS DASHBOARD */}
          {activeTab === 'analytics' && (() => {
            if (isPatient) {
              const s = patientData.status;
              if (!s?.calibrated) {
                return (
                  <div className="max-w-2xl mx-auto my-16 text-center animate-in fade-in duration-300" id="analytics-locked-container">
                    <div className="glass-panel rounded-2xl p-12">
                      <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-slate-800/50 border border-slate-600/30 flex items-center justify-center">
                        <Activity className="h-8 w-8 text-slate-500" />
                      </div>
                      <h2 className="text-xl font-bold text-white mb-3">Analysis Not Yet Available</h2>
                      <p className="text-sm text-gray-400 leading-relaxed mb-4 max-w-md mx-auto">
                        Your baseline needs more data points before analysis can begin. Continue submitting daily check-ins to build your personal model.
                      </p>
                      <div className="flex items-center justify-center gap-2 mb-6">
                        <span className={`h-2 w-2 rounded-full ${s && s.entry_count >= 14 ? 'bg-emerald-500' : s && s.entry_count >= 10 ? 'bg-orange-400' : s && s.entry_count >= 6 ? 'bg-yellow-400' : 'bg-red-400'}`} />
                        <span className="text-xs text-gray-400">{s?.entry_count || 0}/{s?.entries_needed || 14} entries</span>
                      </div>
                      <button
                        onClick={() => setActiveTab('intake')}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all duration-300 hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] cursor-pointer"
                      >
                        <FileText className="h-4 w-4" />
                        Go to Check-In
                      </button>
                    </div>
                  </div>
                );
              }
              // Patient is calibrated — personal telemetry + run the full 5-stage pipeline on their own days
              if (!patientFullView) {
                const ds = s?.dataset;
                return (
                  <div className="space-y-6" id="patient-analytics-container">
                    <div className="bg-emerald-900/15 backdrop-blur-sm border border-emerald-700/30 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                      <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_10px_#10b981] shrink-0 hidden sm:block" />
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-emerald-200">Baseline calibrated</h3>
                        <p className="text-xs text-gray-400 mt-1">
                          {ds?.analysis_records ?? s?.entry_count} days of your data ({ds?.first_date} → {ds?.last_date}) are ready.
                          Running the analysis takes your journal, chats, voice notes and sliders through all five AI stages on this computer.
                        </p>
                        {patientAnalysisError && <p className="text-xs text-amber-400 mt-2">{patientAnalysisError}</p>}
                      </div>
                      <button onClick={runPatientAnalysis} disabled={patientAnalyzing} id="run-patient-analysis"
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer shrink-0">
                        {patientAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                        {patientAnalyzing ? (analysisStage || 'Analysing…') : hasRunAnalysis ? 'Re-run analysis' : 'Run my analysis'}
                      </button>
                    </div>
                    {hasRunAnalysis && !patientAnalyzing && (
                      <button onClick={() => setPatientFullView(true)} className="w-full text-left bg-[#11131C]/80 border border-blue-700/30 hover:border-blue-500/50 rounded-2xl p-4 text-sm text-blue-200 cursor-pointer transition-all">
                        View your latest results — risk score, explanations and 7-day forecast →
                      </button>
                    )}
                    <PatientTelemetry status={s} />
                  </div>
                );
              }
            }

            if (!hasRunAnalysis) {
              return (
                <div className="max-w-2xl mx-auto my-16 text-center animate-in fade-in duration-300" id="analytics-locked-container">
                  <div className="glass-panel rounded-2xl p-12">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-slate-800/50 border border-slate-600/30 flex items-center justify-center">
                      <Activity className="h-8 w-8 text-slate-500" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-3">Analysis Not Yet Available</h2>
                    <p className="text-sm text-gray-400 leading-relaxed mb-8 max-w-md mx-auto">
                      Please complete the clinical documents upload and start the analysis. Once the analysis runs, you'll find your personalized dashboard here.
                    </p>
                    <button
                      onClick={() => setActiveTab('clinical')}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all duration-300 hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] cursor-pointer"
                    >
                      <User className="h-4 w-4" />
                      Go to Document Upload
                    </button>
                  </div>
                </div>
              );
            }
            if (!pipelineRaw) return null;
            return (
              <motion.div key="results" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }} id="analytics-tab">
                {isPatient && (
                  <div className="mb-6 flex justify-end">
                    <button onClick={() => setPatientFullView(false)} className="text-[13px] text-gray-400 hover:text-gray-200 cursor-pointer">My overview</button>
                  </div>
                )}
                <ResultsPage raw={pipelineRaw} isPatient={isPatient} onExplain={() => setActiveTab('explainable')} onForecast={() => setActiveTab('forecast')} />
              </motion.div>
            );
          })()}


          {/* TAB 2.5: RISK FORECAST ENGINE */}
          {activeTab === 'forecast' && (
            pipelineRaw ? (
              <motion.div key="forecast" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}>
                <ForecastPage raw={pipelineRaw} onBack={() => setActiveTab('analytics')} />
              </motion.div>
            ) : <NoResultsYet onGo={() => setActiveTab(isPatient ? 'analytics' : 'clinical')} isPatient={isPatient} />
          )}
          {/* TAB 3: EXPLAINABLE AI */}
          {activeTab === 'explainable' && (
            pipelineRaw ? (
              <motion.div key="explain" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}>
                <ExplainPage raw={pipelineRaw} onBack={() => setActiveTab('analytics')} onForecast={() => setActiveTab('forecast')} />
              </motion.div>
            ) : <NoResultsYet onGo={() => setActiveTab(isPatient ? 'analytics' : 'clinical')} isPatient={isPatient} />
          )}

          </div>
        </div>

        {/* SYSTEM STATUS FOOTER — redesigned */}
        <Guide ctx={{ raw: pipelineRaw, isPatient, status: patientData.status }} page={activeTab} />
        <footer className="h-12 border-t border-[#1A202C]/30 bg-[#0E1119]/20 backdrop-blur-lg px-8 flex items-center justify-between text-[10px] text-gray-500 select-none shrink-0" id="main-footer">
          <div className="flex items-center gap-2">
            <Lock className="h-3 w-3 text-emerald-500" />
            <span className="font-mono text-[#374151]">© CLINICAL_OS · SYSTEM_SECURE</span>
          </div>
          <div className="flex items-center gap-3">
            <svg width="24" height="12" className="opacity-40">
              <path d="M0,6 L3,2 L6,8 L9,4 L12,10 L15,3 L18,7 L21,5 L24,6" fill="none" stroke="#1d4ed8" strokeWidth="1.5">
                <animate attributeName="stroke-dashoffset" from="0" to="-24" dur="2s" repeatCount="indefinite" />
              </path>
            </svg>
            <span className="text-[#374151] text-[9px] font-mono">SYSTEM NOMINAL</span>
          </div>
          <div className="flex gap-4">
            {activeTab === 'explainable' ? (
              <>
                <button className="text-[#374151] hover:text-gray-300 transition-colors">System Status</button>
                <button className="text-[#374151] hover:text-gray-300 transition-colors">Terms of Service</button>
                <button className="text-[#374151] hover:text-gray-300 transition-colors">Privacy Protocol</button>
              </>
            ) : (
              <>
                <button onClick={() => setModalContent('docs')} className="text-[#374151] hover:text-gray-300 transition-colors cursor-pointer">Documentation</button>
                <button onClick={() => setModalContent('privacy')} className="text-[#374151] hover:text-gray-300 transition-colors cursor-pointer">Privacy Policy</button>
                <button onClick={() => setModalContent('terms')} className="text-[#374151] hover:text-gray-300 transition-colors cursor-pointer">Terms of Use</button>
              </>
            )}
          </div>
        </footer>

      </main>

      {/* FULL-SCREEN PROCESSING LOADING OVERLAY */}
      {isAnalyzing && (
        <div className="fixed inset-0 bg-[#0B0D13]/60 backdrop-blur-md z-50 flex items-center justify-center p-6" id="analysis-loading-overlay">
          <div className="bg-[#121620]/25 border border-[#20293B]/35 rounded-xl p-10 max-w-md w-full shadow-2xl text-center space-y-6 backdrop-blur-xl">
            
            <div className="text-[11px] tracking-widest text-[#A5C0FF] font-bold uppercase font-sans">
              Processing Clinical Vectors
            </div>

            <p className="text-gray-300 text-sm leading-relaxed min-h-[3rem]">
              {analysisStage || 'Initializing processing pipeline...'}
            </p>

            {/* Glowing active block grid animation */}
            <div className="flex items-center justify-center gap-3 py-4">
              <span className="h-3 w-3 bg-emerald-400 animate-pulse" />
              <span className="h-3 w-3 bg-emerald-400/80 animate-pulse delay-100" />
              <span className="h-3 w-3 bg-emerald-400/60 animate-pulse delay-200" />
              <span className="h-3 w-3 bg-emerald-400/40 animate-pulse delay-300" />
            </div>

            {/* Simulated progress tracker */}
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] text-gray-500">
                <span className="font-sans">Vector Synthesis</span>
                <span className="font-mono">{analysisProgress}%</span>
              </div>
              <div className="h-1 bg-[#1A202C] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#3B82F6] transition-all duration-300"
                  style={{ width: `${analysisProgress}%` }}
                />
              </div>
            </div>

          </div>
        </div>
      )}

      {/* LEGAL MODAL OVERLAY */}
      {modalContent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" onClick={() => setModalContent(null)}>
          <div className={`absolute inset-0 ${theme === 'dark' ? 'bg-black/70' : 'bg-black/40'} backdrop-blur-sm`} />
          <div 
            className={`relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border shadow-2xl animate-in zoom-in-95 fade-in duration-200 ${
              theme === 'dark' 
                ? 'bg-[#0D1117]/95 border-[#1B2030]/80 backdrop-blur-xl' 
                : 'bg-white/95 border-gray-200 backdrop-blur-xl'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`sticky top-0 z-10 flex items-center justify-between px-8 py-5 border-b ${
              theme === 'dark' 
                ? 'bg-[#0D1117]/90 border-[#1B2030]/60' 
                : 'bg-white/90 border-gray-200/60'
            }`}>
              <div className="flex items-center gap-3">
                {modalContent === 'docs' && <FileText className="h-5 w-5 text-blue-400" />}
                {modalContent === 'privacy' && <Shield className="h-5 w-5 text-emerald-400" />}
                {modalContent === 'terms' && <ScrollText className="h-5 w-5 text-purple-400" />}
                <h2 className={`text-lg font-bold tracking-wide ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {modalContent === 'docs' && 'Documentation'}
                  {modalContent === 'privacy' && 'Privacy Policy'}
                  {modalContent === 'terms' && 'Terms of Use'}
                </h2>
              </div>
              <button 
                onClick={() => setModalContent(null)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  theme === 'dark' 
                    ? 'text-gray-400 hover:text-white hover:bg-white/10' 
                    : 'text-gray-500 hover:text-gray-900 hover:bg-black/5'
                }`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-8 py-6 space-y-6 text-sm leading-relaxed">
              {modalContent === 'docs' && (
                <div className={`space-y-5 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  <div>
                    <h3 className={`text-xs font-bold uppercase tracking-widest mb-2 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>What This System Does</h3>
                    <p>Mental Health Digital Twin AI is an AI-powered clinical decision support tool. It analyzes patient communication patterns, behavioral data, and self-reported metrics to generate risk assessments and trend analyses. The system builds a longitudinal "digital twin" profile to track changes over time.</p>
                  </div>
                  <div>
                    <h3 className={`text-xs font-bold uppercase tracking-widest mb-2 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>How to Upload Data</h3>
                    <ul className="list-disc list-inside space-y-1">
                      <li><strong className={theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}>Journals / Messages:</strong> Paste text or upload CSV/TXT files in the Clinical Upload tab.</li>
                      <li><strong className={theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}>Audio Recordings:</strong> Upload WAV, MP3, M4A, OGG, or CSV audio transcription files.</li>
                      <li><strong className={theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}>Clinical Reports:</strong> Upload PDF, DOCX, or TXT clinical documents for NLP extraction.</li>
                      <li><strong className={theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}>Daily Check-ins:</strong> Use the Patient Intake Portal for daily sleep, mood, and activity logging.</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className={`text-xs font-bold uppercase tracking-widest mb-2 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>Understanding Risk Scores</h3>
                    <p>The <strong className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>Risk Assessment Score</strong> (0–100%) is produced by an XGBoost classifier calibrated on the DAIC-WOZ clinical dataset. It reflects the probability of clinically significant psychological distress. Scores above 55% indicate moderate concern; above 75% indicates critical concern requiring intervention.</p>
                  </div>
                  <div>
                    <h3 className={`text-xs font-bold uppercase tracking-widest mb-2 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>Anomaly &amp; Detector Results</h3>
                    <p>The system runs 6 behavioral anomaly detectors (isolation forest, autoencoder, Z-score, MAD, rolling statistics, spectral analysis). Each detector flags deviations from the patient's personal baseline. The <strong className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>Anomaly Consensus Score</strong> averages these detectors. CUSUM charts track sustained drift over time.</p>
                  </div>
                  <div>
                    <h3 className={`text-xs font-bold uppercase tracking-widest mb-2 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>Interpreting the Dashboard</h3>
                    <ul className="list-disc list-inside space-y-1">
                      <li><strong className={theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}>Mood &amp; Risk Over Time:</strong> Longitudinal sentiment and risk score with zoom/scroll controls.</li>
                      <li><strong className={theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}>Baseline Shift:</strong> How the patient's metrics compare to their initial baseline.</li>
                      <li><strong className={theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}>CUSUM:</strong> Cumulative drift detection — crossing the threshold line signals sustained change.</li>
                      <li><strong className={theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}>What's Driving That Signal:</strong> Individual detector contributions and feature importance.</li>
                      <li><strong className={theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}>Explainable AI:</strong> SHAP-style feature attributions showing what drove the latest prediction.</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className={`text-xs font-bold uppercase tracking-widest mb-2 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>For Developers</h3>
                    <p>The system runs a Flask backend (Python) with a React + Vite frontend. The ML pipeline uses PyTorch Temporal Fusion Transformer, XGBoost, Isolation Forest, and scikit-learn. Data is stored locally in SQLite. All inference runs on-device — no external AI API calls are made during analysis.</p>
                  </div>
                </div>
              )}

              {modalContent === 'privacy' && (
                <div className={`space-y-5 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  <p className={theme === 'dark' ? 'text-gray-500 text-xs' : 'text-gray-400 text-xs'}>Last updated: July 2026</p>
                  <div>
                    <h3 className={`text-xs font-bold uppercase tracking-widest mb-2 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>Data Collected</h3>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Text entries (journals, messages, communication logs)</li>
                      <li>Audio recordings and their transcriptions</li>
                      <li>Self-reported metrics: sleep duration, sleep quality, physical activity, mood</li>
                      <li>Personal identifiers: name, age, gender, blood type</li>
                      <li>Clinical document uploads (PDF, DOCX)</li>
                      <li>Profile photos (stored locally as avatar files)</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className={`text-xs font-bold uppercase tracking-widest mb-2 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>Where Data Is Stored</h3>
                    <p>All data is stored locally on the server machine in an SQLite database (<code className={`${theme === 'dark' ? 'bg-white/5 text-emerald-300' : 'bg-gray-100 text-emerald-700'} px-1.5 py-0.5 rounded`}>data/daily_portal.db</code>) and local file system. No data is transmitted to external cloud services or third-party servers.</p>
                  </div>
                  <div>
                    <h3 className={`text-xs font-bold uppercase tracking-widest mb-2 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>External AI APIs</h3>
                    <p><strong className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>No external AI APIs are used.</strong> All machine learning inference runs entirely on the local server. No patient data leaves the machine during analysis.</p>
                  </div>
                  <div>
                    <h3 className={`text-xs font-bold uppercase tracking-widest mb-2 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>Data Retention &amp; Access</h3>
                    <p>Data is retained indefinitely until manually deleted. The patient can access their own data; admin/clinicians can access all patient data for clinical review. Data is never shared with external organizations.</p>
                  </div>
                  <div className={`${theme === 'dark' ? 'bg-amber-950/30 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'} rounded-xl p-4 mt-4`}>
                    <p className={`${theme === 'dark' ? 'text-amber-300' : 'text-amber-700'} text-xs font-bold mb-1`}>Medical Disclaimer</p>
                    <p className={`${theme === 'dark' ? 'text-amber-200/70' : 'text-amber-600'} text-xs`}>This system is <strong>not a medical device</strong> and does not provide medical diagnosis, treatment recommendations, or emergency services. Risk scores are algorithmic estimates intended as clinical decision support only. Always consult a qualified healthcare professional.</p>
                  </div>
                </div>
              )}

              {modalContent === 'terms' && (
                <div className={`space-y-5 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  <p className={theme === 'dark' ? 'text-gray-500 text-xs' : 'text-gray-400 text-xs'}>Last updated: July 2026</p>
                  <div>
                    <h3 className={`text-xs font-bold uppercase tracking-widest mb-2 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}>Acceptable Use</h3>
                    <p>This system is designed for use by licensed healthcare providers, clinical researchers, and patients under clinical supervision. By using this system, you agree to use it only for lawful, clinical, and research purposes related to mental health monitoring and assessment.</p>
                  </div>
                  <div>
                    <h3 className={`text-xs font-bold uppercase tracking-widest mb-2 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}>Not a Substitute for Professional Care</h3>
                    <p>This system is a <strong className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>clinical decision support tool</strong>, not a replacement for professional medical judgment. Risk assessments, anomaly alerts, and trend analyses are algorithmic outputs and should be interpreted by qualified professionals.</p>
                  </div>
                  <div>
                    <h3 className={`text-xs font-bold uppercase tracking-widest mb-2 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}>No Emergency Use</h3>
                    <p>This system is <strong className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>not designed for emergency situations</strong>. If you or someone you know is in immediate danger, contact emergency services (911) or your local crisis hotline.</p>
                  </div>
                  <div>
                    <h3 className={`text-xs font-bold uppercase tracking-widest mb-2 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}>Accuracy &amp; Limitations</h3>
                    <ul className="list-disc list-inside space-y-1">
                      <li>AI-generated risk scores are probabilistic estimates, not definitive diagnoses.</li>
                      <li>Model accuracy depends on the quality and quantity of input data.</li>
                      <li>The system may produce false positives or false negatives.</li>
                      <li>Results should be validated against clinical observation and standardized assessments.</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className={`text-xs font-bold uppercase tracking-widest mb-2 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}>Limitation of Liability</h3>
                    <p>To the maximum extent permitted by law, the developers and operators of this system shall not be held liable for any damages arising from the use or misuse of this system, including clinical decisions based on algorithmic outputs.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
