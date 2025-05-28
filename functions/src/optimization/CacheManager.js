/**
 * CacheManager.js
 * In-memory cache system for database queries with TTL and invalidation strategies
 * Task 1.5: Query Optimization and Caching
 */

class CacheManager {
  constructor(options = {}) {
    this.cache = new Map();
    this.hitCounts = new Map();
    this.accessTimes = new Map();
    
    // Configuration
    this.maxCacheSize = options.maxCacheSize || 1000;
    this.defaultTTL = options.defaultTTL || 300000; // 5 minutes
    this.cleanupInterval = options.cleanupInterval || 60000; // 1 minute
    this.enableLRU = options.enableLRU !== false;
    
    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      cleanups: 0
    };
    
    // Start cleanup timer
    this.startCleanupTimer();
    
    console.log(`CacheManager initialized with maxSize: ${this.maxCacheSize}, TTL: ${this.defaultTTL}ms`);
  }

  /**
   * Generate cache key from SQL query and parameters
   */
  generateKey(sql, params = []) {
    const normalizedSQL = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    const paramString = Array.isArray(params) ? JSON.stringify(params) : '';
    return `${normalizedSQL}:${paramString}`;
  }

  /**
   * Get cached query result
   */
  get(sql, params = []) {
    const key = this.generateKey(sql, params);
    const cached = this.cache.get(key);
    
    if (!cached) {
      this.stats.misses++;
      return null;
    }
    
    // Check TTL
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      this.hitCounts.delete(key);
      this.accessTimes.delete(key);
      this.stats.misses++;
      return null;
    }
    
    // Update access statistics
    this.stats.hits++;
    this.hitCounts.set(key, (this.hitCounts.get(key) || 0) + 1);
    this.accessTimes.set(key, Date.now());
    
    return cached.data;
  }

  /**
   * Cache query result
   */
  set(sql, params = [], data, ttl = null) {
    const key = this.generateKey(sql, params);
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    
    // Check cache size and evict if necessary
    if (this.cache.size >= this.maxCacheSize) {
      this.evictLRU();
    }
    
    this.cache.set(key, {
      data,
      expiresAt,
      createdAt: Date.now(),
      size: this.estimateSize(data)
    });
    
    this.hitCounts.set(key, 0);
    this.accessTimes.set(key, Date.now());
    this.stats.sets++;
    
    return true;
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidate(pattern) {
    let invalidated = 0;
    
    for (const key of this.cache.keys()) {
      if (this.matchesPattern(key, pattern)) {
        this.cache.delete(key);
        this.hitCounts.delete(key);
        this.accessTimes.delete(key);
        invalidated++;
      }
    }
    
    console.log(`Cache invalidated ${invalidated} entries matching pattern: ${pattern}`);
    return invalidated;
  }

  /**
   * Invalidate cache by table name
   */
  invalidateByTable(tableName) {
    return this.invalidate(`*${tableName}*`);
  }

  /**
   * Clear all cache
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.hitCounts.clear();
    this.accessTimes.clear();
    
    console.log(`Cache cleared: ${size} entries removed`);
    return size;
  }

  /**
   * Evict least recently used item
   */
  evictLRU() {
    if (!this.enableLRU || this.cache.size === 0) {
      return false;
    }
    
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, time] of this.accessTimes.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.hitCounts.delete(oldestKey);
      this.accessTimes.delete(oldestKey);
      this.stats.evictions++;
      return true;
    }
    
    return false;
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, cached] of this.cache.entries()) {
      if (now > cached.expiresAt) {
        this.cache.delete(key);
        this.hitCounts.delete(key);
        this.accessTimes.delete(key);
        cleaned++;
      }
    }
    
    this.stats.cleanups++;
    
    if (cleaned > 0) {
      console.log(`Cache cleanup: ${cleaned} expired entries removed`);
    }
    
    return cleaned;
  }

  /**
   * Start automatic cleanup timer
   */
  startCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests * 100) : 0;
    
    return {
      ...this.stats,
      totalRequests,
      hitRate: Math.round(hitRate * 100) / 100,
      cacheSize: this.cache.size,
      memoryUsage: this.getMemoryUsage()
    };
  }

  /**
   * Get top cached queries by hit count
   */
  getTopQueries(limit = 10) {
    const entries = Array.from(this.hitCounts.entries())
      .filter(([key]) => this.cache.has(key))
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit);
    
    return entries.map(([key, hits]) => ({
      key: key.substring(0, 100) + (key.length > 100 ? '...' : ''),
      hits,
      lastAccess: this.accessTimes.get(key),
      expiresAt: this.cache.get(key)?.expiresAt
    }));
  }

  /**
   * Estimate memory usage
   */
  getMemoryUsage() {
    let totalSize = 0;
    
    for (const cached of this.cache.values()) {
      totalSize += cached.size || 0;
    }
    
    return {
      estimatedBytes: totalSize,
      estimatedMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
      entries: this.cache.size
    };
  }

  /**
   * Estimate data size in bytes
   */
  estimateSize(data) {
    try {
      return JSON.stringify(data).length * 2; // Rough estimate
    } catch (error) {
      return 1000; // Default estimate
    }
  }

  /**
   * Match key against pattern (supports wildcards)
   */
  matchesPattern(key, pattern) {
    if (!pattern.includes('*')) {
      return key.includes(pattern);
    }
    
    const regex = new RegExp(
      pattern.replace(/\*/g, '.*').replace(/\?/g, '.'),
      'i'
    );
    
    return regex.test(key);
  }

  /**
   * Get cache configuration
   */
  getConfig() {
    return {
      maxCacheSize: this.maxCacheSize,
      defaultTTL: this.defaultTTL,
      cleanupInterval: this.cleanupInterval,
      enableLRU: this.enableLRU
    };
  }

  /**
   * Update cache configuration
   */
  updateConfig(options = {}) {
    if (options.maxCacheSize !== undefined) {
      this.maxCacheSize = options.maxCacheSize;
    }
    
    if (options.defaultTTL !== undefined) {
      this.defaultTTL = options.defaultTTL;
    }
    
    if (options.cleanupInterval !== undefined) {
      this.cleanupInterval = options.cleanupInterval;
      this.startCleanupTimer();
    }
    
    if (options.enableLRU !== undefined) {
      this.enableLRU = options.enableLRU;
    }
    
    return this.getConfig();
  }

  /**
   * Destroy cache manager
   */
  destroy() {
    this.stopCleanupTimer();
    this.clear();
    console.log('CacheManager destroyed');
  }
}

module.exports = CacheManager;
