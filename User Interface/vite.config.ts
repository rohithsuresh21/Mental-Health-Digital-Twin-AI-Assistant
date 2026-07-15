import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'api-proxy',
        configureServer(server) {
          const FLASK_URL = process.env.FLASK_URL || 'http://localhost:5000';

          server.middlewares.use('/api/diagnose', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: 'Method not allowed' }));
              return;
            }

            try {
              // Read JSON body
              let body = '';
              req.on('data', chunk => { body += chunk.toString(); });
              await new Promise<void>(resolve => req.on('end', () => resolve()));
              const fields = JSON.parse(body || '{}');

              // Build a text entry from form fields for the pipeline
              const text = [
                fields.communicationLogs || '',
                fields.voiceRecordingsText || '',
                fields.clinicalReportsText || '',
              ].filter(Boolean).join('\n\n');

              // Call Flask's /run endpoint
              const formData = new FormData();
              formData.set('user_id', fields.fullName?.trim() || 'portal_user');

              if (text.trim()) {
                formData.set('file', new Blob([text], { type: 'text/plain' }), 'journal.txt');
              } else {
                formData.set('demo', 'true');
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
              if (pipelineResult.error) throw new Error(pipelineResult.error);
              const { mapFlaskRunResponse } = await import('./src/diagnosisEngine');
              const result = mapFlaskRunResponse(pipelineResult, fields);

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err: any) {
              console.error('Error in API proxy:', err);
              // Fallback to local mock
              const { runDiagnosis } = await import('./src/diagnosisEngine');
              const result = await runDiagnosis(fields);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            }
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
