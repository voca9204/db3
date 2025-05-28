/**
 * QueryAnalyzer.js
 * Query execution plan analysis and performance monitoring
 * Task 1.5: Query Optimization and Caching
 */

const { executeQuery } = require('../../db');

class QueryAnalyzer {
  constructor(options = {}) {
    this.options = {
      enableExplain: options.enableExplain !== false,
      trackSlowQueries: options.trackSlowQueries !== false,
      slowQueryThreshold: options.slowQueryThreshold || 1000, // 1 second
      maxAnalysisHistory: options.maxAnalysisHistory || 100
    };
    
    this.analysisHistory = [];
    this.slowQueries = [];
    
    // Performance statistics
    this.stats = {
      totalQueries: 0,
      slowQueries: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    
    console.log('QueryAnalyzer initialized with options:', this.options);
  }

  /**
   * Analyze query performance with execution plan
   */
  async analyzeQuery(sql, params = [], executionTime = null) {
    const startTime = Date.now();
    
    try {
      const analysis = {
        id: this.generateAnalysisId(),
        timestamp: new Date().toISOString(),
        sql: sql.substring(0, 500), // Truncate for storage
        paramCount: params.length,
        executionTime,
        executionPlan: null,
        recommendations: [],
        performance: {
          isSlowQuery: false,
          complexityScore: 0,
          indexUsage: 'unknown'
        }
      };

      // Get execution plan if enabled and if it's a SELECT query
      if (this.options.enableExplain && sql.trim().toUpperCase().startsWith('SELECT')) {
        try {
          analysis.executionPlan = await this.getExecutionPlan(sql, params);
          analysis.recommendations = this.generateRecommendations(analysis.executionPlan, sql);
          analysis.performance = this.analyzePerformance(analysis.executionPlan, executionTime);
        } catch (explainError) {
          console.warn('Failed to get execution plan:', explainError.message);
          analysis.executionPlan = { error: explainError.message };
        }
      }

      // Calculate complexity score
      analysis.performance.complexityScore = this.calculateComplexityScore(sql, analysis.executionPlan);

      // Track slow queries
      if (this.options.trackSlowQueries && executionTime && executionTime > this.options.slowQueryThreshold) {
        analysis.performance.isSlowQuery = true;
        this.trackSlowQuery(analysis);
      }

      // Update statistics
      this.updateStats(analysis);

      // Store in history
      this.addToHistory(analysis);

      const analysisTime = Date.now() - startTime;
      
      return {
        success: true,
        analysis,
        analysisTime: `${analysisTime}ms`
      };

    } catch (error) {
      console.error('Query analysis error:', error);
      return {
        success: false,
        error: error.message,
        sql: sql.substring(0, 100)
      };
    }
  }

  /**
   * Get MySQL execution plan using EXPLAIN
   */
  async getExecutionPlan(sql, params = []) {
    try {
      // Use EXPLAIN to get execution plan
      const explainSQL = `EXPLAIN ${sql}`;
      const explainResult = await executeQuery(explainSQL, params);
      
      // Also get extended information if available
      let extendedInfo = null;
      try {
        const extendedSQL = `EXPLAIN EXTENDED ${sql}`;
        extendedInfo = await executeQuery(extendedSQL, params);
      } catch (extendedError) {
        // EXPLAIN EXTENDED might not be supported in all versions
        console.debug('EXPLAIN EXTENDED not supported:', extendedError.message);
      }

      return {
        basic: explainResult,
        extended: extendedInfo,
        summary: this.summarizeExecutionPlan(explainResult)
      };

    } catch (error) {
      throw new Error(`Failed to get execution plan: ${error.message}`);
    }
  }

  /**
   * Summarize execution plan into key metrics
   */
  summarizeExecutionPlan(explainResult) {
    if (!explainResult || explainResult.length === 0) {
      return { tables: 0, joins: 0, indexes: 0, estimatedRows: 0 };
    }

    const summary = {
      tables: explainResult.length,
      joins: 0,
      indexes: 0,
      estimatedRows: 0,
      keyUsage: [],
      warnings: []
    };

    for (const row of explainResult) {
      // Count joins
      if (row.select_type && row.select_type !== 'SIMPLE') {
        summary.joins++;
      }

      // Count index usage
      if (row.key && row.key !== null) {
        summary.indexes++;
        summary.keyUsage.push({
          table: row.table,
          key: row.key,
          keyLen: row.key_len,
          rows: row.rows
        });
      }

      // Sum estimated rows
      if (row.rows) {
        summary.estimatedRows += parseInt(row.rows) || 0;
      }

      // Detect potential issues
      if (row.type === 'ALL') {
        summary.warnings.push(`Full table scan on ${row.table}`);
      }

      if (row.Extra && row.Extra.includes('Using filesort')) {
        summary.warnings.push(`Filesort detected for ${row.table}`);
      }

      if (row.Extra && row.Extra.includes('Using temporary')) {
        summary.warnings.push(`Temporary table used for ${row.table}`);
      }
    }

    return summary;
  }

  /**
   * Generate performance recommendations based on execution plan
   */
  generateRecommendations(executionPlan, sql) {
    const recommendations = [];

    if (!executionPlan || !executionPlan.summary) {
      return recommendations;
    }

    const summary = executionPlan.summary;

    // Recommend indexes for full table scans
    if (summary.warnings.some(w => w.includes('Full table scan'))) {
      recommendations.push({
        type: 'INDEX_RECOMMENDATION',
        priority: 'high',
        description: 'Add indexes to avoid full table scans',
        impact: 'Can significantly improve query performance'
      });
    }

    // Recommend query optimization for filesort
    if (summary.warnings.some(w => w.includes('Filesort'))) {
      recommendations.push({
        type: 'SORTING_OPTIMIZATION',
        priority: 'medium',
        description: 'Consider adding composite index for ORDER BY clause',
        impact: 'Can eliminate expensive filesort operations'
      });
    }

    // Recommend optimization for temporary tables
    if (summary.warnings.some(w => w.includes('Temporary table'))) {
      recommendations.push({
        type: 'TEMPORARY_TABLE_OPTIMIZATION',
        priority: 'medium',
        description: 'Optimize GROUP BY or DISTINCT operations',
        impact: 'Can reduce memory usage and improve performance'
      });
    }

    // Recommend LIMIT for large result sets
    if (summary.estimatedRows > 1000 && !sql.toUpperCase().includes('LIMIT')) {
      recommendations.push({
        type: 'RESULT_SET_LIMITATION',
        priority: 'medium',
        description: 'Add LIMIT clause to control result set size',
        impact: 'Can reduce memory usage and network transfer'
      });
    }

    // Recommend join optimization for multiple tables
    if (summary.tables > 3) {
      recommendations.push({
        type: 'JOIN_OPTIMIZATION',
        priority: 'low',
        description: 'Consider breaking complex joins into smaller queries',
        impact: 'Can improve query maintainability and performance'
      });
    }

    return recommendations;
  }

  /**
   * Analyze performance characteristics
   */
  analyzePerformance(executionPlan, executionTime) {
    const performance = {
      isSlowQuery: false,
      complexityScore: 0,
      indexUsage: 'unknown',
      estimatedCost: 0,
      bottlenecks: []
    };

    if (executionTime) {
      performance.isSlowQuery = executionTime > this.options.slowQueryThreshold;
    }

    if (executionPlan && executionPlan.summary) {
      const summary = executionPlan.summary;
      
      // Determine index usage
      if (summary.indexes === summary.tables) {
        performance.indexUsage = 'optimal';
      } else if (summary.indexes > 0) {
        performance.indexUsage = 'partial';
      } else {
        performance.indexUsage = 'none';
      }

      // Estimate cost based on rows examined
      performance.estimatedCost = summary.estimatedRows;

      // Identify bottlenecks
      if (summary.estimatedRows > 10000) {
        performance.bottlenecks.push('Large result set');
      }

      if (summary.warnings.length > 0) {
        performance.bottlenecks.push('Inefficient operations');
      }

      if (summary.tables > 5) {
        performance.bottlenecks.push('Complex joins');
      }
    }

    return performance;
  }

  /**
   * Calculate query complexity score (0-100)
   */
  calculateComplexityScore(sql, executionPlan) {
    let score = 0;
    
    // Base complexity from SQL structure
    const joinCount = (sql.match(/JOIN/gi) || []).length;
    const subqueryCount = (sql.match(/\(/g) || []).length;
    const functionCount = (sql.match(/\w+\s*\(/g) || []).length;
    
    score += joinCount * 10;
    score += subqueryCount * 5;
    score += functionCount * 3;
    
    // Add complexity from execution plan
    if (executionPlan && executionPlan.summary) {
      score += executionPlan.summary.tables * 5;
      score += executionPlan.summary.warnings.length * 15;
      
      if (executionPlan.summary.estimatedRows > 1000) {
        score += 20;
      }
    }
    
    return Math.min(score, 100);
  }

  /**
   * Track slow queries for analysis
   */
  trackSlowQuery(analysis) {
    this.slowQueries.push({
      ...analysis,
      trackedAt: new Date().toISOString()
    });

    // Keep only recent slow queries
    if (this.slowQueries.length > 50) {
      this.slowQueries = this.slowQueries.slice(-50);
    }

    this.stats.slowQueries++;
    console.warn(`Slow query detected (${analysis.executionTime}ms):`, analysis.sql.substring(0, 100));
  }

  /**
   * Add analysis to history
   */
  addToHistory(analysis) {
    this.analysisHistory.push(analysis);

    // Keep history within limit
    if (this.analysisHistory.length > this.options.maxAnalysisHistory) {
      this.analysisHistory = this.analysisHistory.slice(-this.options.maxAnalysisHistory);
    }
  }

  /**
   * Update performance statistics
   */
  updateStats(analysis) {
    this.stats.totalQueries++;
    
    if (analysis.executionTime) {
      this.stats.totalExecutionTime += analysis.executionTime;
      this.stats.averageExecutionTime = this.stats.totalExecutionTime / this.stats.totalQueries;
    }
  }

  /**
   * Get query performance statistics
   */
  getStats() {
    const slowQueryRate = this.stats.totalQueries > 0 ? 
      (this.stats.slowQueries / this.stats.totalQueries * 100) : 0;
    
    return {
      ...this.stats,
      slowQueryRate: Math.round(slowQueryRate * 100) / 100,
      analysisHistorySize: this.analysisHistory.length,
      configuration: this.options
    };
  }

  /**
   * Get slow queries report
   */
  getSlowQueriesReport(limit = 10) {
    return {
      totalSlowQueries: this.slowQueries.length,
      threshold: this.options.slowQueryThreshold,
      queries: this.slowQueries
        .sort((a, b) => b.executionTime - a.executionTime)
        .slice(0, limit)
        .map(query => ({
          id: query.id,
          executionTime: query.executionTime,
          complexityScore: query.performance.complexityScore,
          sql: query.sql.substring(0, 200),
          recommendations: query.recommendations.length,
          timestamp: query.timestamp
        }))
    };
  }

  /**
   * Get performance trends over time
   */
  getPerformanceTrends(timeframe = '1h') {
    const now = new Date();
    const cutoff = new Date(now.getTime() - this.parseTimeframe(timeframe));
    
    const recentAnalyses = this.analysisHistory.filter(
      analysis => new Date(analysis.timestamp) > cutoff
    );

    if (recentAnalyses.length === 0) {
      return {
        timeframe,
        dataPoints: 0,
        averageExecutionTime: 0,
        slowQueryRate: 0,
        complexityTrend: 'stable'
      };
    }

    const totalExecutionTime = recentAnalyses
      .filter(a => a.executionTime)
      .reduce((sum, a) => sum + a.executionTime, 0);
    
    const averageExecutionTime = totalExecutionTime / recentAnalyses.length;
    
    const slowQueries = recentAnalyses.filter(a => 
      a.performance.isSlowQuery
    ).length;
    
    const slowQueryRate = (slowQueries / recentAnalyses.length) * 100;

    return {
      timeframe,
      dataPoints: recentAnalyses.length,
      averageExecutionTime: Math.round(averageExecutionTime * 100) / 100,
      slowQueryRate: Math.round(slowQueryRate * 100) / 100,
      complexityTrend: this.calculateComplexityTrend(recentAnalyses)
    };
  }

  /**
   * Calculate complexity trend
   */
  calculateComplexityTrend(analyses) {
    if (analyses.length < 2) return 'stable';
    
    const recent = analyses.slice(-10);
    const older = analyses.slice(-20, -10);
    
    if (older.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((sum, a) => sum + a.performance.complexityScore, 0) / recent.length;
    const olderAvg = older.reduce((sum, a) => sum + a.performance.complexityScore, 0) / older.length;
    
    const difference = recentAvg - olderAvg;
    
    if (difference > 5) return 'increasing';
    if (difference < -5) return 'decreasing';
    return 'stable';
  }

  /**
   * Parse timeframe string to milliseconds
   */
  parseTimeframe(timeframe) {
    const units = {
      's': 1000,
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000
    };
    
    const match = timeframe.match(/^(\d+)([smhd])$/);
    if (!match) return 60 * 60 * 1000; // Default 1 hour
    
    const [, value, unit] = match;
    return parseInt(value) * (units[unit] || units.h);
  }

  /**
   * Generate unique analysis ID
   */
  generateAnalysisId() {
    return `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Clear analysis history and reset stats
   */
  reset() {
    this.analysisHistory = [];
    this.slowQueries = [];
    this.stats = {
      totalQueries: 0,
      slowQueries: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    
    console.log('QueryAnalyzer reset completed');
  }

  /**
   * Export analysis data for external processing
   */
  exportAnalysisData() {
    return {
      metadata: {
        exportedAt: new Date().toISOString(),
        totalAnalyses: this.analysisHistory.length,
        slowQueries: this.slowQueries.length,
        configuration: this.options
      },
      statistics: this.getStats(),
      analysisHistory: this.analysisHistory,
      slowQueries: this.slowQueries
    };
  }
}

module.exports = QueryAnalyzer;
