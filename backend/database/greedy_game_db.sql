-- phpMyAdmin SQL Dump
-- Database: greedy_game_db
-- Generation Time: 2026-10-13
-- Server version: 8.0+ / MariaDB

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

CREATE DATABASE IF NOT EXISTS `greedy_game_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `greedy_game_db`;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `avatar` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'avatar1',
  `coins` bigint NOT NULL DEFAULT '25000000',
  `diamonds` bigint NOT NULL DEFAULT '0',
  `today_profit` bigint NOT NULL DEFAULT '0',
  `total_profit` bigint NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT IGNORE INTO `users` (`id`, `username`, `avatar`, `coins`, `diamonds`, `today_profit`, `total_profit`) VALUES
(1, 'King_Dragon99', 'avatar_king', 500000000, 50902770, 25400100, 50902770),
(2, 'LuckyHunter', 'avatar_tiger', 320000000, 38400500, 14834200, 38400500),
(3, 'SweetCandy', 'avatar_queen', 240000000, 28100000, 9500000, 28100000),
(4, 'FoodieMaster', 'avatar_chef', 180000000, 19400200, 7200000, 19400200);

-- --------------------------------------------------------

--
-- Table structure for table `game_rounds`
--

CREATE TABLE IF NOT EXISTS `game_rounds` (
  `id` int NOT NULL AUTO_INCREMENT,
  `round_number` int NOT NULL,
  `winning_item` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `multiplier` int NOT NULL,
  `total_bets_amount` bigint DEFAULT '0',
  `total_payout_amount` bigint DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Seed initial rounds to populate history bar
--
INSERT IGNORE INTO `game_rounds` (`round_number`, `winning_item`, `multiplier`, `total_bets_amount`, `total_payout_amount`) VALUES
(1470, 'tomato', 5, 25000, 25000),
(1471, 'kebab', 15, 60000, 75000),
(1472, 'kebab', 15, 80000, 150000),
(1473, 'kebab', 15, 45000, 45000),
(1474, 'tomato', 5, 12000, 25000),
(1475, 'tomato', 5, 30000, 50000),
(1476, 'hotdog', 10, 95000, 100000),
(1477, 'cabbage', 5, 40000, 50000);

-- --------------------------------------------------------

--
-- Table structure for table `bets`
--

CREATE TABLE IF NOT EXISTS `bets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `round_id` int NOT NULL,
  `user_id` int NOT NULL,
  `item_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` bigint NOT NULL,
  `payout` bigint DEFAULT '0',
  `is_won` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_round` (`round_id`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

COMMIT;
