/**
 * AutoIndexOptimizer.js
 * Advanced automatic index optimization engine
 * Task 3.3: 자동 인덱스 최적화 엔진
 * 
 * Features:
 * - Intelligent query pattern analysis
 * - Duplicate/unused index detection and cleanup
 * - Composite index optimization algorithms
 * - Automatic schema change adaptation
 * - Self-learning optimization strategies
 */

const { executeQuery } = require('../../db');
const IndexRecommendations = require('./IndexRecommendations');
const QueryAnalyzer = require('./QueryAnalyzer');
const AutoIndexOptimizerUtils = require('./AutoIndexOptimizerUtils');

class AutoIndexOptimizer {
  constructor(options = {}) {
    this.options = {
      // Analysis settings
      learningPeriod: options.learningPeriod || 7 * 24 * 60 * 60 * 1000, // 7 days
      optimizationInterval: options.optimizationInterval || 24 * 60 * 60 * 1000, // 24 hours
      confidenceThreshold: options.confidenceThreshold || 80,
      performanceThreshold: options.performanceThreshold || 1000, // ms
      
      // Index management
      maxIndexesPerTable: options.maxIndexesPerTable || 10,
      minUsageThreshold: options.minUsageThreshold || 5, // minimum usage count
      redundancyThreshold: options.redundancyThreshold || 0.8, // 80% similarity
      
      // Safety settings
      autoExecute: options.autoExecute || false, // Manual approval by default
      backupEnabled: options.backupEnabled || true,
      maxBatchSize: options.maxBatchSize || 5, // Max operations per batch
      
      // Monitoring
      enableDetailedLogging: options.enableDetailedLogging || true
    };
    
    // Core components
    this.indexRecommender = new IndexRecommendations();
    this.queryAnalyzer = new QueryAnalyzer();
    
    // Optimization state
    this.optimizationHistory = [];
    this.indexUsageStats = new Map();
    this.schemaSnapshot = null;
    this.isOptimizing = false;
    
    // Learning data
    this.queryPatterns = new Map();
    this.performanceBaseline = new Map();
    this.indexEffectiveness = new Map();
    
    // Statistics
    this.stats = {
      totalOptimizations: 0,
      indexesCreated: 0,
      indexesDropped: 0,
      performanceImprovement: 0,
      lastOptimization: null,
      currentPhase: 'idle'
    };
    
    this.log('AutoIndexOptimizer initialized', this.options);
  }

  /**
   * Main optimization orchestrator
   * Runs the complete optimization cycle
   */
  async runOptimizationCycle() {
    if (this.isOptimizing) {
      throw new Error('Optimization cycle already in progress');
    }
    
    try {
      this.isOptimizing = true;
      this.stats.currentPhase = 'analyzing';
      this.log('Starting optimization cycle');
      
      // Phase 1: Collect and analyze current state
      const analysisResult = await this.performComprehensiveAnalysis();
      
      // Phase 2: Generate optimization plan
      const optimizationPlan = await this.generateOptimizationPlan(analysisResult);
      
      // Phase 3: Execute optimizations (if auto-execute enabled)
      let executionResult = null;
      if (this.options.autoExecute && optimizationPlan.actions.length > 0) {
        executionResult = await this.executeOptimizationPlan(optimizationPlan);
      }
      
      // Phase 4: Update learning data
      await this.updateLearningData(analysisResult, optimizationPlan, executionResult);
      
      // Phase 5: Generate report
      const report = this.generateOptimizationReport(analysisResult, optimizationPlan, executionResult);
      
      this.stats.lastOptimization = new Date();
      this.stats.totalOptimizations++;
      this.stats.currentPhase = 'idle';
      
      this.log('Optimization cycle completed successfully');
      return report;
      
    } catch (error) {
      this.stats.currentPhase = 'error';
      this.log('Optimization cycle failed:', error.message);
      throw error;
      
    } finally {
      this.isOptimizing = false;
    }
  }

