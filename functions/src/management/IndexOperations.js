/**
 * IndexOperations.js
 * Index CRUD operations and performance analysis module
 * 분할된 모듈: index_management_api.js의 작업 실행 부분
 * 
 * 포함 기능:
 * - 인덱스 생성/삭제 작업
 * - 인덱스 백업 및 복원
 * - 성능 분석 및 테스트
 * - 성능 보고서 생성
 * - 최적화 추천사항 생성
 */

const { executeQuery } = require('../../db');
const IndexManagementCore = require('./IndexManagementCore');

class IndexOperations extends IndexManagementCore {
  constructor() {
    super();
  }

  /**
   * 인덱스 생성
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

      // 테이블 존재 확인
      const tableExists = await this.checkTableExists(tableName);
      if (!tableExists) {
        throw new Error(`Table ${tableName} does not exist`);
      }

      // 인덱스 중복 확인
      const indexExists = await this.checkIndexExists(tableName, indexName);
      if (indexExists) {
        throw new Error(`Index ${indexName} already exists on table ${tableName}`);
      }

      // 컬럼 존재 확인
      for (const col of columns) {
        const columnName = typeof col === 'string' ? col : col.name;
        const columnExists = await this.checkColumnExists(tableName, columnName);
        if (!columnExists) {
          throw new Error(`Column ${columnName} does not exist in table ${tableName}`);
        }
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
      this.addToOperationHistory({
        operation: 'CREATE_INDEX',
        tableName,
        indexName,
        columns,
        options,
        duration,
        status: 'SUCCESS',
        sql
      });

      // 관리되는 인덱스로 등록
      this.registerManagedIndex(tableName, indexName, {
        columns,
        unique,
        indexType,
        comment,
        createdAt: new Date()
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
      this.addToOperationHistory({
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

      // 테이블 존재 확인
      const tableExists = await this.checkTableExists(tableName);
      if (!tableExists) {
        throw new Error(`Table ${tableName} does not exist`);
      }

      // 인덱스 존재 확인
      const indexExists = await this.checkIndexExists(tableName, indexName);
      if (!indexExists) {
        throw new Error(`Index ${indexName} does not exist on table ${tableName}`);
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
      this.addToOperationHistory({
        operation: 'DROP_INDEX',
        tableName,
        indexName,
        options,
        duration,
        backup: backupInfo,
        status: 'SUCCESS',
        sql
      });

      // 관리되는 인덱스에서 제거
      this.unregisterManagedIndex(tableName, indexName);

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
      this.addToOperationHistory({
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
        
        const backupInfo = {
          timestamp: new Date(),
          tableName,
          indexName,
          createStatement,
          backupId: `backup_${tableName}_${indexName}_${Date.now()}`
        };

        console.log(`Index backup created: ${backupInfo.backupId}`);
        return backupInfo;
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
          AND TABLE_NAME = ?
          AND INDEX_NAME = ?
        ORDER BY SEQ_IN_INDEX
      `, [tableName, indexName]);

      analysis.indexInfo = indexInfo;

      // 2. 테이블 통계
      const tableStats = await executeQuery(`
        SELECT TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH, AUTO_INCREMENT
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
      `, [tableName]);

      analysis.tableStats = tableStats[0] || {};

      // 3. 인덱스 사용률 (가능한 경우)
      try {
        const usageStats = await executeQuery(`
          SELECT COUNT_READ, COUNT_WRITE, COUNT_FETCH
          FROM information_schema.INDEX_STATISTICS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
            AND INDEX_NAME = ?
        `, [tableName, indexName]);
        
        analysis.usageStats = usageStats[0] || {};
      } catch (usageError) {
        analysis.usageStats = { available: false };
      }

      // 4. 샘플 쿼리 성능 테스트
      const performanceTest = await this.runIndexPerformanceTest(tableName, indexName);
      analysis.performanceTest = performanceTest;

      // 5. 효율성 계산
      if (indexInfo.length > 0) {
        const indexObj = {
          tableName,
          indexName,
          columns: indexInfo,
          unique: indexInfo[0].NON_UNIQUE === 0
        };
        const usageArray = analysis.usageStats.available !== false ? [analysis.usageStats] : [];
        analysis.efficiency = this.calculateIndexEfficiency(indexObj, usageArray);
      }

      // 성능 히스토리에 추가
      this.addToPerformanceHistory({
        operation: 'ANALYZE_INDEX',
        tableName,
        indexName,
        analysis
      });

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
          AND TABLE_NAME = ?
          AND INDEX_NAME = ?
        ORDER BY SEQ_IN_INDEX
        LIMIT 1
      `, [tableName, indexName]);

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
      try {
        const result1 = await executeQuery(testQuery1);
        const duration1 = Date.now() - startTime1;

        tests.push({
          testName: 'Index Scan Test',
          query: testQuery1.replace(/\s+/g, ' ').trim(),
          duration: duration1,
          result: result1[0]?.count_result || 0,
          success: true
        });
      } catch (testError) {
        tests.push({
          testName: 'Index Scan Test',
          query: testQuery1.replace(/\s+/g, ' ').trim(),
          duration: 0,
          success: false,
          error: testError.message
        });
      }

      // 테스트 2: EXPLAIN 실행 계획
      const explainQuery = `EXPLAIN ${testQuery1}`;
      try {
        const startTime2 = Date.now();
        const explainResult = await executeQuery(explainQuery);
        const duration2 = Date.now() - startTime2;

        tests.push({
          testName: 'Query Execution Plan',
          query: explainQuery,
          duration: duration2,
          result: explainResult,
          success: true
        });
      } catch (explainError) {
        tests.push({
          testName: 'Query Execution Plan',
          query: explainQuery,
          duration: 0,
          success: false,
          error: explainError.message
        });
      }

      return {
        timestamp: new Date(),
        tableName,
        indexName,
        tests
      };

    } catch (error) {
      console.error('Run index performance test error:', error);
      return {
        timestamp: new Date(),
        tableName,
        indexName,
        error: error.message,
        tests: []
      };
    }
  }

  /**
   * 성능 보고서 생성
   */
  async generatePerformanceReport(options = {}) {
    try {
      const {
        includeUnused = true,
        includeLowEfficiency = true,
        includeRecommendations = true
      } = options;

      const report = {
        timestamp: new Date(),
        summary: {},
        details: {},
        recommendations: []
      };

      // 1. 모든 인덱스 정보 수집
      const allIndexes = await this.getAllIndexes();
      const usageStats = await this.getIndexUsageStats();

      // 2. 요약 정보 생성
      report.summary = this.generateIndexSummary(allIndexes, usageStats);

      // 3. 상세 분석
      report.details = {
        tableAnalysis: {},
        indexAnalysis: {},
        performanceMetrics: {}
      };

      for (const tableName in allIndexes) {
        const table = allIndexes[tableName];
        report.details.tableAnalysis[tableName] = {
          tableName: tableName,
          totalIndexes: Object.keys(table.indexes).length,
          tableRows: table.tableRows,
          dataSize: table.dataLength,
          indexSize: table.indexLength,
          indexes: {}
        };

        for (const indexName in table.indexes) {
          const index = table.indexes[indexName];
          const efficiency = this.calculateIndexEfficiency(index, usageStats);
          
          report.details.tableAnalysis[tableName].indexes[indexName] = {
            ...index,
            efficiency: efficiency
          };
        }
      }

      // 4. 추천사항 생성
      if (includeRecommendations) {
        report.recommendations = await this.generateRecommendations(allIndexes, usageStats);
      }

      // 5. 성능 히스토리 추가
      this.addToPerformanceHistory({
        operation: 'GENERATE_REPORT',
        reportSummary: report.summary,
        recommendationCount: report.recommendations.length
      });

      console.log(`Performance report generated with ${report.recommendations.length} recommendations`);
      
      return report;

    } catch (error) {
      console.error('Generate performance report error:', error);
      throw error;
    }
  }

