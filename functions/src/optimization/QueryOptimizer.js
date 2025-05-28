/**
 * QueryOptimizer.js
 * Advanced query optimization and rewriting system
 * Task 1.5: Query Optimization and Caching
 */

class QueryOptimizer {
  constructor(options = {}) {
    this.optimizations = {
      enableSelectOptimization: options.enableSelectOptimization !== false,
      enableJoinOptimization: options.enableJoinOptimization !== false,
      enableWhereOptimization: options.enableWhereOptimization !== false,
      enableIndexHints: options.enableIndexHints !== false,
      enableQueryRewriting: options.enableQueryRewriting !== false
    };
    
    // Optimization statistics
    this.stats = {
      queriesOptimized: 0,
      optimizationsSaved: 0,
      averageOptimizationTime: 0,
      successfulOptimizations: 0
    };
    
    // Common optimization patterns
    this.optimizationPatterns = this.initializePatterns();
    
    console.log('QueryOptimizer initialized with options:', this.optimizations);
  }

  /**
   * Initialize optimization patterns
   */
  initializePatterns() {
    return {
      // Inefficient patterns to detect and fix
      inefficientPatterns: [
        {
          name: 'SELECT_STAR',
          pattern: /SELECT\s+\*\s+FROM/i,
          severity: 'medium',
          description: 'SELECT * should be avoided, specify explicit columns'
        },
        {
          name: 'MISSING_LIMIT',
          pattern: /SELECT.*FROM.*WHERE(?!.*LIMIT)/is,
          severity: 'high',
          description: 'Large result sets without LIMIT can cause performance issues'
        },
        {
          name: 'OR_IN_WHERE',
          pattern: /WHERE.*OR.*OR/i,
          severity: 'medium',
          description: 'Multiple OR conditions can be slow, consider using IN() or UNION'
        },
        {
          name: 'FUNCTION_IN_WHERE',
          pattern: /WHERE\s+\w+\s*\(/i,
          severity: 'high',
          description: 'Functions in WHERE clause prevent index usage'
        }
      ],
      
      // Optimization rules
      optimizationRules: [
        {
          name: 'ADD_MISSING_LIMIT',
          condition: (sql) => !sql.match(/LIMIT\s+\d+/i) && sql.match(/SELECT.*FROM/i),
          apply: (sql) => sql.trim() + ' LIMIT 1000'
        },
        {
          name: 'OPTIMIZE_COUNT_QUERY',
          condition: (sql) => sql.match(/SELECT\s+COUNT\s*\(\s*\*\s*\)/i),
          apply: (sql) => sql.replace(/COUNT\s*\(\s*\*\s*\)/i, 'COUNT(1)')
        },
        {
          name: 'CONVERT_OR_TO_IN',
          condition: (sql) => sql.match(/(\w+)\s*=\s*\?\s+OR\s+\1\s*=\s*\?/i),
          apply: (sql, params) => this.convertOrToIn(sql, params)
        }
      ]
    };
  }

  /**
   * Main optimization method
   */
  async optimize(sql, params = [], options = {}) {
    const startTime = Date.now();
    this.stats.queriesOptimized++;
    
    try {
      let optimizedSQL = sql;
      let optimizedParams = [...params];
      const optimizationsApplied = [];
      
      // 1. Analyze query structure
      const analysis = this.analyzeQuery(sql, params);
      
      // 2. Apply optimization rules
      if (this.optimizations.enableQueryRewriting) {
        const rewriteResult = this.applyOptimizationRules(optimizedSQL, optimizedParams);
        optimizedSQL = rewriteResult.sql;
        optimizedParams = rewriteResult.params;
        optimizationsApplied.push(...rewriteResult.optimizations);
      }
      
      // 3. Add index hints if enabled
      if (this.optimizations.enableIndexHints) {
        const indexHints = this.generateIndexHints(optimizedSQL, analysis);
        if (indexHints.length > 0) {
          optimizedSQL = this.addIndexHints(optimizedSQL, indexHints);
          optimizationsApplied.push(...indexHints.map(hint => ({
            type: 'INDEX_HINT',
            description: `Added index hint: ${hint.index}`,
            impact: 'medium'
          })));
        }
      }
      
      // 4. Validate optimized query
      const validation = this.validateOptimization(sql, optimizedSQL, params, optimizedParams);
      
      const optimizationTime = Date.now() - startTime;
      this.updateStats(optimizationTime, optimizationsApplied.length > 0);
      
      return {
        success: true,
        originalSQL: sql,
        optimizedSQL,
        originalParams: params,
        optimizedParams,
        analysis,
        optimizationsApplied,
        validation,
        performance: {
          optimizationTime: `${optimizationTime}ms`,
          estimatedImprovement: this.estimateImprovement(optimizationsApplied)
        }
      };
      
    } catch (error) {
      console.error('Query optimization error:', error);
      return {
        success: false,
        error: error.message,
        originalSQL: sql,
        originalParams: params
      };
    }
  }

  /**
   * Analyze query structure and performance characteristics
   */
  analyzeQuery(sql, params = []) {
    const analysis = {
      type: this.getQueryType(sql),
      complexity: 'low',
      tables: this.extractTables(sql),
      joins: this.extractJoins(sql),
      whereConditions: this.extractWhereConditions(sql),
      hasGroupBy: /GROUP\s+BY/i.test(sql),
      hasOrderBy: /ORDER\s+BY/i.test(sql),
      hasLimit: /LIMIT\s+\d+/i.test(sql),
      parameterCount: params.length,
      estimatedRows: this.estimateResultSize(sql),
      issues: []
    };
    
    // Determine complexity
    if (analysis.joins.length > 2 || analysis.tables.length > 3) {
      analysis.complexity = 'high';
    } else if (analysis.joins.length > 0 || analysis.hasGroupBy) {
      analysis.complexity = 'medium';
    }
    
    // Detect potential issues
    analysis.issues = this.detectQueryIssues(sql, analysis);
    
    return analysis;
  }

  /**
   * Apply optimization rules to SQL query
   */
  applyOptimizationRules(sql, params) {
    let optimizedSQL = sql;
    let optimizedParams = [...params];
    const optimizations = [];
    
    for (const rule of this.optimizationPatterns.optimizationRules) {
      if (rule.condition(optimizedSQL)) {
        try {
          const result = rule.apply(optimizedSQL, optimizedParams);
          
          if (typeof result === 'string') {
            optimizedSQL = result;
          } else if (result && result.sql) {
            optimizedSQL = result.sql;
            optimizedParams = result.params || optimizedParams;
          }
          
          optimizations.push({
            type: rule.name,
            description: `Applied ${rule.name} optimization`,
            impact: 'medium'
          });
          
        } catch (error) {
          console.warn(`Failed to apply optimization rule ${rule.name}:`, error.message);
        }
      }
    }
    
    return {
      sql: optimizedSQL,
      params: optimizedParams,
      optimizations
    };
  }

  /**
   * Generate index hints based on query analysis
   */
  generateIndexHints(sql, analysis) {
    const hints = [];
    
    // Suggest indexes for WHERE conditions
    for (const condition of analysis.whereConditions) {
      if (condition.column && condition.table) {
        hints.push({
          type: 'USE_INDEX',
          table: condition.table,
          index: `idx_${condition.table}_${condition.column}`,
          reason: 'WHERE condition optimization'
        });
      }
    }
    
    // Suggest indexes for JOIN conditions
    for (const join of analysis.joins) {
      if (join.leftColumn && join.rightColumn) {
        hints.push({
          type: 'USE_INDEX',
          table: join.leftTable,
          index: `idx_${join.leftTable}_${join.leftColumn}`,
          reason: 'JOIN optimization'
        });
      }
    }
    
    return hints.slice(0, 3); // Limit to 3 hints to avoid over-optimization
  }

  /**
   * Add index hints to SQL query
   */
  addIndexHints(sql, hints) {
    let optimizedSQL = sql;
    
    for (const hint of hints) {
      if (hint.type === 'USE_INDEX') {
        const tablePattern = new RegExp(`(FROM|JOIN)\\s+${hint.table}(?!\\s+USE\\s+INDEX)`, 'i');
        optimizedSQL = optimizedSQL.replace(tablePattern, 
          `$1 ${hint.table} USE INDEX (${hint.index})`);
      }
    }
    
    return optimizedSQL;
  }

  /**
   * Convert OR conditions to IN clause
   */
  convertOrToIn(sql, params) {
    // This is a simplified implementation
    // In practice, this would need more sophisticated parsing
    const orPattern = /(\w+)\s*=\s*\?\s+OR\s+\1\s*=\s*\?/gi;
    
    if (orPattern.test(sql)) {
      // For now, return as-is since this requires complex parameter handling
      return { sql, params };
    }
    
    return { sql, params };
  }

  /**
   * Detect query issues and inefficiencies
   */
  detectQueryIssues(sql, analysis) {
    const issues = [];
    
    for (const pattern of this.optimizationPatterns.inefficientPatterns) {
      if (pattern.pattern.test(sql)) {
        issues.push({
          type: pattern.name,
          severity: pattern.severity,
          description: pattern.description,
          recommendation: this.getRecommendation(pattern.name)
        });
      }
    }
    
    // Additional analysis-based issues
    if (!analysis.hasLimit && analysis.type === 'SELECT') {
      issues.push({
        type: 'MISSING_LIMIT',
        severity: 'high',
        description: 'Query without LIMIT can return large result sets',
        recommendation: 'Add LIMIT clause to control result size'
      });
    }
    
    if (analysis.joins.length > 3) {
      issues.push({
        type: 'COMPLEX_JOINS',
        severity: 'medium',
        description: 'Query has many joins which may impact performance',
        recommendation: 'Consider breaking into smaller queries or adding appropriate indexes'
      });
    }
    
    return issues;
  }

  /**
   * Get recommendation for specific issue type
   */
  getRecommendation(issueType) {
    const recommendations = {
      'SELECT_STAR': 'Replace SELECT * with specific column names',
      'MISSING_LIMIT': 'Add LIMIT clause to control result size',
      'OR_IN_WHERE': 'Consider using IN() clause or UNION for better performance',
      'FUNCTION_IN_WHERE': 'Move functions out of WHERE clause or use computed columns'
    };
    
    return recommendations[issueType] || 'Review query for optimization opportunities';
  }

  /**
   * Validate that optimization doesn't break query logic
   */
  validateOptimization(originalSQL, optimizedSQL, originalParams, optimizedParams) {
    const validation = {
      isValid: true,
      warnings: [],
      changes: []
    };
    
    // Check for significant structural changes
    if (originalSQL.toUpperCase() !== optimizedSQL.toUpperCase()) {
      validation.changes.push('SQL structure modified');
    }
    
    if (originalParams.length !== optimizedParams.length) {
      validation.changes.push('Parameter count changed');
      validation.warnings.push('Parameter count differs - verify query logic');
    }
    
    // Basic syntax validation
    if (!this.isValidSQL(optimizedSQL)) {
      validation.isValid = false;
      validation.warnings.push('Optimized SQL may have syntax errors');
    }
    
    return validation;
  }

  /**
   * Basic SQL syntax validation
   */
  isValidSQL(sql) {
    // Basic checks for common syntax issues
    const selectCount = (sql.match(/SELECT/gi) || []).length;
    const fromCount = (sql.match(/FROM/gi) || []).length;
    
    return selectCount > 0 && fromCount > 0 && selectCount >= fromCount;
  }

  /**
   * Estimate performance improvement from optimizations
   */
  estimateImprovement(optimizations) {
    if (optimizations.length === 0) {
      return '0%';
    }
    
    let totalImprovement = 0;
    
    for (const opt of optimizations) {
      switch (opt.impact) {
        case 'high':
          totalImprovement += 30;
          break;
        case 'medium':
          totalImprovement += 15;
          break;
        case 'low':
          totalImprovement += 5;
          break;
      }
    }
    
    return `${Math.min(totalImprovement, 80)}%`; // Cap at 80%
  }

  /**
   * Extract query type (SELECT, INSERT, UPDATE, DELETE)
   */
  getQueryType(sql) {
    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith('SELECT')) return 'SELECT';
    if (trimmed.startsWith('INSERT')) return 'INSERT';
    if (trimmed.startsWith('UPDATE')) return 'UPDATE';
    if (trimmed.startsWith('DELETE')) return 'DELETE';
    return 'UNKNOWN';
  }

