/**
 * BenchmarkRunner.js
 * Automated benchmark testing system for database performance monitoring
 * Task 1.6: Performance Monitoring System
 */

const { executeQuery } = require('../../db');

class BenchmarkRunner {
  constructor(options = {}) {
    this.options = {
      enableAutomaticBenchmarks: options.enableAutomaticBenchmarks !== false,
      benchmarkInterval: options.benchmarkInterval || 3600000, // 1 hour
      benchmarkTimeout: options.benchmarkTimeout || 30000, // 30 seconds
      maxBenchmarkHistory: options.maxBenchmarkHistory || 100,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 5000, // 5 seconds
      performanceThresholds: options.performanceThresholds || {
        acceptable: 1000, // ms
        good: 500, // ms
        excellent: 200 // ms
      }
    };
    
    // Benchmark results storage
    this.benchmarkHistory = [];
    this.currentBenchmarks = new Map();
    
    // Benchmark suites
    this.benchmarkSuites = {
      basic: this.createBasicBenchmarkSuite(),
      comprehensive: this.createComprehensiveBenchmarkSuite(),
      performance: this.createPerformanceBenchmarkSuite(),
      stress: this.createStressBenchmarkSuite()
    };
    
    // Statistics
    this.stats = {
      totalBenchmarks: 0,
      successfulBenchmarks: 0,
      failedBenchmarks: 0,
      averageExecutionTime: 0,
      lastBenchmarkTime: null,
      performanceTrend: 'stable'
    };
    
    // Start automatic benchmarks if enabled
    if (this.options.enableAutomaticBenchmarks) {
      this.startAutomaticBenchmarks();
    }
    
    console.log('BenchmarkRunner initialized with options:', this.options);
  }

