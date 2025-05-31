#!/usr/bin/env node

/**
 * DB3 포트 관리자
 * 포트 충돌 감지, 사용 가능한 포트 찾기, 프로젝트별 포트 할당 관리
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class PortManager {
    constructor() {
        this.projectRoot = path.resolve(__dirname, '..');
        this.configFile = path.join(this.projectRoot, 'scripts', 'port-config.json');
        
        // DB3 전용 포트 범위
        this.DB3_PORT_RANGE = {
            start: 50888,
            end: 50899
        };
        
        // 포트 용도별 정의
        this.PORT_TYPES = {
            functions: 'Firebase Functions API',
            hosting: 'Firebase Hosting (웹 대시보드)',
            auth: 'Firebase Auth 에뮬레이터',
            ui: 'Firebase UI 에뮬레이터'
        };
        
        this.init();
    }

    init() {
        this.loadConfig();
        console.log('🚀 DB3 포트 관리자 시작');
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configFile)) {
                this.config = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
            } else {
                this.config = this.createDefaultConfig();
                this.saveConfig();
            }
        } catch (error) {
            console.error('❌ 설정 파일 로드 오류:', error.message);
            this.config = this.createDefaultConfig();
        }
    }

    createDefaultConfig() {
        return {
            project: 'DB3',
            created: new Date().toISOString(),
            ports: {
                functions: 50888,
                hosting: 50889,
                auth: 50890,
                ui: 50891
            },
            backup_ports: {
                functions: [50892, 50893, 50894],
                hosting: [50895, 50896, 50897],
                auth: [50898, 50899, 50900],
                ui: [50901, 50902, 50903]
            }
        };
    }

    saveConfig() {
        try {
            const scriptsDir = path.dirname(this.configFile);
            if (!fs.existsSync(scriptsDir)) {
                fs.mkdirSync(scriptsDir, { recursive: true });
            }
            fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
            console.log('💾 포트 설정 저장됨:', this.configFile);
        } catch (error) {
            console.error('❌ 설정 저장 오류:', error.message);
        }
    }

    // 포트 사용 중인지 확인
    isPortInUse(port) {
        try {
            const result = execSync(`lsof -i :${port}`, { encoding: 'utf8', stdio: 'pipe' });
            return result.trim() !== '';
        } catch (error) {
            // lsof가 아무것도 찾지 못하면 오류 발생 (포트가 사용되지 않음)
            return false;
        }
    }

    // 포트 사용 현황 확인
    checkPorts() {
        console.log('\n📊 DB3 포트 사용 현황');
        console.log('=' .repeat(50));
        
        const results = {};
        
        for (const [type, port] of Object.entries(this.config.ports)) {
            const inUse = this.isPortInUse(port);
            const status = inUse ? '🔴 사용중' : '🟢 사용가능';
            
            console.log(`${this.PORT_TYPES[type]}: ${port} ${status}`);
            
            results[type] = {
                port: port,
                inUse: inUse,
                description: this.PORT_TYPES[type]
            };
        }
        
        return results;
    }

    // 사용 가능한 포트 찾기
    findAvailablePort(startPort = this.DB3_PORT_RANGE.start) {
        for (let port = startPort; port <= this.DB3_PORT_RANGE.end + 100; port++) {
            if (!this.isPortInUse(port)) {
                return port;
            }
        }
        return null;
    }

    // 충돌 해결
    resolveConflicts() {
        console.log('\n🔧 포트 충돌 해결 중...');
        
        let hasConflicts = false;
        const newPorts = { ...this.config.ports };
        
        for (const [type, port] of Object.entries(this.config.ports)) {
            if (this.isPortInUse(port)) {
                console.log(`⚠️ 포트 ${port} (${type}) 충돌 감지`);
                
                // 백업 포트 확인
                let newPort = null;
                if (this.config.backup_ports[type]) {
                    for (const backupPort of this.config.backup_ports[type]) {
                        if (!this.isPortInUse(backupPort)) {
                            newPort = backupPort;
                            break;
                        }
                    }
                }
                
                // 백업 포트도 모두 사용 중이면 새로운 포트 찾기
                if (!newPort) {
                    newPort = this.findAvailablePort(port + 1);
                }
                
                if (newPort) {
                    console.log(`✅ ${type} 포트 변경: ${port} → ${newPort}`);
                    newPorts[type] = newPort;
                    hasConflicts = true;
                } else {
                    console.log(`❌ ${type}에 대한 사용 가능한 포트를 찾을 수 없습니다`);
                }
            }
        }
        
        if (hasConflicts) {
            this.config.ports = newPorts;
            this.saveConfig();
            this.updateFirebaseConfig();
            console.log('\n🎉 포트 충돌 해결 완료!');
            return true;
        } else {
            console.log('✅ 포트 충돌 없음');
            return false;
        }
    }

    // firebase.json 업데이트
    updateFirebaseConfig() {
        const firebaseConfigPath = path.join(this.projectRoot, 'firebase.json');
        
        try {
            const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
            
            firebaseConfig.emulators = {
                auth: { port: this.config.ports.auth },
                functions: { port: this.config.ports.functions },
                hosting: { port: this.config.ports.hosting },
                ui: { enabled: true, port: this.config.ports.ui }
            };
            
            fs.writeFileSync(firebaseConfigPath, JSON.stringify(firebaseConfig, null, 2));
            console.log('📝 firebase.json 업데이트됨');
        } catch (error) {
            console.error('❌ firebase.json 업데이트 오류:', error.message);
        }
    }

    // 현재 실행 중인 프로세스 확인
    showRunningProcesses() {
        console.log('\n🔍 현재 실행 중인 DB3 관련 프로세스');
        console.log('=' .repeat(50));
        
        try {
            const ports = Object.values(this.config.ports).join(' -i :');
            const result = execSync(`lsof -i :${ports}`, { encoding: 'utf8' });
            console.log(result);
        } catch (error) {
            console.log('실행 중인 프로세스 없음');
        }
    }

    // 포트 범위 스캔
    scanPortRange(start = 50880, end = 50920) {
        console.log(`\n🔍 포트 범위 스캔 (${start}-${end})`);
        console.log('=' .repeat(50));
        
        const usedPorts = [];
        const availablePorts = [];
        
        for (let port = start; port <= end; port++) {
            if (this.isPortInUse(port)) {
                usedPorts.push(port);
            } else {
                availablePorts.push(port);
            }
        }
        
        console.log(`🔴 사용 중인 포트 (${usedPorts.length}개):`, usedPorts.join(', ') || '없음');
        console.log(`🟢 사용 가능한 포트 (${availablePorts.length}개):`, availablePorts.slice(0, 10).join(', ') + (availablePorts.length > 10 ? '...' : ''));
        
        return { usedPorts, availablePorts };
    }

    // 메인 실행 함수
    run(command = 'check') {
        switch (command) {
            case 'check':
                this.checkPorts();
                break;
            case 'resolve':
                this.resolveConflicts();
                break;
            case 'scan':
                this.scanPortRange();
                break;
            case 'processes':
                this.showRunningProcesses();
                break;
            case 'status':
                this.checkPorts();
                this.showRunningProcesses();
                break;
            default:
                this.showHelp();
        }
    }

    showHelp() {
        console.log(`
🚀 DB3 포트 관리자 사용법

명령어:
  check      - 포트 사용 현황 확인
  resolve    - 포트 충돌 자동 해결
  scan       - 포트 범위 스캔 (50880-50920)
  processes  - 실행 중인 프로세스 확인
  status     - 전체 상태 확인 (check + processes)

예시:
  node scripts/port-manager.js check
  node scripts/port-manager.js resolve
  node scripts/port-manager.js scan
        `);
    }
}

// CLI 실행
if (require.main === module) {
    const command = process.argv[2] || 'check';
    const portManager = new PortManager();
    portManager.run(command);
}

module.exports = PortManager;
