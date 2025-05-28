/**
 * SearchEngine.js
 * 모든 검색 기능을 통합하는 메인 검색 엔진 클래스
 * 쿼리 파싱, 퍼지 매칭, 관련성 점수, 페이지네이션을 종합적으로 관리
 */

const SearchQueryParser = require('./SearchQueryParser');
const FuzzyMatcher = require('./FuzzyMatcher');
const RelevanceScorer = require('./RelevanceScorer');
const SearchPaginator = require('./SearchPaginator');

class SearchEngine {
    constructor(options = {}) {
        // 컴포넌트 초기화
        this.queryParser = new SearchQueryParser(options.queryParser || {});
        this.fuzzyMatcher = new FuzzyMatcher(options.fuzzyMatcher || {});
        this.relevanceScorer = new RelevanceScorer(options.relevanceScorer || {});
        this.paginator = new SearchPaginator(options.paginator || {});
        
        // 검색 설정
        this.enableFuzzySearch = options.enableFuzzySearch !== false;
        this.enableRelevanceScoring = options.enableRelevanceScoring !== false;
        this.enablePagination = options.enablePagination !== false;
        this.defaultSearchFields = options.defaultSearchFields || ['userId'];
        this.maxResults = options.maxResults || 1000;
        this.searchTimeout = options.searchTimeout || 10000; // 10초
        
        // 캐시 설정
        this.cacheEnabled = options.cacheEnabled !== false;
        this.cacheTimeout = options.cacheTimeout || 300000; // 5분
        this.searchCache = new Map();
        
        // 성능 모니터링
        this.performanceTracking = options.performanceTracking !== false;
        this.searchMetrics = {
            totalSearches: 0,
            averageResponseTime: 0,
            cacheHitRate: 0,
            errorRate: 0
        };
    }

    /**
     * 통합 검색 실행
     * @param {string} query - 검색어
     * @param {Array} dataset - 검색 대상 데이터셋
     * @param {Object} options - 검색 옵션
     * @returns {Object} 검색 결과
     */
    async search(query, dataset, options = {}) {
        const startTime = Date.now();
        const searchId = this.generateSearchId();
        
        try {
            // 입력 검증
            const validation = this.validateSearchInput(query, dataset, options);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            // 캐시 확인
            if (this.cacheEnabled) {
                const cached = this.getCachedResult(query, options);
                if (cached) {
                    this.updateMetrics(startTime, true, false);
                    return this.addSearchMetadata(cached, searchId, Date.now() - startTime, true);
                }
            }

            // 1단계: 쿼리 파싱
            const parsedQuery = this.queryParser.parse(query);
            if (!parsedQuery.success) {
                throw new Error(`Query parsing failed: ${parsedQuery.error}`);
            }

            // 2단계: 기본 필터링
            let filteredResults = this.applyBasicFilters(dataset, parsedQuery, options);

            // 3단계: 텍스트 검색 실행
            filteredResults = this.executeTextSearch(filteredResults, parsedQuery, options);

            // 4단계: 퍼지 매칭 (옵션)
            if (this.enableFuzzySearch && options.enableFuzzy !== false) {
                filteredResults = this.applyFuzzyMatching(filteredResults, query, options);
            }

            // 5단계: 관련성 점수 계산
            if (this.enableRelevanceScoring) {
                filteredResults = this.relevanceScorer.scoreResults(query, filteredResults, options);
            }

            // 6단계: 결과 제한
            if (filteredResults.length > this.maxResults) {
                filteredResults = filteredResults.slice(0, this.maxResults);
            }

            // 7단계: 페이지네이션
            let finalResult;
            if (this.enablePagination && options.pagination) {
                finalResult = this.paginator.paginate(filteredResults, options.pagination);
            } else {
                finalResult = {
                    data: filteredResults,
                    totalCount: filteredResults.length,
                    pagination: null
                };
            }

            // 검색 결과에 메타데이터 추가
            const result = this.addSearchMetadata(
                finalResult, 
                searchId, 
                Date.now() - startTime, 
                false,
                parsedQuery
            );

            // 캐시 저장
            if (this.cacheEnabled) {
                this.cacheResult(query, options, result);
            }

            this.updateMetrics(startTime, false, false);
            return result;

        } catch (error) {
            this.updateMetrics(startTime, false, true);
            throw new Error(`Search failed: ${error.message}`);
        }
    }

