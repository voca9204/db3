/**
 * AutoIndexCore.js
 * Core orchestrator for automatic index optimization
 * 분할된 모듈: AutoIndexOptimizer.js의 핵심 부분
 * 
 * 포함 기능:
 * - 메인 클래스 정의 및 설정
 * - 최적화 사이클 오케스트레이션
 * - 기본 유틸리티 메서드들
 */

const { executeQuery } = require('../../db');
const IndexRecommendations = require('./IndexRecommendations');
const QueryAnalyzer = require('./QueryAnalyzer');
const AutoIndexOptimizerUtils = require('./AutoIndexOptimizerUtils');

// 분할된 모듈들 import
const IndexAnalyzer = require('./IndexAnalyzer');
const OptimizationPlanner = require('./OptimizationPlanner');
const OptimizationExecutor = require('./OptimizationExecutor');
const LearningSystem = require('./LearningSystem');

class AutoIndexOptimizer {
  constructor(options = {}) {
    this.options = {
      // Analysis settings
      learningPeriod: options.learningPeriod || 7 * 24 * 60 * 60 * 1000, // 7 days
      optimizationInterval: options.optimizationInterval || 24 * 60 * 60 * 1000, // 24 hours
      confidenceThreshold: options.confidenceThreshold || 80,
      performanceThreshold: options.performanceThreshold || 1000, // ms
      
      // Index management
      maxIndexesPerTable: options.maxIndexesPerTable || 10,
      minUsageThreshold: options.minUsageThreshold || 5, // minimum usage count
      redundancyThreshold: options.redundancyThreshold || 0.8, // 80% similarity
      
      // Safety settings
      autoExecute: options.autoExecute || false, // Manual approval by default
      backupEnabled: options.backupEnabled || true,
      maxBatchSize: options.maxBatchSize || 5, // Max operations per batch
      
      // Monitoring
      enableDetailedLogging: options.enableDetailedLogging || true
    };
    
    // Core components
    this.indexRecommender = new IndexRecommendations();
    this.queryAnalyzer = new QueryAnalyzer();
    
    // 분할된 모듈 인스턴스
    this.indexAnalyzer = new IndexAnalyzer(this.options);
    this.optimizationPlanner = new OptimizationPlanner(this.options);
    this.optimizationExecutor = new OptimizationExecutor(this.options);
    this.learningSystem = new LearningSystem(this.options);
    
    // Optimization state
    this.optimizationHistory = [];
    this.indexUsageStats = new Map();
    this.schemaSnapshot = null;
    this.isOptimizing = false;
    
    // Learning data
    this.queryPatterns = new Map();
    this.performanceBaseline = new Map();
    this.indexEffectiveness = new Map();
    
    // Statistics
    this.stats = {
      totalOptimizations: 0,
      indexesCreated: 0,
      indexesDropped: 0,
      performanceImprovement: 0,
      lastOptimization: null,
      currentPhase: 'idle'
    };
    
    this.log('AutoIndexOptimizer initialized', this.options);
  }

  /**
   * Main optimization orchestrator
   * Runs the complete optimization cycle
   */
  async runOptimizationCycle() {
    if (this.isOptimizing) {
      throw new Error('Optimization cycle already in progress');
    }
    
    try {
      this.isOptimizing = true;
      this.stats.currentPhase = 'analyzing';
      this.log('Starting optimization cycle');
      
      // Phase 1: Collect and analyze current state
      const analysisResult = await this.indexAnalyzer.performComprehensiveAnalysis();
      
      // Phase 2: Generate optimization plan
      const optimizationPlan = await this.optimizationPlanner.generateOptimizationPlan(analysisResult);
      
      // Phase 3: Execute optimizations (if auto-execute enabled)
      let executionResult = null;
      if (this.options.autoExecute && optimizationPlan.actions.length > 0) {
        executionResult = await this.optimizationExecutor.executeOptimizationPlan(optimizationPlan);
      }
      
      // Phase 4: Update learning data
      await this.learningSystem.updateLearningData(analysisResult, optimizationPlan, executionResult);
      
      // Phase 5: Generate report
      const report = this.generateOptimizationReport(analysisResult, optimizationPlan, executionResult);
      
      this.stats.lastOptimization = new Date();
      this.stats.totalOptimizations++;
      this.stats.currentPhase = 'idle';
      
      this.log('Optimization cycle completed successfully');
      return report;
      
    } catch (error) {
      this.stats.currentPhase = 'error';
      this.log('Optimization cycle failed:', error.message);
      throw error;
      
    } finally {
      this.isOptimizing = false;
    }
  }

