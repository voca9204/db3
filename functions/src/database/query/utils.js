/**
 * Query Builder Utilities
 * Helper functions for SQL query construction, validation, and optimization
 */

/**
 * SQL Utilities
 */
class SqlUtils {
  /**
   * Escape SQL identifier (table name, column name)
   */
  static escapeIdentifier(identifier) {
    if (typeof identifier !== 'string') {
      throw new Error('Identifier must be a string');
    }
    
    // Remove any existing backticks and wrap with backticks
    return '`' + identifier.replace(/`/g, '``') + '`';
  }

  /**
   * Escape multiple identifiers
   */
  static escapeIdentifiers(identifiers) {
    return identifiers.map(id => this.escapeIdentifier(id));
  }

  /**
   * Validate SQL identifier name
   */
  static isValidIdentifier(name) {
    if (typeof name !== 'string' || name.length === 0) {
      return false;
    }
    
    // SQL identifier rules: start with letter or underscore, 
    // contain only letters, numbers, underscores
    const pattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    return pattern.test(name) && name.length <= 64;
  }

  /**
   * Validate table name
   */
  static validateTableName(tableName) {
    if (!this.isValidIdentifier(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`);
    }
    return tableName;
  }

  /**
   * Validate column name
   */
  static validateColumnName(columnName) {
    if (!this.isValidIdentifier(columnName)) {
      throw new Error(`Invalid column name: ${columnName}`);
    }
    return columnName;
  }

  /**
   * Validate SQL operator
   */
  static validateOperator(operator) {
    const validOperators = [
      '=', '!=', '<>', '<', '<=', '>', '>=',
      'LIKE', 'NOT LIKE', 'ILIKE', 'NOT ILIKE',
      'IN', 'NOT IN', 'BETWEEN', 'NOT BETWEEN',
      'IS', 'IS NOT', 'EXISTS', 'NOT EXISTS',
      'REGEXP', 'NOT REGEXP', 'RLIKE',
      'SOUNDS LIKE'
    ];
    
    if (!validOperators.includes(operator.toUpperCase())) {
      throw new Error(`Invalid SQL operator: ${operator}`);
    }
    
    return operator.toUpperCase();
  }

  /**
   * Validate ORDER BY direction
   */
  static validateOrderDirection(direction) {
    const validDirections = ['ASC', 'DESC'];
    const upperDirection = direction.toUpperCase();
    
    if (!validDirections.includes(upperDirection)) {
      throw new Error(`Invalid ORDER BY direction: ${direction}`);
    }
    
    return upperDirection;
  }

  /**
   * Sanitize LIMIT value
   */
  static sanitizeLimit(limit) {
    const num = parseInt(limit);
    if (isNaN(num) || num < 0) {
      throw new Error(`Invalid LIMIT value: ${limit}`);
    }
    return Math.min(num, 10000); // Cap at 10,000 for safety
  }

  /**
   * Sanitize OFFSET value
   */
  static sanitizeOffset(offset) {
    const num = parseInt(offset);
    if (isNaN(num) || num < 0) {
      throw new Error(`Invalid OFFSET value: ${offset}`);
    }
    return num;
  }

  /**
   * Generate placeholder string for IN clause
   */
  static generateInPlaceholders(count) {
    if (count <= 0) {
      throw new Error('IN clause must have at least one value');
    }
    if (count > 1000) {
      throw new Error('IN clause cannot have more than 1000 values');
    }
    
    return Array(count).fill('?').join(', ');
  }

  /**
   * Format SQL query for logging
   */
  static formatSqlForLogging(sql, params = []) {
    let formattedSql = sql;
    
    // Replace placeholders with parameter values for logging
    params.forEach((param, index) => {
      let value;
      if (param === null) {
        value = 'NULL';
      } else if (typeof param === 'string') {
        value = `'${param.replace(/'/g, "''")}'`;
      } else if (param instanceof Date) {
        value = `'${param.toISOString()}'`;
      } else {
        value = String(param);
      }
      
      formattedSql = formattedSql.replace('?', value);
    });
    
    return formattedSql;
  }

  /**
   * Estimate query complexity score (1-10)
   */
  static estimateComplexity(sql) {
    let complexity = 1;
    const upperSql = sql.toUpperCase();
    
    // Add complexity for JOINs
    const joinCount = (upperSql.match(/\bJOIN\b/g) || []).length;
    complexity += joinCount * 1.5;
    
    // Add complexity for subqueries
    const subqueryCount = (upperSql.match(/\(/g) || []).length;
    complexity += subqueryCount * 2;
    
    // Add complexity for aggregations
    if (upperSql.includes('GROUP BY')) complexity += 2;
    if (upperSql.includes('HAVING')) complexity += 1.5;
    if (upperSql.includes('ORDER BY')) complexity += 0.5;
    
    // Add complexity for functions
    const functionCount = (upperSql.match(/\b(COUNT|SUM|AVG|MIN|MAX|SUBSTR|CONCAT)\b/g) || []).length;
    complexity += functionCount * 0.5;
    
    return Math.min(Math.round(complexity), 10);
  }
}

