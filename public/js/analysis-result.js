// DB3 분석 결과 페이지 JavaScript
class AnalysisResultManager {
    constructor() {
        this.currentData = null;
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.tierFilter = '';
        this.representativeOnly = false;
        this.charts = {};
        
        this.init();
    }

    init() {
        console.log('🎯 분석 결과 페이지 초기화 중...');
        
        // DOM 로드 완료 후 실행
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        this.setupEventListeners();
        this.loadAnalysisData();
    }

    setupEventListeners() {
        // 재시도 버튼
        const retryBtn = document.getElementById('retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.loadAnalysisData());
        }

        // 등급 필터
        const tierFilter = document.getElementById('tier-filter');
        if (tierFilter) {
            tierFilter.addEventListener('change', (e) => {
                this.tierFilter = e.target.value;
                this.currentPage = 1;
                this.renderTable();
                this.renderPagination();
            });
        }

        // 대표ID만 보기 필터
        const representativeFilter = document.getElementById('representative-only-filter');
        if (representativeFilter) {
            representativeFilter.addEventListener('change', (e) => {
                this.representativeOnly = e.target.checked;
                this.currentPage = 1;
                this.loadAnalysisData(); // 전체 데이터 다시 로드
            });
        }

        // CSV 다운로드
        const csvBtn = document.getElementById('csv-download-btn');
        if (csvBtn) {
            csvBtn.addEventListener('click', () => this.downloadCSV());
        }

        // 로그아웃 버튼
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (typeof signOut === 'function') {
                    signOut();
                } else {
                    window.location.href = '/login.html';
                }
            });
        }
    }

    async loadAnalysisData() {
        console.log('📊 고가치 휴면 사용자 분석 데이터 로딩 시작...');
        
        this.showLoading();
        
        try {
            const data = await this.callAPI('getHighActivityDormantUsers', { 
                limit: 500,  // 전체 고가치 휴면 사용자 (299명 + 여유분)
                page: 1,
                representativeOnly: this.representativeOnly 
            });
            console.log('✅ 고가치 휴면 사용자 데이터 로드 성공:', data);
            console.log(`📊 총 ${data.data?.length || 0}명의 고가치 휴면 사용자 확인`);
            
            this.currentData = data;
            this.renderResults();
            
        } catch (error) {
            console.error('❌ 데이터 로드 실패:', error);
            this.showError(error.message);
        }
    }

    async callAPI(endpoint, params = {}) {
        const retries = 3;
        
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                console.log(`🔄 API 호출 시도 ${attempt}/${retries}: ${endpoint}`);
                
                // URL 생성
                const baseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                    ? 'http://127.0.0.1:50888/db888-67827/us-central1'
                    : 'https://us-central1-db888-67827.cloudfunctions.net';
                
                const queryString = new URLSearchParams(params).toString();
                const url = `${baseUrl}/${endpoint}${queryString ? '?' + queryString : ''}`;
                
                // 헤더 설정
                const headers = { 'Content-Type': 'application/json' };
                
                // 인증 토큰 추가 (개발 모드에서는 선택적)
                if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                    if (typeof getAuthToken === 'function') {
                        const token = await getAuthToken();
                        if (token) {
                            headers['Authorization'] = `Bearer ${token}`;
                        }
                    }
                } else {
                    console.log('🧪 개발 모드: 인증 우회하여 API 호출');
                }

                const response = await fetch(url, { headers });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const result = await response.json();
                console.log(`✅ API 호출 성공: ${endpoint}`);
                return result;
                
            } catch (error) {
                console.error(`❌ API 호출 실패 (시도 ${attempt}/${retries}):`, error.message);
                
                if (attempt === retries) {
                    throw error;
                }
                
                // 재시도 전 대기
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    showLoading() {
        document.getElementById('loading-container').classList.remove('d-none');
        document.getElementById('error-container').classList.add('d-none');
        document.getElementById('results-container').classList.add('d-none');
    }

    showError(message) {
        document.getElementById('loading-container').classList.add('d-none');
        document.getElementById('error-container').classList.remove('d-none');
        document.getElementById('results-container').classList.add('d-none');
        
        const errorMessage = document.getElementById('error-message');
        if (errorMessage) {
            errorMessage.textContent = message;
        }
    }

    showResults() {
        document.getElementById('loading-container').classList.add('d-none');
        document.getElementById('error-container').classList.add('d-none');
        document.getElementById('results-container').classList.remove('d-none');
    }

    renderResults() {
        console.log('🎨 고가치 휴면 사용자 결과 렌더링 시작...');
        
        if (!this.currentData || !this.currentData.data) {
            throw new Error('유효하지 않은 데이터 형식');
        }

        this.showResults();
        
        // 각 섹션 렌더링
        this.renderSummaryStats();
        this.renderCharts();
        this.renderTable();
        this.renderPagination();
        this.renderMarketingSuggestions();
        
        console.log('✅ 고가치 휴면 사용자 결과 렌더링 완료');
    }

    renderSummaryStats() {
        const data = this.currentData.data;
        const summary = this.currentData.summary || {};
        const container = document.getElementById('summary-stats');
        
        if (!container || !data || data.length === 0) return;

        // 통계 계산
        const totalUsers = summary.totalUsers || data.length;
        const totalBetting = data.reduce((sum, user) => sum + (user.total_netbet || 0), 0);
        const avgBetting = totalBetting / totalUsers;

        // 등급별 분포 (API에서 제공)
        const tierCounts = summary.tierDistribution || {};

        const stats = [
            {
                icon: 'fas fa-users',
                number: totalUsers.toLocaleString(),
                label: '고가치 휴면 사용자'
            },
            {
                icon: 'fas fa-user-clock',
                number: totalUsers.toLocaleString(),
                label: '휴면 상태'
            },
            {
                icon: 'fas fa-coins',
                number: Math.round(avgBetting).toLocaleString() + '원',
                label: '평균 유효배팅'
            },
            {
                icon: 'fas fa-crown',
                number: (tierCounts['Premium'] || 0).toLocaleString(),
                label: '프리미엄 등급'
            },
            {
                icon: 'fas fa-medal',
                number: (tierCounts['High'] || 0).toLocaleString(),
                label: '하이 등급'
            },
            {
                icon: 'fas fa-trophy',
                number: (tierCounts['Medium'] || 0).toLocaleString(),
                label: '미디엄 등급'
            }
        ];

        container.innerHTML = stats.map(stat => `
            <div class="col-md-2 col-sm-4 col-6">
                <div class="summary-stat fade-in-up">
                    <i class="${stat.icon} stat-icon"></i>
                    <span class="stat-number">${stat.number}</span>
                    <div class="stat-label">${stat.label}</div>
                </div>
            </div>
        `).join('');
    }

    renderCharts() {
        this.renderTierChart();
        this.renderActivityChart();
    }

    renderTierChart() {
        const canvas = document.getElementById('tier-chart');
        if (!canvas || !this.currentData) return;

        const tierCounts = this.currentData.summary?.tierDistribution || {};

        // 기존 차트 제거
        if (this.charts.tier) {
            this.charts.tier.destroy();
        }

        this.charts.tier = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: Object.keys(tierCounts),
                datasets: [{
                    data: Object.values(tierCounts),
                    backgroundColor: [
                        '#1976d2', // Premium - 파랑
                        '#f57c00', // High - 주황
                        '#388e3c', // Medium - 초록
                        '#616161'  // Basic - 회색
                    ],
                    borderColor: [
                        '#1565c0',
                        '#ef6c00', 
                        '#2e7d32',
                        '#424242'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    renderActivityChart() {
        const canvas = document.getElementById('activity-chart');
        if (!canvas || !this.currentData) return;

        const data = this.currentData.data;
        
        // 휴면일수별 분포
        const dormantRanges = {
            '30-60일': 0,
            '61-120일': 0,
            '121-180일': 0,
            '181-365일': 0,
            '365일+': 0
        };

        data.forEach(user => {
            const days = user.days_since_last_game || 0;
            if (days <= 60) dormantRanges['30-60일']++;
            else if (days <= 120) dormantRanges['61-120일']++;
            else if (days <= 180) dormantRanges['121-180일']++;
            else if (days <= 365) dormantRanges['181-365일']++;
            else dormantRanges['365일+']++;
        });

        // 기존 차트 제거
        if (this.charts.activity) {
            this.charts.activity.destroy();
        }

        this.charts.activity = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: Object.keys(dormantRanges),
                datasets: [{
                    label: '사용자 수',
                    data: Object.values(dormantRanges),
                    backgroundColor: 'rgba(102, 126, 234, 0.8)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    getFilteredData() {
        if (!this.currentData || !this.currentData.data) return [];
        
        let filtered = this.currentData.data;
        
        if (this.tierFilter) {
            filtered = filtered.filter(user => user.tier === this.tierFilter);
        }
        
        return filtered;
    }

    renderTable() {
        const tbody = document.querySelector('#results-table tbody');
        if (!tbody) return;

        const filteredData = this.getFilteredData();
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageData = filteredData.slice(startIndex, endIndex);

        tbody.innerHTML = pageData.map(user => {
            // 대표ID만 보기 모드일 때는 그룹 총 유효배팅 사용, 아니면 개별 유효배팅 사용
            const displayNetBet = this.representativeOnly 
                ? (user.group_total_netbet || user.individual_netbet)
                : user.individual_netbet;
            
            // 게임 시작일: 그룹이 있으면 그룹 첫 게임일, 없으면 개별 첫 게임일
            const gameStartDate = user.group_first_game_date || user.first_game_date;
            
            return `
                <tr>
                    <td>${user.userId || '-'}</td>
                    <td>
                        <strong class="text-primary">
                            ${user.display_representative || user.userId}
                        </strong>
                    </td>
                    <td><span class="tier-badge tier-${user.tier?.toLowerCase() || 'basic'}">${this.getTierAbbreviation(user.tier)}</span></td>
                    <td class="${this.getAmountClass(displayNetBet)}">${this.formatAmount(displayNetBet)}</td>
                    <td>${user.total_game_days || 0}</td>
                    <td class="${this.getAmountClass(user.individual_winloss)}">${this.formatAmount(user.individual_winloss)}</td>
                    <td>${gameStartDate || '-'}</td>
                    <td>${user.last_game_date || '-'}</td>
                    <td>${user.days_since_last_game || 0}일</td>
                    <td><span class="tier-badge status-dormant">휴면</span></td>
                    <td>
                        <span class="badge ${user.event_count > 0 ? 'bg-info' : 'bg-light text-dark'}">
                            ${user.event_count || 0}회
                        </span>
                    </td>
                    <td>
                        ${user.phone_number ? 
                            `<span class="contact-info phone-available" title="${user.phone_memo || ''}">
                                <i class="fas fa-phone text-success me-1"></i>${this.formatPhoneNumber(user.phone_number)}
                            </span>` : 
                            '<span class="contact-info contact-unavailable"><i class="fas fa-phone-slash text-muted"></i> 없음</span>'
                        }
                    </td>
                    <td>
                        ${user.wechat_id ? 
                            `<span class="contact-info wechat-available">
                                <i class="fab fa-weixin text-success me-1"></i>${user.wechat_id}
                            </span>` : 
                            '<span class="contact-info contact-unavailable"><i class="fab fa-weixin text-muted"></i> 없음</span>'
                        }
                    </td>
                    <td>
                        <span class="contact-status ${user.contact_availability?.toLowerCase() || 'none'}">
                            ${this.getContactStatusBadge(user.contact_availability)}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    renderPagination() {
        const container = document.getElementById('pagination');
        if (!container) return;

        const filteredData = this.getFilteredData();
        const totalPages = Math.ceil(filteredData.length / this.itemsPerPage);

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let paginationHTML = '';

        // 이전 버튼
        paginationHTML += `
            <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${this.currentPage - 1}">이전</a>
            </li>
        `;

        // 페이지 번호들
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <li class="page-item ${i === this.currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `;
        }

        // 다음 버튼
        paginationHTML += `
            <li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${this.currentPage + 1}">다음</a>
            </li>
        `;

        container.innerHTML = paginationHTML;

        // 페이지네이션 이벤트 리스너
        container.addEventListener('click', (e) => {
            e.preventDefault();
            if (e.target.tagName === 'A' && !e.target.parentElement.classList.contains('disabled')) {
                const page = parseInt(e.target.dataset.page);
                if (page && page !== this.currentPage) {
                    this.currentPage = page;
                    this.renderTable();
                    this.renderPagination();
                }
            }
        });
    }

    renderMarketingSuggestions() {
        const container = document.getElementById('marketing-suggestions');
        if (!container || !this.currentData) return;

        const data = this.currentData.data;
        const summary = this.currentData.summary || {};
        
        const premiumUsers = data.filter(user => user.tier === 'Premium');
        const highUsers = data.filter(user => user.tier === 'High');
        const representativeUsers = data.filter(user => user.is_representative === 'Y');
        const connectedUsers = data.filter(user => user.is_representative === 'N');
        
        const totalGroupNetBet = data.reduce((sum, user) => sum + (user.group_total_netbet || user.individual_netbet || 0), 0);
        const avgGroupNetBet = totalGroupNetBet / data.length;

        const suggestions = [
            {
                title: '🎯 다중계정 그룹 분석 결과 (그룹 전체 유효배팅 기준)',
                content: `<strong>그룹 기반 등급 분류:</strong><br>
                • Premium (${premiumUsers.length}명): 그룹 전체 유효배팅 500만원 이상 + 게임일수 200일 이상<br>
                • High (${data.filter(u => u.tier === 'High').length}명): 그룹 전체 유효배팅 130만원 이상 + 게임일수 120일 이상<br>
                • Medium (${data.filter(u => u.tier === 'Medium').length}명): 그룹 전체 유효배팅 20만원 이상 + 게임일수 80일 이상<br>
                • Basic (${data.filter(u => u.tier === 'Basic').length}명): 위 조건에 해당하지 않는 사용자<br><br>
                <strong>계정 분포:</strong> 대표ID ${representativeUsers.length}명, 연결ID ${connectedUsers.length}명`
            },
            {
                title: '⚠️ 중요: 진짜 휴면 vs 가짜 휴면 구분',
                content: `<strong>마케팅 전 필수 확인사항:</strong><br>
                • <span class="badge bg-primary">대표ID</span> 휴면: 진짜 휴면 사용자 → 재활성화 마케팅 실행<br>
                • <span class="badge bg-secondary">연결ID</span> 휴면: 다른 계정으로 활동 중일 가능성 → 마케팅 주의<br><br>
                현재 분석된 ${data.length}명 중 ${representativeUsers.length}명이 대표ID, ${connectedUsers.length}명이 연결ID입니다. 연결ID는 같은 그룹의 대표ID 활동 여부를 확인 후 마케팅 진행을 권장합니다.`
            },
            {
                title: '💎 그룹 전체 가치 기반 VIP 마케팅',
                content: `${premiumUsers.length}명의 프리미엄 등급 사용자들의 그룹 전체 평균 유효배팅은 ${Math.round(avgGroupNetBet).toLocaleString()}원입니다. 개별 계정이 아닌 <strong>그룹 전체 가치</strong>를 기준으로 VIP 서비스를 제공하세요. 다중 계정을 운영하는 고가치 사용자일수록 더 큰 잠재 가치를 가지고 있습니다.`
            },
            {
                title: '📊 효과적인 단계별 마케팅 전략',
                content: `<strong>1단계:</strong> 대표ID 우선 접촉 (${representativeUsers.length}명)<br>
                <strong>2단계:</strong> 그룹 전체 가치 기준 맞춤 혜택 제공<br>
                <strong>3단계:</strong> 연결ID는 대표ID 활동 확인 후 신중한 접근<br>
                <strong>4단계:</strong> 그룹 통합 관리로 중복 마케팅 방지<br><br>
                예상 복귀율 10% 기준으로도 약 ${Math.round(totalGroupNetBet * 0.1 / 100000000)}억원의 매출 기여가 가능합니다.`
            }
        ];

        container.innerHTML = suggestions.map(suggestion => `
            <div class="marketing-suggestion">
                <h6>${suggestion.title}</h6>
                <p>${suggestion.content}</p>
            </div>
        `).join('');
    }

    getUserTier(user) {
        // API에서 이미 계산된 tier 사용
        return user.tier || 'Basic';
    }

    getAmountClass(amount) {
        if (!amount || amount === 0) return 'amount-neutral';
        return amount > 0 ? 'amount-positive' : 'amount-negative';
    }

    formatAmount(amount) {
        if (!amount || amount === 0) return '0원';
        return Math.round(amount).toLocaleString() + '원';
    }

    downloadCSV() {
        if (!this.currentData || !this.currentData.data) {
            alert('다운로드할 데이터가 없습니다.');
            return;
        }

        const data = this.getFilteredData();
        if (!data || data.length === 0) {
            alert('필터링된 데이터가 없습니다.');
            return;
        }

        // CSV 헤더 (영문명으로 변경하여 호환성 향상)
        const headers = [
            'user_id', 'account_type', 'representative_id', 'tier', 
            'net_bet', 'total_game_days', 'win_loss', 'first_game_date', 
            'last_game_date', 'dormant_days', 'status', 'event_count'
        ];
        
        // 한글 헤더 (사용자가 보기 편한 형태)
        const koreanHeaders = [
            '사용자ID', '대표ID', '등급', 
            '유효배팅', '총게임일수', '총손익', '게임시작일', 
            '마지막게임일', '휴면일수', '활동상태', '이벤트지급횟수',
            '전화번호', '위챗ID', '연락처상태', '전화메모', '추가메모'
        ];
        
        // CSV 안전한 텍스트 처리 함수
        const escapeCSV = (text) => {
            if (text == null || text === undefined) return '';
            const str = String(text);
            // 특수문자가 포함된 경우 따옴표로 감싸기
            if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r') || str.includes(';')) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        };

        // 숫자 포맷팅 (Excel 호환)
        const formatNumber = (num) => {
            if (num == null || num === '' || num === undefined) return '0';
            const number = Number(num);
            return isNaN(number) ? '0' : String(Math.round(number));
        };

        // 날짜 포맷팅
        const formatDate = (date) => {
            if (!date) return '';
            return String(date).replace(/,/g, '');
        };
        
        try {
            // CSV 데이터 생성
            const csvRows = [
                koreanHeaders.map(escapeCSV).join(','), // 한글 헤더 사용
                ...data.map((user, index) => {
                    try {
                        // 대표ID만 보기 모드일 때는 그룹 총 유효배팅 사용
                        const displayNetBet = this.representativeOnly 
                            ? (user.group_total_netbet || user.individual_netbet || 0)
                            : (user.individual_netbet || 0);
                        
                        // 게임 시작일: 그룹이 있으면 그룹 첫 게임일
                        const gameStartDate = user.group_first_game_date || user.first_game_date || '';
                        
                        // 등급 축약 (P, H, M, B)
                        const tierAbbr = this.getTierAbbreviation(user.tier);
                        
                        const row = [
                            escapeCSV(user.userId || ''),
                            escapeCSV(user.display_representative || user.userId || ''),
                            escapeCSV(tierAbbr),
                            formatNumber(displayNetBet),
                            formatNumber(user.total_game_days || 0),
                            formatNumber(user.individual_winloss || 0),
                            formatDate(gameStartDate),
                            formatDate(user.last_game_date || ''),
                            formatNumber(user.days_since_last_game || 0),
                            escapeCSV('휴면'),
                            formatNumber(user.event_count || 0),
                            escapeCSV(user.phone_number || ''),
                            escapeCSV(user.wechat_id || ''),
                            escapeCSV(user.contact_availability || 'None'),
                            escapeCSV(user.phone_memo || ''),
                            escapeCSV(user.additional_note || '')
                        ];
                        
                        return row.join(',');
                    } catch (rowError) {
                        console.error(`Row ${index} 처리 오류:`, rowError, user);
                        return ''; // 오류 발생 시 빈 행
                    }
                })
            ].filter(row => row !== ''); // 빈 행 제거

            const csvContent = csvRows.join('\n');
            
            // Blob 생성 (UTF-8 BOM 포함)
            const blob = new Blob(['\uFEFF' + csvContent], { 
                type: 'text/csv;charset=utf-8;' 
            });
            
            // 파일명 생성 (현재 날짜 포함)
            const today = new Date();
            const dateStr = today.toISOString().split('T')[0];
            const timeStr = today.toTimeString().split(' ')[0].replace(/:/g, '');
            const filename = `고가치휴면사용자분석_${dateStr}_${timeStr}.csv`;
            
            // 다운로드 실행
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            
            // 성공 메시지 및 디버깅 정보
            console.log('✅ CSV 다운로드 성공:', {
                filename: filename,
                totalRows: csvRows.length,
                dataRows: csvRows.length - 1, // 헤더 제외
                headers: koreanHeaders,
                sampleData: data.slice(0, 3).map(user => ({
                    userId: user.userId,
                    tier: user.tier,
                    netBet: this.representativeOnly ? (user.group_total_netbet || user.individual_netbet) : user.individual_netbet,
                    eventCount: user.event_count
                }))
            });
            
            // 사용자에게 성공 알림
            const alert = document.createElement('div');
            alert.className = 'alert alert-success alert-dismissible fade show position-fixed';
            alert.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
            alert.innerHTML = `
                <strong>✅ CSV 다운로드 완료!</strong><br>
                파일명: ${filename}<br>
                총 ${csvRows.length - 1}건의 데이터가 포함되었습니다.
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;
            document.body.appendChild(alert);
            
            // 3초 후 자동 제거
            setTimeout(() => {
                if (alert.parentNode) {
                    alert.parentNode.removeChild(alert);
                }
            }, 3000);
            
        } catch (error) {
            console.error('❌ CSV 생성 오류:', error);
            alert(`CSV 파일 생성 중 오류가 발생했습니다: ${error.message}`);
        }
    }

    // 연락처 관련 헬퍼 함수들
    formatPhoneNumber(phone) {
        if (!phone) return '-';
        
        // 전화번호 포맷팅 (예: 010-1234-5678)
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 11) {
            return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
        } else if (cleaned.length === 10) {
            return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        }
        return phone; // 원본 반환
    }

    getContactStatusBadge(status) {
        switch (status) {
            case 'Both':
                return '<i class="fas fa-check-double text-success me-1"></i><span class="badge bg-success">전화+위챗</span>';
            case 'Phone':
                return '<i class="fas fa-phone text-primary me-1"></i><span class="badge bg-primary">전화만</span>';
            case 'WeChat':
                return '<i class="fab fa-weixin text-info me-1"></i><span class="badge bg-info">위챗만</span>';
            case 'None':
            default:
                return '<i class="fas fa-exclamation-triangle text-warning me-1"></i><span class="badge bg-warning text-dark">연락처 없음</span>';
        }
    }

    // 등급 축약 함수 (공간 절약용)
    getTierAbbreviation(tier) {
        switch (tier) {
            case 'Premium': return 'P';
            case 'High': return 'H';
            case 'Medium': return 'M';
            case 'Basic': return 'B';
            default: return 'B';
        }
    }
}

// 페이지 로드 시 초기화
const analysisManager = new AnalysisResultManager();
