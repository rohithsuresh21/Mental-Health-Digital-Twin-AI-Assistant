import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import axios, { AxiosError } from 'axios';
import { createClient } from 'redis';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ─── Redis client (CUSUM state persistence) ────────────────────────────────
const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redis.on('error', (err) => console.error('Redis error:', err));
redis.connect().catch(console.error);

// ─── Middleware ─────────────────────────────────────────────────────────────

const standardLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

const validateToken: express.RequestHandler = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header. Expected: Bearer <token>' });
  }
  next();
};

function handleCalibrationRequest(req: Request, res: Response, next: NextFunction): void {
  const method = req.body?.calibration_method;
  if (method && method !== 'platt') {
    res.status(400).json({ error: "Unsupported calibration method. Only 'platt' is accepted at this time." });
    return;
  }
  next();
}

// ─── forwardToService helper ───────────────────────────────────────────────

const ML_BASE = process.env.ML_BASE_URL || 'http://localhost:5000';

const ML_SERVICES = {
  FEATURE_EXTRACTOR: `${ML_BASE}/internal/feature-extractor`,
  CALIBRATION: `${ML_BASE}/internal/calibration`,
  FORECASTER: `${ML_BASE}/internal/forecaster`,
  CONSENSUS: `${ML_BASE}/internal/consensus`,
  RISK_CALCULATOR: `${ML_BASE}/internal/risk-calculator`,
  EXPLAINER: `${ML_BASE}/internal/explainer`,
};

async function forwardToService(serviceUrl: string, reqBody: any, res: Response): Promise<void> {
  try {
    const response = await axios.post(serviceUrl, reqBody, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000,
    });
    res.status(response.status).json(response.data);
  } catch (err) {
    if (err instanceof AxiosError) {
      const status = err.response?.status || 502;
      const data = err.response?.data || { error: 'Upstream service unavailable' };
      res.status(status).json(data);
    } else {
      res.status(502).json({ error: 'Upstream service error' });
    }
  }
}

// ─── CUSUM Redis persistence helpers ───────────────────────────────────────

const CUSUM_REDIS_PREFIX = 'cusum:';
const CUSUM_TTL_SEC = 30 * 24 * 60 * 60;

interface CusumState {
  mu_0: number;
  sigma: number;
  cusum_upper: number;
  cusum_lower: number;
  k: number;
  h: number;
}

async function readCusumState(userId: string): Promise<CusumState | null> {
  const key = `${CUSUM_REDIS_PREFIX}${userId}`;
  const data = await redis.hGetAll(key);
  if (!data || Object.keys(data).length === 0) return null;
  return {
    mu_0: parseFloat(data.mu_0),
    sigma: parseFloat(data.sigma),
    cusum_upper: parseFloat(data.cusum_upper),
    cusum_lower: parseFloat(data.cusum_lower),
    k: parseFloat(data.k),
    h: parseFloat(data.h),
  };
}

async function writeCusumState(userId: string, state: CusumState): Promise<void> {
  const key = `${CUSUM_REDIS_PREFIX}${userId}`;
  await redis.hSet(key, {
    mu_0: state.mu_0.toString(),
    sigma: state.sigma.toString(),
    cusum_upper: state.cusum_upper.toString(),
    cusum_lower: state.cusum_lower.toString(),
    k: state.k.toString(),
    h: state.h.toString(),
  });
  await redis.expire(key, CUSUM_TTL_SEC);
}

// ─── Routes ────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Layer 2 — Baseline calibration and Z-scoring
app.post(
  '/api/v1/normalize-baseline',
  standardLimiter,
  validateToken,
  async (req, res) => {
    await forwardToService(ML_SERVICES.FEATURE_EXTRACTOR, req.body, res);
  }
);

// Layer 3 — TFT forecaster
app.post(
  '/api/v1/forecast',
  standardLimiter,
  validateToken,
  async (req, res) => {
    await forwardToService(ML_SERVICES.FORECASTER, req.body, res);
  }
);

// Layer 4 — Multi-detector anomaly consensus
app.post(
  '/api/v1/anomaly-consensus',
  standardLimiter,
  validateToken,
  async (req, res) => {
    const userId = req.body?.user_id;
    if (userId) {
      const cusumState = await readCusumState(userId);
      if (cusumState) {
        req.body._cusum_state = cusumState;
      }
    }
    await forwardToService(ML_SERVICES.CONSENSUS, req.body, res);
    if (userId && res.statusCode < 400 && res.locals.cusum_state) {
      await writeCusumState(userId, res.locals.cusum_state);
    }
  }
);

// Layer 5 — Risk calibration
app.post(
  '/api/v1/calibrate-risk',
  standardLimiter,
  validateToken,
  handleCalibrationRequest,
  async (req, res) => {
    await forwardToService(ML_SERVICES.CALIBRATION, req.body, res);
  }
);

// Layer 5 — Risk explanation
app.post(
  '/api/v1/explain-risk',
  standardLimiter,
  validateToken,
  handleCalibrationRequest,
  async (req, res) => {
    await forwardToService(ML_SERVICES.EXPLAINER, req.body, res);
  }
);

// Layer 5 — Risk calculator (direct)
app.post(
  '/api/v1/calculate-risk',
  standardLimiter,
  validateToken,
  async (req, res) => {
    await forwardToService(ML_SERVICES.RISK_CALCULATOR, req.body, res);
  }
);

// ─── Start ─────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Gateway running on http://localhost:${PORT}`);
  console.log(`Routing ML requests to ${ML_BASE}`);
  console.log('Routes:');
  console.log('  POST /api/v1/normalize-baseline  → feature-extractor');
  console.log('  POST /api/v1/forecast            → forecaster');
  console.log('  POST /api/v1/anomaly-consensus   → consensus');
  console.log('  POST /api/v1/calibrate-risk      → calibration');
  console.log('  POST /api/v1/explain-risk        → explainer');
  console.log('  POST /api/v1/calculate-risk      → risk-calculator');
});
