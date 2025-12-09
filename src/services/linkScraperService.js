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
  }
}

/**
 * Scrape links from Quora for a single keyword
 */
export async function linkScraperByKeyword(keyword, language = null) {
  const lang = language || process.env.QUORA_LANGUAGE || 'en';
  const baseUrl = lang === 'bn' ? 'https://bn.quora.com' : 'https://www.quora.com';
  
  console.log(`🔍 Scraping for keyword: "${keyword}" (${lang})`);

  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  await loadCookies(page, process.env.COOKIES_FILE || 'cookies.json');

  const encodedQuery = encodeURIComponent(keyword);
  const searchUrl = `${baseUrl}/search?q=${encodedQuery}`;
  
  await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('a', { timeout: 5000 }).catch(() => {});
  
  const links = await page.$$eval('a[href]', anchors =>
    anchors.map(a => a.getAttribute('href'))
  );

  const keywords = keyword
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

  await browser.close();
  
  console.log(`✅ Found ${normalizedLinks.length} links for "${keyword}"`);
  
  return normalizedLinks;
}

/**
 * Scrape links from Quora for multiple keywords and store in links.json
 * Checks for duplicates before adding
 */
export async function linkScraperByKeywords(keywords, language = null) {
  const linksFile = process.env.LINKS_FILE || 'links.json';
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms)); // <--- Added
  
  // Load existing links
  let existingLinks = [];
  if (fs.existsSync(linksFile)) {
    existingLinks = JSON.parse(fs.readFileSync(linksFile, 'utf8'));
    console.log(`📂 Loaded ${existingLinks.length} existing links`);
  }

  // Create a Set of existing URLs for fast duplicate checking
  const existingUrlSet = new Set(existingLinks.map(l => l.link || l.url));
  
  let totalLinksFound = 0;
  let newLinksAdded = 0;
  let duplicatesSkipped = 0;
  const details = [];

  // Scrape for each keyword
  for (const keyword of keywords) {
    try {
      const links = await linkScraperByKeyword(keyword, language);
      totalLinksFound += links.length;
      
      let addedForKeyword = 0;
      let duplicatesForKeyword = 0;

      // Add new links, skip duplicates
      links.forEach(url => {
        if (!existingUrlSet.has(url)) {
          existingLinks.push({
            link: url,
            isUsed: 0,
            keyword: keyword,
            addedAt: new Date().toISOString()
          });
          existingUrlSet.add(url);
          newLinksAdded++;
          addedForKeyword++;
        } else {
          duplicatesSkipped++;
          duplicatesForKeyword++;
        }
      });

      details.push({
        keyword: keyword,
        linksFound: links.length,
        newLinksAdded: addedForKeyword,
        duplicatesSkipped: duplicatesForKeyword
      });

      console.log(`  ➕ Added ${addedForKeyword} new links`);
      console.log(`  ⏭️  Skipped ${duplicatesForKeyword} duplicates`);

    } catch (error) {
      console.error(`❌ Error scraping keyword "${keyword}":`, error.message);
      details.push({
        keyword: keyword,
        error: error.message,
        linksFound: 0,
        newLinksAdded: 0,
        duplicatesSkipped: 0
      });
    }
    await sleep(60 * 1000); 
  }

  // Save updated links
  fs.writeFileSync(linksFile, JSON.stringify(existingLinks, null, 2));
  console.log(`💾 Saved to ${linksFile}`);
  console.log(`📊 Summary: ${newLinksAdded} new, ${duplicatesSkipped} duplicates, ${existingLinks.length} total`);

  return {
    totalLinksFound,
    newLinksAdded,
    duplicatesSkipped,
    totalLinksInDatabase: existingLinks.length,
    details
  };
}