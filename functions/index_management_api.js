/**
 * index_management_api.js
 * Task 3.4: 인덱스 관리 대시보드 API
 * 관리자용 고급 인덱스 관리 시스템
 * 
 * Features:
 * - 인덱스 CRUD 작업 (생성/삭제/수정)
 * - 인덱스 사용률 및 효과 분석
 * - 성능 개선 보고서 생성
 * - 통합 인덱스 관리 대시보드
 */

const { executeQuery } = require('./db');
const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });

class IndexManagementSystem {
  constructor() {
    this.managedIndexes = new Map();
    this.performanceHistory = [];
    this.operationHistory = [];
  }

  /**
   * 모든 인덱스 정보 조회
   */
  async getAllIndexes() {
    try {
      const query = `
        SELECT 
          s.TABLE_NAME,
          s.INDEX_NAME,
          s.COLUMN_NAME,
          s.SEQ_IN_INDEX,
          s.NON_UNIQUE,
          s.CARDINALITY,
          s.INDEX_TYPE,
          t.TABLE_ROWS,
          t.DATA_LENGTH,
          t.INDEX_LENGTH,
          t.CREATE_TIME,
          t.UPDATE_TIME
        FROM information_schema.STATISTICS s
        JOIN information_schema.TABLES t 
          ON s.TABLE_SCHEMA = t.TABLE_SCHEMA 
          AND s.TABLE_NAME = t.TABLE_NAME
        WHERE s.TABLE_SCHEMA = DATABASE()
        ORDER BY s.TABLE_NAME, s.INDEX_NAME, s.SEQ_IN_INDEX
      `;

      const results = await executeQuery(query);
      return this.groupIndexesByTable(results);

    } catch (error) {
      console.error('Get all indexes error:', error);
      throw error;
    }
  }

  /**
   * 인덱스를 테이블별로 그룹핑
   */
  groupIndexesByTable(indexData) {
    const grouped = {};
    
    for (const row of indexData) {
      const tableName = row.TABLE_NAME;
      const indexName = row.INDEX_NAME;
      
      if (!grouped[tableName]) {
        grouped[tableName] = {
          tableName: tableName,
          tableRows: row.TABLE_ROWS,
          dataLength: row.DATA_LENGTH,
          indexLength: row.INDEX_LENGTH,
          createdAt: row.CREATE_TIME,
          updatedAt: row.UPDATE_TIME,
          indexes: {}
        };
      }
      
      if (!grouped[tableName].indexes[indexName]) {
        grouped[tableName].indexes[indexName] = {
          indexName: indexName,
          tableName: tableName,
          unique: row.NON_UNIQUE === 0,
          indexType: row.INDEX_TYPE,
          columns: []
        };
      }
      
      grouped[tableName].indexes[indexName].columns.push({
        columnName: row.COLUMN_NAME,
        position: row.SEQ_IN_INDEX,
        cardinality: row.CARDINALITY
      });
    }
    
    // 컬럼을 순서대로 정렬
    for (const tableName in grouped) {
      for (const indexName in grouped[tableName].indexes) {
        grouped[tableName].indexes[indexName].columns.sort((a, b) => a.position - b.position);
      }
    }
    
    return grouped;
  }

  /**
   * 인덱스 사용 통계 분석
   */
  async getIndexUsageStats() {
    try {
      // MySQL 5.7+ INDEX_STATISTICS 테이블 사용 (가능한 경우)
      const usageQuery = `
        SELECT 
          TABLE_SCHEMA,
          TABLE_NAME,
          INDEX_NAME,
          COUNT_READ,
          COUNT_WRITE,
          COUNT_FETCH,
          COUNT_INSERT,
          COUNT_UPDATE,
          COUNT_DELETE
        FROM information_schema.INDEX_STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY COUNT_READ DESC
      `;

      try {
        const usageStats = await executeQuery(usageQuery);
        return usageStats;
      } catch (statError) {
        // INDEX_STATISTICS가 없는 경우 대체 방법 사용
        console.log('INDEX_STATISTICS not available, using alternative method');
        return await this.getAlternativeUsageStats();
      }

    } catch (error) {
      console.error('Get index usage stats error:', error);
      return [];
    }
  }

