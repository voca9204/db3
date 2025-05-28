/**
 * Optimization Module Index
 * Exports all optimization components for easy importing
 * Task 1.5: Query Optimization and Caching
 */

const CacheManager = require('./CacheManager');
const QueryOptimizer = require('./QueryOptimizer');
const QueryAnalyzer = require('./QueryAnalyzer');
const IndexRecommendations = require('./IndexRecommendations');
const OptimizationEngine = require('./OptimizationEngine');

module.exports = {
  CacheManager,
  QueryOptimizer,
  QueryAnalyzer,
  IndexRecommendations,
  OptimizationEngine
};
