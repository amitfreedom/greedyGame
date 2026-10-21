const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'greedy_game_db',
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0,
    multipleStatements: true
});

async function initDatabase() {
    try {
        console.log('Connecting to MySQL database...');
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        
        const connection = await pool.getConnection();
        console.log('Running database migrations...');
        await connection.query(schemaSql);

        // Ensure app_user_id column exists for mobile app integration
        try {
            await connection.query('ALTER TABLE users ADD COLUMN app_user_id VARCHAR(128) NULL AFTER id');
            await connection.query('ALTER TABLE users ADD INDEX idx_app_user_id (app_user_id)');
            console.log('[Migration] Added app_user_id column to users table');
        } catch (e) {
            // Column already exists
        }

        // Ensure game_settings table exists for persistent house margin & config
        await connection.query(`
            CREATE TABLE IF NOT EXISTS game_settings (
                setting_key VARCHAR(64) PRIMARY KEY,
                setting_val TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        connection.release();
        console.log('Database initialized successfully!');
    } catch (err) {
        console.error('Error initializing database:', err.message);
        throw err;
    }
}

// User Helpers (Supports Mobile App BottomSheet URL Auth: userId, username, avatar, coins, diamonds)
async function loginOrSyncUser(data) {
    let { userId, username, avatar, avtar, coins, diamonds } = data || {};
    
    // Normalize avatar from either 'avatar' or 'avtar'
    const finalAvatarParam = avatar || avtar || 'avatar1';
    
    userId = (userId !== undefined && userId !== null && String(userId).trim() !== '') ? String(userId).trim() : null;
    username = (username !== undefined && username !== null && String(username).trim() !== '') ? String(username).trim() : null;
    const cleanAvatar = finalAvatarParam ? String(finalAvatarParam).trim() : 'avatar1';
    
    let coinsNum = (coins !== undefined && coins !== null && !isNaN(parseInt(coins))) ? parseInt(coins) : null;
    let diamondsNum = (diamonds !== undefined && diamonds !== null && !isNaN(parseInt(diamonds))) ? parseInt(diamonds) : null;

    let user = null;

    // 1. Try finding by app_user_id
    if (userId) {
        const [byAppId] = await pool.query('SELECT * FROM users WHERE app_user_id = ?', [userId]);
        if (byAppId.length > 0) {
            user = byAppId[0];
        } else if (/^\d+$/.test(userId)) {
            // Also check primary key id if numeric
            const [byId] = await pool.query('SELECT * FROM users WHERE id = ?', [parseInt(userId)]);
            if (byId.length > 0) {
                user = byId[0];
            }
        }
    }

    // 2. Try finding by username only if userId was not provided, or if existing user has no app_user_id yet
    if (!user && username) {
        if (!userId) {
            const [byUsername] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
            if (byUsername.length > 0) {
                user = byUsername[0];
            }
        } else {
            const [byUsername] = await pool.query('SELECT * FROM users WHERE username = ? AND (app_user_id IS NULL OR app_user_id = ?)', [username, userId]);
            if (byUsername.length > 0) {
                user = byUsername[0];
            }
        }
    }

    // 3. If user exists, update profile / sync wallet safely
    if (user) {
        const updates = [];
        const params = [];

        if (userId && !user.app_user_id) {
            updates.push('app_user_id = ?');
            params.push(userId);
        }
        if (username && username !== user.username) {
            const [conflict] = await pool.query('SELECT id FROM users WHERE username = ? AND id != ?', [username, user.id]);
            if (conflict.length === 0) {
                updates.push('username = ?');
                params.push(username);
            }
        }
        if (cleanAvatar && cleanAvatar !== user.avatar) {
            updates.push('avatar = ?');
            params.push(cleanAvatar);
        }
        // Only sync coins if explicitly requested via syncCoins/forceSync or if user has 0 coins and starting amount provided
        if (coinsNum !== null && (data.syncCoins === true || data.forceSync === true || (user.coins === 0 && coinsNum > 0))) {
            updates.push('coins = ?');
            params.push(coinsNum);
        }
        if (diamondsNum !== null && (data.syncDiamonds === true || data.forceSync === true || (user.diamonds === 0 && diamondsNum > 0))) {
            updates.push('diamonds = ?');
            params.push(diamondsNum);
        }

        if (updates.length > 0) {
            params.push(user.id);
            await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
            const [refreshed] = await pool.query('SELECT * FROM users WHERE id = ?', [user.id]);
            user = refreshed[0];
        }

        return user;
    }

    // 4. Create new user for this mobile app player
    const fallbackName = username || (userId ? `User_${userId}` : `Player_${Math.floor(1000 + Math.random() * 9000)}`);
    const initialCoins = coinsNum !== null ? coinsNum : 10000000;
    const initialDiamonds = diamondsNum !== null ? diamondsNum : 0;

    let insertUsername = fallbackName;
    const [nameCheck] = await pool.query('SELECT id FROM users WHERE username = ?', [insertUsername]);
    if (nameCheck.length > 0) {
        insertUsername = `${fallbackName}_${Math.floor(100 + Math.random() * 899)}`;
    }

    const [result] = await pool.query(
        'INSERT INTO users (app_user_id, username, avatar, coins, diamonds, today_profit, total_profit) VALUES (?, ?, ?, ?, ?, 0, 0)',
        [userId, insertUsername, cleanAvatar, initialCoins, initialDiamonds]
    );

    const [newUser] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    return newUser[0];
}

async function getOrCreateUser(username, avatar = 'avatar1') {
    return loginOrSyncUser({ username, avatar });
}

async function getUserById(userId) {
    if (!userId) return null;
    // Check primary key first if numeric (used across server internals)
    if (typeof userId === 'number' || /^\d+$/.test(String(userId))) {
        const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [parseInt(userId, 10)]);
        if (rows.length > 0) return rows[0];
    }
    // Check app_user_id (for mobile app external integration)
    const [byApp] = await pool.query('SELECT * FROM users WHERE app_user_id = ?', [String(userId)]);
    if (byApp.length > 0) return byApp[0];

    return null;
}

// Atomic deduction ensuring balance can never become negative or double-spent
async function deductUserCoins(userId, amount) {
    if (!userId || typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
        return null;
    }
    const [result] = await pool.query(
        'UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?',
        [amount, userId, amount]
    );
    if (result.affectedRows === 0) {
        return null; // Insufficient balance or user does not exist
    }
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    return rows[0] || null;
}

async function updateUserCoins(userId, amountDelta) {
    if (!userId || isNaN(amountDelta)) return null;
    if (amountDelta < 0) {
        return deductUserCoins(userId, Math.abs(amountDelta));
    }
    await pool.query('UPDATE users SET coins = COALESCE(coins, 0) + ? WHERE id = ?', [amountDelta, userId]);
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    return rows[0] || null;
}

async function updateUserProfit(userId, profitDelta, diamondsDelta = 0) {
    await pool.query(
        'UPDATE users SET today_profit = GREATEST(0, COALESCE(today_profit, 0) + ?), total_profit = GREATEST(0, COALESCE(total_profit, 0) + ?), diamonds = GREATEST(0, COALESCE(diamonds, 0) + ?) WHERE id = ?',
        [profitDelta, profitDelta, diamondsDelta, userId]
    );
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    return rows[0] || null;
}

async function updateRoundPayout(roundId, totalPayout) {
    if (!roundId) return;
    await pool.query(
        'UPDATE game_rounds SET total_payout_amount = ? WHERE id = ?',
        [totalPayout, roundId]
    );
}

// Round Helpers
async function saveRound(roundNumber, winningItem, multiplier, totalBets, totalPayout) {
    const [result] = await pool.query(
        'INSERT INTO game_rounds (round_number, winning_item, multiplier, total_bets_amount, total_payout_amount) VALUES (?, ?, ?, ?, ?)',
        [roundNumber, winningItem, multiplier, totalBets, totalPayout]
    );
    return result.insertId;
}

async function getLastRoundNumber() {
    const [rows] = await pool.query('SELECT round_number FROM game_rounds ORDER BY id DESC LIMIT 1');
    if (rows.length > 0) {
        return rows[0].round_number;
    }
    return 1478; // Starting default round number matching reference image!
}

async function getRecentRounds(limit = 10) {
    const [rows] = await pool.query(
        'SELECT round_number, winning_item, multiplier, created_at FROM game_rounds ORDER BY id DESC LIMIT ?',
        [limit]
    );
    return rows;
}

// Bet Helpers
async function saveBet(roundId, userId, itemId, amount, payout = 0, isWon = false) {
    const [result] = await pool.query(
        'INSERT INTO bets (round_id, user_id, item_id, amount, payout, is_won) VALUES (?, ?, ?, ?, ?, ?)',
        [roundId, userId, itemId, amount, payout, isWon]
    );
    return result.insertId;
}

async function getUserBetHistory(userId, limit = 20) {
    const [rows] = await pool.query(
        `SELECT b.*, r.round_number, r.winning_item 
         FROM bets b 
         JOIN game_rounds r ON b.round_id = r.id 
         WHERE b.user_id = ? 
         ORDER BY b.id DESC LIMIT ?`,
        [userId, limit]
    );
    return rows;
}

// Leaderboards
async function getTodayProfitRank(limit = 10) {
    const [rows] = await pool.query(
        'SELECT id, username, avatar, today_profit, diamonds FROM users WHERE today_profit > 0 ORDER BY today_profit DESC LIMIT ?',
        [limit]
    );
    return rows;
}

async function getGreedyKingRank(limit = 10) {
    const [rows] = await pool.query(
        'SELECT id, username, avatar, total_profit, diamonds FROM users ORDER BY diamonds DESC LIMIT ?',
        [limit]
    );
    return rows;
}

async function getRoundTopWinners(roundId, limit = 3) {
    const [rows] = await pool.query(
        `SELECT u.username, u.avatar, SUM(b.payout) as total_payout, SUM(b.amount) as total_bet
         FROM bets b
         JOIN users u ON b.user_id = u.id
         WHERE b.round_id = ? AND b.is_won = 1
         GROUP BY b.user_id, u.username, u.avatar
         ORDER BY total_payout DESC LIMIT ?`,
        [roundId, limit]
    );
    return rows;
}

async function getRandomGuestUsers(limit = 10) {
    const [rows] = await pool.query(
        'SELECT id, username, avatar, coins FROM users ORDER BY RAND() LIMIT ?',
        [limit]
    );
    return rows;
}

async function getBigWinner() {
    const [rows] = await pool.query(
        'SELECT id, username, avatar, today_profit, coins FROM users WHERE today_profit > 0 ORDER BY today_profit DESC LIMIT 1'
    );
    return rows[0] || null;
}

// Admin Panel Helpers
async function getAllUsers(search = '', limit = 50, offset = 0) {
    let sql = 'SELECT id, app_user_id, username, avatar, coins, diamonds, today_profit, total_profit, created_at FROM users';
    const params = [];
    if (search && String(search).trim() !== '') {
        const isNum = /^\d+$/.test(search.trim());
        if (isNum) {
            sql += ' WHERE username LIKE ? OR app_user_id LIKE ? OR id = ?';
            const term = `%${search.trim()}%`;
            params.push(term, term, parseInt(search.trim(), 10));
        } else {
            sql += ' WHERE username LIKE ? OR app_user_id LIKE ?';
            const term = `%${search.trim()}%`;
            params.push(term, term);
        }
    }
    sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit, 10) || 50, parseInt(offset, 10) || 0);
    const [rows] = await pool.query(sql, params);

    let countSql = 'SELECT COUNT(*) as total FROM users';
    const countParams = [];
    if (search && String(search).trim() !== '') {
        const isNum = /^\d+$/.test(search.trim());
        if (isNum) {
            countSql += ' WHERE username LIKE ? OR app_user_id LIKE ? OR id = ?';
            const term = `%${search.trim()}%`;
            countParams.push(term, term, parseInt(search.trim(), 10));
        } else {
            countSql += ' WHERE username LIKE ? OR app_user_id LIKE ?';
            const term = `%${search.trim()}%`;
            countParams.push(term, term);
        }
    }
    const [countRows] = await pool.query(countSql, countParams);
    return { users: rows, total: countRows[0] ? countRows[0].total : rows.length };
}

async function getGameAnalytics() {
    const [roundsStats] = await pool.query(`
        SELECT 
            COUNT(*) as total_rounds,
            COALESCE(SUM(total_bets_amount), 0) as total_bets,
            COALESCE(SUM(total_payout_amount), 0) as total_payouts
        FROM game_rounds
    `);
    const [usersStats] = await pool.query('SELECT COUNT(*) as total_users, COALESCE(SUM(coins), 0) as total_coins_in_circulation FROM users');
    const [betsStats] = await pool.query('SELECT COUNT(*) as total_bets_placed FROM bets');

    const totalBets = Number(roundsStats[0].total_bets) || 0;
    const totalPayouts = Number(roundsStats[0].total_payouts) || 0;
    const houseProfit = totalBets - totalPayouts;
    const rtp = totalBets > 0 ? (totalPayouts / totalBets * 100).toFixed(2) : '0.00';

    return {
        totalRounds: Number(roundsStats[0].total_rounds) || 0,
        totalBets,
        totalPayouts,
        houseProfit,
        rtp: `${rtp}%`,
        totalUsers: Number(usersStats[0].total_users) || 0,
        totalCoinsInCirculation: Number(usersStats[0].total_coins_in_circulation) || 0,
        totalBetsPlaced: Number(betsStats[0].total_bets_placed) || 0
    };
}

async function getGameSetting(key, defaultVal = null) {
    try {
        const [rows] = await pool.query('SELECT setting_val FROM game_settings WHERE setting_key = ?', [key]);
        if (rows.length > 0) {
            try {
                return JSON.parse(rows[0].setting_val);
            } catch (e) {
                return rows[0].setting_val;
            }
        }
        return defaultVal;
    } catch (err) {
        console.error(`[DB] getGameSetting error for ${key}:`, err.message);
        return defaultVal;
    }
}

async function setGameSetting(key, val) {
    try {
        const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
        await pool.query(`
            INSERT INTO game_settings (setting_key, setting_val)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE setting_val = VALUES(setting_val)
        `, [key, strVal]);
        return true;
    } catch (err) {
        console.error(`[DB] setGameSetting error for ${key}:`, err.message);
        return false;
    }
}

async function getAllGameSettings() {
    try {
        const [rows] = await pool.query('SELECT setting_key, setting_val FROM game_settings');
        const settings = {};
        for (const r of rows) {
            try {
                settings[r.setting_key] = JSON.parse(r.setting_val);
            } catch (e) {
                settings[r.setting_key] = r.setting_val;
            }
        }
        return settings;
    } catch (err) {
        console.error('[DB] getAllGameSettings error:', err.message);
        return {};
    }
}

module.exports = {
    pool,
    initDatabase,
    loginOrSyncUser,
    getOrCreateUser,
    getUserById,
    updateUserCoins,
    updateUserProfit,
    saveRound,
    getLastRoundNumber,
    getRecentRounds,
    saveBet,
    getUserBetHistory,
    getTodayProfitRank,
    getGreedyKingRank,
    getRoundTopWinners,
    getRandomGuestUsers,
    getBigWinner,
    deductUserCoins,
    updateRoundPayout,
    getAllUsers,
    getGameAnalytics,
    getGameSetting,
    setGameSetting,
    getAllGameSettings
};

