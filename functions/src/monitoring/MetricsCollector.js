/**
 * MetricsCollector.js
 * Comprehensive metrics collection system for database performance monitoring
 * Task 1.6: Performance Monitoring System
 */

class MetricsCollector {
  constructor(options = {}) {
    this.options = {
      retentionPeriod: options.retentionPeriod || 24 * 60 * 60 * 1000, // 24 hours
      maxMetricHistory: options.maxMetricHistory || 10000,
      aggregationInterval: options.aggregationInterval || 60000, // 1 minute
      enableRealTimeMetrics: options.enableRealTimeMetrics !== false,
      enableHistoricalMetrics: options.enableHistoricalMetrics !== false
    };
    
    // Metric storage
    this.metrics = {
      queryMetrics: [],
      systemMetrics: [],
      errorMetrics: [],
      cacheMetrics: [],
      aggregatedMetrics: new Map()
    };
    
    // Real-time metrics
    this.realTimeMetrics = {
      currentQueries: 0,
      averageResponseTime: 0,
      queriesPerSecond: 0,
      cacheHitRate: 0,
      errorRate: 0,
      systemLoad: 0
    };
    
    // Metric counters
    this.counters = {
      totalQueries: 0,
      totalErrors: 0,
      totalCacheHits: 0,
      totalCacheMisses: 0,
      responseTimeSum: 0,
      queryIntervals: []
    };
    
    // Start aggregation timer
    this.startAggregationTimer();
    
    console.log('MetricsCollector initialized with options:', this.options);
  }

  /**
   * Record query execution metrics
   */
  recordQueryMetric(queryData) {
    const timestamp = Date.now();
    
    const metric = {
      timestamp,
      queryId: queryData.queryId || this.generateId(),
      sql: queryData.sql ? queryData.sql.substring(0, 200) : 'Unknown',
      executionTime: queryData.executionTime || 0,
      fromCache: queryData.fromCache || false,
      optimized: queryData.optimized || false,
      complexity: queryData.complexity || 0,
      resultSize: queryData.resultSize || 0,
      error: queryData.error || null,
      userId: queryData.userId || null,
      endpoint: queryData.endpoint || null
    };
    
    // Store metric
    this.metrics.queryMetrics.push(metric);
    this.cleanupOldMetrics('queryMetrics');
    
    // Update counters
    this.counters.totalQueries++;
    this.counters.responseTimeSum += metric.executionTime;
    this.counters.queryIntervals.push(timestamp);
    
    // Update cache counters
    if (metric.fromCache) {
      this.counters.totalCacheHits++;
    } else {
      this.counters.totalCacheMisses++;
    }
    
    // Record error if present
    if (metric.error) {
      this.recordErrorMetric({
        type: 'QUERY_ERROR',
        message: metric.error,
        queryId: metric.queryId,
        sql: metric.sql
      });
    }
    
    // Update real-time metrics
    this.updateRealTimeMetrics();
    
    return metric;
  }

  /**
   * Record system performance metrics
   */
  recordSystemMetric(systemData) {
    const timestamp = Date.now();
    
    const metric = {
      timestamp,
      cpuUsage: systemData.cpuUsage || 0,
      memoryUsage: systemData.memoryUsage || 0,
      dbConnections: systemData.dbConnections || 0,
      activeQueries: systemData.activeQueries || 0,
      cacheSize: systemData.cacheSize || 0,
      diskUsage: systemData.diskUsage || 0,
      networkIO: systemData.networkIO || 0
    };
    
    this.metrics.systemMetrics.push(metric);
    this.cleanupOldMetrics('systemMetrics');
    
    return metric;
  }

  /**
   * Record error metrics
   */
  recordErrorMetric(errorData) {
    const timestamp = Date.now();
    
    const metric = {
      timestamp,
      type: errorData.type || 'UNKNOWN_ERROR',
      message: errorData.message || 'Unknown error',
      severity: errorData.severity || 'medium',
      queryId: errorData.queryId || null,
      sql: errorData.sql || null,
      stackTrace: errorData.stackTrace || null,
      endpoint: errorData.endpoint || null,
      userId: errorData.userId || null
    };
    
    this.metrics.errorMetrics.push(metric);
    this.cleanupOldMetrics('errorMetrics');
    
    // Update error counter
    this.counters.totalErrors++;
    
    return metric;
  }

