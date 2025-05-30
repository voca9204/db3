        // 페이지 로드 시 현재 시간 업데이트 및 인증 체크
        document.addEventListener('DOMContentLoaded', async function() {
            // 페이지 기본 초기화
            document.getElementById('lastUpdate').textContent = new Date().toLocaleString('ko-KR');
            
            // 인증 체크 (약간의 지연)
            setTimeout(async () => {
                try {
                    await protectPage();
                    console.log("✅ 메인 페이지 인증 완료");
                } catch (error) {
                    console.log("🚫 인증 실패:", error.message);
                }
            }, 500); // 500ms 지연
        });

        // 버튼 호버 효과 개선
        document.querySelectorAll('.btn:not([disabled])').forEach(btn => {
            btn.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-3px) scale(1.02)';
            });
            
            btn.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0) scale(1)';
            });
        });

        // 카드 호버 효과 개선
        document.querySelectorAll('.page-card:not([style*="opacity"])').forEach(card => {
            card.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-15px) scale(1.02)';
            });
            
            card.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0) scale(1)';
            });
        });
        
        // 보안 정책 초기화
        initializeSecurityPolicy();
        
        // Firebase 인증 초기화
        initializeAuthentication();

        // Firebase 설정
        const firebaseConfig = {
            apiKey: "AIzaSyD2RY02pN2RrhT8Qt2hTSEilRqV4JAbCR0",
            authDomain: "db888-67827.firebaseapp.com",
            projectId: "db888-67827",
            storageBucket: "db888-67827.firebasestorage.app",
            messagingSenderId: "888497598316",
            appId: "1:888497598316:web:b2cb26b0a825e11a658d49"
        };

        // Firebase 초기화
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        // 인증 상태 관리 (단순한 버전)
        function initializeAuthentication() {
            const authText = document.getElementById('auth-text');
            const authBtn = document.getElementById('auth-btn');
            
            // Firebase Auth 상태 감지
            firebase.auth().onAuthStateChanged((user) => {
                if (user && user.email === 'sandscasino8888@gmail.com') {
                    // 로그인됨
                    authText.textContent = user.displayName || user.email;
                    authBtn.textContent = '로그아웃';
                    authBtn.disabled = false;
                    authBtn.onclick = logout;
                } else {
                    // 로그아웃됨
                    authText.textContent = '로그인 필요';
                    authBtn.textContent = '로그인';
                    authBtn.disabled = false;
                    authBtn.onclick = goToLogin;
                }
            });
        }
        
        // 로그인 페이지로 이동
        function goToLogin() {
            window.location.href = '/login.html';
        }
        
        // 로그아웃
        async function logout() {
            try {
                await firebase.auth().signOut();
                console.log('✅ 로그아웃 완료');
            } catch (error) {
                console.error('❌ 로그아웃 실패:', error);
            }
        }
