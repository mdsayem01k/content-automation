import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const KEYWORDS_FILE = process.env.KEYWORDS_FILE || 'keywords.json';

/**
 * Initialize keywords file if it doesn't exist
 */
function initKeywordsFile() {
  if (!fs.existsSync(KEYWORDS_FILE)) {
    fs.writeFileSync(KEYWORDS_FILE, JSON.stringify([], null, 2));
  }
}

/**
 * Get all keywords
 */
export function getKeywords() {
  initKeywordsFile();
  const data = fs.readFileSync(KEYWORDS_FILE, 'utf8');
  return JSON.parse(data);
}

/**
 * Add a new keyword
 */
export function addKeyword(keyword) {
    const keywords = getKeywords();
  
    const exists = keywords.some(k => k.keyword.toLowerCase() === keyword.toLowerCase());
  
    if (!exists) {
      keywords.push({
        keyword,
        isUsed: 0
      });
  
      fs.writeFileSync(KEYWORDS_FILE, JSON.stringify(keywords, null, 2));
      console.log(`✅ Added keyword: "${keyword}"`);
    } else {
      console.log(`ℹ️  Keyword already exists: "${keyword}"`);
    }
  
    return {
      keyword,
      exists,
      keywords
    };
  }
  

/**
 * Delete a keyword
 */
export function deleteKeyword(keyword) {
    const keywords = getKeywords();
    const index = keywords.findIndex(k => k.keyword.toLowerCase() === keyword.toLowerCase());
  
    if (index !== -1) {
      keywords.splice(index, 1);
      fs.writeFileSync(KEYWORDS_FILE, JSON.stringify(keywords, null, 2));
      console.log(`✅ Deleted keyword: "${keyword}"`);
      return { found: true, keywords };
    }
  
    console.log(`⚠️ Keyword not found: "${keyword}"`);
    return { found: false, keywords };
  }
  

/**
 * Clear all keywords
 */
export function clearKeywords() {
  fs.writeFileSync(KEYWORDS_FILE, JSON.stringify([], null, 2));
  console.log('✅ Cleared all keywords');
  return { success: true };
}