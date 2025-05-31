# DB3 API 전체 목록 및 기능 정리 (2025-05-31)

## 🎯 개요
DB3 프로젝트의 모든 API 엔드포인트를 카테고리별로 정리한 완전한 참조 문서입니다.

**총 API 수**: 46개 (9개 모듈 + 특수 API)
**Base URL**: http://127.0.0.1:50888/db888-67827/us-central1/

---

## 📊 1. BASIC SYSTEM APIs (8개)
*기본 시스템 상태 및 연결 테스트*

| API명 | 기능 | 인증 | 용도 |
|-------|------|------|------|
| `helloWorld` | 시스템 상태 확인 | ❌ | 기본 헬스체크 |
| `testConnection` | DB 연결 테스트 | ❌ | 데이터베이스 연결 확인 |
| `getSystemStatus` | 전체 시스템 상태 | ❌ | 시스템 종합 현황 |
| `getSystemHealth` | 시스템 헬스 체크 | ❌ | 상세 헬스 정보 |
| `getTableSchema` | 테이블 스키마 조회 | 🔒 | 개발용 (테스트만) |
| `getUserContactInfo` | 사용자 연락처 조회 | 🔒 | 개발용 (테스트만) |
| `exploreContactTables` | 연락처 테이블 탐색 | 🔒 | 개발용 (테스트만) |
| `getFullContactInfo` | 전체 연락처 정보 | 🔒 | 개발용 (테스트만) |

---

## 🏢 2. BUSINESS ANALYSIS APIs (6개)
*비즈니스 분석 및 마케팅 인사이트*

| API명 | 기능 | 인증 | 핵심 용도 |
|-------|------|------|---------|
| `getUserGameActivity` | 사용자 게임 활동 분석 | 🔒 | 게임 패턴 분석 |
| `getDormantUsers` | 휴면 사용자 조회 | 🔒 | 휴면 사용자 타겟팅 |
| `getEventParticipationAnalysis` | 이벤트 참여 분석 | 🔒 | 프로모션 효과 측정 |
| `getInactiveNewUsersAnalysis` | 가입 후 미활성 사용자 | ❌ | 온보딩 개선 |
| `downloadInactiveUsersCSV` | 미활성 사용자 CSV | ❌ | 마케팅 캠페인용 |
| `getHighActivityDormantUsers` | 고활동 휴면 사용자 ⭐ | 🔒 | 고가치 재활성화 |

---

## 🔧 3. QUERY BUILDER APIs (5개)
*동적 쿼리 생성 및 테스트*

| API명 | 기능 | 인증 | 설명 |
|-------|------|------|------|
| `testQueryBuilder` | 쿼리 빌더 테스트 | ❌ | 기본 쿼리 생성 |
| `getConnectionStats` | 연결 통계 조회 | ❌ | DB 연결 상태 |
| `testQueryBuilderSelect` | SELECT 쿼리 테스트 | ❌ | SELECT 문 최적화 |
| `testQueryBuilderJoin` | JOIN 쿼리 테스트 | ❌ | JOIN 성능 테스트 |
| `testQueryBuilderProtected` | 보호된 쿼리 빌더 | 🔒 | 인증된 쿼리 실행 |

---

## 🎛️ 4. FILTERING SYSTEM APIs (4개)
*고급 필터링 및 마케팅 프리셋*

| API명 | 기능 | 인증 | 마케팅 활용 |
|-------|------|------|-------------|
| `testFilterEngine` | 필터 엔진 테스트 | ❌ | 필터 시스템 검증 |
| `getFilterPresets` | 마케팅 프리셋 조회 | ❌ | 9가지 타겟팅 프리셋 |
| `getAdvancedUserAnalysis` | 고급 사용자 분석 | 🔒 | 세분화된 사용자 분석 |
| `buildCustomFilter` | 맞춤 필터 생성 | ❌ | 동적 필터 구성 |