  /**
   * Record cache performance metrics
   */
  recordCacheMetric(cacheData) {
    const timestamp = Date.now();
    
    const metric = {
      timestamp,
      operation: cacheData.operation || 'unknown',
      hitRate: cacheData.hitRate || 0,
      size: cacheData.size || 0,
      evictions: cacheData.evictions || 0,
      memoryUsage: cacheData.memoryUsage || 0,
      invalidations: cacheData.invalidations || 0
    };
    
    this.metrics.cacheMetrics.push(metric);
    this.cleanupOldMetrics('cacheMetrics');
    
    return metric;
  }

  /**
   * Get current real-time metrics
   */
  getRealTimeMetrics() {
    return {
      ...this.realTimeMetrics,
      timestamp: new Date().toISOString(),
      uptime: process.uptime ? process.uptime() : 0
    };
  }

  /**
   * Get historical metrics for specific time range
   */
  getHistoricalMetrics(timeRange = '1h', metricType = 'all') {
    const endTime = Date.now();
    const startTime = endTime - this.parseTimeRange(timeRange);
    
    const result = {};
    
    if (metricType === 'all' || metricType === 'query') {
      result.queryMetrics = this.metrics.queryMetrics.filter(
        m => m.timestamp >= startTime && m.timestamp <= endTime
      );
    }
    
    if (metricType === 'all' || metricType === 'system') {
      result.systemMetrics = this.metrics.systemMetrics.filter(
        m => m.timestamp >= startTime && m.timestamp <= endTime
      );
    }
    
    if (metricType === 'all' || metricType === 'error') {
      result.errorMetrics = this.metrics.errorMetrics.filter(
        m => m.timestamp >= startTime && m.timestamp <= endTime
      );
    }
    
    if (metricType === 'all' || metricType === 'cache') {
      result.cacheMetrics = this.metrics.cacheMetrics.filter(
        m => m.timestamp >= startTime && m.timestamp <= endTime
      );
    }
    
    return {
      timeRange,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      ...result
    };
  }

  /**
   * Get aggregated metrics for time periods
   */
  getAggregatedMetrics(timeRange = '1h', granularity = '5m') {
    const metrics = this.getHistoricalMetrics(timeRange, 'query');
    const intervalMs = this.parseTimeRange(granularity);
    const endTime = Date.now();
    const startTime = endTime - this.parseTimeRange(timeRange);
    
    const buckets = new Map();
    
    // Create time buckets
    for (let time = startTime; time <= endTime; time += intervalMs) {
      const bucketKey = Math.floor(time / intervalMs) * intervalMs;
      buckets.set(bucketKey, {
        timestamp: bucketKey,
        queryCount: 0,
        averageResponseTime: 0,
        totalResponseTime: 0,
        errorCount: 0,
        cacheHitRate: 0,
        cacheHits: 0,
        cacheMisses: 0
      });
    }
    
    // Aggregate query metrics into buckets
    if (metrics.queryMetrics) {
      for (const metric of metrics.queryMetrics) {
        const bucketKey = Math.floor(metric.timestamp / intervalMs) * intervalMs;
        const bucket = buckets.get(bucketKey);
        
        if (bucket) {
          bucket.queryCount++;
          bucket.totalResponseTime += metric.executionTime;
          
          if (metric.error) {
            bucket.errorCount++;
          }
          
          if (metric.fromCache) {
            bucket.cacheHits++;
          } else {
            bucket.cacheMisses++;
          }
        }
      }
    }
    
    // Calculate averages and rates
    for (const bucket of buckets.values()) {
      if (bucket.queryCount > 0) {
        bucket.averageResponseTime = bucket.totalResponseTime / bucket.queryCount;
        bucket.cacheHitRate = bucket.cacheHits / (bucket.cacheHits + bucket.cacheMisses) * 100;
      }
    }
    
    return {
      timeRange,
      granularity,
      buckets: Array.from(buckets.values()).sort((a, b) => a.timestamp - b.timestamp)
    };
  }

  /**
   * Get performance summary statistics
   */
  getPerformanceSummary(timeRange = '1h') {
    const metrics = this.getHistoricalMetrics(timeRange);
    
    const summary = {
      timeRange,
      queryMetrics: this.summarizeQueryMetrics(metrics.queryMetrics || []),
      systemMetrics: this.summarizeSystemMetrics(metrics.systemMetrics || []),
      errorMetrics: this.summarizeErrorMetrics(metrics.errorMetrics || []),
      cacheMetrics: this.summarizeCacheMetrics(metrics.cacheMetrics || [])
    };
    
    return summary;
  }