    /**
     * 입력 검증
     * @param {string} query - 검색어
     * @param {Array} dataset - 데이터셋
     * @param {Object} options - 옵션
     * @returns {Object} 검증 결과
     */
    validateSearchInput(query, dataset, options) {
        if (!query || typeof query !== 'string') {
            return { valid: false, error: 'Query must be a non-empty string' };
        }

        if (!Array.isArray(dataset)) {
            return { valid: false, error: 'Dataset must be an array' };
        }

        if (query.length > 1000) {
            return { valid: false, error: 'Query too long (max 1000 characters)' };
        }

        if (dataset.length > 100000) {
            return { valid: false, error: 'Dataset too large (max 100,000 items)' };
        }

        return { valid: true };
    }

    /**
     * 기본 필터링 적용
     * @param {Array} dataset - 데이터셋
     * @param {Object} parsedQuery - 파싱된 쿼리
     * @param {Object} options - 옵션
     * @returns {Array} 필터링된 결과
     */
    applyBasicFilters(dataset, parsedQuery, options) {
        // 기본 필드 필터링
        if (options.filters) {
            return dataset.filter(item => {
                return Object.entries(options.filters).every(([field, value]) => {
                    const itemValue = this.getFieldValue(item, field);
                    if (Array.isArray(value)) {
                        return value.includes(itemValue);
                    }
                    return itemValue === value;
                });
            });
        }

        return dataset;
    }

    /**
     * 텍스트 검색 실행
     * @param {Array} dataset - 데이터셋
     * @param {Object} parsedQuery - 파싱된 쿼리
     * @param {Object} options - 옵션
     * @returns {Array} 검색 결과
     */
    executeTextSearch(dataset, parsedQuery, options) {
        const searchFields = options.searchFields || this.defaultSearchFields;
        
        return dataset.filter(item => {
            return this.matchesQuery(item, parsedQuery.query, searchFields);
        });
    }

    /**
     * 항목이 쿼리와 매치되는지 확인
     * @param {Object} item - 검색 대상 항목
     * @param {Object} queryNode - 쿼리 AST 노드
     * @param {Array} searchFields - 검색 필드들
     * @returns {boolean} 매치 여부
     */
    matchesQuery(item, queryNode, searchFields) {
        if (!queryNode) return true;

        switch (queryNode.type) {
            case 'SEARCH_TERM':
                return this.matchesSearchTerm(item, queryNode, searchFields);
            
            case 'FIELD_SEARCH':
                return this.matchesFieldSearch(item, queryNode);
            
            case 'BINARY_OP':
                const leftMatch = this.matchesQuery(item, queryNode.left, searchFields);
                const rightMatch = this.matchesQuery(item, queryNode.right, searchFields);
                
                if (queryNode.operator === 'AND') {
                    return leftMatch && rightMatch;
                } else if (queryNode.operator === 'OR') {
                    return leftMatch || rightMatch;
                }
                return false;
            
            case 'UNARY_OP':
                const operandMatch = this.matchesQuery(item, queryNode.operand, searchFields);
                
                if (queryNode.operator === 'NOT' || queryNode.operator === '-') {
                    return !operandMatch;
                }
                return operandMatch;
            
            case 'GROUP':
                return this.matchesQuery(item, queryNode.expression, searchFields);
            
            default:
                return false;
        }
    }

    /**
     * 검색 용어 매칭
     * @param {Object} item - 검색 대상 항목
     * @param {Object} termNode - 용어 노드
     * @param {Array} searchFields - 검색 필드들
     * @returns {boolean} 매치 여부
     */
    matchesSearchTerm(item, termNode, searchFields) {
        const searchValue = termNode.value.toLowerCase();
        
        return searchFields.some(field => {
            const fieldValue = String(this.getFieldValue(item, field) || '').toLowerCase();
            
            if (termNode.exact) {
                return fieldValue === searchValue;
            } else if (termNode.wildcard) {
                const pattern = searchValue.replace(/\*/g, '.*');
                const regex = new RegExp(pattern, 'i');
                return regex.test(fieldValue);
            } else {
                return fieldValue.includes(searchValue);
            }
        });
    }

    /**
     * 필드 검색 매칭
     * @param {Object} item - 검색 대상 항목
     * @param {Object} fieldNode - 필드 노드
     * @returns {boolean} 매치 여부
     */
    matchesFieldSearch(item, fieldNode) {
        const fieldValue = String(this.getFieldValue(item, fieldNode.field) || '').toLowerCase();
        const searchValue = fieldNode.value.toLowerCase();
        
        if (fieldNode.exact) {
            return fieldValue === searchValue;
        } else {
            return fieldValue.includes(searchValue);
        }
    }

    /**
     * 퍼지 매칭 적용
     * @param {Array} results - 검색 결과
     * @param {string} query - 원본 쿼리
     * @param {Object} options - 옵션
     * @returns {Array} 퍼지 매칭 결과
     */
    applyFuzzyMatching(results, query, options) {
        const fuzzyOptions = {
            threshold: options.fuzzyThreshold || 60,
            limit: options.fuzzyLimit || results.length
        };

        // 각 결과에 퍼지 점수 추가
        return this.fuzzyMatcher.scoreResults(query, results, 'userId');
    }

