/**
 * PerformanceMonitorCore.js
 * Core performance monitoring system class
 * 분할된 모듈: PerformanceMonitor.js의 핵심 부분
 * 
 * 포함 기능:
 * - 핵심 PerformanceMonitor 클래스
 * - 모니터링 상태 관리
 * - 기본 설정 및 초기화
 * - 건강성 검사
 */

const MetricsCollector = require('./MetricsCollector');
const AlertSystem = require('./AlertSystem');
const BenchmarkRunner = require('./BenchmarkRunner');

// 분할된 모듈들 import
const MonitoringEngine = require('./MonitoringEngine');
const PerformanceReporter = require('./PerformanceReporter');

class PerformanceMonitor {
  constructor(options = {}) {
    this.options = {
      enableRealTimeMonitoring: options.enableRealTimeMonitoring !== false,
      enableAlerts: options.enableAlerts !== false,
      enableBenchmarks: options.enableBenchmarks !== false,
      monitoringInterval: options.monitoringInterval || 10000, // 10 seconds
      healthCheckInterval: options.healthCheckInterval || 60000, // 1 minute
      reportGenerationInterval: options.reportGenerationInterval || 300000, // 5 minutes
      retainMetricsFor: options.retainMetricsFor || 24 * 60 * 60 * 1000, // 24 hours
      enablePredictiveAnalysis: options.enablePredictiveAnalysis || false
    };
    
    // Initialize monitoring components
    this.metricsCollector = new MetricsCollector({
      retentionPeriod: this.options.retainMetricsFor,
      enableRealTimeMetrics: this.options.enableRealTimeMonitoring,
      enableHistoricalMetrics: true
    });
    
    this.alertSystem = new AlertSystem({
      enableAlerts: this.options.enableAlerts,
      checkInterval: 30000, // 30 seconds
      enableLogNotifications: true
    });
    
    this.benchmarkRunner = new BenchmarkRunner({
      enableAutomaticBenchmarks: this.options.enableBenchmarks,
      benchmarkInterval: 3600000 // 1 hour
    });
    
    // 분할된 모듈 인스턴스
    this.monitoringEngine = new MonitoringEngine(this.options, {
      metricsCollector: this.metricsCollector,
      alertSystem: this.alertSystem,
      benchmarkRunner: this.benchmarkRunner
    });
    
    this.performanceReporter = new PerformanceReporter(this.options, {
      metricsCollector: this.metricsCollector,
      alertSystem: this.alertSystem,
      benchmarkRunner: this.benchmarkRunner
    });
    
    // Monitoring state
    this.isMonitoring = false;
    this.monitoringStartTime = null;
    this.lastHealthCheck = null;
    this.lastReport = null;
    
    // Timers
    this.monitoringTimer = null;
    this.healthCheckTimer = null;
    this.reportTimer = null;
    
    // Performance baselines
    this.baselines = {
      averageResponseTime: 500, // ms
      cacheHitRate: 80, // %
      errorRate: 1, // %
      throughput: 10 // queries/second
    };
    
    // Health status
    this.healthStatus = {
      overall: 'unknown',
      database: 'unknown',
      cache: 'unknown',
      monitoring: 'unknown',
      lastUpdated: null
    };
    
    console.log('PerformanceMonitor initialized with options:', this.options);
  }

