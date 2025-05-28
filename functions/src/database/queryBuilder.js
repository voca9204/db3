/**
 * Flexible Query Builder Framework
 * Provides a fluent interface for building complex SQL queries with parameterization
 * and support for different query types (SELECT, INSERT, UPDATE, DELETE)
 */

const { executeQuery, queryOne } = require('../../db');

/**
 * Main Query Builder class with fluent interface
 */
class QueryBuilder {
  constructor(tableName = null) {
    this.reset();
    if (tableName) {
      this.tableName = tableName;
    }
  }

  /**
   * Reset query state
   */
  reset() {
    this.queryType = null;
    this.tableName = null;
    this.selectFields = ['*'];
    this.insertData = {};
    this.updateData = {};
    this.whereConditions = [];
    this.joinClauses = [];
    this.groupByFields = [];
    this.havingConditions = [];
    this.orderByFields = [];
    this.limitCount = null;
    this.offsetCount = null;
    this.parameters = [];
    this.paramCounter = 0;
    return this;
  }

  /**
   * Static factory method to create a new QueryBuilder instance
   */
  static table(tableName) {
    return new QueryBuilder(tableName);
  }

  /**
   * Static method to create a raw query
   */
  static raw(sql, params = []) {
    const qb = new QueryBuilder();
    qb.rawSql = sql;
    qb.parameters = params;
    return qb;
  }

  /**
   * Set table name
   */
  table(tableName) {
    this.tableName = tableName;
    return this;
  }

  /**
   * SELECT query methods
   */
  select(fields = ['*']) {
    this.queryType = 'SELECT';
    if (typeof fields === 'string') {
      this.selectFields = [fields];
    } else if (Array.isArray(fields)) {
      this.selectFields = fields;
    } else {
      throw new Error('Fields must be a string or array');
    }
    return this;
  }

  /**
   * INSERT query methods
   */
  insert(data) {
    this.queryType = 'INSERT';
    this.insertData = data;
    return this;
  }

  /**
   * UPDATE query methods
   */
  update(data) {
    this.queryType = 'UPDATE';
    this.updateData = data;
    return this;
  }

  /**
   * DELETE query methods
   */
  delete() {
    this.queryType = 'DELETE';
    return this;
  }

  /**
   * WHERE clause methods
   */
  where(field, operator = '=', value = null) {
    // Handle different parameter patterns
    if (arguments.length === 2 && typeof operator !== 'string') {
      value = operator;
      operator = '=';
    }

    if (typeof field === 'object' && field !== null) {
      // Handle object of key-value pairs
      Object.entries(field).forEach(([key, val]) => {
        this.addWhereCondition(key, '=', val, 'AND');
      });
    } else {
      this.addWhereCondition(field, operator, value, 'AND');
    }
    return this;
  }

  whereNot(field, operator = '=', value = null) {
    if (arguments.length === 2) {
      value = operator;
      operator = '=';
    }
    this.addWhereCondition(field, operator, value, 'AND', true);
    return this;
  }

  orWhere(field, operator = '=', value = null) {
    if (arguments.length === 2) {
      value = operator;
      operator = '=';
    }
    this.addWhereCondition(field, operator, value, 'OR');
    return this;
  }

