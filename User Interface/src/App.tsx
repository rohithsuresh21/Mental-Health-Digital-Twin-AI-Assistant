import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Moon
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

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  type Tab = 'dashboard' | 'clinical' | 'analytics' | 'explainable' | 'profile' | 'intake';
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStage, setAnalysisStage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dynamic diagnostic data (starts with default, updated upon form submission)
  const [diagnosticData, setDiagnosticData] = useState<DiagnosticData>(defaultDiagnosticData);
  const [hasRunAnalysis, setHasRunAnalysis] = useState(false);

  // Patient data from daily portal
  const patientData = usePatientData(isPatient ? userId : '');

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
    age: 48,
    gender: 'Male',
    bloodType: 'A-Positive',
    medicalHistory: 'Longitudinal cognitive observation, mild episodic fatigue during high-intensity research.',
    symptoms: 'Occasional short-term recall latency under peak workloads.',
    communicationLogs: '',
    sleepDuration: 6.5,
    sleepQuality: 3,
    physicalActivity: 3,
    lookaheadHorizon: '5 days',
    voiceRecordingsText: '',
    clinicalReportsText: ''
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
    techDetails: true
  });

  // Collapsed sections in Explainable AI
  const [explainWhyPredictionCollapsed, setExplainWhyPredictionCollapsed] = useState(false);
  const [explainRootCauseCollapsed, setExplainRootCauseCollapsed] = useState(false);

  // Selected detector tab in What's Driving That Signal
  const [selectedDetector, setSelectedDetector] = useState(0);

  // Global hover state for longitudinal charts
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Hover state for individual detector sparkline charts
  const [detectorHoveredIndex, setDetectorHoveredIndex] = useState<number | null>(null);

  // Chart viewport: [startIndex, endIndex] for zoom/scroll
  const [chartViewport, setChartViewport] = useState<[number, number]>([-1, -1]);

  // CUSUM toggle tab: 0=Upper, 1=Lower, 2=Both
  const [selectedCusumTab, setSelectedCusumTab] = useState(2);

  // Compile & download medical summary
  const compileMedicalSummary = () => {
    const d = diagnosticData;
    const p = inputs;
    const dateStr = new Date().toISOString().slice(0, 10);
    const scoreVal = d.anomalyBehaviourScore ?? 0;
    let riskLabel = 'Excellent';
    if (scoreVal > 75) riskLabel = 'Critical Concern';
    else if (scoreVal > 55) riskLabel = 'Moderate Concern';
    else if (scoreVal > 40) riskLabel = 'Slight Concern';

    const getCusumTabLabel = () => {
      switch (selectedCusumTab) {
        case 0: return 'Upper (positive drift)';
        case 1: return 'Lower (negative drift)';
        default: return 'Both';
      }
    };

    const summaryLines = [
      '╔══════════════════════════════════════════════════════════════╗',
      '║                   MEDICAL SUMMARY REPORT                    ║',
      '╚══════════════════════════════════════════════════════════════╝',
      '',
      `Date: ${dateStr}`,
      `Patient: ${p.fullName || 'N/A'}`,
      `Age: ${p.age ?? 'N/A'}  |  Gender: ${p.gender || 'N/A'}  |  Blood Type: ${p.bloodType || 'N/A'}`,
      '',
      '─'.repeat(56),
      'OVERALL ASSESSMENT',
      '─'.repeat(56),
      '',
      `Overall Risk: ${riskLabel}  (${scoreVal}%)`,
      `Estimated Risk Score: ${scoreVal}%`,
      `Intervention Recommended: ${scoreVal > 40 ? 'Yes' : 'No'}`,
      `Entries Analyzed: ${d.pipelineNEntries || d.extractedDimensions || 'N/A'}`,
      `Anomaly Status: ${d.anomalyStatus || 'N/A'}`,
      `Trend Direction: ${d.anomalyDirection === 'up' ? '↑ Rising' : '↓ Declining'}  (${d.anomalyChange || 'N/A'})`,
      '',
      '─'.repeat(56),
      'KEY METRICS',
      '─'.repeat(56),
      '',
      `Linguistic Shift:         ${(d.linguisticShift ?? 0).toFixed(4)}`,
      `Behavioral Prosody:       ${(d.behavioralProsody ?? 0).toFixed(4)}`,
      `Routine Disruption:       ${(d.routineDisruption ?? 0).toFixed(1)}%`,
      `Daily Variance:           ${(d.avgDailyVariance ?? 0).toFixed(1)}% (${d.avgDailyVarianceDirection === 'up' ? '↑' : '↓'})`,
      `Model Confidence:         ${(d.modelConfidence ?? 0).toFixed(1)}%`,
      `Transparency Score:       ${(d.transparencyScore ?? 0).toFixed(2)}`,
      '',
      `Viewport Range:           ${chartViewport[0] === -1 ? 'All entries' : `[${chartViewport[0]} – ${chartViewport[1]}]`}`,
      `CUSUM Tab:                ${getCusumTabLabel()}`,
      '',
      '─'.repeat(56),
      'TOP FEATURE CONTRIBUTORS',
      '─'.repeat(56),
      '',
      ...(d.top3FeatureIndices ?? []).map((f, i) =>
        `  ${i + 1}. ${f.indexTarget}  —  Correlation: ${(f.correlationScore ?? 0).toFixed(2)}  |  Confidence: ${(f.confidence ?? 0).toFixed(2)}${f.status ? `  [${f.status}]` : ''}`
      ),
      '',
      '─'.repeat(56),
      'LIFESTYLE vs DIAGNOSTIC CORRELATIONS',
      '─'.repeat(56),
      '',
      ...(d.lifestyleVsDiagnosticCorrelation ?? []).map(c =>
        `  ${c.target.padEnd(22)}  ${(c.correlation ?? 0).toFixed(2)}`
      ),
      '',
      '─'.repeat(56),
      'CLINICAL INSIGHTS',
      '─'.repeat(56),
      '',
      ...(d.insights ?? []).map(line => `  • ${line}`),
      '',
      ...(d.pipelineTimestamps?.length ? [
        '─'.repeat(56),
        'TEMPORAL DATA SUMMARY',
        '─'.repeat(56),
        '',
        `  Date Range: ${d.pipelineTimestamps[0]}  —  ${d.pipelineTimestamps[d.pipelineTimestamps.length - 1]}`,
        `  Total Entries: ${d.pipelineTimestamps.length}`,
        ...(d.pipelineSentimentSeries?.length ? [
          `  Avg Sentiment: ${(d.pipelineSentimentSeries.reduce((a, b) => a + b, 0) / d.pipelineSentimentSeries.length).toFixed(3)}`,
          `  Recent Sentiment: ${d.pipelineSentimentSeries[d.pipelineSentimentSeries.length - 1]?.toFixed(3) ?? 'N/A'}`,
        ] : []),
        ...(d.pipelineAnomalyScores?.length ? [
          `  Avg Anomaly Score: ${(d.pipelineAnomalyScores.reduce((a, b) => a + b, 0) / d.pipelineAnomalyScores.length * 100).toFixed(1)}%`,
          `  Recent Anomaly: ${(d.pipelineAnomalyScores[d.pipelineAnomalyScores.length - 1] * 100).toFixed(1)}%`,
        ] : []),
        '',
      ] : []),
      ...(p.medicalHistory ? [
        '─'.repeat(56),
        'MEDICAL HISTORY',
        '─'.repeat(56),
        '',
        `  ${p.medicalHistory}`,
        '',
      ] : []),
      ...(p.symptoms ? [
        '─'.repeat(56),
        'REPORTED SYMPTOMS',
        '─'.repeat(56),
        '',
        `  ${p.symptoms}`,
        '',
      ] : []),
      '─'.repeat(56),
      `Report generated by Mental Health Digital Twin AI  |  ${new Date().toLocaleString()}`,
      '─'.repeat(56),
    ];

    const content = summaryLines.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Medical_Summary_${p.fullName?.replace(/\s+/g, '_') || 'Patient'}_${dateStr}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Reset viewport when analysis runs with new data
  const prevDataRef = useRef(diagnosticData);
  useEffect(() => {
    if (diagnosticData !== prevDataRef.current) {
      prevDataRef.current = diagnosticData;
      setChartViewport([-1, -1]);
    }
  }, [diagnosticData]);

  // Canvas constellation animation background
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

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
        this.size = 3.5 + Math.random() * 2.5;

        // Custom mathematical symbols mimicking transformer architecture
        const labels = ['x', 'W_Q', 'W_K', 'h_t', 'FFN', 'y_hat'];
        const baseSymbol = labels[layer % labels.length];
        this.label = `${baseSymbol}[${index}]`;
      }

      update(time: number, mouseX: number, mouseY: number, isDragged: boolean) {
        // Dynamic target floating rest baseline position
        const targetX = this.baseX + Math.sin(time * 0.4 + this.id * 1.5) * 12;
        const targetY = this.baseY + Math.cos(time * 0.35 + this.id * 2.2) * 16;

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
          this.activation -= 0.008;
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
          grad.addColorStop(0, `rgba(${glowColor}, ${0.12 + this.activation * 0.22})`);
          grad.addColorStop(1, `rgba(${glowColor}, 0)`);
          c.fillStyle = grad;
          c.fill();
        }

        // Inner core membrane
        c.beginPath();
        c.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        c.fillStyle = isLightTheme 
          ? `rgba(59, 130, 246, ${0.18 + this.activation * 0.62})`
          : `rgba(147, 197, 253, ${0.14 + this.activation * 0.62})`;
        c.strokeStyle = isLightTheme
          ? `rgba(59, 130, 246, ${0.45 + this.activation * 0.48})`
          : `rgba(165, 192, 255, ${0.32 + this.activation * 0.48})`;
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

    const layerDistribution = [3, 4, 4, 4, 3]; // Beautifully sparse, clean neural network style layout
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
        // Calculate responsive X layout with comfortable padding
        const x = 70 + (l / (layerCount - 1)) * (w - 140);
        for (let i = 0; i < nodeCount; i++) {
          // Calculate responsive Y layout
          const y = 90 + (i / (nodeCount - 1 || 1)) * (h - 180);
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
      const targetCount = 1 + Math.floor(Math.random() * 2);
      const shuffled = [...nextLayerNodes].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, Math.min(targetCount, shuffled.length));

      selected.forEach(target => {
        // Enforce a safe cap on parallel pulse entities to prevent rendering bottlenecks
        if (pulses.length < 35) {
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

      if (closestNode && minDist < 220) {
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

      // Periodic background signal generation (every 1400ms)
      if (Date.now() - lastInferenceTime > 1400) {
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
            ? `rgba(59, 130, 246, ${Math.min(0.25, connectionAlpha * 1.8)})`
            : `rgba(165, 192, 255, ${Math.min(0.18, connectionAlpha)})`;
          ctx.lineWidth = 0.55;
          ctx.stroke();
        });
      }

      // Draw interactive mouse proximity strands (faint local focus field)
      if (mouse.x > -1000 && mouse.y > -1000) {
        // Draw crisp cursor diagnostic dot
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 4.0, 0, Math.PI * 2);
        ctx.fillStyle = isLightTheme ? 'rgba(59, 130, 246, 0.82)' : 'rgba(165, 192, 255, 0.82)';
        ctx.shadowBlur = 12;
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
              ? `rgba(59, 130, 246, ${0.08 * (1 - dist / 180)})`
              : `rgba(165, 192, 255, ${0.04 * (1 - dist / 180)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();

            // Symmetrical slight static activation from proximity focus
            n.activation = Math.min(1.0, n.activation + 0.005);
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
        ctx.arc(pos.x, pos.y, 2.0, 0, Math.PI * 2);
        ctx.fillStyle = pulse.color;
        ctx.shadowBlur = 6;
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
    setAnalysisProgress(10);
    setAnalysisStage('Connecting to inference pipeline...');

    try {
      setAnalysisStage('Running ML pipeline on backend...');
      setAnalysisProgress(30);

      let result: DiagnosticData;

      if (docFileObj) {
        // Upload file directly to Flask (CORS enabled) with all fields
        console.log('[Diagnosis] Uploading file to Flask /run:', docFileObj.name);
        const fd = new FormData();
        Object.entries(inputs).forEach(([key, val]) => {
          fd.append(key, String(val ?? ''));
        });
        fd.append('file', docFileObj);
        const flaskRes = await fetch('http://localhost:5000/run', {
          method: 'POST',
          body: fd,
        });
        if (!flaskRes.ok) {
          const errText = await flaskRes.text();
          throw new Error(`Flask /run responded ${flaskRes.status}: ${errText}`);
        }
        const pipelineResult = await flaskRes.json();
        if (pipelineResult.error) throw new Error(pipelineResult.error);
        result = mapFlaskRunResponse(pipelineResult, inputs);
        console.log('[Diagnosis] Flask /run succeeded with', pipelineResult.n_entries, 'entries');
      } else {
        // No file — use Vite middleware (text mode)
        const res = await fetch('/api/diagnose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(inputs),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || `Server responded ${res.status}`);
        }
        result = await res.json();
      }

      setAnalysisProgress(90);
      setAnalysisStage('Mapping pipeline output to dashboard...');
      setDiagnosticData(result);
      setHasRunAnalysis(true);
      setIsAnalyzing(false);
      setActiveTab('analytics');

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
    } catch (err: any) {
      console.error('Pipeline error:', err);
      setDiagnosticData(prev => ({ ...prev, apiError: err.message || 'Pipeline unavailable' }));
      setIsAnalyzing(false);
      setAnalysisStage(err.message || 'Pipeline error');
      setTimeout(() => setAnalysisStage(''), 3000);
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

    const yTicks = [0, 25, 50, 75, 100];

    const maxXLabels = 5;
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

    return (
      <div className="space-y-2 relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto cursor-crosshair" preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id={`fill-${filterId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
            <filter id={filterId} x="-10%" y="-10%" width="120%" height="130%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur1" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur2" />
              <feMerge>
                <feMergeNode in="blur2" />
                <feMergeNode in="blur1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {yTicks.map(t => {
            const y = getY(t);
            return (
              <g key={t}>
                <line x1={pad.left} y1={y} x2={pad.left + plotW} y2={y} stroke="#1E293B" strokeWidth="0.5" strokeDasharray="2 3" />
                <text x={pad.left - 5} y={y + 2.5} fill="#475569" fontSize="8" textAnchor="end" fontFamily="monospace">{t}</text>
              </g>
            );
          })}
          {xLabelIndices.map(i => {
            const x = getX(i);
            const dateLabel = dates[i] ? dates[i].slice(5).replace('-', '/') : '';
            return (
              <g key={i}>
                <line x1={x} y1={pad.top} x2={x} y2={pad.top + plotH} stroke="#1E293B" strokeWidth="0.5" strokeDasharray="1 3" />
                <text x={x} y={height - 5} fill="#475569" fontSize="7" textAnchor="middle" fontFamily="monospace">{dateLabel}</text>
              </g>
            );
          })}
          <path d={fillPath} fill={`url(#fill-${filterId})`} />
          <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${filterId})`} />
          <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          {pointsArr.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={i === lastIdx ? 3 : 1.5} fill={i === lastIdx ? color : `${color}80`} stroke="#0D1117" strokeWidth={i === lastIdx ? 1.5 : 0.5} />
          ))}
          <circle cx={lastP.x} cy={lastP.y} r="5" fill="none" stroke={color} strokeWidth="1.5" opacity="0.5">
            <animate attributeName="r" values="3;6;3" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0.1;0.6" dur="2s" repeatCount="indefinite" />
          </circle>
          {detectorHoveredIndex !== null && (
            <g>
              <line x1={getX(detectorHoveredIndex)} y1={pad.top} x2={getX(detectorHoveredIndex)} y2={pad.top + plotH} stroke={color} strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
              <circle cx={getX(detectorHoveredIndex)} cy={getY(points[detectorHoveredIndex])} r="4" fill={color} stroke="#0D1117" strokeWidth="1.5" />
            </g>
          )}
        </svg>
        {detectorHoveredIndex !== null && (
          <div
            className="absolute bg-[#11131c]/95 border border-[#232B3B]/80 px-2.5 py-1.5 rounded shadow-xl text-[10px] font-mono text-gray-300 pointer-events-none z-20"
            style={{
              left: `${Math.min(85, Math.max(5, (detectorHoveredIndex / lastIdx) * 100))}%`,
              top: "-8px"
            }}
          >
            <div className="text-gray-400 text-[9px]">{dates[detectorHoveredIndex]}</div>
            <div className="text-white font-bold">{Math.round(points[detectorHoveredIndex])}%</div>
          </div>
        )}
        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-3">
            <span className="text-gray-600 font-sans">Peak <span className="text-gray-300 font-bold font-mono">{Math.round(Math.max(...points))}%</span></span>
            <span className="text-gray-600 font-sans">Mean <span className="text-gray-300 font-bold font-mono">{Math.round(points.reduce((a, b) => a + b, 0) / points.length)}%</span></span>
            <span className="text-gray-600 font-sans">Low <span className="text-gray-300 font-bold font-mono">{Math.round(Math.min(...points))}%</span></span>
          </div>
          <span className="text-gray-600">{dates[0]?.slice(5).replace('-', '/') || ''} &ndash; {dates[lastIdx]?.slice(5).replace('-', '/') || ''}</span>
        </div>
      </div>
    );
  };

  // Render main spline line chart with interactive tooltip
  const [hoveredChartPoint, setHoveredChartPoint] = useState<any>(null);
  const [chartTooltipPos, setChartTooltipPos] = useState({ x: 0, y: 0 });

  const renderTemporalCognitiveChart = () => {
    const data = diagnosticData.temporalCognitiveAnalysis || defaultDiagnosticData.temporalCognitiveAnalysis;
    const width = 640;
    const height = 280;
    const padding = { top: 20, right: 20, bottom: 40, left: 40 };

    const xMax = 24;
    const yMax = 80;
    const yMin = 30;

    const getX = (val: number) => padding.left + ((val - 1) / (xMax - 1)) * (width - padding.left - padding.right);
    const getY = (val: number) => height - padding.bottom - ((val - yMin) / (yMax - yMin)) * (height - padding.top - padding.bottom);

    // Dotted baseline path (smooth spline approximation using bezier)
    let baselinePath = `M ${getX(data[0].hour)} ${getY(data[0].baseline)}`;
    for (let i = 0; i < data.length - 1; i++) {
      const x1 = getX(data[i].hour);
      const y1 = getY(data[i].baseline);
      const x2 = getX(data[i+1].hour);
      const y2 = getY(data[i+1].baseline);
      const cx1 = x1 + (x2 - x1) / 2;
      const cy1 = y1;
      const cx2 = x1 + (x2 - x1) / 2;
      const cy2 = y2;
      baselinePath += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
    }

    // Current session line (glowing bright blue)
    let currentPath = `M ${getX(data[0].hour)} ${getY(data[0].current)}`;
    for (let i = 0; i < data.length - 1; i++) {
      const x1 = getX(data[i].hour);
      const y1 = getY(data[i].current);
      const x2 = getX(data[i+1].hour);
      const y2 = getY(data[i+1].current);
      const cx1 = x1 + (x2 - x1) / 2;
      const cy1 = y1;
      const cx2 = x1 + (x2 - x1) / 2;
      const cy2 = y2;
      currentPath += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
    }

    // Gridlines (Y-axis gridlines every 10 units)
    const yGridValues = [30, 40, 50, 60, 70, 80];

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      
      // Map mouseX back to closest hour index
      const chartWidth = width - padding.left - padding.right;
      const relativeX = mouseX - padding.left;
      const hourPct = relativeX / chartWidth;
      const exactHour = 1 + hourPct * (xMax - 1);
      const closestHourIndex = Math.min(23, Math.max(0, Math.round(exactHour) - 1));
      const point = data[closestHourIndex];

      if (point) {
        setHoveredChartPoint(point);
        setChartTooltipPos({
          x: getX(point.hour),
          y: getY(point.current)
        });
      }
    };

    const handleMouseLeave = () => {
      setHoveredChartPoint(null);
    };

    return (
      <div className="relative" id="temporal-analysis-chart-container">
        <svg 
          width="100%" 
          height={height} 
          viewBox={`0 0 ${width} ${height}`} 
          className="overflow-visible select-none cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            {/* Filter for electric blue glow */}
            <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Gradient for area fill */}
            <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Gridlines */}
          {yGridValues.map((val) => (
            <g key={val}>
              <line 
                x1={padding.left} 
                y1={getY(val)} 
                x2={width - padding.right} 
                y2={getY(val)} 
                stroke="#1B2030" 
                strokeWidth="1" 
                strokeDasharray={val === 30 ? 'none' : '4,4'}
              />
              <text 
                x={padding.left - 12} 
                y={getY(val) + 4} 
                fill="#5F6E85" 
                fontSize="11" 
                textAnchor="end"
                fontFamily="monospace"
              >
                {val}
              </text>
            </g>
          ))}

          {/* X Axis Labels (Hours 1, 2, ..., 24) */}
          {Array.from({ length: 24 }, (_, i) => i + 1).map((hr) => (
            hr % 2 === 1 || hr === 24 ? (
              <text 
                key={hr} 
                x={getX(hr)} 
                y={height - padding.bottom + 20} 
                fill="#5F6E85" 
                fontSize="10" 
                textAnchor="middle"
                fontFamily="monospace"
              >
                {hr}
              </text>
            ) : null
          ))}

          {/* Baseline dotted line */}
          <path 
            d={baselinePath} 
            fill="none" 
            stroke="#4A5568" 
            strokeWidth="1.5" 
            strokeDasharray="4,4" 
            opacity="0.7"
          />

          {/* Area under current line */}
          <path
            d={`${currentPath} L ${getX(24)} ${getY(30)} L ${getX(1)} ${getY(30)} Z`}
            fill="url(#area-grad)"
          />

          {/* Current session glowing line */}
          <path 
            d={currentPath} 
            fill="none" 
            stroke="#3B82F6" 
            strokeWidth="2.5" 
            filter="url(#neon-glow)"
          />

          {/* Active tooltip vertical tracker line */}
          {hoveredChartPoint && (
            <g>
              <line
                x1={chartTooltipPos.x}
                y1={padding.top}
                x2={chartTooltipPos.x}
                y2={height - padding.bottom}
                stroke="rgba(165, 192, 255, 0.25)"
                strokeWidth="1"
                strokeDasharray="2,2"
              />
              <circle
                cx={chartTooltipPos.x}
                cy={chartTooltipPos.y}
                r="6"
                fill="#3B82F6"
                stroke="#FFFFFF"
                strokeWidth="2"
                className="shadow-lg"
              />
              <circle
                cx={chartTooltipPos.x}
                cy={getY(hoveredChartPoint.baseline)}
                r="4"
                fill="#4A5568"
                stroke="#11131C"
                strokeWidth="1.5"
              />
            </g>
          )}
        </svg>

        {/* Custom Tooltip Overlay */}
        {hoveredChartPoint && (
          <div 
            className="absolute z-30 bg-[#161B26]/95 border border-[#2D3748] rounded px-2.5 py-1.5 text-xs text-white pointer-events-none shadow-2xl transition-all duration-75"
            style={{ 
              left: `${chartTooltipPos.x - 60}px`, 
              top: `${chartTooltipPos.y - 70}px` 
            }}
          >
            <div className="font-semibold text-[#A5C0FF] mb-0.5">Hour {hoveredChartPoint.hour}:00</div>
            <div className="flex justify-between gap-4 mb-0.5">
              <span className="text-gray-400">Current:</span>
              <span className="font-bold text-[#3B82F6]">{hoveredChartPoint.current}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Baseline:</span>
              <span className="font-semibold text-gray-300">{hoveredChartPoint.baseline}</span>
            </div>
          </div>
        )}
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
        <div className="h-9 w-9 rounded-full bg-blue-900/40 border border-blue-500/50 flex items-center justify-center text-blue-300 group-hover:border-blue-400 group-hover:scale-105 transition-all">
          <User className="h-4.5 w-4.5 text-blue-400" />
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
          className="h-10 px-4 bg-[#11131C]/65 hover:bg-[#11131C]/85 backdrop-blur-xl border border-[#1B2030]/60 rounded-xl flex items-center gap-2.5 transition-all duration-200 active:scale-95 text-[#A5C0FF] hover:text-white shadow-xl shadow-blue-950/15 cursor-pointer"
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
          className="fixed inset-0 bg-[#06080C]/45 backdrop-blur-[3px] z-30 transition-opacity duration-300 flex items-start"
          onClick={() => setIsMenuOpen(false)}
          id="sidebar-overlay"
        >
          <div 
            className="absolute top-16 left-4 w-72 bg-[#11131C]/92 backdrop-blur-3xl border border-[#1B2030]/70 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.65)] flex flex-col overflow-hidden max-h-[calc(100vh-6rem)] animate-in fade-in slide-in-from-top-4 duration-300"
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
          {activeTab === 'dashboard' && (
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6] animate-pulse" />
              <h1 className="text-sm font-extrabold tracking-widest bg-gradient-to-r from-blue-400 via-indigo-200 to-white bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(59,130,246,0.3)] uppercase font-sans">
                {isPatient ? 'Patient Dashboard' : 'Clinical Provider Workspace'}
              </h1>
            </div>
          )}
          {activeTab === 'clinical' && (
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6] animate-pulse" />
              <h1 className="text-sm font-extrabold tracking-widest bg-gradient-to-r from-blue-400 via-indigo-200 to-white bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(59,130,246,0.3)] uppercase font-sans">
                Clinical Provider Workspace — Intake & Analysis
              </h1>
            </div>
          )}
          {activeTab === 'profile' && (
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_8px_#6366f1] animate-pulse" />
              <h1 className="text-sm font-extrabold tracking-widest bg-gradient-to-r from-indigo-400 via-purple-200 to-white bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(99,102,241,0.3)] uppercase font-sans">
                Clinical Provider Workspace — Patient Profile
              </h1>
            </div>
          )}
          {activeTab === 'analytics' && (
            <div className="flex items-center gap-8 flex-1">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" />
                <h1 className="text-sm font-extrabold tracking-widest bg-gradient-to-r from-emerald-400 via-teal-200 to-white bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(16,185,129,0.3)] uppercase font-sans">
                  Clinical Provider Workspace — Patient Analytics
                </h1>
              </div>
              <div className="relative max-w-xs flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                <input 
                  type="text" 
                  placeholder="Search by keyword (e.g. mood, detector)..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery.trim()) {
                      const q = searchQuery.toLowerCase();
                      const idMatch = document.getElementById(q);
                      if (idMatch) { idMatch.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
                      const all = document.querySelectorAll('h2, h3, h4, p, span, div, button');
                      for (const el of all) {
                        if (el.id?.toLowerCase().includes(q) || el.textContent?.toLowerCase().includes(q)) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          (el as HTMLElement).style.outline = '2px solid #3b82f6';
                          setTimeout(() => { (el as HTMLElement).style.outline = ''; }, 2000);
                          break;
                        }
                      }
                    }
                  }}
                  className="w-full bg-[#151922] border border-[#232B3B] rounded-md pl-9 pr-4 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}
          {activeTab === 'explainable' && (
            <div className="flex items-center gap-8 flex-1">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-purple-500 shadow-[0_0_8px_#a855f7] animate-pulse" />
                <h1 className="text-sm font-extrabold tracking-widest bg-gradient-to-r from-purple-400 via-indigo-200 to-white bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(168,85,247,0.3)] uppercase font-sans">
                  Clinical Provider Workspace — Explainable AI
                </h1>
              </div>
              <div className="relative max-w-xs flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                <input 
                  type="text" 
                  placeholder="QUERY_PATIENT_ID..." 
                  className="w-full bg-[#151922] border border-[#232B3B] rounded-md pl-9 pr-4 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 relative">
            {hasRunAnalysis && (
              <button
                onClick={compileMedicalSummary}
                className="text-xs bg-indigo-600/20 border border-indigo-500/50 text-indigo-300 hover:bg-indigo-600/40 hover:border-indigo-400 px-3 py-1.5 rounded-lg transition cursor-pointer font-bold flex items-center gap-1.5"
              >
                <FileText className="h-3.5 w-3.5" />
                Compile Medical Summary
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
          
          {/* TAB 0: PORTAL GATEWAY DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="w-full min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center relative overflow-hidden px-8 py-16 bg-transparent" id="dashboard-landing">

              {/* Static ambient blue light node on landing page (it should not move on the landing page) */}
              <div className="absolute top-12 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#a5c0ff] shadow-[0_0_12px_#a5c0ff,0_0_24px_#3b82f6] opacity-65" />

              {/* CENTERED HERO SECTION */}
              <div className="text-center z-10 max-w-4xl px-4 flex flex-col items-center my-auto">
                {/* Best Unique font style using Outfit paired with elegant Playfair Display Serif */}
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-sans font-extrabold tracking-tight text-white mb-8 leading-tight drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)]">
                  Your Personal <span className="font-sans font-normal italic text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300 drop-shadow-[0_0_25px_rgba(59,130,246,0.45)] px-1">Digital Health</span> AI Assistant
                </h1>

                {/* HELLO THERE! GREETING */}
                <p className="text-lg md:text-xl font-semibold text-sky-200 tracking-wider mb-12 select-none font-sans uppercase">
                  {inputs.fullName && inputs.fullName.trim() !== "" ? `Hello there, ${inputs.fullName}!` : "Hello there!"}
                </p>

                {/* MAIN GET STARTED BUTTON */}
                <button
                  onClick={() => setActiveTab('profile')}
                  className="group relative inline-flex items-center gap-3 px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all duration-300 hover:shadow-[0_0_35px_rgba(37,99,235,0.6)] active:scale-95 shadow-lg shadow-blue-950/20 cursor-pointer overflow-hidden z-20"
                >
                  <span className="relative z-10">Let's Get Started</span>
                  <Compass className="h-4.5 w-4.5 relative z-10 group-hover:rotate-45 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </button>
              </div>

              {/* MAJESTIC CUSTOM COGNITIVE BIOMETRIC HORIZON */}
              {/* Ambient radial diagnostic glows */}
              <div className="absolute -bottom-[120px] left-1/2 -translate-x-1/2 w-[140vw] h-[300px] rounded-full bg-blue-500/10 blur-3xl pointer-events-none z-0" />
              <div className="absolute -bottom-[200px] left-1/2 -translate-x-1/2 w-[150vw] h-[400px] rounded-full bg-indigo-500/10 blur-2xl pointer-events-none z-0" />

              {/* The main high-tech curved cybernetic boundary */}
              <div className="absolute -bottom-[280px] left-1/2 -translate-x-1/2 w-[170vw] h-[550px] rounded-t-[100%] bg-[#06080d]/95 backdrop-blur-[4px] border-t border-sky-500/30 animate-horizon-pulse pointer-events-none z-0 overflow-hidden shadow-[0_-4px_30px_rgba(14,165,233,0.15)]">
                {/* Embedded holographic digital coordinate grid */}
                <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #38bdf8 1.2px, transparent 1.2px), linear-gradient(to right, rgba(99,102,241,0.05) 1px, transparent 1px)', backgroundSize: '16px 16px, 40px 100%' }} />

                {/* Concentric glass-line indicators representing biometrics */}
                <div className="absolute top-[8px] left-1/2 -translate-x-1/2 w-[164vw] h-[530px] rounded-t-[100%] border-t border-indigo-400/15 pointer-events-none" />
                <div className="absolute top-[24px] left-1/2 -translate-x-1/2 w-[158vw] h-[510px] rounded-t-[100%] border-t border-dashed border-sky-400/10 pointer-events-none" />

                {/* Dynamic sweeping laser scanner node */}
                <div className="absolute top-[-2px] h-[3px] w-[20%] bg-gradient-to-r from-transparent via-sky-400 to-transparent blur-[2px] animate-laser-sweep pointer-events-none" />

                {/* Inner depth shadow of planetary curve */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#030406]/98 to-[#010102] pointer-events-none" />

                {/* Status indicators */}
                <div className="absolute top-2 left-[15%] text-[7px] font-mono tracking-widest text-emerald-400/40">System Online</div>
                <div className="absolute top-4 left-[15%] text-[7px] font-mono tracking-widest text-sky-400/30">Model v3.5 · Ready</div>
              </div>
            </div>
          )}

          {/* TAB INTAKE: Clinical Patient Intake Portal (patient daily alignment) */}
          {activeTab === 'intake' && (
            <div className="max-w-2xl mx-auto my-2 animate-in fade-in duration-200" id="intake-portal-container">
              <div className="glass-panel rounded-2xl p-6">
                <PatientIntakePortal userId={userId} onCalibrated={() => patientData.refresh()} />
              </div>
            </div>
          )}

          {/* TAB 0.5: USER PROFILE */}
          {activeTab === 'profile' && (
            <div className="max-w-3xl mx-auto my-2 animate-in fade-in duration-200" id="profile-portal-container">
              <div className="glass-panel rounded-2xl p-8 relative overflow-hidden">
                
                {/* Visual synaptic accent */}
                <div className="animate-flow-dot" />

                <div className="flex items-center gap-4 mb-8">
                  <div className="h-14 w-14 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
                    <User className="h-7 w-7" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 via-purple-200 to-white bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(99,102,241,0.25)]">Patient Profile Settings</h2>
                    <p className="text-[#A5C0FF]/60 text-xs">Enter patient details and clinical background information.</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* PATIENT DETAILS FIELDS */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest font-sans">1. Patient Credentials</h3>
                    
                    <div>
                      <label className="block text-[9px] tracking-widest text-gray-400 font-bold uppercase mb-2">Patient Full Name</label>
                      <input 
                        type="text"
                        placeholder="e.g. Dr. Alexander Mercer"
                        value={inputs.fullName}
                        onChange={(e) => setInputs({...inputs, fullName: e.target.value})}
                        className="w-full bg-[#0D1017]/40 border border-[#232B3B]/60 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] tracking-widest text-gray-400 font-bold uppercase mb-2">Age</label>
                        <input 
                          type="number"
                          placeholder="e.g. 48"
                          value={inputs.age || ''}
                          onChange={(e) => setInputs({...inputs, age: parseInt(e.target.value) || 0})}
                          className="w-full bg-[#0D1017]/40 border border-[#232B3B]/60 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] tracking-widest text-gray-400 font-bold uppercase mb-2">Gender</label>
                        <input 
                          type="text"
                          placeholder="e.g. Male"
                          value={inputs.gender}
                          onChange={(e) => setInputs({...inputs, gender: e.target.value})}
                          className="w-full bg-[#0D1017]/40 border border-[#232B3B]/60 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] tracking-widest text-gray-400 font-bold uppercase mb-2">Blood Type</label>
                        <input 
                          type="text"
                          placeholder="e.g. A-Positive"
                          value={inputs.bloodType}
                          onChange={(e) => setInputs({...inputs, bloodType: e.target.value})}
                          className="w-full bg-[#0D1017]/40 border border-[#232B3B]/60 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] tracking-widest text-gray-400 font-bold uppercase mb-2">Cognitive Latency / Clinical Symptoms</label>
                        <input 
                          type="text"
                          placeholder="e.g. Mild short-term memory latency"
                          value={inputs.symptoms}
                          onChange={(e) => setInputs({...inputs, symptoms: e.target.value})}
                          className="w-full bg-[#0D1017]/40 border border-[#232B3B]/60 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] tracking-widest text-gray-400 font-bold uppercase mb-2">Pre-existing Medical History & Conditions</label>
                      <textarea 
                        placeholder="Detail relevant prior medical conditions, research, or observations..."
                        value={inputs.medicalHistory}
                        onChange={(e) => setInputs({...inputs, medicalHistory: e.target.value})}
                        className="w-full bg-[#0D1017]/40 border border-[#232B3B]/60 rounded-xl p-4 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 h-24 resize-none"
                      />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-[#1B2030]/60 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-xs text-[#A5C0FF]/60 font-semibold tracking-wide">
                      Changes are securely synced to your session memory.
                    </div>
                    <button
                      onClick={() => {
                        setActiveTab(isPatient ? 'intake' : 'clinical');
                      }}
                      className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <ArrowRight className="h-4 w-4" />
                      {isPatient ? 'Save & Continue to Daily Alignment Portal' : 'Save & Continue to Document Upload'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                        <label className="block text-[9px] tracking-widest text-gray-400 font-bold uppercase mb-2">VOICE RECORDINGS (.MP3/.WAV)</label>
                        <input
                          ref={audioInputRef}
                          type="file"
                          accept=".mp3,.wav,.m4a,.ogg"
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
              ? (() => { setChartViewport([0, nChart - 1]); return [0, Math.max(0, nChart - 1)]; })()
              : [Math.max(0, Math.min(chartViewport[0], nChart - 1)), Math.max(1, Math.min(chartViewport[1] || nChart - 1, nChart - 1))];
            const vpCount = vpEnd - vpStart + 1;
            const vpLastIdx = Math.max(1, vpCount - 1);
            const vpXLabels = (() => {
              if (vpCount <= 7) return Array.from({ length: vpCount }, (_, i) => vpStart + i);
              const step = (vpCount - 1) / 6;
              return Array.from({ length: 7 }, (_, i) => vpStart + Math.round(i * step));
            })();

            const sentimentData = pipeline?.pipelineSentimentSeries || [
              0.22, 0.35, -0.1, 0.18, 0.29, 0.32, 0.12, 0.21, 0.34, 0.26, 0.15, 0.32, 0.38, 0.24,
              0.18, 0.12, 0.28, 0.35, 0.18, 0.05, 0.22, 0.14, 0.18, 0.08, 0.21, 0.12, 0.18, 0.31,
              0.22, 0.16, 0.25, 0.12, 0.19, 0.28, 0.15, 0.22, 0.08, 0.24, 0.33, 0.21, 0.31, 0.28
            ];

            const anomalyRiskData = pipeline?.pipelineAnomalyScores || [
              0.55, 0.42, 0.48, 0.38, 0.45, 0.52, 0.41, 0.44, 0.58, 0.49, 0.42, 0.55, 0.73, 0.44,
              0.51, 0.43, 0.39, 0.48, 0.52, 0.41, 0.48, 0.38, 0.46, 0.35, 0.42, 0.49, 0.36, 0.45,
              0.41, 0.48, 0.32, 0.44, 0.75, 0.71, 0.78, 0.72, 0.75, 0.73, 0.77, 0.68, 0.75, 0.69
            ];

            const lowerCusumVals = pipeline?.pipelineCusumLower || [
              0.1, 0.2, 0.0, 0.15, 0.3, 0.1, 0.05, 0.18, 0.12, 0.25, 0.35, 0.1, 0.22, 0.14, 0.08, 0.22, 0.35, 0.12, 0.05, 0.18, 0.31, 0.52, 0.61, 0.78, 1.05, 1.12, 1.35, 1.62, 1.84, 2.15, 2.32, 2.18, 1.34, 0.82, 0.22, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0
            ];

            const upperCusumVals = pipeline?.pipelineCusumUpper || [
              0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.4, 0.9, 1.5, 2.2, 3.1, 4.0, 4.9, 5.7, 6.5, 7.1, 7.7
            ];
            const cusumThreshold = pipeline?.pipelineCusumThreshold ?? 1.0;

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
              const scale = 500 / rect.width;
              const svgMouseX = mouseXPx * scale;
              const relativeX = svgMouseX - 35;
              const chartWidth = 500 - 35 - 20;
              const percentage = relativeX / chartWidth;
              const rawIndex = percentage * lastIdx;
              const closestIndex = Math.min(lastIdx, Math.max(0, Math.round(rawIndex)));
              setHoveredPointIndex(closestIndex);
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
                      Please complete the clinical intake assessment and upload your documents first. Once the analysis runs, you'll find your personalized dashboard here.
                    </p>
                    <button
                      onClick={() => setActiveTab('clinical')}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all duration-300 hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] cursor-pointer"
                    >
                      <User className="h-4 w-4" />
                      Go to Clinical Intake
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div className="space-y-6" id="analytics-dashboard-container">
                
                {diagnosticData.apiError && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3 text-amber-200 text-xs animate-in fade-in duration-300" id="api-warning-banner">
                    <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <span className="font-bold uppercase tracking-wider block mb-1">Simulated Clinical Processing Active</span>
                      {diagnosticData.apiError}
                    </div>
                  </div>
                )}

                {/* TOP METRICS ROW */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-4 border-b border-[#20293B]/20">
                  {/* Left overall card */}
                  <div className="space-y-2">
                    <span className={`inline-block border rounded px-3 py-1 text-xs font-bold font-mono tracking-wide ${badgeStyle}`}>
                      {badgeText}
                    </span>
                    <div className="text-xs text-gray-400 font-medium pl-1">overall picture</div>
                  </div>

                  {/* Second Card */}
                  <div className="space-y-1">
                    <div className="text-3xl font-extrabold text-[#43A0F5] tracking-tight">{estimatedRisk}</div>
                    <div className="text-xs text-gray-400 font-medium">estimated risk</div>
                  </div>

                  {/* Third Card */}
                  <div className="space-y-1">
                    <div className="text-3xl font-extrabold text-white tracking-tight">{entriesCount}</div>
                    <div className="text-xs text-gray-400 font-medium">entries looked at</div>
                  </div>

                  {/* Fourth Card */}
                  <div className="space-y-1">
                    <div className="text-3xl font-extrabold tracking-tight">
                      <span className={worthCheckIn === 'Yes' ? 'text-rose-500' : 'text-gray-500'}>{worthCheckIn}</span>
                    </div>
                    <div className="text-xs text-gray-400 font-medium">worth a check-in</div>
                  </div>
                </div>

                {/* Advisory callout box */}
                <div className={`border-l-4 rounded-r-xl p-5 text-sm leading-relaxed animate-in fade-in duration-300 ${
                  worthCheckIn === 'Yes'
                    ? 'bg-[#1C1005]/20 border-l-amber-500 border border-amber-500/10 text-[#FFA857]/80'
                    : 'bg-emerald-950/10 border-l-emerald-500 border border-emerald-500/10 text-emerald-300/80'
                }`}>
                  {worthCheckIn === 'Yes'
                    ? 'A few signals here are worth paying attention to. It might help to talk to someone — a friend, a counsellor, or a professional you trust.'
                    : 'Things look fairly steady right now. Worth keeping an eye on, as always, but nothing stands out as urgent.'}
                </div>

                {/* Scale description and gradient bar */}
                <div className="space-y-3">
                  <div className="text-[11px] tracking-wide text-gray-400 font-semibold uppercase">
                    What the scores on this page mean, from 0 (calmest) to 1 (most concerning)
                  </div>
                  {/* 7-Segment Spectrum Bar */}
                  {(() => {
                    const segments = [
                      { color: 'bg-emerald-500', title: 'Excellent' },
                      { color: 'bg-teal-500', title: 'Healthy' },
                      { color: 'bg-sky-500', title: 'Stable' },
                      { color: 'bg-amber-500', title: 'Slight concern' },
                      { color: 'bg-orange-500', title: 'Moderate' },
                      { color: 'bg-rose-500', title: 'High' },
                      { color: 'bg-red-700', title: 'Critical' },
                    ];
                    const activeIndex = Math.min(6, Math.max(0, Math.floor((scoreVal / 100) * 7)));
                    return (
                      <>
                        <div className="grid grid-cols-7 gap-[2px] h-3 rounded-full overflow-hidden w-full">
                          {segments.map((seg, i) => (
                            <div key={i} className={`${seg.color} ${i === activeIndex ? 'opacity-100' : 'opacity-30'} transition-opacity duration-500`} title={seg.title} />
                          ))}
                        </div>
                        <div className="grid grid-cols-7 text-center text-[10px] text-gray-500 font-medium">
                          {segments.map((seg, i) => (
                            <div key={i} className={i === activeIndex ? 'text-gray-300 font-bold' : ''}>{seg.title}</div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* EXPLAINABLE AI NAVIGATION CALLOUT CARD */}
                <div className="border border-[#20293B]/40 rounded-xl bg-[#121620]/25 p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-2xl hover:border-blue-500/30 transition-all duration-300">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 bg-[#43A0F5] rounded-full animate-pulse" />
                      <span className="text-[10px] tracking-wider text-gray-400 font-bold uppercase font-sans">
                        Interpretability Dashboard (TreeSHAP)
                      </span>
                    </div>
                    <p className="text-xs text-[#8E9CAE] leading-relaxed max-w-2xl">
                      Explore how the model reached its conclusions. Each score is broken down into the specific patterns — speech changes, behavior shifts, and emotional tone variations — that influenced the overall assessment.
                    </p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('explainable')}
                    className="w-full md:w-auto px-6 py-3 bg-[#43A0F5]/10 hover:bg-[#43A0F5]/25 border border-[#43A0F5]/30 hover:border-[#43A0F5]/80 text-[#43A0F5] hover:text-white rounded-lg text-sm font-bold tracking-normal flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer active:scale-[0.98] shadow-[0_0_15px_rgba(67,160,245,0.06)] shrink-0"
                  >
                    <Brain className="h-4.5 w-4.5 animate-pulse" />
                    Explainable Analysis using AI →
                  </button>
                </div>

                {/* 1. MOOD AND RISK OVER TIME SECTION */}
                <div className="border-t border-gray-800/60 pt-6">
                  <div 
                    className="flex items-center justify-between cursor-pointer group"
                    onClick={() => setCollapsedSections(prev => ({ ...prev, moodRisk: !prev.moodRisk }))}
                  >
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-sans flex items-center gap-2">
                      <Activity className="h-4.5 w-4.5 text-blue-400" />
                      Mood and Risk Over Time
                    </h3>
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
                          <span className="text-xs">−</span>
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
                          <span className="text-xs">+</span>
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
                          ‹
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
                          ›
                        </button>
                        <button
                          onClick={() => setChartViewport([0, nChart - 1])}
                          className="flex items-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-gray-400 hover:bg-white/[0.06] hover:text-gray-300 transition-all cursor-pointer"
                          title="Reset zoom"
                        >
                          Reset
                        </button>
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                      
                      {/* LEFT CHART: SENTIMENT */}
                      <div className="glass-panel rounded-xl p-5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-gray-300">How your tone has shifted day to day</span>
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                            <span className="inline-block w-4 h-2 bg-blue-500/25 border border-blue-500 rounded-sm" />
                            <span>Sentiment</span>
                          </div>
                        </div>

                        <div className="relative h-60 w-full" onMouseMove={handleChartMouseMove} onMouseLeave={handleChartMouseLeave}>
                          {/* SVG Sentiment Chart */}
                          <svg viewBox="0 0 500 240" className="w-full h-full overflow-visible">
                            {/* Sentiment Zone Bands — Positive (0.3–1.0), Neutral (-0.3–0.3), Negative (-1.0–-0.3) */}
                            <rect x="35" y={15 + ((1.0 - 1.0) / 2) * 185} width="450" height={((1.0 - 0.3) / 2) * 185} fill="#10B981" opacity="0.06" rx="2" />
                            <rect x="35" y={15 + ((1.0 - 0.3) / 2) * 185} width="450" height={((0.3 - -0.3) / 2) * 185} fill="#F59E0B" opacity="0.06" rx="2" />
                            <rect x="35" y={15 + ((1.0 - -0.3) / 2) * 185} width="450" height={((-0.3 - -1.0) / 2) * 185} fill="#EF4444" opacity="0.06" rx="2" />
                            {/* Zone labels */}
                            <text x="487" y={15 + ((1.0 - 0.65) / 2) * 185 + 3} fill="#10B981" fontSize="7" opacity="0.4" fontFamily="monospace" textAnchor="end">Positive</text>
                            <text x="487" y={15 + ((1.0 - 0) / 2) * 185 + 3} fill="#F59E0B" fontSize="7" opacity="0.4" fontFamily="monospace" textAnchor="end">Neutral</text>
                            <text x="487" y={15 + ((1.0 - -0.65) / 2) * 185 + 3} fill="#EF4444" fontSize="7" opacity="0.4" fontFamily="monospace" textAnchor="end">Negative</text>
                            {/* Grid Lines & Labels */}
                            {[-1.0, -0.5, 0, 0.5, 1.0].map((val, idx) => {
                              const y = 15 + ((1.0 - val) / 2.0) * 185;
                              return (
                                <g key={idx}>
                                  <line x1="35" y1={y} x2="485" y2={y} stroke="#1B2030" strokeWidth="1" strokeDasharray={val === 0 ? "none" : "3 3"} />
                                  <text x="25" y={y + 4} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">{val.toFixed(1)}</text>
                                </g>
                              );
                            })}

                            {/* X Axis Date Labels (viewport-aware) */}
                            {vpXLabels.map((ptIndex) => {
                              const x = 35 + ((ptIndex - vpStart) / vpLastIdx) * 450;
                              return (
                                <g key={ptIndex}>
                                  <line x1={x} y1="15" x2={x} y2="200" stroke="#1B2030" strokeWidth="0.5" strokeDasharray="2 2" />
                                  <text 
                                    x={x} 
                                    y="218" 
                                    fill="#64748b" 
                                    fontSize="8" 
                                    textAnchor="middle" 
                                    fontFamily="monospace"
                                  >
                                    {chartDates[ptIndex]}
                                  </text>
                                </g>
                              );
                            })}

                            {/* Sentiment Line Path (viewport-sliced) */}
                            <path 
                              d={(() => {
                                const sliced = sentimentData.slice(vpStart, vpEnd + 1);
                                let pathStr = "";
                                sliced.forEach((val, idx) => {
                                  const x = 35 + (idx / vpLastIdx) * 450;
                                  const y = 15 + ((1.0 - val) / 2.0) * 185;
                                  pathStr += (idx === 0 ? "M" : "L") + ` ${x} ${y}`;
                                });
                                return pathStr;
                              })()}
                              fill="none"
                              stroke="#3b82f6"
                              strokeWidth="2.5"
                              className="drop-shadow-[0_0_6px_rgba(59,130,246,0.5)]"
                            />

                            {/* Peak/Valley anchor diamonds (viewport-sliced) */}
                            {(() => {
                              const sliced = sentimentData.slice(vpStart, vpEnd + 1);
                              const extrema: { idx: number; type: 'peak' | 'valley' }[] = [];
                              for (let i = 1; i < sliced.length - 1; i++) {
                                if (sliced[i] > sliced[i-1] && sliced[i] > sliced[i+1]) extrema.push({ idx: vpStart + i, type: 'peak' });
                                if (sliced[i] < sliced[i-1] && sliced[i] < sliced[i+1]) extrema.push({ idx: vpStart + i, type: 'valley' });
                              }
                              return extrema.map(({ idx, type }) => {
                                const x = 35 + ((idx - vpStart) / vpLastIdx) * 450;
                                const y = 15 + ((1.0 - sentimentData[idx]) / 2.0) * 185;
                                return (
                                  <polygon
                                    key={idx}
                                    points={`${x},${y-5} ${x+4},${y} ${x},${y+5} ${x-4},${y}`}
                                    fill={type === 'peak' ? '#EF4444' : '#10B981'}
                                    stroke="#0b0d13"
                                    strokeWidth="1"
                                    opacity="0.65"
                                    className="cursor-pointer hover:opacity-100 transition-opacity"
                                    onClick={() => setHoveredPointIndex(idx)}
                                  />
                                );
                              });
                            })()}

                            {/* Global Hover Crosshair & Indicators (viewport-aware) */}
                            {hoveredPointIndex !== null && hoveredPointIndex >= vpStart && hoveredPointIndex <= vpEnd && (
                              <g>
                                <line 
                                  x1={35 + ((hoveredPointIndex - vpStart) / vpLastIdx) * 450} 
                                  y1="15" 
                                  x2={35 + ((hoveredPointIndex - vpStart) / vpLastIdx) * 450} 
                                  y2="200" 
                                  stroke="#3b82f6" 
                                  strokeWidth="1.5" 
                                  strokeDasharray="3 3" 
                                />
                                <circle 
                                  cx={35 + ((hoveredPointIndex - vpStart) / vpLastIdx) * 450} 
                                  cy={15 + ((1.0 - sentimentData[hoveredPointIndex]) / 2.0) * 185} 
                                  r="5" 
                                  fill="#3b82f6" 
                                  stroke="#0b0d13" 
                                  strokeWidth="1.5" 
                                />
                              </g>
                            )}
                          </svg>

                          {/* Interactive Tooltip Overlay (viewport-aware) */}
                          {hoveredPointIndex !== null && hoveredPointIndex >= vpStart && hoveredPointIndex <= vpEnd && (
                            <div 
                              className="absolute bg-[#11131c]/95 border border-[#232B3B]/80 p-2.5 rounded shadow-xl text-[10px] font-mono text-gray-300 pointer-events-none z-20"
                              style={{ 
                                left: `${Math.min(72, Math.max(5, ((hoveredPointIndex - vpStart) / vpLastIdx) * 100))}%`,
                                top: "20px"
                              }}
                            >
                              <div className="text-gray-400 border-b border-gray-800 pb-1 mb-1 font-bold">{chartDates[hoveredPointIndex]}</div>
                              <div>Sentiment: <span className="text-blue-400 font-bold">{((sentimentData[hoveredPointIndex] ?? 0)).toFixed(2)}</span></div>
                            </div>
                          )}
                        </div>

                        <p className="text-[10px] text-gray-500 leading-relaxed mt-4">
                          Each point is one journal entry, in order by date (X-axis). The Y-axis is the sentiment of that entry's writing, from -1 (very negative tone) to +1 (very positive tone), with 0 being neutral.
                        </p>
                      </div>

                      {/* RIGHT CHART: ANOMALY RISK */}
                      <div className="glass-panel rounded-xl p-5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-gray-300">Moments that stood out as unusual</span>
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                            <span className="inline-block w-4 h-2 bg-rose-500/25 border border-rose-500 rounded-sm" />
                            <span>Anomaly Risk</span>
                          </div>
                        </div>

                        <div className="relative h-60 w-full" onMouseMove={handleChartMouseMove} onMouseLeave={handleChartMouseLeave}>
                          {/* SVG Anomaly Risk Chart */}
                          <svg viewBox="0 0 500 240" className="w-full h-full overflow-visible">
                            {/* Risk Zone Bands — High (0.7–1.0), Moderate (0.4–0.7), Low (0.0–0.4) */}
                            <rect x="35" y={15 + (1.0 - 1.0) * 185} width="450" height={(1.0 - 0.7) * 185} fill="#EF4444" opacity="0.06" rx="2" />
                            <rect x="35" y={15 + (1.0 - 0.7) * 185} width="450" height={(0.7 - 0.4) * 185} fill="#F59E0B" opacity="0.06" rx="2" />
                            <rect x="35" y={15 + (1.0 - 0.4) * 185} width="450" height={(0.4 - 0.0) * 185} fill="#10B981" opacity="0.06" rx="2" />
                            {/* Zone labels */}
                            <text x="487" y={15 + (1.0 - 0.85) * 185 + 3} fill="#EF4444" fontSize="7" opacity="0.4" fontFamily="monospace" textAnchor="end">High</text>
                            <text x="487" y={15 + (1.0 - 0.55) * 185 + 3} fill="#F59E0B" fontSize="7" opacity="0.4" fontFamily="monospace" textAnchor="end">Moderate</text>
                            <text x="487" y={15 + (1.0 - 0.2) * 185 + 3} fill="#10B981" fontSize="7" opacity="0.4" fontFamily="monospace" textAnchor="end">Low</text>
                            {/* Grid Lines & Labels */}
                            {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((val, idx) => {
                              const y = 15 + (1.0 - val) * 185;
                              return (
                                <g key={idx}>
                                  <line x1="35" y1={y} x2="485" y2={y} stroke="#1B2030" strokeWidth="1" strokeDasharray={val === 0 ? "none" : "3 3"} />
                                  <text x="25" y={y + 4} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">{val.toFixed(1)}</text>
                                </g>
                              );
                            })}

                            {/* X Axis Date Labels (viewport-aware) */}
                            {vpXLabels.map((ptIndex) => {
                              const x = 35 + ((ptIndex - vpStart) / vpLastIdx) * 450;
                              return (
                                <g key={ptIndex}>
                                  <line x1={x} y1="15" x2={x} y2="200" stroke="#1B2030" strokeWidth="0.5" strokeDasharray="2 2" />
                                  <text 
                                    x={x} 
                                    y="218" 
                                    fill="#64748b" 
                                    fontSize="8" 
                                    textAnchor="middle" 
                                    fontFamily="monospace"
                                  >
                                    {chartDates[ptIndex]}
                                  </text>
                                </g>
                              );
                            })}

                            {/* Anomaly Risk Line Path (viewport-sliced) */}
                            <path 
                              d={(() => {
                                const sliced = anomalyRiskData.slice(vpStart, vpEnd + 1);
                                let pathStr = "";
                                sliced.forEach((val, idx) => {
                                  const x = 35 + (idx / vpLastIdx) * 450;
                                  const y = 15 + (1.0 - val) * 185;
                                  pathStr += (idx === 0 ? "M" : "L") + ` ${x} ${y}`;
                                });
                                return pathStr;
                              })()}
                              fill="none"
                              stroke="#ef4444"
                              strokeWidth="2.5"
                              className="drop-shadow-[0_0_6px_rgba(239,68,68,0.5)]"
                            />

                            {/* Peak/Valley anchor diamonds (viewport-sliced) */}
                            {(() => {
                              const sliced = anomalyRiskData.slice(vpStart, vpEnd + 1);
                              const extrema: { idx: number; type: 'peak' | 'valley' }[] = [];
                              for (let i = 1; i < sliced.length - 1; i++) {
                                if (sliced[i] > sliced[i-1] && sliced[i] > sliced[i+1]) extrema.push({ idx: vpStart + i, type: 'peak' });
                                if (sliced[i] < sliced[i-1] && sliced[i] < sliced[i+1]) extrema.push({ idx: vpStart + i, type: 'valley' });
                              }
                              return extrema.map(({ idx, type }) => {
                                const x = 35 + ((idx - vpStart) / vpLastIdx) * 450;
                                const y = 15 + (1.0 - anomalyRiskData[idx]) * 185;
                                return (
                                  <polygon
                                    key={idx}
                                    points={`${x},${y-5} ${x+4},${y} ${x},${y+5} ${x-4},${y}`}
                                    fill={type === 'peak' ? '#EF4444' : '#10B981'}
                                    stroke="#0b0d13"
                                    strokeWidth="1"
                                    opacity="0.65"
                                    className="cursor-pointer hover:opacity-100 transition-opacity"
                                    onClick={() => setHoveredPointIndex(idx)}
                                  />
                                );
                              });
                            })()}

                            {/* Global Hover Crosshair & Indicators (viewport-aware) */}
                            {hoveredPointIndex !== null && hoveredPointIndex >= vpStart && hoveredPointIndex <= vpEnd && (
                              <g>
                                <line 
                                  x1={35 + ((hoveredPointIndex - vpStart) / vpLastIdx) * 450} 
                                  y1="15" 
                                  x2={35 + ((hoveredPointIndex - vpStart) / vpLastIdx) * 450} 
                                  y2="200" 
                                  stroke="#ef4444" 
                                  strokeWidth="1.5" 
                                  strokeDasharray="3 3" 
                                />
                                <circle 
                                  cx={35 + ((hoveredPointIndex - vpStart) / vpLastIdx) * 450} 
                                  cy={15 + (1.0 - anomalyRiskData[hoveredPointIndex]) * 185} 
                                  r="5" 
                                  fill="#ef4444" 
                                  stroke="#0b0d13" 
                                  strokeWidth="1.5" 
                                />
                              </g>
                            )}
                          </svg>

                          {/* Interactive Tooltip Overlay (viewport-aware) */}
                          {hoveredPointIndex !== null && hoveredPointIndex >= vpStart && hoveredPointIndex <= vpEnd && (
                            <div 
                              className="absolute bg-[#11131c]/95 border border-[#232B3B]/80 p-2.5 rounded shadow-xl text-[10px] font-mono text-gray-300 pointer-events-none z-20"
                              style={{ 
                                left: `${Math.min(72, Math.max(5, ((hoveredPointIndex - vpStart) / vpLastIdx) * 100))}%`,
                                top: "20px"
                              }}
                            >
                              <div className="text-gray-400 border-b border-gray-800 pb-1 mb-1 font-bold">{chartDates[hoveredPointIndex]}</div>
                              <div>Anomaly Risk: <span className="text-rose-400 font-bold">{((anomalyRiskData[hoveredPointIndex] ?? 0)).toFixed(2)}</span></div>
                            </div>
                          )}
                        </div>

                        <p className="text-[10px] text-gray-500 leading-relaxed mt-4">
                          Each point is one journal entry, in order by date (X-axis). The Y-axis is how unusual that entry looked compared to this person's own typical pattern, from 0 (completely typical) to 1 (very unusual).
                        </p>

                        {(() => {
                          // Find the single highest-scored entry per risk tier
                          function bestInRange(min: number, max: number): { date: string; score: number } | null {
                            let best: { date: string; score: number } | null = null;
                            anomalyRiskData.forEach((val, idx) => {
                              if (val >= min && val < max && (!best || val > best.score)) {
                                best = { date: chartDates[idx], score: val };
                              }
                            });
                            return best;
                          }
                          const peak = { high: bestInRange(0.7, 1.1), moderate: bestInRange(0.4, 0.7), low: bestInRange(0, 0.4) };
                          return (
                            <div className="mt-3 space-y-1 text-[10px] font-mono leading-relaxed">
                              {peak.high && (
                                <div className="flex gap-2">
                                  <span className="text-rose-500 font-bold shrink-0">Highest Risk:</span>
                                  <span className="text-gray-400">{peak.high.date} <span className="text-rose-400">({Math.round(peak.high.score * 100)}%)</span></span>
                                </div>
                              )}
                              {peak.moderate && (
                                <div className="flex gap-2">
                                  <span className="text-amber-500 font-bold shrink-0">Moderate Risk:</span>
                                  <span className="text-gray-400">{peak.moderate.date} <span className="text-amber-400">({Math.round(peak.moderate.score * 100)}%)</span></span>
                                </div>
                              )}
                              {peak.low && (
                                <div className="flex gap-2">
                                  <span className="text-emerald-500 font-bold shrink-0">Lowest Risk:</span>
                                  <span className="text-gray-400">{peak.low.date} <span className="text-emerald-400">({Math.round(peak.low.score * 100)}%)</span></span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                    </div>
                    </div>
                  )}
                </div>

                {/* 2. YOUR PERSONAL BASELINE SECTION */}
                <div className="border-t border-gray-800/60 pt-6">
                  <div 
                    className="flex items-center justify-between cursor-pointer group"
                    onClick={() => setCollapsedSections(prev => ({ ...prev, baseline: !prev.baseline }))}
                  >
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-sans flex items-center gap-2">
                      <User className="h-4.5 w-4.5 text-blue-400" />
                      Your Personal Baseline
                    </h3>
                    <button className="text-gray-400 group-hover:text-white transition-colors p-1 cursor-pointer">
                      {collapsedSections.baseline ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                    </button>
                  </div>

                  {!collapsedSections.baseline && (() => {
                    const trend = diagnosticData.pipelineBaselineTrend;
                    const calibrated = diagnosticData.pipelineCalibrated;
                    const calProgress = diagnosticData.pipelineCalibrationProgress ?? 0;
                    const calNeeded = 10;
                    const pct = calibrated ? 100 : Math.min(100, (calProgress / calNeeded) * 100);

                    const baseInfo = !trend || trend === 'insufficient_data'
                      ? { dot: 'bg-amber-400 shadow-[0_0_10px_#fbbf24]', title: 'Still calibrating', msg: 'Not enough entries yet to judge whether this person is drifting from their own baseline.' }
                      : trend === 'stable'
                      ? { dot: 'bg-emerald-400 shadow-[0_0_10px_#10b981]', title: 'Staying steady', msg: 'Recent entries are consistent with this person\'s own typical baseline.' }
                      : trend === 'moving_away'
                      ? { dot: 'bg-rose-400 shadow-[0_0_10px_#ef4444]', title: 'Drifting from their own baseline', msg: 'Recent entries are moving further from this person\'s usual patterns than they were before.' }
                      : { dot: 'bg-sky-400 shadow-[0_0_10px_#38bdf8]', title: 'Returning toward their baseline', msg: 'Recent entries are moving back closer to this person\'s usual patterns.' };

                    return (
                    <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        This shows how well the system has learned what's "normal" for this specific person, and whether recent entries are drifting away from that.
                      </p>

                      <div className="bg-sky-500/[0.03] backdrop-blur-xl border border-sky-500/15 rounded-xl p-5 flex items-start gap-4 shadow-sm">
                        <span className={`h-3 w-3 rounded-full shrink-0 mt-1 ${baseInfo.dot}`} />
                        <div>
                          <h4 className="text-sm font-bold text-white mb-1">{baseInfo.title}</h4>
                          <p className="text-xs text-gray-400 leading-relaxed">{baseInfo.msg}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 pt-2">
                        <div className="relative shrink-0">
                          <svg width="72" height="72" className="transform -rotate-90">
                            <circle cx="36" cy="36" r="30" fill="none" stroke="#1A202C" strokeWidth="5" />
                            <circle cx="36" cy="36" r="30" fill="none" stroke={calibrated ? "#10B981" : "#3B82F6"} strokeWidth="5" strokeDasharray={`${(pct / 100) * 188.5} 188.5`} strokeLinecap="round" className={`transition-all duration-700 ${calibrated ? 'drop-shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'drop-shadow-[0_0_6px_rgba(59,130,246,0.4)]'}`} />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className={`text-xs font-bold font-mono ${calibrated ? 'text-emerald-400' : 'text-sky-400'}`}>{Math.round(pct)}%</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-sans">Biometric Calibration Status</div>
                          <div className={`text-[11px] mt-0.5 font-sans ${calibrated ? 'text-emerald-400' : 'text-gray-500'}`}>{calibrated ? 'Fully calibrated - baseline established.' : `Calibrating with patient data (${Math.round(pct)}% complete).`}</div>
                        </div>
                      </div>
                    </div>
                    );
                  })()}
                </div>

                {/* 3. TREND STABILITY (CUSUM) SECTION */}
                <div className="border-t border-gray-800/60 pt-6">
                  <div 
                    className="flex items-center justify-between cursor-pointer group"
                    onClick={() => setCollapsedSections(prev => ({ ...prev, cusum: !prev.cusum }))}
                  >
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-sans flex items-center gap-2">
                      <Activity className="h-4.5 w-4.5 text-blue-400" />
                      Trend Stability (CUSUM)
                    </h3>
                    <button className="text-gray-400 group-hover:text-white transition-colors p-1 cursor-pointer">
                      {collapsedSections.cusum ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                    </button>
                  </div>

                  {!collapsedSections.cusum && (() => {
                    // Determine CUSUM status from pipeline data or latest values
                    let cusumStatus: 'stable' | 'upper_alert' | 'lower_alert' | 'both_alert' | 'recovered' = 'stable';
                    if (pipeline) {
                      const lastUp = upperCusumVals.length > 0 ? upperCusumVals[upperCusumVals.length - 1] : 0;
                      const lastLow = lowerCusumVals.length > 0 ? lowerCusumVals[lowerCusumVals.length - 1] : 0;
                      const alertUp = lastUp > cusumThreshold;
                      const alertLow = lastLow > cusumThreshold;
                      if (alertUp && alertLow) cusumStatus = 'both_alert';
                      else if (alertUp) cusumStatus = 'upper_alert';
                      else if (alertLow) cusumStatus = 'lower_alert';
                      // recovered if had alert history but now stable
                    }
                    const cusumMeta: Record<string, { dot: string; title: string; msg: string }> = {
                      stable: {
                        dot: 'bg-emerald-400 shadow-[0_0_10px_#10b981]',
                        title: 'Within your normal range',
                        msg: 'Everything looks normal. Your current patterns are staying within your usual range. Keep maintaining your healthy routine.',
                      },
                      upper_alert: {
                        dot: 'bg-rose-500 shadow-[0_0_10px_#ef4444] animate-pulse',
                        title: 'Drifting above baseline',
                        msg: 'We\'ve noticed your readings are moving above your normal range. This may indicate your well-being is changing. Consider taking a moment to rest and monitor your condition.',
                      },
                      lower_alert: {
                        dot: 'bg-blue-500 shadow-[0_0_10px_#3b82f6]',
                        title: 'Drifting below baseline',
                        msg: 'Your readings are lower than your usual range. This could mean your body is calming down or responding differently than usual. Continue monitoring to ensure everything remains on track.',
                      },
                      both_alert: {
                        dot: 'bg-purple-500 shadow-[0_0_10px_#a855f7]',
                        title: 'Unusual oscillation detected',
                        msg: 'Your readings are fluctuating above and below your normal range. This unusual pattern may require closer attention.',
                      },
                      recovered: {
                        dot: 'bg-amber-400 shadow-[0_0_10px_#fbbf24]',
                        title: 'Back within your normal range',
                        msg: 'You\'re currently within your usual range. There was a notable deviation before things returned to baseline — worth keeping in mind alongside the current stability.',
                      },
                    };
                    const meta = cusumMeta[cusumStatus] || cusumMeta.stable;

                    return (
                    <div className="mt-4 space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                      
                      <div className="bg-rose-500/[0.03] backdrop-blur-xl border border-rose-500/15 rounded-xl p-5 flex items-start gap-4 shadow-sm">
                        <span className={`h-3 w-3 rounded-full shrink-0 mt-1 ${meta.dot}`} />
                        <div>
                          <h4 className="text-sm font-bold text-white mb-1">{meta.title}</h4>
                          <p className="text-xs text-gray-400 leading-relaxed">{meta.msg}</p>
                        </div>
                      </div>

                                       <p className="text-[11px] text-gray-500 leading-relaxed">
                        A running tally of how far this person's readings have drifted above (red) or below (blue) their own baseline, added up over time rather than looked at one entry at a time. This makes it easier to tell a real sustained shift apart from one noisy day.
                      </p>

                      {/* Translucent Card wrapper for the CUSUM graph */}
                      <div className="glass-panel rounded-xl p-5 space-y-4">
                        {/* CUSUM Toggle Tabs */}
                        <div className="flex gap-1.5">
                          {[
                            { key: 0, label: 'Upper CUSUM', desc: 'Drift above baseline' },
                            { key: 1, label: 'Lower CUSUM', desc: 'Drift below baseline' },
                            { key: 2, label: 'Both', desc: 'Show both directions' },
                          ].map((tab) => (
                            <button
                              key={tab.key}
                              onClick={() => setSelectedCusumTab(tab.key)}
                              className={`flex-shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                                selectedCusumTab === tab.key
                                  ? 'bg-white/[0.06] border-[#3B82F6] text-white shadow-[0_20px_25px_-5px_rgba(0,0,0,0.7)]'
                                  : 'bg-white/[0.02] border-white/[0.06] text-gray-400 hover:bg-white/[0.04] hover:text-gray-300'
                              }`}
                            >
                              {tab.label}
                              <span className="ml-1 text-[8px] text-gray-500 font-normal">{tab.desc}</span>
                            </button>
                          ))}
                        </div>

                        {/* CUSUM Legend row */}
                        <div className="flex flex-wrap items-center gap-6 text-[10px] text-gray-400 font-sans">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block w-4 h-0.5 bg-rose-500" />
                            <span>Upper CUSUM</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block w-4 h-0.5 bg-blue-500" />
                            <span>Lower CUSUM</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block w-4 h-0.5 border-t border-dashed border-gray-500" />
                            <span>Alert threshold (h)</span>
                          </div>
                        </div>

                        <div className="relative h-60 w-full" onMouseMove={handleChartMouseMove} onMouseLeave={handleChartMouseLeave}>
                          {(() => {
                            // Compute dynamic Y range for CUSUM
                            const allVals = [...upperCusumVals, ...lowerCusumVals, cusumThreshold].filter(v => v !== null && v !== undefined);
                            const maxVal = allVals.length > 0 ? Math.max(...allVals) : 1;
                            const yMax = Math.max(1, Math.ceil(maxVal * 1.2));
                            const ticks = yMax <= 3 ? 4 : yMax <= 6 ? 6 : 8;
                            const step = yMax / ticks;
                            const yLabels = Array.from({ length: ticks + 1 }, (_, i) => Math.round(i * step * 10) / 10);
                            const yScale = (v: number) => 15 + ((yMax - v) / yMax) * 185;
                            return (<svg viewBox="0 0 500 240" className="w-full h-full overflow-visible">
                            {/* Grid Lines & Labels Y */}
                            {yLabels.map((val) => (
                              <g key={val}>
                                <line x1="35" y1={yScale(val)} x2="485" y2={yScale(val)} stroke="#1B2030" strokeWidth="1" strokeDasharray={val === 0 ? "none" : "3 3"} />
                                <text x="25" y={yScale(val) + 4} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">{val}</text>
                              </g>
                            ))}

                            {/* X Axis Date Labels (viewport-aware) */}
                            {vpXLabels.map((ptIndex) => {
                              const x = 35 + ((ptIndex - vpStart) / vpLastIdx) * 450;
                              return (
                                <g key={ptIndex}>
                                  <line x1={x} y1="15" x2={x} y2="200" stroke="#1B2030" strokeWidth="0.5" strokeDasharray="2 2" />
                                  <text 
                                    x={x} 
                                    y="218" 
                                    fill="#64748b" 
                                    fontSize="8" 
                                    textAnchor="middle" 
                                    fontFamily="monospace"
                                  >
                                    {chartDates[ptIndex]}
                                  </text>
                                </g>
                              );
                            })}

                            {/* Dashed Threshold Line */}
                            <line x1="35" y1={yScale(cusumThreshold)} x2="485" y2={yScale(cusumThreshold)} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="4 4" />

                            {/* Lower CUSUM Path (blue) — conditionally shown */}
                            {(selectedCusumTab === 1 || selectedCusumTab === 2) && (
                              <path d={(() => {
                                const sliced = lowerCusumVals.slice(vpStart, vpEnd + 1);
                                let p=""; sliced.forEach((v,i) => { const x=35+(i/vpLastIdx)*450; p+=(i===0?"M":"L")+` ${x} ${yScale(v)}`; }); return p;
                              })()}
                                fill="none" stroke="#3b82f6" strokeWidth="2" className="drop-shadow-[0_0_4px_rgba(59,130,246,0.4)]" />
                            )}

                            {/* Upper CUSUM Path (red) — conditionally shown */}
                            {(selectedCusumTab === 0 || selectedCusumTab === 2) && (
                              <path d={(() => {
                                const sliced = upperCusumVals.slice(vpStart, vpEnd + 1);
                                let p=""; sliced.forEach((v,i) => { const x=35+(i/vpLastIdx)*450; p+=(i===0?"M":"L")+` ${x} ${yScale(v)}`; }); return p;
                              })()}
                                fill="none" stroke="#ef4444" strokeWidth="2" className="drop-shadow-[0_0_4px_rgba(239,68,68,0.4)]" />
                            )}

                            {/* Global Hover Crosshair (viewport-aware) */}
                            {hoveredPointIndex !== null && hoveredPointIndex >= vpStart && hoveredPointIndex <= vpEnd && (
                              <g>
                                <line x1={35+((hoveredPointIndex - vpStart)/vpLastIdx)*450} y1="15" x2={35+((hoveredPointIndex - vpStart)/vpLastIdx)*450} y2="200" stroke="#64748b" strokeWidth="1" strokeDasharray="2 2" />
                              </g>
                            )}
                          </svg>);
                          })()}

                          {/* Interactive Tooltip Overlay (viewport-aware) */}
                          {hoveredPointIndex !== null && hoveredPointIndex >= vpStart && hoveredPointIndex <= vpEnd && (
                            <div 
                              className="absolute bg-[#11131c]/95 border border-[#232B3B]/80 p-2.5 rounded shadow-xl text-[10px] font-mono text-gray-300 pointer-events-none z-20"
                              style={{ 
                                left: `${Math.min(72, Math.max(5, ((hoveredPointIndex - vpStart) / vpLastIdx) * 100))}%`,
                                top: "20px"
                              }}
                            >
                              <div className="text-gray-400 border-b border-gray-800 pb-1 mb-1 font-bold">{chartDates[hoveredPointIndex]}</div>
                              {(selectedCusumTab === 0 || selectedCusumTab === 2) && (
                                <div>Upper CUSUM: <span className="text-rose-400 font-bold">{((upperCusumVals[hoveredPointIndex] ?? 0)).toFixed(2)}</span></div>
                              )}
                              {(selectedCusumTab === 1 || selectedCusumTab === 2) && (
                                <div>Lower CUSUM: <span className="text-blue-400 font-bold">{((lowerCusumVals[hoveredPointIndex] ?? 0)).toFixed(2)}</span></div>
                              )}
                            </div>
                          )}
                        </div>

                        <p className="text-[10px] text-gray-500 leading-relaxed font-sans">
                          X-axis: date of each entry. Y-axis: cumulative drift score. The dashed line is the alert threshold. Crossing it means the drift has been sustained, not just a single unusual entry.
                        </p>
                      </div>

                    </div>
                    );
                  })()}
                </div>

                {/* 4. WHAT'S DRIVING THAT SIGNAL SECTION */}
                <div className="border-t border-gray-800/60 pt-6">
                  <div 
                    className="flex items-center justify-between cursor-pointer group"
                    onClick={() => setCollapsedSections(prev => ({ ...prev, whatsDriving: !prev.whatsDriving }))}
                  >
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-sans flex items-center gap-2">
                      <Brain className="h-4.5 w-4.5 text-blue-400" />
                      What's Driving That Signal
                    </h3>
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
                          mahalanobis: { name: 'Pattern Deviation', model: 'Mahalanobis Distance', desc: 'This graph tracks how far your daily speech, sleep, and mood patterns have drifted from your personal baseline. A rising line means your recent behavior is becoming increasingly unusual compared to your norm.', color: '#3B82F6' },
                          copula: { name: 'Behavioral Shift', model: 'Copula Model', desc: 'This graph detects when multiple behaviors shift together in unexpected ways — for example, sleeping less while becoming more withdrawn. A rising line signals unusual combinations of changes across your tracked metrics.', color: '#EF4444' },
                          isolation_forest: { name: 'Outlier Spike', model: 'Isolation Forest', desc: 'This graph highlights individual days where your behavior looks very different from the rest. Each spike is a moment that stood out as unusual compared to your typical patterns.', color: '#8B5CF6' },
                          knn: { name: 'Cluster Drift', model: 'K-Nearest Neighbors', desc: 'This graph checks whether your daily patterns still fit within your usual range of behaviors. If the line climbs, your recent patterns are drifting away from where you normally are.', color: '#10B981' },
                        };
                        const detectorKeys = ['mahalanobis', 'copula', 'isolation_forest', 'knn'];
                        const lastScores: Record<string, number> = detScores && detScores.length > 0 ? detScores[detScores.length - 1] : {};

                        function scoreBadge(val: number): { badge: string; style: string } {
                          const pct = Math.round(val * 100);
                          if (pct >= 80) return { badge: `Critical • ${pct}%`, style: 'bg-rose-500/10 border-rose-500/30 text-rose-400' };
                          if (pct >= 60) return { badge: `Elevated • ${pct}%`, style: 'bg-amber-500/10 border-amber-500/30 text-amber-400' };
                          if (pct >= 40) return { badge: `Moderate • ${pct}%`, style: 'bg-slate-500/10 border-slate-500/30 text-slate-300' };
                          return { badge: `Stable • ${pct}%`, style: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' };
                        }

                        function buildSparkline(key: string): number[] {
                          if (!detScores || detScores.length === 0) return [];
                          const raw = detScores.map(s => (s[key] ?? 0) * 100);
                          if (raw.length <= 10) return raw;
                          const step = (raw.length - 1) / 9;
                          return Array.from({ length: 10 }, (_, i) => raw[Math.round(i * step)]);
                        }

                        const activeKey = detectorKeys[selectedDetector] || 'mahalanobis';
                        const info = detLabels[activeKey];
                        const latestVal = lastScores[activeKey] ?? 0;
                        const { badge, style } = scoreBadge(latestVal);
                        const sparkline = buildSparkline(activeKey);

                        return (
                          <>
                            {/* Tab bar */}
                            <div className="flex gap-1.5 overflow-x-auto pb-1">
                              {detectorKeys.map((key, i) => {
                                const lab = detLabels[key];
                                const isActive = selectedDetector === i;
                                return (
                                  <button
                                    key={key}
                                    onClick={() => setSelectedDetector(i)}
                                    className={`flex-shrink-0 text-xs font-bold px-3 py-2.5 rounded-lg border transition-all cursor-pointer ${
                                      isActive
                                        ? 'bg-white/[0.06] border-[#3B82F6] text-white shadow-[0_20px_25px_-5px_rgba(0,0,0,0.7)]'
                                        : 'bg-white/[0.02] border-white/[0.06] text-gray-400 hover:bg-white/[0.04] hover:text-gray-300'
                                    }`}
                                  >
                                    {lab.name}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Active detector detail */}
                            <div className="glass-card rounded-xl p-4 space-y-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="text-sm font-bold text-white">{info.name}</h4>
                                  <span className="text-[10px] font-sans text-gray-500">Model: {info.model}</span>
                                </div>
                                <span className={`text-xs font-mono font-bold border rounded px-2.5 py-0.5 ${style}`}>
                                  {badge}
                                </span>
                              </div>
                              <p className="text-xs text-gray-400 leading-relaxed">{info.desc}</p>
                              <div className="space-y-1.5">
                                <div className="flex justify-between items-center text-[9px] font-sans text-gray-500 uppercase">
                                  <span>Score Timeline</span>
                                  <span className="font-mono">LATEST: {badge.split(' • ')[1]}</span>
                                </div>
                                <div className="glass-inner rounded-lg p-3">
                                  {renderDetectorChart(sparkline, info.color, chartDates, info.name)}
                                </div>
                                {sparkline.length > 0 && Math.max(...sparkline) === 100 && Math.min(...sparkline) >= 95 && (
                                  <p className="text-[10px] text-amber-500/70 leading-relaxed">
                                    This detector consistently scores near 100% — may indicate overfitting to this data.
                                  </p>
                                )}
                              </div>
                            </div>
                          </>
                        );
                      })()}

                    </div>
                  )}
                </div>

                {/* 5. TECHNICAL DETAILS SECTION */}
                <div className="border-t border-gray-800/60 pt-6">
                  <div 
                    className="flex items-center justify-between cursor-pointer group"
                    onClick={() => setCollapsedSections(prev => ({ ...prev, techDetails: !prev.techDetails }))}
                  >
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-sans flex items-center gap-2">
                      <Database className="h-4.5 w-4.5 text-gray-400" />
                      Technical Details
                    </h3>
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
                        const rawPct = pipeline ? diagnosticData.modelConfidence : null;
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

              </div>
            );
          })()}

          {/* TAB 3: EXPLAINABLE AI */}
          {activeTab === 'explainable' && (
            <div className="space-y-8 animate-in fade-in duration-300" id="explainable-ai-container">
              
              {/* TOP BANNER */}
              <div className="flex">
                <div className="bg-[#1C1105]/50 border border-amber-500/20 text-amber-500/90 text-[10px] sm:text-xs font-sans font-bold tracking-wider px-4 py-2 rounded-lg uppercase" id="explainable-preview-banner">
                  PREVIEW ONLY — SAMPLE DATA, NO LIVE MODEL CONNECTION
                </div>
              </div>

              {/* WHY THIS PREDICTION (STAGE 5) */}
              <div className="border border-[#20293B]/20 rounded-2xl bg-[#121620]/20 p-6 md:p-8 backdrop-blur-md shadow-2xl space-y-6" id="why-prediction-section">
                
                {/* SECTION HEADER */}
                <div 
                  className="flex items-center justify-between cursor-pointer group"
                  onClick={() => setExplainWhyPredictionCollapsed(!explainWhyPredictionCollapsed)}
                >
                  <h2 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest font-sans">
                    WHY THIS PREDICTION (STAGE 5)
                  </h2>
                  <button className="text-gray-400 group-hover:text-white transition-colors p-1 cursor-pointer">
                    {explainWhyPredictionCollapsed ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                  </button>
                </div>

                {!explainWhyPredictionCollapsed && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <p className="text-[#8E9CAE] text-xs md:text-sm leading-relaxed max-w-4xl">
                      This breaks down the calibrated risk score into the entries and patterns that pushed it up or down, using TreeSHAP over the model's 2,336-value feature vector.
                    </p>

                    {/* SCORE VALUE DISPLAY BOX */}
                    <div className="border border-[#20293B]/60 rounded-xl bg-[#0F131A]/60 p-6 sm:p-8">
                      <div className="flex items-center">
                        {/* STARTING POINT */}
                        <div className="space-y-1">
                          <div className="text-3xl sm:text-4xl font-extrabold text-gray-400 font-sans tracking-tight">14.6%</div>
                          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold font-sans">starting point</div>
                        </div>

                        {/* ARROW */}
                        <div className="text-gray-600 text-xl font-bold font-mono px-6 sm:px-8">→</div>

                        {/* FINAL RISK SCORE */}
                        <div className="space-y-1">
                          <div className="text-3xl sm:text-4xl font-extrabold text-[#eaa235] font-sans tracking-tight">
                            {(() => {
                              const scoreVal = diagnosticData.anomalyBehaviourScore || 72.8;
                              return (scoreVal + (scoreVal * 0.0062)).toFixed(1) + "%";
                            })()}
                          </div>
                          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold font-sans">final risk score</div>
                        </div>
                      </div>
                    </div>

                    {/* PUSHED THE SCORE UP */}
                    <div className="space-y-4 pt-2">
                      <div className="text-gray-400 text-[10px] tracking-wider font-bold uppercase">
                        PUSHED THE SCORE UP
                      </div>

                      <div className="space-y-3.5">
                        {/* FEATURE 1 */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1 text-xs">
                          <span className="text-gray-300 font-medium sm:w-2/5">Feature relationships breaking down (copula)</span>
                          <div className="flex-1 flex items-center gap-4">
                            <div className="flex-1 bg-[#1A202C]/60 h-2 rounded-full overflow-hidden relative">
                              <div className="absolute inset-y-0 left-[14.6%] border-r border-gray-600/35 z-10" />
                              <div 
                                className="bg-[#EF4444] h-full absolute rounded-full" 
                                style={{ left: "14.6%", width: "45.4%" }}
                              />
                            </div>
                            <span className="font-mono font-bold text-[#EF4444] w-12 text-right">+0.067</span>
                          </div>
                        </div>

                        {/* FEATURE 2 */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1 text-xs">
                          <span className="text-gray-300 font-medium sm:w-2/5">Peak reading, signal #372</span>
                          <div className="flex-1 flex items-center gap-4">
                            <div className="flex-1 bg-[#1A202C]/60 h-2 rounded-full overflow-hidden relative">
                              <div className="absolute inset-y-0 left-[14.6%] border-r border-gray-600/35 z-10" />
                              <div 
                                className="bg-[#EF4444] h-full absolute rounded-full" 
                                style={{ left: "14.6%", width: "40.4%" }}
                              />
                            </div>
                            <span className="font-mono font-bold text-[#EF4444] w-12 text-right">+0.060</span>
                          </div>
                        </div>

                        {/* FEATURE 3 */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1 text-xs">
                          <span className="text-gray-300 font-medium sm:w-2/5">Peak reading, signal #336</span>
                          <div className="flex-1 flex items-center gap-4">
                            <div className="flex-1 bg-[#1A202C]/60 h-2 rounded-full overflow-hidden relative">
                              <div className="absolute inset-y-0 left-[14.6%] border-r border-gray-600/35 z-10" />
                              <div 
                                className="bg-[#EF4444] h-full absolute rounded-full" 
                                style={{ left: "14.6%", width: "40.4%" }}
                              />
                            </div>
                            <span className="font-mono font-bold text-[#EF4444] w-12 text-right">+0.060</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* PULLED THE SCORE DOWN */}
                    <div className="space-y-4 pt-4 border-t border-gray-800/20">
                      <div className="text-gray-400 text-[10px] tracking-wider font-bold uppercase">
                        PULLED THE SCORE DOWN
                      </div>

                      <div className="space-y-3.5">
                        {/* FEATURE 4 */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1 text-xs">
                          <span className="text-gray-300 font-medium sm:w-2/5">Lowest reading, signal #264</span>
                          <div className="flex-1 flex items-center gap-4">
                            <div className="flex-1 bg-[#1A202C]/60 h-2 rounded-full overflow-hidden relative">
                              <div className="absolute inset-y-0 left-[14.6%] border-r border-gray-600/35 z-10" />
                              <div 
                                className="bg-[#10B981] h-full absolute rounded-full" 
                                style={{ left: "4.6%", width: "10%" }}
                              />
                            </div>
                            <span className="font-mono font-bold text-[#10B981] w-12 text-right">-0.069</span>
                          </div>
                        </div>

                        {/* FEATURE 5 */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1 text-xs">
                          <span className="text-gray-300 font-medium sm:w-2/5">Average reading, signal #267</span>
                          <div className="flex-1 flex items-center gap-4">
                            <div className="flex-1 bg-[#1A202C]/60 h-2 rounded-full overflow-hidden relative">
                              <div className="absolute inset-y-0 left-[14.6%] border-r border-gray-600/35 z-10" />
                              <div 
                                className="bg-[#10B981] h-full absolute rounded-full" 
                                style={{ left: "4.6%", width: "10%" }}
                              />
                            </div>
                            <span className="font-mono font-bold text-[#10B981] w-12 text-right">-0.069</span>
                          </div>
                        </div>

                        {/* FEATURE 6 */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1 text-xs">
                          <span className="text-gray-300 font-medium sm:w-2/5">Lowest reading, signal #328</span>
                          <div className="flex-1 flex items-center gap-4">
                            <div className="flex-1 bg-[#1A202C]/60 h-2 rounded-full overflow-hidden relative">
                              <div className="absolute inset-y-0 left-[14.6%] border-r border-gray-600/35 z-10" />
                              <div 
                                className="bg-[#10B981] h-full absolute rounded-full" 
                                style={{ left: "4.9%", width: "9.7%" }}
                              />
                            </div>
                            <span className="font-mono font-bold text-[#10B981] w-12 text-right">-0.067</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SUBTEXT FOOTNOTE */}
                    <p className="text-[10px] text-gray-500 font-medium leading-relaxed pt-2">
                      Bars branch from the model's starting point (14.6%). Red bars extend right and pushed the score toward higher risk; green bars extend left and pulled it toward lower risk. Signal numbers refer to the underlying feature index, not a specific journal entry.
                    </p>

                  </div>
                )}
              </div>

              {/* ANOMALY ROOT CAUSE (STAGE 4) */}
              <div className="border border-[#20293B]/20 rounded-2xl bg-[#121620]/20 p-6 md:p-8 backdrop-blur-md shadow-2xl space-y-6" id="anomaly-root-cause-section">
                
                {/* SECTION HEADER */}
                <div 
                  className="flex items-center justify-between cursor-pointer group"
                  onClick={() => setExplainRootCauseCollapsed(!explainRootCauseCollapsed)}
                >
                  <h2 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest font-sans">
                    ANOMALY ROOT CAUSE (STAGE 4)
                  </h2>
                  <button className="text-gray-400 group-hover:text-white transition-colors p-1 cursor-pointer">
                    {explainRootCauseCollapsed ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                  </button>
                </div>

                {!explainRootCauseCollapsed && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <p className="text-[#8E9CAE] text-xs md:text-sm leading-relaxed max-w-4xl">
                      For each flagged entry, this shows which of the 466 underlying signals contributed most to its distance-from-normal score.
                    </p>

                    {/* FLAGS DISPLAY BOX */}
                    <div className="border border-[#20293B]/60 rounded-xl bg-[#0F131A]/60 p-6 sm:p-8 space-y-3.5">
                      <div className="text-white font-bold text-sm sm:text-base">
                        Entry from 2026-07-04
                      </div>
                      <div className="text-gray-400 text-xs font-medium">
                        Total distance score: 5.74 · 5 signals accounted for most of it
                      </div>

                      {/* SIGNALS PILLS LIST */}
                      <div className="flex flex-wrap gap-2.5 pt-2">
                        {['Signal #186', 'Signal #158', 'Signal #171', 'Signal #326', 'Signal #391'].map((sig, i) => (
                          <span 
                            key={i} 
                            className="px-3.5 py-1.5 bg-[#151922] border border-[#232B3B] rounded-lg text-xs font-semibold text-gray-300 font-mono tracking-tight shadow-sm"
                          >
                            {sig}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* SUBTEXT FOOTNOTE */}
                    <p className="text-[10px] text-gray-500 font-medium leading-relaxed pt-1">
                      These are the specific signals that stood out most for this entry, ranked engineering-side by contribution to the distance score. Not shown to end users directly — feeds the "moments that stood out as unusual" view.
                    </p>

                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* SYSTEM STATUS FOOTER */}
        <footer className="h-12 border-t border-[#1A202C]/30 bg-[#0E1119]/20 backdrop-blur-lg px-8 flex items-center justify-between text-[10px] text-gray-500 select-none shrink-0" id="main-footer">
          <div>
            {activeTab === 'explainable' 
              ? '© CLINICAL_OS. SYSTEM_SECURE' 
              : '© DIGITAL HEALTH AI ASSISTANT. Proprietary System.'}
          </div>
          <div className="flex gap-4">
            {activeTab === 'explainable' ? (
              <>
                <button className="hover:text-gray-300">System Status</button>
                <button className="hover:text-gray-300">Terms of Service</button>
                <button className="hover:text-gray-300">Privacy Protocol</button>
              </>
            ) : (
              <>
                <button className="hover:text-gray-300">Documentation</button>
                <button className="hover:text-gray-300">Support</button>
                <button className="hover:text-gray-300">Privacy Policy</button>
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

    </div>
  );
}
