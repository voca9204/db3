/**
 * AlertSystem.js
 * Performance monitoring alert system with configurable thresholds and notification channels
 * Task 1.6: Performance Monitoring System
 */

class AlertSystem {
  constructor(options = {}) {
    this.options = {
      enableAlerts: options.enableAlerts !== false,
      checkInterval: options.checkInterval || 30000, // 30 seconds
      alertCooldown: options.alertCooldown || 300000, // 5 minutes
      maxAlertsPerHour: options.maxAlertsPerHour || 20,
      enableEmailNotifications: options.enableEmailNotifications || false,
      enableWebhookNotifications: options.enableWebhookNotifications || false,
      enableLogNotifications: options.enableLogNotifications !== false
    };
    
    // Alert thresholds
    this.thresholds = {
      slowQueryThreshold: options.slowQueryThreshold || 2000, // 2 seconds
      errorRateThreshold: options.errorRateThreshold || 5, // 5%
      cacheHitRateThreshold: options.cacheHitRateThreshold || 80, // 80%
      queriesPerSecondThreshold: options.queriesPerSecondThreshold || 100,
      cpuUsageThreshold: options.cpuUsageThreshold || 80, // 80%
      memoryUsageThreshold: options.memoryUsageThreshold || 85, // 85%
      responseTimeThreshold: options.responseTimeThreshold || 1000, // 1 second
      activeConnectionsThreshold: options.activeConnectionsThreshold || 50
    };
    
    // Alert state tracking
    this.alertState = {
      activeAlerts: new Map(),
      alertHistory: [],
      lastAlertTimes: new Map(),
      alertCounts: new Map(),
      suppressedAlerts: new Set()
    };
    
    // Alert types
    this.alertTypes = {
      SLOW_QUERY: { severity: 'medium', category: 'performance' },
      HIGH_ERROR_RATE: { severity: 'high', category: 'reliability' },
      LOW_CACHE_HIT_RATE: { severity: 'medium', category: 'performance' },
      HIGH_QPS: { severity: 'medium', category: 'load' },
      HIGH_CPU_USAGE: { severity: 'high', category: 'system' },
      HIGH_MEMORY_USAGE: { severity: 'high', category: 'system' },
      SLOW_RESPONSE_TIME: { severity: 'medium', category: 'performance' },
      HIGH_CONNECTIONS: { severity: 'medium', category: 'resources' },
      SYSTEM_ERROR: { severity: 'high', category: 'system' },
      CACHE_FAILURE: { severity: 'medium', category: 'cache' },
      DATABASE_CONNECTION_FAILURE: { severity: 'critical', category: 'database' }
    };
    
    // Start monitoring if enabled
    if (this.options.enableAlerts) {
      this.startMonitoring();
    }
    
    console.log('AlertSystem initialized with thresholds:', this.thresholds);
  }

  /**
   * Check metrics against thresholds and trigger alerts
   */
  checkMetrics(metricsCollector) {
    if (!this.options.enableAlerts) return;
    
    try {
      const realTimeMetrics = metricsCollector.getRealTimeMetrics();
      const summary = metricsCollector.getPerformanceSummary('15m');
      
      // Check query performance alerts
      this.checkQueryPerformanceAlerts(realTimeMetrics, summary);
      
      // Check system performance alerts
      this.checkSystemPerformanceAlerts(realTimeMetrics, summary);
      
      // Check error rate alerts
      this.checkErrorRateAlerts(realTimeMetrics, summary);
      
      // Check cache performance alerts
      this.checkCachePerformanceAlerts(realTimeMetrics, summary);
      
      // Clean up resolved alerts
      this.cleanupResolvedAlerts(realTimeMetrics, summary);
      
    } catch (error) {
      console.error('Error checking metrics for alerts:', error);
      this.createAlert('SYSTEM_ERROR', {
        message: `Alert system error: ${error.message}`,
        details: { error: error.message, stack: error.stack }
      });
    }
  }

