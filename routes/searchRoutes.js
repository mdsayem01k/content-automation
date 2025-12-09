// routes/searchRoutes.js
const express = require("express");
const router = express.Router();
const { createBrowserAndPage } = require("../session");

router.get("/", async (req, res, next) => {
  let browser;
  try {
    // createBrowserAndPage will launch headless:false if no cookies found,
    // otherwise headless:true and cookies will be loaded.
    const { browser: b, page, headless } = await createBrowserAndPage();
    browser = b;

    // Example: ensure we're on Quora and grab page title or profile presence
    await page.waitForTimeout(1000);
    const title = await page.title();

    // OPTIONAL: check if logged in by probing for an element that exists only when logged in.
    // This is site-specific; adapt the selector to Quora's current markup if you want a robust check.
    // For demo, return title and headless flag.
    await browser.close();
    res.json({ ok: true, title, headless });
  } catch (err) {
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
    next(err);
  }
});

module.exports = router;
