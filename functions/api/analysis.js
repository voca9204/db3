/**
 * Analysis API Module - DB3 Database Query System
 * Contains business analysis APIs for user behavior and marketing insights
 */

const functions = require('firebase-functions');
const cors = require('cors')({ 
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

// Import database utilities
const { executeQuery, queryOne } = require('../db');

// Import authentication utilities
const admin = require('firebase-admin');

// Import inactive new users analysis
const { getInactiveNewUsers } = require('../inactiveNewUsersAnalysis');

/**
 * Authentication middleware for protected APIs
 */
async function authenticateUser(req, res, callback) {
  // 개발 환경에서는 인증 우회 (localhost, 127.0.0.1, 에뮬레이터 감지)
  const host = req.get('host') || '';
  const isDevelopment = host.includes('localhost') || 
                       host.includes('127.0.0.1') ||
                       process.env.FUNCTIONS_EMULATOR === 'true' ||
                       process.env.NODE_ENV !== 'production';
  
  if (isDevelopment) {
    console.log('🧪 개발 모드 감지: 인증 우회, Host:', host);
    req.user = { email: 'dev@localhost', uid: 'dev-mode' };
    return await callback();
  }
  
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: "error",
      message: "Authentication required"
    });
  }

  try {
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Check if user email is authorized
    const authorizedEmail = 'sandscasino8888@gmail.com';
    if (decodedToken.email !== authorizedEmail) {
      return res.status(403).json({
        status: "error",
        message: "Access denied"
      });
    }
    
    req.user = decodedToken;
    await callback();
    
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({
      status: "error",
      message: "Invalid authentication token"
    });
  }
}

/**
 * User Game Activity Analysis
 * Returns detailed game activity statistics for users
 */
exports.getUserGameActivity = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    await authenticateUser(req, res, async () => {
    try {
      const { limit = 100, minNetBet = 0, minGameDays = 0 } = req.query;
      
      const sql = `
        SELECT 
            p.userId,
            COUNT(DISTINCT gs.gameDate) as totalGameDays,
            ROUND(SUM(gs.totalBet)) as totalBetAmount,
            ROUND(SUM(gs.netBet)) as totalNetBet,
            ROUND(SUM(gs.winLoss)) as totalWinLoss,
            MIN(gs.gameDate) as firstGameDate,
            MAX(gs.gameDate) as lastGameDate,
            DATEDIFF(CURDATE(), MAX(gs.gameDate)) as daysSinceLastGame,
            CASE 
                WHEN DATEDIFF(CURDATE(), MAX(gs.gameDate)) <= 30 THEN 'active'
                ELSE 'dormant'
            END as activityStatus
        FROM players p
        JOIN game_scores gs ON p.userId = gs.userId
        GROUP BY p.userId
        HAVING totalGameDays >= ? AND totalNetBet >= ?
        ORDER BY totalNetBet DESC
        LIMIT ?
      `;
      
      const params = [
        parseInt(minGameDays), 
        parseFloat(minNetBet), 
        parseInt(limit)
      ];
      
      const results = await executeQuery(sql, params);
      
      res.json({
        status: "success",
        count: results.length,
        filters: { minNetBet, minGameDays, limit },
        data: results,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('User game activity query error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
    });
  });
});

/**
 * Dormant Users Query  
 * Returns users who haven't been active for specified period
 */
