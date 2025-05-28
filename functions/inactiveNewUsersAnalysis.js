/**
 * 가입 후 미활성 사용자 분석 API
 * 최근 1년 이내 가입 + 게임 실적 없는 사용자 분석
 */

const { executeQuery } = require('./db');

async function getInactiveNewUsers() {
  console.log('🔍 가입 후 미활성 사용자 분석 시작...\n');
  
  try {
    // 1단계: 기본 미활성 사용자 정보 가져오기 (대표ID는 가장 최근 게임실적 계정)
    const baseSql = `
      SELECT 
        p.userId,
        pg.guild as representative_id_hash,
        rep.userId as representative_userId,
        rep.createdAt as representative_created_at,
        p.createdAt as join_date,
        CASE 
          WHEN p.createdAt >= DATE_SUB(NOW(), INTERVAL 1 MONTH) THEN '1달이내'
          WHEN p.createdAt >= DATE_SUB(NOW(), INTERVAL 6 MONTH) THEN '1-6개월'
          WHEN p.createdAt >= DATE_SUB(NOW(), INTERVAL 12 MONTH) THEN '7-12개월'
          ELSE '기타'
        END as join_period,
        DATEDIFF(NOW(), p.createdAt) as days_since_join
      FROM players p
      LEFT JOIN player_guilds pg ON p.id = pg.player
      LEFT JOIN (
        -- 각 guild의 대표 계정 찾기 (가장 최근에 게임실적이 있는 계정)
        SELECT 
          pg1.guild,
          p1.userId,
          p1.createdAt
        FROM player_guilds pg1
        JOIN players p1 ON pg1.player = p1.id
        JOIN (
          SELECT 
            pg2.guild,
            MAX(gs.gameDate) as latest_game_date
          FROM player_guilds pg2
          JOIN players p2 ON pg2.player = p2.id
          JOIN game_scores gs ON p2.userId = gs.userId
          GROUP BY pg2.guild
        ) latest_game ON pg1.guild = latest_game.guild
        JOIN game_scores gs1 ON p1.userId = gs1.userId AND gs1.gameDate = latest_game.latest_game_date
      ) rep ON pg.guild = rep.guild
      LEFT JOIN game_scores gs ON p.userId = gs.userId
      WHERE p.createdAt >= DATE_SUB(NOW(), INTERVAL 1 YEAR)
        AND gs.userId IS NULL
        AND p.status = 0
        AND (
          pg.guild IS NULL OR  -- 대표ID가 없는 경우는 포함
          rep.userId IS NULL OR  -- 대표 계정을 찾을 수 없는 경우 포함
          p.createdAt >= rep.createdAt  -- 대표ID보다 늦게 생성된 경우만 포함
        )
      ORDER BY p.createdAt DESC
    `;
    
    console.log('📊 1단계: 기본 사용자 정보 쿼리 실행 중...');
    const startTime = Date.now();
    
    const baseResults = await executeQuery(baseSql, [], { 
      timeout: 30000,
      maxAttempts: 1
    });
    
    console.log(`✅ 1단계 완료: ${Date.now() - startTime}ms\n`);
    
    // 2단계: 대표ID가 있는 경우 그룹의 netBet 합계 가져오기
    const guildsWithData = [...new Set(baseResults
      .filter(r => r.representative_id_hash)
      .map(r => r.representative_id_hash))];
    
    let netBetData = {};
    
    if (guildsWithData.length > 0) {
      console.log('📊 2단계: netBet 합계 쿼리 실행 중...');
      const netBetSql = `
        SELECT 
          pg.guild,
          SUM(COALESCE(gs.netBet, 0)) as total_netbet
        FROM player_guilds pg
        JOIN players p ON pg.player = p.id
        LEFT JOIN game_scores gs ON p.userId = gs.userId
        WHERE pg.guild IN (${guildsWithData.map(() => '?').join(',')})
        GROUP BY pg.guild
      `;
      
      const netBetResults = await executeQuery(netBetSql, guildsWithData, { 
        timeout: 30000,
        maxAttempts: 1
      });
      
      // netBet 데이터를 맵으로 변환
      netBetData = netBetResults.reduce((acc, row) => {
        acc[row.guild] = row.total_netbet || 0;
        return acc;
      }, {});
      
      console.log(`✅ 2단계 완료: ${Date.now() - startTime}ms\n`);
    }
    
    // 3단계: 결과 결합
    const results = baseResults.map(user => ({
      ...user,
      group_total_netbet: user.representative_id_hash ? 
        (netBetData[user.representative_id_hash] || 0) : 0
    }));
    
    const duration = Date.now() - startTime;
    console.log(`✅ 전체 쿼리 완료: ${duration}ms\n`);
    
    // 결과 분석
    const analysis = {
      total: results.length,
      byPeriod: {
        '1달이내': results.filter(r => r.join_period === '1달이내').length,
        '1-6개월': results.filter(r => r.join_period === '1-6개월').length,
        '7-12개월': results.filter(r => r.join_period === '7-12개월').length
      },
      withRepresentativeId: results.filter(r => r.representative_userId).length,
      withoutRepresentativeId: results.filter(r => !r.representative_userId).length
    };
    
    // 대표ID별 그룹핑 (실제 userId 기준)
    const groupedByRepId = results
      .filter(r => r.representative_userId)
      .reduce((acc, user) => {
        const repUserId = user.representative_userId;
        if (!acc[repUserId]) acc[repUserId] = [];
        acc[repUserId].push(user);
        return acc;
      }, {});
    
    return {
      success: true,
      data: results,
      analysis: analysis,
      groupedByRepId: groupedByRepId,
      performance: {
        queryTime: duration,
        resultCount: results.length
      }
    };
    
  } catch (error) {
    console.error('❌ 분석 실패:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// 스크립트 직접 실행
if (require.main === module) {
  getInactiveNewUsers()
    .then((result) => {
      if (result.success) {
        console.log('\n✨ 분석 완료!');
      } else {
        console.log('\n💥 분석 실패!');
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('스크립트 실행 오류:', error);
      process.exit(1);
    });
}

module.exports = { getInactiveNewUsers };
