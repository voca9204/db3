/**
 * SearchPaginator.js
 * 커서 기반 페이지네이션 시스템 구현
 * 대용량 데이터의 효율적인 페이지 처리와 무한 스크롤 지원
 */

class SearchPaginator {
    constructor(options = {}) {
        this.defaultPageSize = options.defaultPageSize || 20;
        this.maxPageSize = options.maxPageSize || 100;
        this.cursorField = options.cursorField || 'id';
        this.sortField = options.sortField || 'relevanceScore';
        this.sortDirection = options.sortDirection || 'DESC';
        this.enableCount = options.enableCount !== false;
        this.cacheTimeout = options.cacheTimeout || 300000; // 5분
        this.cursorCache = new Map();
    }

    /**
     * 페이지네이션된 검색 결과 생성
     * @param {Array} results - 전체 검색 결과
     * @param {Object} pagination - 페이지네이션 옵션
     * @returns {Object} 페이지네이션된 결과
     */
    paginate(results, pagination = {}) {
        const {
            cursor = null,
            pageSize = this.defaultPageSize,
            direction = 'next'
        } = pagination;

        // 페이지 크기 검증
        const validatedPageSize = Math.min(Math.max(1, pageSize), this.maxPageSize);

        // 정렬
        const sortedResults = this.sortResults(results);
        
        // 커서 위치 찾기
        let startIndex = 0;
        if (cursor) {
            startIndex = this.findCursorPosition(sortedResults, cursor, direction);
        }

        // 페이지 결과 추출
        const pageResults = this.extractPageResults(sortedResults, startIndex, validatedPageSize, direction);
        
        // 페이지네이션 메타데이터 생성
        const metadata = this.createPaginationMetadata(
            sortedResults,
            pageResults,
            startIndex,
            validatedPageSize,
            cursor,
            direction
        );

        return {
            data: pageResults,
            pagination: metadata,
            totalCount: this.enableCount ? sortedResults.length : null
        };
    }

