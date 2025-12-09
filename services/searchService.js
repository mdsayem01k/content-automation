const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

function getRandomUserAgent() {
  const agents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}

// Build Quora search URL exactly like your example
function buildQuoraSearchUrl(keyword) {
  return `https://www.quora.com/search?q=${encodeURIComponent(keyword)}`;
}

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

module.exports.fetchQuoraLinks = async function (keyword) {
  const url = buildQuoraSearchUrl(keyword);
  console.log("🔍 Searching Quora:", url);

  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
        "--window-size=1920,1080",
        "--ignore-certificate-errors",
        "--ignore-certificate-errors-spki-list"
      ],
      ignoreHTTPSErrors: true
    });

    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

    const userAgent = getRandomUserAgent();
    console.log("🧪 Using User-Agent:", userAgent);

    await page.setUserAgent(userAgent);
    
    // Set realistic headers
    await page.setExtraHTTPHeaders({
      "accept-language": "en-US,en;q=0.9",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "accept-encoding": "gzip, deflate, br",
      "referer": "https://www.quora.com/"
    });

    // Remove webdriver detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    });

    console.log("📨 Navigating to Quora...");
    
    await page.goto(url, { 
      waitUntil: "domcontentloaded", 
      timeout: 60000 
    });

    // Wait for content to load
    await delay(5000);
    console.log("✅ Page loaded.");
    
    // Take screenshot to see what Puppeteer sees
    await page.screenshot({ path: 'quora-page.png', fullPage: true });
    console.log("📸 Screenshot saved as 'quora-page.png'");

    // Get page title
    const pageTitle = await page.title();
    console.log("📄 Page Title:", pageTitle);

    // Get and log the entire HTML content
    const htmlContent = await page.content();
    console.log("\n" + "=".repeat(80));
    console.log("📝 FULL HTML CONTENT:");
    console.log("=".repeat(80));
    console.log(htmlContent);
    console.log("=".repeat(80));
    console.log(`📏 HTML Length: ${htmlContent.length} characters\n`);

    // Check if we're blocked or redirected
    const currentUrl = page.url();
    console.log("🌐 Current URL:", currentUrl);
    
    if (currentUrl !== url) {
      console.log("⚠️ WARNING: Page redirected! Expected:", url);
    }

    // Try to find common Quora elements
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log("📄 Body text preview (first 500 chars):", bodyText.substring(0, 500));
    
    // Check for login wall or bot detection
    if (bodyText.includes("Sign up") || bodyText.includes("Log in") || htmlContent.includes("signup")) {
      console.log("⚠️ WARNING: Quora may be showing a login/signup wall");
    }
    
    if (bodyText.includes("unusual traffic") || bodyText.includes("blocked")) {
      console.log("⚠️ WARNING: Quora may have blocked this request");
    }

    // Scroll to load more results (Quora uses infinite scroll)
    console.log("📜 Scrolling to load more results...");
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 200;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          // Scroll up to 5000px to load more content
          if (totalHeight >= scrollHeight || totalHeight >= 5000) {
            clearInterval(timer);
            resolve();
          }
        }, 150);
      });
    });

    // Wait for dynamic content to load after scrolling
    await delay(3000);

    // Count all anchor tags
    const aCount = await page.$$eval("a", (anchors) => anchors.length);
    console.log("🔗 Total <a> tags found:", aCount);

    // Extract ALL href attributes from <a> tags
    let allLinks = await page.$$eval("a", (anchors) =>
      anchors
        .map((a) => a.href)
        .filter((href) => typeof href === "string" && href.length > 0)
    );

    console.log("🔍 Total links extracted:", allLinks.length);
    console.log("🔍 First 30 raw links:");
    console.log(allLinks.slice(0, 30));

    // Filter only links that contain "quora.com" in the URL
    const quoraLinks = allLinks.filter((link) => 
      link.includes("quora.com/") && 
      !link.includes("quora.com/search") &&
      !link.includes("quora.com/profile") &&
      !link.includes("quora.com/settings")
    );
    console.log("🟦 Quora.com question links found:", quoraLinks.length);

    // Filter ONLY links that contain "?topAns=" parameter
    // Example: https://www.quora.com/Can-I-make-an-Android-app-with-Python?topAns=317970870
    const topAnsLinks = quoraLinks.filter((link) => 
      link.includes("?topAns=") || link.includes("&topAns=")
    );
    
    console.log("🟩 Links with '?topAns=' found:", topAnsLinks.length);
    console.log("🔍 Sample topAns links:");
    topAnsLinks.slice(0, 15).forEach((link, index) => {
      console.log(`   ${index + 1}. ${link}`);
    });

    // Remove duplicates
    const uniqueLinks = [...new Set(topAnsLinks)];
    console.log("✨ Unique topAns links:", uniqueLinks.length);

    return {
      keyword,
      searchUrl: url,
      totalLinksFound: allLinks.length,
      quoraLinksFound: quoraLinks.length,
      topAnsLinksFound: uniqueLinks.length,
      links: uniqueLinks
    };

  } catch (err) {
    console.error("❌ ERROR:", err.message);
    console.error(err.stack);
    return { 
      error: err.message,
      keyword 
    };
  } finally {
    if (browser) {
      await browser.close();
      console.log("🔒 Browser closed.");
    }
  }
};