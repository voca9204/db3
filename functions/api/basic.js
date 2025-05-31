/**
 * Basic API Module - DB3 Database Query System
 * Contains fundamental system APIs: health check, connection test, system status
 */

const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });

// Import database utilities
const { executeQuery, queryOne } = require('../db');

// Import performance monitor for health checks
const { PerformanceMonitor } = require('../src/monitoring');

// Initialize performance monitor
const performanceMonitor = new PerformanceMonitor({
  enableMetrics: true,
  enableAlerts: false, // Reduced load
  slowQueryThreshold: 1000,
  enableBenchmarking: false // Reduced load
});

/**
 * Hello World - System Information
 * Returns basic system information and status
 */
exports.helloWorld = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    res.json({
      message: "DB3 Simplified Database Query System",
      version: "2.1.0",
      environment: process.env.NODE_ENV || 'development',
      features: [
        "Simplified Connection Management",
        "Proven DB2 Architecture", 
        "Flexible Data Analysis",
        "Marketing Strategy Support"
      ],
      timestamp: new Date().toISOString(),
      status: "success"
    });
  });
});

/**
 * Database Connection Test
 * Tests database connectivity and response time
 */
exports.testConnection = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const startTime = Date.now();
      
      // Test database connection with simple query
      const testResult = await queryOne('SELECT 1 as test, NOW() as currentTime');
      const connectionTime = Date.now() - startTime;
      
      res.json({
        status: "success",
        message: "MariaDB connection successful",
        testResult,
        responseTime: `${connectionTime}ms`,
        config: {
          environment: process.env.NODE_ENV || 'development',
          host: '211.248.190.46',
          database: 'hermes'
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Connection test error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * System Status - Database Statistics
 * Returns comprehensive system statistics and database info
 */
exports.getSystemStatus = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const startTime = Date.now();
      
      // Database statistics
      const statsQuery = `
        SELECT 
          'players' as table_name, COUNT(*) as record_count FROM players
        UNION ALL
        SELECT 
          'game_scores' as table_name, COUNT(*) as record_count FROM game_scores
        UNION ALL
        SELECT 
          'promotion_players' as table_name, COUNT(*) as record_count FROM promotion_players
        UNION ALL
        SELECT 
          'money_flows' as table_name, COUNT(*) as record_count FROM money_flows
      `;
      
      const stats = await executeQuery(statsQuery);
      const executionTime = Date.now() - startTime;
      
      res.json({
        status: "success",
        system: "DB3 Simplified Database Query System",
        version: "2.1.0",
        environment: process.env.NODE_ENV || 'development',
        database: {
          host: '211.248.190.46',
          database: 'hermes',
          status: "connected",
          statusQueryTime: `${executionTime}ms`
        },
        statistics: stats,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('System status error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * System Health Check
 * Performs comprehensive health check using performance monitor
 */
exports.getSystemHealth = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const result = await performanceMonitor.performHealthCheck();
      
      res.json({
        status: result.success ? "success" : "error",
        ...result,
        monitoringStatus: performanceMonitor.getMonitoringStatus(),
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('System health check error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * TEST ONLY: Database Schema Check
 * Shows table structure to understand available fields
 */
exports.getTableSchema = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const tableName = req.query.table || 'players';
      
      console.log(`🔍 Checking schema for table: ${tableName}`);
      
      const startTime = Date.now();
      const schemaQuery = `DESCRIBE ${tableName}`;
      const schemaResult = await executeQuery(schemaQuery);
      const responseTime = Date.now() - startTime;
      
      res.json({
        status: "success",
        table: tableName,
        schema: schemaResult,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
        note: "⚠️ TEST ONLY - Development use only"
      });
      
    } catch (error) {
      console.error('Schema check error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * TEST ONLY: User Contact Information 
 * Shows userId with contact info for testing purposes
 * ⚠️ THIS IS FOR LOCAL TESTING ONLY - DO NOT USE IN PRODUCTION
 */
exports.getUserContactInfo = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 10, 50);
      const offset = parseInt(req.query.offset) || 0;
      
      console.log('⚠️ TEST MODE: Fetching user contact information');
      
      const startTime = Date.now();
      
      // Query to get actual contact information
      const contactQuery = `
        SELECT 
          userId,
          name,
          phoneName,
          note,
          site,
          createdAt,
          lastPlayDate,
          CASE 
            WHEN phoneName IS NOT NULL AND phoneName != '' THEN phoneName
            ELSE 'No Phone'
          END as phoneInfo,
          CASE 
            WHEN note IS NOT NULL AND note != '' THEN note
            ELSE 'No WeChat/Note'
          END as wechatOrNote
        FROM players 
        WHERE userId IS NOT NULL 
        ORDER BY id DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      const result = await executeQuery(contactQuery);
      const responseTime = Date.now() - startTime;
      
      res.json({
        status: "success",
        data: result,
        pagination: {
          limit: limit,
          offset: offset,
          count: result.length
        },
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
        warning: "⚠️ TEST ONLY - Contains actual user contact information",
        note: "Fields: userId, name, phoneName, note(possible WeChat), site, dates",
        security: "🔒 Remove this API before production deployment"
      });
      
    } catch (error) {
      console.error('User contact info error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * TEST ONLY: Check Other Tables for Contact Info
 * Explores other tables that might contain contact information
 */
exports.exploreContactTables = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      console.log('🔍 Exploring other tables for contact information');
      
      const startTime = Date.now();
      
      // First, list all tables
      const tablesQuery = "SHOW TABLES";
      const tables = await executeQuery(tablesQuery);
      
      // Look for tables that might contain contact info
      const contactTables = [];
      for (const table of tables) {
        const tableName = Object.values(table)[0];
        if (tableName.toLowerCase().includes('contact') || 
            tableName.toLowerCase().includes('phone') || 
            tableName.toLowerCase().includes('wechat') ||
            tableName.toLowerCase().includes('user') ||
            tableName.toLowerCase().includes('profile')) {
          contactTables.push(tableName);
        }
      }
      
      const responseTime = Date.now() - startTime;
      
      res.json({
        status: "success",
        allTables: tables.map(t => Object.values(t)[0]),
        potentialContactTables: contactTables,
        totalTables: tables.length,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
        note: "⚠️ TEST ONLY - Exploring database structure for contact info",
        suggestion: "Use getTableSchema?table=[tableName] to check each table structure"
      });
      
    } catch (error) {
      console.error('Table exploration error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * TEST ONLY: Get Full Contact Information
 * Combines players table with dedicated contact tables for complete contact info
 * ⚠️ THIS IS FOR LOCAL TESTING ONLY - CONTAINS SENSITIVE DATA
 */
exports.getFullContactInfo = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 10, 100);
      const offset = parseInt(req.query.offset) || 0;
      const contactType = req.query.type; // phone, wechat, etc.
      
      console.log('⚠️ SENSITIVE: Fetching full contact information');
      
      const startTime = Date.now();
      
      // Query to combine players with their contact information
      let contactQuery = `
        SELECT 
          p.userId,
          p.name,
          p.phoneName as playerPhoneName,
          p.note as playerNote,
          p.site,
          p.lastPlayDate,
          pc.contactType,
          pc.contact as contactValue,
          CASE 
            WHEN pc.contactType = 'phone' THEN '📞'
            WHEN pc.contactType = 'wechat' THEN '💬'
            WHEN pc.contactType = 'email' THEN '📧'
            ELSE '📱'
          END as contactIcon
        FROM players p
        LEFT JOIN player_contacts pc ON p.id = pc.player
        WHERE p.userId IS NOT NULL
      `;
      
      // Filter by contact type if specified
      if (contactType) {
        contactQuery += ` AND pc.contactType = '${contactType}'`;
      }
      
      contactQuery += `
        ORDER BY p.id DESC, pc.contactType ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      const result = await executeQuery(contactQuery);
      
      // Also get contact type summary
      const summaryQuery = `
        SELECT 
          contactType,
          COUNT(*) as count
        FROM player_contacts 
        GROUP BY contactType
        ORDER BY count DESC
      `;
      
      const summary = await executeQuery(summaryQuery);
      const responseTime = Date.now() - startTime;
      
      res.json({
        status: "success",
        data: result,
        contactTypeSummary: summary,
        pagination: {
          limit: limit,
          offset: offset,
          count: result.length
        },
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
        warning: "🔒 SENSITIVE DATA - Contains actual contact information",
        note: "Combined data from players + player_contacts tables",
        availableTypes: summary.map(s => s.contactType),
        security: "⚠️ REMOVE THIS API BEFORE PRODUCTION DEPLOYMENT"
      });
      
    } catch (error) {
      console.error('Full contact info error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});