  /**
   * 대체 인덱스 사용 통계 (INDEX_STATISTICS가 없는 경우)
   */
  async getAlternativeUsageStats() {
    try {
      // PERFORMANCE_SCHEMA를 사용한 대체 방법
      const perfQuery = `
        SELECT 
          OBJECT_SCHEMA as TABLE_SCHEMA,
          OBJECT_NAME as TABLE_NAME,
          INDEX_NAME,
          COUNT_FETCH,
          COUNT_INSERT,
          COUNT_UPDATE,
          COUNT_DELETE
        FROM performance_schema.table_io_waits_summary_by_index_usage
        WHERE OBJECT_SCHEMA = DATABASE()
        ORDER BY COUNT_FETCH DESC
        LIMIT 100
      `;

      const perfStats = await executeQuery(perfQuery);
      return perfStats;

    } catch (perfError) {
      console.log('Performance schema also not available');
      return [];
    }
  }

  /**
   * 새 인덱스 생성
   */
  async createIndex(tableName, indexName, columns, options = {}) {
    try {
      const {
        unique = false,
        indexType = 'BTREE',
        comment = ''
      } = options;

      // 컬럼 검증
      if (!Array.isArray(columns) || columns.length === 0) {
        throw new Error('Columns must be a non-empty array');
      }

      // SQL 생성
      const uniqueClause = unique ? 'UNIQUE' : '';
      const columnClause = columns.map(col => {
        if (typeof col === 'string') {
          return `\`${col}\``;
        } else if (typeof col === 'object' && col.name) {
          const length = col.length ? `(${col.length})` : '';
          const order = col.order || 'ASC';
          return `\`${col.name}\`${length} ${order}`;
        }
        throw new Error('Invalid column specification');
      }).join(', ');

      const commentClause = comment ? `COMMENT '${comment}'` : '';
      
      const sql = `
        CREATE ${uniqueClause} INDEX \`${indexName}\`
        ON \`${tableName}\` (${columnClause})
        USING ${indexType}
        ${commentClause}
      `.trim();

      console.log(`Creating index: ${sql}`);
      
      const startTime = Date.now();
      await executeQuery(sql);
      const duration = Date.now() - startTime;

      // 작업 히스토리 저장
      this.operationHistory.push({
        timestamp: new Date(),
        operation: 'CREATE_INDEX',
        tableName,
        indexName,
        columns,
        options,
        duration,
        status: 'SUCCESS'
      });

      return {
        success: true,
        message: `Index ${indexName} created successfully on table ${tableName}`,
        duration,
        sql
      };

    } catch (error) {
      console.error('Create index error:', error);
      
      // 실패 히스토리 저장
      this.operationHistory.push({
        timestamp: new Date(),
        operation: 'CREATE_INDEX',
        tableName,
        indexName,
        columns,
        options,
        status: 'FAILED',
        error: error.message
      });

      throw error;
    }
  }

  /**
   * 인덱스 삭제
   */
  async dropIndex(tableName, indexName, options = {}) {
    try {
      const { 
        force = false,
        backup = true 
      } = options;

      // PRIMARY KEY는 삭제 방지
      if (indexName.toUpperCase() === 'PRIMARY') {
        throw new Error('Cannot drop PRIMARY KEY index');
      }

      // 백업 생성 (옵션)
      let backupInfo = null;
      if (backup) {
        backupInfo = await this.backupIndex(tableName, indexName);
      }

      const sql = `DROP INDEX \`${indexName}\` ON \`${tableName}\``;
      
      console.log(`Dropping index: ${sql}`);
      
      const startTime = Date.now();
      await executeQuery(sql);
      const duration = Date.now() - startTime;

      // 작업 히스토리 저장
      this.operationHistory.push({
        timestamp: new Date(),
        operation: 'DROP_INDEX',
        tableName,
        indexName,
        options,
        duration,
        backup: backupInfo,
        status: 'SUCCESS'
      });

      return {
        success: true,
        message: `Index ${indexName} dropped successfully from table ${tableName}`,
        duration,
        backup: backupInfo,
        sql
      };

    } catch (error) {
      console.error('Drop index error:', error);
      
      // 실패 히스토리 저장
      this.operationHistory.push({
        timestamp: new Date(),
        operation: 'DROP_INDEX',
        tableName,
        indexName,
        options,
        status: 'FAILED',
        error: error.message
      });

      throw error;
    }
  }

