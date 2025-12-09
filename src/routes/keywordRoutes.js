import fs from 'fs';
import path from 'path';
import express from 'express';
import dotenv from 'dotenv';
import { linkScraperByKeyword, linkScraperByKeywords } from '../services/linkScraperService.js';
import { getKeywords, addKeyword, deleteKeyword } from '../services/keywordService.js';
const KEYWORDS_FILE = process.env.Keywords_FILE || 'keywords.json';
const router = express.Router();

/**
 * POST /api/keywords/scrape
 * Scrape links from Quora using provided keywords
 * Body: { keywords: ["keyword1", "keyword2"] } or { keyword: "single keyword" }
 */
router.post('/scrape', async (req, res) => {
  try {
    const { keywords, keyword } = req.body;

    if (!keywords && !keyword) {
      return res.status(400).json({
        error: 'Missing keywords',
        message: 'Please provide either "keywords" array or "keyword" string'
      });
    }

 
    let keywordList = [];
    
    if (keyword) {
      keywordList = [keyword];
    } else if (Array.isArray(keywords)) {
      keywordList = keywords.filter(k => k && k.trim());
    } else {
      return res.status(400).json({
        error: 'Invalid format',
        message: 'Keywords must be an array of strings or a single string'
      });
    }

    if (keywordList.length === 0) {
      return res.status(400).json({
        error: 'Empty keywords',
        message: 'Please provide at least one non-empty keyword'
      });
    }

    console.log(`📥 Scraping links for ${keywordList.length} keyword(s)...`);

    const results = await linkScraperByKeywords(keywordList);

    res.json({
      success: true,
      message: `Scraped links for ${keywordList.length} keyword(s)`,
      keywords: keywordList,
      results: {
        totalLinksFound: results.totalLinksFound,
        newLinksAdded: results.newLinksAdded,
        duplicatesSkipped: results.duplicatesSkipped,
        totalLinksInDatabase: results.totalLinksInDatabase
      },
      details: results.details,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Scraping error:', error);
    res.status(500).json({
      error: 'Scraping failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/scrape/all', async (req, res) => {
    try {
      // Ensure file exists
      if (!fs.existsSync(KEYWORDS_FILE)) {
        fs.writeFileSync(KEYWORDS_FILE, JSON.stringify([], null, 2), 'utf8');
      }
  
      // Read & parse file
      const raw = fs.readFileSync(KEYWORDS_FILE, 'utf8');
      let allKeywords;
      try {
        allKeywords = JSON.parse(raw);
        if (!Array.isArray(allKeywords)) throw new Error('keywords.json must contain an array');
      } catch (parseErr) {
        console.error('Failed to parse keywords.json:', parseErr);
        return res.status(500).json({
          error: 'Invalid keywords file',
          message: parseErr.message
        });
      }
  
      // Filter unused entries (isUsed === 0, '0' or false) and map to plain keyword strings
      const unusedObjects = allKeywords.filter(k =>
        k && (k.isUsed === 0 || k.isUsed === '0' || k.isUsed === false)
      );
  
      const keywordList = unusedObjects
        .map(k => (k.keyword && typeof k.keyword === 'string' ? k.keyword.trim() : ''))
        .filter(Boolean);
  
      if (keywordList.length === 0) {
        return res.status(400).json({
          error: 'Empty keywords',
          message: 'No unused keywords found in keywords.json. Provide keywords or reset isUsed flags.'
        });
      }
  
      console.log(`📥 Scraping links for ${keywordList.length} keyword(s)...`);
  
      // Call your existing scraper (must be async)
      const results = await linkScraperByKeywords(keywordList);
  
      // If scraping succeeded, mark those keywords as used (best-effort)
      try {
        const updated = allKeywords.map(k => {
          if (!k || typeof k.keyword !== 'string') return k;
          // match case-insensitive
          if (keywordList.some(kw => kw.toLowerCase() === k.keyword.toLowerCase())) {
            return { ...k, isUsed: 1 };
          }
          return k;
        });
  
        // atomic-ish write: write to temp file then rename
        const tmpPath = KEYWORDS_FILE + '.tmp';
        fs.writeFileSync(tmpPath, JSON.stringify(updated, null, 2), 'utf8');
        fs.renameSync(tmpPath, KEYWORDS_FILE);
        console.log(`✅ Marked ${keywordList.length} keyword(s) as used.`);
      } catch (writeErr) {
        console.error('⚠️ Failed to update keywords.json isUsed flags:', writeErr);
        // non-fatal: include warning in response below
      }
  
      // Success response
      return res.json({
        success: true,
        message: `Scraped links for ${keywordList.length} keyword(s)`,
        keywords: keywordList,
        results: {
          totalLinksFound: results.totalLinksFound,
          newLinksAdded: results.newLinksAdded,
          duplicatesSkipped: results.duplicatesSkipped,
          totalLinksInDatabase: results.totalLinksInDatabase
        },
        details: results.details,
        timestamp: new Date().toISOString()
      });
  
    } catch (error) {
      console.error('❌ Scraping error:', error);
      return res.status(500).json({
        error: 'Scraping failed',
        message: error.message ?? String(error),
        timestamp: new Date().toISOString()
      });
    }
  });
/**
 * GET /api/keywords
 * Get all stored keywords
 */
router.get('/', (req, res) => {
  try {
    const keywords = getKeywords();
    res.json({
      success: true,
      count: keywords.length,
      keywords: keywords,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve keywords',
      message: error.message
    });
  }
});

/**
 * POST /api/keywords
 * Add a new keyword to the list
 * Body: { keyword: "new keyword" }
 */
router.post('/', (req, res) => {
  try {
    const { keyword } = req.body;

    if (!keyword || !keyword.trim()) {
      return res.status(400).json({
        error: 'Invalid keyword',
        message: 'Keyword cannot be empty'
      });
    }

    const result = addKeyword(keyword.trim());

    if (result.exists) {
      return res.status(200).json({
        success: true,
        message: 'Keyword already exists',
        keyword: result.keyword,
        keywords: result.keywords
      });
    }

    res.status(201).json({
      success: true,
      message: 'Keyword added successfully',
      keyword: result.keyword,
      keywords: result.keywords,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to add keyword',
      message: error.message
    });
  }
});

/**
 * DELETE /api/keywords/:keyword
 * Delete a keyword from the list
 */
router.delete('/:keyword', (req, res) => {
  try {
    const keyword = decodeURIComponent(req.params.keyword);
    const result = deleteKeyword(keyword);

    if (!result.found) {
      return res.status(404).json({
        error: 'Keyword not found',
        keyword: keyword
      });
    }

    res.json({
      success: true,
      message: 'Keyword deleted successfully',
      keyword: keyword,
      remainingKeywords: result.keywords,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete keyword',
      message: error.message
    });
  }
});

export default router;