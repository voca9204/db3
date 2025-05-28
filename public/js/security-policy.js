/**
 * DB3 보안 정책 및 모니터링 시스템
 * 모든 대시보드에 공통으로 적용되는 보안 정책
 */

// 보안 정책 설정
const SECURITY_POLICY = {
    // 세션 만료 시간 (30분)
    SESSION_TIMEOUT: 30 * 60 * 1000,
    
    // 자동 로그아웃 경고 시간 (5분 전)
    LOGOUT_WARNING_TIME: 5 * 60 * 1000,
    
    // 최대 비활성 시간 (10분)
    MAX_IDLE_TIME: 10 * 60 * 1000,
    
    // 보안 헤더
    SECURITY_HEADERS: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
    }
};

// 전역 보안 상태
let securityState = {
    lastActivity: Date.now(),
    sessionStartTime: Date.now(),
    warningShown: false,
    idleTimer: null,
    sessionTimer: null
};

/**
 * 보안 정책 초기화
 */
function initializeSecurityPolicy() {
    console.log('🔒 보안 정책 초기화 중...');
    
    // 1. CSP 헤더 설정 (가능한 경우)
    setContentSecurityPolicy();
    
    // 2. 활동 모니터링 시작
    startActivityMonitoring();
    
    // 3. 세션 타이머 시작
    startSessionTimer();
    
    // 4. 보안 이벤트 리스너 설정
    setupSecurityEventListeners();
    
    // 5. 개발자 도구 감지 (선택적)
    detectDevTools();
    
    console.log('✅ 보안 정책 초기화 완료');
}

/**
 * Content Security Policy 설정
 */
function setContentSecurityPolicy() {
    const meta = document.createElement('meta');
    meta.setAttribute('http-equiv', 'Content-Security-Policy');
    meta.setAttribute('content', 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self' https://identitytoolkit.googleapis.com https://us-central1-db888-67827.cloudfunctions.net; " +
        "font-src 'self' https://cdnjs.cloudflare.com; " +
        "frame-ancestors 'none';"
    );
    document.head.appendChild(meta);
}

/**
 * 사용자 활동 모니터링 시작
 */
function startActivityMonitoring() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
        document.addEventListener(event, updateLastActivity, true);
    });
    
    // 비활성 상태 체크
    securityState.idleTimer = setInterval(checkIdleState, 60000); // 1분마다 체크
}

/**
 * 마지막 활동 시간 업데이트
 */
function updateLastActivity() {
    securityState.lastActivity = Date.now();
    securityState.warningShown = false;
}

/**
 * 비활성 상태 체크
 */
function checkIdleState() {
    const idleTime = Date.now() - securityState.lastActivity;
    
    if (idleTime > SECURITY_POLICY.MAX_IDLE_TIME) {
        console.warn('🚨 최대 비활성 시간 초과 - 자동 로그아웃');
        showSecurityAlert('비활성 상태로 인해 자동 로그아웃됩니다.', 'warning');
        performSecureLogout();
    } else if (idleTime > (SECURITY_POLICY.MAX_IDLE_TIME - SECURITY_POLICY.LOGOUT_WARNING_TIME) && !securityState.warningShown) {
        securityState.warningShown = true;
        showSecurityAlert('5분 후 자동 로그아웃됩니다. 계속 사용하려면 페이지를 클릭하세요.', 'info');
    }
}

/**
 * 세션 타이머 시작
 */
function startSessionTimer() {
    securityState.sessionTimer = setTimeout(() => {
        console.warn('🚨 세션 만료 - 자동 로그아웃');
        showSecurityAlert('세션이 만료되어 자동 로그아웃됩니다.', 'warning');
        performSecureLogout();
    }, SECURITY_POLICY.SESSION_TIMEOUT);
}

/**
 * 보안 이벤트 리스너 설정
 */
function setupSecurityEventListeners() {
    // 1. 페이지 visibility 변경 감지
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // 2. 우클릭 방지 (선택적)
    // document.addEventListener('contextmenu', preventRightClick);
    
    // 3. 키보드 단축키 제한 (선택적)
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // 4. 페이지 이탈 감지
    window.addEventListener('beforeunload', handlePageUnload);
}

/**
 * 페이지 visibility 변경 처리
 */
function handleVisibilityChange() {
    if (document.hidden) {
        console.log('📱 페이지가 백그라운드로 이동');
        // 민감한 데이터가 있는 경우 숨김 처리
        // hideSecureContent();
    } else {
        console.log('📱 페이지가 포그라운드로 복귀');
        updateLastActivity();
        // showSecureContent();
    }
}

/**
 * 우클릭 방지 (선택적)
 */
function preventRightClick(e) {
    e.preventDefault();
    showSecurityAlert('우클릭이 제한되어 있습니다.', 'info');
    return false;
}

/**
 * 키보드 단축키 제한
 */