  /**
   * 인덱스 백업 (테이블 구조 저장)
   */
  async backupIndex(tableName, indexName) {
    try {
      const createTableQuery = `SHOW CREATE TABLE \`${tableName}\``;
      const result = await executeQuery(createTableQuery);
      
      if (result && result.length > 0) {
        const createStatement = result[0]['Create Table'];
        
        return {
          timestamp: new Date(),
          tableName,
          indexName,
          createStatement,
          backupId: `backup_${tableName}_${indexName}_${Date.now()}`
        };
      }
      
      return null;

    } catch (error) {
      console.error('Backup index error:', error);
      return null;
    }
  }

  /**
   * 인덱스 성능 분석
   */
  async analyzeIndexPerformance(tableName, indexName) {
    try {
      const analysis = {
        indexName,
        tableName,
        timestamp: new Date(),
        metrics: {}
      };

      // 1. 인덱스 기본 정보
      const indexInfo = await executeQuery(`
        SELECT * FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = '${tableName}'
          AND INDEX_NAME = '${indexName}'
        ORDER BY SEQ_IN_INDEX
      `);

      analysis.indexInfo = indexInfo;

      // 2. 테이블 통계
      const tableStats = await executeQuery(`
        SELECT TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH, AUTO_INCREMENT
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}'
      `);

      analysis.tableStats = tableStats[0] || {};

      // 3. 인덱스 사용률 (가능한 경우)
      try {
        const usageStats = await executeQuery(`
          SELECT COUNT_READ, COUNT_WRITE, COUNT_FETCH
          FROM information_schema.INDEX_STATISTICS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = '${tableName}'
            AND INDEX_NAME = '${indexName}'
        `);
        
        analysis.usageStats = usageStats[0] || {};
      } catch (usageError) {
        analysis.usageStats = { available: false };
      }

      // 4. 샘플 쿼리 성능 테스트
      const performanceTest = await this.runIndexPerformanceTest(tableName, indexName);
      analysis.performanceTest = performanceTest;

      return analysis;

    } catch (error) {
      console.error('Analyze index performance error:', error);
      throw error;
    }
  }

  /**
   * 인덱스 성능 테스트 실행
   */
  async runIndexPerformanceTest(tableName, indexName) {
    try {
      const tests = [];

      // 인덱스 정보 가져오기
      const indexColumns = await executeQuery(`
        SELECT COLUMN_NAME 
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = '${tableName}'
          AND INDEX_NAME = '${indexName}'
        ORDER BY SEQ_IN_INDEX
        LIMIT 1
      `);

      if (indexColumns.length === 0) {
        return { error: 'Index not found' };
      }

      const firstColumn = indexColumns[0].COLUMN_NAME;

      // 테스트 1: 인덱스 사용하는 쿼리
      const testQuery1 = `
        SELECT COUNT(*) as count_result
        FROM \`${tableName}\`
        WHERE \`${firstColumn}\` IS NOT NULL
        LIMIT 1000
      `;

      const startTime1 = Date.now();
      const result1 = await executeQuery(testQuery1);
      const duration1 = Date.now() - startTime1;

      tests.push({
        testName: 'Index Scan Test',
        query: testQuery1.replace(/\s+/g, ' ').trim(),
        duration: duration1,
        result: result1[0]?.count_result || 0
      });

      // 테스트 2: EXPLAIN 실행 계획
      const explainQuery = `EXPLAIN ${testQuery1}`;
      const explainResult = await executeQuery(explainQuery);
      
      tests.push({
        testName: 'Execution Plan',
        result: explainResult
      });

      return {
        tableName,
        indexName,
        tests,
        totalDuration: tests.reduce((sum, test) => sum + (test.duration || 0), 0)
      };

    } catch (error) {
      console.error('Run index performance test error:', error);
      return {
        error: error.message,
        tableName,
        indexName
      };
    }
  }

