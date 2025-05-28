/**
 * Index Performance Monitoring System
 * Task 3.2: 인덱스 성능 모니터링 시스템
 * 
 * 생성된 인덱스의 성능을 실시간으로 모니터링하고
 * 성능 개선 효과를 측정하며 보고서를 생성합니다.
 */

const mysql = require('mysql2/promise');
const MetricsCollector = require('./src/monitoring/MetricsCollector');
const AlertSystem = require('./src/monitoring/AlertSystem');
require('dotenv').config();

// 데이터베이스 연결 설정
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  ssl: false
};

// Task 3.1에서 생성된 인덱스 목록
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

// 성능 테스트 쿼리 목록
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

class IndexPerformanceMonitor {
  constructor() {
    this.connection = null;
    this.metricsCollector = new MetricsCollector();
    this.alertSystem = new AlertSystem();
    
    this.performanceHistory = new Map();
    this.indexUsageStats = new Map();
    this.alertThresholds = {
      slowQueryTime: 200,        // 200ms 이상이면 느린 쿼리
      performanceDegradation: 50, // 50% 이상 성능 저하시 알림
      indexNotUsed: 24 * 60 * 60 * 1000 // 24시간 동안 사용되지 않으면 알림
    };
    
    this.monitoringStats = {
      totalChecks: 0,
      slowQueries: 0,
      indexHits: 0,
      indexMisses: 0,
      alerts: 0,
      lastCheck: null
    };
    
    console.log('IndexPerformanceMonitor initialized');
  }

