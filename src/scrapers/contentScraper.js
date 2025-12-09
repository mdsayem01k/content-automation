import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';
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

async function autoScroll(page, maxScrolls = 10, scrollDelay = 700) {
  try {
    await page.evaluate(
      async (maxScrollsInner, scrollDelayInner) => {
        const distance = Math.floor(window.innerHeight * 0.9);
        for (let i = 0; i < maxScrollsInner; i++) {
          window.scrollBy(0, distance);
          await new Promise(res => setTimeout(res, scrollDelayInner + Math.floor(Math.random() * 300)));
        }
      },
      maxScrolls,
      scrollDelay
    );
  } catch (err) {
    // ignore
  }
}

async function expandAnswerMoreButtons(page) {
  await page.evaluate(() => {
    const ANSWER_SELECTOR = '.q-box.spacing_log_answer_content.puppeteer_test_answer_content';
    const containers = Array.from(document.querySelectorAll(ANSWER_SELECTOR));
    const patterns = [
      'see more', 'more', 'read more', '... more', 'view more',
      'আরও', 'আরও দেখুন', 'বিস্তারিত', 'পুরোটা পড়ুন', 'আরও পড়ুন'
    ];

    function looksLikeMoreText(t) {
      if (!t) return false;
      const s = t.replace(/\s+/g, ' ').trim().toLowerCase();
      return patterns.some(p => s.includes(p.toLowerCase()));
    }

    containers.forEach(container => {
      const candidates = container.querySelectorAll('button, a, span, div');
      for (const c of candidates) {
        try {
          const txt = (c.innerText || '').trim();
          if (looksLikeMoreText(txt)) {
            try { c.click(); } catch (e) {
              const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
              c.dispatchEvent(ev);
            }
          }
        } catch (e) {}
      }
    });
  });
}

async function downloadImages(imageUrls, pageUrl, timestamp) {
  if (!imageUrls || imageUrls.length === 0) {
    return [];
  }

  const outDir = path.resolve(process.env.IMAGES_DIR || 'downloaded_images');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const savedFiles = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const raw = imageUrls[i];
    try {
      let src = raw;
      if (src && !src.startsWith('http') && !src.startsWith('data:')) {
        try {
          src = new URL(src, pageUrl).href;
        } catch (e) {}
      }

      if (!src) continue;

      if (src.startsWith('data:')) {
        const match = src.match(/^data:(.+?);base64,(.*)$/);
        if (!match) continue;
        
        const mime = match[1];
        const b64 = match[2];
        const buffer = Buffer.from(b64, 'base64');
        let ext = 'bin';
        if (mime.includes('/')) ext = mime.split('/')[1].split(';')[0];
        const filename = `img_${timestamp}_${i}.${ext}`;
        const filepath = path.join(outDir, filename);
        fs.writeFileSync(filepath, buffer);
        savedFiles.push(filepath);
        console.log(`📷 Saved: ${filename}`);
      } else {
        const res = await fetch(src);
        if (!res.ok) continue;

        const contentType = res.headers.get('content-type') || '';
        let ext = 'jpg';
        
        if (contentType.includes('/')) {
          ext = contentType.split('/')[1].split(';')[0];
          if (ext === 'jpeg') ext = 'jpg';
        }

        const filename = `img_${timestamp}_${i}.${ext}`;
        const filepath = path.join(outDir, filename);

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fs.writeFileSync(filepath, buffer);
        savedFiles.push(filepath);
        console.log(`📷 Downloaded: ${filename}`);
      }
    } catch (err) {
      console.log(`⚠️  Error saving image ${i}:`, err.message);
    }
  }

  return savedFiles;
}

export async function scrapeContent(url) {
  console.log(`\n🔍 Scraping content from: ${url}`);
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  page.setDefaultNavigationTimeout(120000);
  page.setDefaultTimeout(120000);

  await loadCookies(page, process.env.COOKIES_FILE || 'cookies.json');

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
  } catch (err) {
    console.log('⚠️  Navigation timeout, retrying...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 0 });
  }

  await page.waitForSelector('body', { timeout: 15000 }).catch(() => {});
  await autoScroll(page, 2, 600);
  await expandAnswerMoreButtons(page);
  await page.waitForTimeout(1200);
  await autoScroll(page, 8, 800);
  await expandAnswerMoreButtons(page);
  await page.waitForTimeout(900);

  let title = '';
  let firstAnswer = '';

  try {
    title = await page.$eval(
      '.q-text.puppeteer_test_question_title',
      el => el.innerText.trim()
    );
    console.log(`📝 Title: ${title.substring(0, 60)}...`);
  } catch (err) {
    console.log('⚠️  Title not found');
  }

  try {
    const answers = await page.$$eval(
      '.q-box.spacing_log_answer_content.puppeteer_test_answer_content',
      els => els.map(e => e.innerText.trim()).filter(Boolean)
    );

    if (answers.length > 0) {
      firstAnswer = answers[0];
      console.log(`💬 Answer length: ${firstAnswer.length} characters`);
    }
  } catch (err) {
    console.log('⚠️  Answer extraction failed');
  }

  let imageSrcs = [];
  try {
    imageSrcs = await page.$$eval(
      '.q-box.spacing_log_answer_content.puppeteer_test_answer_content',
      els => {
        if (!els || els.length === 0) return [];
        const first = els[0];
        const imgs = Array.from(first.querySelectorAll('img'));
        return imgs.map(img => {
          const attrs = [
            img.getAttribute('src'),
            img.getAttribute('data-src'),
            img.getAttribute('data-original'),
            img.getAttribute('data-imageurl')
          ];
          let src = attrs.find(a => a && a.trim());
          if (!src) {
            const srcset = img.getAttribute('srcset') || '';
            if (srcset) {
              src = srcset.split(',')[0].trim().split(' ')[0];
            }
          }
          return src || null;
        }).filter(Boolean);
      }
    );
    console.log(`🖼️  Found ${imageSrcs.length} images`);
  } catch (e) {
    console.log('⚠️  Failed to collect images');
  }

  const timestamp = Date.now();
  const savedImages = await downloadImages(imageSrcs, url, timestamp);

  const result = {
    url,
    title,
    content: firstAnswer,
    images: savedImages,
    imageCount: savedImages.length,
    scrapedAt: new Date().toISOString()
  };

  await browser.close();
  
  console.log(`✅ Scraping completed: ${savedImages.length} images saved`);
  return result;
}

// Test if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testUrl = process.argv[2] || 'https://www.quora.com/How-can-I-earn-passive-income';
  scrapeContent(testUrl)
    .then(result => {
      console.log('\n📊 Result:', result);
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Error:', err);
      process.exit(1);
    });
}