  /**
   * Phase 1: Comprehensive database analysis
   */
  async performComprehensiveAnalysis() {
    this.log('Performing comprehensive analysis...');
    
    const analysis = {
      timestamp: new Date(),
      database: {},
      indexes: {},
      queries: {},
      performance: {},
      recommendations: []
    };
    
    // Analyze database schema
    analysis.database = await this.analyzeDatabaseSchema();
    
    // Analyze existing indexes
    analysis.indexes = await this.analyzeExistingIndexes();
    
    // Analyze query patterns
    analysis.queries = await this.analyzeQueryPatterns();
    
    // Analyze performance metrics
    analysis.performance = await this.analyzePerformanceMetrics();
    
    // Generate initial recommendations
    analysis.recommendations = await this.generateIntelligentRecommendations(analysis);
    
    this.log(`Analysis completed: ${analysis.recommendations.length} recommendations generated`);
    return analysis;
  }

  /**
   * Analyze current database schema
   */
  async analyzeDatabaseSchema() {
    try {
      const tables = await executeQuery(`
        SELECT 
          TABLE_NAME,
          TABLE_ROWS,
          DATA_LENGTH,
          INDEX_LENGTH,
          AUTO_INCREMENT,
          CREATE_TIME,
          UPDATE_TIME
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY DATA_LENGTH DESC
      `);
      
      const schema = {
        tables: {},
        totalTables: tables.length,
        totalRows: 0,
        totalDataSize: 0,
        totalIndexSize: 0
      };
      
      for (const table of tables) {
        schema.tables[table.TABLE_NAME] = {
          name: table.TABLE_NAME,
          rows: table.TABLE_ROWS || 0,
          dataSize: table.DATA_LENGTH || 0,
          indexSize: table.INDEX_LENGTH || 0,
          autoIncrement: table.AUTO_INCREMENT,
          created: table.CREATE_TIME,
          updated: table.UPDATE_TIME,
          columns: await this.getTableColumns(table.TABLE_NAME)
        };
        
        schema.totalRows += (table.TABLE_ROWS || 0);
        schema.totalDataSize += (table.DATA_LENGTH || 0);
        schema.totalIndexSize += (table.INDEX_LENGTH || 0);
      }
      
      // Detect schema changes
      if (this.schemaSnapshot) {
        schema.changes = this.detectSchemaChanges(this.schemaSnapshot, schema);
      }
      
      this.schemaSnapshot = schema;
      return schema;
      
    } catch (error) {
      this.log('Error analyzing database schema:', error.message);
      throw error;
    }
  }

  /**
   * Get detailed column information for a table
   */
  async getTableColumns(tableName) {
    try {
      const columns = await executeQuery(`
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          COLUMN_KEY,
          COLUMN_DEFAULT,
          EXTRA,
          COLUMN_COMMENT
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `, [tableName]);
      
      return columns.map(col => ({
        name: col.COLUMN_NAME,
        type: col.DATA_TYPE,
        nullable: col.IS_NULLABLE === 'YES',
        key: col.COLUMN_KEY,
        default: col.COLUMN_DEFAULT,
        extra: col.EXTRA,
        comment: col.COLUMN_COMMENT
      }));
      
    } catch (error) {
      this.log(`Error getting columns for table ${tableName}:`, error.message);
      return [];
    }
  }

