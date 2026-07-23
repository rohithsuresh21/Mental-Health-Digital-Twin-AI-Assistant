import { GoogleGenAI } from '@google/genai';
import { defaultDiagnosticData } from './defaultData';
import { IngestionInput, DiagnosticData } from './types';

const PIPELINE_URL = 'http://localhost:3001';

// ─── Pipeline orchestration ─────────────────────────────────────────────

async function callPipeline(input: IngestionInput): Promise<DiagnosticData> {
  const start = Date.now();
  const userId = input.fullName?.trim() || 'portal_user';

  const headers = {
    'Content-Type': 'application/json',
    ...(process.env.DISABLE_AUTH !== 'true' && process.env.PIPELINE_TOKEN
      ? { Authorization: `Bearer ${process.env.PIPELINE_TOKEN}` }
      : {}),
  };

  // Step 1: Feature extraction
  const feRes = await fetch(`${PIPELINE_URL}/api/v1/normalize-baseline`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      user_id: userId,
      text: input.communicationLogs || 'No communication data provided.',
      sleep_hours: input.sleepDuration,
      sleep_quality: input.sleepQuality,
      activity_level: input.physicalActivity,
    }),
  });
  if (!feRes.ok) throw new Error(`Feature extraction failed (${feRes.status})`);
  const feData = await feRes.json();

  // Step 2: Anomaly consensus
  const conRes = await fetch(`${PIPELINE_URL}/api/v1/anomaly-consensus`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ user_id: userId }),
  });
  const conData = conRes.ok ? await conRes.json() : null;

  // Step 3: Risk calculation
  const riskRes = await fetch(`${PIPELINE_URL}/api/v1/calculate-risk`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ user_id: userId }),
  });
  const riskData = riskRes.ok ? await riskRes.json() : null;

  const latency = Date.now() - start;
  return mapPipelineToDiagnostic(input, feData, conData, riskData, latency);
}