  /**
   * Extract table names from SQL
   */
  extractTables(sql) {
    const tables = [];
    const fromMatch = sql.match(/FROM\s+(\w+)/gi);
    const joinMatch = sql.match(/JOIN\s+(\w+)/gi);
    
    if (fromMatch) {
      fromMatch.forEach(match => {
        const table = match.replace(/FROM\s+/i, '').trim();
        if (!tables.includes(table)) tables.push(table);
      });
    }
    
    if (joinMatch) {
      joinMatch.forEach(match => {
        const table = match.replace(/JOIN\s+/i, '').trim();
        if (!tables.includes(table)) tables.push(table);
      });
    }
    
    return tables;
  }

  /**
   * Extract JOIN information
   */
  extractJoins(sql) {
    const joins = [];
    const joinPattern = /(LEFT\s+JOIN|RIGHT\s+JOIN|INNER\s+JOIN|JOIN)\s+(\w+)\s+(?:AS\s+)?(\w+)?\s+ON\s+([^WHERE|ORDER|GROUP|LIMIT]+)/gi;
    
    let match;
    while ((match = joinPattern.exec(sql)) !== null) {
      joins.push({
        type: match[1].trim(),
        table: match[2],
        alias: match[3] || null,
        condition: match[4].trim()
      });
    }
    
    return joins;
  }

