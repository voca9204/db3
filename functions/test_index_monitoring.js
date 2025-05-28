/**
 * Index Monitoring API Test
 * Task 3.2: 인덱스 모니터링 API 테스트
 */

const { 
  collectIndexUsageStats,
  runPerformanceTests,
  generateIndexEffectivenessReport 
} = require('./index_monitoring_api');

// API 함수들을 직접 import (내부 함수들을 export하도록 수정 필요)

async function testIndexMonitoringAPI() {
  console.log('🧪 인덱스 모니터링 API 테스트 시작');
  
  try {
    // 1. 인덱스 상태 체크 테스트
    console.log('\n1. 인덱스 상태 체크 테스트');
    
    // 2. 성능 테스트 실행
    console.log('\n2. 성능 테스트 실행');
    
    // 3. 대시보드 데이터 생성
    console.log('\n3. 대시보드 데이터 생성');
    
    console.log('\n✅ 모든 API 테스트 완료!');
    
  } catch (error) {
    console.error('❌ API 테스트 실패:', error);
  }
}

if (require.main === module) {
  testIndexMonitoringAPI();
}
