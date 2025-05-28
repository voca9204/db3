/**
 * DB3 성능 테스트 - 현재 시스템 성능 측정
 * 인덱싱 시스템 구현 전 베이스라인 성능 측정
 */

const { executeQuery, queryOne } = require('./db');

// 성능 측정 결과 저장
const performanceResults = {
  tests: [],
  summary: {},
  startTime: Date.now()
};

/**
 * 성능 측정 함수
 */
const measurePerformance = async (testName, queryFn) => {
  const start = process.hrtime.bigint();
  
  try {
    console.log(`🧪 ${testName}...`);
    const result = await queryFn();
    
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1_000_000; // 나노초를 밀리초로 변환
    
    const testResult = {
      name: testName,
      duration: duration.toFixed(2),
      success: true,
      resultCount: Array.isArray(result) ? result.length : (result ? 1 : 0),
      timestamp: new Date().toISOString()
    };
    
    performanceResults.tests.push(testResult);
    
    console.log(`   ✅ 완료: ${duration.toFixed(2)}ms (결과: ${testResult.resultCount}개)`);
    return result;
    
  } catch (error) {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1_000_000;
    
    const testResult = {
      name: testName,
      duration: duration.toFixed(2),
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
    
    performanceResults.tests.push(testResult);
    
    console.log(`   ❌ 실패: ${duration.toFixed(2)}ms - ${error.message}`);
    throw error;
  }
};

/**
 * 기본 연결 테스트
 */
const testBasicConnection = async () => {
  return await measurePerformance('기본 데이터베이스 연결', async () => {
    return await queryOne('SELECT 1 as test_value, NOW() as server_time');
  });
};

/**
 * 테이블 구조 확인
 */
const testTableStructure = async () => {
  return await measurePerformance('테이블 구조 조회', async () => {
    return await executeQuery('SHOW TABLES');
  });
};

/**
 * 기본 통계 조회
 */
const testBasicStats = async () => {
  return await measurePerformance('기본 통계 조회', async () => {
    const stats = {};
    
    // 각 테이블의 레코드 수 조회
    const tables = ['players', 'game_scores', 'money_flows', 'promotion_players', 'player_guilds'];
    
    for (const table of tables) {
      try {
        const result = await queryOne(`SELECT COUNT(*) as count FROM ${table}`);
        stats[table] = result.count;
      } catch (error) {
        stats[table] = `Error: ${error.message}`;
      }
    }
    
    return stats;
  });
};

/**
 * 단순 SELECT 쿼리 테스트
 */
const testSimpleSelect = async () => {
  return await measurePerformance('단순 SELECT 쿼리 (LIMIT 10)', async () => {
    return await executeQuery('SELECT userId, status FROM players LIMIT 10');
  });
};

/**
 * WHERE 조건 포함 쿼리 테스트
 */
const testWhereQuery = async () => {
  return await measurePerformance('WHERE 조건 포함 쿼리', async () => {
    return await executeQuery('SELECT userId FROM players WHERE status = ? LIMIT 20', [0]);
  });
};

/**
 * JOIN 쿼리 테스트 (성능 중요)
 */
const testJoinQuery = async () => {
  return await measurePerformance('JOIN 쿼리 테스트', async () => {
    const sql = `
      SELECT p.userId, COUNT(gs.gameDate) as game_days, ROUND(SUM(gs.netBet)) as total_bet
      FROM players p
      LEFT JOIN game_scores gs ON p.userId = gs.userId
      WHERE p.status = ?
      GROUP BY p.userId
      LIMIT 10
    `;
    return await executeQuery(sql, [0]);
  });
};

/**
 * 복잡한 집계 쿼리 테스트
 */
const testComplexAggregation = async () => {
  return await measurePerformance('복잡한 집계 쿼리', async () => {
    const sql = `
      SELECT 
        p.userId,
        COUNT(DISTINCT gs.gameDate) as total_game_days,
        ROUND(SUM(gs.netBet)) as total_net_bet,
        ROUND(SUM(gs.winLoss)) as total_win_loss,
        MAX(gs.gameDate) as last_game_date
      FROM players p
      LEFT JOIN game_scores gs ON p.userId = gs.userId
      WHERE p.status = ? AND gs.gameDate >= DATE_SUB(NOW(), INTERVAL 90 DAY)
      GROUP BY p.userId
      HAVING total_net_bet > 10000
      ORDER BY total_net_bet DESC
      LIMIT 20
    `;
    return await executeQuery(sql, [0]);
  });
};

/**
 * 날짜 범위 검색 테스트
 */
const testDateRangeQuery = async () => {
  return await measurePerformance('날짜 범위 검색', async () => {
    const sql = `
      SELECT gameDate, COUNT(*) as daily_players, ROUND(SUM(netBet)) as daily_bet
      FROM game_scores
      WHERE gameDate >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY gameDate
      ORDER BY gameDate DESC
      LIMIT 30
    `;
    return await executeQuery(sql);
  });
};

/**
 * 이벤트 참여 분석 쿼리
 */
const testEventAnalysisQuery = async () => {
  return await measurePerformance('이벤트 참여 분석', async () => {
    const sql = `
      SELECT 
        p.userId,
        COUNT(pp.promotion) as event_count,
        ROUND(SUM(pp.reward)) as total_rewards,
        COUNT(CASE WHEN pp.appliedAt IS NOT NULL THEN 1 END) as applied_events
      FROM players p
      LEFT JOIN promotion_players pp ON p.id = pp.player
      WHERE p.status = ?
      GROUP BY p.userId
      HAVING event_count > 0
      ORDER BY total_rewards DESC
      LIMIT 15
    `;
    return await executeQuery(sql, [0]);
  });
};

/**
 * 휴면 사용자 분석 쿼리 (무거운 쿼리)
 */
const testDormantUsersQuery = async () => {
  return await measurePerformance('휴면 사용자 분석 (무거운 쿼리)', async () => {
    const sql = `
      SELECT 
        p.userId,
        COUNT(DISTINCT gs.gameDate) as total_game_days,
        ROUND(SUM(gs.netBet)) as total_net_bet,
        MIN(gs.gameDate) as first_game_date,
        MAX(gs.gameDate) as last_game_date,
        DATEDIFF(CURDATE(), MAX(gs.gameDate)) as dormant_days
      FROM players p
      JOIN game_scores gs ON p.userId = gs.userId
      WHERE p.status = ?
      GROUP BY p.userId
      HAVING total_game_days >= 5 
        AND total_net_bet >= 10000
        AND dormant_days > 30
      ORDER BY total_net_bet DESC
      LIMIT 10
    `;
    return await executeQuery(sql, [0]);
  });
};

/**
 * 결과 요약 및 분석
 */
const analyzePerfromanceResults = () => {
  const successfulTests = performanceResults.tests.filter(t => t.success);
  const failedTests = performanceResults.tests.filter(t => !t.success);
  
  const durations = successfulTests.map(t => parseFloat(t.duration));
  const totalDuration = Date.now() - performanceResults.startTime;
  
  performanceResults.summary = {
    totalTests: performanceResults.tests.length,
    successfulTests: successfulTests.length,
    failedTests: failedTests.length,
    successRate: ((successfulTests.length / performanceResults.tests.length) * 100).toFixed(1),
    
    avgDuration: durations.length > 0 ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2) : 0,
    minDuration: durations.length > 0 ? Math.min(...durations).toFixed(2) : 0,
    maxDuration: durations.length > 0 ? Math.max(...durations).toFixed(2) : 0,
    
    totalTestDuration: totalDuration,
    timestamp: new Date().toISOString()
  };
  
  return performanceResults;
};

