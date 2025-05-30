/**
 * DB3 Authentication System
 * Firebase Authentication 관련 함수들
 */

// Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyD2RY02pN2RrhT8Qt2hTSEilRqV4JAbCR0",
    authDomain: "db888-67827.firebaseapp.com",
    projectId: "db888-67827",
    storageBucket: "db888-67827.firebasestorage.app",
    messagingSenderId: "888497598316",
    appId: "1:888497598316:web:b2cb26b0a825e11a658d49"
};

// Firebase 초기화 (중복 확인)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    
    // 로컬 개발 환경에서 Auth 에뮬레이터 사용
    if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
        firebase.auth().useEmulator('http://127.0.0.1:9099');
        console.log('🔥 Firebase Auth 에뮬레이터 연결');
    }
    
    console.log('🔥 Firebase 초기화 완료');
} else {
    console.log('🔥 Firebase 이미 초기화됨');
}

// 인증된 사용자 정보
let currentUser = null;

/**
 * 페이지 보호 함수 - 인증되지 않은 사용자 리다이렉션
 */
function protectPage() {
    console.log('🔒 페이지 보호 확인 중...');
    
    // Firebase Auth 상태 확인
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            // 허용된 이메일 확인
            const allowedEmail = 'sandscasino8888@gmail.com';
            if (user.email === allowedEmail) {
                console.log('✅ 인증된 사용자:', user.email);
                currentUser = user;
                // 인증 완료 후 UI 업데이트
                updateAuthUI(true);
            } else {
                console.log('❌ 허용되지 않은 이메일:', user.email);
                alert('접근 권한이 없습니다.');
                firebase.auth().signOut();
                redirectToLogin();
            }
        } else {
            console.log('❌ 인증되지 않은 사용자');
            redirectToLogin();
        }
    });
}

/**
 * 로그인 페이지로 리다이렉션
 */
function redirectToLogin() {
    if (window.location.pathname !== '/index.html' && window.location.pathname !== '/') {
        window.location.href = '/index.html';
    }
}

/**
 * Google 로그인
 */
async function signInWithGoogle() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await firebase.auth().signInWithPopup(provider);
        console.log('✅ Google 로그인 성공:', result.user.email);
        return result.user;
    } catch (error) {
        console.error('❌ Google 로그인 실패:', error);
        throw error;
    }
}

/**
 * 로그아웃
 */
async function signOut() {
    try {
        await firebase.auth().signOut();
        console.log('✅ 로그아웃 완료');
        currentUser = null;
        updateAuthUI(false);
        redirectToLogin();
    } catch (error) {
        console.error('❌ 로그아웃 실패:', error);
    }
}

/**
 * 인증 상태에 따른 UI 업데이트
 */
function updateAuthUI(isAuthenticated) {
    // 대시보드별 요소들
    const authInfo = document.getElementById('auth-info');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    
    // main-dashboard.html 전용 요소들
    const loginSection = document.getElementById('loginSection');
    const dashboard = document.getElementById('dashboard');
    const mainLoginBtn = document.getElementById('loginBtn');
    const mainLogoutBtn = document.getElementById('logoutBtn');
    const userInfo = document.getElementById('userInfo');
    const userEmail = document.getElementById('userEmail');
    
    if (isAuthenticated && currentUser) {
        // 공통 UI 업데이트
        if (authInfo) {
            authInfo.innerHTML = `
                <div class="d-flex align-items-center">
                    <img src="${currentUser.photoURL || '/img/default-avatar.png'}" 
                         class="rounded-circle me-2" width="32" height="32">
                    <span class="text-white">${currentUser.displayName || currentUser.email}</span>
                </div>
            `;
        }
        if (loginBtn) loginBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
        
        // main-dashboard.html 전용 UI 업데이트
        if (loginSection && dashboard) {
            loginSection.style.display = 'none';
            dashboard.style.display = 'block';
            if (mainLoginBtn) mainLoginBtn.style.display = 'none';
            if (mainLogoutBtn) mainLogoutBtn.style.display = 'inline-block';
            if (userInfo) userInfo.style.display = 'block';
            if (userEmail) userEmail.textContent = currentUser.email;
            
            // 시스템 상태 로드 (main-dashboard.html에서만)
            if (typeof loadSystemStatus === 'function') {
                loadSystemStatus();
            }
        }
    } else {
        // 공통 UI 업데이트
        if (authInfo) authInfo.innerHTML = '<span class="text-white">로그인이 필요합니다</span>';
        if (loginBtn) loginBtn.style.display = 'inline-block';
        if (logoutBtn) logoutBtn.style.display = 'none';
        
        // main-dashboard.html 전용 UI 업데이트
        if (loginSection && dashboard) {
            loginSection.style.display = 'block';
            dashboard.style.display = 'none';
            if (mainLoginBtn) mainLoginBtn.style.display = 'inline-block';
            if (mainLogoutBtn) mainLogoutBtn.style.display = 'none';
            if (userInfo) userInfo.style.display = 'none';
        }
    }
}

/**
 * 인증된 API 호출을 위한 토큰 획득
 */
async function getAuthToken() {
    if (currentUser) {
        try {
            const token = await currentUser.getIdToken();
            return token;
        } catch (error) {
            console.error('❌ 토큰 획득 실패:', error);
            return null;
        }
    }
    return null;
}

/**
 * 현재 사용자 정보 반환
 */
function getCurrentUser() {
    return currentUser;
}

// 페이지 로드 시 자동 실행
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔒 Auth.js 로드 완료');
    
    // 인증 관련 이벤트 리스너 설정
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (loginBtn) {
        loginBtn.addEventListener('click', signInWithGoogle);
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', signOut);
    }
});