  /**
   * Summarize query metrics
   */
  summarizeQueryMetrics(queryMetrics) {
    if (queryMetrics.length === 0) {
      return {
        totalQueries: 0,
        averageResponseTime: 0,
        medianResponseTime: 0,
        p95ResponseTime: 0,
        slowQueries: 0,
        errorRate: 0,
        cacheHitRate: 0
      };
    }
    
    const responseTimes = queryMetrics.map(m => m.executionTime).sort((a, b) => a - b);
    const errors = queryMetrics.filter(m => m.error).length;
    const cacheHits = queryMetrics.filter(m => m.fromCache).length;
    const slowQueries = queryMetrics.filter(m => m.executionTime > 1000).length;
    
    return {
      totalQueries: queryMetrics.length,
      averageResponseTime: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
      medianResponseTime: Math.round(this.percentile(responseTimes, 50)),
      p95ResponseTime: Math.round(this.percentile(responseTimes, 95)),
      slowQueries,
      errorRate: Math.round((errors / queryMetrics.length) * 100 * 100) / 100,
      cacheHitRate: Math.round((cacheHits / queryMetrics.length) * 100 * 100) / 100
    };
  }

  /**
   * Summarize system metrics
   */
  summarizeSystemMetrics(systemMetrics) {
    if (systemMetrics.length === 0) {
      return {
        averageCpuUsage: 0,
        averageMemoryUsage: 0,
        peakConnections: 0,
        averageActiveQueries: 0
      };
    }
    
    const avgCpu = systemMetrics.reduce((sum, m) => sum + m.cpuUsage, 0) / systemMetrics.length;
    const avgMemory = systemMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / systemMetrics.length;
    const peakConnections = Math.max(...systemMetrics.map(m => m.dbConnections));
    const avgActiveQueries = systemMetrics.reduce((sum, m) => sum + m.activeQueries, 0) / systemMetrics.length;
    
    return {
      averageCpuUsage: Math.round(avgCpu * 100) / 100,
      averageMemoryUsage: Math.round(avgMemory * 100) / 100,
      peakConnections,
      averageActiveQueries: Math.round(avgActiveQueries * 100) / 100
    };
  }

  /**
   * Summarize error metrics
   */
  summarizeErrorMetrics(errorMetrics) {
    if (errorMetrics.length === 0) {
      return {
        totalErrors: 0,
        errorsByType: {},
        errorsBySeverity: {}
      };
    }
    
    const errorsByType = {};
    const errorsBySeverity = {};
    
    for (const error of errorMetrics) {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
    }
    
    return {
      totalErrors: errorMetrics.length,
      errorsByType,
      errorsBySeverity
    };
  }

  /**
   * Summarize cache metrics
   */
  summarizeCacheMetrics(cacheMetrics) {
    if (cacheMetrics.length === 0) {
      return {
        averageHitRate: 0,
        averageSize: 0,
        totalEvictions: 0,
        averageMemoryUsage: 0
      };
    }
    
    const avgHitRate = cacheMetrics.reduce((sum, m) => sum + m.hitRate, 0) / cacheMetrics.length;
    const avgSize = cacheMetrics.reduce((sum, m) => sum + m.size, 0) / cacheMetrics.length;
    const totalEvictions = cacheMetrics.reduce((sum, m) => sum + m.evictions, 0);
    const avgMemory = cacheMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / cacheMetrics.length;
    
    return {
      averageHitRate: Math.round(avgHitRate * 100) / 100,
      averageSize: Math.round(avgSize),
      totalEvictions,
      averageMemoryUsage: Math.round(avgMemory * 100) / 100
    };
  }

  /**
   * Update real-time metrics
   */
  updateRealTimeMetrics() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Filter recent queries
    const recentQueries = this.metrics.queryMetrics.filter(
      m => m.timestamp >= oneMinuteAgo
    );
    
    // Update queries per second
    const recentIntervals = this.counters.queryIntervals.filter(
      time => time >= oneMinuteAgo
    );
    this.realTimeMetrics.queriesPerSecond = recentIntervals.length / 60;
    