/**
 * 성능 결과 출력
 */
const printResults = () => {
  const results = analyzePerfromanceResults();
  
  console.log('\n📊 === DB3 성능 테스트 결과 ===\n');
  
  console.log(`🔍 테스트 개요:`);
  console.log(`   총 테스트: ${results.summary.totalTests}개`);
  console.log(`   성공: ${results.summary.successfulTests}개`);
  console.log(`   실패: ${results.summary.failedTests}개`);
  console.log(`   성공률: ${results.summary.successRate}%`);
  console.log(`   총 소요시간: ${results.summary.totalTestDuration}ms\n`);
  
  console.log(`⚡ 쿼리 성능:`);
  console.log(`   평균 응답시간: ${results.summary.avgDuration}ms`);
  console.log(`   최소 응답시간: ${results.summary.minDuration}ms`);
  console.log(`   최대 응답시간: ${results.summary.maxDuration}ms\n`);
  
  console.log(`📋 개별 테스트 결과:`);
  results.tests.forEach((test, index) => {
    const status = test.success ? '✅' : '❌';
    const duration = `${test.duration}ms`;
    const resultInfo = test.success ? `(${test.resultCount}개 결과)` : `(${test.error})`;
    console.log(`   ${index + 1}. ${status} ${test.name}: ${duration} ${resultInfo}`);
  });
  
  console.log('\n🎯 성능 분석:');
  
  const slowQueries = results.tests.filter(t => t.success && parseFloat(t.duration) > 1000);
  if (slowQueries.length > 0) {
    console.log(`   ⚠️  느린 쿼리 (1초 이상): ${slowQueries.length}개`);
    slowQueries.forEach(q => {
      console.log(`      - ${q.name}: ${q.duration}ms`);
    });
  } else {
    console.log(`   ✅ 모든 쿼리가 1초 이내에 완료됨`);
  }
  
  const fastQueries = results.tests.filter(t => t.success && parseFloat(t.duration) < 100);
  console.log(`   🚀 빠른 쿼리 (100ms 미만): ${fastQueries.length}개`);
  
  console.log('\n💡 인덱싱 권장사항:');
  
  const joinTests = results.tests.filter(t => t.name.includes('JOIN') || t.name.includes('집계') || t.name.includes('휴면'));
  if (joinTests.some(t => parseFloat(t.duration) > 500)) {
    console.log(`   📈 JOIN 및 집계 쿼리 최적화 필요 - 인덱스 추가 권장`);
    console.log(`   🎯 추천 인덱스:`);
    console.log(`      - players(userId, status)`);
    console.log(`      - game_scores(userId, gameDate)`);
    console.log(`      - game_scores(gameDate)`);
    console.log(`      - promotion_players(player, appliedAt)`);
  } else {
    console.log(`   ✅ 현재 성능 수준 양호 - 예방적 인덱싱 권장`);
  }
  
  console.log('\n🔧 다음 단계:');
  console.log(`   1. 데이터베이스 인덱싱 시스템 구현 (Task 3)`);
  console.log(`   2. 자동 인덱스 생성 및 관리`);
  console.log(`   3. 성능 모니터링 강화`);
  console.log(`   4. 최적화 효과 측정`);
  
  return results;
};

