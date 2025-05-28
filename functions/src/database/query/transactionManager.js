/**
 * Transaction Manager for Advanced Database Operations
 * Provides comprehensive transaction support with rollback, savepoints, and nested transactions
 */

const connectionManager = require('../connectionManager');
const QueryBuilder = require('../queryBuilder');

/**
 * Transaction class for managing database transactions
 */
class Transaction {
  constructor(connection) {
    this.connection = connection;
    this.savepoints = [];
    this.isActive = false;
    this.queries = [];
    this.startTime = null;
  }

  /**
   * Start the transaction
   */
  async begin() {
    if (this.isActive) {
      throw new Error('Transaction is already active');
    }

    await this.connection.beginTransaction();
    this.isActive = true;
    this.startTime = Date.now();
    console.log('Transaction started');
    return this;
  }

  /**
   * Create a savepoint
   */
  async savepoint(name) {
    if (!this.isActive) {
      throw new Error('No active transaction');
    }

    const savepointName = name || `sp_${Date.now()}`;
    await this.connection.query(`SAVEPOINT ${savepointName}`);
    this.savepoints.push(savepointName);
    console.log(`Savepoint '${savepointName}' created`);
    return savepointName;
  }

  /**
   * Rollback to a savepoint
   */
  async rollbackTo(savepointName) {
    if (!this.isActive) {
      throw new Error('No active transaction');
    }

    if (!this.savepoints.includes(savepointName)) {
      throw new Error(`Savepoint '${savepointName}' not found`);
    }

    await this.connection.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
    
    // Remove savepoints created after this one
    const index = this.savepoints.indexOf(savepointName);
    this.savepoints = this.savepoints.slice(0, index + 1);
    
    console.log(`Rolled back to savepoint '${savepointName}'`);
    return this;
  }

  /**
   * Release a savepoint
   */
  async releaseSavepoint(savepointName) {
    if (!this.isActive) {
      throw new Error('No active transaction');
    }

    if (!this.savepoints.includes(savepointName)) {
      throw new Error(`Savepoint '${savepointName}' not found`);
    }

    await this.connection.query(`RELEASE SAVEPOINT ${savepointName}`);
    this.savepoints = this.savepoints.filter(sp => sp !== savepointName);
    console.log(`Savepoint '${savepointName}' released`);
    return this;
  }

  /**
   * Execute a query within the transaction
   */
  async query(sql, params = []) {
    if (!this.isActive) {
      throw new Error('No active transaction');
    }

    const startTime = Date.now();
    
    try {
      const [results, fields] = await this.connection.execute(sql, params);
      const executionTime = Date.now() - startTime;
      
      this.queries.push({
        sql: sql.substring(0, 100),
        params: params.length > 0 ? '[PARAMS]' : [],
        executionTime,
        success: true,
        timestamp: new Date()
      });

      return { results, fields, executionTime };
    } catch (error) {
      this.queries.push({
        sql: sql.substring(0, 100),
        params: params.length > 0 ? '[PARAMS]' : [],
        executionTime: Date.now() - startTime,
        success: false,
        error: error.message,
        timestamp: new Date()
      });
      throw error;
    }
  }

  /**
   * Execute a QueryBuilder within the transaction
   */
  async executeQuery(queryBuilder) {
    const { sql, params } = queryBuilder.toSQL();
    return await this.query(sql, params);
  }

  /**
   * Commit the transaction
   */
  async commit() {
    if (!this.isActive) {
      throw new Error('No active transaction');
    }

    try {
      await this.connection.commit();
      this.isActive = false;
      const duration = Date.now() - this.startTime;
      console.log(`Transaction committed successfully in ${duration}ms`);
      return this.getTransactionSummary();
    } catch (error) {
      console.error('Transaction commit failed:', error);
      throw error;
    }
  }

  /**
   * Rollback the transaction
   */
  async rollback() {
    if (!this.isActive) {
      throw new Error('No active transaction');
    }

    try {
      await this.connection.rollback();
      this.isActive = false;
      const duration = Date.now() - this.startTime;
      console.log(`Transaction rolled back in ${duration}ms`);
      return this.getTransactionSummary();
    } catch (error) {
      console.error('Transaction rollback failed:', error);
      throw error;
    }
  }

