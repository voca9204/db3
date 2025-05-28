/**
 * RelevanceScorer.js
 * 검색 결과의 관련성 점수를 계산하는 클래스
 * TF-IDF, 사용자 행동, 필드 가중치 등을 종합하여 점수 산정
 */

class RelevanceScorer {
    constructor(options = {}) {
        this.fieldWeights = options.fieldWeights || {
            userId: 3.0,      // 사용자ID 가중치
            exactMatch: 5.0,  // 정확 매치 가중치
            partialMatch: 2.0, // 부분 매치 가중치
            fuzzyMatch: 1.0,  // 퍼지 매치 가중치
            activityScore: 1.5, // 활동성 점수 가중치
            recency: 2.0      // 최근성 가중치
        };
        
        this.behaviorWeights = options.behaviorWeights || {
            netBet: 0.3,      // 유효베팅 가중치
            gameCount: 0.2,   // 게임횟수 가중치
            loginFreq: 0.1,   // 로그인 빈도 가중치
            retention: 0.4    // 재방문율 가중치
        };
        
        this.timeDecayFactor = options.timeDecayFactor || 0.1; // 시간 감쇠 인수
        this.maxScore = options.maxScore || 100; // 최대 점수
        this.normalizeScores = options.normalizeScores !== false;
    }

