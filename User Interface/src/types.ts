export interface TemporalPoint {
  hour: number;
  current: number;
  baseline: number;
}

export interface FeatureIndex {
  indexTarget: string;
  correlationScore: number;
  confidence: number;
  status?: string;
}

export interface CorrelationPoint {
  target: string;
  correlation: number;
}

export interface DiagnosticData {
  avgDailyVariance: number;
  avgDailyVarianceDirection: 'up' | 'down';
  avgDailyVarianceChange: string;
  extractedDimensions: number;
  anomalyBehaviourScore: number;
  anomalyStatus: string;
  anomalyDirection: 'up' | 'down';
  anomalyChange: string;
  temporalCognitiveAnalysis: TemporalPoint[];
  linguisticShift: number;
  behavioralProsody: number;
  routineDisruption: number;
  linguisticShiftSparkline: number[];
  behavioralProsodySparkline: number[];
  routineDisruptionSparkline: number[];
  top3FeatureIndices: FeatureIndex[];
  lifestyleVsDiagnosticCorrelation: CorrelationPoint[];
  modelConfidence: number;
  inferenceLatency: number;
  transparencyScore: number;
  dataIngestionRate: number;
  insights: string[];
  apiError?: string;
  isSimulated?: boolean;
  // Pipeline-native data for charts
  pipelineTimestamps?: string[];
  pipelineSentimentSeries?: number[];
  pipelineAnomalyScores?: number[];
  pipelineCusumUpper?: number[];
  pipelineCusumLower?: number[];
  pipelineCusumThreshold?: number;
  pipelineDetectorScores?: Record<string, number>[];
  pipelineRiskLevel?: string;
  pipelineInterventionRecommended?: boolean;
  pipelineBaselineTrend?: string;
  pipelineCalibrationProgress?: number;
  pipelineCalibrated?: boolean;
  pipelineEmotionsSeries?: string[];
  pipelineNEntries?: number;
}

export interface IngestionInput {
  communicationLogs: string;
  sleepDuration: number;
  sleepQuality: number;
  physicalActivity: number;
  lookaheadHorizon: string;
  voiceRecordingsText?: string;
  clinicalReportsText?: string;
  fullName?: string;
  age?: number;
  gender?: string;
  bloodType?: string;
  medicalHistory?: string;
  symptoms?: string;
  docFileContent?: string;
  docFileName?: string;
  dobDay?: string;
  dobMonth?: string;
  dobYear?: string;
}
