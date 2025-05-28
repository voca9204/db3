/**
 * Essential Database Indexes Creation Script
 * Task 3.1: 필수 인덱스 식별 및 생성
 * 
 * 성능 테스트에서 발견된 치명적인 성능 문제 해결:
 * - JOIN 쿼리: 9.4초 → 목표 < 100ms
 * - 복합 쿼리 최적화
 * - 실시간 분석 성능 향상
 */

const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });

// 데이터베이스 연결 설정
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  ssl: false
};

// 필수 인덱스 정의 (성능 테스트 결과 기반)
const ESSENTIAL_INDEXES = [
  {
    name: 'idx_game_scores_userId',
    table: 'game_scores',
    columns: ['userId'],
    type: 'BTREE',
    priority: 'CRITICAL',
    reason: 'JOIN 쿼리 성능 개선 (9.4초 → <100ms 목표)',
    estimatedImpact: 'HIGH'
  },
  {
    name: 'idx_players_status_userId',
    table: 'players',
    columns: ['status', 'userId'],
    type: 'BTREE',
    priority: 'HIGH',
    reason: 'WHERE 조건 최적화 및 사용자 상태 필터링',
    estimatedImpact: 'MEDIUM'
  },
  {
    name: 'idx_game_scores_userId_gameDate',
    table: 'game_scores',
    columns: ['userId', 'gameDate'],
    type: 'BTREE',
    priority: 'HIGH',
    reason: '날짜 범위 쿼리 최적화 (115ms → <50ms 목표)',
    estimatedImpact: 'HIGH'
  },
  {
    name: 'idx_promotion_players_player_appliedAt',
    table: 'promotion_players',
    columns: ['player', 'appliedAt'],
    type: 'BTREE',
    priority: 'MEDIUM',
    reason: '이벤트 분석 쿼리 최적화',
    estimatedImpact: 'MEDIUM'
  },
  {
    name: 'idx_money_flows_player_type_createdAt',
    table: 'money_flows',
    columns: ['player', 'type', 'createdAt'],
    type: 'BTREE',
    priority: 'MEDIUM',
    reason: '금융 거래 분석 최적화',
    estimatedImpact: 'MEDIUM'
  },
  {
    name: 'idx_player_guilds_guild_player',
    table: 'player_guilds',
    columns: ['guild', 'player'],
    type: 'BTREE',
    priority: 'MEDIUM',
    reason: '다중 계정 분석 최적화',
    estimatedImpact: 'LOW'
  }
];