    /**
     * 결과 정렬
     * @param {Array} results - 정렬할 결과들
     * @returns {Array} 정렬된 결과들
     */
    sortResults(results) {
        return [...results].sort((a, b) => {
            const aValue = this.getFieldValue(a, this.sortField);
            const bValue = this.getFieldValue(b, this.sortField);

            let comparison = 0;
            
            // 숫자 비교
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                comparison = aValue - bValue;
            }
            // 문자열 비교
            else if (typeof aValue === 'string' && typeof bValue === 'string') {
                comparison = aValue.localeCompare(bValue);
            }
            // 날짜 비교
            else if (aValue instanceof Date && bValue instanceof Date) {
                comparison = aValue.getTime() - bValue.getTime();
            }
            // 기본 비교
            else {
                comparison = String(aValue).localeCompare(String(bValue));
            }

            return this.sortDirection === 'DESC' ? -comparison : comparison;
        });
    }

    /**
     * 객체에서 필드 값 추출
     * @param {Object} obj - 대상 객체
     * @param {string} fieldPath - 필드 경로 (dot notation 지원)
     * @returns {*} 필드 값
     */
    getFieldValue(obj, fieldPath) {
        return fieldPath.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : null;
        }, obj);
    }

    /**
     * 커서 위치 찾기
     * @param {Array} results - 정렬된 결과들
     * @param {string} cursor - 커서 값
     * @param {string} direction - 방향 ('next' 또는 'prev')
     * @returns {number} 시작 인덱스
     */
    findCursorPosition(results, cursor, direction) {
        const decodedCursor = this.decodeCursor(cursor);
        if (!decodedCursor) return 0;

        // 커서에 해당하는 항목 찾기
        const cursorIndex = results.findIndex(item => {
            const itemCursor = this.getFieldValue(item, this.cursorField);
            return String(itemCursor) === String(decodedCursor.value);
        });

        if (cursorIndex === -1) {
            // 커서 항목을 찾을 수 없는 경우, 정렬 값으로 근사 위치 찾기
            return this.findApproximatePosition(results, decodedCursor, direction);
        }

        // 방향에 따른 시작 위치 조정
        if (direction === 'next') {
            return cursorIndex + 1;
        } else {
            return Math.max(0, cursorIndex - 1);
        }
    }

    /**
     * 근사 위치 찾기 (커서 항목이 없는 경우)
     * @param {Array} results - 정렬된 결과들
     * @param {Object} decodedCursor - 디코딩된 커서
     * @param {string} direction - 방향
     * @returns {number} 근사 시작 인덱스
     */
    findApproximatePosition(results, decodedCursor, direction) {
        const targetValue = decodedCursor.sortValue;
        
        // 이진 탐색으로 근사 위치 찾기
        let left = 0;
        let right = results.length - 1;
        
        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const midValue = this.getFieldValue(results[mid], this.sortField);
            
            let comparison = 0;
            if (typeof midValue === 'number' && typeof targetValue === 'number') {
                comparison = midValue - targetValue;
            } else {
                comparison = String(midValue).localeCompare(String(targetValue));
            }
            
            if (this.sortDirection === 'DESC') {
                comparison = -comparison;
            }
            
            if (comparison < 0) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
        
        return direction === 'next' ? left : Math.max(0, right);
    }

    /**
     * 페이지 결과 추출
     * @param {Array} results - 전체 결과들
     * @param {number} startIndex - 시작 인덱스
     * @param {number} pageSize - 페이지 크기
     * @param {string} direction - 방향
     * @returns {Array} 페이지 결과들
     */
    extractPageResults(results, startIndex, pageSize, direction) {
        if (direction === 'prev') {
            // 이전 페이지의 경우 역순으로 추출 후 다시 정렬
            const endIndex = Math.max(0, startIndex - pageSize);
            const pageResults = results.slice(endIndex, startIndex);
            return pageResults.reverse();
        } else {
            // 다음 페이지
            return results.slice(startIndex, startIndex + pageSize);
        }
    }

    /**
     * 페이지네이션 메타데이터 생성
     * @param {Array} allResults - 전체 결과들
     * @param {Array} pageResults - 페이지 결과들
     * @param {number} startIndex - 시작 인덱스
     * @param {number} pageSize - 페이지 크기
     * @param {string} currentCursor - 현재 커서
     * @param {string} direction - 방향
     * @returns {Object} 메타데이터
     */
    createPaginationMetadata(allResults, pageResults, startIndex, pageSize, currentCursor, direction) {
        const hasNext = (startIndex + pageResults.length) < allResults.length;
        const hasPrev = startIndex > 0;
        
        // 다음/이전 커서 생성
        const nextCursor = hasNext && pageResults.length > 0 ? 
            this.encodeCursor(pageResults[pageResults.length - 1]) : null;
        
        const prevCursor = hasPrev && pageResults.length > 0 ?
            this.encodeCursor(pageResults[0]) : null;

        return {
            pageSize: pageResults.length,
            requestedPageSize: pageSize,
            hasNext,
            hasPrev,
            nextCursor,
            prevCursor,
            currentCursor,
            startIndex,
            endIndex: startIndex + pageResults.length - 1,
            direction,
            sortField: this.sortField,
            sortDirection: this.sortDirection
        };
    }

    /**
     * 커서 인코딩
     * @param {Object} item - 커서로 사용할 항목
     * @returns {string} 인코딩된 커서
     */
    encodeCursor(item) {
        if (!item) return null;

        const cursorData = {
            value: this.getFieldValue(item, this.cursorField),
            sortValue: this.getFieldValue(item, this.sortField),
            timestamp: Date.now()
        };

        // Base64 인코딩
        const encoded = Buffer.from(JSON.stringify(cursorData)).toString('base64');
        
        // 캐시에 저장
        this.cacheCursor(encoded, cursorData);
        
        return encoded;
    }

    /**
     * 커서 디코딩
     * @param {string} cursor - 인코딩된 커서
     * @returns {Object|null} 디코딩된 커서 데이터
     */
    decodeCursor(cursor) {
        if (!cursor) return null;

        try {
            // 캐시에서 먼저 확인
            const cached = this.getCachedCursor(cursor);
            if (cached) return cached;

            // Base64 디코딩
            const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
            
            // 캐시에 저장
            this.cacheCursor(cursor, decoded);
            
            return decoded;
        } catch (error) {
            console.warn('Failed to decode cursor:', error.message);
            return null;
        }
    }

    /**
     * 커서 캐시 저장
     * @param {string} cursor - 커서 문자열
     * @param {Object} data - 커서 데이터
     */
    cacheCursor(cursor, data) {
        this.cursorCache.set(cursor, {
            data,
            timestamp: Date.now()
        });
        
        // 캐시 크기 제한 (1000개)
        if (this.cursorCache.size > 1000) {
            const oldestKey = this.cursorCache.keys().next().value;
            this.cursorCache.delete(oldestKey);
        }
    }

    /**
     * 캐시된 커서 조회
     * @param {string} cursor - 커서 문자열
     * @returns {Object|null} 캐시된 데이터
     */
    getCachedCursor(cursor) {
        const cached = this.cursorCache.get(cursor);
        if (!cached) return null;

        // 캐시 만료 확인
        if (Date.now() - cached.timestamp > this.cacheTimeout) {
            this.cursorCache.delete(cursor);
            return null;
        }

        return cached.data;
    }

    /**
     * 오프셋 기반 페이지네이션을 커서 기반으로 변환
     * @param {number} page - 페이지 번호 (1부터 시작)
     * @param {number} pageSize - 페이지 크기
     * @param {Array} results - 전체 결과들
     * @returns {Object} 페이지네이션 옵션
     */
    offsetToCursor(page, pageSize, results) {
        const offset = (page - 1) * pageSize;
        
        if (offset === 0) {
            return { cursor: null, pageSize, direction: 'next' };
        }

        const sortedResults = this.sortResults(results);
        const cursorItem = sortedResults[offset - 1];
        
        return {
            cursor: cursorItem ? this.encodeCursor(cursorItem) : null,
            pageSize,
            direction: 'next'
        };
    }

    /**
     * 무한 스크롤을 위한 다음 페이지 정보 생성
     * @param {Object} currentPage - 현재 페이지 정보
     * @returns {Object} 다음 페이지 로드 정보
     */
    getInfiniteScrollInfo(currentPage) {
        if (!currentPage.pagination.hasNext) {
            return {
                hasMore: false,
                nextCursor: null,
                loadMoreUrl: null
            };
        }

        return {
            hasMore: true,
            nextCursor: currentPage.pagination.nextCursor,
            loadMoreUrl: this.buildLoadMoreUrl(currentPage.pagination.nextCursor),
            estimatedRemaining: currentPage.totalCount ? 
                currentPage.totalCount - currentPage.pagination.endIndex - 1 : null
        };
    }

    /**
     * 더 보기 URL 생성
     * @param {string} cursor - 다음 커서
     * @returns {string} URL
     */
    buildLoadMoreUrl(cursor) {
        const params = new URLSearchParams({
            cursor,
            pageSize: this.defaultPageSize.toString(),
            direction: 'next'
        });
        
        return `?${params.toString()}`;
    }

    /**
     * 페이지네이션 통계 정보 생성
     * @param {Array} allResults - 전체 결과들
     * @param {Object} currentPage - 현재 페이지
     * @returns {Object} 통계 정보
     */
    getStatistics(allResults, currentPage) {
        const totalCount = allResults.length;
        const currentPageSize = currentPage.data.length;
        const startIndex = currentPage.pagination.startIndex;
        
        return {
            totalItems: totalCount,
            currentPageItems: currentPageSize,
            estimatedPages: Math.ceil(totalCount / this.defaultPageSize),
            currentPosition: {
                from: startIndex + 1,
                to: startIndex + currentPageSize,
                of: totalCount
            },
            completionPercentage: totalCount > 0 ? 
                Math.round(((startIndex + currentPageSize) / totalCount) * 100) : 0
        };
    }

    /**
     * 커서 유효성 검증
     * @param {string} cursor - 검증할 커서
     * @param {Array} results - 현재 결과 집합
     * @returns {Object} 검증 결과
     */
    validateCursor(cursor, results) {
        if (!cursor) {
            return { valid: true, reason: null };
        }

        const decoded = this.decodeCursor(cursor);
        if (!decoded) {
            return { valid: false, reason: 'Invalid cursor format' };
        }

        // 커서 나이 확인
        const age = Date.now() - decoded.timestamp;
        if (age > this.cacheTimeout) {
            return { valid: false, reason: 'Cursor expired' };
        }

        // 커서 항목이 여전히 존재하는지 확인
        const exists = results.some(item => {
            const itemValue = this.getFieldValue(item, this.cursorField);
            return String(itemValue) === String(decoded.value);
        });

        if (!exists) {
            return { valid: false, reason: 'Cursor item no longer exists' };
        }

        return { valid: true, reason: null };
    }

    /**
     * 페이지네이션 성능 벤치마크
     * @param {Array} results - 테스트할 결과들
     * @param {Object} options - 벤치마크 옵션
     * @returns {Object} 성능 지표
     */
    benchmark(results, options = {}) {
        const iterations = options.iterations || 10;
        const pageSize = options.pageSize || this.defaultPageSize;
        
        const startTime = Date.now();
        
        // 첫 페이지 성능 측정
        const firstPageTime = Date.now();
        const firstPage = this.paginate(results, { pageSize });
        const firstPageDuration = Date.now() - firstPageTime;
        
        // 중간 페이지들 성능 측정
        let cursor = firstPage.pagination.nextCursor;
        const pageLoadTimes = [firstPageDuration];
        
        for (let i = 1; i < iterations && cursor; i++) {
            const pageTime = Date.now();
            const page = this.paginate(results, { cursor, pageSize });
            const pageDuration = Date.now() - pageTime;
            
            pageLoadTimes.push(pageDuration);
            cursor = page.pagination.nextCursor;
        }
        
        const totalTime = Date.now() - startTime;
        
        return {
            totalItems: results.length,
            iterations: pageLoadTimes.length,
            totalTime,
            averagePageTime: pageLoadTimes.reduce((sum, time) => sum + time, 0) / pageLoadTimes.length,
            maxPageTime: Math.max(...pageLoadTimes),
            minPageTime: Math.min(...pageLoadTimes),
            itemsPerSecond: Math.round((pageLoadTimes.length * pageSize) / (totalTime / 1000)),
            memoryEfficiency: 'cursor-based' // vs 'offset-based'
        };
    }

    /**
     * 캐시 정리
     */
    clearCache() {
        this.cursorCache.clear();
    }

    /**
     * 캐시 상태 정보
     * @returns {Object} 캐시 정보
     */
    getCacheInfo() {
        const now = Date.now();
        let expiredCount = 0;
        
        for (const [cursor, data] of this.cursorCache.entries()) {
            if (now - data.timestamp > this.cacheTimeout) {
                expiredCount++;
            }
        }
        
        return {
            totalCursors: this.cursorCache.size,
            expiredCursors: expiredCount,
            validCursors: this.cursorCache.size - expiredCount,
            cacheTimeout: this.cacheTimeout,
            memoryUsage: JSON.stringify([...this.cursorCache.entries()]).length
        };
    }
}

module.exports = SearchPaginator;
