/**
 * DB3 인증 시스템 - 안정화된 버전
 * Firebase compat 방식 사용 (더 안정적)
 */

// Firebase 설정 - 실제 프로젝트 설정
const firebaseConfig = {
    apiKey: "AIzaSyD2RY02pN2RrhT8Qt2hTSEilRqV4JAbCR0",
    authDomain: "db888-67827.firebaseapp.com",
    projectId: "db888-67827", 
    storageBucket: "db888-67827.firebasestorage.app",
    messagingSenderId: "888497598316",
    appId: "1:888497598316:web:ad0cb0364d906c26658d49"
};

// 허용된 이메일 주소
const ALLOWED_EMAIL = "sandscasino8888@gmail.com";

// 전역 변수
let app = null;
let auth = null;
let currentUser = null;
let isInitialized = false;

/**
 * Firebase 초기화 - 안정화된 방식
 */
function initializeFirebase() {
    if (isInitialized) {
        return Promise.resolve(true);
    }
    
    try {
        // Firebase 앱 초기화 (compat 방식)
        if (!app) {
            app = firebase.initializeApp(firebaseConfig);
            auth = firebase.auth();
            
            // 에뮬레이터 연결 (개발 환경) - 현재 비활성화
            /*
            if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
                try {
                    auth.useEmulator("http://localhost:9099");
                    console.log("🧪 Firebase Auth 에뮬레이터 연결됨");
                } catch (emulatorError) {
                    console.log("⚠️ 에뮬레이터 이미 연결됨");
                }
            }
            */
            console.log("🔥 Firebase Auth 프로덕션 환경 사용");
        }
        
        isInitialized = true;
        console.log("✅ Firebase 초기화 완료");
        return Promise.resolve(true);
    } catch (error) {
        console.error("❌ Firebase 초기화 실패:", error);
        return Promise.resolve(false);
    }
}

/**
 * 인증 상태 체크 - 단순화된 버전
 */
function checkAuthStatus() {
    return new Promise((resolve, reject) => {
        if (!auth) {
            reject(new Error("Firebase 미초기화"));
            return;
        }
        
        const unsubscribe = auth.onAuthStateChanged((user) => {
            unsubscribe(); // 즉시 리스너 해제
            
            console.log("🔍 인증 상태 체크:", user ? user.email : "미인증");
            
            if (user && user.email === ALLOWED_EMAIL) {
                currentUser = user;
                
                // JWT 토큰 저장
                user.getIdToken().then(token => {
                    localStorage.setItem('authToken', token);
                    localStorage.setItem('userEmail', user.email);
                    console.log("✅ 인증 성공:", user.email);
                    resolve(user);
                }).catch(tokenError => {
                    console.error("❌ 토큰 획득 실패:", tokenError);
                    reject(tokenError);
                });
            } else if (user && user.email !== ALLOWED_EMAIL) {
                console.warn("🚫 허용되지 않은 이메일:", user.email);
                auth.signOut();
                clearAuthData();
                reject(new Error("허용되지 않은 이메일"));
            } else {
                console.log("🔓 인증되지 않은 사용자");
                clearAuthData();
                reject(new Error("인증되지 않은 사용자"));
            }
        });
    });
}

/**
 * 인증 데이터 정리
 */
function clearAuthData() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    currentUser = null;
}

/**
 * 인증 상태 UI 표시
 */
function showAuthStatus(isAuthenticated, email = '') {
    // 기존 상태 제거
    const existing = document.getElementById('auth-status');
    if (existing) existing.remove();
    
    const statusDiv = document.createElement('div');
    statusDiv.id = 'auth-status';
    statusDiv.style.cssText = `
        position: fixed; top: 20px; right: 20px; 
        padding: 12px 16px; border-radius: 8px;
        font-size: 14px; font-weight: 500; z-index: 1000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.2);
        display: flex; align-items: center; gap: 8px;
    `;
    
    if (isAuthenticated) {
        statusDiv.style.background = 'rgba(34, 197, 94, 0.9)';
        statusDiv.style.color = 'white';
        statusDiv.innerHTML = `
            <span>🔒</span>
            <span>인증됨: ${email}</span>
            <button onclick="performSignOut()" style="
                background: rgba(255,255,255,0.2); border: none; color: white;
                padding: 4px 8px; border-radius: 4px; cursor: pointer;
                font-size: 12px; margin-left: 8px;
            ">로그아웃</button>
        `;
    } else {
        statusDiv.style.background = 'rgba(239, 68, 68, 0.9)';
        statusDiv.style.color = 'white';
        statusDiv.innerHTML = `<span>🚫</span><span>인증 필요</span>`;
    }
    
    document.body.appendChild(statusDiv);
}

/**
 * 로그아웃 처리
 */
async function performSignOut() {
    try {
        if (auth) {
            await auth.signOut();
        }
        clearAuthData();
        console.log("✅ 로그아웃 완료");
        window.location.href = '/login.html';
    } catch (error) {
        console.error("❌ 로그아웃 실패:", error);
    }
}

/**
 * 페이지 보호 - 개선된 버전
 */
async function protectPage() {
    console.log("🛡️ 페이지 보호:", window.location.pathname);
    
    // 로그인 페이지 예외
    if (window.location.pathname === '/login.html') {
        console.log("ℹ️ 로그인 페이지 - 보호 건너뛰기");
        return;
    }
    
    try {
        // Firebase 초기화
        const initialized = await initializeFirebase();
        if (!initialized) {
            throw new Error("Firebase 초기화 실패");
        }
        
        // 기존 토큰 빠른 체크
        const existingToken = localStorage.getItem('authToken');
        const existingEmail = localStorage.getItem('userEmail');
        
        if (existingToken && existingEmail === ALLOWED_EMAIL) {
            console.log("⚡ 기존 토큰으로 접근 허용");
            showAuthStatus(true, existingEmail);
            return;
        }
        
        // Firebase 인증 상태 체크
        await checkAuthStatus();
        showAuthStatus(true, currentUser.email);
        console.log("✅ 인증 완료 - 페이지 접근 허용");
        
    } catch (error) {
        console.log("🚫 인증 실패:", error.message);
        
        // 리턴 URL 저장
        if (window.location.pathname !== '/login.html') {
            localStorage.setItem('returnUrl', window.location.pathname);
        }
        
        // 로그인 페이지로 리다이렉트
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 100); // 약간의 지연을 줘서 안정성 확보
    }
}

/**
 * 유틸리티 함수들
 */
function getAuthToken() {
    return localStorage.getItem('authToken');
}

function getCurrentUserEmail() {
    return localStorage.getItem('userEmail');
}

function getAuthHeaders() {
    const token = getAuthToken();
    return token ? {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    } : {
        'Content-Type': 'application/json'
    };
}

function redirectAfterLogin() {
    const returnUrl = localStorage.getItem('returnUrl');
    if (returnUrl && returnUrl !== '/login.html') {
        localStorage.removeItem('returnUrl');
        window.location.href = returnUrl;
    } else {
        window.location.href = '/index.html';
    }
}

// 전역 함수로 노출
window.protectPage = protectPage;
window.performSignOut = performSignOut;
window.getAuthToken = getAuthToken;
window.getCurrentUserEmail = getCurrentUserEmail;
window.getAuthHeaders = getAuthHeaders;
window.redirectAfterLogin = redirectAfterLogin;
window.initializeFirebase = initializeFirebase;
window.checkAuthStatus = checkAuthStatus;
window.showAuthStatus = showAuthStatus;

console.log("🔐 DB3 인증 시스템 로드 완료 (안정화 버전)");