  /**
   * Analyze existing indexes comprehensively
   */
  async analyzeExistingIndexes() {
    try {
      const indexes = await executeQuery(`
        SELECT 
          s.TABLE_NAME,
          s.INDEX_NAME,
          s.COLUMN_NAME,
          s.SEQ_IN_INDEX,
          s.NON_UNIQUE,
          s.CARDINALITY,
          st.INDEX_LENGTH,
          st.ROWS_EXAMINED,
          st.ROWS_READ
        FROM information_schema.STATISTICS s
        LEFT JOIN information_schema.INDEX_STATISTICS st 
          ON s.TABLE_SCHEMA = st.TABLE_SCHEMA 
          AND s.TABLE_NAME = st.TABLE_NAME 
          AND s.INDEX_NAME = st.INDEX_NAME
        WHERE s.TABLE_SCHEMA = DATABASE()
        ORDER BY s.TABLE_NAME, s.INDEX_NAME, s.SEQ_IN_INDEX
      `);
      
      const indexAnalysis = {
        byTable: {},
        duplicates: [],
        unused: [],
        inefficient: [],
        totalIndexes: 0,
        totalSize: 0
      };
      
      // Group indexes by table and name
      const indexGroups = new Map();
      
      for (const idx of indexes) {
        const key = `${idx.TABLE_NAME}.${idx.INDEX_NAME}`;
        if (!indexGroups.has(key)) {
          indexGroups.set(key, {
            table: idx.TABLE_NAME,
            name: idx.INDEX_NAME,
            columns: [],
            unique: idx.NON_UNIQUE === 0,
            size: idx.INDEX_LENGTH || 0,
            usage: {
              examined: idx.ROWS_EXAMINED || 0,
              read: idx.ROWS_READ || 0
            }
          });
        }
        
        indexGroups.get(key).columns.push({
          name: idx.COLUMN_NAME,
          position: idx.SEQ_IN_INDEX,
          cardinality: idx.CARDINALITY
        });
      }
      
      // Analyze each index
      for (const [key, index] of indexGroups) {
        if (!indexAnalysis.byTable[index.table]) {
          indexAnalysis.byTable[index.table] = [];
        }
        
        // Sort columns by position
        index.columns.sort((a, b) => a.position - b.position);
        
        // Calculate effectiveness score
        index.effectiveness = this.calculateIndexEffectiveness(index);
        
        indexAnalysis.byTable[index.table].push(index);
        indexAnalysis.totalIndexes++;
        indexAnalysis.totalSize += index.size;
      }
      
      // Find duplicates and inefficient indexes
      indexAnalysis.duplicates = this.findDuplicateIndexes(indexAnalysis.byTable);
      indexAnalysis.unused = this.findUnusedIndexes(indexAnalysis.byTable);
      indexAnalysis.inefficient = this.findInefficientIndexes(indexAnalysis.byTable);
      
      return indexAnalysis;
      
    } catch (error) {
      this.log('Error analyzing existing indexes:', error.message);
      throw error;
    }
  }

