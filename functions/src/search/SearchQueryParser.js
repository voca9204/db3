/**
 * SearchQueryParser.js
 * 복잡한 검색 표현식을 파싱하는 클래스
 * AND, OR, NOT, 괄호, 따옴표 등의 연산자 지원
 */

class SearchQueryParser {
    constructor(options = {}) {
        this.defaultOperator = options.defaultOperator || 'AND';
        this.supportQuotes = options.supportQuotes !== false;
        this.supportWildcards = options.supportWildcards || true;
        this.minTermLength = options.minTermLength || 1;
        this.maxTerms = options.maxTerms || 50;
        this.fieldMapping = options.fieldMapping || {};
    }

    /**
     * 검색 쿼리를 파싱하여 구조화된 객체로 변환
     * @param {string} query - 검색 쿼리 문자열
     * @returns {Object} 파싱된 검색 구조
     */
    parse(query) {
        if (!query || typeof query !== 'string') {
            return this.createEmptyResult();
        }

        try {
            // 토큰화
            const tokens = this.tokenize(query.trim());
            
            // 구문 분석
            const ast = this.parseTokens(tokens);
            
            // 최적화
            const optimized = this.optimizeQuery(ast);
            
            // 검증
            this.validateQuery(optimized);
            
            return {
                success: true,
                query: optimized,
                originalQuery: query,
                tokens: tokens,
                termCount: this.countTerms(optimized),
                complexity: this.calculateComplexity(optimized)
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                originalQuery: query,
                query: this.createEmptyResult().query
            };
        }
    }

    /**
     * 쿼리 문자열을 토큰으로 분리
     * @param {string} query - 검색 쿼리
     * @returns {Array} 토큰 배열
     */
    tokenize(query) {
        const tokens = [];
        let currentToken = '';
        let inQuotes = false;
        let quoteChar = '';
        let i = 0;

        while (i < query.length) {
            const char = query[i];
            const nextChar = query[i + 1];

            // 따옴표 처리
            if (this.supportQuotes && (char === '"' || char === "'")) {
                if (!inQuotes) {
                    if (currentToken.trim()) {
                        tokens.push(this.createToken('TERM', currentToken.trim()));
                        currentToken = '';
                    }
                    inQuotes = true;
                    quoteChar = char;
                } else if (char === quoteChar) {
                    if (currentToken.trim()) {
                        tokens.push(this.createToken('PHRASE', currentToken.trim()));
                    }
                    currentToken = '';
                    inQuotes = false;
                    quoteChar = '';
                }
                i++;
                continue;
            }

            // 따옴표 안에서는 모든 문자를 수집
            if (inQuotes) {
                currentToken += char;
                i++;
                continue;
            }

            // 공백 처리
            if (/\s/.test(char)) {
                if (currentToken.trim()) {
                    tokens.push(this.createToken('TERM', currentToken.trim()));
                    currentToken = '';
                }
                i++;
                continue;
            }

            // 괄호 처리
            if (char === '(') {
                if (currentToken.trim()) {
                    tokens.push(this.createToken('TERM', currentToken.trim()));
                    currentToken = '';
                }
                tokens.push(this.createToken('LPAREN', '('));
                i++;
                continue;
            }

            if (char === ')') {
                if (currentToken.trim()) {
                    tokens.push(this.createToken('TERM', currentToken.trim()));
                    currentToken = '';
                }
                tokens.push(this.createToken('RPAREN', ')'));
                i++;
                continue;
            }

            // 연산자 처리
            const operatorMatch = this.matchOperator(query, i);
            if (operatorMatch) {
                if (currentToken.trim()) {
                    tokens.push(this.createToken('TERM', currentToken.trim()));
                    currentToken = '';
                }
                tokens.push(this.createToken('OPERATOR', operatorMatch.operator, operatorMatch.type));
                i += operatorMatch.length;
                continue;
            }

            // 필드 검색 처리 (field:value)
            if (char === ':' && currentToken.trim() && !/\s/.test(currentToken)) {
                const fieldName = currentToken.trim();
                tokens.push(this.createToken('FIELD', fieldName));
                tokens.push(this.createToken('COLON', ':'));
                currentToken = '';
                i++;
                continue;
            }

            // 일반 문자
            currentToken += char;
            i++;
        }

        // 마지막 토큰 처리
        if (currentToken.trim()) {
            tokens.push(this.createToken(inQuotes ? 'PHRASE' : 'TERM', currentToken.trim()));
        }

        return tokens;
    }

