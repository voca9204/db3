/**
 * Database Query System - Main Entry Point
 * Flexible Query Builder Framework with comprehensive database operations support
 * 
 * @author DB3 Project Team
 * @version 1.0.0
 */

// Core components
const QueryBuilder = require('./queryBuilder');
const connectionManager = require('./connectionManager');
const config = require('./config');

// Query components
const QueryTemplates = require('./query/templates');
const { Transaction, TransactionManager } = require('./query/transactionManager');
const { 
  SqlUtils, 
  QueryValidator, 
  QueryOptimizer, 
  QueryPerformanceMonitor,
  performanceMonitor 
} = require('./query/utils');

/**
 * Database class - Main interface for database operations
 */
class Database {
  constructor() {
    this.connection = connectionManager;
    this.config = config;
    this.monitor = performanceMonitor;
  }

  /**
   * Initialize database connection
   */
  async initialize() {
    await this.connection.initialize();
    console.log('Database system initialized successfully');
    return this;
  }

  /**
   * Get a new QueryBuilder instance
   */
  table(tableName) {
    return QueryBuilder.table(tableName);
  }

  /**
   * Create a raw query
   */
  raw(sql, params = []) {
    return QueryBuilder.raw(sql, params);
  }

  /**
   * Execute a raw query directly
   */
  async query(sql, params = []) {
    const startTime = Date.now();
    
    try {
      const result = await this.connection.query(sql, params);
      const executionTime = result.executionTime || (Date.now() - startTime);
      
      // Record performance metrics
      this.monitor.recordExecution(sql, executionTime, true);
      
      return result;
    } catch (error) {
      this.monitor.recordExecution(sql, Date.now() - startTime, false);
      throw error;
    }
  }

  /**
   * Start a transaction
   */
  async transaction(callback) {
    return await TransactionManager.run(callback);
  }

  /**
   * Start a transaction with retry on deadlock
   */
  async transactionWithRetry(callback, options = {}) {
    return await TransactionManager.runWithRetry(callback, options);
  }

  /**
   * Execute read-only operations
   */
  async readOnly(callback) {
    return await TransactionManager.readOnly(callback);
  }

  /**
   * Get database statistics
   */
  async getStats() {
    const connectionStats = this.connection.getStats();
    const transactionStats = await TransactionManager.getTransactionStats();
    const performanceStats = this.monitor.getStats();

    return {
      connection: connectionStats,
      transactions: transactionStats,
      performance: performanceStats,
      timestamp: new Date()
    };
  }

  /**
   * Test database connection
   */
  async test() {
    return await this.connection.testConnection();
  }

  /**
   * Close database connections
   */
  async close() {
    await this.connection.close();
    console.log('Database connections closed');
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return this.config.getConfig();
  }

  /**
   * Access to templates for common operations
   */
  get templates() {
    return QueryTemplates;
  }

  /**
   * Access to utilities
   */
  get utils() {
    return {
      SqlUtils,
      QueryValidator,
      QueryOptimizer
    };
  }
}

/**
 * Model Base Class for ORM-like functionality
 */
class Model {
  constructor(tableName, primaryKey = 'id') {
    this.tableName = tableName;
    this.primaryKey = primaryKey;
    this.db = new Database();
  }

  /**
   * Find record by primary key
   */
  async find(id) {
    return await QueryTemplates.findById(this.tableName, id).first();
  }

  /**
   * Find multiple records by primary keys
   */
  async findMany(ids) {
    return await QueryTemplates.findByIds(this.tableName, ids).get();
  }

  /**
   * Find record by field
   */
  async findBy(field, value) {
    return await QueryTemplates.findBy(this.tableName, field, value).first();
  }

  /**
   * Get all records
   */
  async all() {
    return await QueryBuilder.table(this.tableName).get();
  }

  /**
   * Create new record
   */
  async create(data) {
    return await QueryTemplates.create(this.tableName, data).execute();
  }

  /**
   * Update record by primary key
   */
  async update(id, data) {
    return await QueryTemplates.updateById(this.tableName, id, data).execute();
  }

  /**
   * Delete record by primary key
   */
  async delete(id) {
    return await QueryBuilder.table(this.tableName)
      .delete()
      .where(this.primaryKey, id)
      .execute();
  }

  /**
   * Soft delete record
   */
  async softDelete(id) {
    return await QueryTemplates.softDelete(this.tableName, id).execute();
  }

  /**
   * Paginate records
   */
  async paginate(page = 1, limit = 10, searchField = null, searchValue = null) {
    const results = await QueryTemplates.paginate(
      this.tableName, 
      page, 
      limit, 
      searchField, 
      searchValue
    ).get();

    const total = await QueryTemplates.countRecords(
      this.tableName,
      searchField,
      searchValue
    );

    return {
      data: results,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get query builder for this model
   */
  query() {
    return QueryBuilder.table(this.tableName);
  }
}

// Create singleton database instance
const db = new Database();

// Export everything
module.exports = {
  // Main interfaces
  Database,
  Model,
  db,

  // Core components
  QueryBuilder,
  connectionManager,
  config,

  // Query components
  QueryTemplates,
  Transaction,
  TransactionManager,

  // Utilities
  SqlUtils,
  QueryValidator,
  QueryOptimizer,
  QueryPerformanceMonitor,
  performanceMonitor,

  // Convenience exports
  table: (tableName) => QueryBuilder.table(tableName),
  raw: (sql, params) => QueryBuilder.raw(sql, params),
  transaction: (callback) => TransactionManager.run(callback)
};
