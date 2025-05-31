        // 전역 변수
        let analysisData = null;
        let analysisType = null;
        let isAuthenticated = false;

        // 페이지 로드 시 실행
        document.addEventListener('DOMContentLoaded', function() {
            console.log('🎯 분석 결과 페이지 로드 시작');
            
            // URL 파라미터에서 분석 타입 추출
            const urlParams = new URLSearchParams(window.location.search);
            analysisType = urlParams.get('type');

            if (!analysisType) {
                showError('분석 타입이 지정되지 않았습니다.');
                return;
            }

            // 인증 확인 후 분석 실행
            initializeAuthentication();
        });

        // 인증 초기화 및 분석 실행 (개발 모드 지원)
        async function initializeAuthentication() {
            try {
                console.log('🔒 인증 초기화 시작...');
                
                // 개발 환경에서는 인증 우회
                if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
                    console.log('🧪 개발 모드: 인증 우회');
                    isAuthenticated = true;
                    
                    // 개발 모드 UI 업데이트
                    updateDevAuthUI();
                    
                    console.log('✅ 개발 모드 인증 완료, 분석 실행 시작');
                    
                    // 분석 실행
                    await executeAnalysis(analysisType);
                    return;
                }
                
                // 프로덕션 환경에서는 기존 인증 로직 사용
                await waitForAuthSystem();
                await waitForAuthentication();
                
                console.log('✅ 인증 완료, 분석 실행 시작');
                await executeAnalysis(analysisType);
                
            } catch (error) {
                console.error('❌ 인증 초기화 오류:', error);
                showError('인증 초기화 중 오류가 발생했습니다: ' + error.message);
            }
        }

        // 개발 모드용 UI 업데이트
        function updateDevAuthUI() {
            const authInfo = document.getElementById('auth-info');
            const loginBtn = document.getElementById('login-btn');
            const logoutBtn = document.getElementById('logout-btn');
            
            if (authInfo) {
                authInfo.innerHTML = `
                    <div class="d-flex align-items-center">
                        <img src="https://via.placeholder.com/32" 
                             class="rounded-circle me-2" width="32" height="32">
                        <span class="text-white">Development User</span>
                        <small class="text-warning ms-2">[DEV]</small>
                    </div>
                `;
            }
            if (loginBtn) loginBtn.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'inline-block';
        }

        // Auth 시스템 로드 대기
        function waitForAuthSystem() {
            return new Promise((resolve, reject) => {
                let attempts = 0;
                const maxAttempts = 50; // 5초 대기
                
                const checkAuth = () => {
                    attempts++;
                    
                    if (typeof protectPage === 'function' && typeof getAuthToken === 'function') {
                        console.log('✅ Auth 시스템 로드 완료');
                        resolve();
                    } else if (attempts >= maxAttempts) {
                        reject(new Error('Auth 시스템 로드 타임아웃'));
                    } else {
                        setTimeout(checkAuth, 100);
                    }
                };
                
                checkAuth();
            });
        }

        // 인증 완료 대기 (원래 단순한 버전)
        function waitForAuthentication() {
            return new Promise((resolve, reject) => {
                console.log('🔒 Firebase Auth 상태 감지 시작...');
                
                let timeoutHandle = null;
                let authStateListener = null;
                
                // 15초 타임아웃 설정
                timeoutHandle = setTimeout(() => {
                    if (authStateListener) {
                        authStateListener(); // unsubscribe
                    }
                    reject(new Error('인증 대기 시간이 초과되었습니다. 페이지를 새로고침하거나 다시 로그인해주세요.'));
                }, 15000);
                
                // Firebase Auth 상태 변화 직접 감지
                const checkFirebaseAuth = () => {
                    if (typeof firebase !== 'undefined' && firebase.auth) {
                        console.log('🔒 Firebase Auth 객체 확인 완료');
                        
                        // Auth 상태 변화 리스너 등록
                        authStateListener = firebase.auth().onAuthStateChanged((user) => {
                            console.log('🔒 Auth 상태 변화 감지:', user ? user.email : 'null');
                            
                            if (user && user.email === 'sandscasino8888@gmail.com') {
                                console.log('✅ 올바른 사용자 인증 확인:', user.email);
                                
                                // 토큰 확인
                                user.getIdToken().then((token) => {
                                    if (token) {
                                        console.log('✅ 인증 토큰 확인 완료');
                                        isAuthenticated = true;
                                        
                                        // 정리
                                        if (timeoutHandle) clearTimeout(timeoutHandle);
                                        if (authStateListener) authStateListener();
                                        
                                        resolve();
                                    } else {
                                        console.log('❌ 토큰 확인 실패');
                                    }
                                }).catch((error) => {
                                    console.error('❌ 토큰 획득 오류:', error);
                                });
                            } else if (user) {
                                console.log('❌ 허용되지 않은 사용자:', user.email);
                                
                                // 정리
                                if (timeoutHandle) clearTimeout(timeoutHandle);
                                if (authStateListener) authStateListener();
                                
                                reject(new Error('접근 권한이 없습니다. 올바른 계정으로 로그인해주세요.'));
                            }
                        });
                    } else {
                        console.log('⏳ Firebase Auth 객체 대기 중...');
                        setTimeout(checkFirebaseAuth, 200);
                    }
                };
                
                checkFirebaseAuth();
            });
        }

        // 분석 실행 함수
        async function executeAnalysis(type) {
            console.log('🎯 분석 실행:', type);

            try {
                switch (type) {
                    case 'high-activity-dormant':
                        await executeHighActivityDormantAnalysis(1); // 첫 페이지부터 시작
                        break;
                    default:
                        throw new Error(`지원하지 않는 분석 타입: ${type}`);
                }
            } catch (error) {
                console.error('❌ 분석 실행 오류:', error);
                showError(error.message);
            }
        }

        // 페이지네이션 상태 (전체)
        let currentPage = 1;
        let totalPages = 1;
        let totalCount = 0;
        const itemsPerPage = 50;

        // 등급별 페이지네이션 상태
        let gradePages = {
            premium: 1,
            high: 1,
            medium: 1,
            basic: 1
        };

        let gradeStats = {}; // 백엔드에서 받아온 등급별 통계

        // 고활동 휴면 사용자 분석 실행 (페이지네이션 추가)
        async function executeHighActivityDormantAnalysis(page = 1) {
            try {
                currentPage = page;
                const params = new URLSearchParams({
                    page: page,
                    limit: itemsPerPage
                });
                
                const data = await apiCall(`getHighActivityDormantUsers?${params}`, true);
                analysisData = data;
                
                // 페이지 정보 업데이트
                totalCount = data.pagination?.totalCount || data.summary?.totalUsers || 0;
                totalPages = data.pagination?.totalPages || Math.ceil(totalCount / itemsPerPage);
                
                console.log(`📄 페이지 ${page}/${totalPages}, 총 ${totalCount}명`);

                // 결과 화면 구성
                setupHighActivityDormantResults(data);
                showResults();

            } catch (error) {
                throw new Error(`고활동 휴면 사용자 분석 실패: ${error.message}`);
            }
        }

        // 고활동 휴면 사용자 결과 화면 구성
        function setupHighActivityDormantResults(data) {
            // 등급별 통계 저장
            gradeStats = data.summary?.tierDistribution || {};
            
            // 분석 정보 설정 (안전하게 처리)
            const analysisTitle = document.getElementById('analysis-title');
            if (analysisTitle) {
                analysisTitle.textContent = '고활동 휴면 사용자 분석';
            }
            
            const analysisSubtitle = document.getElementById('analysis-subtitle');
            if (analysisSubtitle) {
                analysisSubtitle.textContent = 
                    `분석 완료: ${new Date().toLocaleString('ko-KR')} | 쿼리 시간: ${data.summary?.queryTime || 'N/A'}`;
            }
            
            // 분석 설명을 기존 요소에 설정
            const analysisDescription = document.getElementById('analysis-description');
            if (analysisDescription) {
                analysisDescription.textContent = `고활동 휴면 사용자 ${data.summary?.totalUsers || 0}명 분석 완료`;
                const analysisInfo = document.getElementById('analysis-info');
                if (analysisInfo) {
                    analysisInfo.classList.remove('d-none');
                }
            }

            // 요약 통계 설정
            const summaryStats = document.getElementById('summary-stats');
            if (summaryStats && data.summary) {
                const avgActiveMonths = data.data && data.data.length > 0 
                    ? Math.round(data.data.reduce((sum, user) => sum + (user.months_with_10plus_days || 0), 0) / data.data.length)
                    : 'N/A';
                
                const avgDaysSince = data.data && data.data.length > 0
                    ? Math.round(data.data.reduce((sum, user) => sum + (user.days_since_last_game || 0), 0) / data.data.length)
                    : 'N/A';
                
                const totalNetBet = data.data && data.data.length > 0
                    ? data.data.reduce((sum, user) => sum + (user.total_netbet || 0), 0)
                    : 0;

                summaryStats.innerHTML = `
                    <div class="col-md-3">
                        <div class="stat-box text-center p-3 bg-primary bg-gradient text-white rounded">
                            <div class="stat-value fs-3 fw-bold">${data.summary.totalUsers.toLocaleString()}</div>
                            <div class="stat-label">총 대상 사용자</div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-box text-center p-3 bg-info bg-gradient text-white rounded">
                            <div class="stat-value fs-3 fw-bold">${avgActiveMonths}</div>
                            <div class="stat-label">평균 활동 개월수</div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-box text-center p-3 bg-warning bg-gradient text-white rounded">
                            <div class="stat-value fs-3 fw-bold">${avgDaysSince}</div>
                            <div class="stat-label">평균 휴면 일수</div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-box text-center p-3 bg-success bg-gradient text-white rounded">
                            <div class="stat-value fs-3 fw-bold">${(totalNetBet / 100000000).toFixed(1)}억원</div>
                            <div class="stat-label">총 유효 베팅액</div>
                        </div>
                    </div>
                `;
            }

            // 데이터를 등급별로 그룹화
            const groupedData = {};
            if (data.data && Array.isArray(data.data)) {
                data.data.forEach(user => {
                    const tier = (user.tier || 'Basic').toLowerCase();
                    if (!groupedData[tier]) {
                        groupedData[tier] = {
                            users: [],
                            count: 0,
                            criteria: getTierCriteria(tier)
                        };
                    }
                    groupedData[tier].users.push(user);
                    groupedData[tier].count++;
                });
            }

            // 등급별 분류 탭 및 내용 생성
            createClassificationTabs(groupedData);
            
            // 상세 테이블 생성
            createResultsTable(data.data || []);

            // 페이지네이션 정보 표시
            if (data.pagination && data.pagination.totalPages > 1) {
                createPaginationControls(data.pagination);
            }
        }

        // 등급별 분류 탭 생성
        function createClassificationTabs(groupedData) {
            const tabsContainer = document.getElementById('classification-tabs');
            const contentContainer = document.getElementById('classification-content');
            
            if (!tabsContainer || !contentContainer) return;

            const groups = [
                { key: 'premium', name: 'Premium', color: '#dc3545', icon: 'crown' },
                { key: 'high', name: 'High', color: '#fd7e14', icon: 'star' },
                { key: 'medium', name: 'Medium', color: '#198754', icon: 'heart' },
                { key: 'basic', name: 'Basic', color: '#6c757d', icon: 'user' }
            ];

            // 탭 생성
            const tabsHtml = groups.map((group, index) => {
                const groupData = groupedData[group.key];
                const count = groupData ? groupData.count : 0;
                if (count === 0) return '';
                
                return `
                    <button class="btn btn-outline-primary me-2 mb-2 ${index === 0 ? 'active' : ''}" 
                            data-tier="${group.key}" onclick="showTierTab('${group.key}')">
                        <i class="fas fa-${group.icon} me-1"></i>${group.name} (${count}명)
                    </button>
                `;
            }).join('');

            tabsContainer.innerHTML = tabsHtml;

            // 첫 번째 활성 탭의 내용 표시
            const firstActiveGroup = groups.find(group => groupedData[group.key] && groupedData[group.key].count > 0);
            if (firstActiveGroup) {
                showTierContent(firstActiveGroup.key, groupedData[firstActiveGroup.key]);
            }
        }

        // 등급별 탭 클릭 이벤트
        function showTierTab(tierKey) {
            // 탭 활성화 상태 변경
            document.querySelectorAll('#classification-tabs button').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelector(`[data-tier="${tierKey}"]`).classList.add('active');

            // 해당 등급 내용 표시 - 전역 변수에서 가져오기
            if (analysisData && analysisData.data) {
                const tierUsers = analysisData.data.filter(user => 
                    (user.tier || 'Basic').toLowerCase() === tierKey
                );
                showTierContent(tierKey, { users: tierUsers, count: tierUsers.length });
            }
        }

        // 등급별 내용 표시
        function showTierContent(tierKey, groupData) {
            const contentContainer = document.getElementById('classification-content');
            if (!contentContainer) return;

            const criteria = getTierCriteria(tierKey);
            const tierColors = {
                premium: '#dc3545',
                high: '#fd7e14', 
                medium: '#198754',
                basic: '#6c757d'
            };

            contentContainer.innerHTML = `
                <div class="tier-info mb-3 p-3 rounded" style="background-color: ${tierColors[tierKey]}20; border-left: 4px solid ${tierColors[tierKey]}">
                    <h5><i class="fas fa-info-circle me-2"></i>등급 기준</h5>
                    <p class="mb-0">${criteria}</p>
                </div>
                <div class="row">
                    ${groupData.users.slice(0, 6).map(user => `
                        <div class="col-md-4 mb-3">
                            <div class="card h-100">
                                <div class="card-body">
                                    <h6 class="card-title">${user.userId}</h6>
                                    <div class="row text-center">
                                        <div class="col-6">
                                            <div class="small text-muted">활동개월</div>
                                            <div class="fw-bold">${user.months_with_10plus_days}개월</div>
                                        </div>
                                        <div class="col-6">
                                            <div class="small text-muted">휴면일수</div>
                                            <div class="fw-bold">${user.days_since_last_game}일</div>
                                        </div>
                                    </div>
                                    <div class="mt-2 text-center">
                                        <div class="small text-muted">총 유효배팅</div>
                                        <div class="fw-bold text-primary">${(user.total_netbet || 0).toLocaleString()}원</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                ${groupData.users.length > 6 ? `
                    <div class="text-center mt-3">
                        <small class="text-muted">상위 6명만 표시 중 (총 ${groupData.count}명)</small>
                    </div>
                ` : ''}
            `;
        }

        // 상세 테이블 생성
        function createResultsTable(users) {
            const table = document.getElementById('results-table');
            if (!table) return;

            const thead = table.querySelector('thead');
            const tbody = table.querySelector('tbody');

            // 테이블 헤더
            thead.innerHTML = `
                <tr>
                    <th>사용자 ID</th>
                    <th>등급</th>
                    <th>활동 개월수</th>
                    <th>휴면 일수</th>
                    <th>총 게임일수</th>
                    <th>총 유효배팅</th>
                    <th>총 손익</th>
                    <th>마지막 게임</th>
                </tr>
            `;

            // 테이블 바디
            tbody.innerHTML = users.map(user => `
                <tr>
                    <td><code>${user.userId}</code></td>
                    <td><span class="badge bg-${getTierBadgeColor(user.tier)}">${user.tier || 'Basic'}</span></td>
                    <td>${user.months_with_10plus_days || 0}개월</td>
                    <td>${user.days_since_last_game || 0}일</td>
                    <td>${user.total_game_days || 0}일</td>
                    <td class="text-end"><strong>${(user.total_netbet || 0).toLocaleString()}원</strong></td>
                    <td class="text-end ${(user.total_winloss || 0) >= 0 ? 'text-success' : 'text-danger'}">
                        ${(user.total_winloss || 0).toLocaleString()}원
                    </td>
                    <td>${new Date(user.last_game_date).toLocaleDateString('ko-KR')}</td>
                </tr>
            `).join('');

            // 등급 필터 옵션 업데이트
            const tierFilter = document.getElementById('tier-filter');
            if (tierFilter) {
                const tiers = [...new Set(users.map(user => user.tier || 'Basic'))];
                tierFilter.innerHTML = `
                    <option value="">모든 등급</option>
                    ${tiers.map(tier => `<option value="${tier}">${tier}</option>`).join('')}
                `;
            }
        }

        // 등급별 배지 색상
        function getTierBadgeColor(tier) {
            const colors = {
                Premium: 'danger',
                High: 'warning',
                Medium: 'success', 
                Basic: 'secondary'
            };
            return colors[tier] || 'secondary';
        }

        // 페이지네이션 컨트롤 생성  
        function createPaginationControls(pagination) {
            const paginationContainer = document.getElementById('pagination');
            if (!paginationContainer) return;

            paginationContainer.innerHTML = `
                <li class="page-item ${!pagination.hasPrev ? 'disabled' : ''}">
                    <button class="page-link" onclick="changePage(${pagination.currentPage - 1})" ${!pagination.hasPrev ? 'disabled' : ''}>이전</button>
                </li>
                <li class="page-item active">
                    <span class="page-link">${pagination.currentPage} / ${pagination.totalPages}</span>
                </li>
                <li class="page-item ${!pagination.hasNext ? 'disabled' : ''}">
                    <button class="page-link" onclick="changePage(${pagination.currentPage + 1})" ${!pagination.hasNext ? 'disabled' : ''}>다음</button>
                </li>
            `;
        }

        // 등급별 기준 설명 함수
        function getTierCriteria(tier) {
            const criteria = {
                premium: '월평균 300만원 이상 베팅 또는 총 5천만원 이상',
                high: '월평균 100만원 이상 베팅 또는 총 2천만원 이상', 
                medium: '월평균 50만원 이상 베팅 또는 총 1천만원 이상',
                basic: '기본 등급 사용자'
            };
            return criteria[tier] || '분류 기준';
        }

        // 페이지네이션 정보 표시 함수
        function createPaginationInfo(container, pagination) {
            const paginationSection = document.createElement('div');
            paginationSection.className = 'result-card pagination-section mt-4';
            
            paginationSection.innerHTML = `
                <div class="pagination-info">
                    <h4><i class="fas fa-list me-2"></i>페이지 정보</h4>
                    <p>현재 페이지: <strong>${pagination.currentPage}</strong> / 총 <strong>${pagination.totalPages}</strong>페이지</p>
                    <p>전체 대상자: <strong>${pagination.totalCount.toLocaleString()}명</strong> (페이지당 ${pagination.limit}명)</p>
                    <p>현재 표시: <strong>${((pagination.currentPage-1) * pagination.limit + 1)}-${Math.min(pagination.currentPage * pagination.limit, pagination.totalCount)}번째</strong></p>
                </div>
                
                <div class="pagination-controls">
                    <button class="btn btn-pagination ${!pagination.hasPrev ? 'disabled' : ''}" 
                            onclick="changePage(1)" ${!pagination.hasPrev ? 'disabled' : ''}>
                        <i class="fas fa-angle-double-left"></i> 첫 페이지
                    </button>
                    
                    <button class="btn btn-pagination ${!pagination.hasPrev ? 'disabled' : ''}" 
                            onclick="changePage(${pagination.currentPage - 1})" ${!pagination.hasPrev ? 'disabled' : ''}>
                        <i class="fas fa-angle-left"></i> 이전
                    </button>
                    
                    <span class="mx-3">
                        <strong>${pagination.currentPage}</strong> / ${pagination.totalPages}
                    </span>
                    
                    <button class="btn btn-pagination ${!pagination.hasNext ? 'disabled' : ''}" 
                            onclick="changePage(${pagination.currentPage + 1})" ${!pagination.hasNext ? 'disabled' : ''}>
                        다음 <i class="fas fa-angle-right"></i>
                    </button>
                    
                    <button class="btn btn-pagination ${!pagination.hasNext ? 'disabled' : ''}" 
                            onclick="changePage(${pagination.totalPages})" ${!pagination.hasNext ? 'disabled' : ''}>
                        마지막 페이지 <i class="fas fa-angle-double-right"></i>
                    </button>
                </div>
            `;
            
            container.appendChild(paginationSection);
        }

        // 페이지네이션 UI 생성
        function createPaginationUI(container) {
            // 페이지가 1개 이하면 페이지네이션 표시하지 않음
            if (totalPages <= 1) return;

            const paginationSection = document.createElement('div');
            paginationSection.className = 'result-card pagination-section';
            
            paginationSection.innerHTML = `
                <div class="pagination-info">
                    <h4><i class="fas fa-list me-2"></i>페이지 정보</h4>
                    <p>현재 페이지: <strong>${currentPage}</strong> / 총 <strong>${totalPages}</strong>페이지</p>
                    <p>전체 대상자: <strong>${totalCount.toLocaleString()}명</strong> (페이지당 ${itemsPerPage}명)</p>
                </div>
                
                <div class="pagination-controls">
                    <button class="btn btn-pagination ${currentPage === 1 ? 'disabled' : ''}" 
                            onclick="changePage(1)" ${currentPage === 1 ? 'disabled' : ''}>
                        <i class="fas fa-angle-double-left"></i> 첫 페이지
                    </button>
                    
                    <button class="btn btn-pagination ${currentPage === 1 ? 'disabled' : ''}" 
                            onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
                        <i class="fas fa-angle-left"></i> 이전
                    </button>
                    
                    <div class="page-numbers">
                        ${generatePageNumbers()}
                    </div>
                    
                    <button class="btn btn-pagination ${currentPage === totalPages ? 'disabled' : ''}" 
                            onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
                        다음 <i class="fas fa-angle-right"></i>
                    </button>
                    
                    <button class="btn btn-pagination ${currentPage === totalPages ? 'disabled' : ''}" 
                            onclick="changePage(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''}>
                        마지막 페이지 <i class="fas fa-angle-double-right"></i>
                    </button>
                </div>
            `;
            
            container.appendChild(paginationSection);
        }

        // 페이지 번호 생성
        function generatePageNumbers() {
            const maxVisiblePages = 5;
            const pages = [];
            
            let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
            let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
            
            // 페이지 수가 부족하면 시작 페이지 조정
            if (endPage - startPage + 1 < maxVisiblePages) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
            }
            
            for (let i = startPage; i <= endPage; i++) {
                const isActive = i === currentPage;
                pages.push(`
                    <button class="btn btn-page-number ${isActive ? 'active' : ''}" 
                            onclick="changePage(${i})" ${isActive ? 'disabled' : ''}>
                        ${i}
                    </button>
                `);
            }
            
            return pages.join('');
        }

        // 등급별 페이지 변경
        async function changeGradePage(gradeKey, page) {
            const gradeInfo = gradeStats[gradeKey];
            if (!gradeInfo || page < 1 || page > gradeInfo.totalPages || page === gradePages[gradeKey]) {
                return;
            }
            
            try {
                // 로딩 표시
                document.getElementById('loading-state').style.display = 'block';
                document.getElementById('results-container').style.display = 'none';
                
                console.log(`📄 ${gradeKey} 등급 페이지 ${page}로 변경`);
                
                // 등급별 페이지 상태 업데이트
                gradePages[gradeKey] = page;
                
                // 전체 데이터 다시 로드 (등급별 페이지 정보 반영)
                await executeHighActivityDormantAnalysis(currentPage);
                
            } catch (error) {
                console.error(`❌ ${gradeKey} 등급 페이지 변경 실패:`, error);
                showError(`${gradeKey} 등급 페이지 변경 중 오류가 발생했습니다: ${error.message}`);
            }
        }

        // 페이지 변경
        async function changePage(page) {
            if (page < 1 || page > totalPages || page === currentPage) return;
            
            try {
                // 로딩 표시
                document.getElementById('loading-state').style.display = 'block';
                document.getElementById('results-container').style.display = 'none';
                
                // 페이지 변경
                await executeHighActivityDormantAnalysis(page);
                
            } catch (error) {
                console.error('❌ 페이지 변경 실패:', error);
                showError('페이지 변경 중 오류가 발생했습니다: ' + error.message);
            }
        }

        // 그룹 섹션 생성 
        function createGroupSection(group, groupData, container) {
            const section = document.createElement('div');
            section.className = 'result-card group-section';
            
            section.innerHTML = `
                <div class="group-header">
                    <h4 class="group-title">
                        <i class="fas fa-${group.icon} me-2" style="color: ${group.color};"></i>
                        ${group.name}
                    </h4>
                    <div class="group-info">
                        <span class="group-count">${groupData.count}명 표시</span>
                    </div>
                </div>
                <div class="mb-3">
                    <small class="text-muted">${groupData.criteria}</small>
                </div>
                
                <div class="users-table">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>사용자 ID</th>
                                <th>활동 개월수</th>
                                <th>휴면 일수</th>
                                <th>총 게임일수</th>
                                <th>총 유효배팅</th>
                                <th>총 손익</th>
                                <th>마지막 게임</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${groupData.users.map(user => `
                                <tr>
                                    <td><code>${user.userId}</code></td>
                                    <td><span class="badge bg-primary">${user.months_with_10plus_days || 0}개월</span></td>
                                    <td><span class="badge bg-warning">${user.days_since_last_game || 0}일</span></td>
                                    <td>${user.total_game_days || 0}일</td>
                                    <td><strong>${(user.total_netbet || 0).toLocaleString()}원</strong></td>
                                    <td class="${(user.total_winloss || 0) >= 0 ? 'text-success' : 'text-danger'}">
                                        ${(user.total_winloss || 0).toLocaleString()}원
                                    </td>
                                    <td>${new Date(user.last_game_date).toLocaleDateString('ko-KR')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            
            container.appendChild(section);
        }

        // API 호출 함수 (개발 모드 지원)
        async function apiCall(endpoint, requireAuth = true, retries = 3) {
            // 개발 환경에서는 로컬 URL 사용
            const isLocalDev = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
            const baseUrl = isLocalDev 
                ? 'http://127.0.0.1:50888/db888-67827/us-central1' 
                : 'https://us-central1-db888-67827.cloudfunctions.net';
            const url = `${baseUrl}/${endpoint}`;
            let lastError = null;
            
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    console.log(`🔄 API 호출 시도 ${attempt}/${retries}: ${endpoint}`);
                    
                    const headers = {
                        'Content-Type': 'application/json'
                    };
                    
                    // 개발 모드에서는 인증 우회, 프로덕션에서만 인증 처리
                    if (requireAuth && !isLocalDev) {
                        // 인증 상태 재확인
                        if (!isAuthenticated) {
                            throw new Error('인증되지 않은 상태입니다');
                        }
                        
                        // Firebase Auth에서 직접 토큰 획득
                        const currentUser = firebase.auth().currentUser;
                        if (!currentUser) {
                            throw new Error('현재 사용자를 찾을 수 없습니다');
                        }
                        
                        const token = await currentUser.getIdToken();
                        if (!token) {
                            throw new Error('인증 토큰을 가져올 수 없습니다');
                        }
                        
                        headers['Authorization'] = `Bearer ${token}`;
                        console.log('✅ Firebase Auth 토큰 설정 완료');
                    } else if (isLocalDev) {
                        console.log('🧪 개발 모드: 인증 우회하여 API 호출');
                    }
                    
                    const response = await fetch(url, { headers });
                    
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
                    }
                    
                    const result = await response.json();
                    console.log(`✅ API 호출 성공: ${endpoint}`);
                    return result;
                    
                } catch (error) {
                    lastError = error;
                    console.error(`❌ API 호출 실패 (시도 ${attempt}/${retries}):`, error.message);
                    
                    // 인증 에러인 경우 토큰 재획득 시도
                    if (error.message.includes('토큰') && attempt < retries) {
                        console.log('🔄 토큰 재획득 대기 중...');
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                        continue;
                    }
                    
                    // 마지막 시도가 아니면 잠시 대기 후 재시도
                    if (attempt < retries) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                    }
                }
            }
            
            throw lastError;
        }

        // CSV 다운로드 함수
        function downloadCSV() {
            if (!analysisData || !analysisData.data) {
                alert('다운로드할 데이터가 없습니다.');
                return;
            }

            try {
                // 모든 사용자 데이터 수집 (새로운 형식)
                const allUsers = analysisData.data.map(user => ({
                    ...user,
                    group: (user.tier || 'Basic').toUpperCase()
                }));

                // CSV 헤더
                const headers = [
                    '그룹', '사용자ID', '활동개월수', '휴면일수', '총게임일수', 
                    '총유효배팅', '총손익', '평균일일배팅', '첫게임일', '마지막게임일'
                ];

                // CSV 데이터 생성
                const csvContent = [
                    headers.join(','),
                    ...allUsers.map(user => [
                        user.group,
                        user.userId,
                        user.months_with_10plus_days || 0,
                        user.days_since_last_game || 0,
                        user.total_game_days || 0,
                        user.total_netbet || 0,
                        user.total_winloss || 0,
                        user.avg_daily_netbet || 0,
                        user.first_game_date || '',
                        user.last_game_date || ''
                    ].join(','))
                ].join('\n');

                // 파일 다운로드
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', `고활동_휴면사용자_분석_${new Date().toISOString().split('T')[0]}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                console.log('✅ CSV 다운로드 완료:', allUsers.length, '명');

            } catch (error) {
                console.error('❌ CSV 다운로드 오류:', error);
                alert('CSV 다운로드 중 오류가 발생했습니다: ' + error.message);
            }
        }

        // 화면 전환 함수들
        function showResults() {
            document.getElementById('loading-state').style.display = 'none';
            document.getElementById('error-state').style.display = 'none';
            document.getElementById('results-container').style.display = 'block';
        }

        function showError(message) {
            console.error('🚨 분석 오류:', message);
            document.getElementById('loading-state').style.display = 'none';
            document.getElementById('results-container').style.display = 'none';
            document.getElementById('error-state').style.display = 'block';
            
            // 재시도 버튼 추가 (인증 에러인 경우)
            const errorScreen = document.getElementById('error-state');
            if (message.includes('인증') || message.includes('토큰')) {
                const existingRetryBtn = errorScreen.querySelector('.btn-retry');
                if (!existingRetryBtn) {
                    const retryBtn = document.createElement('button');
                    retryBtn.className = 'btn btn-warning mt-2 btn-retry';
                    retryBtn.innerHTML = '<i class="fas fa-redo me-2"></i>다시 시도';
                    retryBtn.onclick = retryAnalysis;
                    
                    const backBtn = errorScreen.querySelector('.btn-back');
                    backBtn.parentNode.insertBefore(retryBtn, backBtn);
                }
            }
        }

        // 분석 재시도
        async function retryAnalysis() {
            console.log('🔄 분석 재시도 시작');
            
            // 에러 화면 숨기고 로딩 화면 표시
            document.getElementById('error-state').style.display = 'none';
            document.getElementById('loading-state').style.display = 'block';
            
            // 인증 상태 재설정
            isAuthenticated = false;
            
            try {
                // 인증 재초기화
                await initializeAuthentication();
            } catch (error) {
                console.error('❌ 재시도 실패:', error);
                showError('재시도 중 오류가 발생했습니다: ' + error.message);
            }
        }

        function goBack() {
            window.location.href = '/query-center.html';
        }

        // 전역 함수들을 window 객체에 등록 (HTML에서 호출 가능하도록)
        window.showTierTab = showTierTab;
        window.changePage = changePage;
        window.downloadCSV = downloadCSV;
        window.retryAnalysis = retryAnalysis;
        window.goBack = goBack;

        // 페이지 로드 완료 후 이벤트 리스너 등록
        window.addEventListener('load', function() {
            console.log('🎯 DB3 분석 결과 페이지 로드 완료');
            
            // CSV 다운로드 버튼 이벤트 리스너
            const downloadBtn = document.getElementById('download-csv-btn');
            if (downloadBtn) {
                downloadBtn.addEventListener('click', downloadCSV);
            }

            // 검색 기능
            const searchInput = document.getElementById('search-input');
            if (searchInput) {
                searchInput.addEventListener('input', function(e) {
                    filterTable(e.target.value, '');
                });
            }

            // 등급 필터
            const tierFilter = document.getElementById('tier-filter');
            if (tierFilter) {
                tierFilter.addEventListener('change', function(e) {
                    const searchTerm = document.getElementById('search-input')?.value || '';
                    filterTable(searchTerm, e.target.value);
                });
            }
        });

        // 테이블 필터링 함수
        function filterTable(searchTerm, tierFilter) {
            const table = document.getElementById('results-table');
            if (!table) return;

            const rows = table.querySelectorAll('tbody tr');
            
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                const userId = cells[0]?.textContent || '';
                const tier = cells[1]?.textContent || '';
                
                const matchesSearch = searchTerm === '' || userId.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesTier = tierFilter === '' || tier.includes(tierFilter);
                
                row.style.display = matchesSearch && matchesTier ? '' : 'none';
            });
        }