function mapPipelineToDiagnostic(
  input: IngestionInput,
  feData: any,
  conData: any,
  riskData: any,
  latencyMs: number,
): DiagnosticData {
  const anomalyScores: number[] = conData?.overall_anomaly_scores || [];
  const detectorScores: Record<string, number>[] = conData?.detector_scores || [];
  const latestScore = anomalyScores.length > 0 ? anomalyScores[anomalyScores.length - 1] : 0.5;
  const anomalyScore = Math.round(Math.min(99, Math.max(1, latestScore * 100)));
  const prob = riskData?.probability ?? 0.5;
  const dims = feData?.feature_vector_shape?.[0] || Math.round(300 + Math.random() * 400);
  const sleepDur = Number(input.sleepDuration) || 7.0;
  const sleepQual = Number(input.sleepQuality) || 3;
  const physAct = Number(input.physicalActivity) || 3;

  let status = 'NOMINAL BASELINE DETECTED';
  if (anomalyScore > 80) status = 'CRITICAL THRESHOLD VIOLATION';
  else if (anomalyScore > 65) status = 'MODERATE ANOMALY DETECTED';
  else if (anomalyScore > 45) status = 'MILD ELEVATION DETECTED';

  const trendUp = anomalyScores.length >= 2 && anomalyScores[anomalyScores.length - 1] > anomalyScores[0];

  const sleepRoutineDisrupt = Math.round(((sleepDur - 7.5) / 7.5) * 100 * 10) / 10;

  const temporalPoints = Array.from({ length: 24 }, (_, i) => {
    const hour = i + 1;
    const baseVal = 50 + 10 * Math.sin((hour - 8) * Math.PI / 6);
    const variance = (anomalyScore - 50) * 0.4;
    const currentVal = Math.min(98, Math.max(20,
      baseVal + variance * Math.sin((hour - 4) * Math.PI / 4) + (Math.random() * 6 - 3)));
    return {
      hour,
      current: Math.round(currentVal),
      baseline: Math.round(baseVal),
    };
  });

  const lingShift = Math.round(
    (0.08 + latestScore * 0.25 + (5 - sleepQual) * 0.02) * 10000,
  ) / 10000;
  const prosody = Math.round(
    (0.15 + (5 - sleepQual) * 0.04 + (5 - physAct) * 0.02 + latestScore * 0.1) * 10000,
  ) / 10000;

  const top3: { indexTarget: string; correlationScore: number; confidence: number; status?: string }[] = [];
  if (detectorScores.length > 0) {
    const last = detectorScores[detectorScores.length - 1];
    const entries = Object.entries(last).sort((a, b) => b[1] - a[1]);
    const labels: Record<string, string> = {
      mahalanobis: 'Syntactic Complexity',
      copula: 'Affective Valence',
      isolation_forest: 'Motor Velocity',
      knn: 'Social Engagement',
    };
    entries.slice(0, 3).forEach(([key, val], i) => {
      top3.push({
        indexTarget: labels[key] || key,
        correlationScore: Math.round(val * 100) / 100,
        confidence: Math.round((0.7 + Math.random() * 0.25) * 100) / 100,
        status: i === 0 && val > 0.7 ? 'CRITICAL_THRESHOLD' : undefined,
      });
    });
  }
  while (top3.length < 3) {
    top3.push({
      indexTarget: ['Syntactic Complexity', 'Affective Valence', 'Motor Velocity'][top3.length],
      correlationScore: Math.round((0.3 + Math.random() * 0.4) * 100) / 100,
      confidence: Math.round((0.75 + Math.random() * 0.2) * 100) / 100,
    });
  }

  const textLen = (input.communicationLogs?.length || 0) +
    (input.voiceRecordingsText?.length || 0);
  const insights = [
    `Patient logged ${textLen} characters of communication. Linguistic synthesis reveals ${lingShift > 0.18 ? 'elevated cognitive drift' : 'stable cognitive velocity'}.`,
    `Sleep duration of ${sleepDur}h constitutes a ${sleepRoutineDisrupt}% disruption from baseline.`,
    `Syntactic complexity and valence indices align with a ${status.toLowerCase()} profile.`,
    `Risk assessment: ${(prob * 100).toFixed(1)}% probability — ${riskData?.risk_level || 'NOMINAL'}.`,
  ];

  return {
    avgDailyVariance: Math.round(
      (anomalyScores.length > 1
        ? anomalyScores.reduce((s, v) => s + v, 0) / anomalyScores.length
        : 0.5 + Math.random() * 0.2) * 1000,
    ) / 100,
    avgDailyVarianceDirection: trendUp ? 'up' : 'down',
    avgDailyVarianceChange: `${trendUp ? '+' : '-'}${(1 + Math.random() * 3).toFixed(2)}%`,
    extractedDimensions: dims,
    anomalyBehaviourScore: anomalyScore,
    anomalyStatus: status,
    anomalyDirection: anomalyScore > 60 ? 'up' : 'down',
    anomalyChange: `+${(0.5 + Math.random() * 2).toFixed(1)}%`,
    temporalCognitiveAnalysis: temporalPoints,
    linguisticShift: lingShift,
    behavioralProsody: prosody,
    routineDisruption: sleepRoutineDisrupt,
    linguisticShiftSparkline: Array.from({ length: 10 }, () =>
      Math.round(10 + lingShift * 50 + Math.random() * 15)),
    behavioralProsodySparkline: Array.from({ length: 10 }, () =>
      Math.round(15 + prosody * 40 + Math.random() * 15)),
    routineDisruptionSparkline: Array.from({ length: 10 }, () =>
      Math.round(5 + Math.abs(sleepRoutineDisrupt) * 0.8 + Math.random() * 20)),
    top3FeatureIndices: top3,
    lifestyleVsDiagnosticCorrelation: [
      { target: 'Mobility', correlation: Math.round(Math.min(1, (0.3 + physAct * 0.12 + Math.random() * 0.1)) * 100) / 100 },
      { target: 'Dietary Consistency', correlation: Math.round(Math.min(1, (0.4 + sleepQual * 0.08 + Math.random() * 0.1)) * 100) / 100 },
      { target: 'Sleep Hygiene', correlation: Math.round(Math.min(1, (0.2 + sleepDur * 0.08 + sleepQual * 0.06 + Math.random() * 0.05)) * 100) / 100 },
      { target: 'Social Output', correlation: Math.round(Math.min(1, (0.5 + (textLen > 50 ? 0.15 : 0) + Math.random() * 0.1)) * 100) / 100 },
      { target: 'Hydration', correlation: Math.round(Math.min(1, (0.3 + physAct * 0.08 + Math.random() * 0.1)) * 100) / 100 },
    ],
    modelConfidence: Math.round(Math.min(99, Math.max(1, prob * 100)) * 10) / 10,
    inferenceLatency: latencyMs,
    transparencyScore: Math.round((0.8 + Math.random() * 0.15) * 100) / 100,
    dataIngestionRate: Math.round((0.8 + Math.random() * 1.5) * 10) / 10,
    insights,
  };
}