/**
 * Query Validation
 */
class QueryValidator {
  /**
   * Validate WHERE conditions
   */
  static validateWhereConditions(conditions) {
    if (!Array.isArray(conditions)) {
      throw new Error('WHERE conditions must be an array');
    }
    
    conditions.forEach((condition, index) => {
      if (!condition.field || !condition.operator) {
        throw new Error(`Invalid WHERE condition at index ${index}`);
      }
      
      SqlUtils.validateColumnName(condition.field);
      SqlUtils.validateOperator(condition.operator);
      
      // Validate logic connector
      if (index > 0 && !['AND', 'OR'].includes(condition.logic)) {
        throw new Error(`Invalid logic connector: ${condition.logic}`);
      }
    });
    
    return true;
  }

  /**
   * Validate JOIN conditions
   */
  static validateJoinConditions(joins) {
    if (!Array.isArray(joins)) {
      throw new Error('JOIN conditions must be an array');
    }
    
    joins.forEach((join, index) => {
      if (!join.table || !join.first || !join.second) {
        throw new Error(`Invalid JOIN condition at index ${index}`);
      }
      
      SqlUtils.validateTableName(join.table);
      
      const validJoinTypes = ['INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN'];
      if (!validJoinTypes.includes(join.type)) {
        throw new Error(`Invalid JOIN type: ${join.type}`);
      }
    });
    
    return true;
  }

  /**
   * Validate SELECT fields
   */
  static validateSelectFields(fields) {
    if (!Array.isArray(fields)) {
      throw new Error('SELECT fields must be an array');
    }
    
    if (fields.length === 0) {
      throw new Error('SELECT fields cannot be empty');
    }
    
    fields.forEach(field => {
      if (typeof field !== 'string') {
        throw new Error('SELECT field must be a string');
      }
      
      // Allow asterisk and functions
      if (field === '*' || field.includes('(')) {
        return;
      }
      
      // Validate as column name
      SqlUtils.validateColumnName(field);
    });
    
    return true;
  }

  /**
   * Validate INSERT/UPDATE data
   */
  static validateDataObject(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Data must be an object');
    }
    
    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        if (!item || typeof item !== 'object') {
          throw new Error(`Data item at index ${index} must be an object`);
        }
        this.validateDataObjectKeys(item);
      });
    } else {
      this.validateDataObjectKeys(data);
    }
    
    return true;
  }

  /**
   * Validate data object keys
   */
  static validateDataObjectKeys(data) {
    Object.keys(data).forEach(key => {
      SqlUtils.validateColumnName(key);
    });
  }

  /**
   * Validate complete query
   */
  static validateQuery(queryType, config) {
    switch (queryType) {
      case 'SELECT':
        if (config.selectFields) {
          this.validateSelectFields(config.selectFields);
        }
        break;
        
      case 'INSERT':
        if (!config.insertData) {
          throw new Error('INSERT query requires data');
        }
        this.validateDataObject(config.insertData);
        break;
        
      case 'UPDATE':
        if (!config.updateData) {
          throw new Error('UPDATE query requires data');
        }
        this.validateDataObject(config.updateData);
        break;
        
      case 'DELETE':
        // DELETE validation is minimal
        break;
        
      default:
        throw new Error(`Unsupported query type: ${queryType}`);
    }
    
    if (config.whereConditions) {
      this.validateWhereConditions(config.whereConditions);
    }
    
    if (config.joinClauses) {
      this.validateJoinConditions(config.joinClauses);
    }
    
    return true;
  }
}

/**
 * Query Optimization Hints
 */
