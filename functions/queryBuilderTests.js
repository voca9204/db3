/**
 * Query Builder Framework Test Functions for Firebase
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

// Query Builder Framework import
const { QueryBuilder, QueryTemplates, TransactionManager, db } = require('./src/database/index');

/**
 * Test Query Builder - Basic Functionality
 */
exports.testQueryBuilder = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      console.log('🧪 Testing Query Builder Framework...');
      
      const results = {
        queryBuilding: {},
        databaseExecution: {},
        performance: {},
        errors: []
      };

      // 1. Test Query Building (without execution)
      try {
        console.log('1. Testing query building...');
        
        // SELECT query
        const selectQuery = QueryBuilder.table('players')
          .select(['userId', 'email', 'created_at'])
          .where('active', true)
          .limit(5);
        
        const { sql: selectSql, params: selectParams } = selectQuery.toSQL();
        results.queryBuilding.select = { sql: selectSql, params: selectParams };

        // INSERT query
        const insertQuery = QueryBuilder.table('test_log')
          .insert({
            message: 'Query Builder Test',
            timestamp: new Date(),
            test_data: JSON.stringify({ framework: 'Firebase' })
          });
        
        const { sql: insertSql, params: insertParams } = insertQuery.toSQL();
        results.queryBuilding.insert = { sql: insertSql, params: insertParams };

        // Complex WHERE query
        const complexQuery = QueryBuilder.table('game_scores')
          .select(['userId', 'gameDate', 'totalBet', 'winLoss'])
          .where('totalBet', '>', 1000)
          .whereBetween('gameDate', '2024-01-01', '2024-12-31')
          .whereNotNull('winLoss')
          .orderBy('totalBet', 'DESC')
          .limit(10);
        
        const { sql: complexSql, params: complexParams } = complexQuery.toSQL();
        results.queryBuilding.complex = { sql: complexSql, params: complexParams };

        console.log('✅ Query building tests passed');
        
      } catch (error) {
        console.error('❌ Query building failed:', error);
        results.errors.push(`Query Building: ${error.message}`);
      }

      // 2. Test Database Execution
      try {
        console.log('2. Testing database execution...');
        
        const startTime = Date.now();
        
        // Initialize database
        await db.initialize();
        
        // Test simple query execution
        const testResult = await db.query('SELECT 1 as test, NOW() as timestamp');
        results.databaseExecution.connectionTest = testResult.results[0];
        
        // Test Query Builder execution
        const players = await QueryBuilder.table('players')
          .select(['userId', 'email'])
          .limit(3)
          .get();
        
        results.databaseExecution.playersQuery = {
          count: players.length,
          sample: players[0] || null
        };

        // Test count query
        const playerCount = await QueryBuilder.table('players').count();
        results.databaseExecution.totalPlayers = playerCount;

        const executionTime = Date.now() - startTime;
        results.performance.totalExecutionTime = `${executionTime}ms`;
        
        console.log('✅ Database execution tests passed');
        
      } catch (error) {
        console.error('❌ Database execution failed:', error);
        results.errors.push(`Database Execution: ${error.message}`);
      }

      // 3. Test Query Templates
      try {
        console.log('3. Testing query templates...');
        
        // Test findById template
        const findByIdQuery = QueryTemplates.findById('players', 1, ['userId', 'email']);
        const { sql: templateSql, params: templateParams } = findByIdQuery.toSQL();
        results.queryBuilding.template = { sql: templateSql, params: templateParams };
        
        console.log('✅ Query templates tests passed');
        
      } catch (error) {
        console.error('❌ Query templates failed:', error);
        results.errors.push(`Query Templates: ${error.message}`);
      }

      // 4. Test performance stats
      try {
        const stats = await db.getStats();
        results.performance.databaseStats = stats;
        
      } catch (error) {
        console.error('⚠️ Stats collection failed:', error);
        results.errors.push(`Stats Collection: ${error.message}`);
      }

      // Response
      const success = results.errors.length === 0;
      res.status(success ? 200 : 500).json({
        status: success ? "success" : "partial_failure",
        message: success ? "Query Builder Framework working correctly" : "Some tests failed",
        results,
        timestamp: new Date().toISOString(),
        environment: "Firebase Functions"
      });

    } catch (error) {
      console.error('❌ Test function failed:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Test Query Builder - Advanced Features
 */
exports.testQueryBuilderAdvanced = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      console.log('🚀 Testing Advanced Query Builder Features...');
      
      const results = {
        joins: {},
        aggregations: {},
        transactions: {},
        errors: []
      };

      await db.initialize();

      // Test JOIN operations
      try {
        console.log('1. Testing JOIN operations...');
        
        const joinQuery = QueryBuilder.table('players')
          .select(['players.userId', 'players.email', 'COUNT(game_scores.id) as game_count'])
          .leftJoin('game_scores', 'players.userId', 'game_scores.userId')
          .groupBy('players.userId', 'players.email')
          .having('game_count', '>', 0)
          .orderBy('game_count', 'DESC')
          .limit(5);

        const { sql: joinSql, params: joinParams } = joinQuery.toSQL();
        results.joins.query = { sql: joinSql, params: joinParams };

        // Execute join query
        const joinResults = await joinQuery.get();
        results.joins.execution = {
          count: joinResults.length,
          sample: joinResults[0] || null
        };

        console.log('✅ JOIN tests passed');
        
      } catch (error) {
        console.error('❌ JOIN tests failed:', error);
        results.errors.push(`JOIN: ${error.message}`);
      }

      // Test Aggregations
      try {
        console.log('2. Testing aggregations...');
        
        const aggregateQuery = QueryBuilder.table('game_scores')
          .select([
            'userId',
            'COUNT(*) as total_games',
            'SUM(totalBet) as total_bet',
            'AVG(winLoss) as avg_win_loss',
            'MAX(gameDate) as last_game'
          ])
          .where('gameDate', '>=', '2024-01-01')
          .groupBy('userId')
          .having('total_games', '>', 5)
          .orderBy('total_bet', 'DESC')
          .limit(3);

        const { sql: aggSql, params: aggParams } = aggregateQuery.toSQL();
        results.aggregations.query = { sql: aggSql, params: aggParams };

        const aggResults = await aggregateQuery.get();
        results.aggregations.execution = {
          count: aggResults.length,
          sample: aggResults[0] || null
        };

        console.log('✅ Aggregation tests passed');
        
      } catch (error) {
        console.error('❌ Aggregation tests failed:', error);
        results.errors.push(`Aggregations: ${error.message}`);
      }

      // Test Transactions
      try {
        console.log('3. Testing transactions...');
        
        const transactionResult = await TransactionManager.run(async (transaction) => {
          // Create a test log entry
          const { results: [insertResult] } = await transaction.executeQuery(
            QueryBuilder.table('players')
              .select(['userId'])
              .limit(1)
          );

          if (insertResult && insertResult.length > 0) {
            const testUserId = insertResult[0].userId;
            
            // Test query within transaction
            const userQuery = await transaction.executeQuery(
              QueryBuilder.table('players')
                .select(['userId', 'email'])
                .where('userId', testUserId)
            );
            
            return {
              userId: testUserId,
              queryResult: userQuery.results[0] || null
            };
          }
          
          return { message: 'No test data available' };
        });

        results.transactions.execution = transactionResult;
        console.log('✅ Transaction tests passed');
        
      } catch (error) {
        console.error('❌ Transaction tests failed:', error);
        results.errors.push(`Transactions: ${error.message}`);
      }

      const success = results.errors.length === 0;
      res.json({
        status: success ? "success" : "partial_failure",
        message: success ? "Advanced Query Builder features working correctly" : "Some advanced tests failed",
        results,
        timestamp: new Date().toISOString(),
        environment: "Firebase Functions"
      });

    } catch (error) {
      console.error('❌ Advanced test function failed:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Test Query Builder - Real World Scenarios
 */
exports.testQueryBuilderRealWorld = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      console.log('📊 Testing Real World Query Scenarios...');
      
      const results = {
        playerAnalysis: {},
        gameMetrics: {},
        promotionData: {},
        errors: []
      };

      await db.initialize();

      // 1. Player Analysis Query
      try {
        console.log('1. Testing player analysis query...');
        
        const playerAnalysis = await QueryBuilder.table('players')
          .select([
            'players.userId',
            'players.email',
            'COUNT(DISTINCT game_scores.gameDate) as active_days',
            'SUM(game_scores.totalBet) as total_wagered',
            'SUM(game_scores.winLoss) as net_result',
            'MAX(game_scores.gameDate) as last_activity'
          ])
          .leftJoin('game_scores', 'players.userId', 'game_scores.userId')
          .groupBy('players.userId', 'players.email')
          .having('total_wagered', '>', 0)
          .orderBy('total_wagered', 'DESC')
          .limit(5)
          .get();

        results.playerAnalysis = {
          count: playerAnalysis.length,
          topPlayer: playerAnalysis[0] || null
        };

        console.log('✅ Player analysis passed');
        
      } catch (error) {
        console.error('❌ Player analysis failed:', error);
        results.errors.push(`Player Analysis: ${error.message}`);
      }

      // 2. Game Metrics Query
      try {
        console.log('2. Testing game metrics query...');
        
        const gameMetrics = await QueryBuilder.table('game_scores')
          .select([
            'DATE(gameDate) as game_date',
            'COUNT(*) as total_games',
            'COUNT(DISTINCT userId) as unique_players',
            'SUM(totalBet) as daily_volume',
            'AVG(winLoss) as avg_result'
          ])
          .where('gameDate', '>=', '2024-01-01')
          .groupBy('DATE(gameDate)')
          .orderBy('game_date', 'DESC')
          .limit(7)
          .get();

        results.gameMetrics = {
          count: gameMetrics.length,
          latestDay: gameMetrics[0] || null
        };

        console.log('✅ Game metrics passed');
        
      } catch (error) {
        console.error('❌ Game metrics failed:', error);
        results.errors.push(`Game Metrics: ${error.message}`);
      }

      // 3. Promotion Data Query
      try {
        console.log('3. Testing promotion data query...');
        
        const promotionData = await QueryBuilder.table('promotion_players')
          .select([
            'promotion',
            'COUNT(*) as participant_count',
            'MIN(appliedAt) as first_application',
            'MAX(appliedAt) as last_application'
          ])
          .whereNotNull('appliedAt')
          .groupBy('promotion')
          .orderBy('participant_count', 'DESC')
          .limit(5)
          .get();

        results.promotionData = {
          count: promotionData.length,
          topPromotion: promotionData[0] || null
        };

        console.log('✅ Promotion data passed');
        
      } catch (error) {
        console.error('❌ Promotion data failed:', error);
        results.errors.push(`Promotion Data: ${error.message}`);
      }

      const success = results.errors.length === 0;
      res.json({
        status: success ? "success" : "partial_failure",
        message: success ? "Real world scenarios working correctly" : "Some real world tests failed",
        results,
        totalErrors: results.errors.length,
        timestamp: new Date().toISOString(),
        environment: "Firebase Functions"
      });

    } catch (error) {
      console.error('❌ Real world test function failed:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Test Query Builder - Error Handling
 */
exports.testQueryBuilderErrors = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      console.log('🔍 Testing Error Handling...');
      
      const results = {
        handledErrors: [],
        unexpectedErrors: []
      };

      await db.initialize();

      // Test 1: Invalid table name
      try {
        const invalidQuery = QueryBuilder.table('nonexistent_table')
          .select(['*'])
          .limit(1);
        
        await invalidQuery.get();
        results.unexpectedErrors.push('Invalid table query should have failed');
        
      } catch (error) {
        results.handledErrors.push({
          test: 'Invalid table name',
          error: error.message,
          handled: true
        });
      }

      // Test 2: SQL syntax error
      try {
        await db.query('SELECT * FROM WHERE');
        results.unexpectedErrors.push('Invalid SQL should have failed');
        
      } catch (error) {
        results.handledErrors.push({
          test: 'Invalid SQL syntax',
          error: error.message,
          handled: true
        });
      }

      // Test 3: Empty WHERE IN clause
      try {
        const emptyInQuery = QueryBuilder.table('players')
          .select(['*'])
          .whereIn('userId', []);
        
        emptyInQuery.toSQL();
        results.unexpectedErrors.push('Empty WHERE IN should have failed');
        
      } catch (error) {
        results.handledErrors.push({
          test: 'Empty WHERE IN clause',
          error: error.message,
          handled: true
        });
      }

      res.json({
        status: "success",
        message: "Error handling tests completed",
        results,
        summary: {
          handledErrors: results.handledErrors.length,
          unexpectedErrors: results.unexpectedErrors.length,
          errorHandlingWorking: results.unexpectedErrors.length === 0
        },
        timestamp: new Date().toISOString(),
        environment: "Firebase Functions"
      });

    } catch (error) {
      console.error('❌ Error handling test failed:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

module.exports = {
  testQueryBuilder: exports.testQueryBuilder,
  testQueryBuilderAdvanced: exports.testQueryBuilderAdvanced,
  testQueryBuilderRealWorld: exports.testQueryBuilderRealWorld,
  testQueryBuilderErrors: exports.testQueryBuilderErrors
};
