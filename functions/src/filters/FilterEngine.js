/**
 * Data Filtering Component Architecture for DB3
 * Task 1.3: Implement Data Filtering Component Architecture
 * 
 * A composable filter chain system that allows for complex data filtering operations
 */

class FilterEngine {
  constructor() {
    this.filters = [];
    this.tableName = null;
    this.joins = [];
    this.selectFields = ['*'];
  }

  /**
   * Set the base table for filtering
   */
  setTable(tableName) {
    this.tableName = tableName;
    return this;
  }

  /**
   * Set fields to select
   */
  select(fields) {
    this.selectFields = Array.isArray(fields) ? fields : [fields];
    return this;
  }

  /**
   * Add a join to the query
   */
  join(table, leftField, operator, rightField, type = 'INNER') {
    this.joins.push({
      type,
      table,
      condition: `${leftField} ${operator} ${rightField}`
    });
    return this;
  }

  /**
   * Add a range filter (for numbers and dates)
   */
  addRangeFilter(field, min = null, max = null) {
    if (min !== null) {
      this.filters.push({
        type: 'range',
        field,
        operator: '>=',
        value: min,
        parameterized: true
      });
    }
    
    if (max !== null) {
      this.filters.push({
        type: 'range',
        field,
        operator: '<=',
        value: max,
        parameterized: true
      });
    }
    
    return this;
  }

  /**
   * Add an exact match filter
   */
  addExactFilter(field, value) {
    this.filters.push({
      type: 'exact',
      field,
      operator: '=',
      value,
      parameterized: true
    });
    return this;
  }

  /**
   * Add a text search filter with LIKE
   */
  addTextFilter(field, searchText) {
    this.filters.push({
      type: 'text',
      field,
      operator: 'LIKE',
      value: `%${searchText}%`,
      parameterized: true
    });
    return this;
  }

  /**
   * Add an IN filter for multiple values
   */
  addInFilter(field, values) {
    if (!Array.isArray(values) || values.length === 0) return this;
    
    this.filters.push({
      type: 'in',
      field,
      operator: 'IN',
      value: values,
      parameterized: true
    });
    return this;
  }

  /**
   * Add a date range filter
   */
  addDateRangeFilter(field, startDate = null, endDate = null) {
    if (startDate) {
      this.filters.push({
        type: 'date',
        field,
        operator: '>=',
        value: startDate,
        parameterized: true
      });
    }
    
    if (endDate) {
      this.filters.push({
        type: 'date',
        field,
        operator: '<=',
        value: endDate,
        parameterized: true
      });
    }
    
    return this;
  }

  /**
   * Add a custom HAVING filter for aggregated fields
   */
  addHavingFilter(field, operator, value) {
    this.filters.push({
      type: 'having',
      field,
      operator,
      value,
      parameterized: true
    });
    return this;
  }

  /**
   * Add activity status filter (active/dormant users)
   */
  addActivityFilter(status, daysSinceThreshold = 30) {
    if (status === 'active') {
      this.filters.push({
        type: 'activity',
        field: 'DATEDIFF(CURDATE(), MAX(gs.gameDate))',
        operator: '<=',
        value: daysSinceThreshold,
        parameterized: true
      });
    } else if (status === 'dormant') {
      this.filters.push({
        type: 'activity',
        field: 'DATEDIFF(CURDATE(), MAX(gs.gameDate))',
        operator: '>',
        value: daysSinceThreshold,
        parameterized: true
      });
    }
    return this;
  }

  /**
   * Add user status filter
   */
  addUserStatusFilter(status) {
    this.filters.push({
      type: 'user_status',
      field: 'p.status',
      operator: '=',
      value: parseInt(status),
      parameterized: true
    });
    return this;
  }

  /**
   * Build the WHERE clause and parameters
   */
  buildWhereClause() {
    const whereFilters = this.filters.filter(f => f.type !== 'having');
    const params = [];
    
    if (whereFilters.length === 0) {
      return { whereClause: '', params };
    }

    const conditions = whereFilters.map(filter => {
      if (filter.type === 'in') {
        const placeholders = filter.value.map(() => '?').join(', ');
        params.push(...filter.value);
        return `${filter.field} IN (${placeholders})`;
      } else {
        params.push(filter.value);
        return `${filter.field} ${filter.operator} ?`;
      }
    });

    return {
      whereClause: `WHERE ${conditions.join(' AND ')}`,
      params
    };
  }

  /**
   * Build the HAVING clause and parameters
   */
  buildHavingClause() {
    const havingFilters = this.filters.filter(f => f.type === 'having' || f.type === 'activity');
    const params = [];
    
    if (havingFilters.length === 0) {
      return { havingClause: '', params };
    }

    const conditions = havingFilters.map(filter => {
      params.push(filter.value);
      return `${filter.field} ${filter.operator} ?`;
    });

    return {
      havingClause: `HAVING ${conditions.join(' AND ')}`,
      params
    };
  }

  /**
   * Build the complete SQL query
   */
  buildQuery(groupBy = null, orderBy = null, limit = null) {
    if (!this.tableName) {
      throw new Error('Table name must be set before building query');
    }

    let sql = `SELECT ${this.selectFields.join(', ')} FROM ${this.tableName}`;
    
    // Add table alias if joins exist
    if (this.joins.length > 0) {
      sql = `SELECT ${this.selectFields.join(', ')} FROM ${this.tableName} p`;
    }

    // Add joins
    this.joins.forEach(join => {
      sql += ` ${join.type} JOIN ${join.table} ON ${join.condition}`;
    });

    // Build WHERE clause
    const { whereClause, params: whereParams } = this.buildWhereClause();
    if (whereClause) {
      sql += ` ${whereClause}`;
    }

    const allParams = [...whereParams];

    // Add GROUP BY
    if (groupBy) {
      sql += ` GROUP BY ${Array.isArray(groupBy) ? groupBy.join(', ') : groupBy}`;
    }

    // Build HAVING clause  
    const { havingClause, params: havingParams } = this.buildHavingClause();
    if (havingClause) {
      sql += ` ${havingClause}`;
      allParams.push(...havingParams);
    }

    // Add ORDER BY
    if (orderBy) {
      sql += ` ORDER BY ${orderBy}`;
    }

    // Add LIMIT
    if (limit) {
      sql += ` LIMIT ${parseInt(limit)}`;
    }

    return { sql, params: allParams };
  }

  /**
   * Clear all filters
   */
  reset() {
    this.filters = [];
    this.joins = [];
    this.selectFields = ['*'];
    this.tableName = null;
    return this;
  }

  /**
   * Get current filter summary
   */
  getFilterSummary() {
    return {
      totalFilters: this.filters.length,
      filterTypes: [...new Set(this.filters.map(f => f.type))],
      hasJoins: this.joins.length > 0,
      table: this.tableName,
      filters: this.filters.map(f => ({
        type: f.type,
        field: f.field,
        operator: f.operator
      }))
    };
  }
}

module.exports = FilterEngine;