  /**
   * Get transaction summary
   */
  getTransactionSummary() {
    return {
      duration: this.startTime ? Date.now() - this.startTime : 0,
      queryCount: this.queries.length,
      savepointCount: this.savepoints.length,
      queries: this.queries,
      isActive: this.isActive
    };
  }

  /**
   * Execute multiple operations atomically
   */
  async batch(operations) {
    const results = [];
    
    for (const operation of operations) {
      if (typeof operation === 'function') {
        const result = await operation(this);
        results.push(result);
      } else if (operation instanceof QueryBuilder) {
        const result = await this.executeQuery(operation);
        results.push(result);
      } else {
        throw new Error('Invalid operation type');
      }
    }
    
    return results;
  }
}

/**
 * Transaction Manager class
 */
class TransactionManager {
  /**
   * Execute operations within a transaction
   */
  static async run(callback, options = {}) {
    const connection = await connectionManager.getConnection();
    const transaction = new Transaction(connection);
    
    try {
      await transaction.begin();
      
      const result = await callback(transaction);
      
      if (options.autoCommit !== false) {
        await transaction.commit();
      }
      
      return result;
      
    } catch (error) {
      if (transaction.isActive) {
        await transaction.rollback();
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Execute operations with automatic retry on deadlock
   */
  static async runWithRetry(callback, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 100;
    
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.run(callback, options);
      } catch (error) {
        lastError = error;
        
        // Check if it's a deadlock error
        if (error.code === 'ER_LOCK_DEADLOCK' && attempt < maxRetries) {
          console.warn(`Deadlock detected, retrying attempt ${attempt + 1}/${maxRetries}`);
          await this.delay(retryDelay * attempt);
          continue;
        }
        
        throw error;
      }
    }
    
    throw lastError;
  }

  /**
   * Execute operations with distributed transaction support
   */
  static async runDistributed(operations, options = {}) {
    const transactions = [];
    const results = [];
    
    try {
      // Start all transactions
      for (const operation of operations) {
        const connection = await connectionManager.getConnection();
        const transaction = new Transaction(connection);
        await transaction.begin();
        transactions.push({ transaction, connection, operation });
      }
      
      // Execute all operations
      for (const { transaction, operation } of transactions) {
        const result = await operation(transaction);
        results.push(result);
      }
      
      // Commit all transactions (2-phase commit simulation)
      for (const { transaction } of transactions) {
        await transaction.commit();
      }
      
      return results;
      
    } catch (error) {
      // Rollback all transactions
      const rollbackPromises = transactions
        .filter(({ transaction }) => transaction.isActive)
        .map(({ transaction }) => transaction.rollback().catch(console.error));
      
      await Promise.all(rollbackPromises);
      throw error;
      
    } finally {
      // Release all connections
      transactions.forEach(({ connection }) => connection.release());
    }
  }

  /**
   * Create a new transaction manually
   */
  static async create() {
    const connection = await connectionManager.getConnection();
    return new Transaction(connection);
  }

  /**
   * Execute read-only operations (can use read replicas if available)
   */
  static async readOnly(callback) {
    return await this.run(async (transaction) => {
      // Set transaction as read-only
      await transaction.query('SET TRANSACTION READ ONLY');
      return await callback(transaction);
    });
  }

  /**
   * Utility method for delay
   */
  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute operations with timeout
   */
  static async runWithTimeout(callback, timeoutMs = 30000, options = {}) {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Transaction timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        const result = await this.run(callback, options);
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Get current transaction statistics
   */
  static async getTransactionStats() {
    const { results } = await connectionManager.query(`
      SHOW STATUS WHERE Variable_name IN (
        'Com_begin',
        'Com_commit', 
        'Com_rollback',
        'Innodb_row_lock_waits',
        'Innodb_row_lock_time',
        'Innodb_deadlocks'
      )
    `);

    const stats = {};
    results.forEach(row => {
      stats[row.Variable_name.toLowerCase()] = parseInt(row.Value);
    });

    return {
      transactions: {
        began: stats.com_begin || 0,
        committed: stats.com_commit || 0,
        rolledBack: stats.com_rollback || 0
      },
      locks: {
        waits: stats.innodb_row_lock_waits || 0,
        waitTime: stats.innodb_row_lock_time || 0,
        deadlocks: stats.innodb_deadlocks || 0
      }
    };
  }
}

// Export both classes
module.exports = {
  Transaction,
  TransactionManager
};
