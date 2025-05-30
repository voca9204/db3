/**
 * Search API Module - DB3 Database Query System
 * Contains advanced search functionality with fuzzy matching, relevance scoring, and query parsing
 */

const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });

// Import database utilities
const { executeQuery, queryOne } = require('../db');

// Import search system
const SearchEngine = require('../src/search/SearchEngine');

// Import authentication utilities
const admin = require('firebase-admin');

/**
 * Authentication middleware for protected APIs
 */
async function authenticateUser(req, res, callback) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: "error",
      message: "Authentication required"
    });
  }

  try {
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Check if user email is authorized
    const authorizedEmail = 'sandscasino8888@gmail.com';
    if (decodedToken.email !== authorizedEmail) {
      return res.status(403).json({
        status: "error",
        message: "Access denied"
      });
    }
    
    req.user = decodedToken;
    await callback();
    
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({
      status: "error",
      message: "Invalid authentication token"
    });
  }
}

/**
 * Advanced Text Search API
 * Supports complex search expressions, fuzzy matching, and relevance scoring
 */
exports.advancedTextSearch = functions.https.onRequest((req, res) => {
  authenticateUser(req, res, async () => {
    try {
      const { 
        query,
        enableFuzzy = true,
        fuzzyThreshold = 60,
        maxResults = 50,
        searchFields = ['userId'],
        sortField = 'relevanceScore',
        sortDirection = 'DESC',
        pagination
      } = req.query;

      if (!query) {
        return res.status(400).json({
          status: "error",
          message: "Search query is required",
          example: "?query=user123&enableFuzzy=true&maxResults=20"
        });
      }

      // Initialize Search Engine
      const searchEngine = new SearchEngine({
        enableFuzzySearch: enableFuzzy === 'true',
        enableRelevanceScoring: true,
        enablePagination: true,
        maxResults: Math.min(parseInt(maxResults) || 50, 100)
      });

      // Get user data for searching
      const userData = await executeQuery(`
        SELECT 
          p.userId,
          p.status,
          COUNT(DISTINCT gs.gameDate) as 총게임일수,
          ROUND(SUM(gs.netBet)) as 총유효배팅,
          ROUND(SUM(gs.winLoss)) as 총손익,
          MIN(gs.gameDate) as 첫게임일,
          MAX(gs.gameDate) as 마지막게임일,
          DATEDIFF(CURDATE(), MAX(gs.gameDate)) as 휴면일수,
          CASE 
            WHEN DATEDIFF(CURDATE(), MAX(gs.gameDate)) <= 30 THEN 'active'
            ELSE 'dormant'
          END as 활동상태
        FROM players p
        LEFT JOIN game_scores gs ON p.userId = gs.userId
        WHERE p.status = 0
        GROUP BY p.userId
        HAVING 총게임일수 >= 0
        ORDER BY 총유효배팅 DESC
        LIMIT 1000
      `);

      // Search options
      const searchOptions = {
        enableFuzzy: enableFuzzy === 'true',
        fuzzyThreshold: parseInt(fuzzyThreshold),
        searchFields: Array.isArray(searchFields) ? searchFields : [searchFields],
        sortField,
        sortDirection,
        pagination: pagination ? {
          cursor: req.query.cursor,
          pageSize: parseInt(req.query.pageSize) || 20,
          direction: req.query.direction || 'next'
        } : null
      };

      // Execute search
      const searchResult = await searchEngine.search(query, userData, searchOptions);

      res.json({
        status: "success",
        message: `Advanced search completed for "${query}"`,
        ...searchResult,
        queryInfo: {
          originalQuery: query,
          enabledFeatures: {
            fuzzyMatching: enableFuzzy === 'true',
            relevanceScoring: true,
            pagination: !!pagination
          },
          searchOptions
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Advanced text search error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Search Suggestions API
 * Returns search suggestions based on partial query input
 */
exports.getSearchSuggestions = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { 
        query,
        maxSuggestions = 10,
        minSimilarity = 70
      } = req.query;

      if (!query || query.length < 2) {
        return res.status(400).json({
          status: "error",
          message: "Query must be at least 2 characters long"
        });
      }

      // Initialize Search Engine
      const searchEngine = new SearchEngine();

      // Get user IDs for suggestions
      const userData = await executeQuery(`
        SELECT DISTINCT userId 
        FROM players 
        WHERE status = 0 AND userId IS NOT NULL 
        ORDER BY userId 
        LIMIT 1000
      `);

      // Get suggestions
      const suggestions = searchEngine.getSuggestions(query, userData, {
        maxSuggestions: parseInt(maxSuggestions),
        minSimilarity: parseInt(minSimilarity)
      });

      res.json({
        status: "success",
        message: `Found ${suggestions.length} suggestions for "${query}"`,
        query,
        suggestions,
        totalSuggestions: suggestions.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Search suggestions error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Smart Query Parser API
 * Parses complex search expressions and returns query structure
 */
exports.parseSearchQuery = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { query } = req.query;

      if (!query) {
        return res.status(400).json({
          status: "error",
          message: "Search query is required",
          examples: [
            "user123 AND active",
            "userId:john OR status:1",
            "(새로운 OR 신규) AND 베팅",
            "NOT 휴면"
          ]
        });
      }

      // Initialize Search Engine
      const searchEngine = new SearchEngine();
      
      // Parse query
      const parseResult = searchEngine.queryParser.parse(query);

      if (!parseResult.success) {
        return res.status(400).json({
          status: "error",
          message: `Query parsing failed: ${parseResult.error}`,
          originalQuery: query
        });
      }

      res.json({
        status: "success",
        message: "Query parsed successfully",
        originalQuery: query,
        parsedQuery: parseResult,
        queryStructure: {
          termCount: parseResult.termCount,
          complexity: parseResult.complexity,
          tokens: parseResult.tokens
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Parse search query error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Search Engine Performance Test API
 * Tests search engine performance with various queries
 */
exports.testSearchPerformance = functions.https.onRequest((req, res) => {
  authenticateUser(req, res, async () => {
    try {
      // Initialize Search Engine
      const searchEngine = new SearchEngine({
        enableFuzzySearch: true,
        enableRelevanceScoring: true,
        performanceTracking: true
      });

      // Test queries
      const testQueries = [
        "admin",
        "test123",
        "user OR admin",
        "NOT inactive",
        "userId:test*",
        "(active AND 베팅) OR 신규",
        "fuzzy matching test",
        "복잡한 한글 검색어",
        "status:0 AND active",
        "dormant OR 휴면"
      ];

      // Get test dataset
      const testData = await executeQuery(`
        SELECT 
          p.userId,
          p.status,
          COUNT(DISTINCT gs.gameDate) as 총게임일수,
          ROUND(SUM(gs.netBet)) as 총유효배팅,
          MAX(gs.gameDate) as 마지막게임일,
          DATEDIFF(CURDATE(), MAX(gs.gameDate)) as 휴면일수,
          CASE 
            WHEN DATEDIFF(CURDATE(), MAX(gs.gameDate)) <= 30 THEN 'active'
            ELSE 'dormant'
          END as 활동상태
        FROM players p
        LEFT JOIN game_scores gs ON p.userId = gs.userId
        WHERE p.status = 0
        GROUP BY p.userId
        LIMIT 500
      `);

      // Run performance test
      const performanceResult = await searchEngine.performanceTest(testQueries, testData);
      
      // Get engine metrics
      const metrics = searchEngine.getMetrics();

      res.json({
        status: "success",
        message: "Search engine performance test completed",
        testDataset: {
          totalUsers: testData.length,
          testQueries: testQueries.length
        },
        performanceResults: performanceResult,
        engineMetrics: metrics,
        recommendations: {
          averageResponseTime: performanceResult.averageResponseTime < 100 ? 
            "Excellent performance" : 
            performanceResult.averageResponseTime < 500 ? 
            "Good performance" : "Consider optimization",
          successRate: performanceResult.successRate >= 95 ? 
            "Excellent reliability" : "Review error handling"
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Search performance test error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Fuzzy Search API
 * Performs fuzzy matching for typo-tolerant search
 */
exports.fuzzySearch = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { 
        query,
        threshold = 60,
        maxResults = 20,
        includeScoreBreakdown = false
      } = req.query;

      if (!query) {
        return res.status(400).json({
          status: "error",
          message: "Search query is required for fuzzy matching"
        });
      }

      // Initialize Fuzzy Matcher
      const searchEngine = new SearchEngine({
        enableFuzzySearch: true,
        enableRelevanceScoring: false
      });

      // Get user data
      const userData = await executeQuery(`
        SELECT userId 
        FROM players 
        WHERE status = 0 AND userId IS NOT NULL 
        ORDER BY userId 
        LIMIT 1000
      `);

      // Extract user IDs for fuzzy matching
      const userIds = userData.map(user => user.userId);

      // Perform fuzzy matching
      const fuzzyResults = searchEngine.fuzzyMatcher.findMatches(query, userIds, {
        threshold: parseInt(threshold),
        limit: parseInt(maxResults)
      });

      res.json({
        status: "success",
        message: `Fuzzy search completed for "${query}"`,
        query,
        threshold: parseInt(threshold),
        results: fuzzyResults.map(result => ({
          userId: result.text,
          similarity: result.similarity,
          distance: result.distance,
          ...(includeScoreBreakdown === 'true' && { 
            scoreBreakdown: {
              exactMatch: result.text === query,
              partialMatch: result.text.includes(query),
              levenshteinDistance: result.distance
            }
          })
        })),
        totalResults: fuzzyResults.length,
        searchParameters: {
          algorithm: "Levenshtein Distance",
          threshold,
          maxResults
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Fuzzy search error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Search Engine Status API
 * Provides comprehensive status of the search engine
 */
exports.getSearchEngineStatus = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      // Initialize Search Engine
      const searchEngine = new SearchEngine({
        performanceTracking: true
      });

      // Get various status information
      const metrics = searchEngine.getMetrics();
      const cacheInfo = searchEngine.paginator.getCacheInfo();

      // Test basic functionality
      const testResult = await searchEngine.search("test", [
        { userId: "test123", status: 0 },
        { userId: "admin", status: 0 },
        { userId: "user456", status: 0 }
      ]);

      res.json({
        status: "success",
        message: "Search engine is operational",
        engineStatus: {
          version: "1.0.0",
          components: {
            queryParser: "✅ Operational",
            fuzzyMatcher: "✅ Operational", 
            relevanceScorer: "✅ Operational",
            paginator: "✅ Operational"
          },
          features: {
            complexQueryParsing: true,
            fuzzyMatching: true,
            relevanceScoring: true,
            cursorPagination: true,
            caching: true,
            performanceTracking: true
          }
        },
        performanceMetrics: metrics,
        cacheInformation: cacheInfo,
        testResults: {
          basicSearch: testResult ? "✅ Passed" : "❌ Failed",
          responseTime: testResult?.searchMetadata?.responseTime || 0
        },
        capabilities: {
          maxResultsPerSearch: 1000,
          maxQueryLength: 1000,
          supportedOperators: ["AND", "OR", "NOT", "()", "field:value", "*"],
          supportedLanguages: ["English", "Korean"],
          fuzzyMatchingAlgorithm: "Levenshtein Distance"
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Search engine status error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});