  /**
   * Check query performance related alerts
   */
  checkQueryPerformanceAlerts(realTimeMetrics, summary) {
    // Slow query alert
    if (realTimeMetrics.averageResponseTime > this.thresholds.slowQueryThreshold) {
      this.createAlert('SLOW_QUERY', {
        message: `Average response time is ${realTimeMetrics.averageResponseTime}ms`,
        threshold: this.thresholds.slowQueryThreshold,
        currentValue: realTimeMetrics.averageResponseTime,
        details: {
          p95ResponseTime: summary.queryMetrics.p95ResponseTime,
          slowQueries: summary.queryMetrics.slowQueries
        }
      });
    }
    
    // High response time alert
    if (summary.queryMetrics.p95ResponseTime > this.thresholds.responseTimeThreshold * 2) {
      this.createAlert('SLOW_RESPONSE_TIME', {
        message: `95th percentile response time is ${summary.queryMetrics.p95ResponseTime}ms`,
        threshold: this.thresholds.responseTimeThreshold * 2,
        currentValue: summary.queryMetrics.p95ResponseTime,
        details: {
          averageResponseTime: summary.queryMetrics.averageResponseTime,
          totalQueries: summary.queryMetrics.totalQueries
        }
      });
    }
    
    // High queries per second alert
    if (realTimeMetrics.queriesPerSecond > this.thresholds.queriesPerSecondThreshold) {
      this.createAlert('HIGH_QPS', {
        message: `High query rate: ${realTimeMetrics.queriesPerSecond} queries/second`,
        threshold: this.thresholds.queriesPerSecondThreshold,
        currentValue: realTimeMetrics.queriesPerSecond,
        details: {
          totalQueries: summary.queryMetrics.totalQueries
        }
      });
    }
  }

  /**
   * Check system performance related alerts
   */
  checkSystemPerformanceAlerts(realTimeMetrics, summary) {
    // CPU usage alert
    if (summary.systemMetrics.averageCpuUsage > this.thresholds.cpuUsageThreshold) {
      this.createAlert('HIGH_CPU_USAGE', {
        message: `High CPU usage: ${summary.systemMetrics.averageCpuUsage}%`,
        threshold: this.thresholds.cpuUsageThreshold,
        currentValue: summary.systemMetrics.averageCpuUsage,
        details: {
          averageMemoryUsage: summary.systemMetrics.averageMemoryUsage
        }
      });
    }
    
    // Memory usage alert
    if (summary.systemMetrics.averageMemoryUsage > this.thresholds.memoryUsageThreshold) {
      this.createAlert('HIGH_MEMORY_USAGE', {
        message: `High memory usage: ${summary.systemMetrics.averageMemoryUsage}%`,
        threshold: this.thresholds.memoryUsageThreshold,
        currentValue: summary.systemMetrics.averageMemoryUsage,
        details: {
          averageCpuUsage: summary.systemMetrics.averageCpuUsage
        }
      });
    }
    
    // High connections alert
    if (summary.systemMetrics.peakConnections > this.thresholds.activeConnectionsThreshold) {
      this.createAlert('HIGH_CONNECTIONS', {
        message: `High database connections: ${summary.systemMetrics.peakConnections}`,
        threshold: this.thresholds.activeConnectionsThreshold,
        currentValue: summary.systemMetrics.peakConnections,
        details: {
          averageActiveQueries: summary.systemMetrics.averageActiveQueries
        }
      });
    }
  }

  /**
   * Check error rate related alerts
   */
  checkErrorRateAlerts(realTimeMetrics, summary) {
    // High error rate alert
    if (summary.queryMetrics.errorRate > this.thresholds.errorRateThreshold) {
      this.createAlert('HIGH_ERROR_RATE', {
        message: `High error rate: ${summary.queryMetrics.errorRate}%`,
        threshold: this.thresholds.errorRateThreshold,
        currentValue: summary.queryMetrics.errorRate,
        details: {
          totalErrors: summary.errorMetrics.totalErrors,
          errorsByType: summary.errorMetrics.errorsByType,
          totalQueries: summary.queryMetrics.totalQueries
        }
      });
    }
  }