  /**
   * Calculate index effectiveness score (0-100)
   */
  calculateIndexEffectiveness(index) {
    let score = 50; // Base score
    
    // Factor 1: Usage statistics
    if (index.usage.examined > 0) {
      score += 20;
      if (index.usage.examined > 100) score += 10;
      if (index.usage.examined > 1000) score += 10;
    } else {
      score -= 30; // Unused index
    }
    
    // Factor 2: Cardinality
    const avgCardinality = index.columns.reduce((sum, col) => sum + (col.cardinality || 0), 0) / index.columns.length;
    if (avgCardinality > 1000) score += 15;
    else if (avgCardinality > 100) score += 10;
    else if (avgCardinality < 10) score -= 15;
    
    // Factor 3: Column count (composite indexes)
    if (index.columns.length > 1) {
      score += 5; // Composite indexes are often more valuable
      if (index.columns.length > 3) score -= 5; // But too many columns can be inefficient
    }
    
    // Factor 4: Uniqueness
    if (index.unique) score += 10;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Phase 2: Generate comprehensive optimization plan
   */
  async generateOptimizationPlan(analysis) {
    this.log('Generating optimization plan...');
    
    const plan = {
      timestamp: new Date(),
      priority: 'medium',
      estimatedImpact: 0,
      actions: [],
      risks: [],
      prerequisites: []
    };
    
    // Action 1: Create recommended indexes
    const createActions = await this.generateCreateIndexActions(analysis);
    plan.actions.push(...createActions);
    
    // Action 2: Drop duplicate/unused indexes
    const dropActions = await this.generateDropIndexActions(analysis);
    plan.actions.push(...dropActions);
    
    // Action 3: Optimize composite indexes
    const optimizeActions = await this.generateOptimizeIndexActions(analysis);
    plan.actions.push(...optimizeActions);
    
    // Calculate overall priority and impact
    plan.priority = this.calculatePlanPriority(plan.actions);
    plan.estimatedImpact = this.estimatePerformanceImpact(plan.actions);
    plan.risks = this.assessOptimizationRisks(plan.actions);
    
    this.log(`Optimization plan generated: ${plan.actions.length} actions, priority: ${plan.priority}`);
    return plan;
  }

  /**
   * Generate actions to create new indexes
   */
  async generateCreateIndexActions(analysis) {
    const actions = [];
    
    for (const recommendation of analysis.recommendations) {
      if (recommendation.type === 'create' && recommendation.confidence >= this.options.confidenceThreshold) {
        actions.push({
          id: `create_${recommendation.table}_${recommendation.columns.join('_')}`,
          type: 'create_index',
          priority: recommendation.priority,
          table: recommendation.table,
          indexName: recommendation.indexName,
          columns: recommendation.columns,
          unique: recommendation.unique || false,
          estimatedImpact: recommendation.impact,
          sql: recommendation.sql,
          reasoning: recommendation.reasoning
        });
      }
    }
    
    return actions;
  }

  /**
   * Generate actions to drop indexes
   */
  async generateDropIndexActions(analysis) {
    const actions = [];
    
    // Drop duplicate indexes
    for (const duplicate of analysis.indexes.duplicates) {
      actions.push({
        id: `drop_duplicate_${duplicate.table}_${duplicate.name}`,
        type: 'drop_index',
        priority: 'high',
        table: duplicate.table,
        indexName: duplicate.name,
        reason: 'duplicate',
        duplicateOf: duplicate.duplicateOf,
        estimatedImpact: 10,
        sql: `DROP INDEX ${duplicate.name} ON ${duplicate.table}`,
        reasoning: `Index is duplicate of ${duplicate.duplicateOf}`
      });
    }
    
    // Drop unused indexes
    for (const unused of analysis.indexes.unused) {
      if (unused.name !== 'PRIMARY') { // Never drop primary keys
        actions.push({
          id: `drop_unused_${unused.table}_${unused.name}`,
          type: 'drop_index',
          priority: 'medium',
          table: unused.table,
          indexName: unused.name,
          reason: 'unused',
          estimatedImpact: 5,
          sql: `DROP INDEX ${unused.name} ON ${unused.table}`,
          reasoning: `Index has not been used in the tracking period`
        });
      }
    }
    
    return actions;
  }

  /**
   * Generate actions to optimize composite indexes
   */
  async generateOptimizeIndexActions(analysis) {
    const actions = [];
    
    // Find opportunities to combine single-column indexes into composite indexes
    for (const [tableName, indexes] of Object.entries(analysis.indexes.byTable)) {
      const singleColumnIndexes = indexes.filter(idx => 
        idx.columns.length === 1 && 
        idx.name !== 'PRIMARY' &&
        idx.effectiveness < 50
      );
      
      if (singleColumnIndexes.length >= 2) {
        // Analyze if these can be combined based on query patterns
        const compositeOpportunity = await this.analyzeCompositeOpportunity(tableName, singleColumnIndexes);
        
        if (compositeOpportunity.viable) {
          actions.push({
            id: `optimize_composite_${tableName}_${compositeOpportunity.columns.join('_')}`,
            type: 'optimize_composite',
            priority: 'medium',
            table: tableName,
            indexName: compositeOpportunity.indexName,
            columns: compositeOpportunity.columns,
            dropIndexes: compositeOpportunity.indexesToDrop,
            estimatedImpact: compositeOpportunity.impact,
            sql: compositeOpportunity.sql,
            reasoning: compositeOpportunity.reasoning
          });
        }
      }
    }
    
    return actions;
  }

  /**
   * Phase 3: Execute optimization plan
   */
  async executeOptimizationPlan(plan) {
    this.stats.currentPhase = 'executing';
    this.log(`Executing optimization plan with ${plan.actions.length} actions`);
    
    const execution = {
      timestamp: new Date(),
      totalActions: plan.actions.length,
      successful: [],
      failed: [],
      skipped: []
    };
    
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
          this.log(`Executing action: ${action.type} - ${action.id}`);
          
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
          
          // Update statistics
          if (action.type === 'create_index') {
            this.stats.indexesCreated++;
          } else if (action.type === 'drop_index') {
            this.stats.indexesDropped++;
          }
          
        } catch (error) {
          this.log(`Action failed: ${action.id}`, error.message);
          
          execution.failed.push({
            action: action,
            error: error.message,
            timestamp: new Date()
          });
        }
      }
      
