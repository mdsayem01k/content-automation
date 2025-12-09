import express from 'express';
import {
  getAllLinks,
  getUnusedLinks,
  getUsedLinks,
  getLinkStats,
  markLinkAsUsed,
  deleteLink,
  resetAllLinks
} from '../services/linkService.js';

const router = express.Router();

/**
 * GET /api/links
 * Get all links with optional filtering and pagination
 * Query params: ?page=1&limit=50&isUsed=0
 */
router.get('/', (req, res) => {
  try {
    const { page = 1, limit = 50, isUsed } = req.query;
    const allLinks = getAllLinks();

    // Filter by isUsed if specified
    let filteredLinks = allLinks;
    if (isUsed !== undefined) {
      const isUsedValue = parseInt(isUsed);
      filteredLinks = allLinks.filter(link => 
        (link.isUsed === isUsedValue || link.isUsed === Boolean(isUsedValue))
      );
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedLinks = filteredLinks.slice(startIndex, endIndex);

    res.json({
      success: true,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: filteredLinks.length,
        totalPages: Math.ceil(filteredLinks.length / limitNum)
      },
      count: paginatedLinks.length,
      links: paginatedLinks,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve links',
      message: error.message
    });
  }
});

/**
 * GET /api/links/unused
 * Get all unused links (isUsed: 0)
 */
router.get('/unused', (req, res) => {
  try {
    const unusedLinks = getUnusedLinks();
    res.json({
      success: true,
      count: unusedLinks.length,
      links: unusedLinks,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve unused links',
      message: error.message
    });
  }
});

/**
 * GET /api/links/used
 * Get all used links (isUsed: 1)
 */
router.get('/used', (req, res) => {
  try {
    const usedLinks = getUsedLinks();
    res.json({
      success: true,
      count: usedLinks.length,
      links: usedLinks,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve used links',
      message: error.message
    });
  }
});

/**
 * GET /api/links/stats
 * Get statistics about links
 */
router.get('/stats', (req, res) => {
  try {
    const stats = getLinkStats();
    res.json({
      success: true,
      stats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve stats',
      message: error.message
    });
  }
});

/**
 * PUT /api/links/:id/mark-used
 * Mark a link as used by its array index or URL
 */
router.put('/:id/mark-used', (req, res) => {
  try {
    const id = req.params.id;
    
    // Try to parse as index first, otherwise treat as URL
    const isIndex = /^\d+$/.test(id);
    const result = markLinkAsUsed(isIndex ? parseInt(id) : decodeURIComponent(id));

    if (!result.found) {
      return res.status(404).json({
        error: 'Link not found',
        id: id
      });
    }

    res.json({
      success: true,
      message: 'Link marked as used',
      link: result.link,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to mark link as used',
      message: error.message
    });
  }
});

/**
 * DELETE /api/links/:id
 * Delete a link by its array index or URL
 */
router.delete('/:id', (req, res) => {
  try {
    const id = req.params.id;
    
    const isIndex = /^\d+$/.test(id);
    const result = deleteLink(isIndex ? parseInt(id) : decodeURIComponent(id));

    if (!result.found) {
      return res.status(404).json({
        error: 'Link not found',
        id: id
      });
    }

    res.json({
      success: true,
      message: 'Link deleted successfully',
      deletedLink: result.deletedLink,
      remainingCount: result.remainingCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete link',
      message: error.message
    });
  }
});

/**
 * POST /api/links/reset-all
 * Reset all links to unused (isUsed: 0)
 */
router.post('/reset-all', (req, res) => {
  try {
    const result = resetAllLinks();

    res.json({
      success: true,
      message: 'All links reset to unused',
      count: result.count,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to reset links',
      message: error.message
    });
  }
});

export default router;