  /**
   * 성능 개선 보고서 생성
   */
  async generatePerformanceReport(options = {}) {
    try {
      const {
        tableName = null,
        days = 7,
        includeRecommendations = true
      } = options;

      const report = {
        timestamp: new Date(),
        period: `${days} days`,
        tableName,
        summary: {},
        indexes: [],
        operations: [],
        recommendations: []
      };

      // 1. 전체 인덱스 현황
      const allIndexes = await this.getAllIndexes();
      
      let totalIndexes = 0;
      let totalIndexSize = 0;
      
      for (const table in allIndexes) {
        if (tableName && table !== tableName) continue;
        
        totalIndexSize += allIndexes[table].indexLength || 0;
        totalIndexes += Object.keys(allIndexes[table].indexes).length;
        
        for (const indexName in allIndexes[table].indexes) {
          const index = allIndexes[table].indexes[indexName];
          
          // 각 인덱스 성능 분석
          const analysis = await this.analyzeIndexPerformance(table, indexName);
          
          report.indexes.push({
            tableName: table,
            indexName,
            columns: index.columns.map(c => c.columnName),
            unique: index.unique,
            type: index.indexType,
            analysis
          });
        }
      }

      report.summary = {
        totalIndexes,
        totalIndexSize: Math.round(totalIndexSize / 1024 / 1024), // MB
        averageIndexSize: totalIndexes > 0 ? Math.round(totalIndexSize / totalIndexes / 1024) : 0 // KB
      };

      // 2. 최근 작업 히스토리
      const recentOperations = this.operationHistory
        .filter(op => {
          const daysDiff = (new Date() - op.timestamp) / (1000 * 60 * 60 * 24);
          return daysDiff <= days;
        })
        .slice(-20); // 최근 20개

      report.operations = recentOperations;

      // 3. 추천사항 (옵션)
      if (includeRecommendations) {
        report.recommendations = await this.generateRecommendations(allIndexes);
      }

      return report;

    } catch (error) {
      console.error('Generate performance report error:', error);
      throw error;
    }
  }

  /**
   * 인덱스 추천사항 생성
   */
  async generateRecommendations(allIndexes) {
    const recommendations = [];

    try {
      for (const tableName in allIndexes) {
        const table = allIndexes[tableName];
        
        // 1. 대용량 테이블에 인덱스가 부족한 경우
        if (table.tableRows > 10000 && Object.keys(table.indexes).length < 3) {
          recommendations.push({
            type: 'MISSING_INDEXES',
            priority: 'HIGH',
            tableName,
            message: `Large table (${table.tableRows.toLocaleString()} rows) has only ${Object.keys(table.indexes).length} indexes`,
            suggestion: 'Consider adding indexes on frequently queried columns'
          });
        }

        // 2. 인덱스 크기가 데이터 크기보다 큰 경우
        if (table.indexLength > table.dataLength && table.dataLength > 0) {
          recommendations.push({
            type: 'OVERSIZED_INDEXES',
            priority: 'MEDIUM',
            tableName,
            message: `Index size (${Math.round(table.indexLength/1024/1024)}MB) exceeds data size (${Math.round(table.dataLength/1024/1024)}MB)`,
            suggestion: 'Review index necessity and consider dropping unused indexes'
          });
        }

        // 3. 중복 인덱스 감지
        const indexColumns = {};
        for (const indexName in table.indexes) {
          const index = table.indexes[indexName];
          const columnKey = index.columns.map(c => c.columnName).join(',');
          
          if (indexColumns[columnKey]) {
            recommendations.push({
              type: 'DUPLICATE_INDEXES',
              priority: 'HIGH',
              tableName,
              message: `Potential duplicate indexes: ${indexColumns[columnKey]} and ${indexName}`,
              suggestion: `Consider dropping one of the duplicate indexes`
            });
          } else {
            indexColumns[columnKey] = indexName;
          }
        }
      }

      return recommendations;

    } catch (error) {
      console.error('Generate recommendations error:', error);
      return [];
    }
  }

