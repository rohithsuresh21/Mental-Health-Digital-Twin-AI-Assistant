import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import multer from 'multer';
import { runDiagnosis, mapFlaskRunResponse } from './src/diagnosisEngine';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const upload = multer({ dest: path.join(__dirname, 'uploads') });

const FLASK_URL = process.env.FLASK_URL || 'http://localhost:5000';

// API diagnosis endpoint (JSON — no file upload)
app.post('/api/diagnose', async (req, res) => {
  try {
    const input = req.body;
    const result = await runDiagnosis(input);
    res.json(result);
  } catch (error) {
    console.error('Server error during diagnosis:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Diagnosis with file upload — forwards to Flask /run
app.post('/api/diagnose-with-files', upload.fields([
  { name: 'voiceFile', maxCount: 1 },
  { name: 'docFile', maxCount: 1 },
]), async (req, res) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const fields = req.body;
  let cleanup: string[] = [];

  try {
    // Build FormData for Flask
    const formData = new FormData();
    formData.append('user_id', (fields.fullName || 'portal_user').trim());

    // If we have a docFile, append it to the FormData for Flask
    if (files?.docFile?.[0]) {
      const f = files.docFile[0];
      const buf = fs.readFileSync(f.path);
      formData.append('file', new Blob([buf], { type: f.mimetype || 'application/octet-stream' }), f.originalname);
      cleanup.push(f.path);
    } else {
      // No file uploaded — send structured fields as a synthetic text entry
      const text = [
        fields.communicationLogs || '',
        fields.voiceRecordingsText || '',
        fields.clinicalReportsText || '',
      ].filter(Boolean).join('\n\n');
      if (text.trim()) {
        // Create a temporary text file for Flask
        const tmpPath = path.join(__dirname, 'uploads', `entry_${Date.now()}.txt`);
        fs.writeFileSync(tmpPath, text, 'utf-8');
        const buf = fs.readFileSync(tmpPath);
        formData.append('file', new Blob([buf], { type: 'text/plain' }), 'clinical_entry.txt');
        cleanup.push(tmpPath);
      } else {
        formData.append('demo', 'true');
      }
    }

    if (files?.voiceFile?.[0]) {
      cleanup.push(files.voiceFile[0].path);
    }

    const flaskRes = await fetch(`${FLASK_URL}/run`, {
      method: 'POST',
      body: formData,
    });

    if (!flaskRes.ok) {
      const errText = await flaskRes.text();
      throw new Error(`Flask /run responded ${flaskRes.status}: ${errText}`);
    }

    const pipelineResult = await flaskRes.json();

    // Map pipeline result to DiagnosticData
    const input: any = { ...fields };
    const result = mapFlaskRunResponse(pipelineResult, input);

    res.json(result);
  } catch (error: any) {
    console.error('Server error during file diagnosis:', error);
    // Fallback to JSON-only diagnosis
    try {
      const result = await runDiagnosis({ ...req.body } as any);
      res.json(result);
    } catch (fallbackErr) {
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  } finally {
    for (const p of cleanup) {
      try { fs.unlinkSync(p); } catch { /* ignore */ }
    }
  }
});

// Serve static assets from Vite's build directory
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Fallback for SPA Routing: serve index.html for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
