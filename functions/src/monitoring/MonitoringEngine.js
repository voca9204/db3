/**
 * MonitoringEngine.js
 * Real-time monitoring and data collection engine
 * 분할된 모듈: PerformanceMonitor.js의 모니터링 엔진 부분
 * 
 * 포함 기능:
 * - 실시간 데이터 수집
 * - 쿼리 실행 모니터링
 * - 시스템 메트릭 기록
 * - 에러 추적 및 알림
 */

class MonitoringEngine {
  constructor(options = {}, components = {}) {
    this.options = options;
    this.metricsCollector = components.metricsCollector;
    this.alertSystem = components.alertSystem;
    this.benchmarkRunner = components.benchmarkRunner;
    
    // Engine state
    this.isRunning = false;
    this.startTime = null;
    this.lastCollectionTime = null;
    
    // Collection counters
    this.counters = {
      queriesRecorded: 0,
      errorsRecorded: 0,
      systemMetricsRecorded: 0,
      alertsTriggered: 0
    };
    
    // Real-time thresholds
    this.thresholds = {
      slowQueryTime: 2000, // ms
      highErrorRate: 5, // %
      criticalResponseTime: 5000, // ms
      memoryUsageWarning: 80, // %
      cpuUsageWarning: 80 // %
    };
  }

  /**
   * Start monitoring engine
   */
  async start() {
    if (this.isRunning) {
      console.warn('MonitoringEngine is already running');
      return;
    }
    
    try {
      this.isRunning = true;
      this.startTime = new Date();
      this.lastCollectionTime = new Date();
      
      console.log('MonitoringEngine started successfully');
      
    } catch (error) {
      this.isRunning = false;
      console.error('Failed to start MonitoringEngine:', error);
      throw error;
    }
  }

  /**
   * Stop monitoring engine
   */
  stop() {
    if (!this.isRunning) {
      console.warn('MonitoringEngine is not running');
      return;
    }
    
    this.isRunning = false;
    console.log('MonitoringEngine stopped');
  }

  /**
   * Collect real-time metrics
   */
  async collectRealTimeMetrics() {
    if (!this.isRunning) return;
    
    try {
      // Collect system metrics
      const systemMetrics = await this.collectSystemMetrics();
      
      // Record system metrics
      if (systemMetrics) {
        this.recordSystemMetrics(systemMetrics);
      }
      
      // Check for threshold violations
      await this.checkRealTimeThresholds();
      
      this.lastCollectionTime = new Date();
      
    } catch (error) {
      console.error('Error collecting real-time metrics:', error);
    }
  }

  /**
   * Record query execution
   */
  recordQueryExecution(queryData) {
    if (!this.isRunning) return null;
    
    try {
      // Validate required fields
      if (!queryData || typeof queryData !== 'object') {
        console.warn('Invalid query data provided');
        return null;
      }
      
      // Ensure required fields
      const normalizedData = {
        timestamp: queryData.timestamp || new Date(),
        sql: queryData.sql || queryData.query || 'unknown',
        executionTime: queryData.executionTime || queryData.duration || 0,
        type: queryData.type || 'query',
        success: queryData.success !== false,
        rowsAffected: queryData.rowsAffected || 0,
        ...queryData
      };
      
      // Record in metrics collector
      const metric = this.metricsCollector.recordQueryMetric(normalizedData);
      
      // Check for slow query alerts
      if (this.options.enableAlerts && normalizedData.executionTime > this.thresholds.slowQueryTime) {
        this.triggerSlowQueryAlert(normalizedData);
      }
      
      // Check for critical response time
      if (normalizedData.executionTime > this.thresholds.criticalResponseTime) {
        this.triggerCriticalResponseTimeAlert(normalizedData);
      }
      
      this.counters.queriesRecorded++;
      return metric;
      
    } catch (error) {
      console.error('Error recording query execution:', error);
      return null;
    }
  }

  /**
   * Record system metrics
   */
  recordSystemMetrics(systemData) {
    if (!this.isRunning) return null;
    
    try {
      // Validate and normalize system data
      const normalizedData = {
        timestamp: systemData.timestamp || new Date(),
        memoryUsage: systemData.memoryUsage || process.memoryUsage(),
        cpuUsage: systemData.cpuUsage || 0,
        uptime: systemData.uptime || process.uptime(),
        connectionCount: systemData.connectionCount || 0,
        cacheHitRate: systemData.cacheHitRate || 0,
        ...systemData
      };
      
      // Record in metrics collector
      const metric = this.metricsCollector.recordSystemMetric(normalizedData);
      
      // Check for system alerts
      this.checkSystemAlerts(normalizedData);
      
      this.counters.systemMetricsRecorded++;
      return metric;
      
    } catch (error) {
      console.error('Error recording system metrics:', error);
      return null;
    }
  }

