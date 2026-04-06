const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = process.env.PROXY_PORT || 9000;
const BACKEND_PORT = process.env.BACKEND_PORT || 8001;
const ADMIN_PORT = process.env.ADMIN_PORT || 4200;
const ANALYTICS_PORT = process.env.ANALYTICS_PORT || 3001;

// CORS configuration
app.use(cors({
  origin: [
    `http://localhost:${PORT}`,
    `http://localhost:${ADMIN_PORT}`,
    `http://localhost:${BACKEND_PORT}`,
    `http://localhost:${ANALYTICS_PORT}`
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with']
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    proxy_port: PORT,
    services: {
      backend: `http://localhost:${BACKEND_PORT}`,
      analytics: `http://localhost:${ANALYTICS_PORT}`,
      admin_panel: `http://localhost:${ADMIN_PORT}`
    }
  });
});

// Analytics API proxy (/api/analytics)
app.use('/api/analytics', createProxyMiddleware({
  target: `http://localhost:${ANALYTICS_PORT}`,
  changeOrigin: true,
  pathRewrite: { '^/api/analytics': '' },
  onProxyReq: (proxyReq, req) => {
    console.log(`📊 [Analytics] ${req.method} ${req.originalUrl} -> http://localhost:${ANALYTICS_PORT}${proxyReq.path}`);
  },
  onError: (err, req, res) => {
    console.error('❌ Analytics Proxy Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Analytics service unavailable' });
    }
  }
}));

// Backend API proxy (/api)
app.use('/api', createProxyMiddleware({
  target: `http://localhost:${BACKEND_PORT}`,
  changeOrigin: true,
  pathRewrite: { '^/api': '' },
  onProxyReq: (proxyReq, req) => {
    console.log(`🔗 [Backend] ${req.method} ${req.originalUrl} -> http://localhost:${BACKEND_PORT}${proxyReq.path}`);
  },
  onError: (err, req, res) => {
    console.error('❌ Backend Proxy Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Backend service unavailable' });
    }
  }
}));



// Admin Panel proxy (/admin-panel)
app.use('/admin-panel', createProxyMiddleware({
  target: `http://localhost:${ADMIN_PORT}`,
  changeOrigin: true,
  ws: true,
  pathRewrite: { '^/admin-panel': '' },
  onProxyReq: (proxyReq, req) => {
    console.log(`🎨 [Admin] ${req.method} ${req.originalUrl} -> http://localhost:${ADMIN_PORT}${proxyReq.path}`);
  },
  onError: (err, req, res) => {
    console.error('❌ Admin Panel Proxy Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Admin panel service unavailable' });
    }
  }
}));

// Root route redirect
app.get('/', (req, res) => {
  console.log('🏠 Root accessed. Redirecting to /admin-panel');
  res.redirect('/admin-panel');
});

// Docs endpoint
app.get('/docs', (req, res) => {
  res.json({
    title: 'Fluent-AI API Documentation',
    version: '1.0.0',
    proxy_server: `http://localhost:${PORT}`,
    routes: {
      backend_api: {
        base_url: `http://localhost:${PORT}/api`,
        target: `http://localhost:${BACKEND_PORT}`,
        description: 'Main Fastify backend API'
      },
      analytics_api: {
        base_url: `http://localhost:${PORT}/api/analytics`,
        target: `http://localhost:${ANALYTICS_PORT}`,
        description: 'Analytics API (Fastify)'
      },
      admin_panel: {
        base_url: `http://localhost:${PORT}/admin-panel`,
        target: `http://localhost:${ADMIN_PORT}`,
        description: 'Angular Admin Panel'
      }
    }
  });
});

// Admin route fallback
app.use('/admin-panel/*', createProxyMiddleware({
  target: `http://localhost:${ADMIN_PORT}`,
  changeOrigin: true,
  pathRewrite: { '^/admin-panel': '' }
}));

// Catch-all 404 handler
app.use('*', (req, res) => {
  console.warn(`❓ Unknown route accessed: ${req.originalUrl}`);
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
🚀 Fluent-AI Proxy Server Started on http://localhost:${PORT}

🔗 Routes:
  • /api             → http://localhost:${BACKEND_PORT}
  • /api/analytics   → http://localhost:${ANALYTICS_PORT}
  • /admin-panel     → http://localhost:${ADMIN_PORT}
  • /health          → Health check
  • /docs            → API documentation

💡 Tip: Run 'yarn dev' or 'npm run dev' to start services.
`);
});

// Graceful shutdown
['SIGINT', 'SIGTERM'].forEach(sig => {
  process.on(sig, () => {
    console.log(`\n🛑 Received ${sig}. Shutting down gracefully...`);
    process.exit(0);
  });
});
