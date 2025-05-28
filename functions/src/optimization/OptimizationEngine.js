/**
 * OptimizationEngine.js
 * Main optimization engine that integrates caching, query optimization, and analysis
 * Task 1.5: Query Optimization and Caching
 */

const CacheManager = require('./CacheManager');
const QueryOptimizer = require('./QueryOptimizer');
const QueryAnalyzer = require('./QueryAnalyzer');
const IndexRecommendations = require('./IndexRecommendations');
const { executeQuery } = require('../../db');

class OptimizationEngine {
  constructor(options = {}) {
    // Initialize components
    this.cacheManager = new CacheManager({
      maxCacheSize: options.maxCacheSize || 1000,
      defaultTTL: options.defaultTTL || 300000, // 5 minutes
      enableLRU: options.enableLRU !== false
    });
    
    this.queryOptimizer = new QueryOptimizer({
      enableSelectOptimization: options.enableSelectOptimization !== false,
      enableJoinOptimization: options.enableJoinOptimization !== false,
      enableWhereOptimization: options.enableWhereOptimization !== false,
      enableIndexHints: options.enableIndexHints !== false,
      enableQueryRewriting: options.enableQueryRewriting !== false
    });
    
    this.queryAnalyzer = new QueryAnalyzer({
      enableExplain: options.enableExplain !== false,
      trackSlowQueries: options.trackSlowQueries !== false,
      slowQueryThreshold: options.slowQueryThreshold || 1000
    });
    
    this.indexRecommendations = new IndexRecommendations({
      analysisThreshold: options.analysisThreshold || 10,
      confidenceThreshold: options.confidenceThreshold || 70
    });
    
    // Configuration
    this.config = {
      enableCaching: options.enableCaching !== false,
      enableOptimization: options.enableOptimization !== false,
      enableAnalysis: options.enableAnalysis !== false,
      enableIndexRecommendations: options.enableIndexRecommendations !== false,
      autoOptimize: options.autoOptimize !== false,
      performanceTracking: options.performanceTracking !== false
    };
    
    // Statistics
    this.stats = {
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      optimizedQueries: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      performanceImprovements: 0
    };
    
    console.log('OptimizationEngine initialized with configuration:', this.config);
  }

  /**
   * Execute query with full optimization pipeline
   */
  async executeOptimizedQuery(sql, params = [], options = {}) {
    const startTime = Date.now();
    const queryId = this.generateQueryId();
    
    try {
      this.stats.totalQueries++;
      
      let result = null;
      let executionTime = 0;
      let wasOptimized = false;
      let wasCached = false;
      let optimizationResult = null;
      let analysisResult = null;
      
      // Step 1: Check cache first
      if (this.config.enableCaching) {
        result = this.cacheManager.get(sql, params);
        if (result) {
          this.stats.cacheHits++;
          wasCached = true;
          
          const totalTime = Date.now() - startTime;
          
          return {
            success: true,
            data: result,
            metadata: {
              queryId,
              wasCached,
              wasOptimized,
              executionTime: 0,
              totalTime,
              fromCache: true
            }
          };
        }
        this.stats.cacheMisses++;
      }
      
      // Step 2: Optimize query if enabled
      let finalSQL = sql;
      let finalParams = params;
      
      if (this.config.enableOptimization) {
        optimizationResult = await this.queryOptimizer.optimize(sql, params, options);
        
        if (optimizationResult.success && optimizationResult.optimizedSQL !== sql) {
          finalSQL = optimizationResult.optimizedSQL;
          finalParams = optimizationResult.optimizedParams;
          wasOptimized = true;
          this.stats.optimizedQueries++;
          this.stats.performanceImprovements++;
        }
      }
      
      // Step 3: Execute query
      const queryStartTime = Date.now();
      result = await executeQuery(finalSQL, finalParams);
      executionTime = Date.now() - queryStartTime;
      
      // Step 4: Cache result if enabled
      if (this.config.enableCaching && result) {
        this.cacheManager.set(sql, params, result);
      }
      
      // Step 5: Analyze query performance if enabled
      if (this.config.enableAnalysis) {
        analysisResult = await this.queryAnalyzer.analyzeQuery(
          finalSQL, 
          finalParams, 
          executionTime
        );
        
        // Track patterns for index recommendations
        if (this.config.enableIndexRecommendations && analysisResult.success) {
          this.indexRecommendations.analyzeQuery(
            finalSQL, 
            finalParams, 
            executionTime,
            analysisResult.analysis?.executionPlan
          );
        }
      }
      
      // Update statistics
      this.updateStats(executionTime);
      
      const totalTime = Date.now() - startTime;
      
      return {
        success: true,
        data: result,
        metadata: {
          queryId,
          wasCached,
          wasOptimized,
          executionTime,
          totalTime,
          optimization: optimizationResult ? {
            applied: wasOptimized,
            optimizationsCount: optimizationResult.optimizationsApplied?.length || 0,
            estimatedImprovement: optimizationResult.performance?.estimatedImprovement
          } : null,
          analysis: analysisResult?.success ? {
            complexityScore: analysisResult.analysis?.performance?.complexityScore,
            isSlowQuery: analysisResult.analysis?.performance?.isSlowQuery,
            recommendations: analysisResult.analysis?.recommendations?.length || 0
          } : null
        }
      };
      
    } catch (error) {
      const totalTime = Date.now() - startTime;
      
      console.error('OptimizationEngine query execution error:', error);
      
      return {
        success: false,
        error: error.message,
        metadata: {
          queryId,
          executionTime: totalTime,
          sql: sql.substring(0, 100)
        }
      };
    }
  }

