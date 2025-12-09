import puppeteer from 'puppeteer';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function loadCookies(page, filename) {
  if (fs.existsSync(filename)) {
    const cookiesString = fs.readFileSync(filename, 'utf8');
    const cookies = JSON.parse(cookiesString);
    await page.setCookie(...cookies);
    console.log('🍪 Cookies loaded.');
  } else {
    console.log('⚠️  No saved cookies found.');
  }
}

export async function linkScraper() {
  const searchQuery = process.env.QUORA_SEARCH_KEYWORD || 'how to earn passive money';
  const language = process.env.QUORA_LANGUAGE || 'en';
  const baseUrl = language === 'bn' ? 'https://bn.quora.com' : 'https://www.quora.com';
  
  console.log('🔍 Starting link scraper...');
  console.log(`Query: "${searchQuery}"`);
  console.log(`Language: ${language} (${baseUrl})`);

  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  await loadCookies(page, process.env.COOKIES_FILE || 'cookies.json');

  const encodedQuery = encodeURIComponent(searchQuery);
  const searchUrl = `${baseUrl}/search?q=${encodedQuery}`;
  
  console.log(`🌐 Navigating to: ${searchUrl}`);
  await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
  
  await page.waitForSelector('a', { timeout: 5000 }).catch(() => {});
  
  const links = await page.$$eval('a[href]', anchors =>
    anchors.map(a => a.getAttribute('href'))
  );

  const keywords = searchQuery
    .split(/\s+/)
    .map(k => k.trim().toLowerCase())
    .filter(Boolean);

  const normalizedLinks = Array.from(new Set(
    links
      .filter(Boolean)
      .map(h => {
        try { return new URL(h, page.url()).href; }
        catch { return null; }
      })
      .filter(u => u && (u.startsWith('http://') || u.startsWith('https://')))
      .filter(u => !u.includes('/profile/'))
      .filter(u => {
        const lower = u.toLowerCase();
        return keywords.some(kw => lower.includes(kw));
      })
  ));

  console.log(`✅ Found ${normalizedLinks.length} filtered links`);

  // Load existing links if file exists
  let existingLinks = [];
  const linksFile = process.env.LINKS_FILE || 'links.json';
  
  if (fs.existsSync(linksFile)) {
    existingLinks = JSON.parse(fs.readFileSync(linksFile, 'utf8'));
    console.log(`📂 Loaded ${existingLinks.length} existing links`);
  }

  // Create a map of existing URLs
  const existingUrlMap = new Map(existingLinks.map(l => [l.link, l]));

  // Add new links with isUsed: 0
  let newCount = 0;
  normalizedLinks.forEach(url => {
    if (!existingUrlMap.has(url)) {
      existingLinks.push({
        link: url,
        isUsed: 0,
        addedAt: new Date().toISOString()
      });
      newCount++;
    }
  });

  console.log(`🆕 Added ${newCount} new links`);
  console.log(`📊 Total links: ${existingLinks.length}`);

  // Save to file
  fs.writeFileSync(linksFile, JSON.stringify(existingLinks, null, 2));
  console.log(`💾 Saved to ${linksFile}`);

  await browser.close();
  return existingLinks;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  linkScraper()
    .then(() => {
      console.log('✅ Link scraping completed');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Error:', err);
      process.exit(1);
    });
}