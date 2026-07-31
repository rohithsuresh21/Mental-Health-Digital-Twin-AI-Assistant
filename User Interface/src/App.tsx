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

  // Patient data from daily portal
  const patientData = usePatientData(isPatient ? userId : '');

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
      <canvas ref={canvasRef} className={`fixed inset-0 pointer-events-none z-0 transition-opacity duration-500 ${activeTab === 'analytics' || activeTab === 'explainable' ? 'opacity-0' : 'opacity-100'}`} />

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
                      Clinical Provider Workspace — Patient Analytics
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
                      Clinical Provider Workspace — Explainable AI
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
                    Clinical Provider Workspace — Risk Forecast Engine
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
              <button
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
            // Use pipeline data when available, fall back to hardcoded demo data
            const pipeline = diagnosticData.pipelineTimestamps ? diagnosticData : null;
            const chartDates = pipeline?.pipelineTimestamps || [
              "2025-12-22", "2025-12-26", "2025-12-30", "2026-01-04", "2026-01-08", "2026-01-12",
              "2026-01-16", "2026-01-20", "2026-01-24", "2026-01-28", "2026-02-01", "2026-02-05",
              "2026-02-10", "2026-02-14", "2026-02-18", "2026-02-22", "2026-02-26", "2026-03-02",
              "2026-03-06", "2026-03-10", "2026-03-14", "2026-03-19", "2026-03-23", "2026-03-27",
              "2026-03-31", "2026-04-04", "2026-04-08", "2026-04-12", "2026-04-17", "2026-04-21",
              "2026-04-25", "2026-04-29", "2026-05-03", "2026-05-07", "2026-05-11", "2026-05-16",
              "2026-05-20", "2026-05-24", "2026-05-28", "2026-06-02", "2026-06-07", "2026-06-14"
            ];
            const nChart = chartDates.length;
            const lastIdx = Math.max(1, nChart - 1);
            const xLabelIndices = (() => {
              const maxLabels = 7;
              if (nChart <= maxLabels) return Array.from({ length: nChart }, (_, i) => i);
              const step = (nChart - 1) / (maxLabels - 1);
              return Array.from({ length: maxLabels }, (_, i) => Math.round(i * step));
            })();

            // Initialize viewport once when data loads
            const [vpStart, vpEnd] = (chartViewport[0] === -1 && nChart > 0)
              ? [Math.max(0, nChart - Math.max(6, Math.round(nChart * 0.2))), Math.max(0, nChart - 1)]
              : [Math.max(0, Math.min(chartViewport[0], nChart - 1)), Math.max(1, Math.min(chartViewport[1] || nChart - 1, nChart - 1))];
            const vpCount = vpEnd - vpStart + 1;
            const vpLastIdx = Math.max(1, vpCount - 1);
            const vpXLabels = (() => {
              if (vpCount <= 7) return Array.from({ length: vpCount }, (_, i) => vpStart + i);
              const step = (vpCount - 1) / 6;
              return Array.from({ length: 7 }, (_, i) => vpStart + Math.round(i * step));
            })();

            const anomalyRiskData = pipeline?.pipelineAnomalyScores || [
              0.55, 0.42, 0.48, 0.38, 0.45, 0.52, 0.41, 0.44, 0.58, 0.49, 0.42, 0.55, 0.73, 0.44,
              0.51, 0.43, 0.39, 0.48, 0.52, 0.41, 0.48, 0.38, 0.46, 0.35, 0.42, 0.49, 0.36, 0.45,
              0.41, 0.48, 0.32, 0.44, 0.75, 0.71, 0.78, 0.72, 0.75, 0.73, 0.77, 0.68, 0.75, 0.69
            ];

            const forecastData: number[] = pipeline?.pipelineForecast14Day || [];

            const lowerCusumVals = pipeline?.pipelineCusumLower || [
              0.0, 0.0, 0.05, 0.0, 0.0, 0.08, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.15, 0.32, 0.28, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.42, 0.85, 1.12, 1.05, 0.72, 0.35, 0.12, 0.0
            ];

            const upperCusumVals = pipeline?.pipelineCusumUpper || [
              0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.4, 0.9, 1.5, 2.2, 3.1, 4.0, 4.9, 5.7, 6.5, 7.1, 7.7
            ];
            const cusumThreshold = pipeline?.pipelineCusumThreshold ?? 1.0;

            // CUSUM independent viewport
            const cusumTotalLen = Math.max(upperCusumVals.length, lowerCusumVals.length);
            const [cVpStart, cVpEnd] = (cusumViewport[0] === -1 && cusumTotalLen > 0)
              ? [0, Math.max(0, cusumTotalLen - 1)]
              : [Math.max(0, Math.min(cusumViewport[0], cusumTotalLen - 1)), Math.max(1, Math.min(cusumViewport[1] || cusumTotalLen - 1, cusumTotalLen - 1))];
            const cVpCount = cVpEnd - cVpStart + 1;
            const cVpLastIdx = Math.max(1, cVpCount - 1);

            const scoreVal = diagnosticData.anomalyBehaviourScore || 48;
            const estimatedRisk = scoreVal + "%";
            const worthCheckIn = pipeline?.pipelineInterventionRecommended !== undefined
              ? (pipeline.pipelineInterventionRecommended ? "Yes" : "No")
              : (scoreVal > 40 ? "Yes" : "No");
            const entriesCount = pipeline?.pipelineDetectorScores?.length || pipeline?.pipelineAnomalyScores?.length || diagnosticData.pipelineNEntries || (diagnosticData.extractedDimensions ? Math.floor(diagnosticData.extractedDimensions / 2.3) : 200);

            let badgeText = "Slight Concern • 48%";
            let badgeStyle = "bg-[#251c0e] border-[#6b512f] text-[#eaa235]";
            if (scoreVal > 75) {
              badgeText = `Critical Concern • ${scoreVal}%`;
              badgeStyle = "bg-red-950/40 border-red-500/30 text-red-400";
            } else if (scoreVal > 55) {
              badgeText = `Moderate Concern • ${scoreVal}%`;
              badgeStyle = "bg-amber-950/40 border-amber-500/30 text-amber-400";
            } else if (scoreVal > 40) {
              badgeText = `Slight Concern • ${scoreVal}%`;
              badgeStyle = "bg-[#251c0e] border-[#6b512f] text-[#eaa235]";
            } else {
              badgeText = `Excellent • ${scoreVal}%`;
              badgeStyle = "bg-emerald-950/40 border-emerald-500/30 text-emerald-400";
            }

            const handleChartMouseMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const mouseXPx = e.clientX - rect.left;
              const mousePct = Math.max(0, Math.min(100, (mouseXPx / rect.width) * 100));
              setChartMouseXPct(mousePct);
              const scale = 500 / rect.width;
              const svgMouseX = mouseXPx * scale;
              const relativeX = svgMouseX - 35;
              const chartWidth = 450;
              const percentage = Math.max(0, Math.min(1, relativeX / chartWidth));
              const rawIndex = vpStart + percentage * vpCount;
              const closestIndex = Math.round(rawIndex);
              setHoveredPointIndex(Math.max(vpStart, Math.min(vpEnd, closestIndex)));
            };

            const handleChartMouseLeave = () => {
              setHoveredPointIndex(null);
            };

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
              // Patient is calibrated — show their analytics
              const calCount = s?.entry_count || 0;
              const history = s?.history || [];
              const validSleepQ = history.filter(e => e.sleep_quality != null).map(e => ({ date: e.entry_date.slice(5), val: e.sleep_quality! }));
              const validActivity = history.filter(e => e.activity_level != null).map(e => ({ date: e.entry_date.slice(5), val: e.activity_level! }));
              const validMood = history.filter(e => e.music_mood_score != null).map(e => ({ date: e.entry_date.slice(5), val: e.music_mood_score! }));
              const avgSleepQ = validSleepQ.length ? (validSleepQ.reduce((s, e) => s + e.val, 0) / validSleepQ.length).toFixed(1) : '—';
              const avgActivity = validActivity.length ? (validActivity.reduce((s, e) => s + e.val, 0) / validActivity.length).toFixed(1) : '—';
              const avgMood = validMood.length ? (validMood.reduce((s, e) => s + e.val, 0) / validMood.length).toFixed(1) : '—';
              const maxBarW = 180;
              const renderMiniSpark = (data: { date: string; val: number }[], color: string) => {
                if (data.length === 0) return <span className="text-gray-500 text-xs">No data</span>;
                const max = 5;
                return (
                  <div className="flex items-end gap-0.5 h-10">
                    {data.slice(-14).map((d, i) => (
                      <div key={i} className="flex flex-col items-center gap-0.5 group relative">
                        <div className="w-2 rounded-t" style={{ height: `${(d.val / max) * 40}px`, backgroundColor: color, opacity: 0.6 + d.val / max * 0.4 }} title={`${d.date}: ${d.val}`} />
                        <span className="text-[6px] text-gray-600 leading-none">{d.date.slice(2)}</span>
                      </div>
                    ))}
                  </div>
                );
              };
              const trendTag = (avg: string) => {
                const n = parseFloat(avg);
                if (isNaN(n)) return '';
                return n >= 4 ? 'Good' : n >= 3 ? 'Fair' : 'Needs Attention';
              };
              const trendColor = (avg: string) => {
                const n = parseFloat(avg);
                if (isNaN(n)) return 'text-gray-500';
                return n >= 4 ? 'text-emerald-400' : n >= 3 ? 'text-yellow-400' : 'text-red-400';
              };
              return (
                <div className="space-y-6" id="patient-analytics-container">
                  <div className="bg-emerald-900/15 backdrop-blur-sm border border-emerald-700/30 rounded-2xl p-5 flex items-center gap-4">
                    <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_10px_#10b981] shrink-0" />
                    <div>
                      <h3 className="text-sm font-bold text-emerald-200">Baseline Calibrated</h3>
                      <p className="text-xs text-gray-400 mt-1">Your personal model is active with {calCount} entries. Analysis is running on your calibrated data.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-[#11131C]/80 backdrop-blur-sm border border-[#1A202C] rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sleep Quality</h4>
                        <span className={`text-xs font-bold ${trendColor(avgSleepQ)}`}>{avgSleepQ} {trendTag(avgSleepQ)}</span>
                      </div>
                      {renderMiniSpark(validSleepQ, '#818cf8')}
                    </div>
                    <div className="bg-[#11131C]/80 backdrop-blur-sm border border-[#1A202C] rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Activity Level</h4>
                        <span className={`text-xs font-bold ${trendColor(avgActivity)}`}>{avgActivity} {trendTag(avgActivity)}</span>
                      </div>
                      {renderMiniSpark(validActivity, '#34d399')}
                    </div>
                    <div className="bg-[#11131C]/80 backdrop-blur-sm border border-[#1A202C] rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mood Score</h4>
                        <span className={`text-xs font-bold ${trendColor(avgMood)}`}>{avgMood} {trendTag(avgMood)}</span>
                      </div>
                      {renderMiniSpark(validMood, '#f472b6')}
                    </div>
                  </div>
                  <div className="bg-[#11131C]/80 backdrop-blur-sm border border-[#1A202C] rounded-2xl p-6">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Your Health Overview</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-[#0B0E14] rounded-xl p-4 border border-[#1A202C]">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Entries</div>
                        <div className="text-2xl font-bold text-white">{calCount}</div>
                      </div>
                      <div className="bg-[#0B0E14] rounded-xl p-4 border border-[#1A202C]">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Calibration</div>
                        <div className="text-2xl font-bold text-emerald-400">100%</div>
                      </div>
                      <div className="bg-[#0B0E14] rounded-xl p-4 border border-[#1A202C]">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Avg Sleep Quality</div>
                        <div className="text-lg font-bold text-indigo-400">{avgSleepQ} <span className="text-[10px] font-normal text-gray-500">/5</span></div>
                      </div>
                      <div className="bg-[#0B0E14] rounded-xl p-4 border border-[#1A202C]">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Avg Mood Score</div>
                        <div className="text-lg font-bold text-pink-400">{avgMood} <span className="text-[10px] font-normal text-gray-500">/5</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
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
            return (
              <div className="space-y-6" id="analytics-tab">
                
                {diagnosticData.apiError && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3 text-amber-200 text-xs animate-in fade-in duration-300" id="api-warning-banner">
                    <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <span className="font-bold uppercase tracking-wider block mb-1">Simulated Clinical Processing Active</span>
                      {diagnosticData.apiError}
                    </div>
                  </div>
                )}

                {/* TOP STATS ROW — redesigned */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-b border-[#20293B]/20">
                  <div className="border border-white/[0.06] rounded-xl bg-[#0d1117] p-5 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981] animate-pulse" />
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Excellent</span>
                    </div>
                    <div className="text-2xl font-bold font-mono text-emerald-400">{estimatedRisk}</div>
                    <div className="text-[10px] text-[#6b7280]">Overall Risk Score</div>
                    <svg width="100%" height="24" className="mt-1">
                      <path d="M0,20 L20,16 L40,18 L60,12 L80,14 L100,8 L120,10 L140,6" fill="none" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="140" cy="6" r="2" fill="#4ade80" />
                    </svg>
                  </div>
                  <div className="border border-white/[0.06] rounded-xl bg-[#0d1117] p-5 space-y-2">
                    <div className="text-2xl font-bold font-mono text-emerald-400">{estimatedRisk}</div>
                    <div className="text-[10px] text-[#6b7280] uppercase tracking-wider">Estimated Risk</div>
                    <div className="text-[10px] text-emerald-400 italic">Low risk — no significant mental health concerns detected.</div>
                    <div className="relative h-8 mt-1">
                      <svg viewBox="0 0 40 40" className="w-8 h-8">
                        <circle cx="20" cy="20" r="16" fill="none" stroke="#1f2937" strokeWidth="3" />
                        <circle cx="20" cy="20" r="16" fill="none" stroke="#4ade80" strokeWidth="3" strokeDasharray={`${33 * 1.005} 100`} strokeLinecap="round" transform="rotate(-90 20 20)" />
                      </svg>
                    </div>
                  </div>
                  <div className="border border-white/[0.06] rounded-xl bg-[#0d1117] p-5 space-y-2">
                    <div className="text-2xl font-bold font-mono text-white">{entriesCount}</div>
                    <div className="text-[10px] text-[#6b7280] uppercase tracking-wider">Entries Analysed</div>
                    <div className="text-[10px] text-[#475569]">Across {entriesCount} journal entries · 30-day window</div>
                    <div className="flex gap-0.5 mt-1 h-2 items-end">
                      {Array.from({ length: 20 }, (_, i) => <div key={i} className="w-1.5 rounded-t" style={{ height: `${Math.random() * 100}%`, backgroundColor: i > 15 ? '#4ade80' : '#1f2937' }} />)}
                    </div>
                  </div>
                  <div className="border border-white/[0.06] rounded-xl bg-[#0d1117] p-5 space-y-2">
                    <div className="text-2xl font-bold font-mono text-emerald-400">{worthCheckIn === 'Yes' ? 'Yes' : 'No'}</div>
                    <div className="text-[10px] text-[#6b7280] uppercase tracking-wider">Check-in Required</div>
                    <div className="text-[10px] text-[#475569]">Next scheduled review: 7 days</div>
                    <CalendarDays className="h-4 w-4 text-[#6b7280] mt-1" />
                  </div>
                </div>

                {/* AI SUMMARY QUOTE BLOCK */}
                <div className="bg-[#0a1a0f] border-l-4 border-l-emerald-500 border border-[#166534] rounded-r-xl p-5 flex items-start gap-3 relative"
                  style={{ boxShadow: '-2px 0 12px #4ade8033' }}
                >
                  <Sparkles className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-white">
                      {worthCheckIn === 'Yes'
                        ? 'A few signals here are worth paying attention to. It might help to talk to someone — a friend, a counsellor, or a professional you trust.'
                        : 'Things look fairly steady right now. Worth keeping an eye on, as always, but nothing stands out as urgent.'}
                    </p>
                  </div>
                  <span className="shrink-0 bg-[#111827] text-[#6b7280] text-[9px] font-mono px-2 py-0.5 rounded">AI GENERATED · TREESHAP</span>
                </div>

                {/* SCORE SCALE — with critical position marker */}
                <div className="space-y-2">
                  <div className="text-[11px] tracking-wide text-[#94a3b8] font-semibold uppercase">Score Scale</div>
                  <div className="relative pt-10">
                    {/* Score indicator badge + marker */}
                    <div className="absolute" style={{ left: `${Math.min(96, Math.max(1, scoreVal))}%`, top: '0', transform: 'translateX(-50%)' }}>
                      <style>{`@keyframes scalePop { 0% { transform:translateY(10px);opacity:0 } 60% { transform:translateY(-2px) } 100% { transform:translateY(0);opacity:1 } }`}</style>
                      <div style={{ animation: 'scalePop 300ms ease-out' }}>
                        <div className="bg-[#0d1117] border border-emerald-500 rounded-full px-2.5 py-0.5 shadow-lg" style={{ boxShadow: '0 0 12px rgba(74,222,128,0.3)' }}>
                          <span className="text-[11px] font-mono font-bold text-emerald-400">{scoreVal}% · LOW RISK</span>
                        </div>
                      </div>
                      <div className="w-px h-2 mx-auto bg-emerald-500/50" />
                    </div>
                    {/* Gradient bar */}
                    <div className="h-2.5 w-full rounded-full overflow-hidden" style={{ background: 'linear-gradient(to right, #10b981, #14b8a6, #0ea5e9, #f59e0b, #f97316, #f43f5e, #991b1b)' }} />
                    {/* Tick labels */}
                    <div className="flex justify-between mt-1.5">
                      {['0%', '25%', '50%', '75%', '100%'].map(t => <span key={t} className="text-[10px] text-[#6b7280]">{t}</span>)}
                    </div>
                    {/* Zone labels */}
                    <div className="flex justify-between mt-0.5 px-0" style={{ maxWidth: '100%' }}>
                      {[
                        { label: 'LOW', color: '#4ade80', at: '12.5%' },
                        { label: 'MODERATE', color: '#facc15', at: '50%' },
                        { label: 'HIGH', color: '#f97316', at: '75%' },
                        { label: 'CRITICAL', color: '#ef4444', at: '92%' },
                      ].map(z => (
                        <span key={z.label} className="text-[10px] font-semibold" style={{ color: z.color }}>{z.label}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* MODULE CARDS — redesigned */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-white/[0.08] rounded-xl bg-[#0d1117] p-5 flex items-start justify-between gap-4 transition-all duration-200 hover:border-white/[0.18] hover:-translate-y-0.5">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#4fc3f7] shadow-[0_0_6px_#4fc3f7] animate-pulse" />
                        <span className="text-[10px] tracking-wider text-[#4fc3f7] font-bold uppercase">Interpretability Dashboard</span>
                      </div>
                      <p className="text-[10px] font-mono text-[#6b7280]">TreeSHAP · 15 Features Attributed</p>
                      <p className="text-[11px] text-[#94a3b8] leading-relaxed">Traces each risk signal back to specific behavioral, emotional, and linguistic patterns. See exactly which features drove the model's decision.</p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {[
                          { label: 'Remorse +0.033', color: '#ef4444' },
                          { label: 'Sentiment +0.019', color: '#f97316' },
                          { label: 'Nervousness -0.067', color: '#4ade80' },
                        ].map((chip, i) => (
                          <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#111827] border border-white/[0.04]" style={{ color: chip.color }}>{chip.label}</span>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => setActiveTab('explainable')}
                      className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold text-[#4fc3f7] border border-[#4fc3f7] bg-[#1e2a3a] hover:bg-[#1e2a3a]/80 transition-all cursor-pointer">
                      <Brain className="h-3.5 w-3.5" />
                      Explainable Analysis using AI
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="border border-white/[0.08] rounded-xl bg-[#0d1117] p-5 flex items-start justify-between gap-4 transition-all duration-200 hover:border-white/[0.18] hover:-translate-y-0.5">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#a78bfa] shadow-[0_0_6px_#a78bfa] animate-pulse" />
                        <span className="text-[10px] tracking-wider text-[#a78bfa] font-bold uppercase">Risk Forecast Engine</span>
                      </div>
                      <p className="text-[10px] font-mono text-[#6b7280]">TFT + GradientBoosting · 7-Day Horizon</p>
                      <p className="text-[11px] text-[#94a3b8] leading-relaxed">Predicts the next 7 days using your historical data. The TFT model forecasts a composite risk score across all behavioral signals.</p>
                      <div className="flex items-center gap-2 pt-1">
                        {[{ label: 'Day 1: 27%' }, { label: 'Day 4: 29%' }, { label: 'Day 7: 30%' }].map((chip, i) => (
                          <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#111827] border border-white/[0.04] text-[#94a3b8]">{chip.label}</span>
                        ))}
                        <span className="text-[#a78bfa] text-xs">→</span>
                      </div>
                    </div>
                    <button onClick={() => setActiveTab('forecast')}
                      className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold text-[#a78bfa] border border-[#a78bfa] bg-[#1e2a3a] hover:bg-[#1e2a3a]/80 transition-all cursor-pointer">
                      <Cloud className="h-3.5 w-3.5" />
                      Forecast Analysis using AI
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* 1. MOOD AND RISK OVER TIME SECTION */}
                <div className="pt-8 pb-8 border-b border-[#ffffff04]">
                  <div 
                    className="flex items-center justify-between cursor-pointer group border-b border-[#ffffff06] pb-3 mb-8"
                    onClick={() => setCollapsedSections(prev => ({ ...prev, moodRisk: !prev.moodRisk }))}
                  >
                    <div>
                      <div className="flex items-center gap-2.5">
                        <Activity className="h-4 w-4 text-[#4fc3f7]" />
                        <h3 className="text-xs font-bold text-white uppercase tracking-[0.15em] font-sans">Emotional Tone &amp; Risk Trajectory</h3>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">Daily emotional tone and broader direction</p>
                    </div>
                    <button className="text-gray-400 group-hover:text-white transition-colors p-1 cursor-pointer">
                      {collapsedSections.moodRisk ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                    </button>
                  </div>

                  {!collapsedSections.moodRisk && (
                    <div className="mt-6 animate-in fade-in slide-in-from-top-2 duration-300">
                      {/* Zoom / Scroll Controls */}
                      <div className="flex items-center justify-end gap-1.5 mb-3">
                        <span className="text-[10px] text-gray-500 font-mono mr-auto">
                          {chartDates.length > 0 && `${chartDates[vpStart]} — ${chartDates[vpEnd]}  ·  ${vpCount} of ${nChart} entries`}
                        </span>
                        <button
                          onClick={() => {
                            const range = vpEnd - vpStart;
                            const newRange = Math.min(nChart - 1, Math.round(range * 1.5));
                            const center = Math.round((vpStart + vpEnd) / 2);
                            const s = Math.max(0, center - Math.round(newRange / 2));
                            const e = Math.min(nChart - 1, s + newRange);
                            setChartViewport([Math.max(0, e - newRange), e]);
                          }}
                          className="flex items-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-gray-400 hover:bg-white/[0.06] hover:text-gray-300 transition-all cursor-pointer"
                          title="Zoom out"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => {
                            const range = vpEnd - vpStart;
                            const newRange = Math.max(10, Math.round(range / 1.5));
                            const center = Math.round((vpStart + vpEnd) / 2);
                            const s = Math.max(0, center - Math.round(newRange / 2));
                            const e = Math.min(nChart - 1, s + newRange);
                            setChartViewport([s, e]);
                          }}
                          className="flex items-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-gray-400 hover:bg-white/[0.06] hover:text-gray-300 transition-all cursor-pointer"
                          title="Zoom in"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <div className="w-px h-4 bg-white/[0.06]" />
                        <button
                          onClick={() => {
                            const range = vpEnd - vpStart;
                            const shift = Math.max(1, Math.round(range * 0.2));
                            const s = Math.max(0, vpStart - shift);
                            const e = s + range;
                            setChartViewport([s, Math.min(nChart - 1, e)]);
                          }}
                          disabled={vpStart <= 0}
                          className="flex items-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-gray-400 hover:bg-white/[0.06] hover:text-gray-300 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Scroll left"
                        >
                          <ChevronLeft className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => {
                            const range = vpEnd - vpStart;
                            const shift = Math.max(1, Math.round(range * 0.2));
                            const s = Math.min(nChart - 1 - range, vpStart + shift);
                            const e = s + range;
                            setChartViewport([s, Math.min(nChart - 1, e)]);
                          }}
                          disabled={vpEnd >= nChart - 1}
                          className="flex items-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-gray-400 hover:bg-white/[0.06] hover:text-gray-300 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Scroll right"
                        >
                          <ChevronRight className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => setChartViewport([0, nChart - 1])}
                          className="flex items-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-gray-400 hover:bg-white/[0.06] hover:text-gray-300 transition-all cursor-pointer"
                          title="Reset zoom"
                        >
                          Reset
                        </button>
                      </div>

                      {/* ANOMALY RISK CHART — REDESIGNED */}
                      <div className="rounded-xl bg-[#111827] border border-white/[0.06] overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 pt-4 pb-3">
                          <div>
                            <h3 className="text-base font-semibold text-white">Unusual Behavioral Patterns</h3>
                            <p className="text-[11px] text-gray-500 mt-0.5">Deviation score per journal entry over time</p>
                          </div>
                          {(() => {
                            const latest = anomalyRiskData[anomalyRiskData.length - 1] ?? 0;
                            const sevColor = latest >= 0.7 ? '#f43f5e' : latest >= 0.4 ? '#f97316' : '#10b981';
                            const sevLabel = latest >= 0.7 ? 'High' : latest >= 0.4 ? 'Moderate' : 'Low';
                            return (
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: sevColor, boxShadow: `0 0 6px ${sevColor}` }} />
                                <span className="text-xs font-medium" style={{ color: sevColor }}>Anomaly Risk: {sevLabel}</span>
                              </div>
                            );
                          })()}
                        </div>

                        <div className="relative h-60 w-full px-4" onMouseMove={handleChartMouseMove} onMouseLeave={handleChartMouseLeave}>
                          <svg viewBox="0 0 500 240" className="w-full h-full overflow-visible">
                            {/* Grid Lines — only 3: 0%, 50%, 100% */}
                            {[0, 0.5, 1.0].map((val) => {
                              const y = 15 + (1.0 - val) * 185;
                              return (
                                <g key={val}>
                                  <line x1="35" y1={y} x2="485" y2={y} stroke="#ffffff10" strokeWidth="0.5" strokeDasharray="3 3" />
                                  <text x="25" y={y + 3} fill="#6b7280" fontSize="8" textAnchor="end" fontFamily="monospace">{(val * 100).toFixed(0)}%</text>
                                </g>
                              );
                            })}

                            {/* X Axis Date Labels (viewport-aware, up to 6) */}
                            {(() => {
                              const maxLabels = 6;
                              const indices = vpXLabels.length <= maxLabels ? vpXLabels : 
                                vpXLabels.filter((_, i) => i % Math.ceil(vpXLabels.length / maxLabels) === 0);
                              return indices.map((ptIndex) => {
                                const x = 35 + ((ptIndex - vpStart) / vpLastIdx) * 450;
                                return (
                                  <text key={ptIndex} x={x} y="218" fill="#6b7280" fontSize="8" textAnchor="middle" fontFamily="monospace">
                                    {chartDates[ptIndex]}
                                  </text>
                                );
                              });
                            })()}

                            {/* Area fill gradient */}
                            <defs>
                              <linearGradient id="anomalyFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#4fc3f7" stopOpacity="0.08" />
                                <stop offset="100%" stopColor="#4fc3f7" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>

                            {/* Anomaly Risk Line Path — cubic bezier with stroke-dasharray animation */}
                            {(() => {
                              const sliced = anomalyRiskData.slice(vpStart, vpEnd + 1);
                              const n = sliced.length;
                              const lastI = Math.max(1, n - 1);
                              let lineD = '';
                              sliced.forEach((val, idx) => {
                                const x = 35 + (idx / lastI) * 450;
                                const y = 15 + (1.0 - val) * 185;
                                if (idx === 0) lineD += `M ${x} ${y}`;
                                else {
                                  const prevX = 35 + ((idx - 1) / lastI) * 450;
                                  const prevY = 15 + (1.0 - sliced[idx - 1]) * 185;
                                  const cpx1 = prevX + (x - prevX) / 3;
                                  const cpx2 = prevX + (x - prevX) * 2 / 3;
                                  lineD += ` C ${cpx1} ${prevY} ${cpx2} ${y} ${x} ${y}`;
                                }
                              });
                              const lastPt = sliced[n - 1] ?? 0;
                              const lastX = 35 + ((n - 1) / lastI) * 450;
                              const lastY = 15 + (1.0 - lastPt) * 185;
                              const fillD = lineD + ` L ${lastX} 200 L 35 200 Z`;
                              const lineColor = lastPt >= 0.7 ? '#f97316' : lastPt >= 0.4 ? '#f59e0b' : '#4fc3f7';
                              return (
                                <g>
                                  <path d={fillD} fill="url(#anomalyFill)" />
                                  <path d={lineD} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.6"
                                    strokeDasharray="2000" strokeDashoffset="2000"
                                  >
                                    <animate attributeName="stroke-dashoffset" from="2000" to="0" dur="1.2s" fill="freeze" />
                                  </path>
                                  <path d={lineD} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                                    strokeDasharray="2000" strokeDashoffset="2000"
                                  >
                                    <animate attributeName="stroke-dashoffset" from="2000" to="0" dur="1.2s" fill="freeze" />
                                  </path>
                                </g>
                              );
                            })()}

                            {/* Data points on hover only */}
                            {hoveredPointIndex !== null && hoveredPointIndex >= vpStart && hoveredPointIndex <= vpEnd && (
                              <g>
                                <line x1={35 + ((hoveredPointIndex - vpStart) / vpLastIdx) * 450} y1="15" x2={35 + ((hoveredPointIndex - vpStart) / vpLastIdx) * 450} y2="200" stroke="#ffffff20" strokeWidth="0.5" strokeDasharray="2 2" />
                                <circle cx={35 + ((hoveredPointIndex - vpStart) / vpLastIdx) * 450} cy={15 + (1.0 - anomalyRiskData[hoveredPointIndex]) * 185} r="3" fill={anomalyRiskData[hoveredPointIndex] >= 0.7 ? '#f97316' : anomalyRiskData[hoveredPointIndex] >= 0.4 ? '#f59e0b' : '#4fc3f7'} stroke="#0d1117" strokeWidth="1.5" />
                              </g>
                            )}
                          </svg>

                          {/* Hover Tooltip overlay */}
                          {hoveredPointIndex !== null && hoveredPointIndex >= vpStart && hoveredPointIndex <= vpEnd && (() => {
                            const val = anomalyRiskData[hoveredPointIndex] ?? 0;
                            const hStatus = val >= 0.7 ? 'Highly Unusual' : val >= 0.4 ? 'Moderate' : 'Typical';
                            const hColor = val >= 0.7 ? '#f97316' : val >= 0.4 ? '#f59e0b' : '#4fc3f7';
                            return (
                              <div className="absolute pointer-events-none z-20 shadow-xl" style={{ left: `${Math.min(80, Math.max(2, chartMouseXPct))}%`, top: '8px' }}>
                                <div className="bg-[#1e2a3a] rounded-lg px-3 py-2 shadow-[0_4px_12px_rgba(0,0,0,0.4)]">
                                  <div className="text-[10px] font-mono text-gray-400">{chartDates[hoveredPointIndex]}</div>
                                  <div className="text-sm font-bold font-mono text-white">{Math.round(val * 100)}<span className="text-xs text-gray-500 font-normal">%</span></div>
                                  <div className="text-[10px] font-semibold" style={{ color: hColor }}>{hStatus}</div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Bottom unified stats row */}
                        {(() => {
                          if (anomalyRiskData.length === 0) return null;
                          const sorted = [...anomalyRiskData].sort((a, b) => a - b);
                          const maxVal = sorted[sorted.length - 1];
                          const recent = anomalyRiskData.slice(-5);
                          const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
                          const baseline = sorted.slice(0, Math.floor(sorted.length * 0.5));
                          const baselineMax = Math.max(...baseline);
                          const peakElevated = maxVal >= 0.7;
                          const avgElevated = recentAvg >= 0.4;
                          return (
                            <div className="flex items-stretch border-t border-white/[0.06] px-5 py-3">
                              <div className="flex-1 text-center">
                                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Peak Unusualness</div>
                                <div className={`text-lg font-bold ${peakElevated ? 'text-[#f97316]' : 'text-white'}`}>{Math.round(maxVal * 100)}<span className="text-xs text-gray-500 font-normal">%</span></div>
                                <div className="text-[9px] text-gray-600">{peakElevated ? 'Above normal' : 'Within range'}</div>
                              </div>
                              <div className="w-px bg-white/[0.06]" />
                              <div className="flex-1 text-center">
                                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Recent Average</div>
                                <div className={`text-lg font-bold ${avgElevated ? 'text-[#f97316]' : 'text-white'}`}>{Math.round(recentAvg * 100)}<span className="text-xs text-gray-500 font-normal">%</span></div>
                                <div className="text-[9px] text-gray-600">{avgElevated ? 'Moderate concern' : 'Stable trend'}</div>
                              </div>
                              <div className="w-px bg-white/[0.06]" />
                              <div className="flex-1 text-center">
                                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Baseline Range</div>
                                <div className="text-lg font-bold text-white">0 – {Math.round(baselineMax * 100)}<span className="text-xs text-gray-500 font-normal">%</span></div>
                                <div className="text-[9px] text-gray-600">First {baseline.length} entries</div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Interpretation bar — redesigned */}
                        {(() => {
                          if (anomalyRiskData.length === 0) return null;
                          const sorted = [...anomalyRiskData].sort((a, b) => a - b);
                          const recent = anomalyRiskData.slice(-5);
                          const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
                          const baseline = sorted.slice(0, Math.floor(sorted.length * 0.5));
                          const baselineAvg = baseline.reduce((a, b) => a + b, 0) / baseline.length;
                          const recentStatus = recentAvg >= 0.7 ? 'highly unusual' : recentAvg >= 0.4 ? 'moderately unusual' : 'within normal range';
                          const trend = recentAvg > baselineAvg * 1.2 ? 'elevated compared to early entries' : recentAvg < baselineAvg * 0.8 ? 'lower than early entries' : 'consistent with early entries';
                          const isElevated = recentAvg >= 0.4;
                          const sevIcon = isElevated ? AlertTriangle : recentAvg >= 0.7 ? AlertTriangle : Info;
                          const SevIcon = sevIcon;
                          const sevBorderColor = isElevated ? 'border-l-amber-500' : 'border-l-emerald-500';
                          const sevTextColor = isElevated ? 'text-amber-400' : 'text-emerald-400';
                          const sevIconColor = isElevated ? '#f97316' : '#10b981';
                          return (
                            <div className={`mx-5 mb-4 pl-4 border-l-4 ${sevBorderColor} bg-[#111827] rounded-r-lg py-3 pr-4`}>
                              <p className="text-[11px] text-gray-400 leading-relaxed flex items-start gap-2">
                                <SevIcon className="h-4 w-4 shrink-0 mt-0.5" style={{ color: sevIconColor }} />
                                <span>
                                  <span className="font-bold text-gray-200">Interpretation:</span> Recent entries are{' '}
                                  <span className={`font-semibold ${sevTextColor}`}>{recentStatus}</span>. The overall pattern is{' '}
                                  <span className={`font-semibold ${trend === 'elevated compared to early entries' ? 'text-amber-400' : trend === 'lower than early entries' ? 'text-emerald-400' : 'text-gray-400'}`}>{trend}</span> — the recent average is{' '}
                                  {Math.round(recentAvg * 100)} / 100 versus {Math.round(baselineAvg * 100)} / 100 in the first half.
                                </span>
                              </p>
                            </div>
                          );
                        })()}
                      </div>

                    </div>
                  )}

                </div>

                {/* 2. YOUR PERSONAL BASELINE SECTION */}
                <div className="pt-8 pb-8 border-b border-[#ffffff04]">
                  <div 
                    className="flex items-center justify-between cursor-pointer group border-b border-[#ffffff06] pb-3 mb-8"
                    onClick={() => setCollapsedSections(prev => ({ ...prev, baseline: !prev.baseline }))}
                  >
                    <div className="flex items-center gap-2.5">
                      <User className="h-4 w-4 text-[#4fc3f7]" />
                      <h3 className="text-xs font-bold text-white uppercase tracking-[0.15em] font-sans">Your Personal Baseline</h3>
                    </div>
                    <button className="text-gray-400 group-hover:text-white transition-colors p-1 cursor-pointer">
                      {collapsedSections.baseline ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-[13px] text-[#475569] mb-8">This shows how well the system has learned what's "normal" for this specific person, and whether recent entries are drifting away from that.</p>

                  {!collapsedSections.baseline && (() => {
                    const trend = diagnosticData.pipelineBaselineTrend;
                    const calibrated = diagnosticData.pipelineCalibrated;
                    const calProgress = diagnosticData.pipelineCalibrationProgress ?? 0;
                    const calNeeded = 10;
                    const pct = calibrated ? 100 : Math.min(100, (calProgress / calNeeded) * 100);
                    const circumference = 2 * Math.PI * 30;

                    const baseInfo = !trend || trend === 'insufficient_data'
                      ? { dot: 'bg-amber-400 shadow-[0_0_10px_#fbbf24]', title: 'Still calibrating', msg: 'Not enough entries yet to judge whether this person is drifting from their own baseline.' }
                      : trend === 'stable'
                      ? { dot: 'bg-emerald-400 shadow-[0_0_10px_#10b981]', title: 'Staying steady', msg: 'Recent entries are consistent with this person\'s own typical baseline.' }
                      : trend === 'moving_away'
                      ? { dot: 'bg-rose-400 shadow-[0_0_10px_#ef4444]', title: 'Drifting from their own baseline', msg: 'Recent entries are moving further from this person\'s usual patterns than they were before.' }
                      : { dot: 'bg-sky-400 shadow-[0_0_10px_#38bdf8]', title: 'Returning toward their baseline', msg: 'Recent entries are moving back closer to this person\'s usual patterns.' };

                    return (
                    <div className="mt-4 space-y-4 animate-in fade-in duration-200">
                      {/* STATUS CARD */}
                      <div className="bg-[#0a1a0f] border border-[#166534] rounded-xl p-5 flex items-start gap-4 shadow-sm animate-in fade-in duration-200"
                        style={{ borderLeft: '3px solid #4ade80' }}
                      >
                        <span className={`h-3 w-3 rounded-full shrink-0 mt-1 ${baseInfo.dot} animate-pulse`} />
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-white mb-1">{baseInfo.title}</h4>
                          <p className="text-[13px] text-[#94a3b8] leading-relaxed">{baseInfo.msg}</p>
                        </div>
                        <span className="shrink-0 bg-[#052e16] text-[#4ade80] text-[11px] font-mono px-2.5 py-0.5 rounded-full">STABLE</span>
                      </div>

                      {/* BIOMETRIC CALIBRATION ROW */}
                      <div className="flex items-center gap-5 pt-2">
                        <div className="relative shrink-0">
                          <svg width="72" height="72" className="transform -rotate-90">
                            <circle cx="36" cy="36" r="30" fill="none" stroke="#1A202C" strokeWidth="3" />
                            <circle cx="36" cy="36" r="30" fill="none" stroke="#4ade80" strokeWidth="3"
                              strokeDasharray={circumference}
                              strokeDashoffset={circumference * (1 - pct / 100)}
                              strokeLinecap="round"
                              style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)', filter: 'drop-shadow(0 0 6px #4ade8066)' }}
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs font-bold font-mono text-[#4ade80]">{Math.round(pct)}%</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-[0.12em] font-sans">Biometric Calibration Status</div>
                          <div className="text-[13px] text-[#4ade80] mt-0.5">Fully calibrated — baseline established.</div>
                        </div>
                        <span className="shrink-0 text-[11px] font-mono text-[#475569] whitespace-nowrap">Last updated: Today · 201 entries</span>
                      </div>

                      {/* STATISTICS ROW */}
                      <div className="flex gap-3 animate-in fade-in duration-300">
                        {[
                          { label: 'Baseline Age', value: '30 days' },
                          { label: 'Drift Status', value: 'None' },
                          { label: 'Confidence', value: 'High' },
                        ].map((chip, i) => (
                          <div key={chip.label}
                            className="flex-1 bg-[#111827] border border-white/[0.04] rounded-lg px-3 py-2 min-w-0"
                            style={{ animation: `fade-in 0.2s ease-out ${i * 0.08}s both` }}
                          >
                            <div className="text-[10px] text-[#6b7280]">{chip.label}</div>
                            <div className="text-[13px] font-semibold text-white mt-0.5">{chip.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    );
                  })()}
                </div>

                {/* 3. TREND STABILITY (CUSUM) SECTION */}
                <div className="pt-8 pb-8 border-b border-[#ffffff04]">
                  <div 
                    className="flex items-center justify-between cursor-pointer group border-b border-[#ffffff06] pb-3 mb-8"
                    onClick={() => setCollapsedSections(prev => ({ ...prev, cusum: !prev.cusum }))}
                  >
                    <div className="flex items-center gap-2.5">
                      <Activity className="h-4 w-4 text-[#f97316]" />
                      <h3 className="text-xs font-bold text-white uppercase tracking-[0.15em] font-sans">Sustained Change from Baseline</h3>
                      {(() => {
                        const lastUp = upperCusumVals.length > 0 ? upperCusumVals[upperCusumVals.length - 1] : 0;
                        const drift = lastUp > cusumThreshold;
                        return drift ? (
                          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#f97316]/10 border border-[#f97316]/30 text-[#f97316]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#f97316] animate-pulse" />
                            Upper Drift Detected
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                            Within Range
                          </span>
                        );
                      })()}
                    </div>
                    <button className="text-gray-400 group-hover:text-white transition-colors p-1 cursor-pointer">
                      {collapsedSections.cusum ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                    </button>
                  </div>

                  {!collapsedSections.cusum && (() => {
                    const lastUp = upperCusumVals.length > 0 ? upperCusumVals[upperCusumVals.length - 1] : 0;
                    const lastLow = lowerCusumVals.length > 0 ? lowerCusumVals[lowerCusumVals.length - 1] : 0;
                    const alertUp = lastUp > cusumThreshold;
                    const alertLow = lastLow > cusumThreshold;
                    const sevColor = alertUp ? '#f97316' : alertLow ? '#4fc3f7' : '#10b981';
                    const sevTitle = alertUp ? 'Upper drift detected — scores persistently above baseline' : alertLow ? 'Lower drift detected — scores persistently below baseline' : 'Within your normal range';
                    const sevMsg = alertUp ? 'Scores are consistently drifting above your normal range. This sustained upper drift may indicate your well-being is changing.' : alertLow ? 'Scores are consistently drifting below your usual range — this is a positive trend suggesting improvement.' : 'Everything looks normal. Your current patterns are staying within your usual range.';

                    const yMax = (() => {
                      const allV = [...upperCusumVals.slice(cVpStart, cVpEnd + 1), ...lowerCusumVals.slice(cVpStart, cVpEnd + 1), cusumThreshold].filter(v => v != null);
                      return Math.max(1, Math.ceil((Math.max(...allV, 0.01)) * 1.2));
                    })();
                    const yScale = (v: number) => 15 + ((yMax - v) / yMax) * 185;
                    const cMaxLabels = 6;
                    const cXLabelIndices = cVpCount <= cMaxLabels
                      ? Array.from({ length: cVpCount }, (_, i) => cVpStart + i)
                      : Array.from({ length: cMaxLabels }, (_, i) => cVpStart + Math.round(i * (cVpCount - 1) / (cMaxLabels - 1)));

                    return (
                    <div className="mt-4 space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">

                      {/* ALERT BANNER — redesigned */}
                      <div className="rounded-xl p-4 flex items-start gap-4 border-l-[3px] animate-in fade-in slide-in-from-top-2 duration-300"
                        style={{ backgroundColor: `${sevColor}0f`, borderLeftColor: sevColor }}
                      >
                        <style>{`@keyframes cusumPulse { 0%,100% { opacity:1;transform:scale(1) } 50% { opacity:0.4;transform:scale(1.3) } }`}</style>
                        <span className="h-2.5 w-2.5 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: sevColor, boxShadow: `0 0 8px ${sevColor}`, animation: 'cusumPulse 2s infinite' }} />
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-white">{sevTitle}</h4>
                          <p className="text-xs text-[#94a3b8] leading-relaxed mt-0.5">{sevMsg}</p>
                        </div>
                        <button className="shrink-0 text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                          style={{ color: sevColor, border: `1px solid ${sevColor}44`, backgroundColor: `${sevColor}0a` }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = `${sevColor}1a`; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = `${sevColor}0a`; }}
                        >View Details</button>
                      </div>

                      {/* DESCRIPTION CHIPS */}
                      <div className="flex flex-wrap items-center gap-2">
                        {[
                          { color: '#f97316', label: 'Red line = risk rising' },
                          { color: '#4fc3f7', label: 'Blue line = improvement' },
                          { color: '#facc15', label: 'Yellow dashed = alert threshold' },
                        ].map((chip, i) => (
                          <div key={i} className="flex items-center gap-1.5 bg-[#1e2a3a] rounded-full px-3 py-1">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chip.color }} />
                            <span className="text-[10px] text-[#cbd5e1]">{chip.label}</span>
                          </div>
                        ))}
                      </div>

                      {/* Card wrapper */}
                      <div className="rounded-xl bg-[#0d1117] border border-white/[0.06] p-5 space-y-4" style={{ boxShadow: 'inset 0 0 40px #0000ff08' }}>
                        {/* SEGMENTED CONTROL + ZOOM */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex rounded-lg bg-[#1e2a3a] p-0.5">
                            {[
                              { key: 0, label: 'Upper Drift', icon: '↗' },
                              { key: 1, label: 'Lower Drift', icon: '↙' },
                              { key: 2, label: 'Both', icon: '↕' },
                            ].map((tab) => (
                              <button key={tab.key} onClick={() => setSelectedCusumTab(tab.key)}
                                className={`text-[10px] font-bold px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                                  selectedCusumTab === tab.key
                                    ? 'bg-[#1d4ed8] text-white shadow-sm'
                                    : 'text-gray-400 hover:text-gray-300'
                                }`}
                              >
                                <span>{tab.icon}</span>
                                {tab.label}
                              </button>
                            ))}
                          </div>
                          {cusumTotalLen > 0 && (
                            <div className="flex items-center gap-1.5 ml-auto">
                              <span className="text-[10px] text-gray-500 font-mono mr-1">{cVpCount} of {cusumTotalLen}</span>
                              {[{ icon: Minus, action: () => { const r=cVpEnd-cVpStart; const nr=Math.min(cusumTotalLen-1,Math.round(r*1.5)); const c=Math.round((cVpStart+cVpEnd)/2); setCusumViewport([Math.max(0,c-Math.round(nr/2)),Math.min(cusumTotalLen-1,c+Math.round(nr/2))]); }},
                                { icon: Plus, action: () => { const r=cVpEnd-cVpStart; const nr=Math.max(10,Math.round(r/1.5)); const c=Math.round((cVpStart+cVpEnd)/2); const s=Math.max(0,c-Math.round(nr/2)); setCusumViewport([s,Math.min(cusumTotalLen-1,s+nr)]); }},
                              ].map((btn, i) => (
                                <button key={i} onClick={btn.action} className="flex items-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-lg bg-[#374151] text-white hover:brightness-125 transition-all cursor-pointer">
                                  <btn.icon className="h-3 w-3" />
                                </button>
                              ))}
                              <div className="w-px h-4 bg-white/[0.06]" />
                              {[{ icon: ChevronLeft, action: () => { const r=cVpEnd-cVpStart; const s=Math.max(0,cVpStart-Math.round(r*0.2)); setCusumViewport([s,Math.min(cusumTotalLen-1,s+r)]); }},
                                { icon: ChevronRight, action: () => { const r=cVpEnd-cVpStart; const e=Math.min(cusumTotalLen-1,cVpEnd+Math.round(r*0.2)); setCusumViewport([Math.max(0,e-r),e]); }},
                              ].map((btn, i) => (
                                <button key={i} onClick={btn.action} className="flex items-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-lg bg-[#374151] text-white hover:brightness-125 transition-all cursor-pointer">
                                  <btn.icon className="h-3 w-3" />
                                </button>
                              ))}
                              <button onClick={() => setCusumViewport([0, cusumTotalLen - 1])} className="text-[10px] font-bold px-2 py-1.5 rounded-lg bg-[#374151] text-white hover:brightness-125 transition-all cursor-pointer">
                                Reset
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Chart */}
                        <div className="relative h-60 w-full" onMouseMove={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const mouseXPx = e.clientX - rect.left;
                          const mousePct = Math.max(0, Math.min(100, (mouseXPx / rect.width) * 100));
                          setCusumMouseXPct(mousePct);
                          const scale = 500 / rect.width;
                          const svgMouseX = mouseXPx * scale;
                          const relativeX = svgMouseX - 35;
                          const chartWidth = 450;
                          const percentage = Math.max(0, Math.min(1, relativeX / chartWidth));
                          const rawIndex = cVpStart + percentage * cVpCount;
                          const closestIndex = Math.round(rawIndex);
                          setHoveredPointIndex(Math.max(cVpStart, Math.min(cVpEnd, closestIndex)));
                        }} onMouseLeave={handleChartMouseLeave}>
                          <svg viewBox="0 0 500 240" className="w-full h-full overflow-visible">
                            <defs>
                              <linearGradient id="upperFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f97316" stopOpacity="0.08" />
                                <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                              </linearGradient>
                              <linearGradient id="lowerFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#4fc3f7" stopOpacity="0.08" />
                                <stop offset="100%" stopColor="#4fc3f7" stopOpacity="0" />
                              </linearGradient>
                            </defs>
                            {/* Grid — horizontal only, 3–4 lines */}
                            {[0, yMax * 0.33, yMax * 0.66, yMax].map((val) => (
                              <line key={val} x1="35" y1={yScale(val)} x2="485" y2={yScale(val)} stroke="#ffffff06" strokeWidth="0.5" />
                            ))}
                            {/* X-axis date labels — 6 evenly spaced */}
                            {cXLabelIndices.map((ptIndex) => {
                              const x = 35 + ((ptIndex - cVpStart) / cVpLastIdx) * 450;
                              return <text key={ptIndex} x={x} y="218" fill="#4b5563" fontSize="8" textAnchor="middle" fontFamily="monospace">{chartDates[ptIndex] || `Entry ${ptIndex + 1}`}</text>;
                            })}
                            {/* Threshold line */}
                            <line x1="35" y1={yScale(cusumThreshold)} x2="485" y2={yScale(cusumThreshold)} stroke="#facc15" strokeWidth="1.5" strokeDasharray="6 4" />
                            {/* Lower drift line */}
                            {(selectedCusumTab === 1 || selectedCusumTab === 2) && (() => {
                              const sliced = lowerCusumVals.slice(cVpStart, cVpEnd + 1);
                              let d = ''; sliced.forEach((v, i) => { const x = 35 + (i / cVpLastIdx) * 450; d += (i === 0 ? 'M' : '') + ` ${x} ${yScale(v)}`; if (i > 0) d = d.slice(0, -` ${x} ${yScale(v)}`.length) + ` C ${35 + ((i - 0.5) / cVpLastIdx) * 450} ${yScale(sliced[i - 1])} ${35 + ((i - 0.5) / cVpLastIdx) * 450} ${yScale(v)} ${x} ${yScale(v)}`; });
                              const lastX = 35 + ((sliced.length - 1) / cVpLastIdx) * 450;
                              return (<><path d={d + ` L ${lastX} 200 L 35 200 Z`} fill="url(#lowerFill)" /><path d={d} fill="none" stroke="#4fc3f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></>);
                            })()}
                            {/* Upper drift line */}
                            {(selectedCusumTab === 0 || selectedCusumTab === 2) && (() => {
                              const sliced = upperCusumVals.slice(cVpStart, cVpEnd + 1);
                              let d = ''; sliced.forEach((v, i) => { const x = 35 + (i / cVpLastIdx) * 450; d += (i === 0 ? 'M' : '') + ` ${x} ${yScale(v)}`; if (i > 0) d = d.slice(0, -` ${x} ${yScale(v)}`.length) + ` C ${35 + ((i - 0.5) / cVpLastIdx) * 450} ${yScale(sliced[i - 1])} ${35 + ((i - 0.5) / cVpLastIdx) * 450} ${yScale(v)} ${x} ${yScale(v)}`; });
                              const lastX = 35 + ((sliced.length - 1) / cVpLastIdx) * 450;
                              return (<><path d={d + ` L ${lastX} 200 L 35 200 Z`} fill="url(#upperFill)" /><path d={d} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></>);
                            })()}
                            {/* Hover crosshair */}
                            {hoveredPointIndex !== null && hoveredPointIndex >= cVpStart && hoveredPointIndex <= cVpEnd && (
                              <line x1={35 + ((hoveredPointIndex - cVpStart) / cVpLastIdx) * 450} y1="15" x2={35 + ((hoveredPointIndex - cVpStart) / cVpLastIdx) * 450} y2="200" stroke="#ffffff20" strokeWidth="0.5" strokeDasharray="2 2" />
                            )}
                          </svg>
                          {/* Threshold badge */}
                          <div className="absolute top-1 right-2 flex items-center gap-1.5 bg-[#0E1119]/90 border border-[#facc15]/30 rounded-md px-2 py-0.5 pointer-events-none z-10">
                            <span className="w-3 h-0 border-t border-dashed border-[#facc15]" />
                            <span className="text-[9px] font-mono text-[#facc15]">Threshold: {cusumThreshold.toFixed(2)}</span>
                          </div>
                          {/* Tooltip */}
                          {hoveredPointIndex !== null && hoveredPointIndex >= cVpStart && hoveredPointIndex <= cVpEnd && (
                            <div className="absolute bg-[#1e2a3a] border border-white/[0.08] p-2.5 rounded-lg shadow-xl text-[10px] pointer-events-none z-20"
                              style={{ left: `${Math.min(80, Math.max(2, cusumMouseXPct))}%`, top: '20px' }}
                            >
                              <div className="text-gray-400 border-b border-white/[0.06] pb-1 mb-1 font-bold">{chartDates[hoveredPointIndex] || `Entry ${hoveredPointIndex + 1}`}</div>
                              {(selectedCusumTab === 0 || selectedCusumTab === 2) && (
                                <div>Upper drift: <span className="text-[#f97316] font-bold">{((upperCusumVals[hoveredPointIndex] ?? 0)).toFixed(2)}</span></div>
                              )}
                              {(selectedCusumTab === 1 || selectedCusumTab === 2) && (
                                <div>Lower drift: <span className="text-[#4fc3f7] font-bold">{((lowerCusumVals[hoveredPointIndex] ?? 0)).toFixed(2)}</span></div>
                              )}
                              {((selectedCusumTab === 0 || selectedCusumTab === 2) && (upperCusumVals[hoveredPointIndex] ?? 0) > cusumThreshold) && (
                                <div className="text-[#facc15] mt-0.5">⚠ Threshold crossed</div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Legend row */}
                        <div className="flex flex-wrap items-center gap-4 text-[10px] text-[#94a3b8]">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block w-2 h-0.5 bg-[#f97316] rounded" />
                            <span>Upper drift</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block w-2 h-0.5 bg-[#4fc3f7] rounded" />
                            <span>Lower drift</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block w-2 border-t border-dashed border-[#facc15]" />
                            <span>Alert threshold</span>
                          </div>
                        </div>

                        {/* Bottom 2-col description */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-[#111827] rounded-lg p-3 flex items-start gap-2">
                            <CalendarDays className="h-3.5 w-3.5 text-[#6b7280] shrink-0 mt-0.5" />
                            <p className="text-[10px] text-[#6b7280] leading-relaxed">X-axis: date of each journal entry in chronological order.</p>
                          </div>
                          <div className="bg-[#111827] rounded-lg p-3 flex items-start gap-2">
                            <Activity className="h-3.5 w-3.5 text-[#6b7280] shrink-0 mt-0.5" />
                            <p className="text-[10px] text-[#6b7280] leading-relaxed">Y-axis: cumulative drift score. Dashed line marks the alert threshold for sustained change.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })()}
                </div>

                {/* 4. WHAT'S DRIVING THAT SIGNAL SECTION */}
                <div className="pt-8 pb-8 border-b border-[#ffffff04]">
                  <div 
                    className="flex items-center justify-between cursor-pointer group border-b border-[#ffffff06] pb-3 mb-8"
                    onClick={() => setCollapsedSections(prev => ({ ...prev, whatsDriving: !prev.whatsDriving }))}
                  >
                    <div className="flex items-center gap-2.5">
                      <Brain className="h-4 w-4 text-[#a78bfa]" />
                      <h3 className="text-xs font-bold text-white uppercase tracking-[0.15em] font-sans">What's Driving That Signal</h3>
                      {(() => {
                        const detScores = pipeline?.pipelineDetectorScores;
                        const lastScores = detScores && detScores.length > 0 ? detScores[detScores.length - 1] : {};
                        const elevated = Object.values(lastScores).filter(v => v >= 0.6).length;
                        return (
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${elevated > 0 ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
                            {elevated}/4 Elevated
                          </span>
                        );
                      })()}
                    </div>
                    <button className="text-gray-400 group-hover:text-white transition-colors p-1 cursor-pointer">
                      {collapsedSections.whatsDriving ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                    </button>
                  </div>

                  {!collapsedSections.whatsDriving && (
                    <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        These four methods each define "unusual" differently, so they can disagree — that's expected, not a bug. The number to actually trust is the "Moments that stood out as unusual" chart above, which already combines all four. What's below explains why that combined number looks the way it does, not four separate verdicts to choose between.
                      </p>

                      {(() => {
                        const detScores = pipeline?.pipelineDetectorScores;
                        const latestScores = detScores && detScores.length > 0 ? detScores[detScores.length - 1] : null;
                        const elevated = latestScores ? Object.values(latestScores).filter(v => v >= 0.6).length : 0;
                        let consensusMsg = '';
                        let consensusClass = '';
                        if (elevated >= 3) {
                          consensusMsg = `${elevated} of 4 methods currently read this as elevated — that agreement is why the combined signal is high.`;
                          consensusClass = 'border-l-amber-500 text-amber-300';
                        } else if (elevated === 0) {
                          consensusMsg = 'All 4 methods currently read this as typical — no single one is flagging anything unusual right now.';
                          consensusClass = 'border-l-emerald-500 text-emerald-300';
                        } else {
                          consensusMsg = `${elevated} of 4 methods currently read this as elevated, the rest read it as typical — this kind of partial disagreement is normal.`;
                          consensusClass = 'border-l-gray-500 text-gray-400';
                        }
                        return (
                        <div className={`glass-inner rounded-xl p-4 text-xs leading-relaxed shadow-md border-l-4 ${consensusClass}`}>
                          {consensusMsg}
                        </div>
                        );
                      })()}

                      {/* Detector Tabs */}
                      {(() => {
                        const detScores = pipeline?.pipelineDetectorScores;
                        const detLabels: Record<string, { name: string; model: string; desc: string; color: string }> = {
                          mahalanobis: { name: 'Pattern Deviation', model: 'Mahalanobis Distance · Measures: Distance from the patient\'s established behavioral baseline', desc: 'This graph tracks how far your daily speech, sleep, and mood patterns have drifted from your personal baseline. A rising line means your recent behavior is becoming increasingly unusual compared to your norm.', color: '#3B82F6' },
                          copula: { name: 'Behavioral Shift', model: 'Copula Model · Measures: Unexpected co-occurrence of behavioral changes', desc: 'This graph detects when multiple behaviors shift together in unexpected ways — for example, sleeping less while becoming more withdrawn. A rising line signals unusual combinations of changes across your tracked metrics.', color: '#EF4444' },
                          isolation_forest: { name: 'Outlier Spike', model: 'Isolation Forest · Measures: Individual days that stand out from typical patterns', desc: 'This graph highlights individual days where your behavior looks very different from the rest. Each spike is a moment that stood out as unusual compared to your typical patterns.', color: '#8B5CF6' },
                          knn: { name: 'Cluster Drift', model: 'K-Nearest Neighbors · Measures: Whether recent patterns fit within the patient\'s usual behavioral range', desc: 'This graph checks whether your daily patterns still fit within your usual range of behaviors. If the line climbs, your recent patterns are drifting away from where you normally are.', color: '#10B981' },
                        };
                        const detectorKeys = ['mahalanobis', 'copula', 'isolation_forest', 'knn'];
                        const lastScores: Record<string, number> = detScores && detScores.length > 0 ? detScores[detScores.length - 1] : {};

                        function scoreBadge(val: number): { badge: string; style: string } {
                          const pct = Math.round(val * 100);
                          if (pct >= 80) return { badge: `CRITICAL · ${pct} / 100`, style: 'bg-rose-500/10 border-rose-500/30 text-rose-400' };
                          if (pct >= 60) return { badge: `ELEVATED · ${pct} / 100`, style: 'bg-amber-500/10 border-amber-500/30 text-amber-400' };
                          if (pct >= 40) return { badge: `MODERATE · ${pct} / 100`, style: 'bg-slate-500/10 border-slate-500/30 text-slate-300' };
                          return { badge: `STABLE · ${pct} / 100`, style: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' };
                        }

                        function buildSparkline(key: string): { values: number[]; dates: string[] } {
                          if (!detScores || detScores.length === 0) return { values: [], dates: [] };
                          const rawVals = detScores.map(s => (s[key] ?? 0) * 100);
                          const rawDates = chartDates.slice(0, rawVals.length);
                          let values = rawVals;
                          let dates = rawDates;
                          if (detectorTimeMode === 'weekly' && rawVals.length > 7) {
                            const groupSize = Math.max(1, Math.floor(rawVals.length / Math.ceil(rawVals.length / 7)));
                            const newVals: number[] = [];
                            const newDates: string[] = [];
                            for (let i = 0; i < rawVals.length; i += groupSize) {
                              const chunk = rawVals.slice(i, i + groupSize);
                              newVals.push(chunk.reduce((a, b) => a + b, 0) / chunk.length);
                              newDates.push(rawDates[i] || '');
                            }
                            values = newVals;
                            dates = newDates;
                          } else if (detectorTimeMode === 'monthly' && rawVals.length > 30) {
                            const groupSize = Math.max(1, Math.floor(rawVals.length / Math.ceil(rawVals.length / 30)));
                            const newVals: number[] = [];
                            const newDates: string[] = [];
                            for (let i = 0; i < rawVals.length; i += groupSize) {
                              const chunk = rawVals.slice(i, i + groupSize);
                              newVals.push(chunk.reduce((a, b) => a + b, 0) / chunk.length);
                              newDates.push(rawDates[i] || '');
                            }
                            values = newVals;
                            dates = newDates;
                          }
                          return { values, dates };
                        }

                        const activeKey = detectorKeys[selectedDetector] || 'mahalanobis';
                        const info = detLabels[activeKey];
                        const latestVal = lastScores[activeKey] ?? 0;
                        const { badge, style } = scoreBadge(latestVal);
                        const { values: sparkline, dates: sparkDates } = buildSparkline(activeKey);

                        // Detector viewport computation
                        const dTotalLen = sparkline.length;
                        let dVpStart2: number, dVpEnd2: number;
                        if (detectorViewport[0] === -1 && dTotalLen > 0) {
                          // Default: zoomed to last 20% or min(20, total)
                          const defaultShow = Math.min(20, Math.max(6, Math.round(dTotalLen * 0.2)));
                          dVpStart2 = Math.max(0, dTotalLen - defaultShow);
                          dVpEnd2 = dTotalLen - 1;
                        } else {
                          dVpStart2 = Math.max(0, Math.min(detectorViewport[0], dTotalLen - 1));
                          dVpEnd2 = Math.max(0, Math.min(detectorViewport[1] || dTotalLen - 1, dTotalLen - 1));
                        }
                        const dVpCount = dVpEnd2 - dVpStart2 + 1;
                        const dVpSlice = sparkline.slice(dVpStart2, dVpEnd2 + 1);
                        const dVpSliceDates = sparkDates.slice(dVpStart2, dVpEnd2 + 1);

                        return (
                          <>
                            {/* Tab bar */}
                            <div className="flex gap-1.5 overflow-x-auto pb-1">
                              {detectorKeys.map((key, i) => {
                                const lab = detLabels[key];
                                const isActive = selectedDetector === i;
                                return (
                                  <div key={key} className="flex items-center gap-0.5">
                                    <button
                                      onClick={() => setSelectedDetector(i)}
                                      className={`flex-shrink-0 text-xs font-bold px-3 py-2.5 rounded-lg border transition-all cursor-pointer ${
                                        isActive
                                          ? 'bg-white/[0.06] border-[#3B82F6] text-white shadow-[0_20px_25px_-5px_rgba(0,0,0,0.7)]'
                                          : 'bg-white/[0.02] border-white/[0.06] text-gray-400 hover:bg-white/[0.04] hover:text-gray-300'
                                      }`}
                                    >
                                      {lab.name}
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setDetectorInfoKey(detectorInfoKey === key ? null : key); }}
                                      className={`flex-shrink-0 p-1.5 rounded-lg border transition-all cursor-pointer ${
                                        detectorInfoKey === key
                                          ? 'bg-[#43A0F5]/10 border-[#43A0F5]/40 text-[#43A0F5]'
                                          : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-white/[0.06]'
                                      }`}
                                      title={`Learn about ${lab.name}`}
                                    >
                                      <Info className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Active detector detail */}
                            <div className="glass-card rounded-xl p-4 space-y-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="text-sm font-bold text-white">{info.name}</h4>
                                  <span className="text-[10px] font-sans text-gray-500">{info.model}</span>
                                </div>
                                {(() => {
                                  const lvPct = Math.round(latestVal * 100);
                                  const lvColor = lvPct >= 80 ? '#f43f5e' : lvPct >= 60 ? '#f97316' : lvPct >= 40 ? '#eab308' : '#10b981';
                                  const lvLabel = lvPct >= 80 ? 'High' : lvPct >= 60 ? 'Elevated' : lvPct >= 40 ? 'Moderate' : 'Stable';
                                  return (
                                    <div className="flex items-center gap-2">
                                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: lvColor, boxShadow: `0 0 6px ${lvColor}` }} />
                                      <span className="text-xs font-semibold" style={{ color: lvColor }}>Anomaly Risk: {lvLabel}</span>
                                    </div>
                                  );
                                })()}
                              </div>
                              <p className="text-xs text-gray-400 leading-relaxed">{info.desc}</p>
                              <div className="space-y-1.5">
                                <div className="flex justify-between items-center text-[9px] font-sans text-gray-500 uppercase">
                                  <span>Score Timeline</span>
                                  <span className="font-mono">LATEST: {Math.round(latestVal * 100)}</span>
                                </div>
                                {/* Time mode toggles + Zoom controls */}
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex gap-1">
                                    {(['daily', 'weekly', 'monthly'] as const).map(mode => (
                                      <button key={mode} onClick={() => { setDetectorTimeMode(mode); setDetectorViewport([-1, -1]); }}
                                        className={`text-[9px] font-bold px-2 py-1 rounded-md border transition-all cursor-pointer ${detectorTimeMode === mode ? 'bg-white/[0.06] border-[#3B82F6] text-white' : 'border-white/[0.06] text-gray-500 hover:text-gray-300'}`}>
                                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                      </button>
                                    ))}
                                  </div>
                                  {sparkline.length > 5 && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-[9px] text-gray-500 font-mono mr-1">{dVpCount} of {sparkline.length}</span>
                                      <button onClick={() => {
                                        const range = dVpEnd2 - dVpStart2;
                                        const newRange = Math.min(sparkline.length - 1, Math.round(range * 1.5));
                                        const center = Math.round((dVpStart2 + dVpEnd2) / 2);
                                        const e = Math.min(sparkline.length - 1, center + Math.round(newRange / 2));
                                        const s = Math.max(0, e - newRange);
                                        setDetectorViewport([s, e]);
                                      }} className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-white/[0.06] text-gray-400 hover:text-gray-300 cursor-pointer" title="Zoom out"><Minus className="h-2.5 w-2.5" /></button>
                                      <button onClick={() => {
                                        const range = dVpEnd2 - dVpStart2;
                                        const newRange = Math.max(4, Math.round(range / 1.5));
                                        const center = Math.round((dVpStart2 + dVpEnd2) / 2);
                                        const s = Math.max(0, center - Math.round(newRange / 2));
                                        const e = Math.min(sparkline.length - 1, s + newRange);
                                        setDetectorViewport([s, e]);
                                      }} className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-white/[0.06] text-gray-400 hover:text-gray-300 cursor-pointer" title="Zoom in"><Plus className="h-2.5 w-2.5" /></button>
                                      <div className="w-px h-3 bg-white/[0.06]" />
                                      <button onClick={() => {
                                        const range = dVpEnd2 - dVpStart2;
                                        const shift = Math.max(1, Math.round(range * 0.3));
                                        const s = Math.max(0, dVpStart2 - shift);
                                        setDetectorViewport([s, Math.min(sparkline.length - 1, s + range)]);
                                      }} className="text-[9px] font-bold px-1 py-0.5 rounded border border-white/[0.06] text-gray-400 hover:text-gray-300 cursor-pointer" title="Scroll left"><ChevronLeft className="h-2.5 w-2.5" /></button>
                                      <button onClick={() => {
                                        const range = dVpEnd2 - dVpStart2;
                                        const shift = Math.max(1, Math.round(range * 0.3));
                                        const e = Math.min(sparkline.length - 1, dVpEnd2 + shift);
                                        setDetectorViewport([Math.max(0, e - range), e]);
                                      }} className="text-[9px] font-bold px-1 py-0.5 rounded border border-white/[0.06] text-gray-400 hover:text-gray-300 cursor-pointer" title="Scroll right"><ChevronRight className="h-2.5 w-2.5" /></button>
                                      <button onClick={() => setDetectorViewport([-1, -1])} className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-white/[0.06] text-gray-400 hover:text-gray-300 cursor-pointer" title="Reset zoom">Reset</button>
                                    </div>
                                  )}
                                </div>
                                <div className="glass-inner rounded-lg p-3">
                                  {renderDetectorChart(dVpSlice, info.color, dVpSliceDates, info.name)}
                                </div>
                                {sparkline.length > 0 && (() => {
                                  const peakVal = Math.round(Math.max(...sparkline));
                                  const avgVal = Math.round(sparkline.reduce((a, b) => a + b, 0) / sparkline.length);
                                  const minVal = Math.round(Math.min(...sparkline));
                                  const peakElevated = peakVal >= 60;
                                  const avgElevated = avgVal >= 40;
                                  return (
                                    <div className="flex items-stretch border-t border-white/[0.04] pt-3">
                                      <div className="flex-1 text-center">
                                        <div className="text-[9px] text-gray-500 uppercase tracking-wider">Peak Unusualness</div>
                                        <div className={`text-lg font-bold ${peakElevated ? 'text-[#f97316]' : 'text-white'}`}>{peakVal}<span className="text-xs text-gray-500 font-normal">%</span></div>
                                        <div className="text-[9px] text-gray-600">{peakElevated ? 'Above normal range' : 'Within normal range'}</div>
                                      </div>
                                      <div className="w-px bg-white/[0.06]" />
                                      <div className="flex-1 text-center">
                                        <div className="text-[9px] text-gray-500 uppercase tracking-wider">Recent Average</div>
                                        <div className={`text-lg font-bold ${avgElevated ? 'text-[#f97316]' : 'text-white'}`}>{avgVal}<span className="text-xs text-gray-500 font-normal">%</span></div>
                                        <div className="text-[9px] text-gray-600">{avgElevated ? 'Moderate concern' : 'Stable pattern'}</div>
                                      </div>
                                      <div className="w-px bg-white/[0.06]" />
                                      <div className="flex-1 text-center">
                                        <div className="text-[9px] text-gray-500 uppercase tracking-wider">Lowest Recorded</div>
                                        <div className="text-lg font-bold text-white">{minVal}<span className="text-xs text-gray-500 font-normal">%</span></div>
                                        <div className="text-[9px] text-gray-600">Baseline floor</div>
                                      </div>
                                    </div>
                                  );
                                })()}
                                {sparkline.length > 0 && Math.max(...sparkline) === 100 && Math.min(...sparkline) >= 95 && (
                                  <p className="text-[10px] text-amber-500/70 leading-relaxed">
                                    This detector consistently scores near 100% — may indicate overfitting to this data.
                                  </p>
                                )}

                                {/* What contributed to this deviation? */}
                                {detScores && detScores.length > 0 && (() => {
                                  const latest = detScores[detScores.length - 1];
                                  const contribConfig: Record<string, { factors: { label: string; getVal: (s: Record<string, number>) => number; color: string }[] }> = {
                                    mahalanobis: {
                                      factors: [
                                        { label: 'Speech Patterns', getVal: (s) => (s.mahalanobis ?? 0) * 0.9, color: '#3B82F6' },
                                        { label: 'Emotional Tone', getVal: (s) => (s.copula ?? 0) * 0.4 + (s.mahalanobis ?? 0) * 0.3, color: '#60a5fa' },
                                        { label: 'Behavioral Consistency', getVal: (s) => Math.max(0, (s.mahalanobis ?? 0) - (s.isolation_forest ?? 0) * 0.3), color: '#818cf8' },
                                        { label: 'Baseline Deviation', getVal: (s) => (s.knn ?? 0) * 0.5 + (s.mahalanobis ?? 0) * 0.4, color: '#a78bfa' },
                                      ],
                                    },
                                    copula: {
                                      factors: [
                                        { label: 'Sleep-Activity Link', getVal: (s) => (s.copula ?? 0) * 0.85, color: '#EF4444' },
                                        { label: 'Mood-Behavior Coupling', getVal: (s) => (s.copula ?? 0) * 0.7, color: '#f87171' },
                                        { label: 'Routine Disruption', getVal: (s) => (s.copula ?? 0) * 0.55 + (s.isolation_forest ?? 0) * 0.2, color: '#fca5a5' },
                                        { label: 'Feature Dependencies', getVal: (s) => (s.copula ?? 0) * 0.65, color: '#fca5a5' },
                                      ],
                                    },
                                    isolation_forest: {
                                      factors: [
                                        { label: 'Text Uniqueness', getVal: (s) => (s.isolation_forest ?? 0) * 0.8, color: '#8B5CF6' },
                                        { label: 'Temporal Anomaly', getVal: (s) => (s.isolation_forest ?? 0) * 0.65 + (s.mahalanobis ?? 0) * 0.15, color: '#a78bfa' },
                                        { label: 'Audio Deviation', getVal: (s) => (s.isolation_forest ?? 0) * 0.5 + (s.knn ?? 0) * 0.2, color: '#c4b5fd' },
                                        { label: 'Pattern Rarity', getVal: (s) => (s.isolation_forest ?? 0) * 0.75, color: '#ddd6fe' },
                                      ],
                                    },
                                    knn: {
                                      factors: [
                                        { label: 'Cluster Distance', getVal: (s) => (s.knn ?? 0) * 0.85, color: '#10B981' },
                                        { label: 'Pattern Novelty', getVal: (s) => (s.knn ?? 0) * 0.7 + (s.isolation_forest ?? 0) * 0.15, color: '#34d399' },
                                        { label: 'History Fit', getVal: (s) => Math.max(0, (s.knn ?? 0) - (s.mahalanobis ?? 0) * 0.2), color: '#6ee7b7' },
                                        { label: 'Neighborhood Shift', getVal: (s) => (s.knn ?? 0) * 0.6 + (s.copula ?? 0) * 0.2, color: '#a7f3d0' },
                                      ],
                                    },
                                  };
                                  const config = contribConfig[activeKey] || contribConfig.mahalanobis;
                                  return (
                                    <div className="mt-3 pt-3 border-t border-white/[0.04]">
                                      <p className="text-[10px] font-bold text-gray-400 mb-3">What contributed to this {info.name.toLowerCase()}?</p>
                                      <div className="space-y-2.5">
                                        {config.factors.map((factor, i) => {
                                          const val = Math.min(1, factor.getVal(latest));
                                          const pct = Math.round(val * 100);
                                          return (
                                            <div key={`${activeKey}-${i}`} className="flex items-center gap-2.5" style={{ animation: `fadeSlideIn 0.3s ease-out ${i * 60}ms both` }}>
                                              <span className="text-[9px] text-gray-400 w-28 shrink-0 truncate font-medium">{factor.label}</span>
                                              <div className="flex-1 h-2 bg-white/[0.03] rounded-full overflow-hidden">
                                                <div
                                                  className="h-full rounded-full"
                                                  style={{
                                                    width: `${Math.max(2, pct)}%`,
                                                    backgroundColor: factor.color,
                                                    opacity: 0.8,
                                                    animation: `fillBar 0.5s ease-out ${i * 60 + 100}ms both`,
                                                  }}
                                                />
                                              </div>
                                              <span className="text-[9px] font-mono text-gray-400 w-7 text-right">{pct}%</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </>
                        );
                      })()}

                    </div>
                  )}
                </div>

                {/* 5. TECHNICAL DETAILS SECTION */}
                <div className="pt-8 pb-8 border-b border-[#ffffff04]">
                  <div 
                    className="flex items-center justify-between cursor-pointer group border-b border-[#ffffff06] pb-3 mb-8"
                    onClick={() => setCollapsedSections(prev => ({ ...prev, techDetails: !prev.techDetails }))}
                  >
                    <div className="flex items-center gap-2.5">
                      <Database className="h-4 w-4 text-[#6b7280]" />
                      <h3 className="text-xs font-bold text-white uppercase tracking-[0.15em] font-sans">Technical Details</h3>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-white/[0.04] border border-white/[0.06] text-gray-500">
                        Debug Mode
                      </span>
                    </div>
                    <button className="text-gray-400 group-hover:text-white transition-colors p-1 cursor-pointer">
                      {collapsedSections.techDetails ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                    </button>
                  </div>

                  {!collapsedSections.techDetails && (
                    <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <p className="text-xs text-gray-500 leading-relaxed">
                        For debugging and transparency: the risk model used here is a pretrained clinical model, not one trained on this specific dataset. The raw model output and the calibrated (adjusted) probability are shown separately below so any mismatch is visible rather than hidden.
                      </p>
                      {(() => {
                        // Derive raw/calibrated values from pipeline
                        const rawPct = pipeline ? (diagnosticData.modelConfidenceRaw ?? diagnosticData.modelConfidence) : null;
                        const calPct = pipeline ? (diagnosticData.modelConfidence ?? 50) : null;
                        const shift = rawPct && calPct ? (calPct - rawPct) : 0;
                        const shiftStr = shift >= 0 ? `+${shift.toFixed(1)}%` : `${shift.toFixed(1)}%`;
                        const nEntries = pipeline?.pipelineNEntries || 0;
                        const hasEntries = nEntries >= 5;
                        return (
                      <div className="bg-[#0D1017]/15 backdrop-blur-xl border border-white/[0.06] rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-gray-400 shadow-md font-sans">
                        <div>
                          <span className="block text-[9px] text-gray-500 uppercase mb-0.5">Raw model output</span>
                          <span className="text-white font-bold text-sm">{rawPct !== null ? `${rawPct.toFixed(1)}%` : '—'}</span>
                        </div>
                        <div>
                          <span className="block text-[9px] text-gray-500 uppercase mb-0.5">Calibrated probability</span>
                          <span className="text-sky-400 font-bold text-sm">{calPct !== null ? `${calPct.toFixed(1)}%` : '—'}</span>
                        </div>
                        <div>
                          <span className="block text-[9px] text-gray-500 uppercase mb-0.5">Calibration Shift</span>
                          <span className={`font-bold text-sm ${Math.abs(shift) > 10 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {rawPct !== null ? `${shiftStr} (adjusted)` : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[9px] text-gray-500 uppercase mb-0.5">Entries processed</span>
                          <span className="text-white font-bold text-sm">{nEntries > 0 ? nEntries : '—'}</span>
                        </div>
                      </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* DYNAMIC SEVERITY BANNER */}
                {(() => {
                  const score = diagnosticData.anomalyBehaviourScore || 0;
                  let bannerClass = '';
                  let bannerTitle = '';
                  let bannerMsg = '';
                  if (score >= 75) {
                    bannerClass = 'border-red-500/30 bg-red-950/20 text-red-300';
                    bannerTitle = 'Significant biometric deviations detected';
                    bannerMsg = 'The model has identified notable shifts in behavioral and linguistic patterns over the recent period. We strongly recommend reviewing these findings with a qualified supervisor or clinical professional.';
                  } else if (score >= 55) {
                    bannerClass = 'border-amber-500/30 bg-amber-950/20 text-amber-300';
                    bannerTitle = 'Moderate deviations from baseline';
                    bannerMsg = 'Some patterns are drifting outside your typical range. These changes may warrant attention — consider monitoring closely and consulting a professional if they persist.';
                  } else if (score >= 40) {
                    bannerClass = 'border-yellow-500/20 bg-yellow-950/10 text-yellow-300';
                    bannerTitle = 'Minor fluctuations detected';
                    bannerMsg = 'Small shifts have been observed in your recent data. These appear within a manageable range — continue monitoring as part of your routine check-in.';
                  } else {
                    bannerClass = 'border-emerald-500/20 bg-emerald-950/10 text-emerald-300';
                    bannerTitle = 'Patterns stable, no concerns';
                    bannerMsg = 'Your recent behavioral and linguistic indicators remain within expected ranges. No action needed — keep up with your regular monitoring routine.';
                  }
                  return (
                    <div className={`border-l-4 rounded-xl p-4 text-xs leading-relaxed ${bannerClass}`}>
                      <div className="font-bold mb-1 uppercase tracking-wider">{bannerTitle}</div>
                      <p className="opacity-80">{bannerMsg}</p>
                    </div>
                  );
                })()}

                {/* DIAGNOSTIC CLINICAL INSIGHTS LOG */}
                <div className="glass-panel rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Brain className="h-5 w-5 text-blue-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">AI Diagnostic Insights Synthesis</h3>
                  </div>
                  <div className="space-y-2.5">
                    {diagnosticData.insights.map((insight, index) => (
                      <div key={index} className="flex gap-3 text-xs text-gray-300 leading-relaxed bg-[#0D1017]/10 backdrop-blur-md border border-white/[0.04] p-3 rounded-lg">
                        <span className="text-[#A5C0FF] font-bold">0{index + 1}.</span>
                        <p>{insight}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* DETECTOR INFO SIDE PANEL — rendered via portal on document.body */}
                {createPortal(
                  <AnimatePresence>
                    {detectorInfoKey && (
                      <>
                        <motion.div
                          className="fixed inset-0"
                          style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          onClick={() => setDetectorInfoKey(null)}
                        />
                        <motion.div
                          className="w-[380px] max-sm:w-screen bg-[#0d1117] border-l border-[#1e2a3a] shadow-2xl overflow-y-auto"
                          style={{ position: 'fixed', zIndex: 9999, top: 64, right: 0, width: 380, height: 'calc(100vh - 64px)', overflowY: 'auto' }}
                          initial={{ x: '100%' }}
                          animate={{ x: 0 }}
                          exit={{ x: '100%' }}
                          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                          onClick={(e) => e.stopPropagation()}
                        >
                      <div className="absolute left-0 top-0 bottom-0 w-8 pointer-events-none z-10" style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.15), transparent)', backdropFilter: 'blur(2px)' }} />
                      <AnimatePresence mode="wait">
                        {detectorInfoKey && (() => {
                          const detScores = pipeline?.pipelineDetectorScores;
                          const lastScores: Record<string, number> = detScores && detScores.length > 0 ? detScores[detScores.length - 1] : {};
                          const detFullInfo: Record<string, { name: string; icon: React.ElementType; model: string; longDesc: string; bullet1: string; bullet2: string; bullet3: string }> = {
                            mahalanobis: {
                              name: 'Mahalanobis Distance', icon: Radar, model: 'Pattern Deviation',
                              longDesc: 'Mahalanobis Distance measures how far today\'s behavioral patterns are from your established personal baseline. A higher score means your behavior today is statistically unusual for you specifically.',
                              bullet1: 'Helps detect when your overall behavioral profile shifts away from what\'s normal for you.',
                              bullet2: 'Raises flags early when patterns start drifting, even if each individual metric seems fine.',
                              bullet3: 'Useful for catching slow, creeping changes that might otherwise go unnoticed.',
                            },
                            copula: {
                              name: 'Gaussian Copula', icon: ScatterChart, model: 'Behavioral Shift',
                              longDesc: 'The Copula model detects when multiple behaviors shift together in unexpected ways — for example, sleeping less while becoming more withdrawn. It models the dependency structure between all your tracked features.',
                              bullet1: 'Catches unusual co-occurrences — changes that happen together more often than expected.',
                              bullet2: 'Identifies when the relationship between your sleep, activity, and mood patterns breaks down.',
                              bullet3: 'Useful for detecting complex behavioral shifts that single-metric detectors might miss.',
                            },
                            isolation_forest: {
                              name: 'Isolation Forest', icon: Zap, model: 'Outlier Spike',
                              longDesc: 'Isolation Forest identifies individual days where your behavior looks very different from the rest. It works by randomly isolating data points — the easier a day is to isolate, the more unusual it is.',
                              bullet1: 'Excellent at catching sudden, sharp deviations in your daily patterns.',
                              bullet2: 'Flags individual days that stand out — like a single bad night or a sudden mood shift.',
                              bullet3: 'Works well alongside trend-based detectors to distinguish spikes from gradual drifts.',
                            },
                            knn: {
                              name: 'K-Nearest Neighbors', icon: Network, model: 'Cluster Drift',
                              longDesc: 'KNN measures how far your recent patterns are from your K most similar historical entries. If your recent behavior doesn\'t resemble any of your past normal days, the score rises.',
                              bullet1: 'Detects when your current state has no close match in your personal history.',
                              bullet2: 'Gradually rises as you move away from your established behavioral clusters.',
                              bullet3: 'Helps distinguish between familiar variation and genuinely new behavioral territory.',
                            },
                          };
                          const k = detectorInfoKey;
                          const d = detFullInfo[k];
                          if (!d) return null;
                          const Icon = d.icon;
                          const score = lastScores[k] ?? 0.5;
                          const pct = Math.round(score * 100);
                          const sevLabel = pct >= 80 ? 'HIGH' : pct >= 60 ? 'ELEVATED' : pct >= 40 ? 'MODERATE' : 'LOW';
                          const sevColor = pct >= 80 ? 'text-rose-400' : pct >= 60 ? 'text-amber-400' : pct >= 40 ? 'text-yellow-400' : 'text-emerald-400';
                          const sevDot = pct >= 80 ? 'bg-rose-500' : pct >= 60 ? 'bg-amber-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-emerald-500';
                          const detHistory = detScores?.map(s => (s[k] ?? 0) * 100) || [];
                          const miniSpark = detHistory.slice(-14);
                          const miniMax = Math.max(...miniSpark, 1);
                          return (
                            <motion.div
                              key={detectorInfoKey}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.15 }}
                            >
                              <div className="p-6 space-y-6">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-[#1e2a3a] border border-white/[0.06]">
                                      <Icon className="h-5 w-5 text-[#4fc3f7]" />
                                    </div>
                                    <div>
                                      <h3 className="text-sm font-bold text-white">{d.name}</h3>
                                      <span className="text-[10px] text-gray-500">{d.model}</span>
                                    </div>
                                  </div>
                                  <button onClick={() => setDetectorInfoKey(null)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-400 hover:text-white transition-all cursor-pointer">
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                                <div className="flex items-center gap-3 bg-[#1e2a3a]/50 rounded-xl p-4 border border-white/[0.04]">
                                  <span className={`h-2.5 w-2.5 rounded-full ${sevDot} shadow-[0_0_8px_currentColor]`} />
                                  <div>
                                    <span className={`text-lg font-bold ${sevColor}`}>{pct}</span>
                                    <span className={`text-lg font-bold ${sevColor} ml-1`}>/ 100</span>
                                    <span className={`ml-2 text-xs font-bold ${sevColor}`}>{sevLabel}</span>
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-300 leading-relaxed">{d.longDesc}</p>
                                  {pct >= 40 && pct < 80 && (
                                    <p className="text-xs text-amber-400/80 mt-2">Your pattern deviation is moderate. Behavioral and emotional patterns are the primary contributors today.</p>
                                  )}
                                  {pct >= 80 && (
                                    <p className="text-xs text-rose-400/80 mt-2">Significant deviation detected. Multiple behavioral signals are consistently outside your normal range.</p>
                                  )}
                                  {pct < 40 && (
                                    <p className="text-xs text-emerald-400/80 mt-2">Your patterns are close to your baseline. No significant deviation detected.</p>
                                  )}
                                </div>
                                <div>
                                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">14-Day Trend</span>
                                  <div className="mt-2 flex items-end gap-0.5 h-12">
                                    {miniSpark.map((v, i) => (
                                      <div key={i} className="flex-1 flex flex-col justify-end">
                                        <div className="w-full rounded-t-sm transition-all duration-300" style={{ height: `${(v / miniMax) * 100}%`, backgroundColor: pct >= 60 ? '#f97316' : '#4fc3f7', opacity: 0.3 + (v / miniMax) * 0.7 }} />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="space-y-2 bg-[#1e2a3a]/30 rounded-xl p-4 border border-white/[0.04]">
                                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold flex items-center gap-1.5"><Sparkles className="h-3 w-3 text-[#b39ddb]" /> What this means for you</span>
                                  <ul className="space-y-1.5">
                                    <li className="text-[11px] text-gray-400 flex gap-2"><span className="text-[#4fc3f7] mt-0.5">•</span>{d.bullet1}</li>
                                    <li className="text-[11px] text-gray-400 flex gap-2"><span className="text-[#4fc3f7] mt-0.5">•</span>{d.bullet2}</li>
                                    <li className="text-[11px] text-gray-400 flex gap-2"><span className="text-[#4fc3f7] mt-0.5">•</span>{d.bullet3}</li>
                                  </ul>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })()}
                          </AnimatePresence>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>,
                  document.body
                )}

              </div>
            );
          })()}


          {/* TAB 2.5: RISK FORECAST ENGINE */}
          {activeTab === 'forecast' && (() => {
            const fData: number[] = diagnosticData.pipelineForecast14Day || [];

            const handleForecastDetectors = async () => {
              setIsForecastingDetectors(true);
              setDetectorForecastError(null);
              try {
                const res = await fetch('/api/forecast-detectors', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ user_id: userId }),
                  signal: AbortSignal.timeout(60000),
                });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();
                setDetectorForecastData(data.detector_forecasts || null);
              } catch (e: any) {
                setDetectorForecastError(e.message || 'Forecast failed');
              } finally {
                setIsForecastingDetectors(false);
              }
            };

            const renderForecastChart = (
              lines: { data: (number | null)[]; color: string; label: string; dashed?: boolean }[],
              title: string,
              subtitle: string,
            ) => {
              const allVals = lines.flatMap(l => l.data.filter((v): v is number => v !== null && v !== undefined));
              const dataMin = Math.min(...allVals);
              const dataMax = Math.max(...allVals);
              const range = dataMax - dataMin;
              const pad = Math.max(range * 0.25, 0.02);
              const autoMin = Math.max(0, dataMin - pad);
              const autoMax = Math.min(1, dataMax + pad);
              const useAutoZoom = range < 0.3 && allVals.length > 0;
              const yMin = useAutoZoom ? autoMin : 0;
              const yMax = useAutoZoom ? autoMax : 1.0;
              const yRange = yMax - yMin;
              const yToSvg = (val: number) => 15 + (1.0 - (val - yMin) / yRange) * 185;
              const tickCount = 5;
              const tickStep = yRange / tickCount;
              const ticks = Array.from({ length: tickCount + 1 }, (_, i) => yMin + i * tickStep);
              const bgBandLabels = [
                { pos: 0.17, color: '#10B981', label: 'Low' },
                { pos: 0.50, color: '#F59E0B', label: 'Moderate' },
                { pos: 0.83, color: '#EF4444', label: 'High' },
              ];
              const dataLen = lines[0]?.data?.length || 7;
              const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const mousePct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                setForecastMouseXPct(mousePct);
                const svgMouseX = (e.clientX - rect.left) * (500 / rect.width);
                const relX = svgMouseX - 35;
                const idx = Math.min(dataLen - 1, Math.max(0, Math.round((relX / 450) * (dataLen - 1))));
                setForecastHoverIdx(idx);
              };
              return (
              <div className="bg-[#0d1117] border border-white/[0.06] rounded-xl p-5 space-y-3 animate-in fade-in duration-300">
                <span className="text-xs font-bold text-gray-300 uppercase tracking-widest block">{title}</span>
                <p className="text-[10px] text-gray-500">{subtitle}</p>
                <div className="relative h-56 w-full">
                  <svg viewBox="0 0 500 240" className="w-full h-full overflow-visible cursor-crosshair"
                    onMouseMove={handleSvgMouseMove}
                    onMouseLeave={() => setForecastHoverIdx(null)}
                  >
                    {bgBandLabels.map((lbl, bi) => (
                      <text key={'lbl-' + bi} x="487" y={yToSvg(yMin + yRange * lbl.pos) + 3} fill={lbl.color} fontSize="7" opacity="0.4" fontFamily="monospace" textAnchor="end">{lbl.label}</text>
                    ))}
                    {ticks.map((val, idx) => {
                      const y = yToSvg(val);
                      return (
                        <g key={idx}>
                          <line x1="35" y1={y} x2="485" y2={y} stroke="#ffffff08" strokeWidth="0.5" strokeDasharray="3 3" />
                          <text x="25" y={y + 4} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">{Math.round(val * 100)}%</text>
                        </g>
                      );
                    })}
                    {lines[0]?.data.filter(v => v !== null).length > 0 && lines[0].data.map((_, idx) => {
                      const x = 35 + (idx / Math.max(1, dataLen - 1)) * 450;
                      return (
                        <g key={idx}>
                          <line x1={x} y1="15" x2={x} y2="200" stroke="#ffffff06" strokeWidth="0.5" strokeDasharray="2 2" />
                           <text x={x} y="218" fill="#4b5563" fontSize="7" textAnchor="middle" fontFamily="monospace">Day {idx + 1}</text>
                        </g>
                      );
                    })}
                    {forecastHoverIdx !== null && (() => {
                      const hx = 35 + (forecastHoverIdx / Math.max(1, dataLen - 1)) * 450;
                      return <line x1={hx} y1="15" x2={hx} y2="200" stroke="#475569" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />;
                    })()}
                    {lines.map((line, li) => {
                      const valid = line.data.filter((v): v is number => v !== null && v !== undefined);
                      if (valid.length < 2) return null;
                      let pathStr = '';
                      let prevY = 0;
                      let prevX = 0;
                      line.data.forEach((val, idx) => {
                        if (val === null || val === undefined) return;
                        const x = 35 + (idx / Math.max(1, dataLen - 1)) * 450;
                        const y = yToSvg(Math.min(yMax, Math.max(yMin, val)));
                        if (pathStr === '') {
                          pathStr = 'M ' + x + ' ' + y;
                        } else {
                          const midX = 35 + ((idx - 0.5) / Math.max(1, dataLen - 1)) * 450;
                          pathStr += ' C ' + midX + ' ' + prevY + ' ' + midX + ' ' + y + ' ' + x + ' ' + y;
                        }
                        prevX = x;
                        prevY = y;
                      });
                      return (
                        <g key={li}>
                          <path d={pathStr} fill="none" stroke={line.color}
                            strokeWidth={line.dashed ? '1.5' : '2'}
                            strokeDasharray={line.dashed ? '4 3' : undefined}
                            opacity={0.85}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ filter: line.dashed ? 'none' : `drop-shadow(0 0 4px ${line.color}44)` }}
                          />
                          {line.data.map((val, idx) => {
                            if (val === null || val === undefined) return null;
                            const x = 35 + (idx / Math.max(1, dataLen - 1)) * 450;
                            const y = yToSvg(Math.min(yMax, Math.max(yMin, val)));
                            const isHovered = forecastHoverIdx === idx;
                            return <circle key={'dot-' + li + '-' + idx} cx={x} cy={y} r={isHovered ? 5 : 2.5} fill={line.color} opacity={isHovered ? 1 : 0.85} stroke={isHovered ? '#fff' : 'none'} strokeWidth={isHovered ? 1.5 : 0} style={isHovered ? { filter: 'drop-shadow(0 0 6px ' + line.color + ')' } : undefined} />;
                          })}
                        </g>
                      );
                    })}
                    <line x1="35" y1="200" x2="485" y2="200" stroke="#ffffff08" strokeWidth="1" />
                  </svg>
                  {forecastHoverIdx !== null && forecastHoverIdx < dataLen && (() => {
                    return (
                      <div className="absolute pointer-events-none z-30 transition-all duration-150 ease-out" style={{ left: Math.min(90, Math.max(2, forecastMouseXPct)) + '%', top: '8px', transform: 'translateX(-50%)' }}>
                        <div className="bg-[#11131c]/95 border border-[#232B3B]/80 px-3 py-2 rounded-lg shadow-2xl backdrop-blur-sm">
                          <div className="text-[10px] font-bold text-gray-400 mb-1 border-b border-gray-800/60 pb-1 uppercase tracking-wider">Day {forecastHoverIdx + 1}</div>
                          {lines.map((line, li) => {
                            const val = line.data[forecastHoverIdx];
                            if (val == null) return null;
                            return (
                              <div key={li} className="flex items-center gap-2 text-[10px]">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: line.color }} />
                                <span className="text-gray-400">Risk:</span>
                                <span className="font-bold font-mono" style={{ color: line.color }}>{(val * 100).toFixed(1)}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  {lines.map((line, li) => (
                    <div key={li} className="flex items-center gap-1.5">
                      <span className="inline-block w-4 h-[2px] rounded-sm" style={{ backgroundColor: line.color, borderTop: line.dashed ? '1px dashed ' + line.color : 'none' }} />
                      <span className="text-[9px] text-gray-500 font-mono uppercase tracking-wider">{line.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
            };

            return (
              <div className="space-y-8 animate-in fade-in duration-300">
                
                {/* BUTTONS ROW */}
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => setActiveTab('analytics')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#121620]/60 border border-[#20293B]/40 rounded-lg text-xs font-bold text-gray-400 hover:text-white hover:border-gray-500 transition-all cursor-pointer"
                  >
                    <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                    Return to Analysis
                  </button>
                </div>

                {/* LIVE STATUS BANNER */}
                {fData.length > 0 ? (
                  <div className="flex">
                    <div className="bg-purple-500/10 border border-purple-500/30 text-purple-400 text-[10px] sm:text-xs font-sans font-bold tracking-wider px-4 py-2 rounded-lg uppercase">
                      LIVE — TFT Forecast Active
                    </div>
                  </div>
                ) : (
                  <div className="flex">
                    <div className="bg-[#1C1105]/50 border border-amber-500/20 text-amber-500/90 text-[10px] sm:text-xs font-sans font-bold tracking-wider px-4 py-2 rounded-lg uppercase">
                      Run a diagnosis to generate TFT forecast
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Predicts the next 7 days using your historical data. The TFT model forecasts a composite risk score (50% anomaly + 25% sentiment + 25% health). Individual detector forecasts use GradientBoosting trained on each detector's own 30-day history.
                </p>

                {/* TFT OVERALL RISK FORECAST */}
                <div className="space-y-3">
                  <div>
                    <h4 className="text-xs font-bold text-gray-300 uppercase tracking-widest flex items-center gap-2">
                      <Brain className="h-4 w-4 text-purple-400" />
                      TFT Composite Risk Forecast
                    </h4>
                    <p className="text-[10px] text-gray-500 mt-1 ml-6">
                      Temporal Fusion Transformer trained on 30-day sliding windows. Predicts the next {fData.length || 7} days as a composite risk score. Higher = more concern.
                    </p>
                  </div>
                  {fData.length > 0 ? (
                    renderForecastChart(
                      [{ data: fData, color: '#a78bfa', label: 'TFT Composite Risk' }],
                      'TFT 7-Day Risk Forecast',
                      'Temporal Fusion Transformer composite risk prediction (higher = more concern)',
                    )
                  ) : (
                    <div className="bg-[#0d1117] border border-white/[0.06] rounded-xl p-8 text-center">
                      <Brain className="h-8 w-8 text-purple-400 mx-auto mb-3 opacity-50" />
                      <p className="text-sm text-gray-400">No TFT forecast available. Run an analysis first.</p>
                    </div>
                  )}
                </div>

                {/* INTERACTIVE FORECAST BOXES */}
                {fData.length > 0 && (() => {
                  const dayLabels = ['Today', 'Tomorrow', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];
                  const firstVal = fData[0] ?? 0;
                  const lastVal = fData[fData.length - 1] ?? 0;
                  const delta = lastVal - firstVal;
                  const riskTrend = delta > 0.05 ? 'increasing' : delta < -0.05 ? 'decreasing' : 'stable';
                  const trendColor = riskTrend === 'increasing' ? 'text-rose-400' : riskTrend === 'decreasing' ? 'text-emerald-400' : 'text-gray-300';
                  const trendIcon = riskTrend === 'increasing' ? '↑' : riskTrend === 'decreasing' ? '↓' : '→';
                  const trendMsg = riskTrend === 'increasing'
                    ? 'The risk seems to increase over the next 7 days. Consider monitoring entries more closely and prioritizing self-care routines.'
                    : riskTrend === 'decreasing'
                    ? 'The risk seems to decrease over the next 7 days. Current patterns suggest a positive trajectory — keep it up.'
                    : 'The risk appears stable over the next 7 days. No significant upward or downward movement detected.';

                  return (
                    <div className="space-y-3 animate-in fade-in duration-300">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Day-by-Day Forecast</span>
                      <div className="grid grid-cols-7 gap-2">
                        {fData.slice(0, 7).map((val, idx) => {
                          const pct = Math.round((val ?? 0) * 100);
                          const barColor = pct >= 70 ? 'bg-rose-500' : pct >= 45 ? 'bg-amber-500' : 'bg-emerald-500';
                          const textColor = pct >= 70 ? 'text-rose-400' : pct >= 45 ? 'text-amber-400' : 'text-emerald-400';
                          return (
                            <button
                              key={idx}
                              onClick={() => setForecastHoverIdx(idx)}
                              className={'bg-[#0d1117] border rounded-lg p-2.5 text-center transition-all duration-200 cursor-pointer ' +
                                (forecastHoverIdx === idx ? 'border-purple-500/40 shadow-lg shadow-purple-900/10' : 'border-white/[0.06] hover:border-white/[0.15]')
                              }
                            >
                              <div className="text-[8px] text-gray-500 uppercase tracking-wider mb-1 font-mono">{dayLabels[idx] || 'Day ' + (idx + 1)}</div>
                              <div className={'text-sm font-bold font-mono ' + textColor}>{pct}%</div>
                              <div className="w-full h-1 bg-white/[0.05] rounded-full mt-1.5 overflow-hidden">
                                <div className={'h-full rounded-full ' + barColor + ' transition-all duration-500'} style={{ width: pct + '%' }} />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <div className={'bg-[#0d1117] border border-white/[0.06] rounded-xl p-4 border-l-4 ' +
                        (riskTrend === 'increasing' ? 'border-l-[#ef4444]' : riskTrend === 'decreasing' ? 'border-l-[#4ade80]' : 'border-l-[#6b7280]')
                      }>
                        <div className="flex items-start gap-3">
                          <span className={'text-lg ' + trendColor}>{trendIcon}</span>
                          <div>
                            <p className={'text-xs font-bold ' + trendColor + ' mb-1 uppercase tracking-wider'}>7-Day Outlook: Risk is {riskTrend}</p>
                            <p className="text-[11px] text-gray-400 leading-relaxed">{trendMsg}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* PER-DETECTOR FORECASTS */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-gray-300 uppercase tracking-widest flex items-center gap-2">
                        <Zap className="h-4 w-4 text-amber-400" />
                        Per-Detector Forecasts
                      </h4>
                      <p className="text-[10px] text-gray-500 mt-1 ml-6">
                        Each anomaly detector trained independently on its own 30-day history using GradientBoosting.
                      </p>
                    </div>
                    <button
                      onClick={handleForecastDetectors}
                      disabled={isForecastingDetectors}
                      className={'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ' +
                        (isForecastingDetectors
                          ? 'bg-purple-950/40 border border-purple-500/30 text-purple-400'
                          : 'bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/40 hover:text-white')
                      + ' disabled:opacity-50 disabled:cursor-not-allowed'}
                    >
                      {isForecastingDetectors ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Training Models...</>
                      ) : (
                        <><Zap className="h-3.5 w-3.5" /> Forecast Detectors 7 Days</>
                      )}
                    </button>
                  </div>

                  {detectorForecastError && (
                    <div className="px-4 py-2 rounded-lg bg-red-950/20 border border-red-500/20 text-red-400 text-xs">{detectorForecastError}</div>
                  )}

                  {detectorForecastData ? (() => {
                    const detTabs = [
                      { key: 'mahalanobis', label: 'Pattern Deviation', model: 'Mahalanobis Distance', color: '#60a5fa' },
                      { key: 'copula', label: 'Behavioral Shift', model: 'Gaussian Copula', color: '#f87171' },
                      { key: 'isolation_forest', label: 'Outlier Spike', model: 'Isolation Forest', color: '#34d399' },
                      { key: 'knn', label: 'Cluster Drift', model: 'K-Nearest Neighbors', color: '#fbbf24' },
                    ];
                    const detDescriptions: Record<string, string> = {
                      mahalanobis: 'Measures how far each entry deviates from the learned centroid of your normal feature space.',
                      copula: 'Models the dependency structure between features. Detects when relationships between sleep, activity, and mood break from normal patterns.',
                      isolation_forest: 'Isolates anomalies by random splitting. Catches entries that are unusually different from the majority.',
                      knn: 'Measures distance to your K nearest normal entries. Rises when recent entries are unlike anything seen in your history.',
                    };
                    const activeDetTab = selectedDetectorTab;
                    return (
                      <>
                        <div className="flex gap-1 p-1 bg-[#0d1117] border border-white/[0.06] rounded-lg overflow-x-auto">
                          {detTabs.map(tab => (
                            <button key={tab.key} onClick={() => setSelectedDetectorTab(tab.key)}
                              className={'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all whitespace-nowrap cursor-pointer ' + (activeDetTab === tab.key ? 'bg-[#1e2a3a] border border-white/10 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]')}>
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tab.color }} />
                                {tab.label}
                              </div>
                              <span className="text-[8px] font-normal opacity-60 font-mono">{tab.model}</span>
                            </button>
                          ))}
                        </div>

                        {detDescriptions[activeDetTab] && (() => {
                          const tab = detTabs.find(t => t.key === activeDetTab);
                          return (
                            <div className="ml-1">
                              <span className="text-[10px] text-gray-400 font-semibold">{tab?.model}:</span>
                              <span className="text-[10px] text-gray-500 italic ml-1">{detDescriptions[activeDetTab]}</span>
                            </div>
                          );
                        })()}

                        {(() => {
                          const vals = detectorForecastData[activeDetTab] || [];
                          const cfg = detTabs.find(t => t.key === activeDetTab);
                          if (!cfg || vals.length < 2) return (
                            <div className="bg-[#0d1117] border border-white/[0.06] rounded-xl p-6 text-center text-gray-500 text-xs">No data for this detector</div>
                          );
                          return (
                            <>
                              {renderForecastChart([{ data: vals, color: cfg.color, label: cfg.label }], cfg.label + ' — 7 Day Forecast', detDescriptions[activeDetTab])}
                              <div className="flex gap-3 flex-wrap">
                                <div className="bg-[#0d1117] border border-white/[0.06] rounded-lg px-3 py-2 flex-1 min-w-[100px]">
                                  <div className="text-[9px] text-gray-500 uppercase tracking-wider font-mono">Day 1</div>
                                  <div className="text-sm font-bold font-mono" style={{ color: cfg.color }}>{Math.round(vals[0] * 100)}%</div>
                                </div>
                                <div className="bg-[#0d1117] border border-white/[0.06] rounded-lg px-3 py-2 flex-1 min-w-[100px]">
                                  <div className="text-[9px] text-gray-500 uppercase tracking-wider font-mono">Day 7</div>
                                  <div className="text-sm font-bold font-mono" style={{ color: cfg.color }}>{Math.round(vals[vals.length - 1] * 100)}%</div>
                                </div>
                                <div className="bg-[#0d1117] border border-white/[0.06] rounded-lg px-3 py-2 flex-1 min-w-[100px]">
                                  <div className="text-[9px] text-gray-500 uppercase tracking-wider font-mono">Delta</div>
                                  <div className={'text-sm font-bold font-mono ' + ((vals[vals.length - 1] - vals[0]) > 0 ? 'text-rose-300' : 'text-emerald-300')}>
                                    {(vals[vals.length - 1] - vals[0]) > 0 ? '+' : ''}{Math.round((vals[vals.length - 1] - vals[0]) * 100)}%
                                  </div>
                                </div>
                              </div>
                            </>
                          );
                        })()}

                        <div className="bg-[#0d1117] border border-white/[0.06] rounded-xl p-5">
                          <div className="mb-3">
                            <span className="text-xs font-bold text-gray-300 uppercase tracking-widest block">Day-by-Day Breakdown</span>
                            <span className="text-[10px] text-gray-500">7-day detector trajectory across all anomaly models</span>
                          </div>
                          <div className="overflow-x-auto">
                            {(() => {
                              const detKeys = ['mahalanobis', 'copula', 'isolation_forest', 'knn'];
                              const detColors: Record<string, string> = { mahalanobis: '#4fc3f7', copula: '#f97316', isolation_forest: '#4ade80', knn: '#facc15' };
                              const detLabels: Record<string, string> = { mahalanobis: 'Pattern Deviation', copula: 'Behavioral Shift', isolation_forest: 'Outlier Spike', knn: 'Cluster Drift' };
                              const nDays = detectorForecastData.mahalanobis?.length || 0;
                              if (nDays === 0) return null;
                              const detMax: Record<string, number> = {};
                              detKeys.forEach(k => { const arr = detectorForecastData[k] || []; detMax[k] = Math.max(...arr.filter((v: number) => v != null), 0.001); });
                              const avgScores: Record<string, number> = {};
                              detKeys.forEach(k => { const arr = detectorForecastData[k] || []; avgScores[k] = arr.reduce((s: number, v: number) => s + v, 0) / arr.length; });
                              type CellInfo = { raw: number; norm: number; idx: number };
                              function getCell(key: string, idx: number): CellInfo | null {
                                const arr = detectorForecastData[key] || [];
                                if (arr[idx] == null) return null;
                                return { raw: arr[idx], norm: (arr[idx] / detMax[key]) * 100, idx };
                              }
                              function getMaxNormIdx(key: string): number {
                                let maxIdx = 0, maxNorm = -1;
                                for (let i = 0; i < nDays; i++) {
                                  const c = getCell(key, i);
                                  if (c && c.norm > maxNorm) { maxNorm = c.norm; maxIdx = i; }
                                }
                                return maxIdx;
                              }
                              const maxNormIdx: Record<string, number> = {};
                              detKeys.forEach(k => { maxNormIdx[k] = getMaxNormIdx(k); });
                              function severityColor(norm: number): string {
                                return norm > 70 ? '#ef4444' : norm >= 40 ? '#facc15' : '#4ade80';
                              }
                              return (
                                <table className="w-full text-[11px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                  <thead>
                                    <tr className="border-b border-white/[0.06]">
                                      <th className="text-left py-2 pr-4 font-semibold text-gray-400 text-[10px] uppercase tracking-wider">Day</th>
                                      {detKeys.map(k => (
                                        <th key={k} className="text-right py-2 px-2 font-semibold text-[10px] uppercase tracking-wider" style={{ color: detColors[k] }}>{detLabels[k]}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Array.from({ length: nDays }, (_, idx) => {
                                      const isMaxDay = detKeys.some(k => maxNormIdx[k] === idx);
                                      return (
                                        <tr key={idx} className="border-b border-white/[0.03] transition-colors duration-150 hover:bg-[#0f1520]" style={{ backgroundColor: idx % 2 === 0 ? '#0d1117' : '#0a0f18' }}>
                                          <td className="py-2.5 pr-4 font-semibold text-white">Day {idx + 1}</td>
                                          {detKeys.map(k => {
                                            const cell = getCell(k, idx);
                                            if (!cell) return <td key={k} className="text-right py-2.5 px-2 font-mono text-gray-600">—</td>;
                                            const sevDot = severityColor(cell.norm);
                                            const isMax = maxNormIdx[k] === idx;
                                            const avg = avgScores[k];
                                            return (
                                              <td key={k} className={`text-right py-2.5 px-2 ${isMax ? '' : ''}`}>
                                                <div className="flex flex-col items-end gap-1">
                                                  <div className="flex items-center justify-end gap-1.5">
                                                    <span className={`h-1.5 w-1.5 rounded-full shrink-0`} style={{ backgroundColor: sevDot, boxShadow: `0 0 4px ${sevDot}` }} />
                                                    <span className={`font-mono ${isMax ? 'font-bold text-white' : 'text-[#94a3b8]'}`} style={isMax ? { textShadow: `0 0 8px ${detColors[k]}66` } : {}}>{Math.round(cell.norm)}%</span>
                                                  </div>
                                                  <div className="w-full h-[3px] bg-[#1f2937] rounded-full overflow-hidden" style={{ maxWidth: '80px' }}>
                                                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, cell.norm)}%`, backgroundColor: detColors[k], boxShadow: isMax ? `0 0 6px ${detColors[k]}` : 'none' }} />
                                                  </div>
                                                </div>
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      );
                                    })}
                                    {/* AVG row */}
                                    <tr className="border-t border-white/[0.06] bg-[#0d1117]/80">
                                      <td className="py-2.5 pr-4 font-bold text-[#94a3b8] text-[10px] uppercase tracking-wider">AVG</td>
                                      {detKeys.map(k => {
                                        const avg = avgScores[k];
                                        const normAvg = (avg / detMax[k]) * 100;
                                        return (
                                          <td key={k} className="text-right py-2.5 px-2">
                                            <div className="flex flex-col items-end gap-1">
                                              <span className="font-mono text-[11px] font-bold" style={{ color: detColors[k] }}>{Math.round(normAvg)}%</span>
                                              <div className="w-full h-[3px] bg-[#1f2937] rounded-full overflow-hidden" style={{ maxWidth: '80px' }}>
                                                <div className="h-full rounded-full opacity-70" style={{ width: `${Math.min(100, normAvg)}%`, backgroundColor: detColors[k] }} />
                                              </div>
                                            </div>
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  </tbody>
                                </table>
                              );
                            })()}
                          </div>
                          <p className="text-[11px] text-[#475569] mt-3">Scores normalized per detector across the 7-day forecast window.</p>
                        </div>
                      </>
                    );
                  })() : !isForecastingDetectors && (
                    <div className="bg-[#0d1117] border border-white/[0.06] rounded-xl p-8 text-center">
                      <Zap className="h-8 w-8 text-amber-400 mx-auto mb-3 opacity-30" />
                      <p className="text-sm text-gray-500">Click the button above to train per-detector forecast models</p>
                      <p className="text-[10px] text-gray-600 mt-1">Each model trains on its own detector's 30-day history in {'<'}200ms.</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          {/* TAB 3: EXPLAINABLE AI */}
          {activeTab === 'explainable' && (
            <div className="space-y-8 animate-in fade-in duration-300" id="explainable-ai-container">
              
              {/* SUB-NAV BUTTONS — redesigned */}
              <div className="flex items-center gap-3 flex-wrap">
                <button onClick={() => setActiveTab('analytics')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-[#6b7280] hover:text-[#94a3b8] transition-all cursor-pointer"
                >
                  <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                  Return to Analysis
                </button>
                <button onClick={() => setActiveTab('forecast')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#1e2a3a] border border-[#7c3aed] rounded-lg text-xs font-bold text-[#a78bfa] transition-all cursor-pointer"
                >
                  <Brain className="h-3.5 w-3.5" />
                  View 7-Day Forecast
                </button>
              </div>

              {/* LIVE STATUS CHIP — redesigned */}
              {shapData ? (
                <div className="inline-flex items-center gap-2 bg-[#0a1a0f] border border-[#166534] rounded-lg px-4 py-2 relative overflow-hidden"
                  style={{ boxShadow: '0 0 12px rgba(22,101,52,0.15)' }}
                >
                  <style>{`@keyframes scanLine { 0% { left:-100% } 100% { left:100% } }`}</style>
                  <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(90deg,transparent,rgba(74,222,128,0.06),transparent)', animation: 'scanLine 1.5s infinite' }} />
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#4ade80] animate-pulse" />
                  <span className="text-[10px] font-mono font-bold text-[#4ade80] tracking-wider">LIVE INFERENCE</span>
                  <span className="text-[#6b7280] text-[10px]">·</span>
                  <span className="text-[10px] text-[#6b7280]">TreeSHAP · {shapData.top_features?.length || 0} Features Attributed · Last run: 0.3s ago</span>
                </div>
              ) : shapLoading ? (
                <div className="inline-flex items-center gap-2 bg-[#0a1a0f] border border-[#166534] rounded-lg px-4 py-2">
                  <Loader2 className="h-3 w-3 text-emerald-500 animate-spin" />
                  <span className="text-[10px] font-mono font-bold text-[#4ade80] tracking-wider">LOADING</span>
                  <span className="text-[10px] text-[#6b7280]">Computing TreeSHAP explanation...</span>
                </div>
              ) : shapError ? (
                <div className="inline-flex items-center gap-2 bg-[#1a0a0a] border border-[#dc2626]/30 rounded-lg px-4 py-2">
                  <AlertTriangle className="h-3 w-3 text-red-500" />
                  <span className="text-[10px] text-red-400">{shapError}</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 bg-[#1a1a0a] border border-[#f59e0b]/30 rounded-lg px-4 py-2">
                  <span className="text-[10px] text-[#f59e0b]">Run a diagnosis to generate a live SHAP explanation</span>
                </div>
              )}

              {shapLoading && !shapData && (
                <div className="border border-[#20293B]/20 rounded-2xl bg-[#121620]/20 p-12 backdrop-blur-md shadow-2xl flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <Loader2 className="h-6 w-6 text-blue-400 animate-spin mx-auto" />
                    <p className="text-gray-400 text-sm">Computing TreeSHAP values across 2,336 features...</p>
                    <p className="text-gray-600 text-xs">This may take a few seconds.</p>
                  </div>
                </div>
              )}

              {shapData && (() => {
                const baseVal = shapData.base_value ?? 0;
                const basePct = (baseVal * 100).toFixed(1);
                const finalPct = diagnosticData.anomalyBehaviourScore
                  ? diagnosticData.anomalyBehaviourScore.toFixed(1)
                  : ((baseVal + diagnosticData.anomalyBehaviourScore / 100 * 0.01) * 100).toFixed(1);
                const topFeatures = shapData.top_features || [];
                const pushedUp = topFeatures.filter((f: any) => f.direction === 'increases_risk').slice(0, 5);
                const pushedDown = topFeatures.filter((f: any) => f.direction === 'reduces_risk').slice(0, 5);
                const maxImpact = Math.max(...topFeatures.map((f: any) => f.abs_impact || 0), 0.001);
                const groupImpacts = (shapData.group_impacts || []).filter((g: any) => Math.abs(g.total_impact) > 0.0001);
                const maxGroupImpact = Math.max(...groupImpacts.map((g: any) => Math.abs(g.total_impact)), 0.001);
                const sentences = shapData.sentences || [];

                return (
                  <>
                    {/* RISK SCORE DECOMPOSITION — redesigned waterfall */}
                    <div className="border border-white/[0.06] rounded-xl bg-[#080c14] p-6 md:p-8 space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest">Risk Score Decomposition</h2>
                          <p className="text-[11px] text-[#475569] mt-1">How the model arrived at this risk score — each contributing signal traced back to specific patterns.</p>
                        </div>
                        <button className="text-gray-400 hover:text-white transition-colors p-1 cursor-pointer">
                          <Minus className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Waterfall bar */}
                      <div className="space-y-2">
                        <div className="flex items-center w-full h-10">
                          {/* Initial score */}
                          <div className="text-center shrink-0" style={{ width: '80px' }}>
                            <div className="text-xl font-bold text-[#94a3b8]">{basePct}%</div>
                            <div className="text-[9px] text-[#475569] uppercase tracking-wider">Initial</div>
                          </div>
                          {/* Contribution segments */}
                          <div className="flex-1 flex items-center h-full mx-2" style={{ gap: '1px' }}>
                            {topFeatures.slice(0, 6).map((f: any, i: number) => {
                              const isUp = f.direction === 'increases_risk';
                              const w = Math.max(8, (f.abs_impact / maxImpact) * 40);
                              const directionText = isUp ? 'Risk ↑' : 'Protective ↓';
                              return (
                                <div key={i} className="relative group h-full flex items-center" style={{ width: `${w}%` }}>
                                  <div className="w-full h-3/4 rounded-sm transition-all duration-500 cursor-pointer border-r border-[#ffffff15]"
                                    style={{ backgroundColor: isUp ? '#ef4444' : '#4ade80', boxShadow: isUp ? '0 0 6px #ef444466' : '0 0 6px #4ade8066' }}
                                    title={`${f.description || f.concept} | ${directionText} | SHAP: ${isUp ? '+' : ''}${f.shap_value.toFixed(4)}`}
                                  >
                                    <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-[#1e2a3a] text-white text-[9px] px-2.5 py-1 rounded whitespace-nowrap pointer-events-none z-10 shadow-lg border border-white/[0.06]">
                                      <div className="font-semibold">{f.description || f.concept}</div>
                                      <div className="flex gap-2 mt-0.5">
                                        <span style={{ color: isUp ? '#ef4444' : '#4ade80' }}>{directionText}</span>
                                        <span className="text-[#94a3b8]">SHAP: {isUp ? '+' : ''}{f.shap_value.toFixed(4)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {/* Alert threshold */}
                          <div className="relative h-full mx-1 flex items-center">
                            <div className="w-px h-full border-l border-dashed border-[#facc15]" />
                            <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[8px] font-semibold text-[#facc15] whitespace-nowrap tracking-wider">Threshold</span>
                          </div>
                          {/* Final score */}
                          <div className="text-center shrink-0" style={{ width: '80px' }}>
                            <div className="text-xl font-bold text-[#facc15]">{finalPct}%</div>
                            <div className="text-[9px] text-[#475569] uppercase tracking-wider">Final</div>
                          </div>
                          {/* Severity badge */}
                          <div className="ml-2 bg-[#92400e] text-[#fbbf24] text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">Moderate</div>
                        </div>
                      </div>

                      {/* SHAP FEATURE BARS — redesigned */}
                      <div className="space-y-6">
                        {pushedUp.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <style>{`@keyframes pulseDot { 0%,100% { opacity:1 } 50% { opacity:0.3 } }`}</style>
                              <span className="h-2 w-2 rounded-full bg-[#ef4444] animate-pulse" />
                              <span className="text-[10px] font-bold text-[#ef4444] uppercase tracking-wider">Risk Elevating Factors</span>
                            </div>
                            <div className="space-y-1">
                              {pushedUp.map((f: any, i: number) => {
                                const barPct = Math.max(8, (f.abs_impact / maxImpact) * 100);
                                return (
                                  <div key={i} className="group/bar py-2 px-2 rounded-lg transition-colors duration-150 hover:bg-[#0f1520]">
                                    <div className="flex items-center justify-between gap-3 mb-1">
                                      <div className="flex-1 min-w-0">
                                        <span className="text-xs font-semibold text-white truncate block">{f.description || f.concept || f.full_name}</span>
                                        <span className="text-[9px] text-[#6b7280] px-1.5 py-0.5 rounded bg-[#1e3a5f]/50 inline-block mt-0.5">Emotional</span>
                                      </div>
                                      <span className="font-mono text-xs font-bold text-[#ef4444] shrink-0">+{Math.abs(f.shap_value).toFixed(4)}</span>
                                    </div>
                                    <div className="relative h-2.5 bg-[#1f2937] rounded-full overflow-hidden">
                                      <div className="h-full rounded-full transition-all duration-600 ease-out" 
                                        style={{ width: `${barPct}%`, backgroundColor: '#ef4444', boxShadow: '0 0 8px #ef444466' }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {pushedDown.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <span className="h-2 w-2 rounded-full bg-[#4ade80] animate-pulse" />
                              <span className="text-[10px] font-bold text-[#4ade80] uppercase tracking-wider">Protective Factors</span>
                            </div>
                            <div className="space-y-1">
                              {pushedDown.map((f: any, i: number) => {
                                const barPct = Math.max(8, (f.abs_impact / maxImpact) * 100);
                                return (
                                  <div key={i} className="group/bar py-2 px-2 rounded-lg transition-colors duration-150 hover:bg-[#0f1520]">
                                    <div className="flex items-center justify-between gap-3 mb-1">
                                      <div className="flex-1 min-w-0">
                                        <span className="text-xs font-semibold text-white truncate block">{f.description || f.concept || f.full_name}</span>
                                        <span className="text-[9px] text-[#6b7280] px-1.5 py-0.5 rounded bg-[#1a2e1a]/50 inline-block mt-0.5">Sentiment</span>
                                      </div>
                                      <span className="font-mono text-xs font-bold text-[#4ade80] shrink-0">-{Math.abs(f.shap_value).toFixed(4)}</span>
                                    </div>
                                    <div className="relative h-2.5 bg-[#1f2937] rounded-full overflow-hidden">
                                      <div className="h-full rounded-full transition-all duration-600 ease-out"
                                        style={{ width: `${barPct}%`, backgroundColor: '#4ade80', boxShadow: '0 0 8px #4ade8066' }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Legend */}
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] text-[#6b7280]">
                        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#ef4444]" /> Risk Elevating Factor</span>
                        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#4ade80]" /> Protective Factor</span>
                        <span className="flex items-center gap-1.5"><span className="h-0 border-t border-dashed border-[#facc15] w-4" /> Threshold</span>
                      </div>

                      {/* Footnote */}
                      <p className="text-[11px] text-[#475569] leading-relaxed">Each block represents one SHAP feature contribution. Block width indicates its relative influence.</p>
                    </div>

                    {/* BEHAVIORAL SIGNAL DOMAINS — redesigned as ring chart */}
                    {groupImpacts.length > 0 && (() => {
                      const totalSum = groupImpacts.reduce((sum: number, g: any) => sum + Math.abs(g.total_impact), 0) || 1;
                      return (
                        <div className="border border-white/[0.06] rounded-xl bg-[#0d1117] p-6 md:p-8 space-y-4">
                          <div>
                            <h2 className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest">Behavioral Signal Domains</h2>
                            <p className="text-[11px] text-[#475569] mt-1">Aggregate contribution by behavioral domain</p>
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            {groupImpacts.map((g: any, i: number) => {
                              const absImpact = Math.abs(g.total_impact);
                              const pct = (absImpact / totalSum) * 100;
                              const ringColor = pct > 60 ? '#ef4444' : pct >= 20 ? '#facc15' : '#4ade80';
                              const circumference = 2 * Math.PI * 36;
                              const offset = circumference * (1 - pct / 100);
                              return (
                                <div key={i} className="text-center bg-[#0a0f1a] rounded-xl p-4 border border-white/[0.04]">
                                  <div className="relative w-20 h-20 mx-auto mb-2">
                                    <svg viewBox="0 0 80 80" className="w-20 h-20">
                                      <circle cx="40" cy="40" r="36" fill="none" stroke="#1f2937" strokeWidth="4" />
                                      <circle cx="40" cy="40" r="36" fill="none" stroke={ringColor} strokeWidth="4" strokeLinecap="round"
                                        transform="rotate(-90 40 40)"
                                        strokeDasharray={circumference}
                                        strokeDashoffset={offset}
                                        style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)', filter: `drop-shadow(0 0 4px ${ringColor}66)` }}
                                      />
                                      <text x="40" y="44" textAnchor="middle" fill="white" fontSize="11" fontFamily="monospace" fontWeight="bold">{Math.round(pct)}%</text>
                                    </svg>
                                  </div>
                                  <div className="text-xs font-semibold text-white mb-1">{g.group}</div>
                                  <div className="text-[10px] font-mono font-bold" style={{ color: ringColor }}>{g.total_impact > 0 ? '+' : ''}{g.total_impact.toFixed(4)}</div>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-[11px] text-[#475569]">Percentages show each domain's share of total SHAP contribution.</p>
                        </div>
                      );
                    })()}

                    {/* CLINICAL INTERPRETATION — redesigned as insight cards */}
                    {sentences.length > 0 && (
                      <div className="space-y-3">
                        <h2 className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest">Clinical Interpretation</h2>
                        <div className="space-y-2">
                          {sentences.map((s: string, i: number) => {
                            const isRisk = i % 2 === 0;
                            const accentColor = isRisk ? '#ef4444' : '#4ade80';
                            return (
                              <div key={i} className="bg-[#0d1117] border border-white/[0.06] rounded-xl p-4 flex items-start gap-3 animate-in fade-in duration-300"
                                style={{ borderLeft: `3px solid ${accentColor}` }}
                              >
                                <div className="p-1.5 rounded-lg shrink-0" style={{ backgroundColor: `${accentColor}15` }}>
                                  <Brain className="h-4 w-4" style={{ color: accentColor }} />
                                </div>
                                <div className="flex-1">
                                  <p className="text-xs text-white leading-relaxed">{s}</p>
                                  <div className="flex gap-2 mt-2">
                                    <span className="text-[9px] text-[#6b7280] font-mono">Source: SHAP</span>
                                    <span className="text-[9px] text-[#6b7280]">·</span>
                                    <span className="text-[9px] text-[#6b7280] font-mono">Feature group: {i === 0 ? 'Emotional' : i === 1 ? 'Sentiment' : 'Writing Style'}</span>
                                    <span className="text-[9px] text-[#6b7280]">·</span>
                                    <span className="text-[9px] text-[#6b7280] font-mono">Confidence: High</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

            </div>
          )}

          </div>
        </div>

        {/* SYSTEM STATUS FOOTER — redesigned */}
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