  /**
   * Run a specific benchmark suite
   */
  async runBenchmarkSuite(suiteName = 'basic', options = {}) {
    const startTime = Date.now();
    const benchmarkId = this.generateBenchmarkId();
    
    try {
      this.stats.totalBenchmarks++;
      
      const suite = this.benchmarkSuites[suiteName];
      if (!suite) {
        throw new Error(`Benchmark suite '${suiteName}' not found`);
      }
      
      console.log(`Starting benchmark suite: ${suiteName} (ID: ${benchmarkId})`);
      
      const benchmarkResult = {
        id: benchmarkId,
        suiteName,
        startTime: new Date(startTime).toISOString(),
        endTime: null,
        duration: 0,
        success: false,
        results: [],
        summary: {},
        error: null,
        environment: this.getEnvironmentInfo()
      };
      
      this.currentBenchmarks.set(benchmarkId, benchmarkResult);
      
      // Execute benchmark tests
      const results = [];
      
      for (const test of suite.tests) {
        const testResult = await this.runBenchmarkTest(test, options);
        results.push(testResult);
        
        // Break on critical failure if specified
        if (!testResult.success && test.critical) {
          throw new Error(`Critical benchmark test failed: ${test.name}`);
        }
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Calculate summary statistics
      const summary = this.calculateBenchmarkSummary(results, suite);
      
      // Update benchmark result
      benchmarkResult.endTime = new Date(endTime).toISOString();
      benchmarkResult.duration = duration;
      benchmarkResult.success = true;
      benchmarkResult.results = results;
      benchmarkResult.summary = summary;
      
      // Store in history
      this.addToHistory(benchmarkResult);
      
      // Update statistics
      this.updateStats(benchmarkResult);
      
      this.currentBenchmarks.delete(benchmarkId);
      
      console.log(`Benchmark suite completed: ${suiteName} (${duration}ms)`);
      
      return {
        success: true,
        benchmark: benchmarkResult
      };
      
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.error(`Benchmark suite failed: ${suiteName}`, error);
      
      const benchmarkResult = this.currentBenchmarks.get(benchmarkId);
      if (benchmarkResult) {
        benchmarkResult.endTime = new Date(endTime).toISOString();
        benchmarkResult.duration = duration;
        benchmarkResult.success = false;
        benchmarkResult.error = error.message;
        
        this.addToHistory(benchmarkResult);
        this.stats.failedBenchmarks++;
      }
      
      this.currentBenchmarks.delete(benchmarkId);
      
      return {
        success: false,
        error: error.message,
        benchmarkId
      };
    }
  }

  /**
   * Run a single benchmark test
   */
  async runBenchmarkTest(test, options = {}) {
    const startTime = Date.now();
    
    try {
      const testResult = {
        name: test.name,
        description: test.description,
        category: test.category,
        startTime: new Date(startTime).toISOString(),
        endTime: null,
        duration: 0,
        success: false,
        executionTime: 0,
        resultSize: 0,
        iterations: test.iterations || 1,
        results: [],
        error: null,
        performance: 'unknown'
      };
      
      // Run test iterations
      const iterationResults = [];
      
      for (let i = 0; i < testResult.iterations; i++) {
        const iterationStart = Date.now();
        
        try {
          let result;
          let executionTime;
          
          if (test.customFunction) {
            // Custom test function
            const customResult = await test.customFunction();
            result = customResult.result;
            executionTime = customResult.executionTime || (Date.now() - iterationStart);
          } else {
            // SQL query test
            result = await executeQuery(test.sql, test.params || []);
            executionTime = Date.now() - iterationStart;
          }
          
          iterationResults.push({
            iteration: i + 1,
            executionTime,
            resultSize: Array.isArray(result) ? result.length : 1,
            success: true
          });
          
        } catch (iterationError) {
          iterationResults.push({
            iteration: i + 1,
            executionTime: Date.now() - iterationStart,
            resultSize: 0,
            success: false,
            error: iterationError.message
          });
        }
      }
      
      const endTime = Date.now();
      const totalDuration = endTime - startTime;
      
      // Calculate test statistics
      const successfulIterations = iterationResults.filter(r => r.success);
      const averageExecutionTime = successfulIterations.length > 0 ?
        successfulIterations.reduce((sum, r) => sum + r.executionTime, 0) / successfulIterations.length : 0;
      
      const totalResultSize = iterationResults.reduce((sum, r) => sum + r.resultSize, 0);
      
      // Update test result
      testResult.endTime = new Date(endTime).toISOString();
      testResult.duration = totalDuration;
      testResult.success = successfulIterations.length > 0;
      testResult.executionTime = averageExecutionTime;
      testResult.resultSize = totalResultSize;
      testResult.results = iterationResults;
      testResult.performance = this.evaluatePerformance(averageExecutionTime);
      
      return testResult;
      
    } catch (error) {
      const endTime = Date.now();
      
      return {
        name: test.name,
        description: test.description,
        category: test.category,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        duration: endTime - startTime,
        success: false,
        executionTime: 0,
        resultSize: 0,
        iterations: test.iterations || 1,
        results: [],
        error: error.message,
        performance: 'failed'
      };
    }
  }

  /**
   * Create basic benchmark suite
   */
  createBasicBenchmarkSuite() {
    return {
      name: 'Basic Performance Tests',
      description: 'Essential database operations performance test',
      tests: [
        {
          name: 'Simple SELECT',
          description: 'Basic SELECT query performance',
          category: 'query',
          sql: 'SELECT COUNT(*) as count FROM players',
          iterations: 5,
          critical: true
        },
        {
          name: 'Basic JOIN',
          description: 'Simple JOIN operation performance',
          category: 'query',
          sql: `SELECT p.userId, COUNT(gs.gameDate) as gameCount 
                FROM players p 
                LEFT JOIN game_scores gs ON p.userId = gs.userId 
                WHERE p.status = 0 
                GROUP BY p.userId 
                LIMIT 10`,
          iterations: 3,
          critical: false
        },
        {
          name: 'WHERE with Index',
          description: 'Query with WHERE clause using indexed column',
          category: 'query',
          sql: 'SELECT userId, status FROM players WHERE status = 0 LIMIT 100',
          iterations: 5,
          critical: false
        },
        {
          name: 'Aggregation Query',
          description: 'Basic aggregation performance',
          category: 'query',
          sql: `SELECT status, COUNT(*) as count, AVG(CASE WHEN status = 0 THEN 1 ELSE 0 END) as avg_active 
                FROM players 
                GROUP BY status`,
          iterations: 3,
          critical: false
        }
      ]
    };
  }

  /**
   * Create comprehensive benchmark suite
   */
  createComprehensiveBenchmarkSuite() {
    return {
      name: 'Comprehensive Performance Tests',
      description: 'Thorough testing of all major database operations',
      tests: [
        ...this.createBasicBenchmarkSuite().tests,
        {
          name: 'Complex JOIN Query',
          description: 'Multi-table JOIN with aggregation',
          category: 'complex_query',
          sql: `SELECT p.userId,
                       COUNT(DISTINCT gs.gameDate) as totalGameDays,
                       ROUND(SUM(gs.netBet)) as totalNetBet,
                       ROUND(SUM(gs.winLoss)) as totalWinLoss,
                       COUNT(pp.promotion) as eventCount
                FROM players p
                LEFT JOIN game_scores gs ON p.userId = gs.userId
                LEFT JOIN promotion_players pp ON p.id = pp.player
                WHERE p.status = 0
                GROUP BY p.userId
                HAVING totalNetBet > 1000
                ORDER BY totalNetBet DESC
                LIMIT 50`,
          iterations: 2,
          critical: false
        },
        {
          name: 'Subquery Performance',
          description: 'Nested subquery execution time',
          category: 'complex_query',
          sql: `SELECT userId, 
                       (SELECT COUNT(*) FROM game_scores gs WHERE gs.userId = p.userId) as gameCount,
                       (SELECT SUM(netBet) FROM game_scores gs WHERE gs.userId = p.userId) as totalBet
                FROM players p 
                WHERE status = 0 
                LIMIT 20`,
          iterations: 2,
          critical: false
        },
        {
          name: 'Large Result Set',
          description: 'Query returning large number of rows',
          category: 'volume',
          sql: `SELECT gs.userId, gs.gameDate, gs.netBet, gs.winLoss
                FROM game_scores gs
                JOIN players p ON gs.userId = p.userId
                WHERE p.status = 0
                ORDER BY gs.gameDate DESC
                LIMIT 1000`,
          iterations: 1,
          critical: false
        },
        {
          name: 'Date Range Query',
          description: 'Query with date range filtering',
          category: 'query',
          sql: `SELECT DATE(gs.gameDate) as date, 
                       COUNT(*) as queries,
                       SUM(gs.netBet) as totalBet
                FROM game_scores gs
                WHERE gs.gameDate >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                GROUP BY DATE(gs.gameDate)
                ORDER BY date DESC
                LIMIT 30`,
          iterations: 2,
          critical: false
        }
      ]
    };
  }

  /**
   * Create performance benchmark suite
   */
  createPerformanceBenchmarkSuite() {
    return {
      name: 'Performance Optimization Tests',
      description: 'Tests focused on performance optimization features',
      tests: [
        {
          name: 'Cache Performance Test',
          description: 'Test query caching effectiveness',
          category: 'cache',
          customFunction: async () => {
            const testQuery = 'SELECT COUNT(*) FROM players WHERE status = 0';
            
            // First execution (cache miss)
            const start1 = Date.now();
            await executeQuery(testQuery);
            const firstExecution = Date.now() - start1;
            
            // Second execution (cache hit)
            const start2 = Date.now();
            await executeQuery(testQuery);
            const secondExecution = Date.now() - start2;
            
            return {
              result: {
                firstExecution,
                secondExecution,
                improvement: firstExecution > 0 ? ((firstExecution - secondExecution) / firstExecution * 100) : 0
              },
              executionTime: firstExecution + secondExecution
            };
          },
          iterations: 3,
          critical: false
        },
        {
          name: 'Index Usage Test',
          description: 'Verify index usage in queries',
          category: 'optimization',
          sql: `SELECT p.userId, p.status
                FROM players p
                WHERE p.status = 0
                ORDER BY p.userId
                LIMIT 100`,
          iterations: 5,
          critical: false
        },
        {
          name: 'Optimization Engine Test',
          description: 'Test query optimization effectiveness',
          category: 'optimization',
          customFunction: async () => {
            const testQuery = `SELECT p.userId, COUNT(gs.gameDate) as gameCount
                             FROM players p
                             LEFT JOIN game_scores gs ON p.userId = gs.userId
                             GROUP BY p.userId
                             LIMIT 50`;
            
            const start = Date.now();
            const result = await executeQuery(testQuery);
            const executionTime = Date.now() - start;
            
            return {
              result: { rowCount: result.length },
              executionTime
            };
          },
          iterations: 3,
          critical: false
        }
      ]
    };
  }

  /**
   * Create stress test benchmark suite
   */
  createStressBenchmarkSuite() {
    return {
      name: 'Stress Tests',
      description: 'High-load performance testing',
      tests: [
        {
          name: 'Concurrent Query Test',
          description: 'Multiple simultaneous queries',
          category: 'stress',
          customFunction: async () => {
            const queries = [
              'SELECT COUNT(*) FROM players',
              'SELECT COUNT(*) FROM game_scores',
              'SELECT COUNT(*) FROM money_flows',
              'SELECT COUNT(*) FROM promotion_players'
            ];
            
            const start = Date.now();
            
            // Execute all queries concurrently
            const promises = queries.map(sql => executeQuery(sql));
            const results = await Promise.all(promises);
            
            const executionTime = Date.now() - start;
            
            return {
              result: { 
                queriesExecuted: queries.length,
                totalRows: results.reduce((sum, result) => sum + (result[0]?.count || 0), 0)
              },
              executionTime
            };
          },
          iterations: 2,
          critical: false
        },
        {
          name: 'Large Aggregation',
          description: 'Heavy aggregation on large dataset',
          category: 'stress',
          sql: `SELECT 
                  DATE_FORMAT(gs.gameDate, '%Y-%m') as month,
                  COUNT(*) as totalGames,
                  COUNT(DISTINCT gs.userId) as uniqueUsers,
                  SUM(gs.netBet) as totalBet,
                  AVG(gs.netBet) as avgBet,
                  SUM(gs.winLoss) as totalWinLoss
                FROM game_scores gs
                JOIN players p ON gs.userId = p.userId
                WHERE p.status = 0
                GROUP BY DATE_FORMAT(gs.gameDate, '%Y-%m')
                ORDER BY month DESC
                LIMIT 12`,
          iterations: 1,
          critical: false
        }
      ]
    };
  }

  /**
   * Calculate benchmark summary statistics
   */
  calculateBenchmarkSummary(results, suite) {
    const successfulTests = results.filter(r => r.success);
    const failedTests = results.filter(r => !r.success);
    
    const totalExecutionTime = results.reduce((sum, r) => sum + r.executionTime, 0);
    const averageExecutionTime = results.length > 0 ? totalExecutionTime / results.length : 0;
    
    const performanceDistribution = {
      excellent: 0,
      good: 0,
      acceptable: 0,
      poor: 0,
      failed: failedTests.length
    };
    
    for (const result of successfulTests) {
      performanceDistribution[result.performance]++;
    }
    
    return {
      suiteName: suite.name,
      totalTests: results.length,
      successfulTests: successfulTests.length,
      failedTests: failedTests.length,
      successRate: results.length > 0 ? (successfulTests.length / results.length * 100) : 0,
      totalExecutionTime,
      averageExecutionTime: Math.round(averageExecutionTime),
      performanceDistribution,
      overallPerformance: this.calculateOverallPerformance(performanceDistribution),
      recommendations: this.generateRecommendations(results)
    };
  }

  /**
   * Evaluate performance based on execution time
   */
  evaluatePerformance(executionTime) {
    const thresholds = this.options.performanceThresholds;
    
    if (executionTime <= thresholds.excellent) return 'excellent';
    if (executionTime <= thresholds.good) return 'good';
    if (executionTime <= thresholds.acceptable) return 'acceptable';
    return 'poor';
  }

  /**
   * Calculate overall performance rating
   */
  calculateOverallPerformance(distribution) {
    const total = distribution.excellent + distribution.good + 
                 distribution.acceptable + distribution.poor;
    
    if (total === 0) return 'unknown';
    
    const score = (distribution.excellent * 4 + distribution.good * 3 + 
                  distribution.acceptable * 2 + distribution.poor * 1) / total;
    
    if (score >= 3.5) return 'excellent';
    if (score >= 2.5) return 'good';
    if (score >= 1.5) return 'acceptable';
    return 'poor';
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(results) {
    const recommendations = [];
    
    const slowTests = results.filter(r => r.success && r.executionTime > 1000);
    const failedTests = results.filter(r => !r.success);
    
    if (slowTests.length > 0) {
      recommendations.push({
        type: 'performance',
        severity: 'medium',
        message: `${slowTests.length} tests are running slowly (>1s)`,
        suggestion: 'Consider adding indexes or optimizing queries',
        affectedTests: slowTests.map(t => t.name)
      });
    }
    
    if (failedTests.length > 0) {
      recommendations.push({
        type: 'reliability',
        severity: 'high',
        message: `${failedTests.length} tests failed`,
        suggestion: 'Investigate and fix failing queries',
        affectedTests: failedTests.map(t => t.name)
      });
    }
    
    const complexQueries = results.filter(r => r.category === 'complex_query' && r.executionTime > 500);
    if (complexQueries.length > 0) {
      recommendations.push({
        type: 'optimization',
        severity: 'low',
        message: 'Complex queries could benefit from optimization',
        suggestion: 'Review execution plans and consider query restructuring',
        affectedTests: complexQueries.map(t => t.name)
      });
    }
    
    return recommendations;
  }

  /**
   * Get benchmark history
   */
  getBenchmarkHistory(limit = 50) {
    return this.benchmarkHistory
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, limit);
  }

  /**
   * Get latest benchmark results
   */
  getLatestBenchmark(suiteName = null) {
    if (suiteName) {
      return this.benchmarkHistory
        .filter(b => b.suiteName === suiteName)
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0] || null;
    }
    
    return this.benchmarkHistory
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0] || null;
  }

  /**
   * Get benchmark statistics
   */
  getBenchmarkStats() {
    const recentBenchmarks = this.benchmarkHistory.slice(-10);
    const trend = this.calculatePerformanceTrend(recentBenchmarks);
    
    return {
      ...this.stats,
      performanceTrend: trend,
      availableSuites: Object.keys(this.benchmarkSuites),
      recentBenchmarks: recentBenchmarks.length,
      totalHistory: this.benchmarkHistory.length
    };
  }

  /**
   * Calculate performance trend
   */
  calculatePerformanceTrend(benchmarks) {
    if (benchmarks.length < 2) return 'stable';
    
    const recent = benchmarks.slice(-3);
    const older = benchmarks.slice(-6, -3);
    
    if (older.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((sum, b) => sum + b.summary.averageExecutionTime, 0) / recent.length;
    const olderAvg = older.reduce((sum, b) => sum + b.summary.averageExecutionTime, 0) / older.length;
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (change > 10) return 'degrading';
    if (change < -10) return 'improving';
    return 'stable';
  }

  /**
   * Start automatic benchmarks
   */
  startAutomaticBenchmarks() {
    if (this.benchmarkTimer) {
      clearInterval(this.benchmarkTimer);
    }
    
    this.benchmarkTimer = setInterval(async () => {
      try {
        await this.runBenchmarkSuite('basic');
        console.log('Automatic benchmark completed');
      } catch (error) {
        console.error('Automatic benchmark failed:', error);
      }
    }, this.options.benchmarkInterval);
    
    console.log('Automatic benchmarks started');
  }

  /**
   * Stop automatic benchmarks
   */
  stopAutomaticBenchmarks() {
    if (this.benchmarkTimer) {
      clearInterval(this.benchmarkTimer);
      this.benchmarkTimer = null;
    }
    
    console.log('Automatic benchmarks stopped');
  }

  /**
   * Helper methods
   */
  
  addToHistory(benchmark) {
    this.benchmarkHistory.push(benchmark);
    
    // Keep only recent history
    if (this.benchmarkHistory.length > this.options.maxBenchmarkHistory) {
      this.benchmarkHistory = this.benchmarkHistory.slice(-this.options.maxBenchmarkHistory);
    }
  }
  
  updateStats(benchmark) {
    this.stats.lastBenchmarkTime = benchmark.endTime;
    
    if (benchmark.success) {
      this.stats.successfulBenchmarks++;
    }
    
    // Update average execution time
    const totalTime = this.stats.averageExecutionTime * (this.stats.totalBenchmarks - 1) + benchmark.duration;
    this.stats.averageExecutionTime = Math.round(totalTime / this.stats.totalBenchmarks);
  }
  
  generateBenchmarkId() {
    return `benchmark_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
  
  getEnvironmentInfo() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reset benchmark data
   */
  reset() {
    this.benchmarkHistory = [];
    this.currentBenchmarks.clear();
    this.stats = {
      totalBenchmarks: 0,
      successfulBenchmarks: 0,
      failedBenchmarks: 0,
      averageExecutionTime: 0,
      lastBenchmarkTime: null,
      performanceTrend: 'stable'
    };
    
    console.log('BenchmarkRunner reset completed');
  }

  /**
   * Destroy benchmark runner
   */
  destroy() {
    this.stopAutomaticBenchmarks();
    this.reset();
    console.log('BenchmarkRunner destroyed');
  }
}

module.exports = BenchmarkRunner;
