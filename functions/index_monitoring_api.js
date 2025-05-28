/**
 * Index Performance Monitoring API
 * Task 3.2: Firebase Functions용 인덱스 모니터링 API 엔드포인트
 */

const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });
const { executeQuerySafely } = require('./db');

// 모니터링된 인덱스 목록
const MONITORED_INDEXES = [
  {
    name: 'idx_game_scores_userId',
    table: 'game_scores',
    columns: ['userId'],
    priority: 'CRITICAL',
    targetQueries: ['JOIN with players table']
  },
  {
    name: 'idx_players_status_userId',
    table: 'players',
    columns: ['status', 'userId'],
    priority: 'HIGH',
    targetQueries: ['WHERE status filters']
  },
  {
    name: 'idx_game_scores_userId_gameDate',
    table: 'game_scores',
    columns: ['userId', 'gameDate'],
    priority: 'HIGH',
    targetQueries: ['Date range queries']
  },
  {
    name: 'idx_promotion_players_player_appliedAt',
    table: 'promotion_players',
    columns: ['player', 'appliedAt'],
    priority: 'MEDIUM',
    targetQueries: ['Event analysis queries']
  },
  {
    name: 'idx_money_flows_player_type_createdAt',
    table: 'money_flows',
    columns: ['player', 'type', 'createdAt'],
    priority: 'MEDIUM',
    targetQueries: ['Financial transaction analysis']
  },
  {
    name: 'idx_player_guilds_guild_player',
    table: 'player_guilds',
    columns: ['guild', 'player'],
    priority: 'MEDIUM',
    targetQueries: ['Multi-account analysis']
  }
];

// 성능 테스트 쿼리
const PERFORMANCE_TEST_QUERIES = [
  {
    id: 'critical_join',
    name: 'Critical JOIN Query',
    sql: `SELECT p.userId, COUNT(gs.gameDate) as gameDays, 
          SUM(gs.netBet) as totalBet
          FROM players p 
          LEFT JOIN game_scores gs ON p.userId = gs.userId 
          WHERE p.status = 0 
          GROUP BY p.userId 
          LIMIT 100`,
    targetTime: 100,
    relatedIndex: 'idx_game_scores_userId',
    category: 'JOIN'
  },
  {
    id: 'date_range',
    name: 'Date Range Query',
    sql: `SELECT userId, SUM(netBet) as totalBet
          FROM game_scores 
          WHERE gameDate >= '2024-01-01' AND gameDate <= '2024-12-31'
          GROUP BY userId 
          LIMIT 50`,
    targetTime: 50,
    relatedIndex: 'idx_game_scores_userId_gameDate',
    category: 'DATE_RANGE'
  },
  {
    id: 'event_analysis',
    name: 'Event Analysis Query',
    sql: `SELECT COUNT(*) as eventParticipants
          FROM promotion_players 
          WHERE appliedAt IS NOT NULL 
          AND appliedAt >= '2024-01-01'`,
    targetTime: 30,
    relatedIndex: 'idx_promotion_players_player_appliedAt',
    category: 'ANALYSIS'
  },
  {
    id: 'user_status_filter',
    name: 'User Status Filter',
    sql: `SELECT userId, status FROM players 
          WHERE status = 0 
          ORDER BY userId 
          LIMIT 100`,
    targetTime: 25,
    relatedIndex: 'idx_players_status_userId',
    category: 'FILTER'
  },
  {
    id: 'financial_analysis',
    name: 'Financial Transaction Analysis',
    sql: `SELECT player, type, COUNT(*) as transactions, 
          SUM(amount) as totalAmount
          FROM money_flows 
          WHERE type IN (0, 1, 2) 
          AND createdAt >= '2024-01-01'
          GROUP BY player, type
          LIMIT 100`,
    targetTime: 75,
    relatedIndex: 'idx_money_flows_player_type_createdAt',
    category: 'FINANCIAL'
  }
];

