/**
 * LearningSystem.js
 * Machine learning and statistics module
 * 분할된 모듈: AutoIndexOptimizer.js의 학습 시스템 부분
 * 
 * 포함 기능:
 * - 학습 데이터 업데이트 및 관리
 * - 성능 기준선 추적
 * - 인덱스 효율성 학습
 * - 최적화 히스토리 관리
 * - 통계 및 보고서 생성
 */

class LearningSystem {
  constructor(options = {}) {
    this.options = options;
    
    // Learning data storage
    this.optimizationHistory = [];
    this.performanceBaseline = new Map();
    this.indexEffectiveness = new Map();
    this.queryPatterns = new Map();
    this.indexUsageStats = new Map();
  }

  /**
   * Phase 4: Update learning data
   */
  async updateLearningData(analysis, plan, executionResult) {
    console.log('Updating learning data...');
    
    try {
      const learningData = {
        timestamp: new Date(),
        analysis: {
          tablesAnalyzed: Object.keys(analysis.schema?.tables || {}).length,
          indexesAnalyzed: analysis.indexes?.all?.length || 0,
          recommendationsGenerated: analysis.recommendations?.length || 0,
          duplicatesFound: analysis.indexes?.duplicates?.length || 0,
          unusedFound: analysis.indexes?.unused?.length || 0
        },
        plan: {
          actionsPlanned: plan.actions?.length || 0,
          estimatedImpact: plan.estimatedImpact || 0,
          priority: plan.priority || 'low',
          riskLevel: plan.riskAssessment?.level || 'low'
        },
        execution: executionResult ? {
          actionsExecuted: executionResult.actionsExecuted || 0,
          actionsSuccessful: executionResult.actionsSuccessful || 0,
          actionsFailed: executionResult.actionsFailed || 0,
          executionTime: executionResult.executionTime || 0,
          performanceImprovement: executionResult.performanceImprovement || 0
        } : null
      };
      
      // Update performance baseline
      if (analysis.schema && analysis.schema.tables) {
        for (const [table, tableInfo] of Object.entries(analysis.schema.tables)) {
          this.performanceBaseline.set(table, {
            rows: tableInfo.rows || 0,
            dataSize: tableInfo.dataSize || 0,
            indexSize: tableInfo.indexSize || 0,
            timestamp: new Date()
          });
        }
      }
      
      // Update index effectiveness tracking
      if (analysis.indexes && analysis.indexes.byTable) {
        for (const [tableName, indexes] of Object.entries(analysis.indexes.byTable)) {
          for (const index of indexes) {
            this.indexEffectiveness.set(`${tableName}.${index.name}`, {
              effectiveness: index.effectiveness || 0,
              usage: index.usage || { examined: 0, read: 0 },
              size: index.size || 0,
              timestamp: new Date()
            });
          }
        }
      }
      
      // Update query patterns if available
      if (analysis.queries) {
        this.updateQueryPatterns(analysis.queries);
      }
      
      // Store learning data for future reference
      this.optimizationHistory.push(learningData);
      
      // Keep only last 50 optimization records to manage memory
      if (this.optimizationHistory.length > 50) {
        this.optimizationHistory = this.optimizationHistory.slice(-50);
      }
      
      console.log('Learning data updated successfully');
      
    } catch (error) {
      console.log('Error updating learning data:', error.message);
    }
  }

  /**
   * Update query patterns for machine learning
   */
  updateQueryPatterns(queries) {
    try {
      if (queries.mostFrequent && Array.isArray(queries.mostFrequent)) {
        for (const query of queries.mostFrequent) {
          const pattern = this.extractQueryPattern(query);
          if (pattern) {
            const existing = this.queryPatterns.get(pattern.signature) || {
              count: 0,
              totalTime: 0,
              avgTime: 0,
              tables: new Set(),
              columns: new Set()
            };
            
            existing.count++;
            existing.totalTime += (query.avgTime || 0);
            existing.avgTime = existing.totalTime / existing.count;
            
            if (pattern.tables) {
              pattern.tables.forEach(table => existing.tables.add(table));
            }
            if (pattern.columns) {
              pattern.columns.forEach(column => existing.columns.add(column));
            }
            
            this.queryPatterns.set(pattern.signature, existing);
          }
        }
      }
    } catch (error) {
      console.log('Error updating query patterns:', error.message);
    }
  }