  /**
   * Get comprehensive performance report
   */
  async getPerformanceReport() {
    try {
      const report = {
        timestamp: new Date().toISOString(),
        overview: this.getOverviewStats(),
        caching: this.cacheManager.getStats(),
        optimization: this.queryOptimizer.getStats(),
        analysis: this.queryAnalyzer.getStats(),
        indexRecommendations: this.indexRecommendations.getStats(),
        performance: {
          topCachedQueries: this.cacheManager.getTopQueries(5),
          slowQueries: this.queryAnalyzer.getSlowQueriesReport(5),
          trends: this.queryAnalyzer.getPerformanceTrends('1h'),
          indexRecommendations: this.indexRecommendations.getRecommendations({ maxResults: 5 })
        }
      };
      
      return {
        success: true,
        report
      };
      
    } catch (error) {
      console.error('Failed to generate performance report:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get index recommendations
   */
  async getIndexRecommendations(options = {}) {
    try {
      // Generate fresh recommendations
      await this.indexRecommendations.generateRecommendations();
      
      const recommendations = this.indexRecommendations.getRecommendations(options);
      
      return {
        success: true,
        ...recommendations
      };
      
    } catch (error) {
      console.error('Failed to get index recommendations:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Optimize specific query (without execution)
   */
  async optimizeQuery(sql, params = []) {
    try {
      const result = await this.queryOptimizer.optimize(sql, params);
      return result;
      
    } catch (error) {
      console.error('Query optimization error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze specific query (without execution)
   */
  async analyzeQuery(sql, params = []) {
    try {
      const result = await this.queryAnalyzer.analyzeQuery(sql, params);
      return result;
      
    } catch (error) {
      console.error('Query analysis error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cache management operations
   */
  
  getCacheStats() {
    return this.cacheManager.getStats();
  }
  
  clearCache() {
    return this.cacheManager.clear();
  }
  
  invalidateCache(pattern) {
    return this.cacheManager.invalidate(pattern);
  }
  
  invalidateCacheByTable(tableName) {
    return this.cacheManager.invalidateByTable(tableName);
  }

  /**
   * Configuration management
   */
  
  updateConfiguration(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Update component configurations
    if (newConfig.cacheOptions) {
      this.cacheManager.updateConfig(newConfig.cacheOptions);
    }
    
    console.log('OptimizationEngine configuration updated:', this.config);
    return this.config;
  }
  
  getConfiguration() {
    return {
      main: this.config,
      cache: this.cacheManager.getConfig(),
      optimizer: this.queryOptimizer.getStats().configuration,
      analyzer: this.queryAnalyzer.getStats().configuration,
      indexRecommendations: this.indexRecommendations.getStats().configuration
    };
  }

  /**
   * Performance testing
   */
  async performanceTest(testQueries = []) {
    const testResults = [];
    
    for (const testQuery of testQueries) {
      const { sql, params = [], label = 'Test Query' } = testQuery;
      
      // Test without optimization
      const normalStart = Date.now();
      let normalResult = null;
      try {
        normalResult = await executeQuery(sql, params);
      } catch (error) {
        normalResult = { error: error.message };
      }
      const normalTime = Date.now() - normalStart;
      
      // Test with optimization
      const optimizedStart = Date.now();
      const optimizedResult = await this.executeOptimizedQuery(sql, params);
      const optimizedTime = Date.now() - optimizedStart;
      
      const improvement = normalTime > 0 ? 
        ((normalTime - optimizedTime) / normalTime * 100) : 0;
      
      testResults.push({
        label,
        sql: sql.substring(0, 100),
        normalExecutionTime: normalTime,
        optimizedExecutionTime: optimizedTime,
        improvement: Math.round(improvement * 100) / 100,
        cacheHit: optimizedResult.metadata?.wasCached || false,
        wasOptimized: optimizedResult.metadata?.wasOptimized || false
      });
    }
    
    return {
      success: true,
      testResults,
      summary: {
        totalTests: testResults.length,
        averageImprovement: testResults.reduce((sum, r) => sum + r.improvement, 0) / testResults.length,
        cacheHitRate: testResults.filter(r => r.cacheHit).length / testResults.length * 100,
        optimizationRate: testResults.filter(r => r.wasOptimized).length / testResults.length * 100
      }
    };
  }

  /**
   * Generate sample test queries for demonstration
   */
  generateSampleTestQueries() {
    return [
      {
        label: 'Basic User Query',
        sql: 'SELECT userId, status FROM players WHERE status = ? ORDER BY userId LIMIT ?',
        params: [0, 10]
      },
      {
        label: 'Game Statistics Query',
        sql: `SELECT p.userId, COUNT(gs.gameDate) as gameCount, SUM(gs.netBet) as totalBet 
              FROM players p 
              LEFT JOIN game_scores gs ON p.userId = gs.userId 
              WHERE p.status = ? 
              GROUP BY p.userId 
              ORDER BY totalBet DESC`,
        params: [0]
      },
      {
        label: 'Complex Analytics Query',
        sql: `SELECT p.userId, 
                     COUNT(DISTINCT gs.gameDate) as totalGameDays,
                     ROUND(SUM(gs.netBet)) as totalNetBet,
                     ROUND(SUM(gs.winLoss)) as totalWinLoss,
                     COUNT(pp.promotion) as eventCount
              FROM players p
              LEFT JOIN game_scores gs ON p.userId = gs.userId
              LEFT JOIN promotion_players pp ON p.id = pp.player
              WHERE p.status = ?
              GROUP BY p.userId
              HAVING totalNetBet > ?
              ORDER BY totalNetBet DESC`,
        params: [0, 10000]
      }
    ];
  }

  /**
   * Helper methods
   */
  
  updateStats(executionTime) {
    this.stats.totalExecutionTime += executionTime;
    this.stats.averageExecutionTime = this.stats.totalExecutionTime / this.stats.totalQueries;
  }
  
  getOverviewStats() {
    const cacheStats = this.cacheManager.getStats();
    
    return {
      ...this.stats,
      cacheHitRate: cacheStats.hitRate,
      optimizationRate: this.stats.totalQueries > 0 ? 
        (this.stats.optimizedQueries / this.stats.totalQueries * 100) : 0,
      performance: {
        averageExecutionTime: Math.round(this.stats.averageExecutionTime),
        totalQueries: this.stats.totalQueries,
        performanceImprovements: this.stats.performanceImprovements
      }
    };
  }
  
  generateQueryId() {
    return `query_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Health check for all components
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      components: {
        cacheManager: 'healthy',
        queryOptimizer: 'healthy',
        queryAnalyzer: 'healthy',
        indexRecommendations: 'healthy',
        database: 'unknown'
      },
      issues: []
    };
    
    try {
      // Test database connection
      await executeQuery('SELECT 1 as test');
      health.components.database = 'healthy';
    } catch (error) {
      health.components.database = 'unhealthy';
      health.issues.push(`Database connection failed: ${error.message}`);
      health.status = 'degraded';
    }
    
    // Check cache manager
    const cacheStats = this.cacheManager.getStats();
    if (cacheStats.cacheSize > this.cacheManager.maxCacheSize * 0.9) {
      health.issues.push('Cache is near capacity');
      health.status = 'warning';
    }
    
    return health;
  }

  /**
   * Reset all statistics and clear caches
   */
  reset() {
    this.stats = {
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      optimizedQueries: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      performanceImprovements: 0
    };
    
    this.cacheManager.clear();
    this.queryOptimizer.resetStats();
    this.queryAnalyzer.reset();
    
    console.log('OptimizationEngine reset completed');
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.cacheManager.destroy();
    console.log('OptimizationEngine destroyed');
  }
}

module.exports = OptimizationEngine;
