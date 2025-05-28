/**
 * AutoIndexOptimizerUtils.js
 * Utility functions for AutoIndexOptimizer
 * Task 3.3: 자동 인덱스 최적화 엔진 - 유틸리티 모듈
 */

const { executeQuery } = require('../../db');

class AutoIndexOptimizerUtils {
  /**
   * Analyze query patterns from performance schema or slow query log
   */
  static async analyzeQueryPatterns() {
    try {
      // Get performance schema data if available
      const queryPatterns = await executeQuery(`
        SELECT 
          DIGEST_TEXT,
          COUNT_STAR as execution_count,
          AVG_TIMER_WAIT/1000000 as avg_duration_ms,
          SUM_ROWS_EXAMINED as total_rows_examined,
          SUM_ROWS_SENT as total_rows_sent,
          FIRST_SEEN,
          LAST_SEEN
        FROM performance_schema.events_statements_summary_by_digest 
        WHERE DIGEST_TEXT IS NOT NULL 
          AND COUNT_STAR > 10
          AND AVG_TIMER_WAIT/1000000 > 100
        ORDER BY COUNT_STAR DESC, AVG_TIMER_WAIT DESC
        LIMIT 50
      `);
      
      const patterns = {
        slowQueries: [],
        frequentQueries: [],
        tableAccess: new Map(),
        columnAccess: new Map()
      };
      
      for (const query of queryPatterns) {
        const analysis = this.analyzeQueryText(query.DIGEST_TEXT);
        
        const pattern = {
          query: query.DIGEST_TEXT,
          executionCount: query.execution_count,
          avgDuration: query.avg_duration_ms,
          rowsExamined: query.total_rows_examined,
          rowsSent: query.total_rows_sent,
          firstSeen: query.FIRST_SEEN,
          lastSeen: query.LAST_SEEN,
          analysis: analysis
        };
        
        if (query.avg_duration_ms > 1000) {
          patterns.slowQueries.push(pattern);
        }
        
        if (query.execution_count > 100) {
          patterns.frequentQueries.push(pattern);
        }
        
        // Track table and column access
        for (const table of analysis.tables) {
          patterns.tableAccess.set(table, (patterns.tableAccess.get(table) || 0) + query.execution_count);
        }
        
        for (const column of analysis.columns) {
          patterns.columnAccess.set(column, (patterns.columnAccess.get(column) || 0) + query.execution_count);
        }
      }
      
      return patterns;
      
    } catch (error) {
      console.log('Performance schema not available, using alternative analysis');
      return await this.analyzeQueryPatternsAlternative();
    }
  }

  /**
   * Alternative query pattern analysis when performance schema is not available
   */
  static async analyzeQueryPatternsAlternative() {
    const patterns = {
      slowQueries: [],
      frequentQueries: [],
      tableAccess: new Map(),
      columnAccess: new Map()
    };
    
    // Analyze based on table statistics and common patterns
    const tables = await executeQuery(`
      SELECT TABLE_NAME, TABLE_ROWS 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_ROWS DESC
    `);
    
    for (const table of tables) {
      patterns.tableAccess.set(table.TABLE_NAME, table.TABLE_ROWS || 0);
    }
    
    return patterns;
  }

