/**
 * Filter Presets for Common Use Cases
 * Task 1.3: Pre-configured filter combinations for marketing analysis
 */

const FilterEngine = require('./FilterEngine');

class FilterPresets {
  
  /**
   * High Value Users Filter
   * Users with significant betting activity
   */
  static createHighValueUsersFilter(minNetBet = 100000, minGameDays = 10) {
    return new FilterEngine()
      .setTable('players')
      .select([
        'p.userId',
        'COUNT(DISTINCT gs.gameDate) as totalGameDays',
        'ROUND(SUM(gs.netBet)) as totalNetBet',
        'ROUND(SUM(gs.winLoss)) as totalWinLoss',
        'MAX(gs.gameDate) as lastGameDate'
      ])
      .join('game_scores gs', 'p.userId', '=', 'gs.userId')
      .addUserStatusFilter(0) // Active users only
      .addHavingFilter('SUM(gs.netBet)', '>=', minNetBet)
      .addHavingFilter('COUNT(DISTINCT gs.gameDate)', '>=', minGameDays);
  }

  /**
   * Dormant Users Filter  
   * Users who haven't played recently but have history
   */
  static createDormantUsersFilter(minDormantDays = 30, minHistoricalBet = 50000) {
    return new FilterEngine()
      .setTable('players')
      .select([
        'p.userId',
        'COUNT(DISTINCT gs.gameDate) as totalGameDays',
        'ROUND(SUM(gs.netBet)) as totalNetBet',
        'MAX(gs.gameDate) as lastGameDate',
        'DATEDIFF(CURDATE(), MAX(gs.gameDate)) as daysSinceLastGame'
      ])
      .join('game_scores gs', 'p.userId', '=', 'gs.userId')
      .addUserStatusFilter(0)
      .addHavingFilter('SUM(gs.netBet)', '>=', minHistoricalBet)
      .addActivityFilter('dormant', minDormantDays);
  }

  /**
   * New Active Users Filter
   * Recently joined users with good activity
   */
  static createNewActiveUsersFilter(maxDaysSinceFirst = 30, minGameDays = 5) {
    return new FilterEngine()
      .setTable('players')
      .select([
        'p.userId',
        'COUNT(DISTINCT gs.gameDate) as totalGameDays',
        'ROUND(SUM(gs.netBet)) as totalNetBet',
        'MIN(gs.gameDate) as firstGameDate',
        'MAX(gs.gameDate) as lastGameDate',
        'DATEDIFF(CURDATE(), MIN(gs.gameDate)) as daysSinceFirstGame'
      ])
      .join('game_scores gs', 'p.userId', '=', 'gs.userId')
      .addUserStatusFilter(0)
      .addHavingFilter('COUNT(DISTINCT gs.gameDate)', '>=', minGameDays)
      .addHavingFilter('DATEDIFF(CURDATE(), MIN(gs.gameDate))', '<=', maxDaysSinceFirst);
  }

  /**
   * Event Participants Filter
   * Users who participated in promotions
   */
  static createEventParticipantsFilter(minEvents = 1, minRewards = 0) {
    return new FilterEngine()
      .setTable('players')
      .select([
        'p.userId',
        'COUNT(pp.promotion) as totalEvents',
        'ROUND(SUM(pp.reward)) as totalRewards',
        'COUNT(CASE WHEN pp.status = 1 THEN 1 END) as appliedEvents'
      ])
      .join('promotion_players pp', 'p.id', '=', 'pp.player')
      .addUserStatusFilter(0)
      .addHavingFilter('COUNT(pp.promotion)', '>=', minEvents)
      .addHavingFilter('SUM(pp.reward)', '>=', minRewards);
  }

