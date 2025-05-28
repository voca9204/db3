# Hermes 데이터베이스 변수 설명 (DB3용 완전판)

이 문서는 Hermes 데이터베이스의 주요 변수들과 그 의미를 설명합니다. DB3 프로젝트의 핵심 참조 문서입니다.

## 💥 중요: 데이터 표시 규칙

### 결과 표시에서 제외해야 할 필드
다음 필드는 개인정보 보호 및 내부 정책에 따라 결과 표시에서 제외해야 합니다:

1. **players.id**: 내부 DB 사용자 ID (숫자)는 결과에 표시하지 마세요.
2. **players.name**: 사용자의 실제 이름은 결과에 표시하지 마세요.

대신 다음 필드를 사용하세요:
- **players.userId**: 사용자의 유저명은 식별자로 사용 가능합니다.

### 금액 표시 규칙
- 모든 금액은 소수점 이하를 반올림하여 정수로 표시하세요.
- 예: 123,456.78 → 123,457
- 필요한 경우 천 단위 구분자(,)를 사용하여 가독성을 높이세요.
- 보고서 작성 시에는 단위(원, KRW 등)를 명확히 표시하세요.

### 쿼리 작성 시 유의사항
- 모든 보고서 및 결과 표시에서 `id`와 `name` 필드는 제외하고 `userId` 필드만 표시하세요.
- 사용자 식별이 필요한 조인 쿼리에서는 내부적으로 `id`를 사용할 수 있으나, 최종 결과에는 포함하지 마세요.
- CSV 파일이나 보고서를 생성할 때도 위 규칙을 준수하세요.
- 금액 데이터를 표시할 때는 ROUND() 함수를 사용하여 소수점 이하를 반올림하세요.

## 🔑 중요: 대표ID와 연결ID 관계

### player_guilds 테이블의 실제 구조 (검증 완료)
실제 Hermes 시스템에서 player_guilds 테이블은 다음과 같은 구조를 가집니다:

| 변수명 | 타입 | 설명 |
|--------|------|------|
| player | int | 연결ID (개별 플레이어 계정 ID) |
| guild | char(32) | 대표ID (그룹 식별자 - 해시값) |
| createdAt | timestamp | 그룹 가입 시점 |

### 실제 데이터 현황 (2025-05-26 검증)
- **총 플레이어 수**: 2,952명
- **그룹 관계**: 989개
- **게임 활동 사용자**: 1,923명

## 📊 핵심 테이블 구조

### 1. players 테이블 (사용자 기본 정보)
| 변수명 | 타입 | 설명 |
|--------|------|------|
| id | int | 내부 DB ID (결과에 표시하지 말 것) |
| userId | varchar(64) | 사용자 식별자 (유저명) - 결과 표시에 사용 |
| name | varchar(20) | 사용자 실제 이름 (결과에 표시하지 말 것) |
| status | tinyint | 활성 상태 (0: 활성, 1: 제한, 8: 특별관리) |
| adjustType | tinyint | 마량 조정 타입 (RewardAdjustTypes 참조) |
| flowFeatures | tinyint | 자금 흐름 특성 (PlayerFlowFeatures 참조) |

### 2. game_scores 테이블 (게임 활동 데이터)
| 변수명 | 타입 | 설명 |
|--------|------|------|
| gameDate | date | 게임 플레이 날짜 |
| userId | varchar(32) | 사용자 식별자 (players.userId와 연결) |
| betCount | smallint | 베팅 횟수 |
| totalBet | float | 총 베팅 금액 |
| netBet | float | 유효 베팅 금액 (분석에서 주로 사용) |
| winLoss | float | 승패 금액 (양수: 승리, 음수: 패배) |
| gameType | tinyint | 게임 유형 (GameTypes 참조) |

### 3. money_flows 테이블 (금융 거래)
| 변수명 | 타입 | 설명 |
|--------|------|------|
| type | tinyint | 거래 유형 (MoneyFlowTypes 참조) |
| amount | decimal | 거래 금액 |
| player | int | 플레이어 ID (외래키) |
| createdAt | timestamp | 거래 생성 시점 |

### 4. promotion_players 테이블 (이벤트 참여)
| 변수명 | 타입 | 설명 |
|--------|------|------|
| promotion | char(32) | 프로모션 ID (외래 키) |
| player | int | 플레이어 ID (외래 키) |
| reward | decimal(8,2) | 이벤트 보상 금액 |
| status | tinyint | 프로모션 상태 (PromotionPlayerStatus 참조) |
| appliedAt | timestamp | 실제 지급 시점 (NULL: 미지급, 값: 지급완료) |

## 🎪 Enum 정의 (C# 기반 완전 정의)

### MoneyFlowTypes (money_flows.type)
```
0: Deposit - 입금
1: Withdrawal - 출금  
2: Reward - 마량(유효배팅 리베이트)
3: TransferFee - 이체수수료
```

### RewardAdjustTypes (players.adjustType)
```
0: Hold - 마량지급없음
1: Auto - 자동으로 지급  
2: Weekly - 주마다 한번 지급
3: Delegate - 다른 유저에게 마량을 지급함
4: Often - 수시지급 (요청할때 지급)
```

