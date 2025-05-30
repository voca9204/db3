/**
 * IndexAnalyzer.js
 * Database schema and index analysis module
 * 분할된 모듈: AutoIndexOptimizer.js의 분석 부분
 * 
 * 포함 기능:
 * - 데이터베이스 스키마 분석
 * - 기존 인덱스 분석 및 효율성 측정
 * - 쿼리 패턴 분석
 * - 성능 메트릭 분석
 */

const { executeQuery } = require('../../db');

class IndexAnalyzer {
  constructor(options = {}) {
    this.options = options;
    this.schemaSnapshot = null;
  }

  /**
   * Phase 1: Comprehensive database analysis
   */
  async performComprehensiveAnalysis() {
    console.log('Performing comprehensive analysis...');
    
    const analysis = {
      timestamp: new Date(),
      schema: {},
      indexes: {},
      queries: {},
      performance: {},
      recommendations: []
    };
    
    // Analyze database schema
    analysis.schema = await this.analyzeDatabaseSchema();
    
    // Analyze existing indexes
    analysis.indexes = await this.analyzeExistingIndexes();
    
    // Analyze query patterns
    analysis.queries = await this.analyzeQueryPatterns();
    
    // Analyze performance metrics
    analysis.performance = await this.analyzePerformanceMetrics();
    
    // Generate initial recommendations
    analysis.recommendations = await this.generateIntelligentRecommendations(analysis);
    
    console.log(`Analysis completed: ${analysis.recommendations.length} recommendations generated`);
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
      console.log('Error analyzing database schema:', error.message);
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
      console.log(`Error getting columns for table ${tableName}:`, error.message);
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
        all: [],
        byTable: {},
        duplicates: [],
        unused: [],
        inefficient: [],
        totalSize: 0
      };
      