exports.getDormantUsers = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    await authenticateUser(req, res, async () => {
    try {
      const { 
        limit = 50, 
        minNetBet = 0, 
        minGameDays = 0,
        minDormantDays = 30
      } = req.query;
      
      const sql = `
        SELECT 
            p.userId,
            COUNT(DISTINCT gs.gameDate) as totalGameDays,
            ROUND(SUM(gs.netBet)) as totalNetBet,
            ROUND(SUM(gs.winLoss)) as totalWinLoss,
            MIN(gs.gameDate) as firstGameDate,
            MAX(gs.gameDate) as lastGameDate,
            DATEDIFF(CURDATE(), MAX(gs.gameDate)) as daysSinceLastGame
        FROM players p
        JOIN game_scores gs ON p.userId = gs.userId
        GROUP BY p.userId
        HAVING totalGameDays >= ? 
           AND totalNetBet >= ?
           AND daysSinceLastGame >= ?
        ORDER BY totalNetBet DESC
        LIMIT ?
      `;
      
      const params = [
        parseInt(minGameDays), 
        parseFloat(minNetBet), 
        parseInt(minDormantDays),
        parseInt(limit)
      ];
      
      const results = await executeQuery(sql, params);
      
      res.json({
        status: "success",
        count: results.length,
        filters: { minNetBet, minGameDays, minDormantDays, limit },
        data: results,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Dormant users query error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Event Participation Analysis
 * Returns event participation statistics for users
 */
exports.getEventParticipationAnalysis = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    await authenticateUser(req, res, async () => {
    try {
      const { limit = 50 } = req.query;
      
      const sql = `
        SELECT 
            p.userId,
            COUNT(pp.promotion) as totalEvents,
            ROUND(SUM(pp.reward)) as totalRewards,
            COUNT(CASE WHEN pp.status = 1 THEN 1 END) as appliedEvents,
            COUNT(CASE WHEN pp.status = 0 THEN 1 END) as pendingEvents,
            COUNT(CASE WHEN pp.status = 2 THEN 1 END) as dismissedEvents,
            MIN(pp.appliedAt) as firstEventDate,
            MAX(pp.appliedAt) as lastEventDate
        FROM players p
        JOIN promotion_players pp ON p.id = pp.player
        GROUP BY p.userId
        HAVING totalEvents > 0
        ORDER BY totalRewards DESC
        LIMIT ?
      `;
      
      const results = await executeQuery(sql, [parseInt(limit)]);
      
      res.json({
        status: "success",
        count: results.length,
        filters: { limit },
        data: results,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Event participation query error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
    });
  });
});

/**
 * Inactive New Users Analysis
 * Returns analysis of users who joined but never played
 */
exports.getInactiveNewUsersAnalysis = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      console.log('🔍 Starting inactive new users analysis...');
      
      const result = await getInactiveNewUsers();
      
      if (result.success) {
        res.json({
          status: "success",
          data: result.data,
          analysis: result.analysis,
          performance: result.performance,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          status: "error",
          message: result.error,
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error('Inactive new users analysis error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
});

/**
 * Download Inactive Users CSV
 * Downloads CSV file of inactive users for marketing campaigns
 */
exports.downloadInactiveUsersCSV = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    try {
      console.log('📥 미활성 사용자 CSV 다운로드 요청...');
      
      // Get inactive users data
      const result = await getInactiveNewUsers();
      
      if (!result.success) {
        return res.status(500).json({
          status: "error",
          message: result.error
        });
      }

      // CSV headers
      const csvHeaders = ['유저ID', '대표ID', '가입날짜', '가입기간', '가입후경과일', '그룹총NetBet'];
      
      // Generate CSV data
      const csvData = result.data.map(user => [
        user.userId || '',
        user.representative_userId || '',
        user.join_date ? new Date(user.join_date).toISOString().split('T')[0] : '',
        user.join_period || '',
        user.days_since_join || '',
        user.group_total_netbet ? Math.round(user.group_total_netbet).toLocaleString() : '0'
      ]);

      // Generate CSV string
      const csvContent = [
        csvHeaders.join(','),
        ...csvData.map(row => row.map(field => {
          if (field === '' || field === null || field === undefined) {
            return '""';
          }
          return `"${field}"`;
        }).join(','))
      ].join('\n');

      // Add UTF-8 BOM for Excel compatibility
      const bom = '\uFEFF';
      const csvWithBom = bom + csvContent;

      // Set CSV response headers
      const fileName = `inactive_users_${new Date().toISOString().split('T')[0]}.csv`;
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      
      console.log(`✅ CSV 파일 생성 완료: ${fileName}, 데이터 수: ${result.data.length}`);
      
      return res.send(csvWithBom);
      
    } catch (error) {
      console.error('❌ CSV 다운로드 오류:', error);
      return res.status(500).json({
        status: "error",
        message: error.message
      });
    }
    });
  });
});

/**
 * High Activity Dormant Users Analysis
 * Returns users with high past activity who are currently dormant
 */