/**
 * 인덱스 사용률 통계 수집
 */
async function collectIndexUsageStats() {
  const stats = [];
  
  for (const index of MONITORED_INDEXES) {
    try {
      const result = await executeQuerySafely(
        `SELECT 
          INDEX_NAME, 
          CARDINALITY,
          SEQ_IN_INDEX,
          COLUMN_NAME
         FROM INFORMATION_SCHEMA.STATISTICS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
        [process.env.DB_NAME, index.table, index.name]
      );
      
      if (result.success && result.data.length > 0) {
        stats.push({
          name: index.name,
          table: index.table,
          priority: index.priority,
          cardinality: result.data[0].CARDINALITY,
          columns: result.data.map(s => s.COLUMN_NAME),
          status: 'ACTIVE',
          lastChecked: new Date()
        });
      } else {
        stats.push({
          name: index.name,
          table: index.table,
          priority: index.priority,
          status: 'NOT_FOUND',
          lastChecked: new Date()
        });
      }
    } catch (error) {
      stats.push({
        name: index.name,
        table: index.table,
        priority: index.priority,
        status: 'ERROR',
        error: error.message,
        lastChecked: new Date()
      });
    }
  }
  
  return stats;
}

/**
 * 쿼리 실행 계획 분석
 */
async function analyzeQueryPlan(sql, queryId) {
  try {
    const result = await executeQuerySafely(`EXPLAIN ${sql}`);
    
    if (!result.success) {
      return null;
    }
    
    const analysis = {
      queryId,
      timestamp: new Date(),
      usedIndexes: [],
      fullTableScans: 0,
      estimatedRows: 0,
      performance: 'UNKNOWN'
    };
    
    for (const row of result.data) {
      if (row.key) {
        analysis.usedIndexes.push(row.key);
      } else {
        analysis.fullTableScans++;
      }
      
      analysis.estimatedRows += row.rows || 0;
    }
    
    // 성능 등급 판정
    if (analysis.fullTableScans === 0 && analysis.usedIndexes.length > 0) {
      analysis.performance = 'EXCELLENT';
    } else if (analysis.fullTableScans <= 1) {
      analysis.performance = 'GOOD';
    } else {
      analysis.performance = 'POOR';
    }
    
    return analysis;
    
  } catch (error) {
    console.error(`쿼리 실행 계획 분석 실패 (${queryId}):`, error.message);
    return null;
  }
}

/**
 * 성능 테스트 실행
 */
async function runPerformanceTests() {
  const results = [];
  
  for (const testQuery of PERFORMANCE_TEST_QUERIES) {
    try {
      // 쿼리 실행 계획 분석
      const planAnalysis = await analyzeQueryPlan(testQuery.sql, testQuery.id);
      
      // 실행 시간 측정
      const startTime = Date.now();
      const queryResult = await executeQuerySafely(testQuery.sql);
      const executionTime = Date.now() - startTime;
      
      if (queryResult.success) {
        const result = {
          queryId: testQuery.id,
          name: testQuery.name,
          executionTime,
          targetTime: testQuery.targetTime,
          relatedIndex: testQuery.relatedIndex,
          category: testQuery.category,
          planAnalysis,
          status: getPerformanceStatus(executionTime, testQuery.targetTime),
          resultCount: queryResult.data.length,
          timestamp: new Date()
        };
        
        results.push(result);
      } else {
        results.push({
          queryId: testQuery.id,
          name: testQuery.name,
          status: 'ERROR',
          error: queryResult.error,
          timestamp: new Date()
        });
      }
      
    } catch (error) {
      results.push({
        queryId: testQuery.id,
        name: testQuery.name,
        status: 'ERROR',
        error: error.message,
        timestamp: new Date()
      });
    }
  }
  
  return results;
}

/**
 * 성능 상태 판정
 */
function getPerformanceStatus(executionTime, targetTime) {
  if (executionTime <= targetTime) return 'EXCELLENT';
  if (executionTime <= targetTime * 1.5) return 'GOOD';
  if (executionTime <= targetTime * 2) return 'FAIR';
  return 'POOR';
}

/**
 * 인덱스 효과 분석 보고서 생성
 */
function generateIndexEffectivenessReport(indexStats, performanceResults) {
  const report = {
    summary: {
      totalIndexes: MONITORED_INDEXES.length,
      activeIndexes: 0,
      effectiveIndexes: 0,
      indexHitRate: 0,
      slowQueries: 0,
      timestamp: new Date()
    },
    indexDetails: [],
    queryPerformance: [],
    recommendations: []
  };
  
  // 인덱스별 효과 분석
  for (const index of MONITORED_INDEXES) {
    const usage = indexStats.find(s => s.name === index.name);
    const relatedQueries = performanceResults.filter(r => r.relatedIndex === index.name);
    
    let effectiveness = 'UNKNOWN';
    let avgPerformance = 0;
    
    if (relatedQueries.length > 0) {
      const validPerformances = relatedQueries
        .filter(q => q.status !== 'ERROR' && q.executionTime)
        .map(q => q.executionTime);
      
      if (validPerformances.length > 0) {
        avgPerformance = validPerformances.reduce((a, b) => a + b, 0) / validPerformances.length;
        
        if (avgPerformance <= 50) effectiveness = 'EXCELLENT';
        else if (avgPerformance <= 100) effectiveness = 'GOOD';
        else if (avgPerformance <= 200) effectiveness = 'FAIR';
        else effectiveness = 'POOR';
      }
    }
    
    const indexDetail = {
      name: index.name,
      table: index.table,
      priority: index.priority,
      effectiveness,
      avgPerformance: Math.round(avgPerformance),
      relatedQueriesCount: relatedQueries.length,
      usage: usage || { status: 'UNKNOWN' }
    };
    
    report.indexDetails.push(indexDetail);
    
    if (usage && usage.status === 'ACTIVE') {
      report.summary.activeIndexes++;
      if (effectiveness === 'EXCELLENT' || effectiveness === 'GOOD') {
        report.summary.effectiveIndexes++;
      }
    }
  }
  
  // 쿼리 성능 요약
  for (const result of performanceResults) {
    if (result.status !== 'ERROR') {
      report.queryPerformance.push({
        queryId: result.queryId,
        name: result.name,
        executionTime: result.executionTime,
        targetTime: result.targetTime,
        status: result.status,
        usedIndexes: result.planAnalysis ? result.planAnalysis.usedIndexes : []
      });
      
      if (result.executionTime > 200) {
        report.summary.slowQueries++;
      }
    }
  }
  
  // 인덱스 히트율 계산
  const totalQueries = performanceResults.filter(r => r.planAnalysis).length;
  const indexHits = performanceResults
    .filter(r => r.planAnalysis && r.planAnalysis.usedIndexes.length > 0)
    .length;
  
  if (totalQueries > 0) {
    report.summary.indexHitRate = Math.round((indexHits / totalQueries) * 100);
  }
  
  // 추천사항 생성
  const ineffectiveIndexes = report.indexDetails.filter(idx => 
    idx.effectiveness === 'POOR' || idx.effectiveness === 'FAIR'
  );
  
  if (ineffectiveIndexes.length > 0) {
    report.recommendations.push({
      type: 'OPTIMIZE_INDEX',
      message: `${ineffectiveIndexes.length}개 인덱스의 최적화가 필요합니다.`,
      indexes: ineffectiveIndexes.map(idx => idx.name)
    });
  }
  
  if (report.summary.slowQueries > 0) {
    report.recommendations.push({
      type: 'INVESTIGATE_SLOW_QUERIES',
      message: `${report.summary.slowQueries}개의 슬로우 쿼리가 감지되었습니다.`,
      count: report.summary.slowQueries
    });
  }
  
  if (report.summary.indexHitRate < 80) {
    report.recommendations.push({
      type: 'IMPROVE_INDEX_USAGE',
      message: `인덱스 히트율이 ${report.summary.indexHitRate}%로 낮습니다.`,
      hitRate: report.summary.indexHitRate
    });
  }
  
  if (report.recommendations.length === 0) {
    report.recommendations.push({
      type: 'EXCELLENT_PERFORMANCE',
      message: '모든 인덱스가 효과적으로 작동하고 있습니다!'
    });
  }
  
  return report;
}

// =============================================================================
// API 엔드포인트들
// =============================================================================

/**
 * 인덱스 성능 대시보드 - 전체 현황
 */
exports.getIndexPerformanceDashboard = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      console.log('📊 인덱스 성능 대시보드 요청');
      
      // 인덱스 사용률 통계 수집
      const indexStats = await collectIndexUsageStats();
      
      // 성능 테스트 실행
      const performanceResults = await runPerformanceTests();
      
      // 효과 분석 보고서 생성
      const report = generateIndexEffectivenessReport(indexStats, performanceResults);
      
      res.json({
        success: true,
        data: {
          report,
          indexStats,
          performanceResults,
          timestamp: new Date()
        }
      });
      
    } catch (error) {
      console.error('인덱스 성능 대시보드 오류:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
});

/**
 * 실시간 인덱스 상태 체크
 */
exports.checkIndexStatus = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      console.log('🔍 인덱스 상태 체크 요청');
      
      const indexStats = await collectIndexUsageStats();
      
      const summary = {
        totalIndexes: MONITORED_INDEXES.length,
        activeIndexes: indexStats.filter(s => s.status === 'ACTIVE').length,
        errorIndexes: indexStats.filter(s => s.status === 'ERROR').length,
        notFoundIndexes: indexStats.filter(s => s.status === 'NOT_FOUND').length,
        lastChecked: new Date()
      };
      
      res.json({
        success: true,
        data: {
          summary,
          details: indexStats
        }
      });
      
    } catch (error) {
      console.error('인덱스 상태 체크 오류:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
});

/**
 * 성능 테스트 실행
 */
exports.runIndexPerformanceTest = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      console.log('🏃‍♂️ 인덱스 성능 테스트 실행');
      
      const results = await runPerformanceTests();
      
      const summary = {
        totalTests: results.length,
        excellentQueries: results.filter(r => r.status === 'EXCELLENT').length,
        goodQueries: results.filter(r => r.status === 'GOOD').length,
        poorQueries: results.filter(r => r.status === 'POOR').length,
        errorQueries: results.filter(r => r.status === 'ERROR').length,
        avgExecutionTime: Math.round(
          results.filter(r => r.executionTime)
            .reduce((sum, r) => sum + r.executionTime, 0) / 
          results.filter(r => r.executionTime).length
        ) || 0
      };
      
      res.json({
        success: true,
        data: {
          summary,
          results
        }
      });
      
    } catch (error) {
      console.error('성능 테스트 실행 오류:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
});

/**
 * 인덱스 모니터링 시스템 상태
 */
exports.getIndexMonitoringStatus = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const status = {
        systemStatus: 'ACTIVE',
        monitoredIndexes: MONITORED_INDEXES.length,
        performanceQueries: PERFORMANCE_TEST_QUERIES.length,
        features: [
          'Real-time index usage statistics',
          'Query execution plan analysis',
          'Performance testing automation',
          'Index effectiveness reporting',
          'Slow query detection',
          'Performance recommendations'
        ],
        endpoints: [
          '/getIndexPerformanceDashboard - 전체 대시보드',
          '/checkIndexStatus - 인덱스 상태 체크',
          '/runIndexPerformanceTest - 성능 테스트 실행',
          '/getIndexMonitoringStatus - 시스템 상태'
        ],
        lastUpdate: new Date()
      };
      
      res.json({
        success: true,
        data: status
      });
      
    } catch (error) {
      console.error('모니터링 시스템 상태 오류:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
});