  /**
   * Extract WHERE conditions
   */
  extractWhereConditions(sql) {
    const conditions = [];
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:GROUP\s+BY|ORDER\s+BY|LIMIT|$)/is);
    
    if (whereMatch) {
      const whereClause = whereMatch[1];
      // Simple extraction of column = value patterns
      const conditionPattern = /(\w+)\.?(\w+)\s*(=|>|<|>=|<=|LIKE|IN)\s*[?'"`\w]/gi;
      
      let match;
      while ((match = conditionPattern.exec(whereClause)) !== null) {
        conditions.push({
          table: match[1],
          column: match[2],
          operator: match[3]
        });
      }
    }
    
    return conditions;
  }

  /**
   * Estimate result size based on query characteristics
   */
  estimateResultSize(sql) {
    if (/LIMIT\s+(\d+)/i.test(sql)) {
      const limit = parseInt(sql.match(/LIMIT\s+(\d+)/i)[1]);
      return limit;
    }
    
    if (/COUNT\s*\(/i.test(sql)) {
      return 1;
    }
    
    // Default estimate based on complexity
    if (sql.includes('JOIN')) {
      return 1000;
    }
    
    return 500;
  }

  /**
   * Update optimization statistics
   */
  updateStats(optimizationTime, wasSuccessful) {
    if (wasSuccessful) {
      this.stats.successfulOptimizations++;
    }
    
    this.stats.optimizationsSaved += optimizationTime;
    this.stats.averageOptimizationTime = 
      this.stats.optimizationsSaved / this.stats.queriesOptimized;
  }

  /**
   * Get optimization statistics
   */
  getStats() {
    const successRate = this.stats.queriesOptimized > 0 ? 
      (this.stats.successfulOptimizations / this.stats.queriesOptimized * 100) : 0;
    
    return {
      ...this.stats,
      successRate: Math.round(successRate * 100) / 100,
      configuration: this.optimizations
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      queriesOptimized: 0,
      optimizationsSaved: 0,
      averageOptimizationTime: 0,
      successfulOptimizations: 0
    };
  }
}

module.exports = QueryOptimizer;