    // Update average response time
    if (this.counters.totalQueries > 0) {
      this.realTimeMetrics.averageResponseTime = 
        Math.round(this.counters.responseTimeSum / this.counters.totalQueries);
    }
    
    // Update cache hit rate
    const totalCacheOperations = this.counters.totalCacheHits + this.counters.totalCacheMisses;
    if (totalCacheOperations > 0) {
      this.realTimeMetrics.cacheHitRate = 
        Math.round((this.counters.totalCacheHits / totalCacheOperations) * 100 * 100) / 100;
    }
    
    // Update error rate
    if (this.counters.totalQueries > 0) {
      this.realTimeMetrics.errorRate = 
        Math.round((this.counters.totalErrors / this.counters.totalQueries) * 100 * 100) / 100;
    }
    
    // Clean up old intervals
    this.counters.queryIntervals = this.counters.queryIntervals.filter(
      time => time >= oneMinuteAgo
    );
  }

  /**
   * Start aggregation timer
   */
  startAggregationTimer() {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
    }
    
    this.aggregationTimer = setInterval(() => {
      this.updateRealTimeMetrics();
      this.aggregateMetrics();
    }, this.options.aggregationInterval);
  }

  /**
   * Aggregate metrics for efficient storage and querying
   */
  aggregateMetrics() {
    const intervals = ['5m', '15m', '1h', '6h', '24h'];
    
    for (const interval of intervals) {
      const aggregated = this.getAggregatedMetrics('24h', interval);
      this.metrics.aggregatedMetrics.set(interval, aggregated);
    }
  }

  /**
   * Clean up old metrics based on retention period
   */
  cleanupOldMetrics(metricType) {
    const cutoffTime = Date.now() - this.options.retentionPeriod;
    
    if (this.metrics[metricType]) {
      this.metrics[metricType] = this.metrics[metricType].filter(
        metric => metric.timestamp >= cutoffTime
      );
      
      // Also limit by count
      if (this.metrics[metricType].length > this.options.maxMetricHistory) {
        this.metrics[metricType] = this.metrics[metricType].slice(-this.options.maxMetricHistory);
      }
    }
  }

  /**
   * Export metrics data
   */
  exportMetrics(format = 'json') {
    const data = {
      metadata: {
        exportedAt: new Date().toISOString(),
        retentionPeriod: this.options.retentionPeriod,
        totalQueryMetrics: this.metrics.queryMetrics.length,
        totalSystemMetrics: this.metrics.systemMetrics.length,
        totalErrorMetrics: this.metrics.errorMetrics.length,
        totalCacheMetrics: this.metrics.cacheMetrics.length
      },
      realTimeMetrics: this.getRealTimeMetrics(),
      counters: this.counters,
      metrics: this.metrics
    };
    
    if (format === 'csv') {
      return this.convertToCSV(data);
    }
    
    return data;
  }

  /**
   * Reset all metrics and counters
   */
  reset() {
    this.metrics = {
      queryMetrics: [],
      systemMetrics: [],
      errorMetrics: [],
      cacheMetrics: [],
      aggregatedMetrics: new Map()
    };
    
    this.counters = {
      totalQueries: 0,
      totalErrors: 0,
      totalCacheHits: 0,
      totalCacheMisses: 0,
      responseTimeSum: 0,
      queryIntervals: []
    };
    
    console.log('MetricsCollector reset completed');
  }

  /**
   * Helper methods
   */
  
  generateId() {
    return `metric_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
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
  
  percentile(arr, p) {
    if (arr.length === 0) return 0;
    const index = (p / 100) * (arr.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;
    
    if (upper >= arr.length) return arr[lower];
    return arr[lower] * (1 - weight) + arr[upper] * weight;
  }
  
  convertToCSV(data) {
    // Simple CSV conversion for query metrics
    const headers = ['timestamp', 'executionTime', 'fromCache', 'optimized', 'error'];
    const rows = [headers.join(',')];
    
    for (const metric of data.metrics.queryMetrics) {
      rows.push([
        metric.timestamp,
        metric.executionTime,
        metric.fromCache,
        metric.optimized,
        metric.error ? 'true' : 'false'
      ].join(','));
    }
    
    return rows.join('\n');
  }

  /**
   * Stop metrics collection
   */
  destroy() {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
    }
    
    console.log('MetricsCollector destroyed');
  }
}

module.exports = MetricsCollector;
