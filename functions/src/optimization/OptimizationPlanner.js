/**
 * OptimizationPlanner.js
 * Optimization plan generation and strategy module
 * 분할된 모듈: AutoIndexOptimizer.js의 계획 생성 부분
 * 
 * 포함 기능:
 * - 최적화 계획 생성
 * - 인덱스 생성/삭제/최적화 액션 생성
 * - 우선순위 및 영향도 계산
 * - 리스크 평가
 */

class OptimizationPlanner {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Phase 2: Generate optimization plan
   */
  async generateOptimizationPlan(analysis) {
    console.log('Generating optimization plan...');
    
    const plan = {
      timestamp: new Date(),
      priority: 'medium',
      estimatedImpact: 0,
      actions: [],
      riskAssessment: {},
      prerequisites: []
    };
    
    // Action 1: Create recommended indexes
    const createActions = await this.generateCreateIndexActions(analysis);
    plan.actions.push(...createActions);
    
    // Action 2: Drop duplicate/unused indexes
    const dropActions = await this.generateDropIndexActions(analysis);
    plan.actions.push(...dropActions);
    
    // Action 3: Optimize composite indexes
    const optimizeActions = await this.generateOptimizeIndexActions(analysis);
    plan.actions.push(...optimizeActions);
    
    // Calculate overall priority and impact
    plan.priority = this.calculatePlanPriority(plan.actions);
    plan.estimatedImpact = this.estimatePerformanceImpact(plan.actions);
    plan.riskAssessment = this.assessOptimizationRisks(plan.actions);
    
    console.log(`Optimization plan generated: ${plan.actions.length} actions, priority: ${plan.priority}`);
    return plan;
  }

  /**
   * Generate actions to create new indexes
   */
  async generateCreateIndexActions(analysis) {
    const actions = [];
    
    for (const recommendation of analysis.recommendations) {
      if (recommendation.type === 'create_index' && 
          (recommendation.confidence || 80) >= this.options.confidenceThreshold) {
        actions.push({
          id: `create_${recommendation.table}_${recommendation.columns ? recommendation.columns.join('_') : 'index'}`,
          type: 'create_index',
          priority: recommendation.priority || 'medium',
          table: recommendation.table,
          indexName: recommendation.indexName || `idx_${recommendation.table}_${recommendation.columns ? recommendation.columns.join('_') : Date.now()}`,
          columns: recommendation.columns || [],
          unique: recommendation.unique || false,
          estimatedImpact: recommendation.estimatedImpact || 'medium',
          sql: recommendation.sql || this.generateCreateIndexSQL(recommendation),
          reasoning: recommendation.reason || 'Index optimization recommendation'
        });
      }
    }
    
    return actions;
  }

  /**
   * Generate actions to drop indexes
   */
  async generateDropIndexActions(analysis) {
    const actions = [];
    
    // Drop duplicate indexes
    for (const duplicate of analysis.indexes.duplicates) {
      const targetIndex = duplicate.recommendation?.target || duplicate.index2;
      actions.push({
        id: `drop_duplicate_${targetIndex.table}_${targetIndex.name}`,
        type: 'drop_index',
        priority: 'high',
        table: targetIndex.table,
        indexName: targetIndex.name,
        reason: 'duplicate',
        duplicateOf: duplicate.recommendation?.keep?.name || duplicate.index1.name,
        estimatedImpact: 10,
        sql: `DROP INDEX \`${targetIndex.name}\` ON \`${targetIndex.table}\``,
        reasoning: `Index is duplicate of ${duplicate.recommendation?.keep?.name || duplicate.index1.name} (${Math.round(duplicate.similarity * 100)}% similarity)`
      });
    }
    
    // Drop unused indexes
    for (const unused of analysis.indexes.unused) {
      if (unused.name !== 'PRIMARY') { // Never drop primary keys
        actions.push({
          id: `drop_unused_${unused.table}_${unused.name}`,
          type: 'drop_index',
          priority: 'medium',
          table: unused.table,
          indexName: unused.name,
          reason: 'unused',
          estimatedImpact: 5,
          sql: `DROP INDEX \`${unused.name}\` ON \`${unused.table}\``,
          reasoning: `Index has not been used in the tracking period (${unused.usage?.examined || 0} examinations)`
        });
      }
    }
    
    return actions;
  }