  /**
   * Check cache performance related alerts
   */
  checkCachePerformanceAlerts(realTimeMetrics, summary) {
    // Low cache hit rate alert
    if (realTimeMetrics.cacheHitRate < this.thresholds.cacheHitRateThreshold && 
        summary.queryMetrics.totalQueries > 10) {
      this.createAlert('LOW_CACHE_HIT_RATE', {
        message: `Low cache hit rate: ${realTimeMetrics.cacheHitRate}%`,
        threshold: this.thresholds.cacheHitRateThreshold,
        currentValue: realTimeMetrics.cacheHitRate,
        details: {
          averageHitRate: summary.cacheMetrics.averageHitRate,
          totalEvictions: summary.cacheMetrics.totalEvictions
        }
      });
    }
  }

  /**
   * Create and manage alerts
   */
  createAlert(alertType, alertData) {
    const alertKey = this.generateAlertKey(alertType, alertData);
    
    // Check if alert is in cooldown period
    if (this.isInCooldown(alertKey)) {
      return null;
    }
    
    // Check if we've exceeded max alerts per hour
    if (this.exceedsHourlyLimit()) {
      console.warn('Alert rate limit exceeded, suppressing alerts');
      return null;
    }
    
    // Check if alert already exists
    if (this.alertState.activeAlerts.has(alertKey)) {
      // Update existing alert
      const existingAlert = this.alertState.activeAlerts.get(alertKey);
      existingAlert.count++;
      existingAlert.lastSeen = new Date().toISOString();
      existingAlert.currentValue = alertData.currentValue;
      return existingAlert;
    }
    
    // Create new alert
    const alert = {
      id: this.generateAlertId(),
      type: alertType,
      severity: this.alertTypes[alertType]?.severity || 'medium',
      category: this.alertTypes[alertType]?.category || 'general',
      message: alertData.message,
      threshold: alertData.threshold,
      currentValue: alertData.currentValue,
      details: alertData.details || {},
      count: 1,
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      resolved: false,
      acknowledged: false
    };
    
    // Store alert
    this.alertState.activeAlerts.set(alertKey, alert);
    this.alertState.alertHistory.push({ ...alert });
    this.alertState.lastAlertTimes.set(alertKey, Date.now());
    
    // Update alert count for rate limiting
    const hourKey = Math.floor(Date.now() / (60 * 60 * 1000));
    this.alertState.alertCounts.set(hourKey, 
      (this.alertState.alertCounts.get(hourKey) || 0) + 1);
    
    // Send notifications
    this.sendNotifications(alert);
    
    console.warn(`ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);
    
    return alert;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertType, alertData = {}) {
    const alertKey = this.generateAlertKey(alertType, alertData);
    const alert = this.alertState.activeAlerts.get(alertKey);
    
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();
      
      // Send resolution notification
      this.sendResolutionNotification(alert);
      
      console.info(`ALERT RESOLVED [${alert.type}]: ${alert.message}`);
      
      return alert;
    }
    
    return null;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId) {
    for (const alert of this.alertState.activeAlerts.values()) {
      if (alert.id === alertId) {
        alert.acknowledged = true;
        alert.acknowledgedAt = new Date().toISOString();
        console.info(`ALERT ACKNOWLEDGED [${alert.type}]: ${alert.message}`);
        return alert;
      }
    }
    
    return null;
  }

  /**
   * Clean up resolved alerts
   */
  cleanupResolvedAlerts(realTimeMetrics, summary) {
    const alertsToResolve = [];
    
    for (const [alertKey, alert] of this.alertState.activeAlerts.entries()) {
      if (alert.resolved) continue;
      
      let shouldResolve = false;
      
      // Check if alert conditions are no longer met
      switch (alert.type) {
        case 'SLOW_QUERY':
          shouldResolve = realTimeMetrics.averageResponseTime <= this.thresholds.slowQueryThreshold * 0.8;
          break;
        case 'HIGH_ERROR_RATE':
          shouldResolve = summary.queryMetrics.errorRate <= this.thresholds.errorRateThreshold * 0.8;
          break;
        case 'LOW_CACHE_HIT_RATE':
          shouldResolve = realTimeMetrics.cacheHitRate >= this.thresholds.cacheHitRateThreshold;
          break;
        case 'HIGH_QPS':
          shouldResolve = realTimeMetrics.queriesPerSecond <= this.thresholds.queriesPerSecondThreshold * 0.8;
          break;
        case 'HIGH_CPU_USAGE':
          shouldResolve = summary.systemMetrics.averageCpuUsage <= this.thresholds.cpuUsageThreshold * 0.8;
          break;
        case 'HIGH_MEMORY_USAGE':
          shouldResolve = summary.systemMetrics.averageMemoryUsage <= this.thresholds.memoryUsageThreshold * 0.8;
          break;
        case 'SLOW_RESPONSE_TIME':
          shouldResolve = summary.queryMetrics.p95ResponseTime <= this.thresholds.responseTimeThreshold * 1.5;
          break;
        case 'HIGH_CONNECTIONS':
          shouldResolve = summary.systemMetrics.peakConnections <= this.thresholds.activeConnectionsThreshold * 0.8;
          break;
      }
      
      if (shouldResolve) {
        alertsToResolve.push({ alertType: alert.type, alertKey });
      }
    }
    
    // Resolve alerts
    for (const { alertType, alertKey } of alertsToResolve) {
      this.resolveAlert(alertType);
    }
    
    // Remove old resolved alerts
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    for (const [alertKey, alert] of this.alertState.activeAlerts.entries()) {
      if (alert.resolved && new Date(alert.resolvedAt).getTime() < oneDayAgo) {
        this.alertState.activeAlerts.delete(alertKey);
      }
    }
  }

  /**
   * Send notifications for alerts
   */
  sendNotifications(alert) {
    if (this.options.enableLogNotifications) {
      this.sendLogNotification(alert);
    }
    
    if (this.options.enableEmailNotifications) {
      this.sendEmailNotification(alert);
    }
    
    if (this.options.enableWebhookNotifications) {
      this.sendWebhookNotification(alert);
    }
  }

  /**
   * Send log notification
   */
  sendLogNotification(alert) {
    const logLevel = alert.severity === 'critical' ? 'error' : 
                    alert.severity === 'high' ? 'warn' : 'info';
    
    console[logLevel](`[ALERT] ${alert.type}: ${alert.message}`, {
      alertId: alert.id,
      severity: alert.severity,
      category: alert.category,
      threshold: alert.threshold,
      currentValue: alert.currentValue,
      details: alert.details
    });
  }

  /**
   * Send email notification (placeholder)
   */
  async sendEmailNotification(alert) {
    // Placeholder for email notification implementation
    // In a real implementation, this would integrate with an email service
    console.log(`[EMAIL ALERT] ${alert.type}: ${alert.message}`);
  }

  /**
   * Send webhook notification (placeholder)
   */
  async sendWebhookNotification(alert) {
    // Placeholder for webhook notification implementation
    // In a real implementation, this would send HTTP request to webhook URL
    console.log(`[WEBHOOK ALERT] ${alert.type}: ${alert.message}`);
  }

  /**
   * Send resolution notification
   */
  sendResolutionNotification(alert) {
    if (this.options.enableLogNotifications) {
      console.info(`[ALERT RESOLVED] ${alert.type}: ${alert.message}`);
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(options = {}) {
    const { severity = null, category = null, acknowledged = null } = options;
    
    let alerts = Array.from(this.alertState.activeAlerts.values())
      .filter(alert => !alert.resolved);
    
    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity);
    }
    
    if (category) {
      alerts = alerts.filter(alert => alert.category === category);
    }
    
    if (acknowledged !== null) {
      alerts = alerts.filter(alert => alert.acknowledged === acknowledged);
    }
    
    return alerts.sort((a, b) => {
      // Sort by severity first, then by creation time
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      
      if (severityDiff !== 0) return severityDiff;
      
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  /**
   * Get alert history
   */
  getAlertHistory(timeRange = '24h', limit = 100) {
    const cutoffTime = Date.now() - this.parseTimeRange(timeRange);
    
    return this.alertState.alertHistory
      .filter(alert => new Date(alert.createdAt).getTime() >= cutoffTime)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  /**
   * Get alert statistics
   */
  getAlertStatistics(timeRange = '24h') {
    const history = this.getAlertHistory(timeRange);
    
    const stats = {
      totalAlerts: history.length,
      activeAlerts: this.getActiveAlerts().length,
      resolvedAlerts: history.filter(alert => alert.resolved).length,
      acknowledgedAlerts: history.filter(alert => alert.acknowledged).length,
      alertsBySeverity: {},
      alertsByCategory: {},
      alertsByType: {},
      averageResolutionTime: 0
    };
    
    // Calculate statistics
    for (const alert of history) {
      stats.alertsBySeverity[alert.severity] = (stats.alertsBySeverity[alert.severity] || 0) + 1;
      stats.alertsByCategory[alert.category] = (stats.alertsByCategory[alert.category] || 0) + 1;
      stats.alertsByType[alert.type] = (stats.alertsByType[alert.type] || 0) + 1;
    }
    
    // Calculate average resolution time
    const resolvedAlerts = history.filter(alert => alert.resolved && alert.resolvedAt);
    if (resolvedAlerts.length > 0) {
      const totalResolutionTime = resolvedAlerts.reduce((sum, alert) => {
        const resolutionTime = new Date(alert.resolvedAt).getTime() - new Date(alert.createdAt).getTime();
        return sum + resolutionTime;
      }, 0);
      
      stats.averageResolutionTime = Math.round(totalResolutionTime / resolvedAlerts.length / 1000); // seconds
    }
    
    return stats;
  }

  /**
   * Update alert thresholds
   */
  updateThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('Alert thresholds updated:', this.thresholds);
    return this.thresholds;
  }

  /**
   * Start monitoring
   */
  startMonitoring() {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }
    
    console.log('Alert monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    
    console.log('Alert monitoring stopped');
  }

  /**
   * Helper methods
   */
  
  generateAlertKey(alertType, alertData) {
    // Create a unique key for this type of alert
    return `${alertType}_${alertData.threshold || 'default'}`;
  }
  
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
  
  isInCooldown(alertKey) {
    const lastAlertTime = this.alertState.lastAlertTimes.get(alertKey);
    if (!lastAlertTime) return false;
    
    return (Date.now() - lastAlertTime) < this.options.alertCooldown;
  }
  
  exceedsHourlyLimit() {
    const hourKey = Math.floor(Date.now() / (60 * 60 * 1000));
    const hourlyCount = this.alertState.alertCounts.get(hourKey) || 0;
    
    return hourlyCount >= this.options.maxAlertsPerHour;
  }
  
  parseTimeRange(timeRange) {
    const units = {
      's': 1000,
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000
    };
    
    const match = timeRange.match(/^(\d+)([smhd])$/);
    if (!match) return 60 * 60 * 1000; // Default 1 hour
    
    const [, value, unit] = match;
    return parseInt(value) * (units[unit] || units.h);
  }

  /**
   * Reset alert system
   */
  reset() {
    this.alertState = {
      activeAlerts: new Map(),
      alertHistory: [],
      lastAlertTimes: new Map(),
      alertCounts: new Map(),
      suppressedAlerts: new Set()
    };
    
    console.log('AlertSystem reset completed');
  }

  /**
   * Destroy alert system
   */
  destroy() {
    this.stopMonitoring();
    this.reset();
    console.log('AlertSystem destroyed');
  }
}

module.exports = AlertSystem;