      // Group indexes by table and index name
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
          cardinality: idx.CARDINALITY || 0
        });
      }
      
      // Process grouped indexes
      for (const [key, index] of indexGroups) {
        if (!indexAnalysis.byTable[index.table]) {
          indexAnalysis.byTable[index.table] = [];
        }
        
        // Sort columns by position
        index.columns.sort((a, b) => a.position - b.position);
        
        // Calculate effectiveness score
        index.effectiveness = this.calculateIndexEffectiveness(index);
        
        indexAnalysis.all.push(index);
        indexAnalysis.byTable[index.table].push(index);
        indexAnalysis.totalSize += index.size;
        
        // Detect unused indexes
        if (index.usage.examined === 0 && index.name !== 'PRIMARY') {
          indexAnalysis.unused.push(index);
        }
        
        // Detect inefficient indexes
        if (index.effectiveness < 30) {
          indexAnalysis.inefficient.push(index);
        }
      }
      
      // Detect duplicate indexes
      indexAnalysis.duplicates = this.findDuplicateIndexes(indexAnalysis.all);
      
      return indexAnalysis;
      
    } catch (error) {
      console.log('Error analyzing existing indexes:', error.message);
      throw error;
    }
  }

  /**
   * Calculate index effectiveness score (0-100)
   */
  calculateIndexEffectiveness(index) {
    let score = 0;
    
    // Usage-based scoring
    if (index.usage.examined > 0) {
      score += Math.min(30, Math.log10(index.usage.examined) * 10);
      if (index.usage.examined > 100) score += 10;
      if (index.usage.examined > 1000) score += 10;
    }
    
    // Cardinality-based scoring
    const avgCardinality = index.columns.reduce((sum, col) => sum + col.cardinality, 0) / index.columns.length;
    if (avgCardinality > 1000) score += 15;
    if (avgCardinality > 10000) score += 10;
    
    // Column count scoring
    if (index.columns.length > 1) {
      score += 5; // Composite indexes can be more effective
      if (index.columns.length > 3) score -= 5; // But too many columns can be inefficient
    }
    
    // Uniqueness bonus
    if (index.unique) score += 10;
    
    return Math.min(100, Math.max(0, score));
  }

  /**
   * Find duplicate or redundant indexes
   */
  findDuplicateIndexes(indexes) {
    const duplicates = [];
    
    for (let i = 0; i < indexes.length; i++) {
      for (let j = i + 1; j < indexes.length; j++) {
        const idx1 = indexes[i];
        const idx2 = indexes[j];
        
        if (idx1.table === idx2.table) {
          const similarity = this.calculateIndexSimilarity(idx1, idx2);
          if (similarity > this.options.redundancyThreshold) {
            duplicates.push({
              index1: idx1,
              index2: idx2,
              similarity: similarity,
              recommendation: this.getDuplicateRecommendation(idx1, idx2)
            });
          }
        }
      }
    }
    
    return duplicates;
  }

  /**
   * Calculate similarity between two indexes (0-1)
   */
  calculateIndexSimilarity(idx1, idx2) {
    const cols1 = idx1.columns.map(c => c.name);
    const cols2 = idx2.columns.map(c => c.name);
    
    // Check for prefix match
    const minLength = Math.min(cols1.length, cols2.length);
    let matchingPrefix = 0;
    
    for (let i = 0; i < minLength; i++) {
      if (cols1[i] === cols2[i]) {
        matchingPrefix++;
      } else {
        break;
      }
    }
    
    return matchingPrefix / Math.max(cols1.length, cols2.length);
  }

  /**
   * Get recommendation for duplicate indexes
   */
  getDuplicateRecommendation(idx1, idx2) {
    if (idx1.usage.examined > idx2.usage.examined) {
      return { action: 'drop', target: idx2, keep: idx1 };
    } else {
      return { action: 'drop', target: idx1, keep: idx2 };
    }
  }

  /**
   * Analyze query patterns and identify optimization opportunities
   */
  async analyzeQueryPatterns() {
    try {
      // This would typically analyze query logs, but for now we'll simulate
      const patterns = {
        mostFrequent: [],
        slowQueries: [],
        missingIndexes: [],
        tableScans: []
      };
      
      // In a real implementation, this would:
      // 1. Parse query logs or performance_schema
      // 2. Extract common patterns
      // 3. Identify queries that could benefit from indexes
      // 4. Find full table scans
      
      console.log('Query pattern analysis completed');
      return patterns;
      
    } catch (error) {
      console.log('Error analyzing query patterns:', error.message);
      throw error;
    }
  }

  /**
   * Analyze performance metrics
   */
  async analyzePerformanceMetrics() {
    try {
      const metrics = {
        avgQueryTime: 0,
        slowQueryCount: 0,
        tableScans: 0,
        indexUsage: {},
        cacheHitRatio: 0
      };
      
      // Get performance schema data if available
      try {
        const performanceData = await executeQuery(`
          SELECT 
            COUNT_STAR as query_count,
            AVG_TIMER_WAIT/1000000000 as avg_time_ms,
            SUM_ROWS_EXAMINED as total_rows_examined,
            SUM_ROWS_SENT as total_rows_sent
          FROM performance_schema.events_statements_summary_by_digest
          WHERE DIGEST_TEXT IS NOT NULL
          ORDER BY AVG_TIMER_WAIT DESC
          LIMIT 100
        `);
        
        if (performanceData && performanceData.length > 0) {
          metrics.avgQueryTime = performanceData.reduce((sum, row) => sum + (row.avg_time_ms || 0), 0) / performanceData.length;
          metrics.slowQueryCount = performanceData.filter(row => (row.avg_time_ms || 0) > this.options.performanceThreshold).length;
        }
      } catch (perfError) {
        console.log('Performance schema not available or accessible');
      }
      
      return metrics;
      
    } catch (error) {
      console.log('Error analyzing performance metrics:', error.message);
      throw error;
    }
  }

  /**
   * Generate intelligent recommendations based on analysis
   */
  async generateIntelligentRecommendations(analysis) {
    const recommendations = [];
    
    // Analyze missing indexes based on table size and query patterns
    for (const [tableName, table] of Object.entries(analysis.schema.tables)) {
      if (table.rows > 1000) { // Only recommend for larger tables
        // Check for missing primary key or unique constraints
        const hasIndex = analysis.indexes.byTable[tableName]?.some(idx => idx.name === 'PRIMARY');
        if (!hasIndex) {
          recommendations.push({
            type: 'create_index',
            table: tableName,
            columns: ['id'], // Assume id column exists
            reason: 'Missing primary key index on large table',
            priority: 'high',
            estimatedImpact: 'high'
          });
        }
      }
    }
    
    // Recommend dropping unused indexes
    for (const unused of analysis.indexes.unused) {
      recommendations.push({
        type: 'drop_index',
        table: unused.table,
        indexName: unused.name,
        reason: 'Index is never used',
        priority: 'medium',
        estimatedImpact: 'low'
      });
    }
    
    return recommendations;
  }

  /**
   * Detect schema changes since last snapshot
   */
  detectSchemaChanges(oldSchema, newSchema) {
    const changes = {
      tablesAdded: [],
      tablesRemoved: [],
      tablesModified: []
    };
    
    const oldTables = new Set(Object.keys(oldSchema.tables));
    const newTables = new Set(Object.keys(newSchema.tables));
    
    // Find added tables
    for (const table of newTables) {
      if (!oldTables.has(table)) {
        changes.tablesAdded.push(table);
      }
    }
    
    // Find removed tables
    for (const table of oldTables) {
      if (!newTables.has(table)) {
        changes.tablesRemoved.push(table);
      }
    }
    
    // Find modified tables (simple row count comparison)
    for (const table of newTables) {
      if (oldTables.has(table)) {
        const oldRows = oldSchema.tables[table].rows;
        const newRows = newSchema.tables[table].rows;
        if (Math.abs(newRows - oldRows) > oldRows * 0.1) { // 10% change threshold
          changes.tablesModified.push({
            table,
            oldRows,
            newRows,
            change: newRows - oldRows
          });
        }
      }
    }
    
    return changes;
  }
}

module.exports = IndexAnalyzer;
