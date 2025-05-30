        // API 기본 설정
        const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 
            'http://127.0.0.1:9002/db888-67827/us-central1' : 
            'https://us-central1-db888-67827.cloudfunctions.net';

        let selectedActions = new Set();

        // 페이지 로드 시 초기화
        document.addEventListener('DOMContentLoaded', async function() {
            // 인증 체크 (페이지 보호)
            try {
                await protectPage();
                console.log("✅ 자동 인덱스 최적화 페이지 인증 완료");
            } catch (error) {
                console.log("🚫 인증 실패:", error.message);
                return; // 인증 실패 시 나머지 초기화 중단
            }
            
            console.log('🚀 Auto Index Optimizer 대시보드 초기화...');
            getStatus();
        });

        // 포괄적 인덱스 분석 실행
        async function runAnalysis() {
            try {
                showLoading('포괄적 인덱스 분석을 실행 중입니다...');
                updateProgress(20);

                const response = await fetch(`${API_BASE}/runAutoIndexAnalysis`);
                const data = await response.json();

                updateProgress(100);
                hideLoading();

                if (data.status === 'success') {
                    showSuccess('인덱스 분석이 완료되었습니다!');
                    displayAnalysisResults(data);
                } else {
                    showError(`분석 실패: ${data.message}`);
                }

            } catch (error) {
                hideLoading();
                console.error('분석 오류:', error);
                showError(`분석 중 오류 발생: ${error.message}`);
            }
        }

        // 최적화 추천사항 조회
        async function getRecommendations() {
            try {
                showLoading('최적화 추천사항을 조회 중입니다...');
                updateProgress(30);

                const response = await fetch(`${API_BASE}/getAutoIndexRecommendations`);
                const data = await response.json();

                updateProgress(100);
                hideLoading();

                if (data.status === 'success') {
                    showSuccess(`${data.summary.total}개의 추천사항을 찾았습니다!`);
                    displayRecommendations(data);
                } else {
                    showError(`추천사항 조회 실패: ${data.message}`);
                }

            } catch (error) {
                hideLoading();
                console.error('추천사항 조회 오류:', error);
                showError(`추천사항 조회 중 오류 발생: ${error.message}`);
            }
        }

        // 자동 최적화 실행
        async function executeOptimization() {
            if (!confirm('자동 최적화를 실행하시겠습니까? 이 작업은 데이터베이스 구조를 변경할 수 있습니다.')) {
                return;
            }

            try {
                showLoading('자동 최적화를 실행 중입니다...');
                updateProgress(10);

                const response = await fetch(`${API_BASE}/executeAutoIndexOptimization`, {
                    method: 'POST'
                });
                const data = await response.json();

                updateProgress(100);
                hideLoading();

                if (data.status === 'success') {
                    showSuccess(`최적화 완료! ${data.summary.actionsExecuted}개 작업 성공, ${data.summary.actionsFailed}개 실패`);
                    displayOptimizationResults(data);
                    getStatus(); // 상태 업데이트
                } else {
                    showError(`최적화 실패: ${data.message}`);
                }

            } catch (error) {
                hideLoading();
                console.error('최적화 실행 오류:', error);
                showError(`최적화 실행 중 오류 발생: ${error.message}`);
            }
        }

        // 시스템 상태 확인
        async function getStatus() {
            try {
                const response = await fetch(`${API_BASE}/getAutoIndexOptimizerStatus`);
                const data = await response.json();

                if (data.status === 'success') {
                    updateStatusDisplay(data.optimizerStatus);
                }

            } catch (error) {
                console.error('상태 조회 오류:', error);
            }
        }

        // 선택된 항목만 실행
        async function executeSelected() {
            if (selectedActions.size === 0) {
                showWarning('실행할 항목을 선택해주세요.');
                return;
            }

            if (!confirm(`선택된 ${selectedActions.size}개 항목을 실행하시겠습니까?`)) {
                return;
            }

            try {
                showLoading('선택된 최적화 작업을 실행 중입니다...');
                updateProgress(20);

                const response = await fetch(`${API_BASE}/executeManualIndexOptimization`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        actionIds: Array.from(selectedActions)
                    })
                });
                const data = await response.json();

                updateProgress(100);
                hideLoading();

                if (data.status === 'success') {
                    showSuccess(`선택된 작업 완료! ${data.results.successful}개 성공, ${data.results.failed}개 실패`);
                    selectedActions.clear();
                    getStatus();
                } else {
                    showError(`실행 실패: ${data.message}`);
                }

            } catch (error) {
                hideLoading();
                console.error('선택 실행 오류:', error);
                showError(`선택 실행 중 오류 발생: ${error.message}`);
            }
        }

        // 학습 데이터 초기화
        async function resetOptimizer() {
            if (!confirm('학습 데이터를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
                return;
            }

            try {
                showLoading('학습 데이터를 초기화 중입니다...');

                const response = await fetch(`${API_BASE}/resetAutoIndexOptimizer`, {
                    method: 'POST'
                });
                const data = await response.json();

                hideLoading();

                if (data.status === 'success') {
                    showSuccess('학습 데이터가 초기화되었습니다.');
                    getStatus();
                } else {
                    showError(`초기화 실패: ${data.message}`);
                }

            } catch (error) {
                hideLoading();
                console.error('초기화 오류:', error);
                showError(`초기화 중 오류 발생: ${error.message}`);
            }
        }

        // 분석 결과 표시
        function displayAnalysisResults(data) {
            const content = `
                <div class="recommendations-grid">
                    <div class="recommendation-group">
                        <h4>📊 데이터베이스 현황</h4>
                        <div class="status-grid">
                            <div class="status-item">
                                <div class="status-value">${data.analysis.database.totalTables}</div>
                                <div class="status-label">테이블 수</div>
                            </div>
                            <div class="status-item">
                                <div class="status-value">${data.analysis.database.totalRows.toLocaleString()}</div>
                                <div class="status-label">총 레코드 수</div>
                            </div>
                            <div class="status-item">
                                <div class="status-value">${data.analysis.database.totalDataSize} MB</div>
                                <div class="status-label">데이터 크기</div>
                            </div>
                            <div class="status-item">
                                <div class="status-value">${data.analysis.database.totalIndexSize} MB</div>
                                <div class="status-label">인덱스 크기</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="recommendation-group suggested">
                        <h4>🔍 인덱스 분석</h4>
                        <div class="status-grid">
                            <div class="status-item">
                                <div class="status-value">${data.analysis.indexes.totalIndexes}</div>
                                <div class="status-label">총 인덱스 수</div>
                            </div>
                            <div class="status-item">
                                <div class="status-value">${data.analysis.indexes.duplicates}</div>
                                <div class="status-label">중복 인덱스</div>
                            </div>
                            <div class="status-item">
                                <div class="status-value">${data.analysis.indexes.unused}</div>
                                <div class="status-label">미사용 인덱스</div>
                            </div>
                            <div class="status-item">
                                <div class="status-value">${data.analysis.indexes.inefficient}</div>
                                <div class="status-label">비효율 인덱스</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="recommendation-group important">
                        <h4>📋 최적화 계획</h4>
                        <div class="recommendation-details">
                            <p><strong>우선순위:</strong> ${data.analysis.plan.priority}</p>
                            <p><strong>계획된 작업:</strong> ${data.analysis.plan.actionsPlanned}개</p>
                            <p><strong>예상 성능 향상:</strong> ${data.analysis.plan.estimatedImpact}%</p>
                            <p><strong>위험 요소:</strong> ${data.analysis.plan.risks}개</p>
                        </div>
                    </div>
                </div>
            `;

            document.getElementById('resultsTitle').textContent = '📊 인덱스 분석 결과';
            document.getElementById('resultsContent').innerHTML = content;
            document.getElementById('resultsPanel').classList.add('show');
        }

        // 추천사항 표시
        function displayRecommendations(data) {
            let content = `
                <div class="recommendations-grid">
                    <div class="recommendation-group">
                        <h4>📊 추천사항 요약</h4>
                        <div class="status-grid">
                            <div class="status-item">
                                <div class="status-value">${data.summary.critical}</div>
                                <div class="status-label">긴급</div>
                            </div>
                            <div class="status-item">
                                <div class="status-value">${data.summary.important}</div>
                                <div class="status-label">중요</div>
                            </div>
                            <div class="status-item">
                                <div class="status-value">${data.summary.suggested}</div>
                                <div class="status-label">권장</div>
                            </div>
                            <div class="status-item">
                                <div class="status-value">${data.summary.optional}</div>
                                <div class="status-label">선택사항</div>
                            </div>
                        </div>
                    </div>
            `;

            // 각 우선순위별 추천사항 표시
            const priorities = [
                { key: 'critical', title: '🚨 긴급 추천사항', class: 'critical' },
                { key: 'important', title: '⚠️ 중요 추천사항', class: 'important' },
                { key: 'suggested', title: '💡 권장 추천사항', class: 'suggested' },
                { key: 'optional', title: '📋 선택 추천사항', class: '' }
            ];

            priorities.forEach(priority => {
                if (data.recommendations[priority.key].length > 0) {
                    content += `
                        <div class="recommendation-group ${priority.class}">
                            <h4>${priority.title}</h4>
                    `;

                    data.recommendations[priority.key].forEach(rec => {
                        const confidenceClass = rec.confidence >= 90 ? 'high' : 
                                              rec.confidence >= 75 ? 'medium' : 'low';
                        
                        content += `
                            <div class="recommendation-item">
                                <div class="recommendation-header">
                                    <div class="recommendation-title">
                                        ${rec.table}.${rec.indexName}
                                        <input type="checkbox" 
                                               onchange="toggleAction('${rec.indexName || rec.id}')"
                                               style="margin-left: 10px;">
                                    </div>
                                    <div class="confidence-badge ${confidenceClass}">
                                        ${rec.confidence}% 확신
                                    </div>
                                </div>
                                <div class="recommendation-details">
                                    ${rec.reasoning}
                                </div>
                                <div class="sql-code">
                                    ${rec.sql}
                                </div>
                                <button class="execute-btn" onclick="executeSingleAction('${rec.id || rec.indexName}')">
                                    개별 실행
                                </button>
                            </div>
                        `;
                    });

                    content += `</div>`;
                }
            });

            content += `</div>`;

            document.getElementById('resultsTitle').textContent = '💡 최적화 추천사항';
            document.getElementById('resultsContent').innerHTML = content;
            document.getElementById('resultsPanel').classList.add('show');
        }

        // 상태 표시 업데이트
        function updateStatusDisplay(status) {
            document.getElementById('optimizationCount').textContent = status.stats.totalOptimizations;
            document.getElementById('indexesCreated').textContent = status.stats.indexesCreated;
            document.getElementById('indexesDropped').textContent = status.stats.indexesDropped;
            document.getElementById('currentPhase').textContent = status.stats.currentPhase;
        }

        // 액션 선택 토글
        function toggleAction(actionId) {
            if (selectedActions.has(actionId)) {
                selectedActions.delete(actionId);
            } else {
                selectedActions.add(actionId);
            }
            console.log('선택된 액션:', Array.from(selectedActions));
        }

        // 결과 패널 숨기기
        function hideResults() {
            document.getElementById('resultsPanel').classList.remove('show');
        }

        // 보고서 내보내기
        function exportReport() {
            // 현재 표시된 결과를 CSV나 PDF로 내보내기
            showWarning('보고서 내보내기 기능은 개발 중입니다.');
        }

        // 로딩 표시
        function showLoading(message = '처리 중입니다...') {
            document.getElementById('loadingIndicator').classList.add('show');
            document.querySelector('#loadingIndicator p').textContent = message;
            updateProgress(0);
        }

        function hideLoading() {
            document.getElementById('loadingIndicator').classList.remove('show');
            updateProgress(0);
        }

        // 진행률 업데이트
        function updateProgress(percent) {
            document.getElementById('progressFill').style.width = percent + '%';
        }

        // 알림 메시지 표시
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

        console.log('🤖 Auto Index Optimizer 대시보드 준비 완료!');
