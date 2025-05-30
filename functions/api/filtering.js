/**
 * Filtering API Module - DB3 Database Query System
 * Contains advanced filtering system and preset-based user analysis
 */

const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });

// Import database utilities
const { executeQuery, queryOne } = require('../db');

// Import filtering system
const FilterEngine = require('../src/filters/FilterEngine');
const FilterPresets = require('../src/filters/FilterPresets');

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
 * Helper function to get preset parameters
 */
function getPresetParameters(presetName) {
  const parameters = {
    highValueUsers: ['minNetBet', 'minGameDays'],
    dormantUsers: ['minDormantDays', 'minHistoricalBet'],
    newActiveUsers: ['maxDaysSinceFirst', 'minGameDays'],
    eventParticipants: ['minEvents', 'minRewards'],
    recentBigSpenders: ['daysPeriod', 'minRecentBet'],
    consistentPlayers: ['minGameDays', 'minConsistencyRatio'],
    riskUsers: ['maxWinLossRatio', 'minTotalBet'],
    vipCandidates: ['minNetBet', 'minGameDays', 'maxDaysSinceLastGame'],
    reactivationTargets: ['minDormantDays', 'maxDormantDays', 'minHistoricalValue']
  };
  
  return parameters[presetName] || [];
}

/**
 * Test Filter Engine
 * Tests basic filter engine functionality and SQL generation
 */
exports.testFilterEngine = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const startTime = Date.now();
      
      // Test 1: Basic Filter Engine usage
      const filterEngine = new FilterEngine()
        .setTable('players')
        .select(['p.userId', 'p.status'])
        .addUserStatusFilter(0)
        .addExactFilter('p.userId', 'user123');
      
      const { sql, params } = filterEngine.buildQuery(null, 'p.userId ASC', 5);
      
      // Test 2: Filter summary
      const summary = filterEngine.getFilterSummary();
      
      const executionTime = Date.now() - startTime;
      
      res.json({
        status: "success",
        message: "Filter Engine test completed",
        test: {
          generatedSQL: sql,
          parameters: params,
          filterSummary: summary
        },
        performance: {
          executionTime: `${executionTime}ms`
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Filter Engine test error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        test: "Filter Engine",
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Get Available Filter Presets
 * Returns all available filter presets with descriptions and parameters
 */
exports.getFilterPresets = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const presets = FilterPresets.getAvailablePresets();
      
      const presetDescriptions = {
        highValueUsers: "Users with significant betting activity and engagement",
        dormantUsers: "Users who haven't played recently but have valuable history",
        newActiveUsers: "Recently joined users with good initial activity",
        eventParticipants: "Users who participated in promotional events",
        recentBigSpenders: "Users with high activity in recent period",
        consistentPlayers: "Regular players with consistent long-term activity",
        riskUsers: "Users with unusual patterns requiring attention",
        vipCandidates: "High-value users suitable for VIP programs",
        reactivationTargets: "Dormant users with good reactivation potential"
      };
      
      const detailedPresets = presets.map(preset => ({
        name: preset,
        description: presetDescriptions[preset],
        parameters: getPresetParameters(preset)
      }));
      
      res.json({
        status: "success",
        message: "Available filter presets",
        totalPresets: presets.length,
        presets: detailedPresets,
        usage: {
          endpoint: "/getAdvancedUserAnalysis",
          method: "GET",
          example: "?preset=highValueUsers&minNetBet=200000&limit=20"
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Get filter presets error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Advanced User Analysis with Filter Presets
 * Uses predefined filter presets for advanced user segmentation and analysis
 */
exports.getAdvancedUserAnalysis = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      const { 
        preset = 'highValueUsers',
        limit = 50,
        orderBy = 'totalNetBet DESC',
        ...presetOptions 
      } = req.query;
      
      const startTime = Date.now();
      
      // Create filter using preset
      const filterEngine = FilterPresets.createByName(preset, presetOptions);
      
      // Build and execute query
      const { sql, params } = filterEngine.buildQuery(
        'p.userId',  // GROUP BY
        orderBy,     // ORDER BY
        parseInt(limit) // LIMIT
      );
      
      const results = await executeQuery(sql, params);
      const executionTime = Date.now() - startTime;
      
      res.json({
        status: "success",
        preset,
        presetOptions,
        query: {
          sql: sql.substring(0, 200) + '...', // Truncate for readability
          parameterCount: params.length
        },
        filterSummary: filterEngine.getFilterSummary(),
        results,
        count: results.length,
        performance: {
          executionTime: `${executionTime}ms`
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Advanced user analysis error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        preset: req.query.preset,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Custom Filter Builder API
 * Allows building custom filters with dynamic configuration
 */
exports.buildCustomFilter = functions.https.onRequest(async (req, res) => {
  await authenticateUser(req, res, async () => {
    try {
      const {
        table = 'players',
        fields = ['p.userId'],
        filters = [],
        joins = [],
        groupBy = null,
        orderBy = null,
        limit = 100
      } = req.body;
      
      const startTime = Date.now();
      
      // Build custom filter
      const filterEngine = new FilterEngine()
        .setTable(table)
        .select(fields);
      
      // Add joins
      joins.forEach(join => {
        filterEngine.join(join.table, join.leftField, join.operator, join.rightField, join.type);
      });
      
      // Add filters dynamically
      filters.forEach(filter => {
        switch (filter.type) {
          case 'range':
            filterEngine.addRangeFilter(filter.field, filter.min, filter.max);
            break;
          case 'exact':
            filterEngine.addExactFilter(filter.field, filter.value);
            break;
          case 'text':
            filterEngine.addTextFilter(filter.field, filter.value);
            break;
          case 'in':
            filterEngine.addInFilter(filter.field, filter.values);
            break;
          case 'date':
            filterEngine.addDateRangeFilter(filter.field, filter.startDate, filter.endDate);
            break;
          case 'having':
            filterEngine.addHavingFilter(filter.field, filter.operator, filter.value);
            break;
          case 'activity':
            filterEngine.addActivityFilter(filter.status, filter.threshold);
            break;
          case 'userStatus':
            filterEngine.addUserStatusFilter(filter.status);
            break;
        }
      });
      
      // Build query
      const { sql, params } = filterEngine.buildQuery(groupBy, orderBy, parseInt(limit));
      
      // Execute query
      const results = await executeQuery(sql, params);
      const executionTime = Date.now() - startTime;
      
      res.json({
        status: "success",
        message: "Custom filter executed successfully",
        query: {
          sql,
          parameters: params
        },
        filterSummary: filterEngine.getFilterSummary(),
        results,
        count: results.length,
        performance: {
          executionTime: `${executionTime}ms`
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Custom filter builder error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});
