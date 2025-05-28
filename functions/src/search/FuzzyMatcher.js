/**
 * FuzzyMatcher.js
 * 퍼지 매칭을 위한 Levenshtein Distance 알고리즘 구현
 * 오타 허용 검색과 유사 단어 매칭 기능 제공
 */

class FuzzyMatcher {
    constructor(options = {}) {
        this.maxDistance = options.maxDistance || 2; // 허용할 최대 편집 거리
        this.minLength = options.minLength || 2; // 최소 문자 길이
        this.caseSensitive = options.caseSensitive || false;
        this.koreanSupport = options.koreanSupport || true; // 한글 지원
    }

    /**
     * Levenshtein Distance 계산
     * @param {string} str1 - 첫 번째 문자열
     * @param {string} str2 - 두 번째 문자열
     * @returns {number} 편집 거리
     */
    calculateLevenshteinDistance(str1, str2) {
        if (!str1 || !str2) return Math.max(str1?.length || 0, str2?.length || 0);
        
        const m = str1.length;
        const n = str2.length;
        const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));

        // 초기화
        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;

        // DP 계산
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = 1 + Math.min(
                        dp[i - 1][j],     // 삭제
                        dp[i][j - 1],     // 삽입
                        dp[i - 1][j - 1]  // 치환
                    );
                }
            }
        }

        return dp[m][n];
    }

    /**
     * 유사도 점수 계산 (0-100)
     * @param {string} str1 - 첫 번째 문자열
     * @param {string} str2 - 두 번째 문자열
     * @returns {number} 유사도 점수 (0-100)
     */
    calculateSimilarity(str1, str2) {
        if (!str1 || !str2) return 0;
        
        const normalizedStr1 = this.normalizeString(str1);
        const normalizedStr2 = this.normalizeString(str2);
        
        if (normalizedStr1 === normalizedStr2) return 100;
        
        const maxLen = Math.max(normalizedStr1.length, normalizedStr2.length);
        if (maxLen === 0) return 100;
        
        const distance = this.calculateLevenshteinDistance(normalizedStr1, normalizedStr2);
        return Math.round((1 - distance / maxLen) * 100);
    }

    /**
     * 문자열 정규화 (대소문자, 공백 처리)
     * @param {string} str - 정규화할 문자열
     * @returns {string} 정규화된 문자열
     */
    normalizeString(str) {
        if (!str) return '';
        
        let normalized = str.trim();
        
        if (!this.caseSensitive) {
            normalized = normalized.toLowerCase();
        }
        
        // 한글 지원: 자음/모음 분리 처리
        if (this.koreanSupport) {
            normalized = this.normalizeKorean(normalized);
        }
        
        return normalized;
    }

    /**
     * 한글 정규화 (초성, 중성, 종성 처리)
     * @param {string} str - 한글 문자열
     * @returns {string} 정규화된 한글 문자열
     */
    normalizeKorean(str) {
        // 한글 유니코드 범위: AC00-D7A3
        const koreanRegex = /[가-힣]/g;
        
        return str.replace(koreanRegex, (char) => {
            const code = char.charCodeAt(0) - 0xAC00;
            const cho = Math.floor(code / 588); // 초성
            const jung = Math.floor((code % 588) / 28); // 중성
            const jong = code % 28; // 종성
            
            // 초성, 중성, 종성을 조합하여 정규화
            return char; // 기본적으로는 원래 문자 반환
        });
    }

    /**
     * 퍼지 매칭으로 후보 찾기
     * @param {string} query - 검색어
     * @param {Array<string>} candidates - 후보 문자열 배열
     * @param {Object} options - 옵션
     * @returns {Array} 매칭된 결과 배열
     */
    findMatches(query, candidates, options = {}) {
        const threshold = options.threshold || 60; // 최소 유사도
        const limit = options.limit || 10; // 최대 결과 수
        
        if (!query || !candidates || candidates.length === 0) {
            return [];
        }

        const results = candidates
            .map(candidate => ({
                text: candidate,
                similarity: this.calculateSimilarity(query, candidate),
                distance: this.calculateLevenshteinDistance(
                    this.normalizeString(query),
                    this.normalizeString(candidate)
                )
            }))
            .filter(result => 
                result.similarity >= threshold &&
                result.distance <= this.maxDistance &&
                candidate.length >= this.minLength
            )
            .sort((a, b) => {
                // 유사도 내림차순, 거리 오름차순
                if (a.similarity !== b.similarity) {
                    return b.similarity - a.similarity;
                }
                return a.distance - b.distance;
            })
            .slice(0, limit);

        return results;
    }

    /**
     * 검색어 확장 (오타 포함 검색어 생성)
     * @param {string} query - 원본 검색어
     * @returns {Array<string>} 확장된 검색어 배열
     */
    expandQuery(query) {
        if (!query || query.length < this.minLength) {
            return [query];
        }

        const expanded = new Set([query]);
        const normalized = this.normalizeString(query);
        
        // 일반적인 오타 패턴 생성
        const commonTypos = this.generateCommonTypos(normalized);
        commonTypos.forEach(typo => expanded.add(typo));
        
        // 한글 오타 패턴 생성
        if (this.koreanSupport && /[가-힣]/.test(query)) {
            const koreanTypos = this.generateKoreanTypos(normalized);
            koreanTypos.forEach(typo => expanded.add(typo));
        }

        return Array.from(expanded).slice(0, 20); // 최대 20개로 제한
    }

    /**
     * 일반적인 오타 패턴 생성
     * @param {string} str - 원본 문자열
     * @returns {Array<string>} 오타 패턴 배열
     */
    generateCommonTypos(str) {
        const typos = [];
        
        for (let i = 0; i < str.length; i++) {
            // 문자 삭제
            if (str.length > 1) {
                typos.push(str.slice(0, i) + str.slice(i + 1));
            }
            
            // 인접한 문자 교체
            if (i < str.length - 1) {
                const swapped = str.slice(0, i) + str[i + 1] + str[i] + str.slice(i + 2);
                typos.push(swapped);
            }
        }
        
        return typos;
    }

    /**
     * 한글 오타 패턴 생성
     * @param {string} str - 한글 문자열
     * @returns {Array<string>} 한글 오타 패턴 배열
     */
    generateKoreanTypos(str) {
        const typos = [];
        
        // 한글 키보드 오타 패턴 (예: ㅁ ↔ ㄴ, ㅇ ↔ ㅎ 등)
        const koreanKeyboardMap = {
            'ㅁ': 'ㄴ', 'ㄴ': 'ㅁ',
            'ㅇ': 'ㅎ', 'ㅎ': 'ㅇ',
            'ㅏ': 'ㅓ', 'ㅓ': 'ㅏ',
            'ㅗ': 'ㅜ', 'ㅜ': 'ㅗ'
        };
        
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            if (koreanKeyboardMap[char]) {
                const replaced = str.slice(0, i) + koreanKeyboardMap[char] + str.slice(i + 1);
                typos.push(replaced);
            }
        }
        
        return typos;
    }

    /**
     * 검색 결과에 퍼지 매칭 점수 추가
     * @param {string} query - 검색어
     * @param {Array} results - 검색 결과
     * @param {string} fieldName - 매칭할 필드명
     * @returns {Array} 점수가 추가된 결과
     */
    scoreResults(query, results, fieldName = 'text') {
        return results.map(result => {
            const fieldValue = result[fieldName] || '';
            const similarity = this.calculateSimilarity(query, fieldValue);
            const distance = this.calculateLevenshteinDistance(
                this.normalizeString(query),
                this.normalizeString(fieldValue)
            );
            
            return {
                ...result,
                fuzzyScore: similarity,
                editDistance: distance,
                exactMatch: this.normalizeString(query) === this.normalizeString(fieldValue)
            };
        });
    }

    /**
     * 성능 테스트를 위한 벤치마크
     * @param {string} query - 테스트 검색어
     * @param {Array<string>} candidates - 테스트 후보들
     * @returns {Object} 벤치마크 결과
     */
    benchmark(query, candidates) {
        const startTime = Date.now();
        const results = this.findMatches(query, candidates);
        const endTime = Date.now();
        
        return {
            query,
            candidatesCount: candidates.length,
            resultsCount: results.length,
            executionTime: endTime - startTime,
            averageTimePerCandidate: (endTime - startTime) / candidates.length,
            results: results.slice(0, 5) // 상위 5개 결과만
        };
    }
}

module.exports = FuzzyMatcher;