---

## 🔍 5. SEARCH SYSTEM APIs (6개)
*텍스트 검색 및 퍼지 매칭*

| API명 | 기능 | 인증 | 특징 |
|-------|------|------|------|
| `advancedTextSearch` | 고급 텍스트 검색 | ❌ | 전문 검색 기능 |
| `getSearchSuggestions` | 검색 제안 | ❌ | 자동완성 기능 |
| `parseSearchQuery` | 검색 쿼리 파싱 | ❌ | 쿼리 구문 분석 |
| `testSearchPerformance` | 검색 성능 테스트 | ❌ | 검색 속도 측정 |
| `fuzzySearch` | 퍼지 검색 | ❌ | 유사 문자열 검색 |
| `getSearchEngineStatus` | 검색 엔진 상태 | ❌ | 검색 시스템 현황 |

---

## ⚡ 6. OPTIMIZATION SYSTEM APIs (6개)
*쿼리 최적화 및 성능 향상*

| API명 | 기능 | 인증 | 성능 개선 |
|-------|------|------|---------|
| `executeOptimizedQuery` | 최적화된 쿼리 실행 | ❌ | 자동 최적화 실행 |
| `getPerformanceReport` | 성능 보고서 조회 | ❌ | 상세 성능 분석 |
| `testQueryOptimization` | 쿼리 최적화 테스트 | ❌ | 최적화 효과 검증 |
| `analyzeQuery` | 쿼리 분석 | ❌ | 쿼리 실행 계획 |
| `getOptimizationStatus` | 최적화 상태 | ❌ | 최적화 시스템 현황 |
| `demoOptimization` | 최적화 데모 | ❌ | 최적화 예시 시연 |

---

## 📈 7. MONITORING SYSTEM APIs (4개)
*성능 모니터링 및 벤치마크*

| API명 | 기능 | 인증 | 모니터링 |
|-------|------|------|---------|
| `getPerformanceDashboard` | 성능 대시보드 | ❌ | 실시간 성능 현황 |
| `runBenchmark` | 벤치마크 실행 | ❌ | 시스템 성능 측정 |
| `getMonitoringStatus` | 모니터링 상태 | ❌ | 모니터링 시스템 현황 |
| `quickPerformanceTest` | 빠른 성능 테스트 | ❌ | 즉시 성능 체크 |

---

## 🗂️ 8. INDEXING SYSTEM APIs (9개)
*인덱스 관리 및 최적화*

| API명 | 기능 | 인증 | 인덱스 관리 |
|-------|------|------|-----------|
| `getIndexRecommendations` | 인덱스 추천 | ❌ | 자동 인덱스 제안 |
| `getIndexPerformanceDashboard` | 인덱스 성능 대시보드 | ❌ | 인덱스 성능 현황 |
| `checkIndexStatus` | 인덱스 상태 확인 | ❌ | 인덱스 헬스체크 |
| `runIndexPerformanceTest` | 인덱스 성능 테스트 | ❌ | 인덱스 효과 측정 |
| `getIndexMonitoringStatus` | 인덱스 모니터링 상태 | ❌ | 모니터링 현황 |
| `runAutoIndexAnalysis` | 자동 인덱스 분석 | ❌ | AI 기반 분석 |
| `getAutoIndexOptimizerStatus` | 자동 최적화 상태 | ❌ | 자동 시스템 현황 |
| `quickIndexHealthCheck` | 빠른 인덱스 헬스체크 | ❌ | 즉시 상태 확인 |
| `getIndexUsageStats` | 인덱스 사용 통계 | ❌ | 사용량 분석 |

---

## 🔐 9. SECURITY SYSTEM APIs (4개)
*보안 테스트 및 인증*