    /**
     * 토큰 객체 생성
     * @param {string} type - 토큰 타입
     * @param {string} value - 토큰 값
     * @param {string} subtype - 서브 타입 (선택적)
     * @returns {Object} 토큰 객체
     */
    createToken(type, value, subtype = null) {
        return {
            type,
            value,
            subtype,
            length: value.length
        };
    }

    /**
     * 연산자 매칭
     * @param {string} query - 전체 쿼리
     * @param {number} position - 현재 위치
     * @returns {Object|null} 매칭된 연산자 정보
     */
    matchOperator(query, position) {
        const operators = [
            { pattern: /^AND\b/i, operator: 'AND', type: 'BINARY', length: 3 },
            { pattern: /^OR\b/i, operator: 'OR', type: 'BINARY', length: 2 },
            { pattern: /^NOT\b/i, operator: 'NOT', type: 'UNARY', length: 3 },
            { pattern: /^\+/, operator: '+', type: 'UNARY', length: 1 },
            { pattern: /^-/, operator: '-', type: 'UNARY', length: 1 },
            { pattern: /^&&/, operator: 'AND', type: 'BINARY', length: 2 },
            { pattern: /^\|\|/, operator: 'OR', type: 'BINARY', length: 2 },
            { pattern: /^!/, operator: 'NOT', type: 'UNARY', length: 1 }
        ];

        const remaining = query.slice(position);
        
        for (const op of operators) {
            if (op.pattern.test(remaining)) {
                return {
                    operator: op.operator,
                    type: op.type,
                    length: op.length
                };
            }
        }

        return null;
    }

    /**
     * 토큰들을 파싱하여 AST 생성
     * @param {Array} tokens - 토큰 배열
     * @returns {Object} AST 노드
     */
    parseTokens(tokens) {
        this.tokens = tokens;
        this.position = 0;
        return this.parseExpression();
    }

    /**
     * 표현식 파싱 (최상위 레벨)
     * @returns {Object} AST 노드
     */
    parseExpression() {
        let left = this.parseTerm();

        while (this.position < this.tokens.length) {
            const token = this.currentToken();
            
            if (!token) break;
            
            if (token.type === 'OPERATOR' && token.subtype === 'BINARY') {
                this.position++;
                const right = this.parseTerm();
                left = {
                    type: 'BINARY_OP',
                    operator: token.value,
                    left,
                    right
                };
            } else if (token.type === 'RPAREN') {
                break;
            } else {
                // 암시적 AND 연산자
                const right = this.parseTerm();
                left = {
                    type: 'BINARY_OP',
                    operator: this.defaultOperator,
                    left,
                    right
                };
            }
        }

        return left;
    }

    /**
     * 용어 파싱
     * @returns {Object} AST 노드
     */
    parseTerm() {
        const token = this.currentToken();
        
        if (!token) {
            throw new Error('Unexpected end of query');
        }

        // 단항 연산자 처리
        if (token.type === 'OPERATOR' && token.subtype === 'UNARY') {
            this.position++;
            const operand = this.parseTerm();
            return {
                type: 'UNARY_OP',
                operator: token.value,
                operand
            };
        }

        // 괄호 처리
        if (token.type === 'LPAREN') {
            this.position++;
            const expr = this.parseExpression();
            
            const closeToken = this.currentToken();
            if (!closeToken || closeToken.type !== 'RPAREN') {
                throw new Error('Missing closing parenthesis');
            }
            this.position++;
            
            return {
                type: 'GROUP',
                expression: expr
            };
        }

        // 필드 검색 처리
        if (token.type === 'FIELD') {
            const fieldName = token.value;
            this.position++; // FIELD
            
            const colonToken = this.currentToken();
            if (!colonToken || colonToken.type !== 'COLON') {
                throw new Error('Expected colon after field name');
            }
            this.position++; // COLON
            
            const valueToken = this.currentToken();
            if (!valueToken || (valueToken.type !== 'TERM' && valueToken.type !== 'PHRASE')) {
                throw new Error('Expected value after field:');
            }
            this.position++; // VALUE
            
            return {
                type: 'FIELD_SEARCH',
                field: this.mapField(fieldName),
                value: valueToken.value,
                exact: valueToken.type === 'PHRASE'
            };
        }

        // 일반 용어 또는 구문
        if (token.type === 'TERM' || token.type === 'PHRASE') {
            this.position++;
            return {
                type: 'SEARCH_TERM',
                value: token.value,
                exact: token.type === 'PHRASE',
                wildcard: this.supportWildcards && token.value.includes('*')
            };
        }

        throw new Error(`Unexpected token: ${token.value}`);
    }