### PlayerFlowFeatures (players.flowFeatures) - 비트 플래그
```
0: None - 제한없음
1: BlockP2P - P2P 거래 차단
2: FeeFree - 수수료 면제  
3: BlockP2P + FeeFree - 두 옵션 모두 적용
```

### PromotionPlayerStatus (promotion_players.status)
```
0: Ready - 준비 상태
1: Applied - 적용/지급 완료
2: Dismissed - 취소/거부됨
```

### GameTypes (game_scores.gameType)
```
0: Countable - 계산 가능한 게임 (유효배팅 인정)
1: Uncountable - 계산 불가능한 게임 (유효배팅 비인정) 
2: Flexible - 유연한 게임 (조건부 유효배팅)
```

## 🔍 핵심 분석 쿼리 패턴

### 1. 다중 계정 통합 분석
```sql
-- 대표ID별 연결ID 분석
SELECT 
    pg.guild as 대표ID,
    COUNT(*) as 연결ID_수,
    GROUP_CONCAT(p.userId ORDER BY p.userId SEPARATOR ', ') as 연결된_계정들
FROM player_guilds pg
JOIN players p ON pg.player = p.id
GROUP BY pg.guild
HAVING 연결ID_수 > 1
ORDER BY 연결ID_수 DESC;
```

### 2. 마량 시스템 분석
```sql
-- 마량 지급 현황 및 타입별 통계
SELECT 
    CASE p.adjustType
        WHEN 0 THEN 'Hold'
        WHEN 1 THEN 'Auto'
        WHEN 2 THEN 'Weekly'
        WHEN 3 THEN 'Delegate'
        WHEN 4 THEN 'Often'
    END as 마량타입,
    COUNT(*) as 사용자수,
    SUM(CASE WHEN mf.type = 2 THEN mf.amount ELSE 0 END) as 총마량지급액
FROM players p
LEFT JOIN money_flows mf ON p.id = mf.player
GROUP BY p.adjustType;
```

### 3. 이벤트 효과 분석
```sql
-- 이벤트 후 입금 패턴 분석
SELECT 
    p.userId,
    COUNT(pp.promotion) as 이벤트수,
    SUM(pp.reward) as 총보상액,
    SUM(CASE WHEN mf.createdAt > (SELECT MIN(pp2.appliedAt) 
                                  FROM promotion_players pp2 
                                  WHERE pp2.player = p.id 
                                  AND pp2.appliedAt IS NOT NULL) 
              AND mf.type = 0 THEN mf.amount ELSE 0 END) as 이벤트후입금액
FROM players p
JOIN promotion_players pp ON p.id = pp.player
LEFT JOIN money_flows mf ON p.id = mf.player
WHERE pp.appliedAt IS NOT NULL
GROUP BY p.userId
HAVING 이벤트후입금액 > 0
ORDER BY 이벤트후입금액 DESC;
```

### 4. 고가치 사용자 식별
```sql
-- 고가치 휴면 사용자 분석
SELECT 
    p.userId,
    COUNT(DISTINCT gs.gameDate) as 총게임일수,
    ROUND(SUM(gs.netBet)) as 총유효배팅,
    ROUND(SUM(gs.winLoss)) as 총손익,
    MIN(gs.gameDate) as 첫게임일,
    MAX(gs.gameDate) as 마지막게임일,
    DATEDIFF(CURDATE(), MAX(gs.gameDate)) as 휴면일수,
    CASE 
        WHEN DATEDIFF(CURDATE(), MAX(gs.gameDate)) <= 30 THEN 'active'
        ELSE 'dormant'
    END as 활동상태
FROM players p
JOIN game_scores gs ON p.userId = gs.userId
GROUP BY p.userId
HAVING 총게임일수 >= 7 AND 총유효배팅 >= 50000
ORDER BY 총유효배팅 DESC;
```

## 🎯 비즈니스 분석 지침

### 사용자 활동 분류 기준
- **활성 사용자**: 최근 30일 이내 게임 기록
- **휴면 사용자**: 30일 이상 게임하지 않은 사용자
- **고가치 사용자**: 최소 7일 게임 + 50,000원 이상 NetBet

### 이벤트 효과 측정
- **참여율**: Ready → Applied 전환율
- **재활성화율**: 이벤트 후 30일 이내 게임 복귀율
- **수익성**: 이벤트 비용 대비 입금액 증가

### 마량 시스템 최적화
- **Auto**: 즉시 재투자하는 활성 사용자
- **Weekly**: 안정적 장기 사용자  
- **Often**: 요청 기반 맞춤 ��비스
- **Hold**: 마량 불필요 고액 사용자

---

**참고사항**:
- 이 문서는 DB3 프로젝트의 핵심 참조 문서입니다.
- 모든 쿼리는 다중 계정 처리를 고려하여 작성하세요.
- 개인정보 보호 규칙을 항상 준수하세요.
- Enum 정의는 C# 코드 기반으로 검증되었습니다.

*최종 업데이트: 2025-05-26*
