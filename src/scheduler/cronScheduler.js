import cron from 'node-cron';
import fs from 'fs';
import { scrapeContent } from '../scrapers/contentScraper.js';
import { FacebookController } from '../controllers/facebookController.js';
import dotenv from 'dotenv';

dotenv.config();

const LINKS_FILE = process.env.LINKS_FILE || 'links.json';

/**
 * Get a random unused link from links.json
 */
function getRandomUnusedLink() {
  if (!fs.existsSync(LINKS_FILE)) {
    console.error('❌ links.json not found. Run scrape-links first.');
    return null;
  }

  const links = JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8'));
  const unusedLinks = links.filter(link => link.isUsed === 0 || link.isUsed === false);
  console.log(`📊 Found ${unusedLinks.length} unused links`);

  if (unusedLinks.length === 0) {
    console.log('⚠️  No unused links available. All links have been processed.');
    return null;
  }

  const randomIndex = Math.floor(Math.random() * unusedLinks.length);
  console.log(`🎲 Selected random link at index ${ unusedLinks[randomIndex].link}`);
  return unusedLinks[randomIndex];
}

/**
 * Mark a link as used in links.json
 */
function markLinkAsUsed(url) {
  const links = JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8'));
  const linkIndex = links.findIndex(link => link.url === url);

  if (linkIndex !== -1) {
    links[linkIndex].isUsed = 1;
    links[linkIndex].usedAt = new Date().toISOString();
    fs.writeFileSync(LINKS_FILE, JSON.stringify(links, null, 2));
    console.log(`✅ Marked link as used: ${url}`);
  }
}

/**
 * Main job function that runs on schedule
 */
async function runScheduledJob() {
  console.log('\n' + '='.repeat(60));
  console.log(`⏰ Scheduled job started at ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  try {
    // Step 1: Get random unused link
    const linkData = getRandomUnusedLink();
    
    if (!linkData) {
      console.log('⏭️  Skipping job - no unused links available');
      return;
    }

    console.log(`🎯 Selected link: ${linkData.link}`);

    // Step 2: Scrape content from the link
    console.log('\n📥 Starting content scraping...');
    const scrapedData = await scrapeContent(linkData.link);

    if (!scrapedData.content && (!scrapedData.images || scrapedData.images.length === 0)) {
      console.log('⚠️  No content or images scraped. Skipping post.');
      return;
    }

    // Step 3: Post to Facebook
    console.log('\n📤 Posting to Facebook...');
    const fb = new FacebookController();
    const result = await fb.postScrapedContent(scrapedData);

    // Step 4: Mark link as used
    markLinkAsUsed(linkData.url);

    console.log('\n✅ Job completed successfully!');
    console.log(`📊 Post ID: ${result.id}`);
    
    // Log statistics
    const links = JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8'));
    const usedCount = links.filter(l => l.isUsed === 1 || l.isUsed === true).length;
    const unusedCount = links.filter(l => l.isUsed === 0 || l.isUsed === false).length;
    console.log(`📈 Progress: ${usedCount}/${links.length} links processed (${unusedCount} remaining)`);

  } catch (error) {
    console.error('\n❌ Job failed with error:', error.message);
    console.error(error);
  }

  console.log('='.repeat(60) + '\n');
}

/**
 * Start the cron scheduler
 */
export function startScheduler() {
  const cronInterval = process.env.CRON_INTERVAL || '*/3 * * * *';

  // Validate cron expression
  if (!cron.validate(cronInterval)) {
    console.error(`❌ Invalid cron expression: ${cronInterval}`);
    process.exit(1);
  }

  console.log(`\n⏰ Scheduler initialized with interval: ${cronInterval}`);
  console.log('   (Format: minute hour day month weekday)');
  console.log('   */3 * * * * = every 3 minutes');
  console.log('   */5 * * * * = every 5 minutes');
  console.log('   0 * * * * = every hour at minute 0\n');

  // Schedule the job
  const task = cron.schedule(cronInterval, () => {
    runScheduledJob();
  });

  // Run immediately on start (optional - comment out if you don't want this)
  console.log('🚀 Running initial job immediately...');
  runScheduledJob();

  // Keep the process alive
  process.on('SIGINT', () => {
    console.log('\n⏹️  Stopping scheduler...');
    task.stop();
    console.log('✅ Scheduler stopped. Goodbye!');
    process.exit(0);
  });

  return task;
}

// Test if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🧪 Running scheduler in test mode...');
  startScheduler();
}