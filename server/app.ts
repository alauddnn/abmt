import express from 'express';
import { router as apiRouter } from './routes.js';

export const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Router mounted at /api
app.use('/api', apiRouter);

// Support both /api/... and direct serverless rewritten endpoints
app.use((req, res, next) => {
  if (
    req.path.startsWith('/auth') ||
    req.path.startsWith('/projects') ||
    req.path.startsWith('/employees') ||
    req.path.startsWith('/attendance') ||
    req.path.startsWith('/overtime') ||
    req.path.startsWith('/kasbon') ||
    req.path.startsWith('/payroll') ||
    req.path.startsWith('/expenses') ||
    req.path.startsWith('/settings') ||
    req.path.startsWith('/users') ||
    req.path.startsWith('/reports') ||
    req.path.startsWith('/dashboard') ||
    req.path.startsWith('/audit-logs') ||
    req.path.startsWith('/health') ||
    req.path.startsWith('/test-scenarios') ||
    req.path.startsWith('/export')
  ) {
    return apiRouter(req, res, next);
  }
  next();
});

// OAuth Callback Route for popup & redirect
const callbackHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Google Authentication</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #F3F5F7; }
    .card { background: white; padding: 28px; border-radius: 16px; border: 1px solid #EAECF0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); text-align: center; max-width: 420px; width: 90%; }
    .spinner { border: 3px solid #E2E8F0; border-top: 3px solid #4693FD; border-radius: 50%; width: 32px; height: 32px; animation: spin 1s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    h3 { margin: 0 0 8px; color: #101828; font-size: 18px; }
    p { margin: 0; color: #667085; font-size: 13px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h3>Autentikasi Google Berhasil</h3>
    <p>Menghubungkan ke sistem PT. Asta Brata Matahari Terbit...</p>
  </div>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({
          type: 'OAUTH_AUTH_SUCCESS',
          hash: window.location.hash,
          search: window.location.search
        }, '*');
        setTimeout(() => window.close(), 600);
      } else {
        window.location.href = '/' + window.location.hash;
      }
    } catch (e) {
      window.location.href = '/';
    }
  </script>
</body>
</html>`;

app.get(['/auth/callback', '/auth/callback/'], (_req, res) => {
  res.send(callbackHtml);
});