| API명 | 기능 | 인증 | 보안 |
|-------|------|------|------|
| `securityTest` | 보안 테스트 | ❌ | 기본 보안 검증 |
| `getSecurityMonitoring` | 보안 모니터링 | 🔒 | 보안 현황 추적 |
| `testInvalidAuth` | 잘못된 인증 테스트 | ❌ | 인증 시스템 검증 |
| `performSecurityAudit` | 보안 감사 실행 | 🔒 | 종합 보안 점검 |

---

## 🛠️ 10. SPECIALIZED APIs (2개)
*특수 목적 API*

| API명 | 기능 | 인증 | 용도 |
|-------|------|------|------|
| `getIndexManagementDashboard` | 인덱스 관리 대시보드 | ❌ | 종합 인덱스 관리 |
| `getIndexManagementStatus` | 인덱스 관리 상태 | ❌ | 관리 시스템 현황 |

---

## 📋 11. META API (1개)
*시스템 정보*

| API명 | 기능 | 인증 | 설명 |
|-------|------|------|------|
| `getModuleInfo` | 모듈 정보 조회 | ❌ | API 시스템 아키텍처 정보 |

---

## 🎯 주요 API 사용 패턴

### 마케팅팀 필수 API 🎪
```bash
# 고가치 휴면 사용자 분석 (연락처 포함)
GET /getHighActivityDormantUsers?limit=500&representativeOnly=false

# 가입 후 미활성 사용자 + CSV 다운로드  
GET /getInactiveNewUsersAnalysis
GET /downloadInactiveUsersCSV

# 마케팅 프리셋 조회
GET /getFilterPresets
```

### 개발팀 필수 API 🔧
```bash
# 시스템 상태 확인
GET /helloWorld
GET /getSystemStatus

# 성능 모니터링
GET /getPerformanceDashboard
GET /quickPerformanceTest
```

### 분석팀 필수 API 📊
```bash
# 사용자 분석
GET /getUserGameActivity
GET /getAdvancedUserAnalysis

# 이벤트 분석
GET /getEventParticipationAnalysis
```

---

## 🚀 접속 방법

### 로컬 개발환경
```bash
# 에뮬레이터 실행
firebase emulators:start --only hosting,functions

# 접속 주소
Base URL: http://127.0.0.1:50888/db888-67827/us-central1/
웹 대시보드: http://127.0.0.1:50889/
```

### API 호출 예시
```bash
# 기본 상태 확인
curl http://127.0.0.1:50888/db888-67827/us-central1/helloWorld

# 고활동 휴면 사용자 (인증 필요)
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://127.0.0.1:50888/db888-67827/us-central1/getHighActivityDormantUsers

# 시스템 상태 (공개)
curl http://127.0.0.1:50888/db888-67827/us-central1/getSystemStatus
```

---

## 📝 인증 시스템

### 🔒 인증 필요 API (보호됨)
- **대상**: 민감한 사용자 데이터 조회 API
- **방법**: Firebase Auth JWT 토큰
- **허용 이메일**: sandscasino8888@gmail.com

### ❌ 인증 불필요 API (공개)
- **대상**: 시스템 상태, 성능 테스트, 일반 분석
- **접근**: 누구나 사용 가능
- **제한**: 개발 환경에서는 인증 우회

---

## 🎉 최신 추가 기능 (2025-05-31)

### 연락처 시스템 통합 ⭐
- **getHighActivityDormantUsers**: 전화번호, 위챗 정보 포함
- **CSV 다운로드**: 연락처 정보 완전 포함
- **마케팅 최적화**: 연락 가능 사용자 우선 타겟팅

### 보고서 최적화 💎
- **등급 축약**: P, H, M, B로 공간 절약
- **컬럼 최적화**: 계정상태 제거, 대표ID로 통합
- **사용성 향상**: 핵심 정보 중심 배치

---

**📌 이 문서를 북마크하여 API 개발 시 참조하세요!**

*최종 업데이트: 2025-05-31*
*총 API 수: 46개*
*모듈화 완료: ✅*