class QueryOptimizer {
  /**
   * Suggest optimizations for a query
   */
  static suggestOptimizations(queryBuilder) {
    const suggestions = [];
    const { sql } = queryBuilder.toSQL();
    const upperSql = sql.toUpperCase();
    
    // Check for missing WHERE clause on large tables
    if (queryBuilder.queryType === 'DELETE' && queryBuilder.whereConditions.length === 0) {
      suggestions.push({
        type: 'warning',
        message: 'DELETE without WHERE clause will remove all records'
      });
    }
    
    // Check for LIMIT on potentially large result sets
    if (queryBuilder.queryType === 'SELECT' && !queryBuilder.limitCount) {
      suggestions.push({
        type: 'optimization',
        message: 'Consider adding LIMIT to prevent large result sets'
      });
    }
    
    // Check for SELECT *
    if (queryBuilder.selectFields.includes('*')) {
      suggestions.push({
        type: 'optimization',
        message: 'SELECT * can be inefficient, specify only needed columns'
      });
    }
    
    // Check for OR conditions that might benefit from UNION
    const orConditions = queryBuilder.whereConditions.filter(c => c.logic === 'OR');
    if (orConditions.length > 3) {
      suggestions.push({
        type: 'optimization',
        message: 'Multiple OR conditions might benefit from UNION instead'
      });
    }
    
    // Check for ORDER BY without LIMIT
    if (queryBuilder.orderByFields.length > 0 && !queryBuilder.limitCount) {
      suggestions.push({
        type: 'optimization',
        message: 'ORDER BY without LIMIT sorts entire result set'
      });
    }
    
    return suggestions;
  }

  /**
   * Generate execution plan hint
   */
  static generateExecutionPlan(queryBuilder) {
    const { sql } = queryBuilder.toSQL();
    return {
      explainSql: `EXPLAIN ${sql}`,
      analyzeSql: `EXPLAIN ANALYZE ${sql}`,
      complexity: SqlUtils.estimateComplexity(sql)
    };
  }

  /**
   * Suggest indexes for a query
   */
  static suggestIndexes(queryBuilder) {
    const indexSuggestions = [];
    
    // Suggest indexes for WHERE conditions
    queryBuilder.whereConditions.forEach(condition => {
      indexSuggestions.push({
        table: queryBuilder.tableName,
        column: condition.field,
        type: 'single',
        reason: 'WHERE clause filtering'
      });
    });
    
    // Suggest indexes for JOIN conditions
    queryBuilder.joinClauses.forEach(join => {
      indexSuggestions.push({
        table: join.table,
        column: join.second.split('.')[1] || join.second,
        type: 'single',
        reason: 'JOIN condition'
      });
    });
    
    // Suggest indexes for ORDER BY
    if (queryBuilder.orderByFields.length > 0) {
      indexSuggestions.push({
        table: queryBuilder.tableName,
        columns: queryBuilder.orderByFields.map(f => f.field),
        type: 'composite',
        reason: 'ORDER BY optimization'
      });
    }
    
    return indexSuggestions;
  }
}

/**
 * Query Performance Monitor
 */
class QueryPerformanceMonitor {
  constructor() {
    this.queryStats = new Map();
  }

  /**
   * Record query execution
   */
  recordExecution(sql, executionTime, success = true) {
    const queryHash = this.hashQuery(sql);
    
    if (!this.queryStats.has(queryHash)) {
      this.queryStats.set(queryHash, {
        sql: sql.substring(0, 100),
        executions: 0,
        totalTime: 0,
        averageTime: 0,
        minTime: Infinity,
        maxTime: 0,
        errors: 0,
        lastExecuted: null
      });
    }
    
    const stats = this.queryStats.get(queryHash);
    stats.executions++;
    stats.lastExecuted = new Date();
    
    if (success) {
      stats.totalTime += executionTime;
      stats.averageTime = stats.totalTime / stats.executions;
      stats.minTime = Math.min(stats.minTime, executionTime);
      stats.maxTime = Math.max(stats.maxTime, executionTime);
    } else {
      stats.errors++;
    }
  }

  /**
   * Get performance statistics
   */
  getStats() {
    const allStats = Array.from(this.queryStats.values());
    
    return {
      totalQueries: allStats.reduce((sum, stat) => sum + stat.executions, 0),
      totalErrors: allStats.reduce((sum, stat) => sum + stat.errors, 0),
      averageExecutionTime: allStats.reduce((sum, stat) => sum + stat.averageTime, 0) / allStats.length,
      slowestQueries: allStats
        .sort((a, b) => b.maxTime - a.maxTime)
        .slice(0, 10),
      mostFrequentQueries: allStats
        .sort((a, b) => b.executions - a.executions)
        .slice(0, 10)
    };
  }

  /**
   * Hash query for identification
   */
  hashQuery(sql) {
    // Simple hash function for SQL queries
    let hash = 0;
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash;
  }

  /**
   * Clear statistics
   */
  clearStats() {
    this.queryStats.clear();
  }
}

// Create singleton performance monitor
const performanceMonitor = new QueryPerformanceMonitor();

module.exports = {
  SqlUtils,
  QueryValidator,
  QueryOptimizer,
  QueryPerformanceMonitor,
  performanceMonitor
};
