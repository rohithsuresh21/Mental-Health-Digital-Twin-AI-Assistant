import { DiagnosticData } from './types';

export const defaultDiagnosticData: DiagnosticData = {
  avgDailyVariance: 14.2,
  avgDailyVarianceDirection: 'down',
  avgDailyVarianceChange: '-3.59%',
  extractedDimensions: 466,
  anomalyBehaviourScore: 74,
  anomalyStatus: 'MODERATE ANOMALY DETECTED',
  anomalyDirection: 'up',
  anomalyChange: '+2.4%',
  temporalCognitiveAnalysis: [
    { hour: 1, current: 40, baseline: 48 },
    { hour: 2, current: 43, baseline: 47 },
    { hour: 3, current: 50, baseline: 46 },
    { hour: 4, current: 78, baseline: 49 },
    { hour: 5, current: 50, baseline: 52 },
    { hour: 6, current: 38, baseline: 51 },
    { hour: 7, current: 72, baseline: 53 },
    { hour: 8, current: 75, baseline: 54 },
    { hour: 9, current: 70, baseline: 55 },
    { hour: 10, current: 76, baseline: 56 },
    { hour: 11, current: 58, baseline: 54 },
    { hour: 12, current: 35, baseline: 50 },
    { hour: 13, current: 40, baseline: 48 },
    { hour: 14, current: 38, baseline: 47 },
    { hour: 15, current: 32, baseline: 45 },
    { hour: 16, current: 68, baseline: 48 },
    { hour: 17, current: 48, baseline: 50 },
    { hour: 18, current: 75, baseline: 52 },
    { hour: 19, current: 48, baseline: 51 },
    { hour: 20, current: 50, baseline: 49 },
    { hour: 21, current: 42, baseline: 47 },
    { hour: 22, current: 38, baseline: 48 },
    { hour: 23, current: 70, baseline: 50 },
    { hour: 24, current: 40, baseline: 48 }
  ],
  linguisticShift: 0.1420,
  behavioralProsody: 0.2850,
  routineDisruption: -12.7,
  linguisticShiftSparkline: [12, 14, 11, 15, 13, 16, 15, 18, 17, 19],
  behavioralProsodySparkline: [28, 26, 29, 27, 25, 26, 24, 23, 22, 20],
  routineDisruptionSparkline: [5, 6, 8, 12, 15, 14, 18, 22, 21, 24],
  top3FeatureIndices: [
    { indexTarget: 'Syntactic Complexity', correlationScore: 0.55, confidence: 0.94 },
    { indexTarget: 'Affective Valence', correlationScore: 0.33, confidence: 0.88 },
    { indexTarget: 'Motor Velocity', correlationScore: 0.72, confidence: 0.72, status: 'CRITICAL_THRESHOLD' }
  ],
  lifestyleVsDiagnosticCorrelation: [
    { target: 'Mobility', correlation: 0.88 },
    { target: 'Dietary Consistency', correlation: 0.42 },
    { target: 'Sleep Hygiene', correlation: 0.92 },
    { target: 'Social Output', correlation: 0.68 },
    { target: 'Hydration', correlation: 0.24 }
  ],
  modelConfidence: 94.2,
  inferenceLatency: 12,
  transparencyScore: 0.89,
  dataIngestionRate: 1.4,
  insights: [
    'Elevated syntactic complexity (0.55 correlation, 0.94 confidence) indicates high cognitive activity during verbal logs.',
    'Slight behavioral prosody shifts (0.2850) correlate with minor emotional stress indicators during voice recordings.',
    'Severe routine sleep disruption of -12.7% detected, directly impacting daily motor velocity score and stability.',
    'Multi-modal alignment suggests high coherence across textual expression, biometric duration, and physical mobility.'
  ]
};