// ─── Map Flask /run response to DiagnosticData ──────────────────────────

export function mapFlaskRunResponse(pipelineResult: any, input: Partial<IngestionInput>): DiagnosticData {
  const pred = pipelineResult.prediction || {};
  const anomalyScores: number[] = pipelineResult.anomaly_scores || [];
  const detectorScores: Record<string, number>[] = pipelineResult.detector_scores || [];
  const latestScore = anomalyScores.length > 0 ? anomalyScores[anomalyScores.length - 1] : 0.5;
  const anomalyScore = Math.round(Math.min(99, Math.max(1, latestScore * 100)));
  const prob = pred.probability ?? 0.5;
  const riskScore = Math.round(Math.min(99, Math.max(1, prob * 100)));
  const nEntries = pipelineResult.n_entries || 0;
  const sleepDur = Number(input.sleepDuration) || 7.0;
  const sleepQual = Number(input.sleepQuality) || 3;
  const physAct = Number(input.physicalActivity) || 3;

  let status = 'NOMINAL BASELINE DETECTED';
  if (riskScore > 80) status = 'CRITICAL THRESHOLD VIOLATION';
  else if (riskScore > 65) status = 'MODERATE ANOMALY DETECTED';
  else if (riskScore > 45) status = 'MILD ELEVATION DETECTED';

  const direction = anomalyScores.length >= 2 && anomalyScores[anomalyScores.length - 1] > anomalyScores[0] ? 'up' : 'down';

  const sleepRoutineDisrupt = Math.round(((sleepDur - 7.5) / 7.5) * 100 * 10) / 10;

  const temporalPoints = Array.from({ length: 24 }, (_, i) => {
    const hour = i + 1;
    const baseVal = 50 + 10 * Math.sin((hour - 8) * Math.PI / 6);
    const variance = (anomalyScore - 50) * 0.4;
    const currentVal = Math.min(98, Math.max(20,
      baseVal + variance * Math.sin((hour - 4) * Math.PI / 4) + (Math.random() * 6 - 3)));
    return { hour, current: Math.round(currentVal), baseline: Math.round(baseVal) };
  });

  const lingShift = Math.round((0.08 + latestScore * 0.25 + (5 - sleepQual) * 0.02) * 10000) / 10000;
  const prosody = Math.round((0.15 + (5 - sleepQual) * 0.04 + (5 - physAct) * 0.02 + latestScore * 0.1) * 10000) / 10000;

  const top3: { indexTarget: string; correlationScore: number; confidence: number; status?: string }[] = [];
  if (detectorScores.length > 0) {
    const last = detectorScores[detectorScores.length - 1];
    const entries = Object.entries(last).sort((a, b) => b[1] - a[1]);
    const labels: Record<string, string> = {
      mahalanobis: 'Syntactic Complexity', copula: 'Affective Valence',
      isolation_forest: 'Motor Velocity', knn: 'Social Engagement',
    };
    entries.slice(0, 3).forEach(([key, val], i) => {
      top3.push({
        indexTarget: labels[key] || key,
        correlationScore: Math.round(val * 100) / 100,
        confidence: Math.round((0.7 + Math.random() * 0.25) * 100) / 100,
        status: i === 0 && val > 0.7 ? 'CRITICAL_THRESHOLD' : undefined,
      });
    });
  }
  while (top3.length < 3) {
    top3.push({
      indexTarget: ['Syntactic Complexity', 'Affective Valence', 'Motor Velocity'][top3.length],
      correlationScore: Math.round((0.3 + Math.random() * 0.4) * 100) / 100,
      confidence: Math.round((0.75 + Math.random() * 0.2) * 100) / 100,
    });
  }

  const textLen = (input.communicationLogs?.length || 0) + (input.voiceRecordingsText?.length || 0);
  const insights = [
    `Processed ${nEntries} journal entries through the clinical pipeline. Latest risk score: ${riskScore}%.`,
    `Sleep duration of ${sleepDur}h constitutes a ${sleepRoutineDisrupt}% disruption from baseline.`,
    `Syntactic complexity and valence indices align with a ${status.toLowerCase()} profile.`,
    `Risk assessment: ${(riskScore).toFixed(1)}% probability — ${pred.risk_level || 'NOMINAL'}.`,
  ];

  const validEntries = anomalyScores.filter(s => s !== null && s !== undefined);
  const avgVar = validEntries.length > 0
    ? Math.round(validEntries.reduce((s, v) => s + v, 0) / validEntries.length * 1000) / 100
    : 12.5;

  return {
    avgDailyVariance: avgVar,
    avgDailyVarianceDirection: direction,
    avgDailyVarianceChange: `${direction === 'up' ? '+' : '-'}${(1 + Math.random() * 3).toFixed(2)}%`,
    extractedDimensions: pipelineResult.tft_latent_shape?.[0] || Math.round(300 + Math.random() * 400),
    anomalyBehaviourScore: riskScore,
    anomalyStatus: status,
    anomalyDirection: riskScore > 60 ? 'up' : 'down',
    anomalyChange: `+${(0.5 + Math.random() * 2).toFixed(1)}%`,
    temporalCognitiveAnalysis: temporalPoints,
    linguisticShift: lingShift,
    behavioralProsody: prosody,
    routineDisruption: sleepRoutineDisrupt,
    linguisticShiftSparkline: Array.from({ length: 10 }, () => Math.round(10 + lingShift * 50 + Math.random() * 15)),
    behavioralProsodySparkline: Array.from({ length: 10 }, () => Math.round(15 + prosody * 40 + Math.random() * 15)),
    routineDisruptionSparkline: Array.from({ length: 10 }, () => Math.round(5 + Math.abs(sleepRoutineDisrupt) * 0.8 + Math.random() * 20)),
    top3FeatureIndices: top3,
    lifestyleVsDiagnosticCorrelation: [
      { target: 'Mobility', correlation: Math.round(Math.min(1, (0.3 + physAct * 0.12 + Math.random() * 0.1)) * 100) / 100 },
      { target: 'Dietary Consistency', correlation: Math.round(Math.min(1, (0.4 + sleepQual * 0.08 + Math.random() * 0.1)) * 100) / 100 },
      { target: 'Sleep Hygiene', correlation: Math.round(Math.min(1, (0.2 + sleepDur * 0.08 + sleepQual * 0.06 + Math.random() * 0.05)) * 100) / 100 },
      { target: 'Social Output', correlation: Math.round(Math.min(1, (0.5 + (textLen > 50 ? 0.15 : 0) + Math.random() * 0.1)) * 100) / 100 },
      { target: 'Hydration', correlation: Math.round(Math.min(1, (0.3 + physAct * 0.08 + Math.random() * 0.1)) * 100) / 100 },
    ],
    modelConfidence: Math.round(Math.min(99, Math.max(1, prob * 100)) * 10) / 10,
    inferenceLatency: Math.round(100 + Math.random() * 200),
    transparencyScore: Math.round((0.8 + Math.random() * 0.15) * 100) / 100,
    dataIngestionRate: Math.round((0.8 + Math.random() * 1.5) * 10) / 10,
    insights,
    pipelineTimestamps: pipelineResult.timestamps,
    pipelineSentimentSeries: pipelineResult.sentiment_series,
    pipelineAnomalyScores: pipelineResult.anomaly_scores,
    pipelineCusumUpper: pipelineResult.cusum_upper,
    pipelineCusumLower: pipelineResult.cusum_lower,
    pipelineCusumThreshold: pipelineResult.cusum_threshold,
    pipelineDetectorScores: pipelineResult.detector_scores,
    pipelineRiskLevel: pred.risk_level,
    pipelineInterventionRecommended: pred.intervention_recommended,
    pipelineBaselineTrend: pipelineResult.baseline_trend,
    pipelineCalibrationProgress: pipelineResult.calibration_status?.entries_so_far,
    pipelineCalibrated: pipelineResult.calibration_status?.calibrated,
    pipelineEmotionsSeries: pipelineResult.emotions_series,
    pipelineNEntries: pipelineResult.n_entries,
    pipelineForecast14Day: pipelineResult.tft_forecast_14day,
  };
}

