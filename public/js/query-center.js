// Query Center JavaScript

// 페이지 로드 시 인증 확인
document.addEventListener('DOMContentLoaded', function() {
    // 모든 환경에서 인증 우회 (분석결과 페이지와 동일하게 처리)
    console.log('🧪 인증 우회 - 질의센터 접근 허용');
    updateAuthUI(true, {
        email: 'db3@system.com',
        displayName: 'DB3 System User',
        photoURL: 'https://via.placeholder.com/32'
    });
});

// 개발 모드용 UI 업데이트 함수
function updateAuthUI(isAuthenticated, mockUser = null) {
    const authInfo = document.getElementById('auth-info');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (isAuthenticated && mockUser) {
        if (authInfo) {
            authInfo.innerHTML = `
                <div class="d-flex align-items-center">
                    <img src="${mockUser.photoURL}" 
                         class="rounded-circle me-2" width="32" height="32">
                    <span class="text-white">${mockUser.displayName}</span>
                    <small class="text-warning ms-2">[DEV]</small>
                </div>
            `;
        }
        if (loginBtn) loginBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
    }
}

// 분석 실행 함수
async function executeAnalysis(analysisType) {
    console.log('🎯 분석 실행:', analysisType);
    
    const button = event.target;
    const spinner = button.querySelector('.loading-spinner');
    
    // 로딩 상태 표시
    button.disabled = true;
    spinner.style.display = 'inline-block';
    
    try {
        // 분석 결과 페이지로 이동 (분석 타입을 파라미터로 전달)
        const params = new URLSearchParams({
            type: analysisType,
            timestamp: Date.now()
        });
        
        window.location.href = `/analysis-result.html?${params.toString()}`;
        
    } catch (error) {
        console.error('❌ 분석 실행 오류:', error);
        alert('분석 실행 중 오류가 발생했습니다: ' + error.message);
        
        // 로딩 상태 해제
        button.disabled = false;
        spinner.style.display = 'none';
    }
}

// 페이지 로드 완료 후 실행
window.addEventListener('load', function() {
    console.log('🎯 DB3 질의 센터 로드 완료');
});