    /**
     * 검색 결과에 관련성 점수 부여
     * @param {string} query - 검색어
     * @param {Array} results - 검색 결과 배열
     * @param {Object} options - 점수 계산 옵션
     * @returns {Array} 점수가 부여된 결과 배열
     */
    scoreResults(query, results, options = {}) {
        if (!query || !results || results.length === 0) {
            return results;
        }

        const queryTerms = this.extractQueryTerms(query);
        const scoredResults = results.map(result => {
            const score = this.calculateRelevanceScore(queryTerms, result, options);
            return {
                ...result,
                relevanceScore: score,
                scoreBreakdown: this.getScoreBreakdown(queryTerms, result, options)
            };
        });

        // 점수 정규화
        if (this.normalizeScores) {
            return this.normalizeResultScores(scoredResults);
        }

        return scoredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    /**
     * 개별 결과의 관련성 점수 계산
     * @param {Array} queryTerms - 검색어 용어들
     * @param {Object} result - 검색 결과 객체
     * @param {Object} options - 계산 옵션
     * @returns {number} 관련성 점수
     */
    calculateRelevanceScore(queryTerms, result, options = {}) {
        let totalScore = 0;

        // 1. 텍스트 매칭 점수
        const textScore = this.calculateTextMatchScore(queryTerms, result);
        totalScore += textScore * this.fieldWeights.exactMatch;

        // 2. 퍼지 매칭 점수
        if (result.fuzzyScore) {
            totalScore += (result.fuzzyScore / 100) * this.fieldWeights.fuzzyMatch;
        }

        // 3. 사용자 활동 점수
        const activityScore = this.calculateActivityScore(result);
        totalScore += activityScore * this.fieldWeights.activityScore;

        // 4. 최근성 점수
        const recencyScore = this.calculateRecencyScore(result);
        totalScore += recencyScore * this.fieldWeights.recency;

        // 5. 필드별 가중치 적용
        const fieldScore = this.calculateFieldScore(queryTerms, result);
        totalScore += fieldScore;

        // 6. 사용자 행동 점수
        const behaviorScore = this.calculateBehaviorScore(result);
        totalScore += behaviorScore;

        return Math.min(totalScore, this.maxScore);
    }

    /**
     * 검색어에서 용어 추출
     * @param {string} query - 검색어
     * @returns {Array} 용어 배열
     */
    extractQueryTerms(query) {
        return query
            .toLowerCase()
            .split(/\s+/)
            .filter(term => term.length > 0)
            .map(term => term.replace(/[^\w가-힣]/g, '')); // 특수문자 제거
    }

    /**
     * 텍스트 매칭 점수 계산
     * @param {Array} queryTerms - 검색어 용어들
     * @param {Object} result - 검색 결과
     * @returns {number} 텍스트 매칭 점수
     */
    calculateTextMatchScore(queryTerms, result) {
        const userId = (result.userId || '').toLowerCase();
        let score = 0;

        queryTerms.forEach(term => {
            // 정확 매치
            if (userId === term) {
                score += 10;
            }
            // 부분 매치
            else if (userId.includes(term)) {
                score += 5;
            }
            // 시작 매치
            else if (userId.startsWith(term)) {
                score += 7;
            }
            // 단어 경계 매치
            else if (this.matchesWordBoundary(userId, term)) {
                score += 6;
            }
        });

        return Math.min(score, 20); // 최대 20점
    }

    /**
     * 단어 경계 매치 검사
     * @param {string} text - 대상 텍스트
     * @param {string} term - 검색 용어
     * @returns {boolean} 매치 여부
     */
    matchesWordBoundary(text, term) {
        const regex = new RegExp(`\\b${this.escapeRegex(term)}\\b`, 'i');
        return regex.test(text);
    }

    /**
     * 정규식 이스케이프
     * @param {string} str - 이스케이프할 문자열
     * @returns {string} 이스케이프된 문자열
     */
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * 활동성 점수 계산
     * @param {Object} result - 검색 결과
     * @returns {number} 활동성 점수
     */
    calculateActivityScore(result) {
        let score = 0;

        // 게임 일수 기반 점수
        const gameDays = parseInt(result['총게임일수']) || 0;
        if (gameDays > 0) {
            score += Math.min(gameDays / 30, 1) * 10; // 30일 기준으로 정규화
        }

        // 베팅 금액 기반 점수
        const netBet = parseFloat(result['총유효배팅']) || 0;
        if (netBet > 0) {
            score += Math.min(Math.log10(netBet + 1) / 6, 1) * 10; // 로그 스케일
        }

        // 활동 상태 점수
        if (result['활동상태'] === 'active') {
            score += 5;
        }

        return Math.min(score, 25); // 최대 25점
    }

    /**
     * 최근성 점수 계산
     * @param {Object} result - 검색 결과
     * @returns {number} 최근성 점수
     */
    calculateRecencyScore(result) {
        const lastGameDate = result['마지막게임일'];
        if (!lastGameDate) return 0;

        const daysSinceLastGame = result['휴면일수'] || 0;
        
        // 최근 활동일수록 높은 점수
        if (daysSinceLastGame <= 7) return 15;      // 1주일 이내
        if (daysSinceLastGame <= 30) return 10;     // 1달 이내
        if (daysSinceLastGame <= 90) return 5;      // 3달 이내
        if (daysSinceLastGame <= 180) return 2;     // 6달 이내
        
        return 0; // 6달 초과
    }

    /**
     * 필드별 점수 계산
     * @param {Array} queryTerms - 검색어 용어들
     * @param {Object} result - 검색 결과
     * @returns {number} 필드 점수
     */
    calculateFieldScore(queryTerms, result) {
        let score = 0;

        // userId 필드 매칭
        const userId = (result.userId || '').toLowerCase();
        queryTerms.forEach(term => {
            if (userId.includes(term)) {
                score += this.fieldWeights.userId;
            }
        });

        return Math.min(score, 15); // 최대 15점
    }

    /**
     * 사용자 행동 점수 계산
     * @param {Object} result - 검색 결과
     * @returns {number} 행동 점수
     */
    calculateBehaviorScore(result) {
        let score = 0;

        // 유효베팅 점수
        const netBet = parseFloat(result['총유효배팅']) || 0;
        const netBetScore = Math.min(netBet / 100000, 1) * 10; // 10만원 기준
        score += netBetScore * this.behaviorWeights.netBet;

        // 게임 횟수 점수
        const gameDays = parseInt(result['총게임일수']) || 0;
        const gameScore = Math.min(gameDays / 30, 1) * 10; // 30일 기준
        score += gameScore * this.behaviorWeights.gameCount;

        // 재방문율 점수 (활동일수 대비 총 기간)
        const firstGameDate = new Date(result['첫게임일'] || Date.now());
        const lastGameDate = new Date(result['마지막게임일'] || Date.now());
        const totalDays = Math.max(1, (lastGameDate - firstGameDate) / (1000 * 60 * 60 * 24));
        const retentionRate = gameDays / totalDays;
        const retentionScore = Math.min(retentionRate * 2, 1) * 10;
        score += retentionScore * this.behaviorWeights.retention;

        return Math.min(score, 15); // 최대 15점
    }

    /**
     * 점수 상세 분석 정보 생성
     * @param {Array} queryTerms - 검색어 용어들
     * @param {Object} result - 검색 결과
     * @param {Object} options - 계산 옵션
     * @returns {Object} 점수 분석 정보
     */
    getScoreBreakdown(queryTerms, result, options = {}) {
        const textScore = this.calculateTextMatchScore(queryTerms, result);
        const activityScore = this.calculateActivityScore(result);
        const recencyScore = this.calculateRecencyScore(result);
        const fieldScore = this.calculateFieldScore(queryTerms, result);
        const behaviorScore = this.calculateBehaviorScore(result);
        const fuzzyScore = (result.fuzzyScore || 0) / 100 * this.fieldWeights.fuzzyMatch;

        return {
            textMatch: {
                score: textScore,
                weight: this.fieldWeights.exactMatch,
                weighted: textScore * this.fieldWeights.exactMatch
            },
            fuzzyMatch: {
                score: fuzzyScore,
                weight: this.fieldWeights.fuzzyMatch,
                weighted: fuzzyScore
            },
            activity: {
                score: activityScore,
                weight: this.fieldWeights.activityScore,
                weighted: activityScore * this.fieldWeights.activityScore
            },
            recency: {
                score: recencyScore,
                weight: this.fieldWeights.recency,
                weighted: recencyScore * this.fieldWeights.recency
            },
            fieldMatch: {
                score: fieldScore,
                weighted: fieldScore
            },
            behavior: {
                score: behaviorScore,
                weighted: behaviorScore
            },
            total: textScore * this.fieldWeights.exactMatch + 
                   fuzzyScore +
                   activityScore * this.fieldWeights.activityScore +
                   recencyScore * this.fieldWeights.recency +
                   fieldScore +
                   behaviorScore
        };
    }

    /**
     * 결과 점수 정규화
     * @param {Array} results - 점수가 계산된 결과들
     * @returns {Array} 정규화된 결과들
     */
    normalizeResultScores(results) {
        if (results.length === 0) return results;

        const scores = results.map(r => r.relevanceScore);
        const maxScore = Math.max(...scores);
        const minScore = Math.min(...scores);
        const scoreRange = maxScore - minScore;

        if (scoreRange === 0) {
            // 모든 점수가 같은 경우
            return results.map(result => ({
                ...result,
                normalizedScore: 50 // 중간값
            }));
        }

        return results.map(result => ({
            ...result,
            normalizedScore: Math.round(
                ((result.relevanceScore - minScore) / scoreRange) * 100
            )
        })).sort((a, b) => b.normalizedScore - a.normalizedScore);
    }

    /**
     * TF-IDF 점수 계산
     * @param {string} term - 검색 용어
     * @param {string} document - 문서 (사용자 정보)
     * @param {Array} corpus - 전체 문서 집합
     * @returns {number} TF-IDF 점수
     */
    calculateTFIDF(term, document, corpus) {
        // Term Frequency 계산
        const termCount = (document.toLowerCase().match(new RegExp(term, 'g')) || []).length;
        const totalTerms = document.split(/\s+/).length;
        const tf = termCount / totalTerms;

        // Inverse Document Frequency 계산
        const documentsWithTerm = corpus.filter(doc => 
            doc.toLowerCase().includes(term.toLowerCase())
        ).length;
        const idf = Math.log(corpus.length / (documentsWithTerm + 1));

        return tf * idf;
    }

    /**
     * 검색 결과 그룹화 및 점수 조정
     * @param {Array} results - 검색 결과들
     * @param {Object} options - 그룹화 옵션
     * @returns {Array} 그룹화된 결과들
     */
    groupAndAdjustScores(results, options = {}) {
        const groupBy = options.groupBy || 'activityLevel';
        const groups = this.groupResults(results, groupBy);
        
        // 그룹별 점수 조정
        Object.keys(groups).forEach(groupKey => {
            const groupResults = groups[groupKey];
            const avgScore = groupResults.reduce((sum, r) => sum + r.relevanceScore, 0) / groupResults.length;
            
            // 그룹 내 상대적 순위에 따른 점수 조정
            groupResults.forEach((result, index) => {
                const positionBonus = (groupResults.length - index) / groupResults.length * 5;
                result.adjustedScore = result.relevanceScore + positionBonus;
            });
        });

        return results.sort((a, b) => (b.adjustedScore || b.relevanceScore) - (a.adjustedScore || a.relevanceScore));
    }

    /**
     * 결과 그룹화
     * @param {Array} results - 검색 결과들
     * @param {string} groupBy - 그룹화 기준
     * @returns {Object} 그룹화된 결과들
     */
    groupResults(results, groupBy) {
        const groups = {};
        
        results.forEach(result => {
            let groupKey;
            
            switch (groupBy) {
                case 'activityLevel':
                    if (result['활동상태'] === 'active') groupKey = 'active';
                    else if (parseInt(result['휴면일수']) <= 90) groupKey = 'recent';
                    else groupKey = 'dormant';
                    break;
                case 'valueLevel':
                    const netBet = parseFloat(result['총유효배팅']) || 0;
                    if (netBet >= 1000000) groupKey = 'high';
                    else if (netBet >= 100000) groupKey = 'medium';
                    else groupKey = 'low';
                    break;
                default:
                    groupKey = 'default';
            }
            
            if (!groups[groupKey]) groups[groupKey] = [];
            groups[groupKey].push(result);
        });
        
        return groups;
    }

    /**
     * 점수 가중치 동적 조정
     * @param {Object} queryContext - 검색 맥락 정보
     * @returns {Object} 조정된 가중치
     */
    adjustWeightsForContext(queryContext) {
        const adjustedWeights = { ...this.fieldWeights };
        
        // 검색 의도에 따른 가중치 조정
        if (queryContext.intent === 'findActiveUsers') {
            adjustedWeights.activityScore *= 2;
            adjustedWeights.recency *= 1.5;
        } else if (queryContext.intent === 'findHighValueUsers') {
            adjustedWeights.activityScore *= 1.5;
            // 행동 점수에서 netBet 가중치 증가
            this.behaviorWeights.netBet *= 2;
        }
        
        return adjustedWeights;
    }

    /**
     * 검색 품질 메트릭 계산
     * @param {Array} results - 검색 결과들
     * @param {Object} queryInfo - 검색 정보
     * @returns {Object} 품질 메트릭
     */
    calculateQualityMetrics(results, queryInfo) {
        if (results.length === 0) {
            return {
                precision: 0,
                relevantResults: 0,
                scoreDistribution: {},
                averageScore: 0
            };
        }

        const scores = results.map(r => r.relevanceScore);
        const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        const highQualityThreshold = this.maxScore * 0.7;
        const relevantResults = results.filter(r => r.relevanceScore >= highQualityThreshold).length;
        
        return {
            precision: relevantResults / results.length,
            relevantResults,
            scoreDistribution: this.getScoreDistribution(scores),
            averageScore: Math.round(averageScore * 100) / 100,
            maxScore: Math.max(...scores),
            minScore: Math.min(...scores),
            scoreVariance: this.calculateVariance(scores)
        };
    }

    /**
     * 점수 분포 계산
     * @param {Array} scores - 점수 배열
     * @returns {Object} 점수 분포
     */
    getScoreDistribution(scores) {
        const distribution = {
            excellent: 0, // 80-100
            good: 0,      // 60-79
            fair: 0,      // 40-59
            poor: 0       // 0-39
        };

        scores.forEach(score => {
            if (score >= 80) distribution.excellent++;
            else if (score >= 60) distribution.good++;
            else if (score >= 40) distribution.fair++;
            else distribution.poor++;
        });

        return distribution;
    }

    /**
     * 분산 계산
     * @param {Array} numbers - 숫자 배열
     * @returns {number} 분산값
     */
    calculateVariance(numbers) {
        const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
        const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
        return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
    }
}

module.exports = RelevanceScorer;
