/**
 * IndexRecommendations.js
 * Smart index recommendations based on query patterns and usage analysis
 * Task 1.5: Query Optimization and Caching
 */

const { executeQuery } = require('../../db');

class IndexRecommendations {
  constructor(options = {}) {
    this.options = {
      analysisThreshold: options.analysisThreshold || 10, // Minimum queries to analyze
      confidenceThreshold: options.confidenceThreshold || 70, // Minimum confidence %
      maxRecommendations: options.maxRecommendations || 20,
      trackingPeriod: options.trackingPeriod || 24 * 60 * 60 * 1000 // 24 hours
    };
    
    this.queryPatterns = new Map();
    this.existingIndexes = new Map();
    this.recommendations = [];
    
    // Statistics
    this.stats = {
      queriesAnalyzed: 0,
      patternsIdentified: 0,
      recommendationsGenerated: 0,
      lastAnalysis: null
    };
    
    console.log('IndexRecommendations initialized with options:', this.options);
  }

  /**
   * Analyze query and track patterns for index recommendations
   */
  analyzeQuery(sql, params = [], executionTime = null, executionPlan = null) {
    try {
      this.stats.queriesAnalyzed++;
      
      // Extract patterns from query
      const patterns = this.extractQueryPatterns(sql, params);
      
      // Track patterns with frequency and performance data
      for (const pattern of patterns) {
        this.trackPattern(pattern, executionTime, executionPlan);
      }
      
      // Update recommendations if we have enough data
      if (this.stats.queriesAnalyzed % this.options.analysisThreshold === 0) {
        this.generateRecommendations();
      }
      
      return {
        success: true,
        patternsFound: patterns.length,
        totalPatterns: this.queryPatterns.size
      };
      
    } catch (error) {
      console.error('Query pattern analysis error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract indexable patterns from SQL query
   */
  extractQueryPatterns(sql, params = []) {
    const patterns = [];
    const normalizedSQL = sql.toLowerCase().trim();
    
    // Extract table names
    const tables = this.extractTables(normalizedSQL);
    
    // Extract WHERE clause patterns
    const wherePatterns = this.extractWherePatterns(normalizedSQL, tables);
    patterns.push(...wherePatterns);
    
    // Extract JOIN patterns
    const joinPatterns = this.extractJoinPatterns(normalizedSQL, tables);
    patterns.push(...joinPatterns);
    
    // Extract ORDER BY patterns
    const orderByPatterns = this.extractOrderByPatterns(normalizedSQL, tables);
    patterns.push(...orderByPatterns);
    
    // Extract GROUP BY patterns
    const groupByPatterns = this.extractGroupByPatterns(normalizedSQL, tables);
    patterns.push(...groupByPatterns);
    
    return patterns;
  }

  /**
   * Extract WHERE clause patterns for indexing
   */
  extractWherePatterns(sql, tables) {
    const patterns = [];
    
    // Find WHERE clause
    const whereMatch = sql.match(/where\s+(.+?)(?:\s+group\s+by|\s+order\s+by|\s+limit|$)/i);
    if (!whereMatch) return patterns;
    
    const whereClause = whereMatch[1];
    
    // Extract individual conditions
    const conditions = this.parseWhereConditions(whereClause);
    
    for (const condition of conditions) {
      if (condition.column && condition.table) {
        patterns.push({
          type: 'WHERE',
          table: condition.table,
          columns: [condition.column],
          operator: condition.operator,
          selectivity: this.estimateSelectivity(condition.operator),
          priority: this.calculateWherePriority(condition)
        });
      }
    }
    
    // Look for composite patterns (multiple columns in WHERE)
    const compositePatterns = this.findCompositeWherePatterns(conditions);
    patterns.push(...compositePatterns);
    
    return patterns;
  }

  /**
   * Extract JOIN patterns for indexing
   */
  extractJoinPatterns(sql, tables) {
    const patterns = [];
    
    // Find JOIN clauses
    const joinRegex = /(left\s+join|right\s+join|inner\s+join|join)\s+(\w+)(?:\s+as\s+(\w+))?\s+on\s+([^join|where|group|order|limit]+)/gi;
    
    let match;
    while ((match = joinRegex.exec(sql)) !== null) {
      const joinTable = match[2];
      const joinAlias = match[3] || joinTable;
      const joinCondition = match[4].trim();
      
      // Parse join condition to extract column relationships
      const joinColumns = this.parseJoinCondition(joinCondition, tables, joinTable);
      
      if (joinColumns.length > 0) {
        for (const joinCol of joinColumns) {
          patterns.push({
            type: 'JOIN',
            table: joinCol.table,
            columns: [joinCol.column],
            joinedTable: joinCol.joinedTable,
            joinedColumn: joinCol.joinedColumn,
            priority: this.calculateJoinPriority(joinCol)
          });
        }
      }
    }
    
    return patterns;
  }

  /**
   * Extract ORDER BY patterns for indexing
   */
  extractOrderByPatterns(sql, tables) {
    const patterns = [];
    
    const orderByMatch = sql.match(/order\s+by\s+([^limit|$]+)/i);
    if (!orderByMatch) return patterns;
    
    const orderByClause = orderByMatch[1].trim();
    const orderColumns = this.parseOrderByColumns(orderByClause, tables);
    
    if (orderColumns.length > 0) {
      // Group by table for composite indexes
      const tableGroups = new Map();
      
      for (const col of orderColumns) {
        if (!tableGroups.has(col.table)) {
          tableGroups.set(col.table, []);
        }
        tableGroups.get(col.table).push(col.column);
      }
      
      for (const [table, columns] of tableGroups) {
        patterns.push({
          type: 'ORDER_BY',
          table,
          columns,
          priority: this.calculateOrderByPriority(columns.length)
        });
      }
    }
    
    return patterns;
  }

  /**
   * Extract GROUP BY patterns for indexing
   */
  extractGroupByPatterns(sql, tables) {
    const patterns = [];
    
    const groupByMatch = sql.match(/group\s+by\s+([^order|limit|$]+)/i);
    if (!groupByMatch) return patterns;
    
    const groupByClause = groupByMatch[1].trim();
    const groupColumns = this.parseGroupByColumns(groupByClause, tables);
    
    if (groupColumns.length > 0) {
      // Group by table for composite indexes
      const tableGroups = new Map();
      
      for (const col of groupColumns) {
        if (!tableGroups.has(col.table)) {
          tableGroups.set(col.table, []);
        }
        tableGroups.get(col.table).push(col.column);
      }
      
      for (const [table, columns] of tableGroups) {
        patterns.push({
          type: 'GROUP_BY',
          table,
          columns,
          priority: this.calculateGroupByPriority(columns.length)
        });
      }
    }
    
    return patterns;
  }

  /**
   * Track pattern usage and performance
   */
  trackPattern(pattern, executionTime, executionPlan) {
    const key = this.generatePatternKey(pattern);
    
    if (!this.queryPatterns.has(key)) {
      this.queryPatterns.set(key, {
        pattern,
        frequency: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
        firstSeen: new Date(),
        lastSeen: new Date(),
        performanceImpact: 'unknown'
      });
      this.stats.patternsIdentified++;
    }
    
    const tracked = this.queryPatterns.get(key);
    tracked.frequency++;
    tracked.lastSeen = new Date();
    
    if (executionTime) {
      tracked.totalExecutionTime += executionTime;
      tracked.averageExecutionTime = tracked.totalExecutionTime / tracked.frequency;
      tracked.performanceImpact = this.calculatePerformanceImpact(tracked.averageExecutionTime);
    }
    
    // Update with execution plan insights
    if (executionPlan && executionPlan.summary) {
      tracked.hasFullTableScan = executionPlan.summary.warnings.some(w => 
        w.includes('Full table scan')
      );
      tracked.hasFilesort = executionPlan.summary.warnings.some(w => 
        w.includes('Filesort')
      );
    }
  }

  /**
   * Generate index recommendations based on tracked patterns
   */
  async generateRecommendations() {
    try {
      this.stats.lastAnalysis = new Date();
      
      // Get current indexes
      await this.loadExistingIndexes();
      
      // Clear old recommendations
      this.recommendations = [];
      
      // Analyze patterns and generate recommendations
      for (const [key, data] of this.queryPatterns) {
        const recommendation = this.evaluatePattern(data);
        if (recommendation) {
          this.recommendations.push(recommendation);
        }
      }
      
      // Sort by priority and confidence
      this.recommendations.sort((a, b) => {
        if (a.priority !== b.priority) {
          return this.getPriorityScore(b.priority) - this.getPriorityScore(a.priority);
        }
        return b.confidence - a.confidence;
      });
      
      // Limit recommendations
      this.recommendations = this.recommendations.slice(0, this.options.maxRecommendations);
      
      this.stats.recommendationsGenerated = this.recommendations.length;
      
      console.log(`Generated ${this.recommendations.length} index recommendations`);
      
      return {
        success: true,
        recommendationsCount: this.recommendations.length,
        patternsAnalyzed: this.queryPatterns.size
      };
      
    } catch (error) {
      console.error('Failed to generate recommendations:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Evaluate pattern and create recommendation
   */
  evaluatePattern(data) {
    const { pattern, frequency, averageExecutionTime, hasFullTableScan, hasFilesort } = data;
    
    // Skip if frequency is too low
    if (frequency < 3) return null;
    
    // Check if index already exists
    const indexKey = `${pattern.table}.${pattern.columns.join('_')}`;
    if (this.existingIndexes.has(indexKey)) return null;
    
    // Calculate confidence score
    const confidence = this.calculateConfidence(data);
    if (confidence < this.options.confidenceThreshold) return null;
    
    // Generate index recommendation
    const recommendation = {
      id: this.generateRecommendationId(),
      table: pattern.table,
      columns: pattern.columns,
      type: this.determineIndexType(pattern),
      priority: pattern.priority || 'medium',
      confidence,
      reasoning: this.generateReasoning(data),
      estimatedImpact: this.estimateImpact(data),
      sqlExample: this.generateIndexSQL(pattern.table, pattern.columns, pattern.type),
      metadata: {
        frequency,
        averageExecutionTime,
        patternType: pattern.type,
        hasPerformanceIssues: hasFullTableScan || hasFilesort,
        createdAt: new Date().toISOString()
      }
    };
    
    return recommendation;
  }

  /**
   * Load existing indexes from database
   */
  async loadExistingIndexes() {
    try {
      const indexQuery = `
        SELECT 
          TABLE_NAME,
          INDEX_NAME,
          COLUMN_NAME,
          SEQ_IN_INDEX
        FROM information_schema.STATISTICS 
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
      `;
      
      const indexes = await executeQuery(indexQuery);
      this.existingIndexes.clear();
      
      // Group indexes by table and index name
      const indexGroups = new Map();
      
      for (const index of indexes) {
        const key = `${index.TABLE_NAME}.${index.INDEX_NAME}`;
        if (!indexGroups.has(key)) {
          indexGroups.set(key, []);
        }
        indexGroups.get(key).push(index.COLUMN_NAME);
      }
      
      // Store as table.columns format for quick lookup
      for (const [key, columns] of indexGroups) {
        const [table, indexName] = key.split('.');
        const indexKey = `${table}.${columns.join('_')}`;
        this.existingIndexes.set(indexKey, {
          table,
          indexName,
          columns
        });
      }
      
      console.log(`Loaded ${this.existingIndexes.size} existing indexes`);
      
    } catch (error) {
      console.warn('Failed to load existing indexes:', error.message);
    }
  }

  /**
   * Calculate confidence score for recommendation
   */
  calculateConfidence(data) {
    const { frequency, averageExecutionTime, hasFullTableScan, hasFilesort } = data;
    
    let confidence = 50; // Base confidence
    
    // Frequency bonus
    if (frequency >= 10) confidence += 20;
    else if (frequency >= 5) confidence += 10;
    
    // Performance issues bonus
    if (hasFullTableScan) confidence += 25;
    if (hasFilesort) confidence += 15;
    
    // Execution time bonus
    if (averageExecutionTime > 1000) confidence += 20; // > 1 second
    else if (averageExecutionTime > 500) confidence += 10; // > 0.5 second
    
    return Math.min(confidence, 100);
  }

  /**
   * Generate reasoning for recommendation
   */
  generateReasoning(data) {
    const reasons = [];
    const { frequency, averageExecutionTime, hasFullTableScan, hasFilesort, pattern } = data;
    
    reasons.push(`Query pattern appears ${frequency} times`);
    
    if (averageExecutionTime > 1000) {
      reasons.push(`Average execution time is ${averageExecutionTime}ms (slow)`);
    }
    
    if (hasFullTableScan) {
      reasons.push('Queries are performing full table scans');
    }
    
    if (hasFilesort) {
      reasons.push('Queries require filesort operations');
    }
    
    if (pattern.type === 'JOIN') {
      reasons.push('Index will optimize JOIN operations');
    }
    
    if (pattern.type === 'ORDER_BY') {
      reasons.push('Index will eliminate sorting overhead');
    }
    
    return reasons.join('. ') + '.';
  }

  /**
   * Estimate performance impact
   */
  estimateImpact(data) {
    const { frequency, averageExecutionTime, hasFullTableScan } = data;
    
    let impact = 'low';
    
    if (hasFullTableScan && frequency >= 10) {
      impact = 'high';
    } else if (averageExecutionTime > 1000 && frequency >= 5) {
      impact = 'high';
    } else if (frequency >= 10 || averageExecutionTime > 500) {
      impact = 'medium';
    }
    
    return impact;
  }

  /**
   * Generate SQL for creating index
   */
  generateIndexSQL(table, columns, indexType) {
    const indexName = `idx_${table}_${columns.join('_')}`;
    const columnList = columns.join(', ');
    
    let sql = `CREATE INDEX ${indexName} ON ${table} (${columnList})`;
    
    if (indexType === 'UNIQUE') {
      sql = `CREATE UNIQUE INDEX ${indexName} ON ${table} (${columnList})`;
    }
    
    return sql;
  }

  /**
   * Get current recommendations
   */
  getRecommendations(options = {}) {
    const {
      minConfidence = 0,
      maxResults = this.options.maxRecommendations,
      priorityFilter = null,
      tableFilter = null
    } = options;
    
    let filtered = this.recommendations.filter(rec => 
      rec.confidence >= minConfidence
    );
    
    if (priorityFilter) {
      filtered = filtered.filter(rec => rec.priority === priorityFilter);
    }
    
    if (tableFilter) {
      filtered = filtered.filter(rec => rec.table === tableFilter);
    }
    
    return {
      recommendations: filtered.slice(0, maxResults),
      total: filtered.length,
      metadata: {
        generatedAt: this.stats.lastAnalysis,
        patternsAnalyzed: this.queryPatterns.size,
        totalQueries: this.stats.queriesAnalyzed
      }
    };
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      activePatterns: this.queryPatterns.size,
      activeRecommendations: this.recommendations.length,
      existingIndexes: this.existingIndexes.size,
      configuration: this.options
    };
  }

  /**
   * Helper methods
   */
  
  extractTables(sql) {
    const tables = new Set();
    
    // FROM clause
    const fromMatch = sql.match(/from\s+(\w+)(?:\s+as\s+(\w+))?/gi);
    if (fromMatch) {
      fromMatch.forEach(match => {
        const parts = match.replace(/from\s+/i, '').split(/\s+as\s+/i);
        tables.add(parts[0].trim());
      });
    }
    
    // JOIN clauses
    const joinMatch = sql.match(/join\s+(\w+)(?:\s+as\s+(\w+))?/gi);
    if (joinMatch) {
      joinMatch.forEach(match => {
        const parts = match.replace(/join\s+/i, '').split(/\s+as\s+/i);
        tables.add(parts[0].trim());
      });
    }
    
    return Array.from(tables);
  }

  parseWhereConditions(whereClause) {
    const conditions = [];
    
    // Simple pattern matching for conditions
    const conditionPattern = /(\w+)\.?(\w+)\s*(=|>|<|>=|<=|like|in)\s*[?'"`\w]/gi;
    
    let match;
    while ((match = conditionPattern.exec(whereClause)) !== null) {
      conditions.push({
        table: match[1],
        column: match[2],
        operator: match[3].toLowerCase()
      });
    }
    
    return conditions;
  }

  parseJoinCondition(condition, leftTables, rightTable) {
    const joinColumns = [];
    
    // Simple pattern: table.column = table.column
    const joinPattern = /(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/gi;
    
    let match;
    while ((match = joinPattern.exec(condition)) !== null) {
      joinColumns.push({
        table: match[1],
        column: match[2],
        joinedTable: match[3],
        joinedColumn: match[4]
      });
    }
    
    return joinColumns;
  }

  parseOrderByColumns(orderByClause, tables) {
    const columns = [];
    
    const parts = orderByClause.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      const columnMatch = trimmed.match(/(\w+)\.?(\w+)/);
      
      if (columnMatch) {
        columns.push({
          table: columnMatch[1],
          column: columnMatch[2]
        });
      }
    }
    
    return columns;
  }

  parseGroupByColumns(groupByClause, tables) {
    return this.parseOrderByColumns(groupByClause, tables); // Same logic
  }

  generatePatternKey(pattern) {
    return `${pattern.type}_${pattern.table}_${pattern.columns.join('_')}`;
  }

  generateRecommendationId() {
    return `rec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  determineIndexType(pattern) {
    // Simple logic - can be enhanced
    if (pattern.type === 'WHERE' && pattern.operator === '=') {
      return 'BTREE';
    }
    return 'BTREE';
  }

  calculateWherePriority(condition) {
    if (condition.operator === '=') return 'high';
    if (['>', '<', '>=', '<='].includes(condition.operator)) return 'medium';
    return 'low';
  }

  calculateJoinPriority() {
    return 'high'; // JOINs generally benefit significantly from indexes
  }

  calculateOrderByPriority(columnCount) {
    return columnCount > 1 ? 'high' : 'medium';
  }

  calculateGroupByPriority(columnCount) {
    return columnCount > 1 ? 'high' : 'medium';
  }

  calculatePerformanceImpact(avgTime) {
    if (avgTime > 2000) return 'high';
    if (avgTime > 500) return 'medium';
    return 'low';
  }

  estimateSelectivity(operator) {
    const selectivityMap = {
      '=': 0.1,
      '>': 0.3,
      '<': 0.3,
      '>=': 0.3,
      '<=': 0.3,
      'like': 0.5,
      'in': 0.2
    };
    
    return selectivityMap[operator] || 0.5;
  }

  getPriorityScore(priority) {
    const scores = { high: 3, medium: 2, low: 1 };
    return scores[priority] || 1;
  }

  findCompositeWherePatterns(conditions) {
    // Look for multiple conditions on same table that could benefit from composite index
    const patterns = [];
    const tableConditions = new Map();
    
    // Group conditions by table
    for (const condition of conditions) {
      if (!tableConditions.has(condition.table)) {
        tableConditions.set(condition.table, []);
      }
      tableConditions.get(condition.table).push(condition);
    }
    
    // Create composite patterns for tables with multiple conditions
    for (const [table, tableConditions] of tableConditions) {
      if (tableConditions.length > 1) {
        patterns.push({
          type: 'COMPOSITE_WHERE',
          table,
          columns: tableConditions.map(c => c.column),
          priority: 'high'
        });
      }
    }
    
    return patterns;
  }
}

module.exports = IndexRecommendations;
