/**
 * IndexManagementCore.js
 * Index management system core module
 * 분할된 모듈: index_management_api.js의 핵심 부분
 * 
 * 포함 기능:
 * - 핵심 IndexManagementSystem 클래스
 * - 인덱스 정보 조회 및 그룹핑
 * - 사용 통계 분석
 * - 기본 유틸리티 메서드들
 */

const { executeQuery } = require('../../db');

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
      // performance_schema를 사용한 대체 통계
      const performanceQuery = `
        SELECT 
          object_schema as TABLE_SCHEMA,
          object_name as TABLE_NAME,
          index_name as INDEX_NAME,
          count_read as COUNT_READ,
          count_write as COUNT_WRITE,
          count_fetch as COUNT_FETCH,
          count_insert as COUNT_INSERT,
          count_update as COUNT_UPDATE,
          count_delete as COUNT_DELETE
        FROM performance_schema.table_io_waits_summary_by_index_usage
        WHERE object_schema = DATABASE()
        AND index_name IS NOT NULL
        ORDER BY count_read DESC
      `;

      try {
        const performanceStats = await executeQuery(performanceQuery);
        return performanceStats;
      } catch (perfError) {
        console.log('Performance schema not available, returning empty stats');
        return [];
      }

    } catch (error) {
      console.error('Alternative usage stats error:', error);
      return [];
    }
  }

  /**
   * 특정 테이블의 인덱스 정보 조회
   */
  async getTableIndexes(tableName) {
    try {
      const allIndexes = await this.getAllIndexes();
      return allIndexes[tableName] || null;
    } catch (error) {
      console.error(`Get table indexes error for ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * 특정 인덱스의 상세 정보 조회
   */
  async getIndexDetails(tableName, indexName) {
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
          s.COMMENT,
          c.DATA_TYPE,
          c.IS_NULLABLE,
          c.COLUMN_DEFAULT
        FROM information_schema.STATISTICS s
        JOIN information_schema.COLUMNS c
          ON s.TABLE_SCHEMA = c.TABLE_SCHEMA
          AND s.TABLE_NAME = c.TABLE_NAME
          AND s.COLUMN_NAME = c.COLUMN_NAME
        WHERE s.TABLE_SCHEMA = DATABASE()
        AND s.TABLE_NAME = ?
        AND s.INDEX_NAME = ?
        ORDER BY s.SEQ_IN_INDEX
      `;

      const results = await executeQuery(query, [tableName, indexName]);
      
      if (results.length === 0) {
        return null;
      }

      return {
        tableName: tableName,
        indexName: indexName,
        unique: results[0].NON_UNIQUE === 0,
        indexType: results[0].INDEX_TYPE,
        comment: results[0].COMMENT,
        columns: results.map(row => ({
          columnName: row.COLUMN_NAME,
          position: row.SEQ_IN_INDEX,
          cardinality: row.CARDINALITY,
          dataType: row.DATA_TYPE,
          nullable: row.IS_NULLABLE === 'YES',
          defaultValue: row.COLUMN_DEFAULT
        }))
      };

    } catch (error) {
      console.error(`Get index details error for ${tableName}.${indexName}:`, error);
      throw error;
    }
  }

  /**
   * 인덱스 효율성 계산
   */
  calculateIndexEfficiency(indexInfo, usageStats) {
    try {
      const usage = usageStats.find(stat => 
        stat.TABLE_NAME === indexInfo.tableName && 
        stat.INDEX_NAME === indexInfo.indexName
      );

      if (!usage) {
        return {
          efficiency: 0,
          usage: {
            reads: 0,
            writes: 0,
            fetches: 0
          },
          recommendation: 'No usage data available'
        };
      }

      const reads = usage.COUNT_READ || 0;
      const writes = usage.COUNT_WRITE || 0;
      const fetches = usage.COUNT_FETCH || 0;

      // 효율성 점수 계산 (0-100)
      let efficiency = 0;
      
      // 읽기 사용량 기반 점수
      if (reads > 0) {
        efficiency += Math.min(30, Math.log10(reads + 1) * 10);
      }
      
      // 카디널리티 기반 점수
      const avgCardinality = indexInfo.columns.reduce((sum, col) => sum + (col.cardinality || 0), 0) / indexInfo.columns.length;
      if (avgCardinality > 1) {
        efficiency += Math.min(25, Math.log10(avgCardinality) * 10);
      }
      
      // 유니크 인덱스 보너스
      if (indexInfo.unique) {
        efficiency += 15;
      }
      
      // 컬럼 수에 따른 조정
      if (indexInfo.columns.length > 1) {
        efficiency += 10; // 복합 인덱스 보너스
      }
      if (indexInfo.columns.length > 4) {
        efficiency -= 10; // 너무 많은 컬럼은 비효율적
      }

      efficiency = Math.min(100, Math.max(0, efficiency));

      // 추천사항 생성
      let recommendation = 'Index is performing well';
      if (efficiency < 30) {
        recommendation = 'Consider dropping this index due to low efficiency';
      } else if (efficiency < 50) {
        recommendation = 'Monitor usage and consider optimization';
      } else if (efficiency < 70) {
        recommendation = 'Good efficiency, minor optimization possible';
      }

      return {
        efficiency: Math.round(efficiency),
        usage: {
          reads: reads,
          writes: writes,
          fetches: fetches
        },
        recommendation: recommendation
      };

    } catch (error) {
      console.error('Calculate index efficiency error:', error);
      return {
        efficiency: 0,
        usage: { reads: 0, writes: 0, fetches: 0 },
        recommendation: 'Error calculating efficiency'
      };
    }
  }

  /**
   * 인덱스 상태 요약 생성
   */
  generateIndexSummary(allIndexes, usageStats) {
    const summary = {
      totalTables: 0,
      totalIndexes: 0,
      primaryKeys: 0,
      uniqueIndexes: 0,
      regularIndexes: 0,
      unusedIndexes: 0,
      highEfficiencyIndexes: 0,
      lowEfficiencyIndexes: 0,
      totalIndexSize: 0,
      recommendations: []
    };

    for (const tableName in allIndexes) {
      summary.totalTables++;
      const table = allIndexes[tableName];
      summary.totalIndexSize += table.indexLength || 0;

      for (const indexName in table.indexes) {
        summary.totalIndexes++;
        const index = table.indexes[indexName];

        // 인덱스 타입별 분류
        if (indexName === 'PRIMARY') {
          summary.primaryKeys++;
        } else if (index.unique) {
          summary.uniqueIndexes++;
        } else {
          summary.regularIndexes++;
        }

        // 효율성 분석
        const efficiency = this.calculateIndexEfficiency(index, usageStats);
        if (efficiency.efficiency === 0 || efficiency.usage.reads === 0) {
          summary.unusedIndexes++;
        } else if (efficiency.efficiency >= 70) {
          summary.highEfficiencyIndexes++;
        } else if (efficiency.efficiency < 30) {
          summary.lowEfficiencyIndexes++;
        }
      }
    }

    // 추천사항 생성
    if (summary.unusedIndexes > 0) {
      summary.recommendations.push(`${summary.unusedIndexes} unused indexes detected - consider dropping them`);
    }
    if (summary.lowEfficiencyIndexes > 0) {
      summary.recommendations.push(`${summary.lowEfficiencyIndexes} low-efficiency indexes need attention`);
    }
    if (summary.totalIndexes > summary.totalTables * 5) {
      summary.recommendations.push('High number of indexes detected - review for redundancy');
    }

    return summary;
  }

  /**
   * 작업 히스토리에 기록 추가
   */
  addToOperationHistory(operation) {
    this.operationHistory.push({
      timestamp: new Date(),
      ...operation
    });

    // 최근 100개 작업만 유지
    if (this.operationHistory.length > 100) {
      this.operationHistory = this.operationHistory.slice(-100);
    }
  }

  /**
   * 성능 히스토리에 기록 추가
   */
  addToPerformanceHistory(performance) {
    this.performanceHistory.push({
      timestamp: new Date(),
      ...performance
    });

    // 최근 50개 기록만 유지
    if (this.performanceHistory.length > 50) {
      this.performanceHistory = this.performanceHistory.slice(-50);
    }
  }

  /**
   * 관리되는 인덱스 등록
   */
  registerManagedIndex(tableName, indexName, metadata = {}) {
    const key = `${tableName}.${indexName}`;
    this.managedIndexes.set(key, {
      tableName,
      indexName,
      registeredAt: new Date(),
      ...metadata
    });
  }

  /**
   * 관리되는 인덱스 해제
   */
  unregisterManagedIndex(tableName, indexName) {
    const key = `${tableName}.${indexName}`;
    return this.managedIndexes.delete(key);
  }

  /**
   * 시스템 상태 정보 조회
   */
  getSystemStatus() {
    return {
      managedIndexes: this.managedIndexes.size,
      operationHistory: this.operationHistory.length,
      performanceHistory: this.performanceHistory.length,
      lastOperation: this.operationHistory.length > 0 ? 
        this.operationHistory[this.operationHistory.length - 1] : null,
      systemUptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }
}

module.exports = IndexManagementSystem;