      // Small delay between batches to avoid overwhelming the database
      if (i + this.options.maxBatchSize < sortedActions.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    this.log(`Execution completed: ${execution.successful.length} successful, ${execution.failed.length} failed`);
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
      
      case 'optimize_composite':
        return await this.executeOptimizeComposite(action);
      
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Execute create index action
   */
  async executeCreateIndex(action) {
    const startTime = Date.now();
    
    try {
      await executeQuery(action.sql);
      
      const duration = Date.now() - startTime;
      this.log(`Created index ${action.indexName} on ${action.table} (${duration}ms)`);
      
      return {
        success: true,
        duration: duration,
        indexName: action.indexName,
        table: action.table
      };
      
    } catch (error) {
      if (error.message.includes('Duplicate key name')) {
        this.log(`Index ${action.indexName} already exists, skipping`);
        return {
          success: true,
          skipped: true,
          reason: 'already_exists'
        };
      }
      throw error;
    }
  }

  /**
   * Execute drop index action
   */
  async executeDropIndex(action) {
    const startTime = Date.now();
    
    try {
      await executeQuery(action.sql);
      
      const duration = Date.now() - startTime;
      this.log(`Dropped index ${action.indexName} from ${action.table} (${duration}ms)`);
      
      return {
        success: true,
        duration: duration,
        indexName: action.indexName,
        table: action.table
      };
      
    } catch (error) {
      if (error.message.includes("Can't DROP")) {
        this.log(`Index ${action.indexName} doesn't exist, skipping`);
        return {
          success: true,
          skipped: true,
          reason: 'not_exists'
        };
      }
      throw error;
    }
  }

  /**
   * Utility method: Find duplicate indexes
   */
  findDuplicateIndexes(indexesByTable) {
    const duplicates = [];
    
    for (const [tableName, indexes] of Object.entries(indexesByTable)) {
      for (let i = 0; i < indexes.length; i++) {
        for (let j = i + 1; j < indexes.length; j++) {
          const idx1 = indexes[i];
          const idx2 = indexes[j];
          
          if (this.areIndexesSimilar(idx1, idx2)) {
            duplicates.push({
              table: tableName,
              name: idx2.name, // Usually drop the second one
              duplicateOf: idx1.name,
              similarity: this.calculateIndexSimilarity(idx1, idx2)
            });
          }
        }
      }
    }
    
    return duplicates;
  }

  /**
   * Check if two indexes are similar enough to be considered duplicates
   */
  areIndexesSimilar(idx1, idx2) {
    if (idx1.name === 'PRIMARY' || idx2.name === 'PRIMARY') {
      return false; // Never consider PRIMARY key as duplicate
    }
    
    const similarity = this.calculateIndexSimilarity(idx1, idx2);
    return similarity >= this.options.redundancyThreshold;
  }

  /**
   * Calculate similarity between two indexes (0-1)
   */
  calculateIndexSimilarity(idx1, idx2) {
    const cols1 = idx1.columns.map(c => c.name).sort();
    const cols2 = idx2.columns.map(c => c.name).sort();
    
    // If one index is a prefix of another
    const minLength = Math.min(cols1.length, cols2.length);
    const maxLength = Math.max(cols1.length, cols2.length);
    
    let matchingColumns = 0;
    for (let i = 0; i < minLength; i++) {
      if (cols1[i] === cols2[i]) {
        matchingColumns++;
      } else {
        break; // Order matters in indexes
      }
    }
    
    return matchingColumns / maxLength;
  }

  /**
   * Find unused indexes
   */
  findUnusedIndexes(indexesByTable) {
    const unused = [];
    
    for (const [tableName, indexes] of Object.entries(indexesByTable)) {
      for (const index of indexes) {
        if (index.name !== 'PRIMARY' && 
            index.usage.examined === 0 && 
            index.effectiveness < 30) {
          unused.push({
            table: tableName,
            name: index.name,
            size: index.size,
            effectiveness: index.effectiveness
          });
        }
      }
    }
    
    return unused;
  }

  /**
   * Find inefficient indexes
   */
  findInefficientIndexes(indexesByTable) {
    const inefficient = [];
    
    for (const [tableName, indexes] of Object.entries(indexesByTable)) {
      for (const index of indexes) {
        if (index.name !== 'PRIMARY' && index.effectiveness < 40) {
          inefficient.push({
            table: tableName,
            name: index.name,
            effectiveness: index.effectiveness,
            issues: this.identifyIndexIssues(index)
          });
        }
      }
    }
    
    return inefficient;
  }

  /**
   * Identify specific issues with an index
   */
  identifyIndexIssues(index) {
    const issues = [];
    
    if (index.usage.examined === 0) {
      issues.push('unused');
    }
    
    const avgCardinality = index.columns.reduce((sum, col) => sum + (col.cardinality || 0), 0) / index.columns.length;
    if (avgCardinality < 10) {
      issues.push('low_cardinality');
    }
    
    if (index.columns.length > 4) {
      issues.push('too_many_columns');
    }
    
    if (index.size > 100 * 1024 * 1024) { // 100MB
      issues.push('large_size');
    }
    
    return issues;
  }

  /**
   * Utility: Logging
   */
  log(message, ...args) {
    if (this.options.enableDetailedLogging) {
      const timestamp = new Date().toISOString();
      console.log(`[AutoIndexOptimizer ${timestamp}] ${message}`, ...args);
    }
  }

  /**
   * Get current optimization status
   */
  getStatus() {
    return {
      isOptimizing: this.isOptimizing,
      stats: { ...this.stats },
      options: { ...this.options },
      lastOptimization: this.stats.lastOptimization,
      nextOptimization: this.stats.lastOptimization ? 
        new Date(this.stats.lastOptimization.getTime() + this.options.optimizationInterval) : 
        null
    };
  }

  /**
   * Manual trigger for optimization cycle
   */
  async optimize() {
    return await this.runOptimizationCycle();
  }

  /**
   * Analyze query patterns from logs and performance data
   */
  async analyzeQueryPatterns() {
    return await AutoIndexOptimizerUtils.analyzeQueryPatterns();
  }

  /**
   * Analyze performance metrics
   */
  async analyzePerformanceMetrics() {
    return await AutoIndexOptimizerUtils.analyzePerformanceMetrics();
  }

  /**
   * Generate intelligent recommendations based on analysis
   */
  async generateIntelligentRecommendations(analysis) {
    return await AutoIndexOptimizerUtils.generateIntelligentRecommendations(analysis);
  }

  /**
   * Detect schema changes between snapshots
   */
  detectSchemaChanges(oldSchema, newSchema) {
    return AutoIndexOptimizerUtils.detectSchemaChanges(oldSchema, newSchema);
  }

  /**
   * Analyze composite index opportunity
   */
  async analyzeCompositeOpportunity(tableName, singleColumnIndexes) {
    return await AutoIndexOptimizerUtils.analyzeCompositeOpportunity(tableName, singleColumnIndexes);
  }

  /**
   * Calculate plan priority based on actions
   */
  calculatePlanPriority(actions) {
    return AutoIndexOptimizerUtils.calculatePlanPriority(actions);
  }

  /**
   * Estimate performance impact of optimization plan
   */
  estimatePerformanceImpact(actions) {
    return AutoIndexOptimizerUtils.estimatePerformanceImpact(actions);
  }

  /**
   * Assess optimization risks
   */
  assessOptimizationRisks(actions) {
    return AutoIndexOptimizerUtils.assessOptimizationRisks(actions);
  }

  /**
   * Create backup of index structure before optimization
   */
  async createIndexBackup(action) {
    return await AutoIndexOptimizerUtils.createIndexBackup(action);
  }

  /**
   * Execute composite index optimization
   */
  async executeOptimizeComposite(action) {
    const startTime = Date.now();
    const results = [];
    
    try {
      // Step 1: Create the composite index
      await executeQuery(action.sql);
      results.push({
        operation: 'create_composite',
        indexName: action.indexName,
        success: true
      });
      
      this.log(`Created composite index ${action.indexName} on ${action.table}`);
      
      // Step 2: Drop the old single-column indexes
      for (const indexName of action.dropIndexes) {
        try {
          await executeQuery(`DROP INDEX ${indexName} ON ${action.table}`);
          results.push({
            operation: 'drop_old_index',
            indexName: indexName,
            success: true
          });
          
          this.log(`Dropped old index ${indexName} from ${action.table}`);
          
        } catch (dropError) {
          this.log(`Warning: Could not drop index ${indexName}:`, dropError.message);
          results.push({
            operation: 'drop_old_index',
            indexName: indexName,
            success: false,
            error: dropError.message
          });
        }
      }
      
      const duration = Date.now() - startTime;
      return {
        success: true,
        duration: duration,
        operations: results,
        compositeName: action.indexName,
        droppedIndexes: action.dropIndexes
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log(`Failed to create composite index ${action.indexName}:`, error.message);
      
      return {
        success: false,
        duration: duration,
        error: error.message,
        operations: results
      };
    }
  }

  /**
   * Update learning data after optimization
   */
  async updateLearningData(analysis, plan, executionResult) {
    try {
      const learningData = {
        timestamp: new Date(),
        analysis: {
          tablesAnalyzed: Object.keys(analysis.database.tables).length,
          indexesAnalyzed: analysis.indexes.totalIndexes,
          recommendationsGenerated: analysis.recommendations.length
        },
        plan: {
          actionsPlanned: plan.actions.length,
          estimatedImpact: plan.estimatedImpact,
          priority: plan.priority
        },
        execution: executionResult ? {
          actionsExecuted: executionResult.successful.length,
          actionsFailed: executionResult.failed.length,
          totalDuration: executionResult.successful.reduce((sum, action) => 
            sum + (action.result.duration || 0), 0)
        } : null
      };
      
      // Update performance baseline
      for (const [table, tableInfo] of Object.entries(analysis.database.tables)) {
        this.performanceBaseline.set(table, {
          rows: tableInfo.rows,
          dataSize: tableInfo.dataSize,
          indexSize: tableInfo.indexSize,
          timestamp: new Date()
        });
      }
      
      // Update index effectiveness tracking
      for (const [tableName, indexes] of Object.entries(analysis.indexes.byTable)) {
        for (const index of indexes) {
          this.indexEffectiveness.set(`${tableName}.${index.name}`, {
            effectiveness: index.effectiveness,
            usage: index.usage,
            size: index.size,
            timestamp: new Date()
          });
        }
      }
      
      // Store learning data for future reference
      this.optimizationHistory.push(learningData);
      
      // Keep only last 50 optimization records
      if (this.optimizationHistory.length > 50) {
        this.optimizationHistory = this.optimizationHistory.slice(-50);
      }
      
      this.log('Learning data updated successfully');
      
    } catch (error) {
      this.log('Error updating learning data:', error.message);
    }
  }

  /**
   * Generate comprehensive optimization report
   */
  generateOptimizationReport(analysis, plan, executionResult) {
    return AutoIndexOptimizerUtils.generateOptimizationReport(analysis, plan, executionResult);
  }

  /**
   * Get comprehensive status including learning data
   */
  getDetailedStatus() {
    return {
      ...this.getStatus(),
      learningData: {
        optimizationHistory: this.optimizationHistory.length,
        performanceBaseline: this.performanceBaseline.size,
        indexEffectiveness: this.indexEffectiveness.size,
        queryPatterns: this.queryPatterns.size
      },
      recentOptimizations: this.optimizationHistory.slice(-5).map(opt => ({
        timestamp: opt.timestamp,
        tablesAnalyzed: opt.analysis.tablesAnalyzed,
        actionsPlanned: opt.plan.actionsPlanned,
        actionsExecuted: opt.execution ? opt.execution.actionsExecuted : 0,
        priority: opt.plan.priority
      }))
    };
  }

  /**
   * Reset learning data (use with caution)
   */
  resetLearningData() {
    this.optimizationHistory = [];
    this.indexUsageStats.clear();
    this.queryPatterns.clear();
    this.performanceBaseline.clear();
    this.indexEffectiveness.clear();
    this.schemaSnapshot = null;
    
    this.stats = {
      totalOptimizations: 0,
      indexesCreated: 0,
      indexesDropped: 0,
      performanceImprovement: 0,
      lastOptimization: null,
      currentPhase: 'idle'
    };
    
    this.log('Learning data reset successfully');
  }
}

module.exports = AutoIndexOptimizer;