/**
 * 메인 테스트 실행
 */
const runPerformanceTests = async () => {
  console.log('🚀 DB3 성능 테스트 시작...\n');
  console.log('📅 테스트 시작 시간:', new Date().toLocaleString('ko-KR'));
  console.log('🎯 목적: 인덱싱 시스템 구현 전 베이스라인 성능 측정\n');
  
  try {
    // 1. 기본 연결 테스트
    await testBasicConnection();
    
    // 2. 테이블 구조 확인
    const tables = await testTableStructure();
    console.log(`   📋 발견된 테이블: ${tables.length}개`);
    
    // 3. 기본 통계
    const stats = await testBasicStats();
    console.log(`   📊 데이터 현황:`, stats);
    
    // 4. 단순 쿼리 테스트
    await testSimpleSelect();
    await testWhereQuery();
    
    // 5. 복잡한 쿼리 테스트 (성능 중요)
    await testJoinQuery();
    await testComplexAggregation();
    await testDateRangeQuery();
    await testEventAnalysisQuery();
    
    // 6. 무거운 쿼리 테스트
    await testDormantUsersQuery();
    
    // 결과 분석 및 출력
    return printResults();
    
  } catch (error) {
    console.error('💥 성능 테스트 중 오류 발생:', error.message);
    
    // 부분 결과라도 출력
    if (performanceResults.tests.length > 0) {
      console.log('\n📊 부분 테스트 결과:');
      printResults();
    }
    
    throw error;
  }
};

// 스크립트 직접 실행 시
if (require.main === module) {
  runPerformanceTests()
    .then((results) => {
      console.log('\n✨ 성능 테스트 완료!');
      console.log(`📄 결과 파일: ${JSON.stringify(results.summary, null, 2)}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 성능 테스트 실패:', error);
      process.exit(1);
    });
}

module.exports = { runPerformanceTests, performanceResults };
