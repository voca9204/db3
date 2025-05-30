        // API 기본 설정
        const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 
            'http://127.0.0.1:9002/db888-67827/us-central1' : 
            'https://us-central1-db888-67827.cloudfunctions.net';

        let currentData = null;

        // 페이지 로드 시 초기화
        document.addEventListener('DOMContentLoaded', async function() {
            // 인증 체크 (페이지 보호)
            try {
                await protectPage();
                console.log("✅ 인덱스 관리 페이지 인증 완료");
            } catch (error) {
                console.log("🚫 인증 실패:", error.message);
                return; // 인증 실패 시 나머지 초기화 중단
            }
            
            console.log('🎛️ Index Management Dashboard 초기화...');
            loadDashboardData();
            loadRecentOperations();
        });

        // 탭 전환
        function showTab(tabName) {
            // 모든 탭 버튼과 컨텐츠 비활성화
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            // 선택된 탭 활성화
            event.target.classList.add('active');
            document.getElementById(tabName).classList.add('active');
        }

        // 대시보드 데이터 로드
        async function loadDashboardData() {
            try {
                showLoading('대시보드 데이터를 로드하는 중...');
                
                const response = await fetch(`${API_BASE}/getIndexManagementDashboard`);
                const data = await response.json();
                
                hideLoading();
                
                if (data.status === 'success') {
                    currentData = data.data;
                    updateDashboard(data.data);
                    showSuccess('대시보드 데이터를 성공적으로 로드했습니다.');
                } else {
                    showError(`데이터 로드 실패: ${data.message}`);
                }
                
            } catch (error) {
                hideLoading();
                console.error('대시보드 데이터 로드 오류:', error);
                showError(`데이터 로드 중 오류 발생: ${error.message}`);
            }
        }

        // 대시보드 업데이트
        function updateDashboard(data) {
            // 통계 업데이트
            document.getElementById('totalTables').textContent = data.summary.totalTables;
            document.getElementById('totalIndexes').textContent = data.summary.totalIndexes;
            document.getElementById('totalSize').textContent = data.summary.totalSize;
            document.getElementById('operationsToday').textContent = data.managementStatus.operationsToday;

            // 인덱스 테이블 업데이트
            updateIndexesTable(data.indexes);
        }

        // 인덱스 테이블 업데이트
        function updateIndexesTable(indexes) {
            const tbody = document.getElementById('indexesTableBody');
            tbody.innerHTML = '';

            for (const tableName in indexes) {
                const table = indexes[tableName];
                
                for (const indexName in table.indexes) {
                    const index = table.indexes[indexName];
                    const row = document.createElement('tr');
                    
                    const columns = index.columns.map(c => c.columnName).join(', ');
                    const indexType = index.unique ? 'UNIQUE' : 'INDEX';
                    const isPrimary = indexName === 'PRIMARY';
                    
                    row.innerHTML = `
                        <td>${table.tableName}</td>
                        <td>${index.indexName}</td>
                        <td>${columns}</td>
                        <td>${indexType}</td>
                        <td>-</td>
                        <td><span class="index-status status-active">활성</span></td>
                        <td>
                            <button class="action-btn" style="padding: 4px 8px; margin: 2px; font-size: 12px;" 
                                    onclick="analyzeSpecificIndex('${table.tableName}', '${index.indexName}')">
                                분석
                            </button>
                            ${!isPrimary ? `
                            <button class="action-btn danger" style="padding: 4px 8px; margin: 2px; font-size: 12px;" 
                                    onclick="confirmDropIndex('${table.tableName}', '${index.indexName}')">
                                삭제
                            </button>` : ''}
                        </td>
                    `;
                    
                    tbody.appendChild(row);
                }
            }
        }

        // 인덱스 생성
        async function createIndex() {
            const tableName = document.getElementById('createTableName').value.trim();
            const indexName = document.getElementById('createIndexName').value.trim();
            const columnsInput = document.getElementById('createColumns').value.trim();
            const unique = document.getElementById('createUnique').checked;

            if (!tableName || !indexName || !columnsInput) {
                showError('테이블명, 인덱스명, 컬럼을 모두 입력해주세요.');
                return;
            }

            const columns = columnsInput.split(',').map(col => col.trim()).filter(col => col);

            if (columns.length === 0) {
                showError('유효한 컬럼을 입력해주세요.');
                return;
            }

            try {
                showLoading('인덱스를 생성하는 중...');

                const response = await fetch(`${API_BASE}/createIndex`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        tableName,
                        indexName,
                        columns,
                        options: { unique }
                    })
                });

                const data = await response.json();
                hideLoading();

                if (data.status === 'success') {
                    showSuccess(`인덱스 '${indexName}'이 성공적으로 생성되었습니다.`);
                    // 폼 초기화
                    document.getElementById('createTableName').value = '';
                    document.getElementById('createIndexName').value = '';
                    document.getElementById('createColumns').value = '';
                    document.getElementById('createUnique').checked = false;
                    // 데이터 새로고침
                    loadDashboardData();
                } else {
                    showError(`인덱스 생성 실패: ${data.message}`);
                }

            } catch (error) {
                hideLoading();
                console.error('인덱스 생성 오류:', error);
                showError(`인덱스 생성 중 오류 발생: ${error.message}`);
            }
        }

        // 인덱스 삭제
        async function dropIndex() {
            const tableName = document.getElementById('dropTableName').value.trim();
            const indexName = document.getElementById('dropIndexName').value.trim();
            const backup = document.getElementById('dropBackup').checked;

            if (!tableName || !indexName) {
                showError('테이블명과 인덱스명을 모두 입력해주세요.');
                return;
            }

            if (!confirm(`정말로 인덱스 '${indexName}'을 삭제하시겠습니까?`)) {
                return;
            }

            try {
                showLoading('인덱스를 삭제하는 중...');

                const response = await fetch(`${API_BASE}/dropIndex`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        tableName,
                        indexName,
                        options: { backup }
                    })
                });

                const data = await response.json();
                hideLoading();

                if (data.status === 'success') {
                    showSuccess(`인덱스 '${indexName}'이 성공적으로 삭제되었습니다.`);
                    // 폼 초기화
                    document.getElementById('dropTableName').value = '';
                    document.getElementById('dropIndexName').value = '';
                    // 데이터 새로고침
                    loadDashboardData();
                } else {
                    showError(`인덱스 삭제 실패: ${data.message}`);
                }

            } catch (error) {
                hideLoading();
                console.error('인덱스 삭제 오류:', error);
                showError(`인덱스 삭제 중 오류 발생: ${error.message}`);
            }
        }

        // 인덱스 분석
        async function analyzeIndex() {
            const tableName = document.getElementById('analyzeTableName').value.trim();
            const indexName = document.getElementById('analyzeIndexName').value.trim();

            if (!tableName || !indexName) {
                showError('테이블명과 인덱스명을 모두 입력해주세요.');
                return;
            }

            await analyzeSpecificIndex(tableName, indexName);
        }

        // 특정 인덱스 분석
        async function analyzeSpecificIndex(tableName, indexName) {
            try {
                showLoading('인덱스를 분석하는 중...');

                const response = await fetch(`${API_BASE}/analyzeIndex?tableName=${tableName}&indexName=${indexName}`);
                const data = await response.json();

                hideLoading();

                if (data.status === 'success') {
                    showAnalysisResults(data.analysis);
                    showSuccess(`인덱스 '${indexName}' 분석이 완료되었습니다.`);
                } else {
                    showError(`인덱스 분석 실패: ${data.message}`);
                }

            } catch (error) {
                hideLoading();
                console.error('인덱스 분석 오류:', error);
                showError(`인덱스 분석 중 오류 발생: ${error.message}`);
            }
        }

        // 분석 결과 표시
        function showAnalysisResults(analysis) {
            const resultsDiv = document.getElementById('analysisResults');
            const contentDiv = document.getElementById('analysisContent');

            let content = `
                <div class="control-grid">
                    <div class="control-card">
                        <h4>📋 기본 정보</h4>
                        <p><strong>테이블:</strong> ${analysis.tableName}</p>
                        <p><strong>인덱스:</strong> ${analysis.indexName}</p>
                        <p><strong>분석 시간:</strong> ${new Date(analysis.timestamp).toLocaleString()}</p>
                    </div>
                    
                    <div class="control-card">
                        <h4>📊 테이블 통계</h4>
                        <p><strong>총 행 수:</strong> ${(analysis.tableStats.TABLE_ROWS || 0).toLocaleString()}</p>
                        <p><strong>데이터 크기:</strong> ${Math.round((analysis.tableStats.DATA_LENGTH || 0) / 1024 / 1024)} MB</p>
                        <p><strong>인덱스 크기:</strong> ${Math.round((analysis.tableStats.INDEX_LENGTH || 0) / 1024 / 1024)} MB</p>
                    </div>
                </div>
            `;

            if (analysis.performanceTest && analysis.performanceTest.tests) {
                content += `
                    <div class="control-card">
                        <h4>⚡ 성능 테스트 결과</h4>
                        <div class="json-viewer">
                            ${JSON.stringify(analysis.performanceTest, null, 2)}
                        </div>
                    </div>
                `;
            }

            contentDiv.innerHTML = content;
            resultsDiv.style.display = 'block';

            // 분석 탭으로 전환
            showTab('analyze');
        }

        // 보고서 생성
        async function generateReport() {
            const days = document.getElementById('reportDays').value;
            const tableName = document.getElementById('reportTableName').value.trim();
            const includeRecommendations = document.getElementById('includeRecommendations').checked;

            try {
                showLoading('성능 보고서를 생성하는 중...');

                let url = `${API_BASE}/generatePerformanceReport?days=${days}&includeRecommendations=${includeRecommendations}`;
                if (tableName) {
                    url += `&tableName=${tableName}`;
                }

                const response = await fetch(url);
                const data = await response.json();

                hideLoading();

                if (data.status === 'success') {
                    showReportResults(data.report);
                    showSuccess('성능 보고서가 성공적으로 생성되었습니다.');
                } else {
                    showError(`보고서 생성 실패: ${data.message}`);
                }

            } catch (error) {
                hideLoading();
                console.error('보고서 생성 오류:', error);
                showError(`보고서 생성 중 오류 발생: ${error.message}`);
            }
        }

        // 보고서 결과 표시
        function showReportResults(report) {
            const resultsDiv = document.getElementById('reportResults');
            const contentDiv = document.getElementById('reportContent');

            let content = `
                <div class="control-grid">
                    <div class="control-card">
                        <h4>📊 보고서 요약</h4>
                        <p><strong>분석 기간:</strong> ${report.period}</p>
                        <p><strong>총 인덱스:</strong> ${report.summary.totalIndexes}</p>
                        <p><strong>총 크기:</strong> ${report.summary.totalIndexSize} MB</p>
                        <p><strong>평균 크기:</strong> ${report.summary.averageIndexSize} KB</p>
                    </div>
                </div>
            `;

            if (report.recommendations && report.recommendations.length > 0) {
                content += `
                    <div class="control-card">
                        <h4>💡 추천사항</h4>
                        ${report.recommendations.map(rec => `
                            <div class="alert ${rec.priority === 'HIGH' ? 'error' : 'warning'}" style="display: block; margin: 10px 0;">
                                <strong>${rec.type}:</strong> ${rec.message}
                                <br><small>${rec.suggestion}</small>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            if (report.operations && report.operations.length > 0) {
                content += `
                    <div class="control-card">
                        <h4>📋 최근 작업</h4>
                        <div class="table-container" style="max-height: 300px;">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>시간</th>
                                        <th>작업</th>
                                        <th>테이블</th>
                                        <th>인덱스</th>
                                        <th>상태</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${report.operations.map(op => `
                                        <tr>
                                            <td>${new Date(op.timestamp).toLocaleString()}</td>
                                            <td>${op.operation}</td>
                                            <td>${op.tableName || '-'}</td>
                                            <td>${op.indexName || '-'}</td>
                                            <td><span class="index-status ${op.status === 'SUCCESS' ? 'status-active' : 'status-duplicate'}">${op.status}</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            }

            contentDiv.innerHTML = content;
            resultsDiv.style.display = 'block';
        }

        // 최근 작업 히스토리 로드
        async function loadRecentOperations() {
            try {
                const response = await fetch(`${API_BASE}/getIndexManagementStatus`);
                const data = await response.json();

                if (data.status === 'success') {
                    updateRecentOperations(data.managementStatus.recentOperations);
                }

            } catch (error) {
                console.error('최근 작업 로드 오류:', error);
            }
        }

        // 최근 작업 업데이트
        function updateRecentOperations(operations) {
            const container = document.getElementById('recentOperations');
            
            if (!operations || operations.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">최근 작업이 없습니다.</div>';
                return;
            }

            container.innerHTML = operations.map(op => `
                <div style="border-bottom: 1px solid #e0e0e0; padding: 10px 0;">
                    <strong>${op.operation}</strong> 
                    <span style="color: #666;">${op.tableName || ''}.${op.indexName || ''}</span>
                    <br>
                    <small style="color: #888;">${new Date(op.timestamp).toLocaleString()}</small>
                    <span class="index-status ${op.status === 'SUCCESS' ? 'status-active' : 'status-duplicate'}" style="float: right;">${op.status}</span>
                </div>
            `).join('');
        }

        // 유틸리티 함수들
        function refreshData() {
            loadDashboardData();
            showSuccess('데이터를 새로고침했습니다.');
        }

        function runQuickAnalysis() {
            showWarning('빠른 성능 분석 기능은 개발 중입니다.');
        }

        function optimizeAllTables() {
            showWarning('전체 테이블 최적화 기능은 개발 중입니다.');
        }

        function confirmDropIndex(tableName, indexName) {
            document.getElementById('dropTableName').value = tableName;
            document.getElementById('dropIndexName').value = indexName;
            showTab('manage');
            showWarning(`${tableName}.${indexName} 인덱스 삭제를 위해 관리 탭으로 이동했습니다.`);
        }

        // 모달 관련 함수
        function openModal(title, content) {
            document.getElementById('modalTitle').textContent = title;
            document.getElementById('modalBody').innerHTML = content;
            document.getElementById('detailModal').style.display = 'block';
        }

        function closeModal() {
            document.getElementById('detailModal').style.display = 'none';
        }

        // 클릭 이벤트로 모달 닫기
        window.onclick = function(event) {
            const modal = document.getElementById('detailModal');
            if (event.target == modal) {
                closeModal();
            }
        }

        // 로딩 및 알림 함수들
        function showLoading(message = '처리 중입니다...') {
            document.getElementById('loadingIndicator').classList.add('show');
            document.querySelector('#loadingIndicator p').textContent = message;
        }

        function hideLoading() {
            document.getElementById('loadingIndicator').classList.remove('show');
        }

        function showSuccess(message) {
            showAlert('successAlert', message);
        }

        function showError(message) {
            showAlert('errorAlert', message);
        }

        function showWarning(message) {
            showAlert('warningAlert', message);
        }

        function showAlert(alertId, message) {
            const alert = document.getElementById(alertId);
            alert.textContent = message;
            alert.classList.add('show');
            
            setTimeout(() => {
                alert.classList.remove('show');
            }, 5000);
        }

        console.log('🎛️ Index Management Dashboard 준비 완료!');
        console.log('🎉 DB3 프로젝트 100% 완성!');
