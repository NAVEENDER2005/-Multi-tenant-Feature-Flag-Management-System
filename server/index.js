'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

require('./db'); // schema init runs here

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const orgRoutes = require('./routes/organizations');
const flagRoutes = require('./routes/flags');
const auditRoutes = require('./routes/audit-logs');

const app = express();
const PORT = process.env.PORT || 4000;

// Allow all three Vite dev servers + production origins
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, same-origin) or listed origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  },
  credentials: true,
}));

app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/organizations', orgRoutes);
app.use('/api/flags', flagRoutes);
app.use('/api/audit-logs', auditRoutes);

// 404 for unknown API routes
app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint not found' });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[unhandled]', err);
  res.status(500).json({ success: false, error: 'Unexpected server error' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 API server running at http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health\n`);
});