  /**
   * Start comprehensive performance monitoring
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      console.warn('Performance monitoring is already running');
      return;
    }
    
    try {
      this.isMonitoring = true;
      this.monitoringStartTime = new Date();
      
      // Start monitoring intervals
      this.startMonitoringIntervals();
      
      // Perform initial health check
      await this.performHealthCheck();
      
      // Start monitoring engine
      await this.monitoringEngine.start();
      
      // Run initial benchmark
      if (this.options.enableBenchmarks) {
        setImmediate(async () => {
          try {
            await this.benchmarkRunner.runBenchmarkSuite('basic');
            console.log('Initial benchmark completed');
          } catch (error) {
            console.error('Initial benchmark failed:', error);
          }
        });
      }
      
      console.log('Performance monitoring started successfully');
      
    } catch (error) {
      this.isMonitoring = false;
      console.error('Failed to start performance monitoring:', error);
      throw error;
    }
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      console.warn('Performance monitoring is not running');
      return;
    }
    
    try {
      this.isMonitoring = false;
      
      // Stop monitoring intervals
      this.stopMonitoringIntervals();
      
      // Stop monitoring engine
      this.monitoringEngine.stop();
      
      console.log('Performance monitoring stopped');
      
    } catch (error) {
      console.error('Error stopping performance monitoring:', error);
      throw error;
    }
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck() {
    try {
      const healthData = {
        timestamp: new Date(),
        overall: 'healthy',
        database: 'unknown',
        cache: 'unknown',
        monitoring: 'healthy',
        details: {}
      };

      // Check database health through metrics
      const realTimeMetrics = await this.metricsCollector.getRealTimeMetrics();
      if (!realTimeMetrics) {
        healthData.database = 'unhealthy';
        healthData.overall = 'unhealthy';
        healthData.details.database = 'Unable to collect real-time metrics';
      } else {
        healthData.database = 'healthy';
        healthData.details.database = 'Real-time metrics available';
      }

      // Check for critical alerts
      const criticalAlerts = await this.alertSystem.getCriticalAlerts();
      if (criticalAlerts.length > 0) {
        healthData.overall = 'warning';
        healthData.details.alerts = `${criticalAlerts.length} critical alerts active`;
      }

      // Check performance trends
      const benchmarkStats = await this.benchmarkRunner.getLatestBenchmarkStats();
      if (benchmarkStats.performanceTrend === 'degrading') {
        healthData.overall = healthData.overall === 'healthy' ? 'warning' : 'unhealthy';
        healthData.details.performance = 'Performance degradation detected';
      }

      // Check error rates
      if (realTimeMetrics && realTimeMetrics.errorRate > 5) {
        healthData.overall = 'warning';
        healthData.details.errorRate = `High error rate: ${realTimeMetrics.errorRate}%`;
      }

      // Check response times
      if (realTimeMetrics && realTimeMetrics.averageResponseTime > 2000) {
        healthData.overall = 'warning';
        healthData.details.responseTime = `High response time: ${realTimeMetrics.averageResponseTime}ms`;
      }

      // Update health status
      this.healthStatus = {
        overall: healthData.overall,
        database: healthData.database,
        cache: healthData.cache,
        monitoring: healthData.monitoring,
        lastUpdated: healthData.timestamp,
        details: healthData.details
      };

      this.lastHealthCheck = healthData.timestamp;
      
      console.log(`Health check completed: ${healthData.overall}`);
      return healthData;

    } catch (error) {
      console.error('Health check failed:', error);
      
      this.healthStatus = {
        overall: 'unhealthy',
        database: 'unknown',
        cache: 'unknown',
        monitoring: 'unhealthy',
        lastUpdated: new Date(),
        details: { error: error.message }
      };
      
      throw error;
    }
  }

  /**
   * Start monitoring intervals
   */
  startMonitoringIntervals() {
    // Real-time monitoring interval
    this.monitoringTimer = setInterval(() => {
      this.monitoringEngine.collectRealTimeMetrics();
    }, this.options.monitoringInterval);

    // Health check interval
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.performHealthCheck();
        
        if (this.options.enableAlerts) {
          await this.alertSystem.checkThresholds();
        }
      } catch (error) {
        console.error('Scheduled health check failed:', error);
      }
    }, this.options.healthCheckInterval);

    // Report generation interval
    this.reportTimer = setInterval(async () => {
      try {
        const report = await this.performanceReporter.generatePerformanceReport('1h');
        this.lastReport = new Date();
        console.log('Scheduled performance report generated');
      } catch (error) {
        console.error('Scheduled report generation failed:', error);
      }
    }, this.options.reportGenerationInterval);
  }

  /**
   * Stop monitoring intervals
   */
  stopMonitoringIntervals() {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = null;
    }
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus() {
    return {
      isMonitoring: this.isMonitoring,
      startTime: this.monitoringStartTime,
      uptime: this.isMonitoring ? Date.now() - this.monitoringStartTime.getTime() : 0,
      lastHealthCheck: this.lastHealthCheck,
      lastReport: this.lastReport,
      healthStatus: this.healthStatus,
      options: this.options
    };
  }

  /**
   * Update performance baselines
   */
  updateBaselines(newBaselines) {
    this.baselines = {
      ...this.baselines,
      ...newBaselines
    };
    
    console.log('Performance baselines updated:', this.baselines);
  }

  /**
   * Get current baselines
   */
  getBaselines() {
    return { ...this.baselines };
  }

  /**
   * Record query execution (delegate to monitoring engine)
   */
  recordQueryExecution(queryData) {
    return this.monitoringEngine.recordQueryExecution(queryData);
  }

  /**
   * Record system metrics (delegate to monitoring engine)
   */
  recordSystemMetrics(systemData) {
    return this.monitoringEngine.recordSystemMetrics(systemData);
  }

  /**
   * Record error (delegate to monitoring engine)
   */
  recordError(errorData) {
    return this.monitoringEngine.recordError(errorData);
  }

  /**
   * Get performance dashboard (delegate to reporter)
   */
  async getPerformanceDashboard(timeRange = '1h') {
    return this.performanceReporter.getPerformanceDashboard(timeRange);
  }

  /**
   * Generate performance report (delegate to reporter)
   */
  async generatePerformanceReport(timeRange = '24h') {
    return this.performanceReporter.generatePerformanceReport(timeRange);
  }

  /**
   * Get system overview
   */
  getSystemOverview() {
    return {
      monitoring: this.getMonitoringStatus(),
      health: this.healthStatus,
      baselines: this.baselines,
      components: {
        metricsCollector: this.metricsCollector.getStatus ? this.metricsCollector.getStatus() : 'available',
        alertSystem: this.alertSystem.getStatus ? this.alertSystem.getStatus() : 'available',
        benchmarkRunner: this.benchmarkRunner.getStatus ? this.benchmarkRunner.getStatus() : 'available'
      }
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    try {
      this.stopMonitoring();
      
      // Cleanup components
      if (this.monitoringEngine && this.monitoringEngine.cleanup) {
        this.monitoringEngine.cleanup();
      }
      
      if (this.performanceReporter && this.performanceReporter.cleanup) {
        this.performanceReporter.cleanup();
      }
      
      console.log('PerformanceMonitor cleanup completed');
    } catch (error) {
      console.error('Error during PerformanceMonitor cleanup:', error);
    }
  }
}

module.exports = PerformanceMonitor;