  /**
   * 인덱스 관리 상태 조회
   */
  getManagementStatus() {
    return {
      timestamp: new Date(),
      operationsToday: this.operationHistory.filter(op => {
        const today = new Date();
        const opDate = new Date(op.timestamp);
        return opDate.toDateString() === today.toDateString();
      }).length,
      totalOperations: this.operationHistory.length,
      recentOperations: this.operationHistory.slice(-5),
      managedIndexes: this.managedIndexes.size,
      systemStatus: 'active'
    };
  }
}

// 싱글톤 인스턴스
const indexManagementSystem = new IndexManagementSystem();

module.exports = {
  indexManagementSystem,
  
  // API 엔드포인트 함수들
  getIndexManagementDashboard: functions.https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      try {
        console.log('📊 Getting index management dashboard...');
        
        const allIndexes = await indexManagementSystem.getAllIndexes();
        const usageStats = await indexManagementSystem.getIndexUsageStats();
        const managementStatus = indexManagementSystem.getManagementStatus();

        res.json({
          status: "success",
          message: "Index management dashboard data retrieved",
          data: {
            indexes: allIndexes,
            usageStats,
            managementStatus,
            summary: {
              totalTables: Object.keys(allIndexes).length,
              totalIndexes: Object.values(allIndexes).reduce((sum, table) => 
                sum + Object.keys(table.indexes).length, 0),
              totalSize: Object.values(allIndexes).reduce((sum, table) => 
                sum + (table.indexLength || 0), 0)
            }
          },
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Index management dashboard error:', error);
        res.status(500).json({
          status: "error",
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }),

  createIndexAPI: functions.https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      try {
        const { tableName, indexName, columns, options = {} } = req.body;
        
        if (!tableName || !indexName || !columns) {
          return res.status(400).json({
            status: "error",
            message: "tableName, indexName, and columns are required"
          });
        }

        console.log(`🔧 Creating index ${indexName} on table ${tableName}...`);
        
        const result = await indexManagementSystem.createIndex(tableName, indexName, columns, options);
        
        res.json({
          status: "success",
          message: "Index created successfully",
          result,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Create index API error:', error);
        res.status(500).json({
          status: "error",
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }),

  dropIndexAPI: functions.https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      try {
        const { tableName, indexName, options = {} } = req.body;
        
        if (!tableName || !indexName) {
          return res.status(400).json({
            status: "error",
            message: "tableName and indexName are required"
          });
        }

        console.log(`🗑️ Dropping index ${indexName} from table ${tableName}...`);
        
        const result = await indexManagementSystem.dropIndex(tableName, indexName, options);
        
        res.json({
          status: "success",
          message: "Index dropped successfully",
          result,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Drop index API error:', error);
        res.status(500).json({
          status: "error",
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }),

  analyzeIndexAPI: functions.https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      try {
        const { tableName, indexName } = req.query;
        
        if (!tableName || !indexName) {
          return res.status(400).json({
            status: "error",
            message: "tableName and indexName query parameters are required"
          });
        }

        console.log(`🔍 Analyzing index ${indexName} on table ${tableName}...`);
        
        const analysis = await indexManagementSystem.analyzeIndexPerformance(tableName, indexName);
        
        res.json({
          status: "success",
          message: "Index analysis completed",
          analysis,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Analyze index API error:', error);
        res.status(500).json({
          status: "error",
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }),

  generatePerformanceReportAPI: functions.https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      try {
        const { tableName, days = 7, includeRecommendations = true } = req.query;
        
        console.log(`📈 Generating performance report for ${days} days...`);
        
        const report = await indexManagementSystem.generatePerformanceReport({
          tableName,
          days: parseInt(days),
          includeRecommendations: includeRecommendations === 'true'
        });
        
        res.json({
          status: "success",
          message: "Performance report generated successfully",
          report,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Generate performance report API error:', error);
        res.status(500).json({
          status: "error",
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }),

  getIndexManagementStatus: functions.https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      try {
        const status = indexManagementSystem.getManagementStatus();
        
        res.json({
          status: "success",
          managementStatus: status,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Get index management status error:', error);
        res.status(500).json({
          status: "error",
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  })
};
