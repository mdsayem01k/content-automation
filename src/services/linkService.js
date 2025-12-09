import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const LINKS_FILE = process.env.LINKS_FILE || 'links.json';

/**
 * Initialize links file if it doesn't exist
 */
function initLinksFile() {
  if (!fs.existsSync(LINKS_FILE)) {
    fs.writeFileSync(LINKS_FILE, JSON.stringify([], null, 2));
  }
}

/**
 * Get all links
 */
export function getAllLinks() {
  initLinksFile();
  const data = fs.readFileSync(LINKS_FILE, 'utf8');
  return JSON.parse(data);
}

/**
 * Get unused links (isUsed: 0)
 */
export function getUnusedLinks() {
  const links = getAllLinks();
  return links.filter(link => link.isUsed === 0 || link.isUsed === false);
}

/**
 * Get used links (isUsed: 1)
 */
export function getUsedLinks() {
  const links = getAllLinks();
  return links.filter(link => link.isUsed === 1 || link.isUsed === true);
}

/**
 * Get link statistics
 */
export function getLinkStats() {
  const links = getAllLinks();
  const unused = getUnusedLinks();
  const used = getUsedLinks();

  // Group by keyword
  const byKeyword = {};
  links.forEach(link => {
    const keyword = link.keyword || 'unknown';
    if (!byKeyword[keyword]) {
      byKeyword[keyword] = { total: 0, used: 0, unused: 0 };
    }
    byKeyword[keyword].total++;
    if (link.isUsed === 1 || link.isUsed === true) {
      byKeyword[keyword].used++;
    } else {
      byKeyword[keyword].unused++;
    }
  });

  return {
    total: links.length,
    unused: unused.length,
    used: used.length,
    usagePercentage: links.length > 0 ? ((used.length / links.length) * 100).toFixed(2) : 0,
    byKeyword: byKeyword
  };
}

/**
 * Mark a link as used
 * Can accept either an index (number) or URL (string)
 */
export function markLinkAsUsed(identifier) {
  const links = getAllLinks();
  let linkIndex = -1;

  if (typeof identifier === 'number') {
    // Identifier is an array index
    linkIndex = identifier;
  } else {
    // Identifier is a URL
    linkIndex = links.findIndex(link => 
      (link.link === identifier || link.url === identifier)
    );
  }

  if (linkIndex === -1 || linkIndex >= links.length) {
    return { found: false, link: null };
  }

  links[linkIndex].isUsed = 1;
  links[linkIndex].usedAt = new Date().toISOString();
  
  fs.writeFileSync(LINKS_FILE, JSON.stringify(links, null, 2));
  console.log(`✅ Marked link as used: ${links[linkIndex].link || links[linkIndex].url}`);

  return { found: true, link: links[linkIndex] };
}

/**
 * Delete a link
 * Can accept either an index (number) or URL (string)
 */
export function deleteLink(identifier) {
  const links = getAllLinks();
  let linkIndex = -1;

  if (typeof identifier === 'number') {
    linkIndex = identifier;
  } else {
    linkIndex = links.findIndex(link => 
      (link.link === identifier || link.url === identifier)
    );
  }

  if (linkIndex === -1 || linkIndex >= links.length) {
    return { found: false, deletedLink: null, remainingCount: links.length };
  }

  const deletedLink = links.splice(linkIndex, 1)[0];
  
  fs.writeFileSync(LINKS_FILE, JSON.stringify(links, null, 2));
  console.log(`✅ Deleted link: ${deletedLink.link || deletedLink.url}`);

  return { found: true, deletedLink, remainingCount: links.length };
}

/**
 * Reset all links to unused
 */
export function resetAllLinks() {
  const links = getAllLinks();
  
  links.forEach(link => {
    link.isUsed = 0;
    delete link.usedAt;
  });

  fs.writeFileSync(LINKS_FILE, JSON.stringify(links, null, 2));
  console.log(`✅ Reset ${links.length} links to unused`);

  return { count: links.length };
}

/**
 * Add a single link (used internally)
 */
export function addLink(url, keyword = null) {
  const links = getAllLinks();
  
  // Check for duplicate
  const exists = links.some(link => 
    (link.link === url || link.url === url)
  );

  if (exists) {
    return { added: false, duplicate: true, link: url };
  }

  const newLink = {
    link: url,
    isUsed: 0,
    keyword: keyword,
    addedAt: new Date().toISOString()
  };

  links.push(newLink);
  fs.writeFileSync(LINKS_FILE, JSON.stringify(links, null, 2));

  return { added: true, duplicate: false, link: newLink };
}