    /**
     * 현재 토큰 반환
     * @returns {Object|null} 현재 토큰
     */
    currentToken() {
        return this.position < this.tokens.length ? this.tokens[this.position] : null;
    }

    /**
     * 필드명 매핑
     * @param {string} fieldName - 원본 필드명
     * @returns {string} 매핑된 필드명
     */
    mapField(fieldName) {
        return this.fieldMapping[fieldName.toLowerCase()] || fieldName;
    }

    /**
     * 쿼리 최적화
     * @param {Object} ast - AST 노드
     * @returns {Object} 최적화된 AST
     */
    optimizeQuery(ast) {
        if (!ast) return ast;

        // 중복 제거
        ast = this.removeDuplicates(ast);
        
        // 빈 노드 제거
        ast = this.removeEmptyNodes(ast);
        
        // 단일 자식 그룹 평면화
        ast = this.flattenSingleGroups(ast);
        
        return ast;
    }

    /**
     * 중복 노드 제거
     * @param {Object} node - AST 노드
     * @returns {Object} 중복이 제거된 노드
     */
    removeDuplicates(node) {
        // 구현 생략 (복잡한 로직)
        return node;
    }

    /**
     * 빈 노드 제거
     * @param {Object} node - AST 노드
     * @returns {Object} 빈 노드가 제거된 노드
     */
    removeEmptyNodes(node) {
        if (!node) return null;
        
        if (node.type === 'BINARY_OP') {
            node.left = this.removeEmptyNodes(node.left);
            node.right = this.removeEmptyNodes(node.right);
            
            if (!node.left && !node.right) return null;
            if (!node.left) return node.right;
            if (!node.right) return node.left;
        }
        
        return node;
    }

    /**
     * 단일 자식 그룹 평면화
     * @param {Object} node - AST 노드
     * @returns {Object} 평면화된 노드
     */
    flattenSingleGroups(node) {
        if (!node) return node;
        
        if (node.type === 'GROUP' && node.expression) {
            return this.flattenSingleGroups(node.expression);
        }
        
        if (node.type === 'BINARY_OP') {
            node.left = this.flattenSingleGroups(node.left);
            node.right = this.flattenSingleGroups(node.right);
        }
        
        return node;
    }

    /**
     * 쿼리 검증
     * @param {Object} ast - AST 노드
     * @throws {Error} 유효하지 않은 쿼리의 경우
     */
    validateQuery(ast) {
        const termCount = this.countTerms(ast);
        
        if (termCount === 0) {
            throw new Error('Empty query');
        }
        
        if (termCount > this.maxTerms) {
            throw new Error(`Too many search terms (max: ${this.maxTerms})`);
        }
        
        this.validateTermLengths(ast);
    }

    /**
     * 용어 길이 검증
     * @param {Object} node - AST 노드
     */
    validateTermLengths(node) {
        if (!node) return;
        
        if (node.type === 'SEARCH_TERM' || node.type === 'FIELD_SEARCH') {
            const value = node.value || '';
            if (value.length < this.minTermLength && !value.includes('*')) {
                throw new Error(`Search term too short: "${value}" (min: ${this.minTermLength})`);
            }
        }
        
        // 재귀적 검증
        ['left', 'right', 'operand', 'expression'].forEach(prop => {
            if (node[prop]) {
                this.validateTermLengths(node[prop]);
            }
        });
    }

    /**
     * 용어 개수 계산
     * @param {Object} node - AST 노드
     * @returns {number} 용어 개수
     */
    countTerms(node) {
        if (!node) return 0;
        
        if (node.type === 'SEARCH_TERM' || node.type === 'FIELD_SEARCH') {
            return 1;
        }
        
        let count = 0;
        ['left', 'right', 'operand', 'expression'].forEach(prop => {
            if (node[prop]) {
                count += this.countTerms(node[prop]);
            }
        });
        
        return count;
    }