function handleKeyboardShortcuts(e) {
    // F12 (개발자 도구) 방지 (선택적)
    if (e.key === 'F12') {
        e.preventDefault();
        showSecurityAlert('개발자 도구 접근이 제한되어 있습니다.', 'warning');
        return false;
    }
    
    // Ctrl+Shift+I (개발자 도구) 방지 (선택적)
    if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        showSecurityAlert('개발자 도구 접근이 제한되어 있습니다.', 'warning');
        return false;
    }
    
    // Ctrl+U (소스 보기) 방지 (선택적)
    if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
        showSecurityAlert('소스 보기가 제한되어 있습니다.', 'warning');
        return false;
    }
}

/**
 * 페이지 이탈 처리
 */
function handlePageUnload(e) {
    // 보안 정리 작업
    clearSecurityTimers();
    
    // 민감한 데이터 정리
    clearSensitiveData();
}

/**
 * 개발자 도구 감지 (선택적)
 */
function detectDevTools() {
    let devtools = {
        open: false,
        orientation: null
    };
    
    setInterval(() => {
        if (window.outerHeight - window.innerHeight > 160 || window.outerWidth - window.innerWidth > 160) {
            if (!devtools.open) {
                devtools.open = true;
                console.warn('🚨 개발자 도구가 감지되었습니다.');
                showSecurityAlert('개발자 도구 사용이 감지되었습니다.', 'warning');
            }
        } else {
            devtools.open = false;
        }
    }, 500);
}

/**
 * 보안 알림 표시
 */
function showSecurityAlert(message, type = 'info') {
    // 기존 알림 제거
    const existingAlert = document.getElementById('security-alert');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    const alertDiv = document.createElement('div');
    alertDiv.id = 'security-alert';
    alertDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'warning' ? '#ff6b6b' : type === 'info' ? '#4dabf7' : '#51cf66'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        font-family: 'Segoe UI', sans-serif;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 300px;
        animation: slideIn 0.3s ease-out;
    `;
    
    alertDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span>${type === 'warning' ? '⚠️' : type === 'info' ? 'ℹ️' : '✅'}</span>
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" style="
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                padding: 5px 10px;
                border-radius: 4px;
                cursor: pointer;
                margin-left: auto;
            ">×</button>
        </div>
    `;
    
    // CSS 애니메이션 추가
    if (!document.querySelector('#security-alert-styles')) {
        const style = document.createElement('style');
        style.id = 'security-alert-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(alertDiv);
    
    // 5초 후 자동 제거
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

/**
 * 안전한 로그아웃 수행
 */
function performSecureLogout() {
    try {
        // 1. 타이머 정리
        clearSecurityTimers();
        
        // 2. 민감한 데이터 정리
        clearSensitiveData();
        
        // 3. Firebase 로그아웃
        if (window.performSignOut) {
            window.performSignOut();
        } else {
            // 대체 로그아웃 방법
            window.location.href = '/login.html';
        }
        
    } catch (error) {
        console.error('로그아웃 중 오류:', error);
        window.location.href = '/login.html';
    }
}

/**
 * 보안 타이머 정리
 */
function clearSecurityTimers() {
    if (securityState.idleTimer) {
        clearInterval(securityState.idleTimer);
        securityState.idleTimer = null;
    }
    
    if (securityState.sessionTimer) {
        clearTimeout(securityState.sessionTimer);
        securityState.sessionTimer = null;
    }
}

/**
 * 민감한 데이터 정리
 */
function clearSensitiveData() {
    try {
        // 1. 로컬 스토리지 정리
        const sensitiveKeys = ['authToken', 'userEmail', 'returnUrl'];
        sensitiveKeys.forEach(key => {
            localStorage.removeItem(key);
        });
        
        // 2. 세션 스토리지 정리
        sessionStorage.clear();
        
        // 3. 폼 데이터 정리
        const forms = document.querySelectorAll('form');
        forms.forEach(form => form.reset());
        
        // 4. 페이지 내용 숨김 (선택적)
        // document.body.style.filter = 'blur(5px)';
        
    } catch (error) {
        console.error('데이터 정리 중 오류:', error);
    }
}

/**
 * 보안 상태 체크
 */
function getSecurityStatus() {
    return {
        sessionActive: securityState.sessionTimer !== null,
        lastActivity: new Date(securityState.lastActivity).toISOString(),
        sessionStartTime: new Date(securityState.sessionStartTime).toISOString(),
        idleTime: Date.now() - securityState.lastActivity,
        sessionDuration: Date.now() - securityState.sessionStartTime
    };
}

// 전역 함수 노출
window.initializeSecurityPolicy = initializeSecurityPolicy;
window.performSecureLogout = performSecureLogout;
window.getSecurityStatus = getSecurityStatus;
window.showSecurityAlert = showSecurityAlert;

console.log('🔒 DB3 보안 정책 시스템 로드 완료');
