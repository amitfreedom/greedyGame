-- Database schema for Greedy Game
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    app_user_id VARCHAR(128) NULL,
    username VARCHAR(64) UNIQUE NOT NULL,
    avatar VARCHAR(255) DEFAULT 'avatar1',
    coins BIGINT NOT NULL DEFAULT 10000000,
    diamonds BIGINT NOT NULL DEFAULT 0,
    today_profit BIGINT NOT NULL DEFAULT 0,
    total_profit BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_app_user_id (app_user_id)
);

CREATE TABLE IF NOT EXISTS game_rounds (
    id INT AUTO_INCREMENT PRIMARY KEY,
    round_number INT NOT NULL,
    winning_item VARCHAR(32) NOT NULL,
    multiplier INT NOT NULL,
    total_bets_amount BIGINT DEFAULT 0,
    total_payout_amount BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    round_id INT NOT NULL,
    user_id INT NOT NULL,
    item_id VARCHAR(32) NOT NULL,
    amount BIGINT NOT NULL,
    payout BIGINT DEFAULT 0,
    is_won BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_round (round_id),
    INDEX idx_user (user_id)
);

-- Seed initial top players for realistic leaderboard
INSERT INTO users (username, avatar, coins, diamonds, today_profit, total_profit) 
SELECT 'King_Dragon99', 'avatar_king', 500000000, 50902770, 25400100, 50902770
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'King_Dragon99');

INSERT INTO users (username, avatar, coins, diamonds, today_profit, total_profit) 
SELECT 'LuckyHunter', 'avatar_tiger', 320000000, 38400500, 14834200, 38400500
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'LuckyHunter');

INSERT INTO users (username, avatar, coins, diamonds, today_profit, total_profit) 
SELECT 'SweetCandy', 'avatar_queen', 240000000, 28100000, 9500000, 28100000
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'SweetCandy');

INSERT INTO users (username, avatar, coins, diamonds, today_profit, total_profit) 
SELECT 'FoodieMaster', 'avatar_chef', 180000000, 19400200, 7200000, 19400200
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'FoodieMaster');