  async connect() {
    try {
      this.connection = await mysql.createConnection(dbConfig);
      console.log('✅ 데이터베이스 연결 성공');
      return true;
    } catch (error) {
      console.error('❌ 데이터베이스 연결 실패:', error.message);
      return false;
    }
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      console.log('✅ 데이터베이스 연결 종료');
    }
  }

  /**
   * 인덱스 사용률 통계 수집
   */
  async collectIndexUsageStats() {
    try {
      console.log('📊 인덱스 사용률 통계 수집 중...');
      
      for (const index of MONITORED_INDEXES) {
        // 인덱스 통계 조회
        const [stats] = await this.connection.execute(
          `SELECT 
            INDEX_NAME, 
            CARDINALITY,
            SEQ_IN_INDEX,
            COLUMN_NAME
           FROM INFORMATION_SCHEMA.STATISTICS 
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
          [process.env.DB_NAME, index.table, index.name]
        );
        
        if (stats.length > 0) {
          this.indexUsageStats.set(index.name, {
            cardinality: stats[0].CARDINALITY,
            columns: stats.map(s => s.COLUMN_NAME),
            lastChecked: new Date(),
            status: 'ACTIVE'
          });
          
          console.log(`✅ ${index.name}: Cardinality ${stats[0].CARDINALITY}`);
        } else {
          console.log(`⚠️ ${index.name}: 통계 정보 없음`);
          this.indexUsageStats.set(index.name, {
            status: 'NOT_FOUND',
            lastChecked: new Date()
          });
        }
      }
      
    } catch (error) {
      console.error('❌ 인덱스 통계 수집 실패:', error.message);
    }
  }

  /**
   * 쿼리 실행 계획 분석
   */
  async analyzeQueryPlan(sql, queryId) {
    try {
      const [plan] = await this.connection.execute(`EXPLAIN ${sql}`);
      
      const analysis = {
        queryId,
        timestamp: new Date(),
        usedIndexes: [],
        fullTableScans: 0,
        estimatedRows: 0,
        performance: 'UNKNOWN'
      };
      
      for (const row of plan) {
        if (row.key) {
          analysis.usedIndexes.push(row.key);
          this.monitoringStats.indexHits++;
        } else {
          analysis.fullTableScans++;
          this.monitoringStats.indexMisses++;
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
      console.error(`❌ 쿼리 실행 계획 분석 실패 (${queryId}):`, error.message);
      return null;
    }
  }

  /**
   * 성능 테스트 실행
   */
  async runPerformanceTests() {
    console.log('\n🏃‍♂️ 인덱스 성능 테스트 실행...');
    
    const results = [];
    
    for (const testQuery of PERFORMANCE_TEST_QUERIES) {
      try {
        console.log(`\n🔍 테스트: ${testQuery.name}`);
        
        // 쿼리 실행 계획 분석
        const planAnalysis = await this.analyzeQueryPlan(testQuery.sql, testQuery.id);
        
        // 실행 시간 측정
        const startTime = Date.now();
        await this.connection.execute(testQuery.sql);
        const executionTime = Date.now() - startTime;
        
        // 결과 분석
        const result = {
          queryId: testQuery.id,
          name: testQuery.name,
          executionTime,
          targetTime: testQuery.targetTime,
          relatedIndex: testQuery.relatedIndex,
          category: testQuery.category,
          planAnalysis,
          status: this.getPerformanceStatus(executionTime, testQuery.targetTime),
          improvement: this.calculateImprovement(testQuery.id, executionTime),
          timestamp: new Date()
        };
        
        results.push(result);
        
        // 성능 히스토리 저장
        if (!this.performanceHistory.has(testQuery.id)) {
          this.performanceHistory.set(testQuery.id, []);
        }
        this.performanceHistory.get(testQuery.id).push({
          executionTime,
          timestamp: new Date()
        });
        
        // 상태 출력
        const statusIcon = this.getStatusIcon(result.status);
        console.log(`${statusIcon} ${testQuery.name}: ${executionTime}ms (목표: ${testQuery.targetTime}ms)`);
        
        if (planAnalysis && planAnalysis.usedIndexes.length > 0) {
          console.log(`   📊 사용된 인덱스: ${planAnalysis.usedIndexes.join(', ')}`);
          console.log(`   📈 성능 등급: ${planAnalysis.performance}`);
        }
        
        // 슬로우 쿼리 감지
        if (executionTime > this.alertThresholds.slowQueryTime) {
          this.monitoringStats.slowQueries++;
          await this.alertSystem.sendAlert({
            type: 'SLOW_QUERY',
            severity: 'WARNING',
            message: `슬로우 쿼리 감지: ${testQuery.name} (${executionTime}ms)`,
            details: { queryId: testQuery.id, executionTime, targetTime: testQuery.targetTime }
          });
        }
        
      } catch (error) {
        console.error(`❌ ${testQuery.name} 테스트 실패:`, error.message);
        results.push({
          queryId: testQuery.id,
          name: testQuery.name,
          status: 'ERROR',
          error: error.message,
          timestamp: new Date()
        });
      }
    }
    
    this.monitoringStats.totalChecks++;
    this.monitoringStats.lastCheck = new Date();
    
    return results;
  }

  /**
   * 성능 상태 판정
   */
  getPerformanceStatus(executionTime, targetTime) {
    if (executionTime <= targetTime) return 'EXCELLENT';
    if (executionTime <= targetTime * 1.5) return 'GOOD';
    if (executionTime <= targetTime * 2) return 'FAIR';
    return 'POOR';
  }

  /**
   * 상태 아이콘 반환
   */
  getStatusIcon(status) {
    const icons = {
      'EXCELLENT': '🚀',
      'GOOD': '✅',
      'FAIR': '⚠️',
      'POOR': '🚨',
      'ERROR': '❌'
    };
    return icons[status] || '❓';
  }

  /**
   * 성능 개선률 계산
   */
  calculateImprovement(queryId, currentTime) {
    const history = this.performanceHistory.get(queryId);
    if (!history || history.length < 2) return null;
    
    const previousTime = history[history.length - 2].executionTime;
    const improvement = ((previousTime - currentTime) / previousTime) * 100;
    
    return {
      previousTime,
      currentTime,
      improvementPercent: Math.round(improvement * 100) / 100
    };
  }

  /**
   * 인덱스 효과 분석 보고서 생성
   */
  generateIndexEffectivenessReport() {
    console.log('\n📋 인덱스 효과 분석 보고서');
    console.log('='.repeat(60));
    
    const report = {
      summary: {
        totalIndexes: MONITORED_INDEXES.length,
        activeIndexes: 0,
        effectiveIndexes: 0,
        totalChecks: this.monitoringStats.totalChecks,
        slowQueries: this.monitoringStats.slowQueries,
        indexHitRate: 0
      },
      indexDetails: [],
      queryPerformance: [],
      recommendations: []
    };
    
    // 인덱스별 효과 분석
    console.log('\n🔍 인덱스별 효과 분석:');
    for (const index of MONITORED_INDEXES) {
      const usage = this.indexUsageStats.get(index.name);
      const relatedQueries = PERFORMANCE_TEST_QUERIES.filter(q => q.relatedIndex === index.name);
      
      let effectiveness = 'UNKNOWN';
      let avgPerformance = 0;
      
      if (relatedQueries.length > 0) {
        const performances = relatedQueries.map(q => {
          const history = this.performanceHistory.get(q.id);
          return history && history.length > 0 ? history[history.length - 1].executionTime : null;
        }).filter(p => p !== null);
        
        if (performances.length > 0) {
          avgPerformance = performances.reduce((a, b) => a + b, 0) / performances.length;
          
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
        avgPerformance,
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
      
      const effectIcon = this.getStatusIcon(effectiveness);
      console.log(`${effectIcon} ${index.name} (${index.priority}): ${effectiveness}`);
      if (avgPerformance > 0) {
        console.log(`   평균 성능: ${Math.round(avgPerformance)}ms`);
      }
    }
    
    // 히트율 계산
    const totalIndexOperations = this.monitoringStats.indexHits + this.monitoringStats.indexMisses;
    if (totalIndexOperations > 0) {
      report.summary.indexHitRate = Math.round((this.monitoringStats.indexHits / totalIndexOperations) * 100);
    }
    
    // 쿼리 성능 요약
    console.log('\n📊 쿼리 성능 요약:');
    for (const [queryId, history] of this.performanceHistory) {
      if (history.length > 0) {
        const latest = history[history.length - 1];
        const testQuery = PERFORMANCE_TEST_QUERIES.find(q => q.id === queryId);
        
        if (testQuery) {
          const status = this.getPerformanceStatus(latest.executionTime, testQuery.targetTime);
          const statusIcon = this.getStatusIcon(status);
          
          console.log(`${statusIcon} ${testQuery.name}: ${latest.executionTime}ms`);
          
          report.queryPerformance.push({
            queryId,
            name: testQuery.name,
            latestTime: latest.executionTime,
            targetTime: testQuery.targetTime,
            status
          });
        }
      }
    }
    
    // 전체 통계
    console.log('\n📈 전체 모니터링 통계:');
    console.log(`   총 인덱스: ${report.summary.totalIndexes}개`);
    console.log(`   활성 인덱스: ${report.summary.activeIndexes}개`);
    console.log(`   효과적 인덱스: ${report.summary.effectiveIndexes}개`);
    console.log(`   인덱스 히트율: ${report.summary.indexHitRate}%`);
    console.log(`   총 검사 횟수: ${report.summary.totalChecks}회`);
    console.log(`   슬로우 쿼리: ${report.summary.slowQueries}개`);
    
    // 추천사항 생성
    this.generateRecommendations(report);
    
    return report;
  }

  /**
   * 추천사항 생성
   */
  generateRecommendations(report) {
    console.log('\n💡 추천사항:');
    
    // 비효율적인 인덱스 식별
    const ineffectiveIndexes = report.indexDetails.filter(idx => 
      idx.effectiveness === 'POOR' || idx.effectiveness === 'FAIR'
    );
    
    if (ineffectiveIndexes.length > 0) {
      console.log('   🔧 다음 인덱스들의 최적화가 필요합니다:');
      ineffectiveIndexes.forEach(idx => {
        console.log(`      - ${idx.name}: ${idx.effectiveness} (평균 ${Math.round(idx.avgPerformance)}ms)`);
        report.recommendations.push({
          type: 'OPTIMIZE_INDEX',
          index: idx.name,
          reason: `성능이 ${idx.effectiveness} 수준입니다.`
        });
      });
    }
    
    // 슬로우 쿼리 많은 경우
    if (report.summary.slowQueries > 0) {
      console.log(`   ⚠️ ${report.summary.slowQueries}개의 슬로우 쿼리가 감지되었습니다.`);
      report.recommendations.push({
        type: 'INVESTIGATE_SLOW_QUERIES',
        count: report.summary.slowQueries,
        reason: '추가 인덱스나 쿼리 최적화가 필요할 수 있습니다.'
      });
    }
    
    // 인덱스 히트율이 낮은 경우
    if (report.summary.indexHitRate < 80) {
      console.log(`   📊 인덱스 히트율이 ${report.summary.indexHitRate}%로 낮습니다.`);
      report.recommendations.push({
        type: 'IMPROVE_INDEX_USAGE',
        hitRate: report.summary.indexHitRate,
        reason: '쿼리 패턴 분석 및 추가 인덱스 검토가 필요합니다.'
      });
    }
    
    // 모든 것이 양호한 경우
    if (report.recommendations.length === 0) {
      console.log('   ✅ 모든 인덱스가 효과적으로 작동하고 있습니다!');
      report.recommendations.push({
        type: 'EXCELLENT_PERFORMANCE',
        reason: '현재 인덱스 설정이 최적화되어 있습니다.'
      });
    }
  }

  /**
   * 실시간 모니터링 시작
   */
  async startContinuousMonitoring(intervalMinutes = 30) {
    console.log(`\n🔄 실시간 모니터링 시작 (${intervalMinutes}분 간격)`);
    
    const monitoringInterval = setInterval(async () => {
      try {
        console.log('\n⏰ 정기 성능 검사 실행...');
        
        await this.collectIndexUsageStats();
        const performanceResults = await this.runPerformanceTests();
        
        // 성능 저하 감지
        for (const result of performanceResults) {
          if (result.improvement && result.improvement.improvementPercent < -this.alertThresholds.performanceDegradation) {
            await this.alertSystem.sendAlert({
              type: 'PERFORMANCE_DEGRADATION',
              severity: 'WARNING',
              message: `성능 저하 감지: ${result.name} (${Math.abs(result.improvement.improvementPercent)}% 저하)`,
              details: result
            });
          }
        }
        
        console.log('✅ 정기 검사 완료');
        
      } catch (error) {
        console.error('❌ 정기 모니터링 중 오류:', error.message);
      }
    }, intervalMinutes * 60 * 1000);
    
    // 프로세스 종료시 정리
    process.on('SIGINT', () => {
      console.log('\n🛑 모니터링 중단...');
      clearInterval(monitoringInterval);
      this.disconnect();
      process.exit(0);
    });
    
    return monitoringInterval;
  }

  /**
   * 성능 보고서를 JSON 파일로 저장
   */
  async savePerformanceReport() {
    try {
      const report = this.generateIndexEffectivenessReport();
      
      const fs = require('fs').promises;
      const reportPath = `../docs/index_performance_report_${new Date().toISOString().split('T')[0]}.json`;
      
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📄 성능 보고서 저장: ${reportPath}`);
      
      return reportPath;
      
    } catch (error) {
      console.error('❌ 보고서 저장 실패:', error.message);
      return null;
    }
  }
}