  /**
   * Record error for monitoring
   */
  recordError(errorData) {
    if (!this.isRunning) return null;
    
    try {
      // Validate and normalize error data
      const normalizedData = {
        timestamp: errorData.timestamp || new Date(),
        message: errorData.message || 'Unknown error',
        type: errorData.type || 'GENERAL_ERROR',
        severity: errorData.severity || 'medium',
        stack: errorData.stack || '',
        context: errorData.context || {},
        ...errorData
      };
      
      // Record in metrics collector
      const metric = this.metricsCollector.recordErrorMetric(normalizedData);
      
      // Create immediate alert for critical errors
      if (normalizedData.severity === 'critical' || 
          normalizedData.type === 'DATABASE_CONNECTION_FAILURE') {
        this.triggerCriticalErrorAlert(normalizedData);
      }
      
      this.counters.errorsRecorded++;
      return metric;
      
    } catch (error) {
      console.error('Error recording error metric:', error);
      return null;
    }
  }

  /**
   * Collect system metrics
   */
  async collectSystemMetrics() {
    try {
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();
      
      // Get additional system info if available
      let cpuUsage = 0;
      try {
        // Simple CPU usage calculation
        const startUsage = process.cpuUsage();
        await new Promise(resolve => setTimeout(resolve, 100));
        const endUsage = process.cpuUsage(startUsage);
        cpuUsage = Math.round((endUsage.user + endUsage.system) / 1000); // Convert to ms
      } catch (cpuError) {
        // CPU usage not available
      }
      
      return {
        timestamp: new Date(),
        memoryUsage: {
          rss: memoryUsage.rss,
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external,
          usagePercent: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
        },
        cpuUsage,
        uptime,
        nodeVersion: process.version,
        platform: process.platform
      };
      
    } catch (error) {
      console.error('Error collecting system metrics:', error);
      return null;
    }
  }

  /**
   * Check real-time thresholds
   */
  async checkRealTimeThresholds() {
    try {
      const realTimeMetrics = await this.metricsCollector.getRealTimeMetrics();
      
      if (!realTimeMetrics) return;
      
      // Check error rate
      if (realTimeMetrics.errorRate > this.thresholds.highErrorRate) {
        this.triggerHighErrorRateAlert(realTimeMetrics);
      }
      
      // Check average response time
      if (realTimeMetrics.averageResponseTime > this.thresholds.slowQueryTime) {
        this.triggerHighResponseTimeAlert(realTimeMetrics);
      }
      
    } catch (error) {
      console.error('Error checking real-time thresholds:', error);
    }
  }

  /**
   * Check system alerts
   */
  checkSystemAlerts(systemData) {
    try {
      // Memory usage alert
      if (systemData.memoryUsage && 
          systemData.memoryUsage.usagePercent > this.thresholds.memoryUsageWarning) {
        this.triggerMemoryAlert(systemData);
      }
      
      // CPU usage alert (if available)
      if (systemData.cpuUsage > this.thresholds.cpuUsageWarning) {
        this.triggerCpuAlert(systemData);
      }
      
    } catch (error) {
      console.error('Error checking system alerts:', error);
    }
  }

  /**
   * Trigger slow query alert
   */
  triggerSlowQueryAlert(queryData) {
    try {
      this.alertSystem.createAlert('SLOW_QUERY', {
        message: `Slow query detected: ${queryData.executionTime}ms`,
        details: {
          sql: queryData.sql?.substring(0, 200) + (queryData.sql?.length > 200 ? '...' : ''),
          executionTime: queryData.executionTime,
          timestamp: queryData.timestamp
        },
        severity: 'medium',
        type: 'performance'
      });
      
      this.counters.alertsTriggered++;
      
    } catch (error) {
      console.error('Error triggering slow query alert:', error);
    }
  }

  /**
   * Trigger critical response time alert
   */
  triggerCriticalResponseTimeAlert(queryData) {
    try {
      this.alertSystem.createAlert('CRITICAL_RESPONSE_TIME', {
        message: `Critical response time: ${queryData.executionTime}ms`,
        details: {
          sql: queryData.sql?.substring(0, 200) + (queryData.sql?.length > 200 ? '...' : ''),
          executionTime: queryData.executionTime,
          timestamp: queryData.timestamp
        },
        severity: 'high',
        type: 'performance'
      });
      
      this.counters.alertsTriggered++;
      
    } catch (error) {
      console.error('Error triggering critical response time alert:', error);
    }
  }