    /**
     * 객체에서 필드 값 추출
     * @param {Object} obj - 대상 객체
     * @param {string} fieldPath - 필드 경로
     * @returns {*} 필드 값
     */
    getFieldValue(obj, fieldPath) {
        return fieldPath.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : null;
        }, obj);
    }

    /**
     * 검색 결과에 메타데이터 추가
     * @param {Object} result - 검색 결과
     * @param {string} searchId - 검색 ID
     * @param {number} responseTime - 응답 시간
     * @param {boolean} fromCache - 캐시에서 조회 여부
     * @param {Object} parsedQuery - 파싱된 쿼리 (선택적)
     * @returns {Object} 메타데이터가 추가된 결과
     */
    addSearchMetadata(result, searchId, responseTime, fromCache, parsedQuery = null) {
        return {
            ...result,
            searchMetadata: {
                searchId,
                responseTime,
                fromCache,
                timestamp: new Date().toISOString(),
                queryComplexity: parsedQuery ? parsedQuery.complexity : null,
                termCount: parsedQuery ? parsedQuery.termCount : null,
                engine: 'DB3 Advanced Search v1.0'
            }
        };
    }

    /**
     * 고급 검색 (SQL 기반)
     * @param {string} query - 검색어
     * @param {Object} queryBuilder - 쿼리 빌더 인스턴스
     * @param {Object} options - 검색 옵션
     * @returns {Object} 검색 결과
     */
    async advancedSearch(query, queryBuilder, options = {}) {
        const startTime = Date.now();
        
        try {
            // 쿼리 파싱
            const parsedQuery = this.queryParser.parse(query);
            if (!parsedQuery.success) {
                throw new Error(`Query parsing failed: ${parsedQuery.error}`);
            }

            // SQL 조건 생성
            const sqlParams = [];
            const whereClause = this.queryParser.toSQL(parsedQuery.query, sqlParams);

            // 기본 쿼리 구성
            let dbQuery = queryBuilder
                .select('p.userId', 'p.status')
                .leftJoin('game_scores gs', 'p.userId', 'gs.userId')
                .groupBy('p.userId');

            // WHERE 조건 추가
            if (whereClause) {
                dbQuery = dbQuery.whereRaw(whereClause, sqlParams);
            }

            // 추가 필터 적용
            if (options.filters) {
                Object.entries(options.filters).forEach(([field, value]) => {
                    if (Array.isArray(value)) {
                        dbQuery = dbQuery.whereIn(field, value);
                    } else {
                        dbQuery = dbQuery.where(field, value);
                    }
                });
            }

            // 정렬
            const sortField = options.sortField || 'relevanceScore';
            const sortDirection = options.sortDirection || 'DESC';
            
            if (sortField !== 'relevanceScore') {
                dbQuery = dbQuery.orderBy(sortField, sortDirection);
            }

            // 결과 실행
            const results = await dbQuery.execute();

            // 관련성 점수 계산 (메모리 내에서)
            let scoredResults = results;
            if (this.enableRelevanceScoring) {
                scoredResults = this.relevanceScorer.scoreResults(query, results, options);
            }

            // 페이지네이션
            let finalResult;
            if (this.enablePagination && options.pagination) {
                finalResult = this.paginator.paginate(scoredResults, options.pagination);
            } else {
                finalResult = {
                    data: scoredResults,
                    totalCount: scoredResults.length,
                    pagination: null
                };
            }

            return this.addSearchMetadata(
                finalResult,
                this.generateSearchId(),
                Date.now() - startTime,
                false,
                parsedQuery
            );

        } catch (error) {
            throw new Error(`Advanced search failed: ${error.message}`);
        }
    }

    /**
     * 검색 제안 생성
     * @param {string} query - 부분 검색어
     * @param {Array} dataset - 데이터셋
     * @param {Object} options - 옵션
     * @returns {Array} 검색 제안들
     */
    getSuggestions(query, dataset, options = {}) {
        const maxSuggestions = options.maxSuggestions || 10;
        const minSimilarity = options.minSimilarity || 70;
        
        // 사용자 ID 후보 수집
        const candidates = dataset.map(item => item.userId).filter(Boolean);
        
        // 퍼지 매칭으로 유사한 것들 찾기
        const matches = this.fuzzyMatcher.findMatches(query, candidates, {
            threshold: minSimilarity,
            limit: maxSuggestions
        });

        return matches.map(match => ({
            suggestion: match.text,
            similarity: match.similarity,
            type: 'userId'
        }));
    }

    /**
     * 캐시 관련 메서드들
     */
    generateCacheKey(query, options) {
        const key = {
            query: query.trim().toLowerCase(),
            filters: options.filters || {},
            searchFields: options.searchFields || this.defaultSearchFields,
            fuzzy: options.enableFuzzy !== false
        };
        return JSON.stringify(key);
    }

    getCachedResult(query, options) {
        const key = this.generateCacheKey(query, options);
        const cached = this.searchCache.get(key);
        
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > this.cacheTimeout) {
            this.searchCache.delete(key);
            return null;
        }
        
        return cached.result;
    }

    cacheResult(query, options, result) {
        const key = this.generateCacheKey(query, options);
        
        // 결과 크기 제한 (10MB)
        const resultSize = JSON.stringify(result).length;
        if (resultSize > 10 * 1024 * 1024) return;
        
        this.searchCache.set(key, {
            result,
            timestamp: Date.now()
        });
        
        // 캐시 크기 제한 (100개)
        if (this.searchCache.size > 100) {
            const oldestKey = this.searchCache.keys().next().value;
            this.searchCache.delete(oldestKey);
        }
    }

    /**
     * 성능 메트릭 업데이트
     * @param {number} startTime - 시작 시간
     * @param {boolean} fromCache - 캐시에서 조회 여부
     * @param {boolean} hasError - 오류 발생 여부
     */
    updateMetrics(startTime, fromCache, hasError) {
        if (!this.performanceTracking) return;
        
        const responseTime = Date.now() - startTime;
        this.searchMetrics.totalSearches++;
        
        // 평균 응답 시간 업데이트
        const totalTime = this.searchMetrics.averageResponseTime * (this.searchMetrics.totalSearches - 1);
        this.searchMetrics.averageResponseTime = (totalTime + responseTime) / this.searchMetrics.totalSearches;
        
        // 캐시 히트율 업데이트
        if (fromCache) {
            this.searchMetrics.cacheHitRate = 
                (this.searchMetrics.cacheHitRate * (this.searchMetrics.totalSearches - 1) + 100) / 
                this.searchMetrics.totalSearches;
        } else {
            this.searchMetrics.cacheHitRate = 
                (this.searchMetrics.cacheHitRate * (this.searchMetrics.totalSearches - 1)) / 
                this.searchMetrics.totalSearches;
        }
        
        // 오류율 업데이트
        if (hasError) {
            this.searchMetrics.errorRate = 
                (this.searchMetrics.errorRate * (this.searchMetrics.totalSearches - 1) + 100) / 
                this.searchMetrics.totalSearches;
        } else {
            this.searchMetrics.errorRate = 
                (this.searchMetrics.errorRate * (this.searchMetrics.totalSearches - 1)) / 
                this.searchMetrics.totalSearches;
        }
    }

    /**
     * 유틸리티 메서드들
     */
    generateSearchId() {
        return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }

    getMetrics() {
        return {
            ...this.searchMetrics,
            cacheSize: this.searchCache.size,
            timestamp: new Date().toISOString()
        };
    }

    clearCache() {
        this.searchCache.clear();
        this.paginator.clearCache();
    }

    /**
     * 검색 엔진 성능 테스트
     * @param {Array} testQueries - 테스트 쿼리들
     * @param {Array} dataset - 테스트 데이터셋
     * @returns {Object} 성능 테스트 결과
     */
    async performanceTest(testQueries, dataset) {
        const results = [];
        
        for (const query of testQueries) {
            const startTime = Date.now();
            
            try {
                const result = await this.search(query, dataset);
                const responseTime = Date.now() - startTime;
                
                results.push({
                    query,
                    success: true,
                    responseTime,
                    resultCount: result.data.length,
                    fromCache: result.searchMetadata.fromCache
                });
            } catch (error) {
                results.push({
                    query,
                    success: false,
                    error: error.message,
                    responseTime: Date.now() - startTime
                });
            }
        }
        
        // 통계 계산
        const successfulResults = results.filter(r => r.success);
        const averageResponseTime = successfulResults.length > 0 ?
            successfulResults.reduce((sum, r) => sum + r.responseTime, 0) / successfulResults.length : 0;
        
        return {
            totalQueries: testQueries.length,
            successfulQueries: successfulResults.length,
            successRate: (successfulResults.length / testQueries.length) * 100,
            averageResponseTime: Math.round(averageResponseTime),
            maxResponseTime: Math.max(...successfulResults.map(r => r.responseTime)),
            minResponseTime: Math.min(...successfulResults.map(r => r.responseTime)),
            results
        };
    }
}

module.exports = SearchEngine;