  /**
   * Generate actions to optimize existing indexes
   */
  async generateOptimizeIndexActions(analysis) {
    const actions = [];
    
    // Look for composite index opportunities
    for (const [tableName, indexes] of Object.entries(analysis.indexes.byTable)) {
      const singleColumnIndexes = indexes.filter(idx => 
        idx.columns.length === 1 && 
        idx.name !== 'PRIMARY' &&
        idx.usage?.examined > this.options.minUsageThreshold
      );
      
      if (singleColumnIndexes.length >= 2) {
        // Analyze potential composite index
        const compositeOpportunity = this.analyzeCompositeOpportunity(singleColumnIndexes);
        
        if (compositeOpportunity.viable) {
          actions.push({
            id: `optimize_composite_${tableName}_${compositeOpportunity.columns.join('_')}`,
            type: 'create_composite_index',
            priority: 'medium',
            table: tableName,
            indexName: `idx_${tableName}_composite_${compositeOpportunity.columns.join('_')}`,
            columns: compositeOpportunity.columns,
            replaces: compositeOpportunity.replaces,
            estimatedImpact: compositeOpportunity.impact,
            sql: `CREATE INDEX \`idx_${tableName}_composite_${compositeOpportunity.columns.join('_')}\` ON \`${tableName}\` (${compositeOpportunity.columns.map(c => `\`${c}\``).join(', ')})`,
            reasoning: `Composite index can replace ${compositeOpportunity.replaces.length} single-column indexes`
          });
        }
      }
    }
    
    return actions;
  }

  /**
   * Generate CREATE INDEX SQL
   */
  generateCreateIndexSQL(recommendation) {
    const tableName = recommendation.table;
    const indexName = recommendation.indexName || `idx_${tableName}_${recommendation.columns.join('_')}`;
    const columns = recommendation.columns || [];
    const unique = recommendation.unique ? 'UNIQUE ' : '';
    
    return `CREATE ${unique}INDEX \`${indexName}\` ON \`${tableName}\` (${columns.map(c => `\`${c}\``).join(', ')})`;
  }

  /**
   * Calculate overall plan priority
   */
  calculatePlanPriority(actions) {
    if (actions.length === 0) return 'low';
    
    const priorities = actions.map(action => action.priority);
    const hasHigh = priorities.includes('high');
    const hasMedium = priorities.includes('medium');
    
    if (hasHigh) return 'high';
    if (hasMedium) return 'medium';
    return 'low';
  }

  /**
   * Estimate performance impact
   */
  estimatePerformanceImpact(actions) {
    let totalImpact = 0;
    
    for (const action of actions) {
      switch (action.type) {
        case 'create_index':
          totalImpact += this.estimateCreateIndexImpact(action);
          break;
        case 'drop_index':
          totalImpact += this.estimateDropIndexImpact(action);
          break;
        case 'create_composite_index':
          totalImpact += this.estimateCompositeIndexImpact(action);
          break;
      }
    }
    
    return Math.min(100, Math.max(0, totalImpact));
  }

  /**
   * Estimate impact of creating an index
   */
  estimateCreateIndexImpact(action) {
    let impact = 20; // Base impact
    
    if (action.priority === 'high') impact += 30;
    if (action.priority === 'medium') impact += 15;
    
    if (action.unique) impact += 10;
    if (action.columns && action.columns.length > 1) impact += 15;
    
    return impact;
  }

  /**
   * Estimate impact of dropping an index
   */
  estimateDropIndexImpact(action) {
    let impact = 5; // Base impact for cleanup
    
    if (action.reason === 'duplicate') impact += 10;
    if (action.reason === 'unused') impact += 5;
    
    return impact;
  }

  /**
   * Estimate impact of composite index
   */
  estimateCompositeIndexImpact(action) {
    let impact = 25; // Base impact
    
    if (action.replaces) {
      impact += action.replaces.length * 5; // Bonus for consolidation
    }
    
    return impact;
  }

  /**
   * Assess optimization risks
   */
  assessOptimizationRisks(actions) {
    const risks = [];
    let riskLevel = 'low';
    
    for (const action of actions) {
      switch (action.type) {
        case 'create_index':
          if (action.priority === 'high') {
            risks.push({
              action: action.id,
              risk: 'Index creation on large table may impact performance',
              severity: 'medium'
            });
            riskLevel = 'medium';
          }
          break;
          
        case 'drop_index':
          if (action.reason === 'duplicate') {
            risks.push({
              action: action.id,
              risk: 'Verify no application dependencies before dropping',
              severity: 'low'
            });
          }
          break;
          
        case 'create_composite_index':
          risks.push({
            action: action.id,
            risk: 'Composite index may not benefit all query patterns',
            severity: 'medium'
          });
          if (riskLevel === 'low') riskLevel = 'medium';
          break;
      }
    }
    
    // Overall risk assessment
    if (actions.length > this.options.maxBatchSize) {
      risks.push({
        action: 'plan_overall',
        risk: 'Large number of operations may impact system performance',
        severity: 'high'
      });
      riskLevel = 'high';
    }
    
    return {
      level: riskLevel,
      risks: risks,
      recommendations: this.generateRiskMitigationRecommendations(risks)
    };
  }

  /**
   * Generate risk mitigation recommendations
   */
  generateRiskMitigationRecommendations(risks) {
    const recommendations = [];
    
    const hasHighRisk = risks.some(r => r.severity === 'high');
    const hasMediumRisk = risks.some(r => r.severity === 'medium');
    
    if (hasHighRisk) {
      recommendations.push('Execute operations during low-traffic periods');
      recommendations.push('Create backup before executing plan');
      recommendations.push('Monitor system performance during execution');
    }
    
    if (hasMediumRisk) {
      recommendations.push('Test plan on staging environment first');
      recommendations.push('Execute in smaller batches');
    }
    
    recommendations.push('Verify application compatibility');
    recommendations.push('Have rollback plan ready');
    
    return recommendations;
  }

  /**
   * Analyze composite index opportunities
   */
  analyzeCompositeOpportunity(singleColumnIndexes) {
    const opportunity = {
      viable: false,
      columns: [],
      replaces: [],
      impact: 0
    };
    
    // Simple heuristic: combine frequently used single-column indexes
    const sortedIndexes = singleColumnIndexes
      .sort((a, b) => (b.usage?.examined || 0) - (a.usage?.examined || 0))
      .slice(0, 3); // Max 3 columns for composite
    
    if (sortedIndexes.length >= 2) {
      opportunity.viable = true;
      opportunity.columns = sortedIndexes.map(idx => idx.columns[0].name);
      opportunity.replaces = sortedIndexes.map(idx => idx.name);
      opportunity.impact = sortedIndexes.length * 10; // Basic impact calculation
    }
    
    return opportunity;
  }

  /**
   * Generate optimization summary
   */
  generateOptimizationSummary(plan) {
    const summary = {
      totalActions: plan.actions.length,
      actionsByType: {},
      estimatedImpact: plan.estimatedImpact,
      priority: plan.priority,
      riskLevel: plan.riskAssessment.level
    };
    
    // Count actions by type
    for (const action of plan.actions) {
      summary.actionsByType[action.type] = (summary.actionsByType[action.type] || 0) + 1;
    }
    
    return summary;
  }
}

module.exports = OptimizationPlanner;