  /**
   * Trigger critical error alert
   */
  triggerCriticalErrorAlert(errorData) {
    try {
      this.alertSystem.createAlert(errorData.type || 'CRITICAL_ERROR', {
        message: errorData.message,
        details: errorData,
        severity: 'critical',
        type: 'error'
      });
      
      this.counters.alertsTriggered++;
      
    } catch (error) {
      console.error('Error triggering critical error alert:', error);
    }
  }

  /**
   * Trigger high error rate alert
   */
  triggerHighErrorRateAlert(metrics) {
    try {
      this.alertSystem.createAlert('HIGH_ERROR_RATE', {
        message: `High error rate detected: ${metrics.errorRate}%`,
        details: {
          errorRate: metrics.errorRate,
          errorCount: metrics.errorCount,
          totalQueries: metrics.totalQueries,
          timeWindow: metrics.timeWindow
        },
        severity: 'high',
        type: 'reliability'
      });
      
      this.counters.alertsTriggered++;
      
    } catch (error) {
      console.error('Error triggering high error rate alert:', error);
    }
  }

  /**
   * Trigger high response time alert
   */
  triggerHighResponseTimeAlert(metrics) {
    try {
      this.alertSystem.createAlert('HIGH_RESPONSE_TIME', {
        message: `High average response time: ${metrics.averageResponseTime}ms`,
        details: {
          averageResponseTime: metrics.averageResponseTime,
          queryCount: metrics.queryCount,
          timeWindow: metrics.timeWindow
        },
        severity: 'medium',
        type: 'performance'
      });
      
      this.counters.alertsTriggered++;
      
    } catch (error) {
      console.error('Error triggering high response time alert:', error);
    }
  }

  /**
   * Trigger memory alert
   */
  triggerMemoryAlert(systemData) {
    try {
      this.alertSystem.createAlert('HIGH_MEMORY_USAGE', {
        message: `High memory usage: ${systemData.memoryUsage.usagePercent}%`,
        details: {
          usagePercent: systemData.memoryUsage.usagePercent,
          heapUsed: systemData.memoryUsage.heapUsed,
          heapTotal: systemData.memoryUsage.heapTotal,
          timestamp: systemData.timestamp
        },
        severity: 'medium',
        type: 'resource'
      });
      
      this.counters.alertsTriggered++;
      
    } catch (error) {
      console.error('Error triggering memory alert:', error);
    }
  }

  /**
   * Trigger CPU alert
   */
  triggerCpuAlert(systemData) {
    try {
      this.alertSystem.createAlert('HIGH_CPU_USAGE', {
        message: `High CPU usage detected: ${systemData.cpuUsage}ms`,
        details: {
          cpuUsage: systemData.cpuUsage,
          timestamp: systemData.timestamp
        },
        severity: 'medium',
        type: 'resource'
      });
      
      this.counters.alertsTriggered++;
      
    } catch (error) {
      console.error('Error triggering CPU alert:', error);
    }
  }

  /**
   * Update thresholds
   */
  updateThresholds(newThresholds) {
    this.thresholds = {
      ...this.thresholds,
      ...newThresholds
    };
    
    console.log('MonitoringEngine thresholds updated:', this.thresholds);
  }

  /**
   * Get engine status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      startTime: this.startTime,
      uptime: this.isRunning ? Date.now() - this.startTime.getTime() : 0,
      lastCollectionTime: this.lastCollectionTime,
      counters: { ...this.counters },
      thresholds: { ...this.thresholds }
    };
  }

  /**
   * Get engine statistics
   */
  getStatistics() {
    const status = this.getStatus();
    const uptime = status.uptime;
    
    return {
      ...status,
      rates: {
        queriesPerSecond: uptime > 0 ? (this.counters.queriesRecorded / (uptime / 1000)).toFixed(2) : 0,
        errorsPerSecond: uptime > 0 ? (this.counters.errorsRecorded / (uptime / 1000)).toFixed(2) : 0,
        alertsPerSecond: uptime > 0 ? (this.counters.alertsTriggered / (uptime / 1000)).toFixed(2) : 0
      }
    };
  }

  /**
   * Reset counters
   */
  resetCounters() {
    this.counters = {
      queriesRecorded: 0,
      errorsRecorded: 0,
      systemMetricsRecorded: 0,
      alertsTriggered: 0
    };
    
    console.log('MonitoringEngine counters reset');
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    try {
      this.stop();
      this.resetCounters();
      
      console.log('MonitoringEngine cleanup completed');
    } catch (error) {
      console.error('Error during MonitoringEngine cleanup:', error);
    }
  }
}

module.exports = MonitoringEngine;