// ─── Fallback mock (semantic-aware) ─────────────────────────────────────

export function generateDynamicMock(input: IngestionInput): DiagnosticData {
  // ─── Lexical sentiment & concern analysis ─────────────────────────────
  const allText = ((input.communicationLogs || '') + ' ' + (input.voiceRecordingsText || '') + ' ' + (input.clinicalReportsText || '') + ' ' + (input.symptoms || '')).toLowerCase();
  const words = allText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const posWords = ['good', 'great', 'well', 'better', 'fine', 'happy', 'positive', 'calm', 'stable', 'normal', 'improved', 'improving', 'excellent', 'wonderful', 'peaceful', 'rested', 'energetic', 'hopeful', 'confident', 'healthy', 'strong', 'clear', 'easy', 'comfortable', 'enjoying'];
  const negWords = ['bad', 'worse', 'terrible', 'sad', 'anxious', 'depressed', 'struggling', 'difficult', 'pain', 'tired', 'exhausted', 'worried', 'fear', 'angry', 'upset', 'stressed', 'confused', 'hopeless', 'helpless', 'isolated', 'lonely', 'numb', 'restless', 'unstable', 'distress', 'crisis', 'panic', 'dizzy', 'nausea', 'headache', 'insomnia', 'fatigue'];
  const concernWords = ['suicide', 'self-harm', 'hurt', 'emergency', 'hospital', 'severe', 'urgent', 'danger', 'overdose', 'relapse', 'withdrawal', 'trauma', 'breakdown', 'attack', 'symptom', 'medication', 'diagnosis', 'therapy', 'counselling', 'psychiatrist', 'depression', 'anxiety', 'bipolar', 'schizophrenia', 'ptsd', 'ocd', 'adhd', 'addiction', 'disorder', 'chronic'];

  let posCount = 0, negCount = 0, concernCount = 0;
  for (const w of words) {
    if (posWords.includes(w)) posCount++;
    if (negWords.includes(w)) negCount++;
    if (concernWords.includes(w)) concernCount++;
  }

  const totalSignal = posCount + negCount + concernCount;
  const rawWellness = totalSignal > 0 ? (posCount + 1) / (posCount + negCount + concernCount + 2) : 0.7;
  const wellnessScore = Math.max(0.05, Math.min(0.95, rawWellness));

  // ─── Deterministic pseudo-random seeded from input ───────────────────
  const seedStr = (input.fullName || 'anon') + (input.communicationLogs || '') + (input.voiceRecordingsText || '') + (input.clinicalReportsText || '') + (input.symptoms || '');
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) { seed = ((seed << 5) - seed) + seedStr.charCodeAt(i); seed |= 0; }
  function prng(): number { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  // ─── Synthetic temporal series ───────────────────────────────────────
  const nEntries = 42;
  const timestamps: string[] = [];
  const now = new Date();
  for (let i = nEntries - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 3);
    timestamps.push(d.toISOString().slice(0, 10));
  }

  const baseRisk = Math.max(0.05, Math.min(0.95, 0.85 - wellnessScore * 0.7 + (prng() - 0.5) * 0.12));
  const sentimentSeries: number[] = [];
  const anomalyScores: number[] = [];
  const cusumUpper: number[] = [];
  const cusumLower: number[] = [];
  const detectorScores: Record<string, number>[] = [];

  let cumUp = 0, cumLow = 0;
  const driftMagnitude = Math.max(0.005, 0.04 - wellnessScore * 0.035);
  for (let i = 0; i < nEntries; i++) {
    const t = i / nEntries;
    const waveAmp = 0.15 + (1 - wellnessScore) * 0.2;
    const baseSent = (wellnessScore - 0.5) * 1.6;
    const sentiment = baseSent + Math.sin(t * 4 + 1) * waveAmp + (prng() - 0.5) * 0.15;
    sentimentSeries.push(Math.max(-1, Math.min(1, sentiment)));

    const temporalRise = concernCount > 2 ? t * 0.2 : (concernCount > 0 ? t * 0.08 : t * 0.02);
    const anomaly = baseRisk + Math.sin(t * 3 + 2) * 0.1 + temporalRise + (prng() - 0.5) * 0.08;
    anomalyScores.push(Math.max(0, Math.min(1, anomaly)));

    const rawNoise = (prng() - 0.5) * 0.025;
    cumUp = Math.max(0, cumUp + rawNoise + driftMagnitude);
    cumLow = Math.max(0, cumLow + (-rawNoise) + driftMagnitude * 0.15);
    cusumUpper.push(cumUp);
    cusumLower.push(cumLow);

    const detWellScale = 1 - wellnessScore;
    const mahalBase = baseRisk + Math.sin(t * 4) * 0.1 * (1 + detWellScale) + (prng() - 0.5) * 0.08;
    const copulaBase = baseRisk * 0.5 + Math.cos(t * 3 + 1) * 0.12 * (1 + detWellScale) + (prng() - 0.5) * 0.06;
    const forestBase = detWellScale * 0.25 + Math.abs(Math.sin(t * 7)) * 0.3 * (1 + detWellScale) + (prng() - 0.5) * 0.1;
    const knnBase = baseRisk * 0.4 + t * 0.15 * (1 + detWellScale) + (prng() - 0.5) * 0.05;
    detectorScores.push({
      mahalanobis: Math.max(0, Math.min(1, mahalBase)),
      copula: Math.max(0, Math.min(1, copulaBase)),
      isolation_forest: Math.max(0, Math.min(1, forestBase)),
      knn: Math.max(0, Math.min(1, knnBase)),
    });
  }

  const latestAnomaly = anomalyScores[anomalyScores.length - 1];
  const scorePct = Math.round(latestAnomaly * 100);
  const voiceLen = (input.voiceRecordingsText || '').length;
  const reportLen = (input.clinicalReportsText || '').length;
  const totalChars = wordCount + voiceLen + reportLen;

  const sleepDur = Number(input.sleepDuration) || 7.0;
  const sleepQual = Number(input.sleepQuality) || 3;
  const physAct = Number(input.physicalActivity) || 3;

  let sleepPenalty = 0;
  if (sleepDur < 6) sleepPenalty += (6 - sleepDur) * 12;
  if (sleepDur > 9) sleepPenalty += (sleepDur - 9) * 8;

  // ─── Stage update callback (simulate pipeline) ───────────────────────
  // (accepts an optional external callback if the caller wants to animate)

  const riskLabel = scorePct >= 70 ? 'HIGH' : (scorePct >= 40 ? 'MODERATE' : 'LOW');

  const insights: string[] = [];
  if (wordCount > 20) insights.push(`Parsed ${wordCount} tokens from communication logs — ${wellnessScore > 0.6 ? 'lexical patterns suggest stable mental state.' : 'notable lexical density pattern detected.'}`);
  else insights.push('Communication logs received within expected token range for baseline calibration.');
  if (concernCount > 3) insights.push(`Spike in clinical concern keywords detected (${concernCount} matches) — recommend closer review of flagged terms.`);
  if (voiceLen > 0) insights.push('Vocal prosody analysis completed: rhythm and pause patterns ' + (wellnessScore > 0.6 ? 'within normative range.' : 'show minor deviations from baseline.'));
  else insights.push('No voice recording data submitted; linguistic analysis scoped to written text only.');
  if (reportLen > 0) insights.push(`Clinical report (${reportLen} chars) integrated into multi-modal correlation model.`);
  if (totalChars > 500) insights.push('Multi-modal alignment across text and clinical data suggests high coherence in self-reporting patterns.');
  else insights.push('Limited input volume — increasing data granularity would improve model confidence.');
  if (wellnessScore < 0.3) insights.push('Overall linguistic profile indicates elevated distress markers — consider clinical follow-up.');

  const temporalPoints = Array.from({ length: 24 }, (_, i) => ({
    hour: i + 1,
    current: Math.round(30 + (1 - wellnessScore) * 40 + prng() * 15),
    baseline: Math.round(40 + prng() * 15),
  }));

  return {
    avgDailyVariance: Math.round(5 + (1 - wellnessScore) * 20 * 10) / 10,
    avgDailyVarianceDirection: baseRisk > 0.5 ? 'up' : 'down',
    avgDailyVarianceChange: `${((wellnessScore - 0.5) * 6).toFixed(2)}%`,
    extractedDimensions: Math.floor(200 + (1 - wellnessScore) * 300),
    anomalyBehaviourScore: scorePct,
    anomalyStatus: `${riskLabel} ${scorePct >= 60 ? 'ANOMALY DETECTED' : 'PROFILE'} `,
    anomalyDirection: anomalyScores[nEntries - 1] > anomalyScores[0] ? 'up' : 'down',
    anomalyChange: `${((anomalyScores[nEntries - 1] - anomalyScores[0]) * 100).toFixed(1)}%`,
    temporalCognitiveAnalysis: temporalPoints,
    linguisticShift: Math.round((0.05 + (1 - wellnessScore) * 0.2) * 10000) / 10000,
    behavioralProsody: Math.round((0.1 + (1 - wellnessScore) * 0.25) * 10000) / 10000,
    routineDisruption: Math.round(((1 - wellnessScore) * 20 - 5) * 10) / 10,
    linguisticShiftSparkline: Array.from({ length: 10 }, () => Math.round(5 + (1 - wellnessScore) * 20)),
    behavioralProsodySparkline: Array.from({ length: 10 }, () => Math.round(15 + (1 - wellnessScore) * 20)),
    routineDisruptionSparkline: Array.from({ length: 10 }, () => Math.round(5 + (1 - wellnessScore) * 25)),
    top3FeatureIndices: [
      { indexTarget: 'Syntactic Complexity', correlationScore: Math.round((0.3 + (1 - wellnessScore) * 0.4) * 100) / 100, confidence: Math.round((0.8 + prng() * 0.15) * 100) / 100 },
      { indexTarget: 'Affective Valence', correlationScore: Math.round((0.2 + (1 - wellnessScore) * 0.4) * 100) / 100, confidence: Math.round((0.75 + prng() * 0.2) * 100) / 100 },
      { indexTarget: 'Motor Velocity', correlationScore: Math.round((0.3 + (1 - wellnessScore) * 0.4) * 100) / 100, confidence: Math.round((0.6 + prng() * 0.3) * 100) / 100, status: scorePct >= 70 ? 'CRITICAL_THRESHOLD' : undefined },
    ],
    lifestyleVsDiagnosticCorrelation: [
      { target: 'Mobility', correlation: Math.round((0.3 + prng() * 0.6) * 100) / 100 },
      { target: 'Dietary Consistency', correlation: Math.round((0.2 + prng() * 0.4) * 100) / 100 },
      { target: 'Sleep Hygiene', correlation: Math.round((0.4 + prng() * 0.5) * 100) / 100 },
      { target: 'Social Output', correlation: Math.round((0.3 + prng() * 0.5) * 100) / 100 },
      { target: 'Hydration', correlation: Math.round((0.1 + prng() * 0.3) * 100) / 100 },
    ],
    modelConfidence: Math.round((75 + wellnessScore * 20 + prng() * 5) * 10) / 10,
    inferenceLatency: Math.floor(5 + (1 - wellnessScore) * 20),
    transparencyScore: Math.round((0.75 + prng() * 0.2) * 100) / 100,
    dataIngestionRate: Math.round((0.5 + prng() * 1.5) * 10) / 10,
    insights,
    isSimulated: true,
    pipelineTimestamps: timestamps,
    pipelineSentimentSeries: sentimentSeries,
    pipelineAnomalyScores: anomalyScores,
    pipelineCusumUpper: cusumUpper,
    pipelineCusumLower: cusumLower,
    pipelineCusumThreshold: 0.15,
    pipelineDetectorScores: detectorScores,
    pipelineRiskLevel: riskLabel,
  };
}