exports.getHighActivityDormantUsers = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    await authenticateUser(req, res, async () => {
    try {
      // Pagination parameters
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const representativeOnly = req.query.representativeOnly === 'true'; // 새로운 매개변수
      const offset = (page - 1) * limit;
      
      // 날짜 기준 매개변수 추가 (기본값: 2025-05-01로 고정)
      const recentThresholdDate = req.query.recentThreshold || '2025-05-01';
      
      console.log(`[HIGH-ACTIVITY-DORMANT] ${req.requestId}: Page ${page}, Limit ${limit}, Offset ${offset}, RecentThreshold: ${recentThresholdDate}`);

      const startTime = Date.now();

      // Get total count
      const countQuery = `
        WITH monthly_game_days AS (
          SELECT 
            userId,
            DATE_FORMAT(gameDate, '%Y-%m') as game_month,
            COUNT(DISTINCT gameDate) as monthly_days
          FROM game_scores 
          GROUP BY userId, DATE_FORMAT(gameDate, '%Y-%m')
        ),
        active_months AS (
          SELECT 
            userId,
            COUNT(*) as months_with_10plus_days
          FROM monthly_game_days 
          WHERE monthly_days >= 10
          GROUP BY userId
          HAVING COUNT(*) >= 3
        ),
        recent_activity AS (
          SELECT DISTINCT userId
          FROM game_scores 
          WHERE gameDate >= ?  -- 매개변수로 받은 날짜 사용
        ),
        group_representatives AS (
          SELECT 
            pg.guild,
            p.userId as representative_id,
            ROW_NUMBER() OVER (PARTITION BY pg.guild ORDER BY COALESCE(MAX(gs.gameDate), '1900-01-01') DESC) as rn
          FROM player_guilds pg
          JOIN players p ON pg.player = p.id
          LEFT JOIN game_scores gs ON p.userId = gs.userId
          GROUP BY pg.guild, p.userId
        ),
        event_counts AS (
          SELECT 
            p.userId,
            COUNT(pp.promotion) as total_events,
            COUNT(CASE WHEN pp.appliedAt IS NOT NULL THEN 1 END) as applied_events
          FROM players p
          LEFT JOIN promotion_players pp ON p.id = pp.player
          GROUP BY p.userId
        )
        SELECT COUNT(DISTINCT p.userId) as total_count
        FROM active_months am
        JOIN players p ON p.userId = am.userId 
        JOIN game_scores gs ON gs.userId = p.userId
        LEFT JOIN recent_activity ra ON ra.userId = p.userId
        LEFT JOIN player_guilds pg ON p.id = pg.player
        LEFT JOIN group_representatives gr ON pg.guild = gr.guild AND gr.rn = 1
        WHERE ra.userId IS NULL
        ${representativeOnly ? 'AND (pg.guild IS NULL OR p.userId = gr.representative_id)' : ''}
      `;

      const countResult = await executeQuery(countQuery, [recentThresholdDate]);
      const totalCount = countResult[0]?.total_count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      // Main query with pagination - 대표ID 및 그룹 총 유효배팅 포함 + 연락처 정보 추가
      const queryText = `
        WITH monthly_game_days AS (
          SELECT 
            userId,
            DATE_FORMAT(gameDate, '%Y-%m') as game_month,
            COUNT(DISTINCT gameDate) as monthly_days
          FROM game_scores 
          GROUP BY userId, DATE_FORMAT(gameDate, '%Y-%m')
        ),
        active_months AS (
          SELECT 
            userId,
            COUNT(*) as months_with_10plus_days
          FROM monthly_game_days 
          WHERE monthly_days >= 10
          GROUP BY userId
          HAVING COUNT(*) >= 3
        ),
        recent_activity AS (
          SELECT DISTINCT userId
          FROM game_scores 
          WHERE gameDate >= ?  -- 매개변수로 받은 날짜 사용
        ),
        group_representatives AS (
          SELECT 
            pg.guild,
            p.userId as representative_id,
            ROW_NUMBER() OVER (PARTITION BY pg.guild ORDER BY COALESCE(MAX(gs.gameDate), '1900-01-01') DESC) as rn
          FROM player_guilds pg
          JOIN players p ON pg.player = p.id
          LEFT JOIN game_scores gs ON p.userId = gs.userId
          GROUP BY pg.guild, p.userId
        ),
        group_totals AS (
          SELECT 
            pg.guild,
            SUM(gs.netBet) as group_total_netbet,
            SUM(gs.winLoss) as group_total_winloss,
            COUNT(DISTINCT gs.gameDate) as group_total_game_days,
            MIN(gs.gameDate) as group_first_game_date
          FROM player_guilds pg
          JOIN players p ON pg.player = p.id
          JOIN game_scores gs ON p.userId = gs.userId
          GROUP BY pg.guild
        ),
        event_counts AS (
          SELECT 
            p.userId,
            COUNT(pp.promotion) as total_events,
            COUNT(CASE WHEN pp.appliedAt IS NOT NULL THEN 1 END) as applied_events
          FROM players p
          LEFT JOIN promotion_players pp ON p.id = pp.player
          GROUP BY p.userId
        ),
        contact_info AS (
          SELECT 
            p.userId,
            MAX(CASE WHEN pc.contactType = 'phone' THEN pc.contact END) as phone_number,
            MAX(CASE WHEN pc.contactType = 'wechat' THEN pc.contact END) as wechat_id,
            p.phoneName as phone_memo,
            p.note as additional_note
          FROM players p
          LEFT JOIN player_contacts pc ON p.id = pc.player
          GROUP BY p.userId, p.phoneName, p.note
        )
        SELECT 
          p.userId,
          am.months_with_10plus_days,
          COUNT(DISTINCT gs.gameDate) as total_game_days,
          ROUND(SUM(gs.netBet)) as individual_netbet,
          ROUND(SUM(gs.winLoss)) as individual_winloss,
          MIN(gs.gameDate) as first_game_date,
          MAX(gs.gameDate) as last_game_date,
          DATEDIFF('2025-05-31', MAX(gs.gameDate)) as days_since_last_game,
          ROUND(SUM(gs.netBet) / COUNT(DISTINCT gs.gameDate)) as avg_daily_netbet,
          pg.guild as group_id,
          gr.representative_id,
          CASE WHEN p.userId = gr.representative_id THEN 'Y' ELSE 'N' END as is_representative,
          ROUND(COALESCE(gt.group_total_netbet, SUM(gs.netBet))) as group_total_netbet,
          ROUND(COALESCE(gt.group_total_winloss, SUM(gs.winLoss))) as group_total_winloss,
          COALESCE(gt.group_total_game_days, COUNT(DISTINCT gs.gameDate)) as group_total_game_days,
          COALESCE(gt.group_first_game_date, MIN(gs.gameDate)) as group_first_game_date,
          COALESCE(ec.applied_events, 0) as event_count,
          ci.phone_number,
          ci.wechat_id,
          ci.phone_memo,
          ci.additional_note,
          CASE 
            WHEN ci.phone_number IS NOT NULL AND ci.wechat_id IS NOT NULL THEN 'Both'
            WHEN ci.phone_number IS NOT NULL THEN 'Phone'
            WHEN ci.wechat_id IS NOT NULL THEN 'WeChat'
            ELSE 'None'
          END as contact_availability
        FROM active_months am
        JOIN players p ON p.userId = am.userId 
        JOIN game_scores gs ON gs.userId = p.userId
        LEFT JOIN recent_activity ra ON ra.userId = p.userId
        LEFT JOIN player_guilds pg ON p.id = pg.player
        LEFT JOIN group_representatives gr ON pg.guild = gr.guild AND gr.rn = 1
        LEFT JOIN group_totals gt ON pg.guild = gt.guild
        LEFT JOIN event_counts ec ON p.userId = ec.userId
        LEFT JOIN contact_info ci ON p.userId = ci.userId
        WHERE ra.userId IS NULL
        ${representativeOnly ? 'AND (pg.guild IS NULL OR p.userId = gr.representative_id)' : ''}
        GROUP BY p.userId, am.months_with_10plus_days, pg.guild, gr.representative_id, gt.group_total_netbet, gt.group_total_winloss, gt.group_total_game_days, gt.group_first_game_date, ci.phone_number, ci.wechat_id, ci.phone_memo, ci.additional_note
        ORDER BY COALESCE(gt.group_total_netbet, SUM(gs.netBet)) DESC
        LIMIT ? OFFSET ?
      `;

      const results = await executeQuery(queryText, [recentThresholdDate, limit, offset]);
      const queryTime = Date.now() - startTime;

      // Classification logic - 그룹 전체 유효배팅 기준으로 등급 분류
      const classifiedResults = results.map(user => {
        const groupNetBet = user.group_total_netbet || user.individual_netbet || 0;
        const gameDays = user.total_game_days || 0;
        
        let tier = 'Basic';
        // Premium: 그룹 전체 유효배팅 500만원+ AND 게임일수 200일+
        if (groupNetBet >= 5000000 && gameDays >= 200) tier = 'Premium';
        // High: 그룹 전체 유효배팅 130만원+ AND 게임일수 120일+
        else if (groupNetBet >= 1300000 && gameDays >= 120) tier = 'High';
        // Medium: 그룹 전체 유효배팅 20만원+ AND 게임일수 80일+
        else if (groupNetBet >= 200000 && gameDays >= 80) tier = 'Medium';
        // Basic: 하위 25% - 위 조건에 해당하지 않는 사용자
        
        return {
          ...user,
          tier,
          priority: tier === 'Premium' ? 1 : tier === 'High' ? 2 : tier === 'Medium' ? 3 : 4,
          // 보고서 표시용: 그룹ID 대신 대표ID 또는 단독 표시
          display_representative: user.representative_id || '단독',
          // 그룹 정보: 그룹에 속한 경우만 대표ID, 아니면 단독
          group_status: user.group_id ? 
            (user.is_representative === 'Y' ? `대표 (${user.representative_id})` : `연결 (${user.representative_id})`) 
            : '단독'
        };
      });

      const tierCounts = classifiedResults.reduce((acc, user) => {
        acc[user.tier] = (acc[user.tier] || 0) + 1;
        return acc;
      }, {});

      res.json({
        status: "success",
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        summary: {
          totalUsers: totalCount,
          tierDistribution: tierCounts,
          queryTime: `${queryTime}ms`
        },
        data: classifiedResults,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('High activity dormant users analysis error:', error);
      res.status(500).json({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
    });
  });
});