  /**
   * Extract pattern from query for learning
   */
  extractQueryPattern(query) {
    try {
      // Simple pattern extraction (would be more sophisticated in practice)
      const queryText = query.text || query.sql || '';
      const signature = queryText
        .replace(/\d+/g, '?')  // Replace numbers with placeholders
        .replace(/'\w+'/g, '?')  // Replace string literals
        .toLowerCase();
      
      return {
        signature: signature,
        tables: this.extractTablesFromQuery(queryText),
        columns: this.extractColumnsFromQuery(queryText),
        type: this.extractQueryType(queryText)
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract tables from query text
   */
  extractTablesFromQuery(queryText) {
    const tables = [];
    const fromMatch = queryText.match(/FROM\s+(\w+)/gi);
    const joinMatch = queryText.match(/JOIN\s+(\w+)/gi);
    
    if (fromMatch) {
      fromMatch.forEach(match => {
        const table = match.replace(/FROM\s+/i, '').trim();
        tables.push(table);
      });
    }
    
    if (joinMatch) {
      joinMatch.forEach(match => {
        const table = match.replace(/JOIN\s+/i, '').trim();
        tables.push(table);
      });
    }
    
    return tables;
  }

  /**
   * Extract columns from query text
   */
  extractColumnsFromQuery(queryText) {
    const columns = [];
    // Simple WHERE clause column extraction
    const whereMatch = queryText.match(/WHERE\s+[\w.]+/gi);
    
    if (whereMatch) {
      whereMatch.forEach(match => {
        const column = match.replace(/WHERE\s+/i, '').split(/\s+/)[0];
        if (column && !['AND', 'OR', 'NOT'].includes(column.toUpperCase())) {
          columns.push(column);
        }
      });
    }
    
    return columns;
  }

  /**
   * Extract query type
   */
  extractQueryType(queryText) {
    const text = queryText.toUpperCase().trim();
    if (text.startsWith('SELECT')) return 'SELECT';
    if (text.startsWith('INSERT')) return 'INSERT';
    if (text.startsWith('UPDATE')) return 'UPDATE';
    if (text.startsWith('DELETE')) return 'DELETE';
    return 'OTHER';
  }

  /**
   * Learn from optimization results
   */
  learnFromResults(executionResult) {
    if (!executionResult) return;
    
    try {
      // Analyze successful optimizations
      for (const success of executionResult.successful) {
        const action = success.action;
        const key = `${action.table}.${action.indexName || action.type}`;
        
        // Track success patterns
        const stats = this.indexUsageStats.get(key) || {
          successCount: 0,
          failureCount: 0,
          totalExecutions: 0,
          avgExecutionTime: 0,
          lastSuccess: null
        };
        
        stats.successCount++;
        stats.totalExecutions++;
        stats.lastSuccess = new Date();
        
        this.indexUsageStats.set(key, stats);
      }
      
      // Analyze failed optimizations
      for (const failure of executionResult.failed) {
        const action = failure.action;
        const key = `${action.table}.${action.indexName || action.type}`;
        
        const stats = this.indexUsageStats.get(key) || {
          successCount: 0,
          failureCount: 0,
          totalExecutions: 0,
          avgExecutionTime: 0,
          lastFailure: null,
          failureReasons: []
        };
        
        stats.failureCount++;
        stats.totalExecutions++;
        stats.lastFailure = new Date();
        stats.failureReasons = stats.failureReasons || [];
        stats.failureReasons.push(failure.error);
        
        this.indexUsageStats.set(key, stats);
      }
      
      console.log('Learning from results completed');
      
    } catch (error) {
      console.log('Error learning from results:', error.message);
    }
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends() {
    const trends = {
      optimization: {
        frequency: this.calculateOptimizationFrequency(),
        successRate: this.calculateSuccessRate(),
        avgImpact: this.calculateAverageImpact()
      },
      indexes: {
        creation: this.getIndexCreationTrends(),
        deletion: this.getIndexDeletionTrends(),
        effectiveness: this.getIndexEffectivenessTrends()
      },
      tables: {
        growth: this.getTableGrowthTrends(),
        performance: this.getTablePerformanceTrends()
      }
    };
    
    return trends;
  }

  /**
   * Calculate optimization frequency
   */
  calculateOptimizationFrequency() {
    if (this.optimizationHistory.length < 2) return 0;
    
    const timestamps = this.optimizationHistory.map(opt => opt.timestamp.getTime());
    const intervals = [];
    
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }
    
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    return Math.round(avgInterval / (1000 * 60 * 60)); // Hours
  }

  /**
   * Calculate success rate
   */
  calculateSuccessRate() {
    const recentHistory = this.optimizationHistory.slice(-10); // Last 10 optimizations
    
    if (recentHistory.length === 0) return 0;
    
    let totalActions = 0;
    let successfulActions = 0;
    
    for (const history of recentHistory) {
      if (history.execution) {
        totalActions += history.execution.actionsExecuted || 0;
        successfulActions += history.execution.actionsSuccessful || 0;
      }
    }
    
    return totalActions > 0 ? Math.round((successfulActions / totalActions) * 100) : 0;
  }

  /**
   * Calculate average impact
   */
  calculateAverageImpact() {
    const recentHistory = this.optimizationHistory.slice(-10);
    
    if (recentHistory.length === 0) return 0;
    
    const impacts = recentHistory
      .filter(h => h.execution && h.execution.performanceImprovement)
      .map(h => h.execution.performanceImprovement);
    
    return impacts.length > 0 ? 
      Math.round(impacts.reduce((sum, impact) => sum + impact, 0) / impacts.length) : 0;
  }

  /**
   * Get index creation trends
   */
  getIndexCreationTrends() {
    const creations = [];
    
    for (const history of this.optimizationHistory) {
      if (history.execution && history.execution.actionsSuccessful > 0) {
        creations.push({
          timestamp: history.timestamp,
          count: history.execution.actionsSuccessful
        });
      }
    }
    
    return creations;
  }

  /**
   * Get index deletion trends
   */
  getIndexDeletionTrends() {
    // Similar implementation to creation trends but for deletions
    return [];
  }

  /**
   * Get index effectiveness trends
   */
  getIndexEffectivenessTrends() {
    const trends = {};
    
    for (const [key, data] of this.indexEffectiveness) {
      trends[key] = {
        effectiveness: data.effectiveness,
        usage: data.usage,
        timestamp: data.timestamp
      };
    }
    
    return trends;
  }

  /**
   * Get table growth trends
   */
  getTableGrowthTrends() {
    const trends = {};
    
    for (const [table, baseline] of this.performanceBaseline) {
      trends[table] = {
        rows: baseline.rows,
        dataSize: baseline.dataSize,
        indexSize: baseline.indexSize,
        timestamp: baseline.timestamp
      };
    }
    
    return trends;
  }

  /**
   * Get table performance trends
   */
  getTablePerformanceTrends() {
    // Would analyze query performance over time for each table
    return {};
  }

  /**
   * Generate learning insights
   */
  generateLearningInsights() {
    const insights = {
      recommendations: [],
      patterns: [],
      warnings: []
    };
    
    // Analyze optimization patterns
    const trends = this.getPerformanceTrends();
    
    if (trends.optimization.successRate < 70) {
      insights.warnings.push('Low optimization success rate detected. Consider reviewing optimization strategies.');
    }
    
    if (trends.optimization.frequency > 24) { // More than daily
      insights.warnings.push('High optimization frequency may indicate underlying performance issues.');
    }
    
    // Analyze index effectiveness
    let lowEffectivenessCount = 0;
    for (const [key, data] of this.indexEffectiveness) {
      if (data.effectiveness < 30) {
        lowEffectivenessCount++;
      }
    }
    
    if (lowEffectivenessCount > 5) {
      insights.recommendations.push('Multiple low-effectiveness indexes detected. Consider reviewing index strategy.');
    }
    
    // Analyze query patterns
    const complexQueries = Array.from(this.queryPatterns.values())
      .filter(pattern => pattern.avgTime > this.options.performanceThreshold)
      .length;
    
    if (complexQueries > 10) {
      insights.recommendations.push('Many slow queries detected. Consider query optimization in addition to indexing.');
    }
    
    return insights;
  }

  /**
   * Reset learning data
   */
  resetLearningData() {
    this.optimizationHistory = [];
    this.performanceBaseline.clear();
    this.indexEffectiveness.clear();
    this.queryPatterns.clear();
    this.indexUsageStats.clear();
    
    console.log('Learning data reset successfully');
  }

  /**
   * Export learning data for backup
   */
  exportLearningData() {
    return {
      timestamp: new Date(),
      optimizationHistory: this.optimizationHistory,
      performanceBaseline: Array.from(this.performanceBaseline.entries()),
      indexEffectiveness: Array.from(this.indexEffectiveness.entries()),
      queryPatterns: Array.from(this.queryPatterns.entries()),
      indexUsageStats: Array.from(this.indexUsageStats.entries())
    };
  }

  /**
   * Import learning data from backup
   */
  importLearningData(data) {
    try {
      this.optimizationHistory = data.optimizationHistory || [];
      this.performanceBaseline = new Map(data.performanceBaseline || []);
      this.indexEffectiveness = new Map(data.indexEffectiveness || []);
      this.queryPatterns = new Map(data.queryPatterns || []);
      this.indexUsageStats = new Map(data.indexUsageStats || []);
      
      console.log('Learning data imported successfully');
    } catch (error) {
      console.log('Error importing learning data:', error.message);
    }
  }
}

module.exports = LearningSystem;