  /**
   * Generate comprehensive optimization report
   */
  generateOptimizationReport(analysis, plan, execution) {
    const report = {
      timestamp: new Date(),
      analysis: {
        tablesAnalyzed: analysis.schema.tables.length,
        indexesFound: analysis.indexes.all.length,
        duplicatesFound: analysis.indexes.duplicates.length,
        unusedIndexes: analysis.indexes.unused.length,
        recommendationsGenerated: analysis.recommendations.length
      },
      plan: {
        actionsPlanned: plan.actions.length,
        estimatedImpact: plan.estimatedImpact,
        priority: plan.priority,
        riskLevel: plan.riskAssessment.level
      },
      execution: execution ? {
        actionsExecuted: execution.actionsExecuted,
        actionsSuccessful: execution.actionsSuccessful,
        actionsFailed: execution.actionsFailed,
        performanceImprovement: execution.performanceImprovement,
        executionTime: execution.executionTime
      } : null,
      stats: { ...this.stats }
    };

    this.log('Optimization report generated', report);
    return report;
  }

  /**
   * Get current optimization status
   */
  getOptimizationStatus() {
    return {
      isOptimizing: this.isOptimizing,
      currentPhase: this.stats.currentPhase,
      lastOptimization: this.stats.lastOptimization,
      totalOptimizations: this.stats.totalOptimizations
    };
  }

  /**
   * Get detailed statistics
   */
  getDetailedStats() {
    return {
      ...this.stats,
      optimizationHistory: this.optimizationHistory.map(opt => ({
        timestamp: opt.timestamp,
        tablesAnalyzed: opt.analysis.schema.tables.length,
        actionsPlanned: opt.plan.actions.length,
        actionsExecuted: opt.execution ? opt.execution.actionsExecuted : 0,
        priority: opt.plan.priority
      }))
    };
  }

  /**
   * Reset learning data (use with caution)
   */
  resetLearningData() {
    this.optimizationHistory = [];
    this.indexUsageStats.clear();
    this.queryPatterns.clear();
    this.performanceBaseline.clear();
    this.indexEffectiveness.clear();
    this.schemaSnapshot = null;
    
    this.stats = {
      totalOptimizations: 0,
      indexesCreated: 0,
      indexesDropped: 0,
      performanceImprovement: 0,
      lastOptimization: null,
      currentPhase: 'idle'
    };
    
    this.log('Learning data reset successfully');
  }

  /**
   * Enhanced logging with timestamps and context
   */
  log(message, data = null) {
    if (!this.options.enableDetailedLogging) return;
    
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, message };
    
    if (data) {
      logEntry.data = data;
    }
    
    console.log(`[AutoIndexOptimizer] ${timestamp}: ${message}`, data ? data : '');
  }

  /**
   * Manual trigger for specific optimization types
   */
  async runSpecificOptimization(type, options = {}) {
    const validTypes = ['cleanup', 'recommendations', 'analysis-only'];
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid optimization type: ${type}. Valid types: ${validTypes.join(', ')}`);
    }

    this.log(`Running specific optimization: ${type}`, options);
    
    switch (type) {
      case 'cleanup':
        return await this.optimizationExecutor.cleanupUnusedIndexes(options);
      case 'recommendations':
        return await this.indexAnalyzer.generateRecommendations(options);
      case 'analysis-only':
        return await this.indexAnalyzer.performComprehensiveAnalysis();
      default:
        throw new Error(`Unhandled optimization type: ${type}`);
    }
  }
}

module.exports = AutoIndexOptimizer;
