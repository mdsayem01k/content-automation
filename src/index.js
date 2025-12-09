import dotenv from 'dotenv';
import { startScheduler } from './scheduler/cronScheduler.js';
import { linkScraper } from './scrapers/linkScraper.js';
import fs from 'fs';

dotenv.config();

console.log('🚀 Quora to Facebook Automation Starting...');
linkScraper();
// Initialize links.json if it doesn't exist
if (!fs.existsSync('links.json')) {
  console.log('⚠️  links.json not found. Creating empty file...');
  fs.writeFileSync('links.json', JSON.stringify([], null, 2));
  console.log('📋 Please run: npm run scrape-links first to collect Quora links');
} else {
  const links = JSON.parse(fs.readFileSync('links.json', 'utf8'));
  const unusedLinks = links.filter(l => l.isUsed === 0 || l.isUsed === false);
  console.log(`📊 Links status: ${unusedLinks.length} unused / ${links.length} total`);
}

// Check environment variables
if (!process.env.FACEBOOK_PAGE_ID || !process.env.FACEBOOK_ACCESS_TOKEN) {
  console.error('❌ Missing Facebook credentials in .env file');
  console.log('Please configure FACEBOOK_PAGE_ID and FACEBOOK_ACCESS_TOKEN');
  process.exit(1);
}

// Start the cron scheduler
console.log(`⏰ Scheduler will run every 3 minutes (${process.env.CRON_INTERVAL || '*/3 * * * *'})`);
startScheduler();

console.log('✅ Application running. Press Ctrl+C to stop.');