// 메인 실행 함수
async function main() {
  const monitor = new IndexPerformanceMonitor();
  
  try {
    console.log('🚀 인덱스 성능 모니터링 시스템 시작');
    
    // 데이터베이스 연결
    if (!await monitor.connect()) {
      process.exit(1);
    }
    
    // 인덱스 사용률 통계 수집
    await monitor.collectIndexUsageStats();
    
    // 성능 테스트 실행
    await monitor.runPerformanceTests();
    
    // 효과 분석 보고서 생성
    const report = monitor.generateIndexEffectivenessReport();
    
    // 보고서 저장
    await monitor.savePerformanceReport();
    
    console.log('\n🎯 모니터링 시스템 준비 완료!');
    console.log('   - 실시간 모니터링: startContinuousMonitoring() 호출');
    console.log('   - 개별 테스트: runPerformanceTests() 호출');
    console.log('   - 보고서 생성: generateIndexEffectivenessReport() 호출');
    
  } catch (error) {
    console.error('❌ 모니터링 시스템 실행 중 오류:', error);
  } finally {
    await monitor.disconnect();
  }
}

// 스크립트가 직접 실행될 때만 main() 호출
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { IndexPerformanceMonitor, MONITORED_INDEXES, PERFORMANCE_TEST_QUERIES };
