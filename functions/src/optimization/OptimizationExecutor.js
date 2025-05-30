/**
 * OptimizationExecutor.js
 * Optimization execution engine module
 * 분할된 모듈: AutoIndexOptimizer.js의 실행 부분
 * 
 * 포함 기능:
 * - 최적화 계획 실행
 * - 개별 액션 실행 (생성/삭제/최적화)
 * - 백업 및 복원 기능
 * - 실행 결과 모니터링
 */

const { executeQuery } = require('../../db');

class OptimizationExecutor {
  constructor(options = {}) {
    this.options = options;
    this.stats = {
      indexesCreated: 0,
      indexesDropped: 0,
      currentPhase: 'idle'
    };
  }

  /**
   * Phase 3: Execute optimization plan
   */
  async executeOptimizationPlan(plan) {
    this.stats.currentPhase = 'executing';
    console.log(`Executing optimization plan with ${plan.actions.length} actions`);
    
    const execution = {
      timestamp: new Date(),
      totalActions: plan.actions.length,
      actionsExecuted: 0,
      actionsSuccessful: 0,
      actionsFailed: 0,
      successful: [],
      failed: [],
      skipped: [],
      executionTime: 0,
      performanceImprovement: 0
    };
    
    const startTime = Date.now();
    
    // Sort actions by priority (high -> medium -> low)
    const sortedActions = plan.actions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
    
    // Execute actions in batches
    for (let i = 0; i < sortedActions.length; i += this.options.maxBatchSize) {
      const batch = sortedActions.slice(i, i + this.options.maxBatchSize);
      
      for (const action of batch) {
        try {
          console.log(`Executing action: ${action.type} - ${action.id}`);
          
          // Create backup if enabled
          if (this.options.backupEnabled) {
            await this.createIndexBackup(action);
          }
          
          // Execute the action
          const result = await this.executeAction(action);
          
          execution.successful.push({
            action: action,
            result: result,
            timestamp: new Date()
          });
          
          execution.actionsExecuted++;
          execution.actionsSuccessful++;
          
          // Update statistics
          if (action.type === 'create_index' || action.type === 'create_composite_index') {
            this.stats.indexesCreated++;
          } else if (action.type === 'drop_index') {
            this.stats.indexesDropped++;
          }
          
        } catch (error) {
          console.log(`Action failed: ${action.id}`, error.message);
          
          execution.failed.push({
            action: action,
            error: error.message,
            timestamp: new Date()
          });
          
          execution.actionsExecuted++;
          execution.actionsFailed++;
        }
      }
      
      // Small delay between batches to avoid overwhelming the database
      if (i + this.options.maxBatchSize < sortedActions.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    execution.executionTime = Date.now() - startTime;
    execution.performanceImprovement = this.calculatePerformanceImprovement(execution);
    
    console.log(`Execution completed: ${execution.actionsSuccessful} successful, ${execution.actionsFailed} failed`);
    return execution;
  }

  /**
   * Execute a single optimization action
   */
  async executeAction(action) {
    switch (action.type) {
      case 'create_index':
        return await this.executeCreateIndex(action);
      
      case 'drop_index':
        return await this.executeDropIndex(action);
      
      case 'create_composite_index':
        return await this.executeCreateCompositeIndex(action);
      
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Execute create index action
   */
  async executeCreateIndex(action) {
    console.log(`Creating index: ${action.indexName} on table ${action.table}`);
    
    try {
      // Validate action before execution
      await this.validateCreateIndexAction(action);
      
      // Execute the CREATE INDEX statement
      await executeQuery(action.sql);
      
      // Verify index was created
      const verification = await this.verifyIndexCreation(action.table, action.indexName);
      
      return {
        success: true,
        indexName: action.indexName,
        table: action.table,
        sql: action.sql,
        verification: verification
      };
      
    } catch (error) {
      throw new Error(`Failed to create index ${action.indexName}: ${error.message}`);
    }
  }

  /**
   * Execute drop index action
   */
  async executeDropIndex(action) {
    console.log(`Dropping index: ${action.indexName} from table ${action.table}`);
    
    try {
      // Validate action before execution
      await this.validateDropIndexAction(action);
      
      // Execute the DROP INDEX statement
      await executeQuery(action.sql);
      
      // Verify index was dropped
      const verification = await this.verifyIndexDeletion(action.table, action.indexName);
      
      return {
        success: true,
        indexName: action.indexName,
        table: action.table,
        sql: action.sql,
        verification: verification
      };
      
    } catch (error) {
      throw new Error(`Failed to drop index ${action.indexName}: ${error.message}`);
    }
  }

  /**
   * Execute create composite index action
   */
  async executeCreateCompositeIndex(action) {
    console.log(`Creating composite index: ${action.indexName} on table ${action.table}`);
    
    try {
      // Validate action before execution
      await this.validateCreateIndexAction(action);
      
      // Create the composite index
      await executeQuery(action.sql);
      
      // Drop replaced indexes if specified
      if (action.replaces && action.replaces.length > 0) {
        for (const indexName of action.replaces) {
          try {
            await executeQuery(`DROP INDEX \`${indexName}\` ON \`${action.table}\``);
            console.log(`Dropped replaced index: ${indexName}`);
          } catch (dropError) {
            console.log(`Warning: Could not drop replaced index ${indexName}: ${dropError.message}`);
          }
        }
      }
      
      // Verify composite index was created
      const verification = await this.verifyIndexCreation(action.table, action.indexName);
      
      return {
        success: true,
        indexName: action.indexName,
        table: action.table,
        sql: action.sql,
        replacedIndexes: action.replaces || [],
        verification: verification
      };
      
    } catch (error) {
      throw new Error(`Failed to create composite index ${action.indexName}: ${error.message}`);
    }
  }

  /**
   * Validate create index action
   */
  async validateCreateIndexAction(action) {
    // Check if table exists
    const tableExists = await this.checkTableExists(action.table);
    if (!tableExists) {
      throw new Error(`Table ${action.table} does not exist`);
    }
    
    // Check if index already exists
    const indexExists = await this.checkIndexExists(action.table, action.indexName);
    if (indexExists) {
      throw new Error(`Index ${action.indexName} already exists on table ${action.table}`);
    }
    
    // Validate columns exist
    if (action.columns && action.columns.length > 0) {
      for (const column of action.columns) {
        const columnExists = await this.checkColumnExists(action.table, column);
        if (!columnExists) {
          throw new Error(`Column ${column} does not exist in table ${action.table}`);
        }
      }
    }
  }

  /**
   * Validate drop index action
   */
  async validateDropIndexAction(action) {
    // Check if table exists
    const tableExists = await this.checkTableExists(action.table);
    if (!tableExists) {
      throw new Error(`Table ${action.table} does not exist`);
    }
    
    // Check if index exists
    const indexExists = await this.checkIndexExists(action.table, action.indexName);
    if (!indexExists) {
      throw new Error(`Index ${action.indexName} does not exist on table ${action.table}`);
    }
    
    // Prevent dropping primary key
    if (action.indexName === 'PRIMARY') {
      throw new Error('Cannot drop PRIMARY key index');
    }
  }

  /**
   * Create backup of index before modification
   */
  async createIndexBackup(action) {
    if (action.type === 'drop_index') {
      try {
        // Get index definition
        const indexDef = await this.getIndexDefinition(action.table, action.indexName);
        
        // Store backup information
        const backup = {
          timestamp: new Date(),
          action: action,
          indexDefinition: indexDef
        };
        
        // In a real implementation, this would be stored in a backup table or file
        console.log(`Backup created for index ${action.indexName}:`, backup);
        
        return backup;
      } catch (error) {
        console.log(`Warning: Could not create backup for index ${action.indexName}: ${error.message}`);
      }
    }
  }

  /**
   * Get index definition for backup
   */
  async getIndexDefinition(tableName, indexName) {
    try {
      const result = await executeQuery(`SHOW CREATE TABLE \`${tableName}\``);
      if (result && result.length > 0) {
        const createTableSQL = result[0]['Create Table'];
        // Extract index definition from CREATE TABLE statement
        // This is a simplified version - in practice, you'd need more sophisticated parsing
        return {
          table: tableName,
          index: indexName,
          createTableSQL: createTableSQL
        };
      }
    } catch (error) {
      throw new Error(`Could not get index definition: ${error.message}`);
    }
  }

  /**
   * Check if table exists
   */
  async checkTableExists(tableName) {
    try {
      const result = await executeQuery(`
        SELECT COUNT(*) as count 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
      `, [tableName]);
      
      return result && result[0] && result[0].count > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if index exists
   */
  async checkIndexExists(tableName, indexName) {
    try {
      const result = await executeQuery(`
        SELECT COUNT(*) as count 
        FROM information_schema.STATISTICS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = ? 
        AND INDEX_NAME = ?
      `, [tableName, indexName]);
      
      return result && result[0] && result[0].count > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if column exists
   */
  async checkColumnExists(tableName, columnName) {
    try {
      const result = await executeQuery(`
        SELECT COUNT(*) as count 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = ? 
        AND COLUMN_NAME = ?
      `, [tableName, columnName]);
      
      return result && result[0] && result[0].count > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verify index creation
   */
  async verifyIndexCreation(tableName, indexName) {
    const exists = await this.checkIndexExists(tableName, indexName);
    return {
      exists: exists,
      verified: exists,
      message: exists ? 'Index created successfully' : 'Index creation could not be verified'
    };
  }

  /**
   * Verify index deletion
   */
  async verifyIndexDeletion(tableName, indexName) {
    const exists = await this.checkIndexExists(tableName, indexName);
    return {
      exists: exists,
      verified: !exists,
      message: !exists ? 'Index dropped successfully' : 'Index deletion could not be verified'
    };
  }

  /**
   * Calculate performance improvement estimate
   */
  calculatePerformanceImprovement(execution) {
    let improvement = 0;
    
    // Base improvement for successful actions
    improvement += execution.actionsSuccessful * 5;
    
    // Bonus for successful index creations
    const createdIndexes = execution.successful.filter(
      s => s.action.type === 'create_index' || s.action.type === 'create_composite_index'
    ).length;
    improvement += createdIndexes * 10;
    
    // Bonus for successful cleanups
    const droppedIndexes = execution.successful.filter(
      s => s.action.type === 'drop_index'
    ).length;
    improvement += droppedIndexes * 3;
    
    // Penalty for failed actions
    improvement -= execution.actionsFailed * 2;
    
    return Math.max(0, improvement);
  }

  /**
   * Cleanup unused indexes (manual operation)
   */
  async cleanupUnusedIndexes(options = {}) {
    console.log('Starting cleanup of unused indexes...');
    
    const dryRun = options.dryRun || false;
    const cleanup = {
      timestamp: new Date(),
      dryRun: dryRun,
      indexesAnalyzed: 0,
      indexesDropped: 0,
      errors: []
    };
    
    try {
      // Get all unused indexes
      const unusedIndexes = await this.findUnusedIndexes();
      cleanup.indexesAnalyzed = unusedIndexes.length;
      
      for (const index of unusedIndexes) {
        if (index.name === 'PRIMARY') continue; // Skip primary keys
        
        try {
          if (!dryRun) {
            await executeQuery(`DROP INDEX \`${index.name}\` ON \`${index.table}\``);
            console.log(`Dropped unused index: ${index.name} on ${index.table}`);
          } else {
            console.log(`Would drop unused index: ${index.name} on ${index.table}`);
          }
          cleanup.indexesDropped++;
        } catch (error) {
          cleanup.errors.push({
            index: index,
            error: error.message
          });
        }
      }
      
      console.log(`Cleanup completed: ${cleanup.indexesDropped} indexes processed`);
      return cleanup;
      
    } catch (error) {
      throw new Error(`Cleanup failed: ${error.message}`);
    }
  }

  /**
   * Find unused indexes
   */
  async findUnusedIndexes() {
    try {
      const result = await executeQuery(`
        SELECT 
          s.TABLE_NAME as table_name,
          s.INDEX_NAME as index_name,
          COALESCE(st.ROWS_EXAMINED, 0) as rows_examined
        FROM information_schema.STATISTICS s
        LEFT JOIN information_schema.INDEX_STATISTICS st 
          ON s.TABLE_SCHEMA = st.TABLE_SCHEMA 
          AND s.TABLE_NAME = st.TABLE_NAME 
          AND s.INDEX_NAME = st.INDEX_NAME
        WHERE s.TABLE_SCHEMA = DATABASE()
        AND s.INDEX_NAME != 'PRIMARY'
        GROUP BY s.TABLE_NAME, s.INDEX_NAME
        HAVING rows_examined = 0
        ORDER BY s.TABLE_NAME, s.INDEX_NAME
      `);
      
      return result.map(row => ({
        table: row.table_name,
        name: row.index_name,
        usage: {
          examined: row.rows_examined
        }
      }));
      
    } catch (error) {
      console.log('Could not find unused indexes (INDEX_STATISTICS not available)');
      return [];
    }
  }
}

module.exports = OptimizationExecutor;
