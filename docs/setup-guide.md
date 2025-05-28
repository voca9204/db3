# DB3 프로젝트 설치 및 실행 가이드

## 🚀 빠른 시작

### 1. 프로젝트 클론 및 의존성 설치
```bash
cd /users/sinclair/projects/db3
npm install
cd functions && npm install
```

### 2. 환경 변수 설정
```bash
cd functions
cp .env.template .env
# .env 파일을 편집하여 실제 값 입력
```

### 3. Firebase CLI 설치 및 로그인
```bash
npm install -g firebase-tools
firebase login
```

### 4. 로컬 개발 서버 실행
```bash
# 프로젝트 루트에서
firebase emulators:start --only functions,hosting
```

### 5. 브라우저에서 확인
- 대시보드: http://localhost:8080
- API: http://localhost:9000/db888-67827/us-central1/

## 📊 주요 API 엔드포인트

### 공개 API (인증 불필요)
- `GET /helloWorld` - 시스템 상태 확인
- `GET /testConnection` - 데이터베이스 연결 테스트  
- `GET /getSystemStatus` - 시스템 전체 상태 및 통계

### 보호된 API (인증 필요)
- `GET /getUserGameActivity` - 사용자 게임 활동 분석
- `GET /getDormantUsers` - 휴면 사용자 분석
- `GET /getEventParticipationAnalysis` - 이벤트 참여 분석

### API 사용 예시
```bash
# 시스템 상태 확인
curl http://localhost:9000/db888-67827/us-central1/helloWorld

# 게임 활동 분석 조회 (인증 필요)
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:9000/db888-67827/us-central1/getUserGameActivity?limit=10
```

## 🔐 인증 시스템

### Google 인증
- 허용된 이메일: sandscasino8888@gmail.com
- Firebase Authentication 사용
- JWT 토큰 기반 API 보안

### 인증 흐름
1. 사용자가 Google 로그인
2. Firebase에서 JWT 토큰 발급
3. API 요청 시 Authorization 헤더에 토큰 포함
4. 서버에서 토큰 검증 및 이메일 확인

## 📈 비즈니스 목표

### 핵심 목표
질의에 맞게 정확히 데이터베이스를 뽑아주는 것, 이를 바탕으로 효과적인 마케팅 전략을 세우는 것

### 주요 분석 영역
- **사용자 행동 패턴**: 게임 활동, 베팅 패턴, 접속 주기 분석
- **휴면 사용자 분석**: 장기 미접속 사용자의 특성 및 재활성화 가능성
- **이벤트 효과 측정**: 프로모션별 참여율 및 효과 분석

### 성공 지표
- 데이터 질의 정확도: 요구사항에 맞는 정확한 데이터 추출
- 분석 결과 활용도: 실제 마케팅 전략 수립에 활용되는 비율
- 시스템 효율성: 빠르고 정확한 데이터 처리 능력

## 🗄️ 데이터베이스 구조

### 주요 테이블
- `players`: 사용자 기본 정보
- `game_scores`: 게임 활동 데이터
- `money_flows`: 금융 거래 (입금, 출금, 마량)
- `promotion_players`: 이벤트 참여 정보
- `player_guilds`: 다중 계정 관리

### 중요 변수
- `netBet`: 유효 베팅 금액 (분석의 핵심 지표)
- `appliedAt`: 실제 이벤트 지급 시점
- `guild`: 대표ID (다중 계정 통합)

## 🎯 Task 관리

### Task Master 사용
```bash
# Task 목록 조회
npx taskmaster get_tasks --projectRoot=/users/sinclair/projects/db3

# 다음 작업 확인
npx taskmaster next_task --projectRoot=/users/sinclair/projects/db3

# Task 상태 변경
npx taskmaster set_task_status --id=1 --status=done --projectRoot=/users/sinclair/projects/db3
```

### 현재 우선순위
새로운 Task 정의 예정 - 정확한 데이터 분석과 마케팅 전략 수립에 중점

## 🔧 개발 도구

### 필수 의존성
- Node.js 18+
- Firebase CLI
- MariaDB 클라이언트

### 주요 라이브러리
- Firebase Functions 4.3.1
- MySQL2 3.14.1
- Express.js 4.21.2
- Chart.js (프론트엔드)

### 개발 환경
- 로컬 에뮬레이터: Firebase Functions + Hosting
- 데이터베이스: MariaDB (211.248.190.46)
- 인증: Firebase Auth + Google Sign-In

## 📁 프로젝트 구조
```
db3/
├── README.md              # 프로젝트 개요
├── docs/                  # 문서
│   ├── variables.md       # 데이터베이스 변수 정의
│   └── setup-guide.md     # 설치 가이드
├── functions/             # Firebase Functions
│   ├── index.js          # 메인 API 코드
│   ├── package.json      # 의존성
│   └── .env.template     # 환경 변수 템플릿
├── public/               # 웹 인터페이스
│   └── index.html        # 메인 대시보드
├── tasks/                # Task Master
│   └── tasks.json        # 작업 정의
└── scripts/              # 유틸리티 스크립트
```

## 🚀 배포

### 프로덕션 배포
```bash
# 전체 배포
firebase deploy

# Functions만 배포
firebase deploy --only functions

# Hosting만 배포  
firebase deploy --only hosting
```

### 환경별 설정
- **개발**: 로컬 에뮬레이터 (포트 9000, 8080)
- **스테이징**: Firebase Functions (테스트 환경)
- **프로덕션**: Firebase Functions (실제 서비스)

## 🔍 문제 해결

### 자주 발생하는 문제
1. **데이터베이스 연결 오류**: 네트워크 설정 확인
2. **인증 실패**: Firebase 프로젝트 설정 확인  
3. **API 권한 오류**: 토큰 및 이메일 확인

### 디버깅 도구
```bash
# Firebase 로그 확인
firebase functions:log

# 로컬 디버깅
firebase emulators:start --inspect-functions
```

## 📞 지원

### 연락처
- 프로젝트 관리자: sandscasino8888@gmail.com
- 기술 지원: DB3 개발팀

### 리소스
- Firebase 콘솔: https://console.firebase.google.com/project/db888-67827
- GitHub 저장소: https://github.com/voca9204@gmail.com/db3
- 문서: /docs 디렉토리

---
*최종 업데이트: 2025-05-26*