  whereIn(field, values) {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error('whereIn requires a non-empty array of values');
    }
    this.addWhereCondition(field, 'IN', values, 'AND');
    return this;
  }

  whereNotIn(field, values) {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error('whereNotIn requires a non-empty array of values');
    }
    this.addWhereCondition(field, 'NOT IN', values, 'AND');
    return this;
  }

  whereBetween(field, min, max) {
    this.addWhereCondition(field, 'BETWEEN', [min, max], 'AND');
    return this;
  }

  whereNull(field) {
    this.addWhereCondition(field, 'IS', null, 'AND');
    return this;
  }

  whereNotNull(field) {
    this.addWhereCondition(field, 'IS NOT', null, 'AND');
    return this;
  }

  whereLike(field, pattern) {
    this.addWhereCondition(field, 'LIKE', pattern, 'AND');
    return this;
  }

  /**
   * Add WHERE condition helper
   */
  addWhereCondition(field, operator, value, logic = 'AND', negate = false) {
    const condition = {
      field,
      operator: negate ? `NOT ${operator}` : operator,
      value,
      logic,
      paramIndex: null
    };

    // Handle parameterization
    if (value !== null && operator !== 'IS' && operator !== 'IS NOT') {
      if (Array.isArray(value)) {
        if (operator === 'IN' || operator === 'NOT IN') {
          condition.paramIndex = value.map(() => this.addParameter(value.shift()));
        } else if (operator === 'BETWEEN') {
          condition.paramIndex = [this.addParameter(value[0]), this.addParameter(value[1])];
        }
      } else {
        condition.paramIndex = this.addParameter(value);
      }
    }

    this.whereConditions.push(condition);
  }

  /**
   * JOIN methods
   */
  join(table, first, operator = '=', second = null) {
    this.addJoin('INNER JOIN', table, first, operator, second);
    return this;
  }

  leftJoin(table, first, operator = '=', second = null) {
    this.addJoin('LEFT JOIN', table, first, operator, second);
    return this;
  }

  rightJoin(table, first, operator = '=', second = null) {
    this.addJoin('RIGHT JOIN', table, first, operator, second);
    return this;
  }

  innerJoin(table, first, operator = '=', second = null) {
    this.addJoin('INNER JOIN', table, first, operator, second);
    return this;
  }

  /**
   * Add JOIN helper
   */
  addJoin(type, table, first, operator, second) {
    if (arguments.length === 3 && typeof operator !== 'string') {
      second = operator;
      operator = '=';
    }

    this.joinClauses.push({
      type,
      table,
      first,
      operator,
      second
    });
  }

  /**
   * GROUP BY methods
   */
  groupBy(...fields) {
    this.groupByFields.push(...fields);
    return this;
  }

  /**
   * HAVING methods
   */
  having(field, operator = '=', value = null) {
    if (arguments.length === 2) {
      value = operator;
      operator = '=';
    }
    
    const condition = {
      field,
      operator,
      value,
      paramIndex: value !== null ? this.addParameter(value) : null
    };
    
    this.havingConditions.push(condition);
    return this;
  }

  /**
   * ORDER BY methods
   */
  orderBy(field, direction = 'ASC') {
    this.orderByFields.push({
      field,
      direction: direction.toUpperCase()
    });
    return this;
  }

  orderByDesc(field) {
    return this.orderBy(field, 'DESC');
  }

  /**
   * LIMIT and OFFSET methods
   */
  limit(count) {
    this.limitCount = count;
    return this;
  }

  offset(count) {
    this.offsetCount = count;
    return this;
  }

  /**
   * Parameter management
   */
  addParameter(value) {
    const index = this.parameters.length;
    this.parameters.push(value);
    return index;
  }

  /**
   * Build the SQL query
   */
  toSQL() {
    if (this.rawSql) {
      return {
        sql: this.rawSql,
        params: this.parameters
      };
    }

    if (!this.tableName && this.queryType !== 'SELECT') {
      throw new Error('Table name is required');
    }

    let sql = '';
    
    switch (this.queryType) {
      case 'SELECT':
        sql = this.buildSelectQuery();
        break;
      case 'INSERT':
        sql = this.buildInsertQuery();
        break;
      case 'UPDATE':
        sql = this.buildUpdateQuery();
        break;
      case 'DELETE':
        sql = this.buildDeleteQuery();
        break;
      default:
        throw new Error('Query type not specified');
    }

    return {
      sql: sql.trim(),
      params: this.parameters
    };
  }

  /**
   * Build SELECT query
   */
  buildSelectQuery() {
    let sql = `SELECT ${this.selectFields.join(', ')}`;
    
    if (this.tableName) {
      sql += ` FROM ${this.tableName}`;
    }
    
    sql += this.buildJoins();
    sql += this.buildWhere();
    sql += this.buildGroupBy();
    sql += this.buildHaving();
    sql += this.buildOrderBy();
    sql += this.buildLimit();
    
    return sql;
  }

  /**
   * Build INSERT query
   */
  buildInsertQuery() {
    if (Array.isArray(this.insertData)) {
      return this.buildBatchInsertQuery();
    }

    const fields = Object.keys(this.insertData);
    const values = Object.values(this.insertData);
    
    values.forEach(value => this.addParameter(value));
    
    const placeholders = values.map(() => '?').join(', ');
    
    return `INSERT INTO ${this.tableName} (${fields.join(', ')}) VALUES (${placeholders})`;
  }

  /**
   * Build batch INSERT query
   */
  buildBatchInsertQuery() {
    if (this.insertData.length === 0) {
      throw new Error('Insert data cannot be empty');
    }

    const fields = Object.keys(this.insertData[0]);
    const valueRows = this.insertData.map(row => {
      const values = fields.map(field => {
        this.addParameter(row[field]);
        return '?';
      });
      return `(${values.join(', ')})`;
    });

    return `INSERT INTO ${this.tableName} (${fields.join(', ')}) VALUES ${valueRows.join(', ')}`;
  }

  /**
   * Build UPDATE query
   */
  buildUpdateQuery() {
    const fields = Object.keys(this.updateData);
    const setParts = fields.map(field => {
      this.addParameter(this.updateData[field]);
      return `${field} = ?`;
    });

    let sql = `UPDATE ${this.tableName} SET ${setParts.join(', ')}`;
    sql += this.buildWhere();
    sql += this.buildOrderBy();
    sql += this.buildLimit();
    
    return sql;
  }

  /**
   * Build DELETE query
   */
  buildDeleteQuery() {
    let sql = `DELETE FROM ${this.tableName}`;
    sql += this.buildWhere();
    sql += this.buildOrderBy();
    sql += this.buildLimit();
    
    return sql;
  }

  /**
   * Build JOIN clauses
   */
  buildJoins() {
    if (this.joinClauses.length === 0) return '';
    
    return ' ' + this.joinClauses.map(join => 
      `${join.type} ${join.table} ON ${join.first} ${join.operator} ${join.second}`
    ).join(' ');
  }

  /**
   * Build WHERE clause
   */
  buildWhere() {
    if (this.whereConditions.length === 0) return '';
    
    const conditions = this.whereConditions.map((condition, index) => {
      let clause = '';
      
      if (index > 0) {
        clause += ` ${condition.logic} `;
      }
      
      clause += `${condition.field} ${condition.operator}`;
      
      if (condition.value === null && (condition.operator === 'IS' || condition.operator === 'IS NOT')) {
        clause += ' NULL';
      } else if (condition.operator === 'IN' || condition.operator === 'NOT IN') {
        const placeholders = condition.paramIndex.map(() => '?').join(', ');
        clause += ` (${placeholders})`;
      } else if (condition.operator === 'BETWEEN') {
        clause += ' ? AND ?';
      } else if (condition.paramIndex !== null) {
        clause += ' ?';
      }
      
      return clause;
    });
    
    return ` WHERE ${conditions.join('')}`;
  }

  /**
   * Build GROUP BY clause
   */
  buildGroupBy() {
    if (this.groupByFields.length === 0) return '';
    return ` GROUP BY ${this.groupByFields.join(', ')}`;
  }

  /**
   * Build HAVING clause
   */
  buildHaving() {
    if (this.havingConditions.length === 0) return '';
    
    const conditions = this.havingConditions.map(condition => 
      condition.value !== null ? 
        `${condition.field} ${condition.operator} ?` :
        `${condition.field} ${condition.operator}`
    );
    
    return ` HAVING ${conditions.join(' AND ')}`;
  }

  /**
   * Build ORDER BY clause
   */
  buildOrderBy() {
    if (this.orderByFields.length === 0) return '';
    
    const orders = this.orderByFields.map(order => 
      `${order.field} ${order.direction}`
    );
    
    return ` ORDER BY ${orders.join(', ')}`;
  }

  /**
   * Build LIMIT clause
   */
  buildLimit() {
    let clause = '';
    
    if (this.limitCount !== null) {
      clause += ` LIMIT ${this.limitCount}`;
    }
    
    if (this.offsetCount !== null) {
      clause += ` OFFSET ${this.offsetCount}`;
    }
    
    return clause;
  }

  /**
   * Execute the query
   */
  async execute() {
    const { sql, params } = this.toSQL();
    return await executeQuery(sql, params);
  }

  /**
   * Execute and return first result
   */
  async first() {
    const { results } = await this.limit(1).execute();
    return results[0] || null;
  }

  /**
   * Execute and return all results
   */
  async get() {
    const { results } = await this.execute();
    return results;
  }

  /**
   * Execute and return count
   */
  async count(field = '*') {
    const originalSelect = this.selectFields;
    this.selectFields = [`COUNT(${field}) as count`];
    
    const { results } = await this.execute();
    
    // Restore original select
    this.selectFields = originalSelect;
    
    return results[0].count;
  }

  /**
   * Execute within a transaction
   */
  async executeInTransaction(callback) {
    const { sql, params } = this.toSQL();
    const results = await executeQuery(sql, params);
    
    if (callback) {
      return await callback({ results, fields: [] });
    }
    
    return { results, fields: [] };
  }

  /**
   * Clone the query builder
   */
  clone() {
    const clone = new QueryBuilder();
    
    // Copy all properties
    clone.queryType = this.queryType;
    clone.tableName = this.tableName;
    clone.selectFields = [...this.selectFields];
    clone.insertData = { ...this.insertData };
    clone.updateData = { ...this.updateData };
    clone.whereConditions = [...this.whereConditions];
    clone.joinClauses = [...this.joinClauses];
    clone.groupByFields = [...this.groupByFields];
    clone.havingConditions = [...this.havingConditions];
    clone.orderByFields = [...this.orderByFields];
    clone.limitCount = this.limitCount;
    clone.offsetCount = this.offsetCount;
    clone.parameters = [...this.parameters];
    clone.paramCounter = this.paramCounter;
    
    return clone;
  }
}

module.exports = QueryBuilder;