  /**
   * Analyze query text to extract tables, columns, and operations
   */
  static analyzeQueryText(queryText) {
    const analysis = {
      tables: [],
      columns: [],
      operations: [],
      joins: [],
      whereConditions: [],
      orderBy: [],
      groupBy: []
    };
    
    if (!queryText) return analysis;
    
    const queryLower = queryText.toLowerCase();
    
    // Extract tables (simplified regex patterns)
    const fromMatch = queryLower.match(/from\s+`?(\w+)`?/g);
    if (fromMatch) {
      fromMatch.forEach(match => {
        const table = match.replace(/from\s+`?/, '').replace(/`?$/, '');
        if (!analysis.tables.includes(table)) {
          analysis.tables.push(table);
        }
      });
    }
    
    const joinMatch = queryLower.match(/join\s+`?(\w+)`?/g);
    if (joinMatch) {
      joinMatch.forEach(match => {
        const table = match.replace(/join\s+`?/, '').replace(/`?$/, '');
        if (!analysis.tables.includes(table)) {
          analysis.tables.push(table);
        }
        analysis.joins.push(table);
      });
    }
    
    // Extract columns (simplified - look for common patterns)
    const whereMatch = queryLower.match(/where\s+.*?(?=\s+(?:group|order|limit|$))/);
    if (whereMatch) {
      const whereClause = whereMatch[0];
      const columnMatches = whereClause.match(/`?(\w+)`?\s*[=<>!]/g);
      if (columnMatches) {
        columnMatches.forEach(match => {
          const column = match.replace(/`?/, '').replace(/`?\s*[=<>!].*/, '');
          if (!analysis.columns.includes(column) && column.length > 1) {
            analysis.columns.push(column);
            analysis.whereConditions.push(column);
          }
        });
      }
    }
    
    // Extract ORDER BY columns
    const orderMatch = queryLower.match(/order\s+by\s+(.*?)(?:\s+(?:limit|$))/);
    if (orderMatch) {
      const orderColumns = orderMatch[1].split(',').map(col => 
        col.trim().replace(/`/g, '').replace(/\s+(asc|desc)$/, '')
      );
      analysis.orderBy.push(...orderColumns);
      analysis.columns.push(...orderColumns.filter(col => !analysis.columns.includes(col)));
    }
    
    // Identify operations
    if (queryLower.includes('select')) analysis.operations.push('SELECT');
    if (queryLower.includes('insert')) analysis.operations.push('INSERT');
    if (queryLower.includes('update')) analysis.operations.push('UPDATE');
    if (queryLower.includes('delete')) analysis.operations.push('DELETE');
    
    return analysis;
  }

  /**
   * Analyze performance metrics
   */
  static async analyzePerformanceMetrics() {
    try {
      const metrics = {
        slowQueries: 0,
        avgQueryTime: 0,
        indexUsage: {},
        tableScans: 0,
        sortMergePass: 0
      };
      
      // Get global status variables
      const status = await executeQuery("SHOW GLOBAL STATUS LIKE '%slow%'");
      const slowQueryRow = status.find(row => row.Variable_name === 'Slow_queries');
      if (slowQueryRow) {
        metrics.slowQueries = parseInt(slowQueryRow.Value) || 0;
      }
      
      // Get table scan information
      const scanStatus = await executeQuery("SHOW GLOBAL STATUS LIKE '%table%'");
      const tableScanRow = scanStatus.find(row => row.Variable_name === 'Select_scan');
      if (tableScanRow) {
        metrics.tableScans = parseInt(tableScanRow.Value) || 0;
      }
      
      return metrics;
      
    } catch (error) {
      console.log('Error analyzing performance metrics:', error.message);
      return {
        slowQueries: 0,
        avgQueryTime: 0,
        indexUsage: {},
        tableScans: 0,
        sortMergePass: 0
      };
    }
  }

  /**
   * Generate intelligent recommendations based on analysis
   */
  static async generateIntelligentRecommendations(analysis) {
    const recommendations = [];
    
    // Recommendation 1: Indexes for slow queries
    for (const slowQuery of analysis.queries.slowQueries || []) {
      if (slowQuery.analysis.whereConditions.length > 0) {
        recommendations.push({
          type: 'create',
          priority: 'high',
          confidence: 90,
          table: slowQuery.analysis.tables[0],
          columns: slowQuery.analysis.whereConditions,
          indexName: `idx_${slowQuery.analysis.tables[0]}_${slowQuery.analysis.whereConditions.join('_')}`,
          impact: Math.min(slowQuery.avgDuration / 100, 50),
          sql: `CREATE INDEX idx_${slowQuery.analysis.tables[0]}_${slowQuery.analysis.whereConditions.join('_')} ON ${slowQuery.analysis.tables[0]} (${slowQuery.analysis.whereConditions.join(', ')})`,
          reasoning: `Slow query (${slowQuery.avgDuration.toFixed(2)}ms avg) with WHERE conditions on these columns`
        });
      }
    }
    
    // Recommendation 2: Indexes for frequent queries
    for (const frequentQuery of analysis.queries.frequentQueries || []) {
      if (frequentQuery.analysis.whereConditions.length > 0 && frequentQuery.avgDuration > 50) {
        recommendations.push({
          type: 'create',
          priority: 'medium',
          confidence: 75,
          table: frequentQuery.analysis.tables[0],
          columns: frequentQuery.analysis.whereConditions,
          indexName: `idx_${frequentQuery.analysis.tables[0]}_${frequentQuery.analysis.whereConditions.join('_')}`,
          impact: Math.min(frequentQuery.executionCount / 1000, 30),
          sql: `CREATE INDEX idx_${frequentQuery.analysis.tables[0]}_${frequentQuery.analysis.whereConditions.join('_')} ON ${frequentQuery.analysis.tables[0]} (${frequentQuery.analysis.whereConditions.join(', ')})`,
          reasoning: `Frequent query (${frequentQuery.executionCount} executions) could benefit from index`
        });
      }
    }
    
    // Recommendation 3: Covering indexes for SELECT queries
    for (const query of [...(analysis.queries.slowQueries || []), ...(analysis.queries.frequentQueries || [])]) {
      if (query.analysis.operations.includes('SELECT') && 
          query.analysis.whereConditions.length > 0 && 
          query.analysis.columns.length <= 5) {
        
        const allColumns = [...new Set([...query.analysis.whereConditions, ...query.analysis.orderBy])];
        if (allColumns.length >= 2 && allColumns.length <= 4) {
          recommendations.push({
            type: 'create',
            priority: 'medium',
            confidence: 70,
            table: query.analysis.tables[0],
            columns: allColumns,
            indexName: `idx_covering_${query.analysis.tables[0]}_${allColumns.join('_')}`,
            impact: 25,
            sql: `CREATE INDEX idx_covering_${query.analysis.tables[0]}_${allColumns.join('_')} ON ${query.analysis.tables[0]} (${allColumns.join(', ')})`,
            reasoning: 'Covering index to avoid table lookups for this query pattern'
          });
        }
      }
    }
    
    // Remove duplicates and sort by priority/confidence
    const uniqueRecommendations = this.removeDuplicateRecommendations(recommendations);
    return uniqueRecommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      if (priorityOrder[b.priority] !== priorityOrder[a.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return b.confidence - a.confidence;
    });
  }

  /**
   * Remove duplicate recommendations
   */
  static removeDuplicateRecommendations(recommendations) {
    const seen = new Set();
    return recommendations.filter(rec => {
      const key = `${rec.table}_${rec.columns.sort().join('_')}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Detect schema changes between snapshots
   */
  static detectSchemaChanges(oldSchema, newSchema) {
    const changes = {
      tablesAdded: [],
      tablesRemoved: [],
      tablesModified: [],
      columnsAdded: [],
      columnsRemoved: [],
      columnsModified: []
    };
    
    const oldTables = new Set(Object.keys(oldSchema.tables));
    const newTables = new Set(Object.keys(newSchema.tables));
    
    // Find added/removed tables
    for (const table of newTables) {
      if (!oldTables.has(table)) {
        changes.tablesAdded.push(table);
      }
    }
    
    for (const table of oldTables) {
      if (!newTables.has(table)) {
        changes.tablesRemoved.push(table);
      }
    }
    
    // Find modified tables/columns
    for (const table of newTables) {
      if (oldTables.has(table)) {
        const oldColumns = oldSchema.tables[table].columns.map(c => c.name);
        const newColumns = newSchema.tables[table].columns.map(c => c.name);
        
        const oldColumnSet = new Set(oldColumns);
        const newColumnSet = new Set(newColumns);
        
        for (const col of newColumns) {
          if (!oldColumnSet.has(col)) {
            changes.columnsAdded.push({ table, column: col });
          }
        }
        
        for (const col of oldColumns) {
          if (!newColumnSet.has(col)) {
            changes.columnsRemoved.push({ table, column: col });
          }
        }
      }
    }
    
    return changes;
  }

  /**
   * Analyze composite index opportunity
   */
  static async analyzeCompositeOpportunity(tableName, singleColumnIndexes) {
    const opportunity = {
      viable: false,
      columns: [],
      indexName: '',
      indexesToDrop: [],
      impact: 0,
      sql: '',
      reasoning: ''
    };
    
    // Simple heuristic: if we have 2-3 single column indexes that might be used together
    if (singleColumnIndexes.length >= 2 && singleColumnIndexes.length <= 3) {
      const columns = singleColumnIndexes.map(idx => idx.columns[0].name);
      
      // Check if these columns are used together in queries (simplified check)
      const combinedUsage = singleColumnIndexes.reduce((sum, idx) => sum + idx.usage.examined, 0);
      
      if (combinedUsage > 50) {
        opportunity.viable = true;
        opportunity.columns = columns;
        opportunity.indexName = `idx_composite_${tableName}_${columns.join('_')}`;
        opportunity.indexesToDrop = singleColumnIndexes.map(idx => idx.name);
        opportunity.impact = Math.min(combinedUsage / 100, 40);
        opportunity.sql = `CREATE INDEX ${opportunity.indexName} ON ${tableName} (${columns.join(', ')})`;
        opportunity.reasoning = `Combining ${singleColumnIndexes.length} single-column indexes into composite index`;
      }
    }
    
    return opportunity;
  }

  /**
   * Calculate plan priority based on actions
   */
  static calculatePlanPriority(actions) {
    const highPriorityCount = actions.filter(a => a.priority === 'high').length;
    const totalImpact = actions.reduce((sum, a) => sum + (a.estimatedImpact || 0), 0);
    
    if (highPriorityCount > 0 || totalImpact > 100) {
      return 'high';
    } else if (actions.length > 3 || totalImpact > 50) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Estimate performance impact of optimization plan
   */
  static estimatePerformanceImpact(actions) {
    return actions.reduce((total, action) => {
      switch (action.type) {
        case 'create_index':
          return total + (action.estimatedImpact || 20);
        case 'drop_index':
          return total + (action.estimatedImpact || 5);
        case 'optimize_composite':
          return total + (action.estimatedImpact || 15);
        default:
          return total;
      }
    }, 0);
  }

  /**
   * Assess optimization risks
   */
  static assessOptimizationRisks(actions) {
    const risks = [];
    
    const createCount = actions.filter(a => a.type === 'create_index').length;
    const dropCount = actions.filter(a => a.type === 'drop_index').length;
    
    if (createCount > 5) {
      risks.push({
        type: 'performance',
        level: 'medium',
        description: `Creating ${createCount} indexes may temporarily impact write performance`
      });
    }
    
    if (dropCount > 3) {
      risks.push({
        type: 'functionality',
        level: 'low',
        description: `Dropping ${dropCount} indexes - ensure they are truly unused`
      });
    }
    
    const largeTableActions = actions.filter(a => 
      a.table && ['players', 'game_scores', 'money_flows'].includes(a.table)
    );
    
    if (largeTableActions.length > 0) {
      risks.push({
        type: 'performance',
        level: 'high',
        description: 'Operations on large tables may take considerable time'
      });
    }
    
    return risks;
  }

  /**
   * Create backup of index structure before optimization
   */
  static async createIndexBackup(action) {
    try {
      const backupData = {
        timestamp: new Date(),
        action: action,
        table: action.table,
        indexName: action.indexName
      };
      
      if (action.type === 'drop_index') {
        // Get the index definition before dropping
        const indexInfo = await executeQuery(`
          SHOW CREATE TABLE ${action.table}
        `);
        
        backupData.indexDefinition = indexInfo[0]['Create Table'];
      }
      
      // In a real implementation, you might store this in a backup table
      console.log(`Backup created for ${action.type} on ${action.table}.${action.indexName}`);
      
      return backupData;
      
    } catch (error) {
      console.log(`Warning: Could not create backup for ${action.id}:`, error.message);
      return null;
    }
  }

  /**
   * Generate optimization report
   */
  static generateOptimizationReport(analysis, plan, execution = null) {
    const report = {
      timestamp: new Date(),
      summary: {
        tablesAnalyzed: Object.keys(analysis.database.tables).length,
        indexesAnalyzed: analysis.indexes.totalIndexes,
        recommendationsGenerated: analysis.recommendations.length,
        actionsPlanned: plan.actions.length,
        actionsExecuted: execution ? execution.successful.length : 0,
        actionsFailed: execution ? execution.failed.length : 0
      },
      analysis: analysis,
      plan: plan,
      execution: execution,
      recommendations: {
        immediate: plan.actions.filter(a => a.priority === 'high'),
        suggested: plan.actions.filter(a => a.priority === 'medium'),
        optional: plan.actions.filter(a => a.priority === 'low')
      },
      estimatedImpact: plan.estimatedImpact,
      risks: plan.risks
    };
    
    return report;
  }
}

module.exports = AutoIndexOptimizerUtils;