  /**
   * 최적화 추천사항 생성
   */
  async generateRecommendations(allIndexes, usageStats = null) {
    try {
      if (!usageStats) {
        usageStats = await this.getIndexUsageStats();
      }

      const recommendations = [];

      for (const tableName in allIndexes) {
        const table = allIndexes[tableName];

        for (const indexName in table.indexes) {
          const index = table.indexes[indexName];
          
          // PRIMARY KEY는 추천 대상에서 제외
          if (indexName === 'PRIMARY') continue;

          const efficiency = this.calculateIndexEfficiency(index, usageStats);

          // 미사용 인덱스 추천
          if (efficiency.usage.reads === 0 && efficiency.usage.writes === 0) {
            recommendations.push({
              type: 'DROP_UNUSED',
              priority: 'HIGH',
              tableName,
              indexName,
              reason: 'Index is never used',
              action: `DROP INDEX \`${indexName}\` ON \`${tableName}\``,
              estimatedBenefit: 'Reduce storage overhead and improve write performance',
              riskLevel: 'LOW'
            });
          }
          // 비효율적 인덱스 추천
          else if (efficiency.efficiency < 30) {
            recommendations.push({
              type: 'OPTIMIZE_LOW_EFFICIENCY',
              priority: 'MEDIUM',
              tableName,
              indexName,
              reason: `Low efficiency score: ${efficiency.efficiency}%`,
              action: 'Review index usage patterns and consider redesign',
              estimatedBenefit: 'Improve query performance',
              riskLevel: 'MEDIUM'
            });
          }
          // 단일 컬럼 인덱스 통합 기회
          else if (index.columns.length === 1) {
            const singleColumnIndexes = Object.values(table.indexes)
              .filter(idx => idx.columns.length === 1 && idx.indexName !== indexName && idx.indexName !== 'PRIMARY');
            
            if (singleColumnIndexes.length >= 2) {
              recommendations.push({
                type: 'CREATE_COMPOSITE',
                priority: 'LOW',
                tableName,
                indexName: `composite_${tableName}_${Date.now()}`,
                reason: 'Multiple single-column indexes can be combined',
                action: `Consider creating composite index combining frequently used columns`,
                estimatedBenefit: 'Reduce number of indexes and improve multi-column queries',
                riskLevel: 'MEDIUM'
              });
            }
          }
        }

        // 테이블에 인덱스가 없는 경우 (PRIMARY KEY 제외)
        const nonPrimaryIndexes = Object.keys(table.indexes).filter(name => name !== 'PRIMARY');
        if (nonPrimaryIndexes.length === 0 && table.tableRows > 1000) {
          recommendations.push({
            type: 'ADD_MISSING_INDEX',
            priority: 'HIGH',
            tableName,
            indexName: 'suggested_index',
            reason: 'Large table without secondary indexes',
            action: 'Analyze query patterns and add appropriate indexes',
            estimatedBenefit: 'Significantly improve query performance',
            riskLevel: 'LOW'
          });
        }
      }

      // 우선순위별 정렬
      recommendations.sort((a, b) => {
        const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      return recommendations;

    } catch (error) {
      console.error('Generate recommendations error:', error);
      return [];
    }
  }

  /**
   * 테이블 존재 확인
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
   * 인덱스 존재 확인
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
   * 컬럼 존재 확인
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
}

module.exports = IndexOperations;
