import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import keywordRoutes from './routes/keywordRoutes.js';
import linkRoutes from './routes/linkRoutes.js';
import { startScheduler } from './scheduler/cronScheduler.js';

dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 3000;
const HOST = process.env.API_HOST || 'localhost';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/keywords', keywordRoutes);
app.use('/api/links', linkRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Quora to Facebook Scraper API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      keywords: {
        scrapeByKeywords: 'POST /api/keywords/scrape',
        getKeywords: 'GET /api/keywords',
        addKeyword: 'POST /api/keywords',
        deleteKeyword: 'DELETE /api/keywords/:keyword'
      },
      links: {
        getAllLinks: 'GET /api/links',
        getUnusedLinks: 'GET /api/links/unused',
        getUsedLinks: 'GET /api/links/used',
        getLinkStats: 'GET /api/links/stats',
        markAsUsed: 'PUT /api/links/:id/mark-used',
        deleteLink: 'DELETE /api/links/:id',
        resetAllLinks: 'POST /api/links/reset-all'
      }
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Start server
app.listen(PORT, HOST, () => {
  console.log('🚀 Quora to Facebook Scraper API');
  console.log(`📡 Server running at http://${HOST}:${PORT}`);
  console.log(`🏥 Health check: http://${HOST}:${PORT}/health`);
  console.log(`📚 API docs: http://${HOST}:${PORT}/`);
  
  // Check if scheduler should be started
  if (process.env.AUTO_START_SCHEDULER === 'true') {
    console.log('\n⏰ Starting scheduler...');
    startScheduler();
  } else {
    console.log('\n💡 Tip: Set AUTO_START_SCHEDULER=true in .env to auto-start the scheduler');
  }
});

export default app;