  /**
   * Recent Big Spenders Filter
   * Users with high recent activity
   */
  static createRecentBigSpendersFilter(daysPeriod = 7, minRecentBet = 50000) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysPeriod);
    const startDateStr = startDate.toISOString().split('T')[0];

    return new FilterEngine()
      .setTable('players')
      .select([
        'p.userId',
        'COUNT(DISTINCT gs.gameDate) as recentGameDays',
        'ROUND(SUM(gs.netBet)) as recentNetBet',
        'ROUND(SUM(gs.winLoss)) as recentWinLoss'
      ])
      .join('game_scores gs', 'p.userId', '=', 'gs.userId')
      .addUserStatusFilter(0)
      .addDateRangeFilter('gs.gameDate', startDateStr, null)
      .addHavingFilter('SUM(gs.netBet)', '>=', minRecentBet);
  }

  /**
   * Consistent Players Filter
   * Regular players with consistent activity
   */
  static createConsistentPlayersFilter(minGameDays = 20, minConsistencyRatio = 0.1) {
    return new FilterEngine()
      .setTable('players')
      .select([
        'p.userId',
        'COUNT(DISTINCT gs.gameDate) as totalGameDays',
        'DATEDIFF(MAX(gs.gameDate), MIN(gs.gameDate)) as totalDaysPeriod',
        'ROUND(COUNT(DISTINCT gs.gameDate) / DATEDIFF(MAX(gs.gameDate), MIN(gs.gameDate)), 3) as consistencyRatio',
        'ROUND(SUM(gs.netBet)) as totalNetBet'
      ])
      .join('game_scores gs', 'p.userId', '=', 'gs.userId')
      .addUserStatusFilter(0)
      .addHavingFilter('COUNT(DISTINCT gs.gameDate)', '>=', minGameDays)
      .addHavingFilter('COUNT(DISTINCT gs.gameDate) / DATEDIFF(MAX(gs.gameDate), MIN(gs.gameDate))', '>=', minConsistencyRatio);
  }

  /**
   * Risk Users Filter
   * Users with unusual patterns that might need attention
   */
  static createRiskUsersFilter(maxWinLossRatio = -0.8, minTotalBet = 100000) {
    return new FilterEngine()
      .setTable('players')
      .select([
        'p.userId',
        'ROUND(SUM(gs.netBet)) as totalNetBet',
        'ROUND(SUM(gs.winLoss)) as totalWinLoss',
        'ROUND(SUM(gs.winLoss) / SUM(gs.netBet), 3) as winLossRatio',
        'COUNT(DISTINCT gs.gameDate) as totalGameDays'
      ])
      .join('game_scores gs', 'p.userId', '=', 'gs.userId')
      .addUserStatusFilter(0)
      .addHavingFilter('SUM(gs.netBet)', '>=', minTotalBet)
      .addHavingFilter('SUM(gs.winLoss) / SUM(gs.netBet)', '<=', maxWinLossRatio);
  }

  /**
   * VIP Candidates Filter
   * Users who might be good VIP candidates
   */
  static createVIPCandidatesFilter(minNetBet = 500000, minGameDays = 30, maxDaysSinceLastGame = 7) {
    return new FilterEngine()
      .setTable('players')
      .select([
        'p.userId',
        'COUNT(DISTINCT gs.gameDate) as totalGameDays',
        'ROUND(SUM(gs.netBet)) as totalNetBet',
        'ROUND(AVG(gs.netBet)) as avgDailyBet',
        'MAX(gs.gameDate) as lastGameDate',
        'DATEDIFF(CURDATE(), MAX(gs.gameDate)) as daysSinceLastGame'
      ])
      .join('game_scores gs', 'p.userId', '=', 'gs.userId')
      .addUserStatusFilter(0)
      .addHavingFilter('SUM(gs.netBet)', '>=', minNetBet)
      .addHavingFilter('COUNT(DISTINCT gs.gameDate)', '>=', minGameDays)
      .addHavingFilter('DATEDIFF(CURDATE(), MAX(gs.gameDate))', '<=', maxDaysSinceLastGame);
  }

  /**
   * Reactivation Targets Filter
   * Dormant users with good historical value for reactivation campaigns
   */
  static createReactivationTargetsFilter(minDormantDays = 14, maxDormantDays = 90, minHistoricalValue = 100000) {
    return new FilterEngine()
      .setTable('players')
      .select([
        'p.userId',
        'COUNT(DISTINCT gs.gameDate) as totalGameDays',
        'ROUND(SUM(gs.netBet)) as totalNetBet',
        'MAX(gs.gameDate) as lastGameDate',
        'DATEDIFF(CURDATE(), MAX(gs.gameDate)) as daysSinceLastGame',
        'ROUND(SUM(gs.netBet) / COUNT(DISTINCT gs.gameDate)) as avgDailyValue'
      ])
      .join('game_scores gs', 'p.userId', '=', 'gs.userId')
      .addUserStatusFilter(0)
      .addHavingFilter('SUM(gs.netBet)', '>=', minHistoricalValue)
      .addHavingFilter('DATEDIFF(CURDATE(), MAX(gs.gameDate))', '>=', minDormantDays)
      .addHavingFilter('DATEDIFF(CURDATE(), MAX(gs.gameDate))', '<=', maxDormantDays);
  }

  /**
   * Get all available preset names
   */
  static getAvailablePresets() {
    return [
      'highValueUsers',
      'dormantUsers',
      'newActiveUsers',
      'eventParticipants',
      'recentBigSpenders',
      'consistentPlayers',
      'riskUsers',
      'vipCandidates',
      'reactivationTargets'
    ];
  }

  /**
   * Create filter by preset name
   */
  static createByName(presetName, options = {}) {
    switch (presetName) {
      case 'highValueUsers':
        return this.createHighValueUsersFilter(
          options.minNetBet, 
          options.minGameDays
        );
      case 'dormantUsers':
        return this.createDormantUsersFilter(
          options.minDormantDays, 
          options.minHistoricalBet
        );
      case 'newActiveUsers':
        return this.createNewActiveUsersFilter(
          options.maxDaysSinceFirst, 
          options.minGameDays
        );
      case 'eventParticipants':
        return this.createEventParticipantsFilter(
          options.minEvents, 
          options.minRewards
        );
      case 'recentBigSpenders':
        return this.createRecentBigSpendersFilter(
          options.daysPeriod, 
          options.minRecentBet
        );
      case 'consistentPlayers':
        return this.createConsistentPlayersFilter(
          options.minGameDays, 
          options.minConsistencyRatio
        );
      case 'riskUsers':
        return this.createRiskUsersFilter(
          options.maxWinLossRatio, 
          options.minTotalBet
        );
      case 'vipCandidates':
        return this.createVIPCandidatesFilter(
          options.minNetBet, 
          options.minGameDays, 
          options.maxDaysSinceLastGame
        );
      case 'reactivationTargets':
        return this.createReactivationTargetsFilter(
          options.minDormantDays, 
          options.maxDormantDays, 
          options.minHistoricalValue
        );
      default:
        throw new Error(`Unknown preset: ${presetName}`);
    }
  }
}

module.exports = FilterPresets;