class EssentialIndexManager {
  constructor() {
    this.connection = null;
    this.results = {
      created: [],
      exists: [],
      failed: [],
      performance: {}
    };
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
   * 현재 인덱스 상태 확인
   */
  async getCurrentIndexes(tableName) {
    try {
      const [rows] = await this.connection.execute(
        'SHOW INDEXES FROM ??',
        [tableName]
      );
      return rows.map(row => ({
        name: row.Key_name,
        column: row.Column_name,
        unique: row.Non_unique === 0,
        type: row.Index_type
      }));
    } catch (error) {
      console.error(`❌ ${tableName} 인덱스 조회 실패:`, error.message);
      return [];
    }
  }

  /**
   * 인덱스 존재 여부 확인
   */
  async indexExists(tableName, indexName) {
    const indexes = await this.getCurrentIndexes(tableName);
    return indexes.some(idx => idx.name === indexName);
  }

  /**
   * 단일 인덱스 생성
   */
  async createIndex(indexDef) {
    const { name, table, columns, type = 'BTREE', priority, reason } = indexDef;
    
    console.log(`\n🔧 [${priority}] ${name} 생성 시도...`);
    console.log(`   테이블: ${table}`);
    console.log(`   컬럼: ${columns.join(', ')}`);
    console.log(`   목적: ${reason}`);

    try {
      // 인덱스 존재 여부 확인
      if (await this.indexExists(table, name)) {
        console.log(`✅ ${name} 이미 존재함`);
        this.results.exists.push({ name, table, reason: 'Already exists' });
        return true;
      }

      // 인덱스 생성 SQL
      const columnList = columns.map(col => `\`${col}\``).join(', ');
      const createSQL = `CREATE INDEX \`${name}\` ON \`${table}\` (${columnList}) USING ${type}`;
      
      console.log(`   SQL: ${createSQL}`);
      
      // 실행 시간 측정
      const startTime = Date.now();
      await this.connection.execute(createSQL);
      const executionTime = Date.now() - startTime;
      
      console.log(`✅ ${name} 생성 완료 (${executionTime}ms)`);
      
      this.results.created.push({
        name,
        table,
        columns,
        priority,
        reason,
        executionTime
      });
      
      return true;
      
    } catch (error) {
      console.error(`❌ ${name} 생성 실패:`, error.message);
      this.results.failed.push({
        name,
        table,
        error: error.message,
        reason
      });
      return false;
    }
  }

  /**
   * 모든 필수 인덱스 생성
   */
  async createAllEssentialIndexes() {
    console.log('🚀 필수 인덱스 생성 시작...\n');
    console.log(`총 ${ESSENTIAL_INDEXES.length}개 인덱스 생성 예정`);

    // 우선순위별로 정렬 (CRITICAL > HIGH > MEDIUM)
    const priorityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
    const sortedIndexes = [...ESSENTIAL_INDEXES].sort((a, b) => 
      priorityOrder[a.priority] - priorityOrder[b.priority]
    );

    for (const indexDef of sortedIndexes) {
      await this.createIndex(indexDef);
      // 각 인덱스 생성 후 잠시 대기 (DB 부하 방지)
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n📊 인덱스 생성 결과:');
    console.log(`✅ 생성됨: ${this.results.created.length}개`);
    console.log(`ℹ️  이미 존재: ${this.results.exists.length}개`);
    console.log(`❌ 실패: ${this.results.failed.length}개`);
  }

  /**
   * 생성된 인덱스 검증
   */
  async verifyIndexes() {
    console.log('\n🔍 인덱스 검증 중...');
    
    for (const indexDef of ESSENTIAL_INDEXES) {
      const exists = await this.indexExists(indexDef.table, indexDef.name);
      const status = exists ? '✅' : '❌';
      console.log(`${status} ${indexDef.name} (${indexDef.table})`);
    }
  }

  /**
   * 성능 테스트 (인덱스 효과 검증)
   */
  async performanceTest() {
    console.log('\n🏃‍♂️ 성능 테스트 실행...');
    
    const testQueries = [
      {
        name: 'JOIN 쿼리 (CRITICAL 수정 대상)',
        sql: `SELECT p.userId, COUNT(gs.gameDate) as gameDays, 
              SUM(gs.netBet) as totalBet
              FROM players p 
              LEFT JOIN game_scores gs ON p.userId = gs.userId 
              WHERE p.status = 0 
              GROUP BY p.userId 
              LIMIT 100`,
        targetTime: 100 // 목표: 100ms 이하
      },
      {
        name: '날짜 범위 쿼리',
        sql: `SELECT userId, SUM(netBet) as totalBet
              FROM game_scores 
              WHERE gameDate >= '2024-01-01' AND gameDate <= '2024-12-31'
              GROUP BY userId 
              LIMIT 50`,
        targetTime: 50 // 목표: 50ms 이하
      },
      {
        name: '이벤트 분석 쿼리',
        sql: `SELECT COUNT(*) as eventParticipants
              FROM promotion_players 
              WHERE appliedAt IS NOT NULL 
              AND appliedAt >= '2024-01-01'`,
        targetTime: 30 // 목표: 30ms 이하
      }
    ];

    for (const test of testQueries) {
      try {
        const startTime = Date.now();
        await this.connection.execute(test.sql);
        const executionTime = Date.now() - startTime;
        
        const status = executionTime <= test.targetTime ? '🚀' : 
                      executionTime <= test.targetTime * 2 ? '⚠️' : '🚨';
        
        console.log(`${status} ${test.name}: ${executionTime}ms (목표: ${test.targetTime}ms)`);
        
        this.results.performance[test.name] = {
          executionTime,
          targetTime: test.targetTime,
          status: executionTime <= test.targetTime ? 'GOOD' : 'NEEDS_WORK'
        };
        
      } catch (error) {
        console.error(`❌ ${test.name} 실패:`, error.message);
      }
    }
  }

  /**
   * 최종 보고서 생성
   */
  generateReport() {
    console.log('\n📋 최종 보고서');
    console.log('='.repeat(50));
    
    if (this.results.created.length > 0) {
      console.log('\n✅ 생성된 인덱스:');
      this.results.created.forEach(idx => {
        console.log(`  - ${idx.name} (${idx.table}) - ${idx.reason}`);
      });
    }
    
    if (this.results.failed.length > 0) {
      console.log('\n❌ 실패한 인덱스:');
      this.results.failed.forEach(idx => {
        console.log(`  - ${idx.name}: ${idx.error}`);
      });
    }
    
    console.log('\n🎯 다음 단계:');
    console.log('  1. Task 3.2: 인덱스 성능 모니터링 시스템 구축');
    console.log('  2. Task 3.3: 자동 인덱스 최적화 엔진 개발');
    console.log('  3. 실제 운영 환경에서 성능 검증');
    
    return this.results;
  }
}

// 메인 실행 함수
async function main() {
  const indexManager = new EssentialIndexManager();
  
  try {
    // 데이터베이스 연결
    if (!await indexManager.connect()) {
      process.exit(1);
    }
    
    // 필수 인덱스 생성
    await indexManager.createAllEssentialIndexes();
    
    // 인덱스 검증
    await indexManager.verifyIndexes();
    
    // 성능 테스트
    await indexManager.performanceTest();
    
    // 최종 보고서
    const results = indexManager.generateReport();
    
    // 결과를 JSON 파일로 저장
    const fs = require('fs').promises;
    const reportPath = `../docs/index_creation_report_${new Date().toISOString().split('T')[0]}.json`;
    await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 상세 보고서 저장: ${reportPath}`);
    
  } catch (error) {
    console.error('❌ 스크립트 실행 중 오류:', error);
    process.exit(1);
  } finally {
    await indexManager.disconnect();
  }
}

// 스크립트가 직접 실행될 때만 main() 호출
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { EssentialIndexManager, ESSENTIAL_INDEXES };
