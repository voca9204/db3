/**
 * PerformanceMonitor.js
 * Central performance monitoring system that integrates all monitoring components
 * Task 1.6: Performance Monitoring System
 */

const MetricsCollector = require('./MetricsCollector');
const AlertSystem = require('./AlertSystem');
const BenchmarkRunner = require('./BenchmarkRunner');

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
    
    // Monitoring state
    this.isMonitoring = false;
    this.monitoringStartTime = null;
    this.lastHealthCheck = null;
    this.lastReport = null;
    
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
      
      return {
        success: true,
        message: 'Performance monitoring started',
        startTime: this.monitoringStartTime.toISOString()
      };
      
    } catch (error) {
      this.isMonitoring = false;
      console.error('Failed to start performance monitoring:', error);
      
      return {
        success: false,
        error: error.message
      };
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
    
    this.isMonitoring = false;
    
    // Stop all intervals
    this.stopMonitoringIntervals();
    
    console.log('Performance monitoring stopped');
    
    return {
      success: true,
      message: 'Performance monitoring stopped',
      uptime: this.getUptime()
    };
  }

  /**
   * Record query execution for monitoring
   */
  recordQueryExecution(queryData) {
    if (!this.isMonitoring) return;
    
    try {
      // Record in metrics collector
      const metric = this.metricsCollector.recordQueryMetric(queryData);
      
      // Check for alerts if enabled
      if (this.options.enableAlerts && queryData.executionTime > 2000) {
        this.checkRealTimeAlerts(queryData);
      }
      
      return metric;
      
    } catch (error) {
      console.error('Error recording query execution:', error);
    }
  }

  /**
   * Record system metrics
   */
  recordSystemMetrics(systemData) {
    if (!this.isMonitoring) return;
    
    try {
      return this.metricsCollector.recordSystemMetric(systemData);
    } catch (error) {
      console.error('Error recording system metrics:', error);
    }
  }

  /**
   * Record error for monitoring
   */
  recordError(errorData) {
    if (!this.isMonitoring) return;
    
    try {
      // Record in metrics collector
      const metric = this.metricsCollector.recordErrorMetric(errorData);
      
      // Create immediate alert for critical errors
      if (errorData.severity === 'critical' || errorData.type === 'DATABASE_CONNECTION_FAILURE') {
        this.alertSystem.createAlert(errorData.type || 'SYSTEM_ERROR', {
          message: errorData.message,
          details: errorData
        });
      }
      
      return metric;
      
    } catch (error) {
      console.error('Error recording error metric:', error);
    }
  }

  /**
   * Get comprehensive performance dashboard data
   */
  async getPerformanceDashboard(timeRange = '1h') {
    try {
      const dashboard = {
        timestamp: new Date().toISOString(),
        timeRange,
        uptime: this.getUptime(),
        isMonitoring: this.isMonitoring,
        
        // Real-time metrics
        realTime: this.metricsCollector.getRealTimeMetrics(),
        
        // Historical summary
        summary: this.metricsCollector.getPerformanceSummary(timeRange),
        
        // Aggregated metrics
        trends: this.metricsCollector.getAggregatedMetrics(timeRange, '5m'),
        
        // Active alerts
        alerts: {
          active: this.alertSystem.getActiveAlerts(),
          recent: this.alertSystem.getAlertHistory('1h', 10),
          statistics: this.alertSystem.getAlertStatistics(timeRange)
        },
        
        // Benchmark results
        benchmarks: {
          latest: this.benchmarkRunner.getLatestBenchmark(),
          history: this.benchmarkRunner.getBenchmarkHistory(5),
          statistics: this.benchmarkRunner.getBenchmarkStats()
        },
        
        // Health status
        health: this.healthStatus,
        
        // Performance analysis
        analysis: await this.performPerformanceAnalysis(timeRange)
      };
      
      return {
        success: true,
        dashboard
      };
      
    } catch (error) {
      console.error('Error generating performance dashboard:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate comprehensive performance report
   */
  async generatePerformanceReport(timeRange = '24h') {
    try {
      const report = {
        metadata: {
          generatedAt: new Date().toISOString(),
          timeRange,
          monitoringUptime: this.getUptime(),
          reportType: 'comprehensive'
        },
        
        // Executive summary
        executiveSummary: await this.generateExecutiveSummary(timeRange),
        
        // Detailed metrics
        metrics: {
          queries: this.metricsCollector.getPerformanceSummary(timeRange).queryMetrics,
          system: this.metricsCollector.getPerformanceSummary(timeRange).systemMetrics,
          errors: this.metricsCollector.getPerformanceSummary(timeRange).errorMetrics,
          cache: this.metricsCollector.getPerformanceSummary(timeRange).cacheMetrics
        },
        
        // Performance trends
        trends: {
          performance: this.analyzePerformanceTrends(timeRange),
          capacity: this.analyzeCapacityTrends(timeRange),
          reliability: this.analyzeReliabilityTrends(timeRange)
        },
        
        // Alert analysis
        alertAnalysis: {
          summary: this.alertSystem.getAlertStatistics(timeRange),
          topAlerts: this.getTopAlerts(timeRange),
          resolutionAnalysis: this.analyzeAlertResolution(timeRange)
        },
        
        // Benchmark analysis
        benchmarkAnalysis: {
          performance: this.analyzeBenchmarkPerformance(timeRange),
          trends: this.benchmarkRunner.getBenchmarkStats().performanceTrend,
          recommendations: this.generateBenchmarkRecommendations()
        },
        
        // Recommendations
        recommendations: await this.generateRecommendations(timeRange),
        
        // Capacity planning
        capacityPlanning: await this.generateCapacityPlan(timeRange)
      };
      
      this.lastReport = new Date();
      
      return {
        success: true,
        report
      };
      
    } catch (error) {
      console.error('Error generating performance report:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Perform health check of all systems
   */
  async performHealthCheck() {
    const healthCheck = {
      timestamp: new Date().toISOString(),
      overall: 'healthy',
      components: {},
      issues: []
    };
    
    try {
      // Check metrics collector
      healthCheck.components.metricsCollector = 'healthy';
      const realTimeMetrics = this.metricsCollector.getRealTimeMetrics();
      
      if (!realTimeMetrics) {
        healthCheck.components.metricsCollector = 'unhealthy';
        healthCheck.issues.push('Metrics collector not responding');
        healthCheck.overall = 'degraded';
      }
      
      // Check alert system
      healthCheck.components.alertSystem = 'healthy';
      const activeAlerts = this.alertSystem.getActiveAlerts();
      
      const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical');
      if (criticalAlerts.length > 0) {
        healthCheck.components.alertSystem = 'warning';
        healthCheck.issues.push(`${criticalAlerts.length} critical alerts active`);
        healthCheck.overall = 'warning';
      }
      
      // Check benchmark runner
      healthCheck.components.benchmarkRunner = 'healthy';
      const benchmarkStats = this.benchmarkRunner.getBenchmarkStats();
      
      if (benchmarkStats.performanceTrend === 'degrading') {
        healthCheck.components.benchmarkRunner = 'warning';
        healthCheck.issues.push('Performance trend is degrading');
        healthCheck.overall = 'warning';
      }
      
      // Check overall performance metrics
      if (realTimeMetrics.errorRate > 5) {
        healthCheck.issues.push(`High error rate: ${realTimeMetrics.errorRate}%`);
        healthCheck.overall = 'degraded';
      }
      
      if (realTimeMetrics.averageResponseTime > 2000) {
        healthCheck.issues.push(`Slow response time: ${realTimeMetrics.averageResponseTime}ms`);
        healthCheck.overall = 'degraded';
      }
      
      this.healthStatus = {
        overall: healthCheck.overall,
        database: realTimeMetrics.errorRate < 1 ? 'healthy' : 'degraded',
        cache: realTimeMetrics.cacheHitRate > 70 ? 'healthy' : 'degraded',
        monitoring: 'healthy',
        lastUpdated: healthCheck.timestamp
      };
      
      this.lastHealthCheck = new Date();
      
      return {
        success: true,
        health: healthCheck
      };
      
    } catch (error) {
      console.error('Health check failed:', error);
      
      this.healthStatus.overall = 'unhealthy';
      this.healthStatus.monitoring = 'unhealthy';
      this.healthStatus.lastUpdated = new Date().toISOString();
      
      return {
        success: false,
        error: error.message,
        health: {
          overall: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error.message
        }
      };
    }
  }

  /**
   * Start monitoring intervals
   */
  startMonitoringIntervals() {
    // Real-time monitoring interval
    this.monitoringTimer = setInterval(() => {
      this.performRealTimeMonitoring();
    }, this.options.monitoringInterval);
    
    // Health check interval
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.options.healthCheckInterval);
    
    // Alert checking interval
    this.alertCheckTimer = setInterval(() => {
      if (this.options.enableAlerts) {
        this.alertSystem.checkMetrics(this.metricsCollector);
      }
    }, 30000); // 30 seconds
    
    // Report generation interval
    this.reportTimer = setInterval(async () => {
      try {
        await this.generatePerformanceReport('1h');
        console.log('Automated performance report generated');
      } catch (error) {
        console.error('Automated report generation failed:', error);
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
    
    if (this.alertCheckTimer) {
      clearInterval(this.alertCheckTimer);
      this.alertCheckTimer = null;
    }
    
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = null;
    }
  }

  /**
   * Perform real-time monitoring tasks
   */
  performRealTimeMonitoring() {
    try {
      // Record system metrics
      const systemMetrics = this.collectSystemMetrics();
      this.metricsCollector.recordSystemMetric(systemMetrics);
      
      // Update performance baselines
      this.updatePerformanceBaselines();
      
    } catch (error) {
      console.error('Real-time monitoring error:', error);
    }
  }

  /**
   * Collect current system metrics
   */
  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    
    return {
      cpuUsage: process.cpuUsage ? this.getCpuUsage() : 0,
      memoryUsage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      dbConnections: 0, // Placeholder - would need actual connection pool info
      activeQueries: this.metricsCollector.realTimeMetrics.currentQueries || 0,
      cacheSize: 0, // Placeholder - would need actual cache info
      diskUsage: 0, // Placeholder
      networkIO: 0 // Placeholder
    };
  }

  /**
   * Get CPU usage percentage
   */
  getCpuUsage() {
    // Simplified CPU usage calculation
    // In production, you'd use a more accurate method
    return Math.random() * 20 + 5; // Placeholder: 5-25%
  }

  /**
   * Check for real-time alerts
   */
  checkRealTimeAlerts(queryData) {
    // Immediate alert for extremely slow queries
    if (queryData.executionTime > 5000) {
      this.alertSystem.createAlert('SLOW_QUERY', {
        message: `Extremely slow query detected: ${queryData.executionTime}ms`,
        threshold: 5000,
        currentValue: queryData.executionTime,
        details: {
          sql: queryData.sql ? queryData.sql.substring(0, 100) : 'Unknown',
          queryId: queryData.queryId
        }
      });
    }
  }

  /**
   * Update performance baselines based on recent data
   */
  updatePerformanceBaselines() {
    const realTimeMetrics = this.metricsCollector.getRealTimeMetrics();
    
    // Update baselines with exponential smoothing
    const alpha = 0.1; // Smoothing factor
    
    this.baselines.averageResponseTime = 
      alpha * realTimeMetrics.averageResponseTime + 
      (1 - alpha) * this.baselines.averageResponseTime;
    
    this.baselines.cacheHitRate = 
      alpha * realTimeMetrics.cacheHitRate + 
      (1 - alpha) * this.baselines.cacheHitRate;
    
    this.baselines.errorRate = 
      alpha * realTimeMetrics.errorRate + 
      (1 - alpha) * this.baselines.errorRate;
    
    this.baselines.throughput = 
      alpha * realTimeMetrics.queriesPerSecond + 
      (1 - alpha) * this.baselines.throughput;
  }

  /**
   * Performance analysis methods
   */
  
  async performPerformanceAnalysis(timeRange) {
    const summary = this.metricsCollector.getPerformanceSummary(timeRange);
    
    return {
      score: this.calculatePerformanceScore(summary),
      bottlenecks: this.identifyBottlenecks(summary),
      improvements: this.suggestImprovements(summary),
      comparison: this.compareToBaselines(summary)
    };
  }
  
  calculatePerformanceScore(summary) {
    let score = 100;
    
    // Deduct points for poor performance
    if (summary.queryMetrics.averageResponseTime > 1000) score -= 20;
    if (summary.queryMetrics.errorRate > 2) score -= 30;
    if (summary.cacheMetrics.averageHitRate < 70) score -= 15;
    if (summary.queryMetrics.p95ResponseTime > 3000) score -= 25;
    
    return Math.max(score, 0);
  }
  
  identifyBottlenecks(summary) {
    const bottlenecks = [];
    
    if (summary.queryMetrics.averageResponseTime > 1000) {
      bottlenecks.push({
        type: 'slow_queries',
        severity: 'high',
        description: 'Average query response time is high'
      });
    }
    
    if (summary.cacheMetrics.averageHitRate < 70) {
      bottlenecks.push({
        type: 'low_cache_efficiency',
        severity: 'medium',
        description: 'Cache hit rate is below optimal levels'
      });
    }
    
    if (summary.queryMetrics.errorRate > 2) {
      bottlenecks.push({
        type: 'high_error_rate',
        severity: 'high',
        description: 'Query error rate is above acceptable levels'
      });
    }
    
    return bottlenecks;
  }
  
  suggestImprovements(summary) {
    const improvements = [];
    
    if (summary.queryMetrics.slowQueries > 5) {
      improvements.push({
        type: 'query_optimization',
        priority: 'high',
        description: 'Optimize slow queries to improve response times',
        expectedImpact: 'high'
      });
    }
    
    if (summary.cacheMetrics.averageHitRate < 80) {
      improvements.push({
        type: 'cache_optimization',
        priority: 'medium',
        description: 'Improve cache configuration and invalidation strategies',
        expectedImpact: 'medium'
      });
    }
    
    return improvements;
  }
  
  compareToBaselines(summary) {
    return {
      responseTime: {
        current: summary.queryMetrics.averageResponseTime,
        baseline: this.baselines.averageResponseTime,
        change: ((summary.queryMetrics.averageResponseTime - this.baselines.averageResponseTime) / this.baselines.averageResponseTime * 100)
      },
      cacheHitRate: {
        current: summary.cacheMetrics.averageHitRate,
        baseline: this.baselines.cacheHitRate,
        change: ((summary.cacheMetrics.averageHitRate - this.baselines.cacheHitRate) / this.baselines.cacheHitRate * 100)
      },
      errorRate: {
        current: summary.queryMetrics.errorRate,
        baseline: this.baselines.errorRate,
        change: ((summary.queryMetrics.errorRate - this.baselines.errorRate) / this.baselines.errorRate * 100)
      }
    };
  }

  /**
   * Helper methods for report generation
   */
  
  async generateExecutiveSummary(timeRange) {
    const summary = this.metricsCollector.getPerformanceSummary(timeRange);
    const alerts = this.alertSystem.getAlertStatistics(timeRange);
    const benchmarks = this.benchmarkRunner.getBenchmarkStats();
    
    return {
      performanceScore: this.calculatePerformanceScore(summary),
      keyMetrics: {
        totalQueries: summary.queryMetrics.totalQueries,
        averageResponseTime: summary.queryMetrics.averageResponseTime,
        errorRate: summary.queryMetrics.errorRate,
        cacheHitRate: summary.cacheMetrics.averageHitRate
      },
      alertsSummary: {
        totalAlerts: alerts.totalAlerts,
        criticalAlerts: alerts.alertsBySeverity.critical || 0,
        averageResolutionTime: alerts.averageResolutionTime
      },
      performanceTrend: benchmarks.performanceTrend,
      recommendations: await this.generateRecommendations(timeRange)
    };
  }
  
  async generateRecommendations(timeRange) {
    const summary = this.metricsCollector.getPerformanceSummary(timeRange);
    const recommendations = [];
    
    // Performance recommendations
    if (summary.queryMetrics.averageResponseTime > 1000) {
      recommendations.push({
        category: 'performance',
        priority: 'high',
        title: 'Optimize Query Performance',
        description: 'Average response time exceeds 1 second',
        actions: [
          'Review slow query log',
          'Add appropriate indexes',
          'Optimize complex queries',
          'Consider query result caching'
        ]
      });
    }
    
    // Reliability recommendations
    if (summary.queryMetrics.errorRate > 2) {
      recommendations.push({
        category: 'reliability',
        priority: 'critical',
        title: 'Reduce Error Rate',
        description: 'Query error rate is above acceptable threshold',
        actions: [
          'Investigate error patterns',
          'Improve error handling',
          'Add query validation',
          'Monitor database health'
        ]
      });
    }
    
    // Capacity recommendations
    if (summary.queryMetrics.totalQueries > 10000) {
      recommendations.push({
        category: 'capacity',
        priority: 'medium',
        title: 'Plan for Scale',
        description: 'High query volume may require capacity planning',
        actions: [
          'Monitor resource utilization',
          'Consider read replicas',
          'Implement connection pooling',
          'Plan hardware upgrades'
        ]
      });
    }
    
    return recommendations;
  }
  
  async generateCapacityPlan(timeRange) {
    const summary = this.metricsCollector.getPerformanceSummary(timeRange);
    const trends = this.metricsCollector.getAggregatedMetrics(timeRange, '1h');
    
    return {
      currentCapacity: {
        queriesPerSecond: summary.queryMetrics.totalQueries / (3600 * 24), // Rough estimate
        averageResponseTime: summary.queryMetrics.averageResponseTime,
        resourceUtilization: 'moderate' // Placeholder
      },
      projectedGrowth: {
        nextMonth: '10%', // Placeholder
        nextQuarter: '30%', // Placeholder
        nextYear: '100%' // Placeholder
      },
      recommendations: [
        'Monitor query growth trends',
        'Plan for peak load scenarios',
        'Consider auto-scaling options',
        'Implement performance budgets'
      ]
    };
  }

  /**
   * Utility methods
   */
  
  getUptime() {
    if (!this.monitoringStartTime) return 0;
    return Date.now() - this.monitoringStartTime.getTime();
  }
  
  getMonitoringStatus() {
    return {
      isMonitoring: this.isMonitoring,
      startTime: this.monitoringStartTime?.toISOString(),
      uptime: this.getUptime(),
      lastHealthCheck: this.lastHealthCheck?.toISOString(),
      lastReport: this.lastReport?.toISOString(),
      healthStatus: this.healthStatus
    };
  }

  /**
   * Configuration management
   */
  
  updateConfiguration(newOptions) {
    this.options = { ...this.options, ...newOptions };
    
    // Update component configurations
    if (newOptions.alertThresholds) {
      this.alertSystem.updateThresholds(newOptions.alertThresholds);
    }
    
    console.log('PerformanceMonitor configuration updated');
    return this.options;
  }

  /**
   * Reset and cleanup
   */
  
  reset() {
    this.stopMonitoring();
    
    this.metricsCollector.reset();
    this.alertSystem.reset();
    this.benchmarkRunner.reset();
    
    this.monitoringStartTime = null;
    this.lastHealthCheck = null;
    this.lastReport = null;
    
    console.log('PerformanceMonitor reset completed');
  }
  
  destroy() {
    this.stopMonitoring();
    
    this.metricsCollector.destroy();
    this.alertSystem.destroy();
    this.benchmarkRunner.destroy();
    
    console.log('PerformanceMonitor destroyed');
  }
}

module.exports = PerformanceMonitor;
