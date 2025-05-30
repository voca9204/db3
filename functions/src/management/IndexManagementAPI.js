/**
 * IndexManagementAPI.js
 * Firebase Functions API endpoints for index management
 * 분할된 모듈: index_management_api.js의 API 부분
 * 
 * 포함 기능:
 * - Firebase Functions HTTP 엔드포인트들
 * - CORS 설정 및 에러 처리
 * - API 요청/응답 관리
 * - 인증 및 권한 확인
 */

const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });
const IndexOperations = require('./IndexOperations');

// 인덱스 관리 시스템 인스턴스
const indexManagementSystem = new IndexOperations();

module.exports = {
  // 인덱스 관리 시스템 인스턴스 내보내기
  indexManagementSystem,
  
  // API 엔드포인트 함수들
  getIndexManagementDashboard: functions.https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      try {
        console.log('📊 Getting index management dashboard...');
        
        const allIndexes = await indexManagementSystem.getAllIndexes();
        const usageStats = await indexManagementSystem.getIndexUsageStats();
        const systemStatus = indexManagementSystem.getSystemStatus();

        // 요약 정보 생성
        const summary = indexManagementSystem.generateIndexSummary(allIndexes, usageStats);

        res.json({
          status: "success",
          message: "Index management dashboard data retrieved",
          data: {
            indexes: allIndexes,
            usageStats,
            systemStatus,
            summary,
            totalTables: Object.keys(allIndexes).length,
            totalIndexes: Object.values(allIndexes).reduce((sum, table) => 
              sum + Object.keys(table.indexes).length, 0),
            totalSize: Object.values(allIndexes).reduce((sum, table) => 
              sum + (table.indexLength || 0), 0)
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
            message: "tableName, indexName, and columns are required",
            timestamp: new Date().toISOString()
          });
        }

        console.log(`🔧 Creating index ${indexName} on table ${tableName}...`);
        
        const result = await indexManagementSystem.createIndex(tableName, indexName, columns, options);
        
        res.json({
          status: "success",
          message: result.message,
          data: {
            tableName,
            indexName,
            columns,
            options,
            duration: result.duration,
            sql: result.sql
          },
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
            message: "tableName and indexName are required",
            timestamp: new Date().toISOString()
          });
        }

        console.log(`🗑️ Dropping index ${indexName} from table ${tableName}...`);
        
        const result = await indexManagementSystem.dropIndex(tableName, indexName, options);
        
        res.json({
          status: "success",
          message: result.message,
          data: {
            tableName,
            indexName,
            duration: result.duration,
            backup: result.backup,
            sql: result.sql
          },
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
            message: "tableName and indexName are required as query parameters",
            timestamp: new Date().toISOString()
          });
        }

        console.log(`🔍 Analyzing index ${indexName} on table ${tableName}...`);
        
        const analysis = await indexManagementSystem.analyzeIndexPerformance(tableName, indexName);
        
        res.json({
          status: "success",
          message: `Index analysis completed for ${tableName}.${indexName}`,
          data: analysis,
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
        const options = req.body || {};
        
        console.log('📈 Generating performance report...');
        
        const report = await indexManagementSystem.generatePerformanceReport(options);
        
        res.json({
          status: "success",
          message: "Performance report generated successfully",
          data: report,
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
        console.log('📊 Getting index management status...');
        
        const systemStatus = indexManagementSystem.getSystemStatus();
        const allIndexes = await indexManagementSystem.getAllIndexes();
        const usageStats = await indexManagementSystem.getIndexUsageStats();
        
        // 기본 통계 생성
        const stats = {
          totalTables: Object.keys(allIndexes).length,
          totalIndexes: 0,
          totalIndexSize: 0,
          indexTypes: { primary: 0, unique: 0, regular: 0 },
          systemStatus
        };

        for (const tableName in allIndexes) {
          const table = allIndexes[tableName];
          stats.totalIndexSize += table.indexLength || 0;
          
          for (const indexName in table.indexes) {
            stats.totalIndexes++;
            const index = table.indexes[indexName];
            
            if (indexName === 'PRIMARY') {
              stats.indexTypes.primary++;
            } else if (index.unique) {
              stats.indexTypes.unique++;
            } else {
              stats.indexTypes.regular++;
            }
          }
        }

        res.json({
          status: "success",
          message: "Index management status retrieved",
          data: stats,
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
  }),

  getTableIndexesAPI: functions.https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      try {
        const { tableName } = req.query;
        
        if (!tableName) {
          return res.status(400).json({
            status: "error",
            message: "tableName is required as query parameter",
            timestamp: new Date().toISOString()
          });
        }

        console.log(`📋 Getting indexes for table ${tableName}...`);
        
        const tableIndexes = await indexManagementSystem.getTableIndexes(tableName);
        
        if (!tableIndexes) {
          return res.status(404).json({
            status: "error",
            message: `Table ${tableName} not found`,
            timestamp: new Date().toISOString()
          });
        }

        res.json({
          status: "success",
          message: `Indexes retrieved for table ${tableName}`,
          data: tableIndexes,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Get table indexes API error:', error);
        res.status(500).json({
          status: "error",
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }),

  getIndexDetailsAPI: functions.https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      try {
        const { tableName, indexName } = req.query;
        
        if (!tableName || !indexName) {
          return res.status(400).json({
            status: "error",
            message: "tableName and indexName are required as query parameters",
            timestamp: new Date().toISOString()
          });
        }

        console.log(`🔍 Getting details for index ${tableName}.${indexName}...`);
        
        const indexDetails = await indexManagementSystem.getIndexDetails(tableName, indexName);
        
        if (!indexDetails) {
          return res.status(404).json({
            status: "error",
            message: `Index ${indexName} not found on table ${tableName}`,
            timestamp: new Date().toISOString()
          });
        }

        res.json({
          status: "success",
          message: `Index details retrieved for ${tableName}.${indexName}`,
          data: indexDetails,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Get index details API error:', error);
        res.status(500).json({
          status: "error",
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }),

  getRecommendationsAPI: functions.https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      try {
        console.log('💡 Generating index recommendations...');
        
        const allIndexes = await indexManagementSystem.getAllIndexes();
        const usageStats = await indexManagementSystem.getIndexUsageStats();
        const recommendations = await indexManagementSystem.generateRecommendations(allIndexes, usageStats);
        
        res.json({
          status: "success",
          message: `${recommendations.length} recommendations generated`,
          data: {
            recommendations,
            summary: {
              total: recommendations.length,
              high: recommendations.filter(r => r.priority === 'HIGH').length,
              medium: recommendations.filter(r => r.priority === 'MEDIUM').length,
              low: recommendations.filter(r => r.priority === 'LOW').length
            }
          },
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Get recommendations API error:', error);
        res.status(500).json({
          status: "error",
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }),

  getOperationHistoryAPI: functions.https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
      try {
        const { limit = 50 } = req.query;
        
        console.log('📜 Getting operation history...');
        
        const systemStatus = indexManagementSystem.getSystemStatus();
        const history = systemStatus.operationHistory || [];
        
        // 최신 순으로 정렬하고 제한
        const limitedHistory = history
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, parseInt(limit));

        res.json({
          status: "success",
          message: `${limitedHistory.length} operations retrieved`,
          data: {
            operations: limitedHistory,
            total: history.length,
            limit: parseInt(limit)
          },
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Get operation history API error:', error);
        res.status(500).json({
          status: "error",
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  })
};