    /**
     * 복잡도 계산
     * @param {Object} node - AST 노드
     * @returns {number} 복잡도 점수
     */
    calculateComplexity(node) {
        if (!node) return 0;
        
        let complexity = 0;
        
        switch (node.type) {
            case 'SEARCH_TERM':
            case 'FIELD_SEARCH':
                complexity = 1;
                break;
            case 'BINARY_OP':
                complexity = 2 + this.calculateComplexity(node.left) + this.calculateComplexity(node.right);
                break;
            case 'UNARY_OP':
                complexity = 1.5 + this.calculateComplexity(node.operand);
                break;
            case 'GROUP':
                complexity = 1.2 + this.calculateComplexity(node.expression);
                break;
        }
        
        return complexity;
    }

    /**
     * 빈 결과 생성
     * @returns {Object} 빈 쿼리 결과
     */
    createEmptyResult() {
        return {
            success: true,
            query: {
                type: 'SEARCH_TERM',
                value: '',
                exact: false,
                wildcard: false
            },
            originalQuery: '',
            tokens: [],
            termCount: 0,
            complexity: 0
        };
    }

    /**
     * AST를 SQL WHERE 절로 변환
     * @param {Object} ast - AST 노드
     * @param {Array} params - SQL 파라미터 배열
     * @returns {string} SQL WHERE 절
     */
    toSQL(ast, params = []) {
        return this.nodeToSQL(ast, params);
    }

    /**
     * 노드를 SQL로 변환
     * @param {Object} node - AST 노드
     * @param {Array} params - SQL 파라미터 배열
     * @returns {string} SQL 문자열
     */
    nodeToSQL(node, params) {
        if (!node) return '';
        
        switch (node.type) {
            case 'SEARCH_TERM':
                return this.termToSQL(node, params);
            case 'FIELD_SEARCH':
                return this.fieldSearchToSQL(node, params);
            case 'BINARY_OP':
                return this.binaryOpToSQL(node, params);
            case 'UNARY_OP':
                return this.unaryOpToSQL(node, params);
            case 'GROUP':
                return `(${this.nodeToSQL(node.expression, params)})`;
            default:
                return '';
        }
    }

    /**
     * 검색 용어를 SQL로 변환
     * @param {Object} node - 검색 용어 노드
     * @param {Array} params - SQL 파라미터 배열
     * @returns {string} SQL 조건
     */
    termToSQL(node, params) {
        const value = node.value;
        
        if (node.wildcard) {
            params.push(value.replace(/\*/g, '%'));
            return `(p.userId LIKE ? OR MATCH(p.userId) AGAINST(? IN BOOLEAN MODE))`;
        } else if (node.exact) {
            params.push(value);
            return `MATCH(p.userId) AGAINST(? IN BOOLEAN MODE)`;
        } else {
            params.push(`+${value}*`);
            return `MATCH(p.userId) AGAINST(? IN BOOLEAN MODE)`;
        }
    }

    /**
     * 필드 검색을 SQL로 변환
     * @param {Object} node - 필드 검색 노드
     * @param {Array} params - SQL 파라미터 배열
     * @returns {string} SQL 조건
     */
    fieldSearchToSQL(node, params) {
        const field = node.field;
        const value = node.value;
        
        if (node.exact) {
            params.push(value);
            return `${field} = ?`;
        } else {
            params.push(`%${value}%`);
            return `${field} LIKE ?`;
        }
    }

    /**
     * 이진 연산자를 SQL로 변환
     * @param {Object} node - 이진 연산자 노드
     * @param {Array} params - SQL 파라미터 배열
     * @returns {string} SQL 조건
     */
    binaryOpToSQL(node, params) {
        const left = this.nodeToSQL(node.left, params);
        const right = this.nodeToSQL(node.right, params);
        const operator = node.operator === 'AND' ? 'AND' : 'OR';
        
        return `(${left} ${operator} ${right})`;
    }

    /**
     * 단항 연산자를 SQL로 변환
     * @param {Object} node - 단항 연산자 노드
     * @param {Array} params - SQL 파라미터 배열
     * @returns {string} SQL 조건
     */
    unaryOpToSQL(node, params) {
        const operand = this.nodeToSQL(node.operand, params);
        
        if (node.operator === 'NOT' || node.operator === '-') {
            return `NOT (${operand})`;
        } else {
            return operand; // '+' 연산자는 그대로
        }
    }
}

module.exports = SearchQueryParser;