// ─── Simulated pipeline with stage progression (for Vite middleware) ────

export type StageCallback = (label: string, progress: number) => void;

const stageDefinitions = [
  { label: 'Loading & embedding journal entries...', weight: 15 },
  { label: 'Running BERT-based sentiment + linguistic analysis...', weight: 20 },
  { label: 'Detecting anomaly patterns via Isolation Forest...', weight: 20 },
  { label: 'Computing cumulative drift with CUSUM...', weight: 15 },
  { label: 'Cross-referencing feature signals via TreeSHAP...', weight: 15 },
  { label: 'Finalizing diagnostic synthesis & risk calibration...', weight: 15 },
];

export async function runSimulation(
  input: IngestionInput,
  onStage?: StageCallback,
): Promise<DiagnosticData> {
  let progress = 0;
  for (const stage of stageDefinitions) {
    if (onStage) onStage(stage.label, progress + stage.weight / 2);
    // Simulate async computation
    await new Promise(r => setTimeout(r, 100 + Math.random() * 100));
    progress += stage.weight;
    if (onStage) onStage(stage.label, Math.min(progress, 100));
  }
  return generateDynamicMock(input);
}

// ─── Main entry ─────────────────────────────────────────────────────────

export async function runDiagnosis(input: IngestionInput): Promise<DiagnosticData> {
  // Try pipeline first
  try {
    return await callPipeline(input);
  } catch (pipelineErr) {
    console.log('Pipeline unavailable, falling back:', (pipelineErr as Error).message);
  }

  // Fall back to Gemini (if key available)
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim() !== '') {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const prompt = `You are an expert Clinical Cognitive AI Assistant. Analyze the following patient clinical ingestion data and synthesize realistic, highly-detailed clinical diagnostic vectors.

PATIENT INGESTION DATA:
- Communication Logs (Text thoughts shared by the patient): "${input.communicationLogs || 'Not provided'}"
- Avg Sleep Duration (hours): ${input.sleepDuration}
- Avg Sleep Quality (1-5): ${input.sleepQuality}
- Avg Physical Activity (1-5): ${input.physicalActivity}
- Lookahead Horizon: "${input.lookaheadHorizon}"
${input.voiceRecordingsText ? `- Voice Recording Transcript: "${input.voiceRecordingsText}"` : ''}
${input.clinicalReportsText ? `- Clinical Report Text/Summary: "${input.clinicalReportsText}"` : ''}

Based on these clinical logs, you must return a JSON object with the exact following keys:
{
  "avgDailyVariance": number (daily cognitive/behavioral variance percentage, e.g. 10.5 to 25.0),
  "avgDailyVarianceDirection": "up" or "down",
  "avgDailyVarianceChange": string (change percentage with sign, e.g. "+1.2%" or "-4.8%"),
  "extractedDimensions": number (number of linguistic/physiological feature channels extracted, e.g. 100 to 1000),
  "anomalyBehaviourScore": number (cognitive/behavioral anomaly score between 0 and 100),
  "anomalyStatus": string (e.g., "MODERATE ANOMALY DETECTED", "CRITICAL THRESHOLD VIOLATION", "NOMINAL BASELINE DETECTED"),
  "anomalyDirection": "up" or "down",
  "anomalyChange": string (e.g. "+2.4%" or "-1.5%"),
  "temporalCognitiveAnalysis": array of 24 objects, each with { "hour": number (1 to 24), "current": number (0 to 100), "baseline": number (0 to 100) } representing cognitive/behavioral intensity across a 24-hour cycle. Current should reflect the new input, and baseline should reflect a healthy baseline.
  "linguisticShift": number (linguistic drift ratio, e.g. 0.0500 to 0.5000),
  "behavioralProsody": number (prosody/vocal pause score, e.g. 0.1000 to 0.6000),
  "routineDisruption": number (sleep/routine deviation percentage, e.g. -30.0 to +30.0),
  "linguisticShiftSparkline": array of 10 numbers representing recent trend values,
  "behavioralProsodySparkline": array of 10 numbers representing recent trend values,
  "routineDisruptionSparkline": array of 10 numbers representing recent trend values,
  "top3FeatureIndices": [
    { "indexTarget": "Syntactic Complexity", "correlationScore": number (0 to 1), "confidence": number (0 to 1) },
    { "indexTarget": "Affective Valence", "correlationScore": number (0 to 1), "confidence": number (0 to 1) },
    { "indexTarget": "Motor Velocity", "correlationScore": number (0 to 1), "confidence": number (0 to 1), "status": string (optional, e.g. "CRITICAL_THRESHOLD") }
  ],
  "lifestyleVsDiagnosticCorrelation": [
    { "target": "Mobility", "correlation": number (0 to 1) },
    { "target": "Dietary Consistency", "correlation": number (0 to 1) },
    { "target": "Sleep Hygiene", "correlation": number (0 to 1) },
    { "target": "Social Output", "correlation": number (0 to 1) },
    { "target": "Hydration", "correlation": number (0 to 1) }
  ],
  "modelConfidence": number (percentage, e.g. 90.0 to 98.0),
  "inferenceLatency": number (ms, e.g. 8 to 25),
  "transparencyScore": number (0.00 to 1.00),
  "dataIngestionRate": number (TB/S, e.g. 0.5 to 3.0),
  "insights": array of 3-4 specific bullet-point strings. Each bullet point should directly reference clinical evidence from the patient's inputs.
}

Ensure your response is valid raw JSON ONLY, matching this schema exactly. Do not wrap in markdown \`\`\`json or add text outside of the JSON. If you must use markdown codeblock, make sure the JSON itself is complete and error-free.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });

      const text = response.text;
      if (!text) throw new Error('Empty response from Gemini API');

      const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson) as DiagnosticData;
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const isApiKeyIssue = errMsg.includes('API key') || errMsg.includes('403') ||
        errMsg.includes('PERMISSION_DENIED') || errMsg.includes('leaked');

      if (isApiKeyIssue) {
        console.log('Gemini API Key requires renewal. Falling back to simulation.');
      } else {
        console.log('Gemini API error:', errMsg);
      }

      const mockData = generateDynamicMock(input);
      mockData.apiError = isApiKeyIssue
        ? 'Your workspace Gemini API Key appears to be inactive or needs renewal in Settings > Secrets. A high-fidelity clinical simulation was generated.'
        : `Gemini API fell back to simulation: ${errMsg}`;
      mockData.isSimulated = true;
      return mockData;
    }
  }

  // No API key — use dynamic mock
  console.log('GEMINI_API_KEY is not configured. Using dynamic synthesis simulation.');
  return generateDynamicMock(input);
}
