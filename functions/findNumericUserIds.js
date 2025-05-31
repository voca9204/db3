/**
 * 숫자로만 된 유저ID 조회 스크립트
 * DB3 프로젝트용
 */

// .env 파일 로드
require('dotenv').config();

const { executeQuery } = require('./db');

async function findNumericUserIds() {
  try {
    console.log('🔍 숫자로만 된 유저ID들을 조회합니다...');
    
    // 1. 먼저 players 테이블 구조 확인
    console.log('\n📊 Players 테이블 구조 확인:');
    const tableStructure = await executeQuery(`DESCRIBE players`);
    console.table(tableStructure);
    
    // 2. 전체 유저 수 확인
    const totalUsersResult = await executeQuery(`SELECT COUNT(*) as total FROM players`);
    const totalUsers = totalUsersResult[0].total;
    console.log(`\n📈 전체 유저 수: ${totalUsers}명`);
    
    // 3. 숫자로만 된 유저ID 조회
    const numericUserIdsQuery = `
      SELECT 
        userId,
        LENGTH(userId) as id_length,
        CASE 
          WHEN userId REGEXP '^[0-9]+$' THEN 'numeric_only'
          ELSE 'contains_non_numeric'
        END as id_type
      FROM players 
      WHERE userId REGEXP '^[0-9]+$'
      ORDER BY CAST(userId AS UNSIGNED)
    `;
    
    console.log('\n🔢 숫자로만 된 유저ID 조회 중...');
    const numericUserIds = await executeQuery(numericUserIdsQuery);
    
    console.log(`\n✅ 숫자로만 된 유저ID: ${numericUserIds.length}개 발견`);
    
    if (numericUserIds.length > 0) {
      console.log('\n📋 숫자 유저ID 목록 (첫 20개):');
      console.table(numericUserIds.slice(0, 20));
      
      // 4. 통계 정보
      const idLengths = numericUserIds.map(user => user.id_length);
      const minLength = Math.min(...idLengths);
      const maxLength = Math.max(...idLengths);
      const avgLength = (idLengths.reduce((a, b) => a + b, 0) / idLengths.length).toFixed(1);
      
      console.log('\n📊 숫자 유저ID 통계:');
      console.log(`- 최소 자리수: ${minLength}`);
      console.log(`- 최대 자리수: ${maxLength}`);
      console.log(`- 평균 자리수: ${avgLength}`);
      console.log(`- 전체 중 비율: ${((numericUserIds.length / totalUsers) * 100).toFixed(1)}%`);
    }
    
    // 5. 비숫자 포함 유저ID도 확인
    const nonNumericQuery = `
      SELECT 
        userId,
        LENGTH(userId) as id_length,
        'contains_non_numeric' as id_type
      FROM players 
      WHERE NOT (userId REGEXP '^[0-9]+$')
      LIMIT 10
    `;
    
    const nonNumericIds = await executeQuery(nonNumericQuery);
    
    if (nonNumericIds.length > 0) {
      console.log('\n📋 비숫자 포함 유저ID 샘플 (첫 10개):');
      console.table(nonNumericIds);
    }
    
    // 6. CSV 형태로 결과 출력
    if (numericUserIds.length > 0) {
      console.log('\n📄 CSV 형태 결과 (전체):');
      console.log('userId,id_length,id_type');
      numericUserIds.forEach(user => {
        console.log(`${user.userId},${user.id_length},${user.id_type}`);
      });
    }
    
    return {
      total_users: totalUsers,
      numeric_user_ids: numericUserIds,
      non_numeric_sample: nonNumericIds,
      statistics: {
        numeric_count: numericUserIds.length,
        percentage: ((numericUserIds.length / totalUsers) * 100).toFixed(1)
      }
    };
    
  } catch (error) {
    console.error('❌ 에러 발생:', error.message);
    throw error;
  }
}

// 스크립트 실행
if (require.main === module) {
  findNumericUserIds()
    .then(result => {
      console.log('\n✅ 조회 완료!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 실행 실패:', error);
      process.exit(1);
    });
}

module.exports = { findNumericUserIds };
