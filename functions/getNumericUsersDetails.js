/**
 * 숫자 유저ID들의 상세 정보 조회 스크립트
 * 전화번호, 위챗, 총유효배팅 정보
 */

// .env 파일 로드
require('dotenv').config();

const { executeQuery } = require('./db');

// 이전에 조회한 숫자 유저ID 목록
const numericUserIds = [
  '409842', '4561270042', '4561270044', '45612710005', '45612710006', '45612710007',
  '45612710009', '45612710010', '45612710011', '45612710012', '45612710013', '45612710014',
  '45612710015', '45612710017', '45612710020', '45612710021', '45612710022', '45612710023',
  '45612710024', '45612710025', '45612710026', '45612710027', '45612710028', '45612710029',
  '45612710030', '45612710031', '45612710033', '45612710035', '45612710036', '45612710038',
  '45612710039', '45612710041', '45612710043', '45612710045', '45612710046', '45612710048',
  '45612710049', '45612710050', '45612710051', '45612710053', '45612710054', '45612710056',
  '45612710057', '45612710058', '45612710060'
];

async function getNumericUsersDetails() {
  try {
    console.log('🔍 숫자 유저ID들의 상세 정보를 조회합니다...');
    console.log(`📊 조회 대상: ${numericUserIds.length}개 유저ID`);
    
    // 먼저 관련 테이블들 구조 확인
    console.log('\n📋 관련 테이블 구조 확인:');
    
    // player_contacts 테이블 확인
    try {
      const contactsStructure = await executeQuery(`DESCRIBE player_contacts`);
      console.log('\n🔗 player_contacts 테이블:');
      console.table(contactsStructure);
    } catch (error) {
      console.log('\n⚠️ player_contacts 테이블이 존재하지 않습니다.');
    }
    
    // game_scores 테이블 구조 확인 (netBet 필드)
    const gameScoresStructure = await executeQuery(`DESCRIBE game_scores`);
    console.log('\n🎮 game_scores 테이블:');
    console.table(gameScoresStructure.slice(0, 8)); // 처음 8개만 표시
    
    // 숫자 유저ID들의 상세 정보 조회
    const userIdList = numericUserIds.map(id => `'${id}'`).join(',');
    
    const detailQuery = `
      SELECT 
          p.userId as 유저ID,
          p.phoneName as 전화메모,
          p.note as 추가메모,
          
          -- 연락처 정보 (player_contacts 테이블에서)
          MAX(CASE WHEN pc.contactType = 'phone' THEN pc.contact END) as 전화번호,
          MAX(CASE WHEN pc.contactType = 'wechat' THEN pc.contact END) as 위챗ID,
          
          -- 게임 활동 정보
          COUNT(DISTINCT gs.gameDate) as 게임일수,
          ROUND(SUM(gs.netBet)) as 총유효배팅,
          ROUND(SUM(gs.totalBet)) as 총베팅금액,
          ROUND(SUM(gs.winLoss)) as 총손익,
          MIN(gs.gameDate) as 첫게임일,
          MAX(gs.gameDate) as 마지막게임일,
          DATEDIFF(CURDATE(), MAX(gs.gameDate)) as 휴면일수,
          
          -- 연락처 가용성
          CASE 
              WHEN MAX(CASE WHEN pc.contactType = 'phone' THEN pc.contact END) IS NOT NULL 
                   AND MAX(CASE WHEN pc.contactType = 'wechat' THEN pc.contact END) IS NOT NULL 
              THEN 'Both'
              WHEN MAX(CASE WHEN pc.contactType = 'phone' THEN pc.contact END) IS NOT NULL 
              THEN 'Phone'
              WHEN MAX(CASE WHEN pc.contactType = 'wechat' THEN pc.contact END) IS NOT NULL 
              THEN 'WeChat'
              ELSE 'None'
          END as 연락처상태,
          
          -- 활동 상태
          CASE 
              WHEN MAX(gs.gameDate) IS NULL THEN 'No_Game'
              WHEN DATEDIFF(CURDATE(), MAX(gs.gameDate)) <= 30 THEN 'Active'
              ELSE 'Dormant'
          END as 활동상태
          
      FROM players p
      LEFT JOIN player_contacts pc ON p.id = pc.player
      LEFT JOIN game_scores gs ON p.userId = gs.userId
      WHERE p.userId IN (${userIdList})
      GROUP BY p.userId, p.phoneName, p.note
      ORDER BY 총유효배팅 DESC, p.userId
    `;
    
    console.log('\n🔍 상세 정보 조회 중...');
    const userDetails = await executeQuery(detailQuery);
    
    console.log(`\n✅ ${userDetails.length}개 유저 정보 조회 완료`);
    
    if (userDetails.length > 0) {
      // 전체 결과 테이블로 표시
      console.log('\n📊 숫자 유저ID 상세 정보:');
      console.table(userDetails);
      
      // 통계 분석
      const stats = {
        total: userDetails.length,
        hasPhone: userDetails.filter(u => u.전화번호).length,
        hasWechat: userDetails.filter(u => u.위챗ID).length,
        hasBoth: userDetails.filter(u => u.연락처상태 === 'Both').length,
        hasNone: userDetails.filter(u => u.연락처상태 === 'None').length,
        hasGameData: userDetails.filter(u => u.게임일수 > 0).length,
        totalValidBet: userDetails.reduce((sum, u) => sum + (u.총유효배팅 || 0), 0),
        avgValidBet: 0
      };
      
      stats.avgValidBet = stats.hasGameData > 0 ? Math.round(stats.totalValidBet / stats.hasGameData) : 0;
      
      console.log('\n📈 통계 요약:');
      console.log(`- 전체 유저: ${stats.total}명`);
      console.log(`- 전화번호 보유: ${stats.hasPhone}명 (${((stats.hasPhone/stats.total)*100).toFixed(1)}%)`);
      console.log(`- 위챗 보유: ${stats.hasWechat}명 (${((stats.hasWechat/stats.total)*100).toFixed(1)}%)`);
      console.log(`- 둘 다 보유: ${stats.hasBoth}명 (${((stats.hasBoth/stats.total)*100).toFixed(1)}%)`);
      console.log(`- 연락처 없음: ${stats.hasNone}명 (${((stats.hasNone/stats.total)*100).toFixed(1)}%)`);
      console.log(`- 게임 활동: ${stats.hasGameData}명 (${((stats.hasGameData/stats.total)*100).toFixed(1)}%)`);
      console.log(`- 총 유효배팅: ${stats.totalValidBet.toLocaleString()}원`);
      console.log(`- 평균 유효배팅: ${stats.avgValidBet.toLocaleString()}원`);
      
      // 연락처별 분류
      const contactGroups = {
        both: userDetails.filter(u => u.연락처상태 === 'Both'),
        phoneOnly: userDetails.filter(u => u.연락처상태 === 'Phone'),
        wechatOnly: userDetails.filter(u => u.연락처상태 === 'WeChat'),
        none: userDetails.filter(u => u.연락처상태 === 'None')
      };
      
      console.log('\n📞 연락처별 분류:');
      Object.entries(contactGroups).forEach(([type, users]) => {
        if (users.length > 0) {
          console.log(`\n${type.toUpperCase()} (${users.length}명):`);
          users.forEach(user => {
            console.log(`  - ${user.유저ID}: 유효배팅 ${(user.총유효배팅 || 0).toLocaleString()}원`);
          });
        }
      });
      
      // CSV 형태 출력
      console.log('\n📄 CSV 형태 결과:');
      console.log('유저ID,전화번호,위챗ID,총유효배팅,게임일수,연락처상태,활동상태,전화메모,추가메모');
      userDetails.forEach(user => {
        const row = [
          user.유저ID,
          user.전화번호 || '',
          user.위챗ID || '',
          user.총유효배팅 || 0,
          user.게임일수 || 0,
          user.연락처상태,
          user.활동상태,
          (user.전화메모 || '').replace(/,/g, ';'),
          (user.추가메모 || '').replace(/,/g, ';')
        ];
        console.log(row.join(','));
      });
    }
    
    return userDetails;
    
  } catch (error) {
    console.error('❌ 에러 발생:', error.message);
    throw error;
  }
}

// 스크립트 실행
if (require.main === module) {
  getNumericUsersDetails()
    .then(result => {
      console.log('\n✅ 상세 정보 조회 완료!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 실행 실패:', error);
      process.exit(1);
    });
}

module.exports = { getNumericUsersDetails };
