const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const db = require('./database/db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Direct Admin Route (before static middleware so /admin and /admin/ both serve index.html directly)
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/admin/index.html'));
});

// Serve frontend files directly
app.use(express.static(path.join(__dirname, '../frontend')));

// 8 Food Wheel Items (Matching Media 1 to 5)
const ITEMS = [
    { id: 'hotdog', name: 'Hot Dog', multiplier: 10, index: 0, type: 'meat', weight: 10 },
    { id: 'kebab', name: 'Kebab Skewer', multiplier: 15, index: 1, type: 'meat', weight: 6.5 },
    { id: 'chicken', name: 'Roast Chicken', multiplier: 25, index: 2, type: 'meat', weight: 3.8 },
    { id: 'steak', name: 'Beef Steak', multiplier: 45, index: 3, type: 'meat', weight: 1.7 },
    { id: 'tomato', name: 'Tomato', multiplier: 5, index: 4, type: 'veggie', weight: 19.5 },
    { id: 'corn', name: 'Sweet Corn', multiplier: 5, index: 5, type: 'veggie', weight: 19.5 },
    { id: 'cabbage', name: 'Cabbage', multiplier: 5, index: 6, type: 'veggie', weight: 19.5 },
    { id: 'carrot', name: 'Carrot', multiplier: 5, index: 7, type: 'veggie', weight: 19.5 }
];

// 4 Lower Base Combo Dishes (Matching Media 1 to 5)
const COMBO_ITEMS = [
    { id: 'veg_combo', name: 'Vegetable Basket', multiplier: 1.25 },
    { id: 'salad', name: 'Salad Bowl', multiplier: 2 },
    { id: 'pizza', name: 'Pizza Platter', multiplier: 2.5 },
    { id: 'meat_combo', name: 'Meat Basket', multiplier: 4.37 }
];

// Phase Durations in seconds
const BETTING_TIME = 15;
const SPIN_TIME = 8;
const RESULT_TIME = 5;

// Game State Engine
class GreedyGameEngine {
    constructor() {
        this.state = 'BETTING'; // 'BETTING' | 'SPINNING' | 'RESULT'
        this.bettingTime = BETTING_TIME;
        this.spinTime = SPIN_TIME;
        this.resultTime = RESULT_TIME;
        this.timeLeft = this.bettingTime;
        this.roundNumber = 730;
        this.currentRoundId = null;
        this.winningItem = null;
        this.winningMultiplier = 5;
        this.targetIndex = 0;
        this.roundBets = new Map(); // userId -> Map(itemId -> amount)
        this.userPreviousBets = new Map(); // userId -> Map(itemId -> amount)
        this.podTotalBets = {}; // itemId -> total amount placed by all players
        this.recentResults = [];
        this.hotItem = 'hotdog';
        this.timer = null;
        this.isPaused = false;
        this.outcomeMode = 'smart_margin'; // 'smart_margin' | 'max_owner_profit' | 'auto' | 'manual' | 'max_payout'
        this.targetMarginPct = 60; // 60% house retention margin target by default
        this.houseShieldEnabled = true; // Never allow house to lose money on a round
        this.houseCommissionPct = 5; // 5% house commission cut on user winning payouts
        this.forcedWinningItem = null;
        this.userCallbackUrls = new Map(); // userId -> callbackUrl
    }

    setUserCallbackUrl(userId, url) {
        if (url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
            this.userCallbackUrls.set(userId, url);
            console.log(`[GreedyEngine] Registered callbackUrl for user ${userId}: ${url}`);
        }
    }

    async sendCallbackNotification(userId, payload) {
        const callbackUrl = this.userCallbackUrls.get(userId) || process.env.MAIN_APP_CALLBACK_URL;
        if (!callbackUrl) return;

        try {
            console.log(`[ServerWebhook] Posting coins update to ${callbackUrl} for user ${userId}...`);
            const res = await fetch(callbackUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Game-Source': 'Greedy-Arcade'
                },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(5000)
            });
            console.log(`[ServerWebhook] Callback response status from ${callbackUrl}: ${res.status}`);
        } catch (err) {
            console.warn(`[ServerWebhook] Failed to deliver callback to ${callbackUrl}:`, err.message);
        }
    }

    async init() {
        try {
            await db.initDatabase();
            const lastRound = await db.getLastRoundNumber();
            this.roundNumber = Math.max(lastRound + 1, 730);
            const rounds = await db.getRecentRounds(10);
            this.recentResults = rounds.map(r => ({
                roundNumber: r.round_number,
                winningItem: r.winning_item,
                multiplier: r.multiplier
            }));

            // Restore persistent House Margin & Profit settings from MySQL
            try {
                const savedMargin = await db.getGameSetting('margin_config');
                if (savedMargin && typeof savedMargin === 'object') {
                    if (savedMargin.outcomeMode) this.outcomeMode = savedMargin.outcomeMode;
                    if (savedMargin.targetMarginPct !== undefined) this.targetMarginPct = savedMargin.targetMarginPct;
                    if (savedMargin.houseShieldEnabled !== undefined) this.houseShieldEnabled = savedMargin.houseShieldEnabled;
                    if (savedMargin.houseCommissionPct !== undefined) this.houseCommissionPct = savedMargin.houseCommissionPct;
                    console.log(`[GreedyEngine] Loaded margin config: mode=${this.outcomeMode}, targetMargin=${this.targetMarginPct}%, shield=${this.houseShieldEnabled}, commission=${this.houseCommissionPct}%`);
                }
            } catch (cfgErr) {
                console.warn('[GreedyEngine] Could not load saved margin config:', cfgErr.message);
            }

            // Restore persistent item multipliers from MySQL
            try {
                const savedMultis = await db.getGameSetting('item_multipliers');
                if (savedMultis && typeof savedMultis === 'object') {
                    Object.entries(savedMultis).forEach(([id, multi]) => {
                        const num = parseFloat(multi);
                        if (!isNaN(num) && num > 0) {
                            const item = ITEMS.find(i => i.id === id);
                            if (item) item.multiplier = num;
                            const combo = COMBO_ITEMS.find(c => c.id === id);
                            if (combo) combo.multiplier = num;
                        }
                    });
                    this.recalculateComboMultipliers();
                    console.log('[GreedyEngine] Restored custom multipliers from MySQL');
                }
            } catch (mErr) {
                console.warn('[GreedyEngine] Could not load saved multipliers:', mErr.message);
            }

            this.resetPodBets();
            this.startLoop();
            console.log(`[GreedyEngine] Initialized. Current Round: #${this.roundNumber}`);
        } catch (err) {
            console.error('[GreedyEngine] Init failed:', err.message);
        }
    }

    resetPodBets() {
        this.podTotalBets = {
            hotdog: 0,
            kebab: 0,
            chicken: 0,
            steak: 0,
            tomato: 0,
            corn: 0,
            cabbage: 0,
            carrot: 0,
            veg_combo: 0,
            salad: 0,
            pizza: 0,
            meat_combo: 0
        };
        this.roundBets.clear();
        // Dynamically rotate hot badge
        const hotCandidates = ['hotdog', 'steak', 'chicken', 'kebab'];
        this.hotItem = hotCandidates[Math.floor(Math.random() * hotCandidates.length)];
    }

    getTotalRoomBets() {
        return Object.values(this.podTotalBets).reduce((a, b) => a + b, 0);
    }

    startLoop() {
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => this.tick(), 1000);
    }

    async tick() {
        if (!this.isPaused) {
            this.timeLeft--;
        }

        io.emit('game_tick', {
            state: this.state,
            timeLeft: this.timeLeft,
            roundNumber: this.roundNumber,
            hotItem: this.hotItem,
            isPaused: this.isPaused
        });

        // Broadcast live real-time status to Admin Panel
        this.broadcastAdminTick();

        if (!this.isPaused && this.timeLeft <= 0) {
            if (this.state === 'BETTING') {
                await this.transitionToSpinning();
            } else if (this.state === 'SPINNING') {
                await this.transitionToResult();
            } else if (this.state === 'RESULT') {
                await this.transitionToBetting();
            }
        }
    }

    weightedRandomSelect(itemList) {
        if (!itemList || itemList.length === 0) return ITEMS[0];
        const totalWeight = itemList.reduce((sum, item) => sum + (item.weight || 1), 0);
        let rand = Math.random() * totalWeight;
        for (const item of itemList) {
            if (rand < (item.weight || 1)) {
                return item;
            }
            rand -= (item.weight || 1);
        }
        return itemList[0];
    }

    pickWinningItem() {
        // 1. Manual forced outcome
        if (this.outcomeMode === 'manual' && this.forcedWinningItem) {
            const forced = ITEMS.find(i => i.id === this.forcedWinningItem);
            if (forced) {
                console.log(`[AdminOverride] Manual winning outcome forced: ${forced.name} (${forced.id})`);
                return forced;
            }
        }

        const totalRoomBets = this.getTotalRoomBets();

        // 2. Maximum Owner Profit Mode (Zero-Loss / Pick Empty Pot - 100% Margin)
        if (this.outcomeMode === 'max_owner_profit' || this.outcomeMode === 'min_payout') {
            if (totalRoomBets > 0) {
                // If there are dishes with 0 projected payout (pots with 0 bets), pick one of them!
                const zeroPayoutItems = ITEMS.filter(i => this.calculateProjectedPayout(i.id) === 0);
                if (zeroPayoutItems.length > 0) {
                    const winner = this.weightedRandomSelect(zeroPayoutItems);
                    console.log(`[AdminOwnerProfit] 100% Margin Winner Selected: ${winner.name} (Zero Player Payout, 100% Retained by House)`);
                    return winner;
                }
            }
            // Otherwise pick the minimum payout dish to minimize disbursements
            let bestItem = ITEMS[0];
            let minPayout = Infinity;
            for (const item of ITEMS) {
                const payout = this.calculateProjectedPayout(item.id);
                if (payout < minPayout) {
                    minPayout = payout;
                    bestItem = item;
                }
            }
            console.log(`[AdminOwnerProfit] Best house outcome selected: ${bestItem.name} (Projected Payout: ${minPayout})`);
            return bestItem;
        }

        // 3. Smart Target Margin Mode (Caps user payout so owner margin >= targetMarginPct)
        if (this.outcomeMode === 'smart_margin') {
            if (totalRoomBets > 0) {
                // Max allowed payout = totalRoomBets * (1 - targetMarginPct / 100)
                const maxAllowedPayout = Math.floor(totalRoomBets * (1 - (this.targetMarginPct / 100)));
                
                // Filter qualifying items that do not exceed the max allowed payout and don't cause house loss
                const qualifying = ITEMS.filter(i => {
                    const p = this.calculateProjectedPayout(i.id);
                    return p <= maxAllowedPayout && p <= totalRoomBets;
                });

                if (qualifying.length > 0) {
                    const winner = this.weightedRandomSelect(qualifying);
                    const p = this.calculateProjectedPayout(winner.id);
                    const margin = ((totalRoomBets - p) / totalRoomBets * 100).toFixed(1);
                    console.log(`[AdminSmartMargin] Selected ${winner.name} with ${margin}% House Margin (Target: ${this.targetMarginPct}%)`);
                    return winner;
                }

                // If no item meets the exact margin target, select the item with lowest payout (highest house net)
                let bestItem = ITEMS[0];
                let minPayout = Infinity;
                for (const item of ITEMS) {
                    const payout = this.calculateProjectedPayout(item.id);
                    if (payout < minPayout) {
                        minPayout = payout;
                        bestItem = item;
                    }
                }
                console.log(`[AdminSmartMargin] Fallback to minimum payout item: ${bestItem.name}`);
                return bestItem;
            }
        }

        // 4. High Payout / Jackpot Hype mode (Random high meat)
        if (this.outcomeMode === 'max_payout') {
            const meatItems = ITEMS.filter(i => i.type === 'meat');
            return meatItems[Math.floor(Math.random() * meatItems.length)];
        }

        // 5. Default Weighted RNG with House Shield (Prevents negative rounds for owner)
        let selected = this.weightedRandomSelect(ITEMS);
        if (this.houseShieldEnabled && totalRoomBets > 0) {
            const payout = this.calculateProjectedPayout(selected.id);
            if (payout > totalRoomBets) {
                const safeItems = ITEMS.filter(i => this.calculateProjectedPayout(i.id) <= totalRoomBets);
                if (safeItems.length > 0) {
                    selected = this.weightedRandomSelect(safeItems);
                    console.log(`[HouseShield] Rerouted from losing dish to safe dish: ${selected.name}`);
                }
            }
        }
        return selected;
    }

    async transitionToSpinning() {
        this.state = 'SPINNING';
        this.timeLeft = this.spinTime;

        const winner = this.pickWinningItem();
        this.winningItem = winner.id;
        this.winningMultiplier = winner.multiplier;
        this.targetIndex = winner.index;

        console.log(`[GreedyEngine] Round #${this.roundNumber} - Winning Item: ${this.winningItem} (${this.winningMultiplier}x, index ${this.targetIndex})`);

        io.emit('spin_start', {
            roundNumber: this.roundNumber,
            winningItem: this.winningItem,
            targetIndex: winner.index,
            multiplier: this.winningMultiplier,
            duration: this.spinTime * 1000
        });
        this.broadcastAdminTick();
    }

    async transitionToResult() {
        this.state = 'RESULT';
        this.timeLeft = this.resultTime;

        let totalBetsAmount = 0;
        let totalPayoutAmount = 0;
        const userResults = [];
        const winningItemId = this.winningItem;

        for (const amount of Object.values(this.podTotalBets)) {
            totalBetsAmount += amount;
        }

        // Save round to MySQL first
        try {
            this.currentRoundId = await db.saveRound(
                this.roundNumber,
                this.winningItem,
                this.winningMultiplier,
                totalBetsAmount,
                0
            );
        } catch (err) {
            console.error('[GreedyEngine] Failed to save round to DB:', err.message);
        }

        // Evaluate bets for each user (Real players & Guests)
        for (const [userId, bets] of this.roundBets.entries()) {
            let userTotalBet = 0;
            let userTotalPayout = 0;

            for (const [itemId, amount] of bets.entries()) {
                userTotalBet += amount;
                let won = false;
                let payout = 0;

                // 1. Direct pod hit
                if (itemId === winningItemId) {
                    won = true;
                    payout = amount * this.winningMultiplier;
                }
                // 2. Veg Combo - covers tomato, corn, cabbage, carrot
                else if (itemId === 'veg_combo' && ['tomato', 'corn', 'cabbage', 'carrot'].includes(winningItemId)) {
                    const c = COMBO_ITEMS.find(i => i.id === 'veg_combo');
                    won = true;
                    payout = Math.floor(amount * (c ? c.multiplier : 1.25));
                }
                // 3. Salad Combo - covers vegetables
                else if (itemId === 'salad' && ['tomato', 'corn', 'cabbage', 'carrot'].includes(winningItemId)) {
                    const c = COMBO_ITEMS.find(i => i.id === 'salad');
                    won = true;
                    payout = Math.floor(amount * (c ? c.multiplier : 2));
                }
                // 4. Pizza Combo - covers meats
                else if (itemId === 'pizza' && ['hotdog', 'kebab', 'chicken', 'steak'].includes(winningItemId)) {
                    const c = COMBO_ITEMS.find(i => i.id === 'pizza');
                    won = true;
                    payout = Math.floor(amount * (c ? c.multiplier : 2.5));
                }
                // 5. Meat Combo - covers meats
                else if (itemId === 'meat_combo' && ['hotdog', 'kebab', 'chicken', 'steak'].includes(winningItemId)) {
                    const c = COMBO_ITEMS.find(i => i.id === 'meat_combo');
                    won = true;
                    payout = Math.floor(amount * (c ? c.multiplier : 4.37));
                }

                // Apply House Commission (Owner Profit Retention on Winnings)
                if (won && payout > 0 && this.houseCommissionPct > 0) {
                    const commission = Math.floor(payout * (this.houseCommissionPct / 100));
                    payout = Math.max(0, payout - commission);
                }

                userTotalPayout += payout;

                // Save individual bet record in MySQL
                if (this.currentRoundId) {
                    await db.saveBet(this.currentRoundId, userId, itemId, amount, payout, won);
                }
            }

            totalPayoutAmount += userTotalPayout;
            const netProfit = userTotalPayout - userTotalBet;
            const diamondsEarned = netProfit > 0 ? Math.floor(netProfit * 2 / 7) : 0;

            try {
                if (userTotalPayout > 0) {
                    await db.updateUserCoins(userId, userTotalPayout);
                }
                if (netProfit !== 0 || diamondsEarned > 0) {
                    await db.updateUserProfit(userId, netProfit, diamondsEarned);
                }
                const updatedUser = await db.getUserById(userId);

                userResults.push({
                    userId,
                    username: updatedUser.username,
                    avatar: updatedUser.avatar,
                    userTotalBet,
                    userTotalPayout,
                    netProfit,
                    diamondsEarned,
                    newCoins: updatedUser.coins,
                    newDiamonds: updatedUser.diamonds,
                    todayProfit: updatedUser.today_profit
                });

                // Send Webhook callback to Main Application
                this.sendCallbackNotification(userId, {
                    event: 'ROUND_RESULT',
                    userId,
                    username: updatedUser.username,
                    previousCoins: updatedUser.coins - netProfit,
                    newCoins: updatedUser.coins,
                    newDiamonds: updatedUser.diamonds,
                    delta: netProfit,
                    userTotalBet,
                    userTotalPayout,
                    diamondsEarned,
                    roundNumber: this.roundNumber,
                    winningItem: winningItemId,
                    multiplier: this.winningMultiplier,
                    timestamp: Date.now()
                });
            } catch (err) {
                console.error(`[GreedyEngine] Payout error for user ${userId}:`, err.message);
            }

            // Save for Repeat Bets
            this.userPreviousBets.set(userId, new Map(bets));
        }

        // Update total payout in game_rounds
        if (this.currentRoundId) {
            try {
                await db.updateRoundPayout(this.currentRoundId, totalPayoutAmount);
            } catch (err) {
                console.error('[GreedyEngine] Failed to update round payout:', err.message);
            }
        }

        // Add to recent results
        this.recentResults.unshift({
            roundNumber: this.roundNumber,
            winningItem: this.winningItem,
            multiplier: this.winningMultiplier
        });
        if (this.recentResults.length > 12) {
            this.recentResults.pop();
        }

        // Get Top 3 Round Winners from DB (Media 1)
        const roundRankings = await db.getRoundTopWinners(this.currentRoundId, 3);

        // Get Big Winner from DB (Media 2 & 4)
        const bigWinner = await db.getBigWinner();

        // Broadcast Result
        io.emit('round_result', {
            roundNumber: this.roundNumber,
            winningItem: this.winningItem,
            multiplier: this.winningMultiplier,
            recentResults: this.recentResults,
            userResults,
            roundRankings,
            bigWinner,
            hotItem: this.hotItem
        });

        // Broadcast Leaderboard updates
        const todayRanks = await db.getTodayProfitRank(15);
        io.emit('leaderboard_update', { todayRanks, bigWinner });
    }

    async transitionToBetting() {
        this.roundNumber++;
        this.state = 'BETTING';
        this.timeLeft = this.bettingTime;
        this.resetPodBets();

        const bigWinner = await db.getBigWinner();

        io.emit('round_start', {
            roundNumber: this.roundNumber,
            timeLeft: this.timeLeft,
            recentResults: this.recentResults,
            hotItem: this.hotItem,
            bigWinner,
            totalRoomBets: 0,
            podTotalBets: this.podTotalBets
        });
        this.broadcastAdminTick();
    }

    async placeBet(userId, itemId, amount, isGuest = false) {
        if (this.state !== 'BETTING') {
            return { success: false, message: 'Betting is closed!' };
        }

        // Strict validation: amount must be a positive integer within valid limits
        if (typeof amount !== 'number' || isNaN(amount) || !Number.isInteger(amount) || amount <= 0) {
            return { success: false, message: 'Invalid bet amount!' };
        }
        if (amount > 100000000) {
            return { success: false, message: 'Bet exceeds maximum limit (100M)!' };
        }

        const validItem = ITEMS.find(i => i.id === itemId) || COMBO_ITEMS.find(c => c.id === itemId);
        if (!validItem) {
            return { success: false, message: 'Invalid item!' };
        }

        // If placing a combo dish bet, automatically distribute across the related wheel pots only
        const COMBO_MAP = {
            'veg_combo': ['tomato', 'corn', 'cabbage', 'carrot'],
            'salad': ['tomato', 'corn', 'cabbage', 'carrot'],
            'pizza': ['hotdog', 'kebab', 'chicken', 'steak'],
            'meat_combo': ['hotdog', 'kebab', 'chicken', 'steak']
        };

        if (COMBO_MAP[itemId]) {
            const related = COMBO_MAP[itemId];
            const totalRequired = amount * related.length;
            const user = await db.getUserById(userId);
            if (!user || user.coins < totalRequired) {
                return { success: false, message: 'Insufficient coins for combo bet!' };
            }
            let lastRes = null;
            for (const subItem of related) {
                lastRes = await this.placeBet(userId, subItem, amount, isGuest);
            }
            return lastRes || { success: true };
        }

        // Atomic coin deduction directly in MySQL
        const updatedUser = await db.deductUserCoins(userId, amount);
        if (!updatedUser) {
            return { success: false, message: 'Insufficient coins!' };
        }

        if (!this.roundBets.has(userId)) {
            this.roundBets.set(userId, new Map());
        }
        const userBets = this.roundBets.get(userId);
        const prevBet = userBets.get(itemId) || 0;
        userBets.set(itemId, prevBet + amount);

        this.podTotalBets[itemId] = (this.podTotalBets[itemId] || 0) + amount;

        // Broadcast to all clients
        io.emit('bet_placed_broadcast', {
            userId,
            username: updatedUser.username,
            avatar: updatedUser.avatar,
            itemId,
            chipAmount: amount,
            userTotalOnItem: userBets.get(itemId),
            podTotal: this.podTotalBets[itemId],
            totalRoomBets: this.getTotalRoomBets(),
            isGuest
        });

        if (!isGuest) {
            this.sendCallbackNotification(userId, {
                event: 'BET_PLACED',
                userId,
                username: updatedUser.username,
                itemId,
                chipAmount: amount,
                newCoins: updatedUser.coins,
                delta: -amount,
                roundNumber: this.roundNumber,
                timestamp: Date.now()
            });
        }

        this.broadcastAdminTick();

        return {
            success: true,
            newBalance: updatedUser.coins,
            userTotalOnItem: userBets.get(itemId),
            podTotal: this.podTotalBets[itemId],
            totalRoomBets: this.getTotalRoomBets()
        };
    }

    async repeatPreviousBets(userId) {
        if (this.state !== 'BETTING') {
            return { success: false, message: 'Betting is closed!' };
        }

        const prevBets = this.userPreviousBets.get(userId);
        if (!prevBets || prevBets.size === 0) {
            return { success: false, message: 'No previous bets to repeat!' };
        }

        let totalToBet = 0;
        for (const amount of prevBets.values()) {
            totalToBet += amount;
        }

        const user = await db.getUserById(userId);
        if (user.coins < totalToBet) {
            return { success: false, message: 'Not enough coins to repeat bets!' };
        }

        for (const [itemId, amount] of prevBets.entries()) {
            await this.placeBet(userId, itemId, amount, false);
        }

        const updatedUser = await db.getUserById(userId);
        return { success: true, newBalance: updatedUser.coins };
    }

    // ==================== ADMIN CONTROL METHODS ====================

    pauseGame() {
        this.isPaused = true;
        console.log('[AdminControl] Game engine PAUSED');
        this.broadcastAdminTick();
        return { success: true, isPaused: true, message: 'Game loop paused' };
    }

    resumeGame() {
        this.isPaused = false;
        console.log('[AdminControl] Game engine RESUMED');
        this.broadcastAdminTick();
        return { success: true, isPaused: false, message: 'Game loop resumed' };
    }

    async forceSpinNow() {
        if (this.state !== 'BETTING') {
            return { success: false, message: 'Can only force spin during BETTING state' };
        }
        console.log('[AdminControl] Force spin triggered immediately');
        this.timeLeft = 0;
        await this.transitionToSpinning();
        this.broadcastAdminTick();
        return { success: true, message: 'Wheel spin triggered immediately' };
    }

    async resetCurrentRound() {
        console.log('[AdminControl] Round reset triggered');
        this.state = 'BETTING';
        this.timeLeft = this.bettingTime;
        this.resetPodBets();
        io.emit('round_start', {
            roundNumber: this.roundNumber,
            timeLeft: this.timeLeft,
            recentResults: this.recentResults,
            hotItem: this.hotItem,
            bigWinner: await db.getBigWinner(),
            totalRoomBets: 0,
            podTotalBets: this.podTotalBets
        });
        this.broadcastAdminTick();
        return { success: true, message: `Round #${this.roundNumber} has been reset to BETTING` };
    }

    setOutcomeMode(mode, itemId = null) {
        if (!['auto', 'manual', 'min_payout', 'max_payout'].includes(mode)) {
            return { success: false, message: 'Invalid outcome mode' };
        }
        this.outcomeMode = mode;
        if (mode === 'manual') {
            if (!itemId || !ITEMS.some(i => i.id === itemId)) {
                return { success: false, message: 'Invalid item for manual outcome' };
            }
            this.forcedWinningItem = itemId;
        } else {
            this.forcedWinningItem = null;
        }
        console.log(`[AdminControl] Outcome strategy updated: mode=${mode}, forcedItem=${this.forcedWinningItem}`);
        this.broadcastAdminTick();
        return { 
            success: true, 
            mode: this.outcomeMode, 
            forcedWinningItem: this.forcedWinningItem,
            message: mode === 'manual' ? `Locked next outcome to ${this.forcedWinningItem.toUpperCase()}` : `Strategy set to ${mode.toUpperCase()}`
        };
    }

    updateDurations(durations = {}) {
        if (durations.bettingTime && parseInt(durations.bettingTime, 10) >= 5) {
            this.bettingTime = parseInt(durations.bettingTime, 10);
        }
        if (durations.spinTime && parseInt(durations.spinTime, 10) >= 4) {
            this.spinTime = parseInt(durations.spinTime, 10);
        }
        if (durations.resultTime && parseInt(durations.resultTime, 10) >= 3) {
            this.resultTime = parseInt(durations.resultTime, 10);
        }
        this.broadcastAdminTick();
        return { 
            success: true, 
            durations: { bettingTime: this.bettingTime, spinTime: this.spinTime, resultTime: this.resultTime },
            message: 'Phase durations updated'
        };
    }

    updateItemWeights(weightMap) {
        if (!weightMap || typeof weightMap !== 'object') return { success: false };
        Object.entries(weightMap).forEach(([id, weight]) => {
            const item = ITEMS.find(i => i.id === id);
            if (item && !isNaN(parseFloat(weight)) && parseFloat(weight) > 0) {
                item.weight = parseFloat(weight);
            }
        });
        this.broadcastAdminTick();
        return { success: true, items: ITEMS, message: 'Item probability weights updated' };
    }

    updateMarginConfig(config = {}) {
        if (config.outcomeMode) {
            if (['auto', 'manual', 'smart_margin', 'max_owner_profit', 'min_payout', 'max_payout'].includes(config.outcomeMode)) {
                this.outcomeMode = config.outcomeMode;
                if (config.outcomeMode !== 'manual') {
                    this.forcedWinningItem = null;
                }
            }
        }
        if (config.forcedWinningItem !== undefined) {
            this.forcedWinningItem = config.forcedWinningItem;
        }
        if (config.targetMarginPct !== undefined) {
            const m = parseInt(config.targetMarginPct, 10);
            if (!isNaN(m) && m >= 0 && m <= 100) {
                this.targetMarginPct = m;
            }
        }
        if (config.houseShieldEnabled !== undefined) {
            this.houseShieldEnabled = Boolean(config.houseShieldEnabled);
        }
        if (config.houseCommissionPct !== undefined) {
            const c = parseInt(config.houseCommissionPct, 10);
            if (!isNaN(c) && c >= 0 && c <= 50) {
                this.houseCommissionPct = c;
            }
        }

        // Persist to MySQL database
        db.setGameSetting('margin_config', {
            outcomeMode: this.outcomeMode,
            targetMarginPct: this.targetMarginPct,
            houseShieldEnabled: this.houseShieldEnabled,
            houseCommissionPct: this.houseCommissionPct
        });

        console.log(`[AdminMargin] Margin updated: mode=${this.outcomeMode}, targetMargin=${this.targetMarginPct}%, shield=${this.houseShieldEnabled}, commission=${this.houseCommissionPct}%`);
        this.broadcastAdminTick();
        return {
            success: true,
            message: 'House Margin & Profit settings updated successfully',
            config: {
                outcomeMode: this.outcomeMode,
                targetMarginPct: this.targetMarginPct,
                houseShieldEnabled: this.houseShieldEnabled,
                houseCommissionPct: this.houseCommissionPct,
                forcedWinningItem: this.forcedWinningItem
            }
        };
    }

    recalculateComboMultipliers() {
        const tomato = ITEMS.find(i => i.id === 'tomato')?.multiplier || 5;
        const corn = ITEMS.find(i => i.id === 'corn')?.multiplier || 5;
        const cabbage = ITEMS.find(i => i.id === 'cabbage')?.multiplier || 5;
        const carrot = ITEMS.find(i => i.id === 'carrot')?.multiplier || 5;

        const hotdog = ITEMS.find(i => i.id === 'hotdog')?.multiplier || 10;
        const kebab = ITEMS.find(i => i.id === 'kebab')?.multiplier || 15;
        const chicken = ITEMS.find(i => i.id === 'chicken')?.multiplier || 25;
        const steak = ITEMS.find(i => i.id === 'steak')?.multiplier || 45;

        const avgVeg = (tomato + corn + cabbage + carrot) / 4;
        const avgMeat = (hotdog + kebab + chicken + steak) / 4;

        // 1. Veg Combo Basket (4 Veggies) = avgVeg / 4
        const vegCombo = COMBO_ITEMS.find(c => c.id === 'veg_combo');
        if (vegCombo) {
            vegCombo.multiplier = Math.round((avgVeg / 4) * 100) / 100;
        }

        // 2. Salad Bowl (4 Veggies) = avgVeg * 0.40
        const salad = COMBO_ITEMS.find(c => c.id === 'salad');
        if (salad) {
            salad.multiplier = Math.round((avgVeg * 0.4) * 100) / 100;
        }

        // 3. Pizza Platter (4 Meats) = hotdog / 4
        const pizza = COMBO_ITEMS.find(c => c.id === 'pizza');
        if (pizza) {
            pizza.multiplier = Math.round((hotdog / 4) * 100) / 100;
        }

        // 4. Meat Basket (4 Meats) = avgMeat * (4.37 / 23.75)
        const meatCombo = COMBO_ITEMS.find(c => c.id === 'meat_combo');
        if (meatCombo) {
            meatCombo.multiplier = Math.round((avgMeat * (4.37 / 23.75)) * 100) / 100;
        }

        console.log(`[GreedyEngine] Auto-recalculated combo baskets: Veg Basket=${vegCombo?.multiplier}x, Salad=${salad?.multiplier}x, Pizza=${pizza?.multiplier}x, Meat Basket=${meatCombo?.multiplier}x`);
    }

    updateItemMultipliers(multiplierMap = {}, autoCalculateCombos = true) {
        if (!multiplierMap || typeof multiplierMap !== 'object') {
            return { success: false, message: 'Invalid multiplier data' };
        }

        // 1. Update 8 Wheel Items
        Object.entries(multiplierMap).forEach(([id, multi]) => {
            const num = parseFloat(multi);
            if (!isNaN(num) && num > 0) {
                const item = ITEMS.find(i => i.id === id);
                if (item) {
                    item.multiplier = num;
                }
            }
        });

        // 2. Auto-calculate combos based on wheel dishes
        if (autoCalculateCombos) {
            this.recalculateComboMultipliers();
        } else {
            // Manual overrides for combo items if auto-calc explicitly disabled
            Object.entries(multiplierMap).forEach(([id, multi]) => {
                const num = parseFloat(multi);
                if (!isNaN(num) && num > 0) {
                    const combo = COMBO_ITEMS.find(c => c.id === id);
                    if (combo) {
                        combo.multiplier = num;
                    }
                }
            });
        }

        // Persist to MySQL
        const savedMultipliers = {};
        ITEMS.forEach(i => savedMultipliers[i.id] = i.multiplier);
        COMBO_ITEMS.forEach(c => savedMultipliers[c.id] = c.multiplier);
        db.setGameSetting('item_multipliers', savedMultipliers);

        // Broadcast updated multipliers to all active players and admin
        io.emit('items_updated', {
            items: ITEMS,
            comboItems: COMBO_ITEMS
        });
        this.broadcastAdminTick();

        console.log('[AdminMultipliers] Multipliers updated successfully (Combos auto-calculated):', savedMultipliers);
        return {
            success: true,
            message: 'Multipliers updated & combo baskets auto-calculated successfully!',
            items: ITEMS,
            comboItems: COMBO_ITEMS
        };
    }

    calculateProjectedPayout(winningItemId) {
        const winningItem = ITEMS.find(i => i.id === winningItemId);
        if (!winningItem) return 0;
        let totalPayout = 0;
        for (const bets of this.roundBets.values()) {
            for (const [itemId, amount] of bets.entries()) {
                let raw = 0;
                if (itemId === winningItemId) {
                    raw = amount * winningItem.multiplier;
                } else if (itemId === 'veg_combo' && ['tomato', 'corn', 'cabbage', 'carrot'].includes(winningItemId)) {
                    const c = COMBO_ITEMS.find(i => i.id === 'veg_combo');
                    raw = Math.floor(amount * (c ? c.multiplier : 1.25));
                } else if (itemId === 'salad' && ['tomato', 'corn', 'cabbage', 'carrot'].includes(winningItemId)) {
                    const c = COMBO_ITEMS.find(i => i.id === 'salad');
                    raw = Math.floor(amount * (c ? c.multiplier : 2));
                } else if (itemId === 'pizza' && ['hotdog', 'kebab', 'chicken', 'steak'].includes(winningItemId)) {
                    const c = COMBO_ITEMS.find(i => i.id === 'pizza');
                    raw = Math.floor(amount * (c ? c.multiplier : 2.5));
                } else if (itemId === 'meat_combo' && ['hotdog', 'kebab', 'chicken', 'steak'].includes(winningItemId)) {
                    const c = COMBO_ITEMS.find(i => i.id === 'meat_combo');
                    raw = Math.floor(amount * (c ? c.multiplier : 4.37));
                }

                if (raw > 0) {
                    const comm = this.houseCommissionPct > 0 ? Math.floor(raw * (this.houseCommissionPct / 100)) : 0;
                    totalPayout += Math.max(0, raw - comm);
                }
            }
        }
        return totalPayout;
    }

    getEngineAdminStatus() {
        const totalRoomBets = this.getTotalRoomBets();
        const projectedOutcomes = ITEMS.map(item => {
            const potBet = this.podTotalBets[item.id] || 0;
            const projectedPayout = this.calculateProjectedPayout(item.id);
            const houseNet = totalRoomBets - projectedPayout;
            return {
                id: item.id,
                name: item.name,
                multiplier: item.multiplier,
                weight: item.weight,
                index: item.index,
                type: item.type,
                potBet,
                projectedPayout,
                houseNet,
                houseMarginPct: totalRoomBets > 0 ? ((houseNet / totalRoomBets) * 100).toFixed(1) : '100.0'
            };
        });

        let bestHouseOutcome = projectedOutcomes[0];
        let worstHouseOutcome = projectedOutcomes[0];
        projectedOutcomes.forEach(o => {
            if (o.houseNet > bestHouseOutcome.houseNet) bestHouseOutcome = o;
            if (o.houseNet < worstHouseOutcome.houseNet) worstHouseOutcome = o;
        });

        return {
            state: this.state,
            isPaused: this.isPaused,
            timeLeft: this.timeLeft,
            roundNumber: this.roundNumber,
            currentRoundId: this.currentRoundId,
            durations: {
                bettingTime: this.bettingTime,
                spinTime: this.spinTime,
                resultTime: this.resultTime
            },
            outcomeMode: this.outcomeMode,
            targetMarginPct: this.targetMarginPct,
            houseShieldEnabled: this.houseShieldEnabled,
            houseCommissionPct: this.houseCommissionPct,
            forcedWinningItem: this.forcedWinningItem,
            nextOutcomeDisplay: this.outcomeMode === 'manual' ? (this.forcedWinningItem || 'auto') : this.outcomeMode,
            totalRoomBets,
            activeBettorsCount: this.roundBets.size,
            podTotalBets: this.podTotalBets,
            hotItem: this.hotItem,
            items: ITEMS,
            comboItems: COMBO_ITEMS,
            projectedOutcomes,
            bestHouseOutcome: bestHouseOutcome ? { id: bestHouseOutcome.id, name: bestHouseOutcome.name, houseNet: bestHouseOutcome.houseNet } : null,
            worstHouseOutcome: worstHouseOutcome ? { id: worstHouseOutcome.id, name: worstHouseOutcome.name, houseNet: worstHouseOutcome.houseNet } : null,
            recentResults: this.recentResults
        };
    }

    broadcastAdminTick() {
        io.to('admin_room').emit('admin_game_tick', this.getEngineAdminStatus());
    }
}

const gameEngine = new GreedyGameEngine();

// API Endpoints
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', serverTime: new Date() });
});

app.get('/api/leaderboard/revenue', async (req, res) => {
    const ranks = await db.getTodayProfitRank(20);
    res.json(ranks);
});

app.get('/api/rounds/recent', async (req, res) => {
    const rounds = await db.getRecentRounds(15);
    res.json(rounds);
});

app.get('/api/user/login', async (req, res) => {
    try {
        const user = await db.loginOrSyncUser(req.query);
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Query user coins / balance (For Main App sync)
app.get('/api/user/:userId/coins', async (req, res) => {
    try {
        const user = await db.getUserById(req.params.userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({
            success: true,
            userId: user.id,
            appUserId: user.app_user_id,
            username: user.username,
            avatar: user.avatar,
            coins: user.coins,
            todayProfit: user.today_profit,
            diamonds: user.diamonds
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Update user coins / diamonds server-to-server (For Main App credit/debit/sync)
app.post('/api/user/:userId/coins', async (req, res) => {
    try {
        const { coins, delta, diamonds, action, amount, username, avatar } = req.body || {};
        let user = await db.getUserById(req.params.userId);
        if (!user) {
            user = await db.loginOrSyncUser({
                userId: req.params.userId,
                username: username || `User_${req.params.userId}`,
                avatar: avatar || 'avatar1',
                coins: 0,
                diamonds: 0
            });
        }

        // 1. Support action-based requests: 'credit', 'debit', 'set'
        if (action) {
            const amt = parseInt(amount, 10);
            if (isNaN(amt)) {
                return res.status(400).json({ success: false, message: 'Invalid amount' });
            }
            if (action === 'credit') {
                if (amt <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
                await db.updateUserCoins(user.id, amt);
            } else if (action === 'debit') {
                if (amt <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
                const dec = await db.deductUserCoins(user.id, amt);
                if (!dec) return res.status(400).json({ success: false, message: 'Insufficient balance' });
            } else if (action === 'set') {
                if (amt < 0) return res.status(400).json({ success: false, message: 'Amount cannot be negative' });
                await db.pool.query('UPDATE users SET coins = ? WHERE id = ?', [amt, user.id]);
            } else {
                return res.status(400).json({ success: false, message: `Unsupported action: ${action}` });
            }
        } 
        // 2. Support direct coins / delta parameters
        else {
            if (coins !== undefined && coins !== null && !isNaN(parseInt(coins, 10))) {
                const newCoins = Math.max(0, parseInt(coins, 10));
                await db.pool.query('UPDATE users SET coins = ? WHERE id = ?', [newCoins, user.id]);
            } else if (delta !== undefined && delta !== null && !isNaN(parseInt(delta, 10))) {
                const deltaNum = parseInt(delta, 10);
                if (deltaNum < 0) {
                    const dec = await db.deductUserCoins(user.id, Math.abs(deltaNum));
                    if (!dec) return res.status(400).json({ success: false, message: 'Insufficient balance' });
                } else if (deltaNum > 0) {
                    await db.updateUserCoins(user.id, deltaNum);
                }
            }
        }

        if (diamonds !== undefined && diamonds !== null && !isNaN(parseInt(diamonds, 10))) {
            const newDiamonds = Math.max(0, parseInt(diamonds, 10));
            await db.pool.query('UPDATE users SET diamonds = ? WHERE id = ?', [newDiamonds, user.id]);
        }

        const updated = await db.getUserById(user.id);

        // If user is currently connected via socket, push live balance update
        const userSocket = Array.from(io.sockets.sockets.values()).find(s => s.userId === user.id);
        if (userSocket) {
            userSocket.emit('balance_updated', {
                coins: updated.coins,
                diamonds: updated.diamonds,
                message: 'Balance updated by server.'
            });
        }

        res.json({
            success: true,
            userId: updated.id,
            appUserId: updated.app_user_id,
            coins: updated.coins,
            diamonds: updated.diamonds,
            user: {
                id: updated.id,
                appUserId: updated.app_user_id,
                username: updated.username,
                avatar: updated.avatar,
                coins: updated.coins,
                diamonds: updated.diamonds,
                todayProfit: updated.today_profit
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Test endpoint to receive and log callbacks in development
app.post('/api/callback/test', (req, res) => {
    console.log('[TestCallbackReceived] Received payload:', req.body);
    res.json({ success: true, received: req.body });
});

// ==================== ADMIN CONTROL PANEL REST APIS ====================

// 1. Live Overview & Real-time Game Analytics
app.get('/api/admin/overview', async (req, res) => {
    try {
        const game = gameEngine.getEngineAdminStatus();
        const analytics = await db.getGameAnalytics();
        res.json({
            success: true,
            game,
            analytics,
            onlineUsers: io.sockets.sockets.size
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Game Action Control (Pause, Resume, Force Spin, Reset Round)
app.post('/api/admin/game-control', async (req, res) => {
    try {
        const { action } = req.body || {};
        let result = { success: false, message: 'Unknown action' };
        if (action === 'pause') {
            result = gameEngine.pauseGame();
        } else if (action === 'resume') {
            result = gameEngine.resumeGame();
        } else if (action === 'force_spin') {
            result = await gameEngine.forceSpinNow();
        } else if (action === 'reset_round') {
            result = await gameEngine.resetCurrentRound();
        } else {
            return res.status(400).json({ success: false, message: 'Invalid action' });
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Outcome Strategy / Force Next Winning Pot
app.post('/api/admin/outcome', (req, res) => {
    try {
        const { mode, itemId } = req.body || {};
        const result = gameEngine.setOutcomeMode(mode, itemId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3.1 Advanced House Margin & Owner Profit Controls
app.post('/api/admin/margin', (req, res) => {
    try {
        const result = gameEngine.updateMarginConfig(req.body || {});
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3.2 Update Pot & Combo Multipliers (e.g. 5x, 10x, 15x, 25x, 45x)
app.post('/api/admin/multipliers', (req, res) => {
    try {
        const { multipliers, autoCalculateCombos } = req.body || {};
        const autoCalc = autoCalculateCombos !== undefined ? Boolean(autoCalculateCombos) : true;
        const result = gameEngine.updateItemMultipliers(multipliers || {}, autoCalc);
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. Update Game Configurations (Durations & Item Probability Weights)
app.post('/api/admin/config', (req, res) => {
    try {
        const { durations, itemWeights } = req.body || {};
        if (durations) gameEngine.updateDurations(durations);
        if (itemWeights) gameEngine.updateItemWeights(itemWeights);
        res.json({
            success: true,
            message: 'Game settings updated successfully',
            status: gameEngine.getEngineAdminStatus()
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. User Management List with Search & Pagination
app.get('/api/admin/users', async (req, res) => {
    try {
        const { search, limit, offset } = req.query || {};
        const data = await db.getAllUsers(search, limit, offset);
        res.json({ success: true, ...data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 6. User Balance Adjustment (Coins)
app.post('/api/admin/user/:userId/coins', async (req, res) => {
    try {
        const { action, amount } = req.body || {};
        const amt = parseInt(amount, 10);
        if (isNaN(amt) || amt < 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

        const user = await db.getUserById(req.params.userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (action === 'credit') {
            await db.updateUserCoins(user.id, amt);
        } else if (action === 'debit') {
            const dec = await db.deductUserCoins(user.id, amt);
            if (!dec) return res.status(400).json({ success: false, message: 'Insufficient coins balance' });
        } else if (action === 'set') {
            await db.pool.query('UPDATE users SET coins = ? WHERE id = ?', [amt, user.id]);
        } else {
            return res.status(400).json({ success: false, message: 'Invalid action' });
        }

        const updated = await db.getUserById(user.id);

        const targetSocket = Array.from(io.sockets.sockets.values()).find(s => s.userId === user.id);
        if (targetSocket) {
            targetSocket.emit('balance_updated', {
                coins: updated.coins,
                diamonds: updated.diamonds,
                message: `Admin updated your balance to ${updated.coins.toLocaleString()} coins`
            });
        }

        res.json({ success: true, user: updated, message: `Successfully updated ${user.username}'s balance` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 7. User Balance Adjustment (Diamonds)
app.post('/api/admin/user/:userId/diamonds', async (req, res) => {
    try {
        const { action, amount } = req.body || {};
        const amt = parseInt(amount, 10);
        if (isNaN(amt) || amt < 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

        const user = await db.getUserById(req.params.userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (action === 'credit') {
            await db.pool.query('UPDATE users SET diamonds = diamonds + ? WHERE id = ?', [amt, user.id]);
        } else if (action === 'debit') {
            await db.pool.query('UPDATE users SET diamonds = GREATEST(0, diamonds - ?) WHERE id = ?', [amt, user.id]);
        } else if (action === 'set') {
            await db.pool.query('UPDATE users SET diamonds = ? WHERE id = ?', [amt, user.id]);
        } else {
            return res.status(400).json({ success: false, message: 'Invalid action' });
        }

        const updated = await db.getUserById(user.id);
        const targetSocket = Array.from(io.sockets.sockets.values()).find(s => s.userId === user.id);
        if (targetSocket) {
            targetSocket.emit('balance_updated', {
                coins: updated.coins,
                diamonds: updated.diamonds,
                message: `Admin updated your diamonds to ${updated.diamonds.toLocaleString()}`
            });
        }

        res.json({ success: true, user: updated, message: `Successfully updated ${user.username}'s diamonds` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 8. Recent Rounds History for Audit
app.get('/api/admin/rounds', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 25;
        const [rows] = await db.pool.query(`
            SELECT 
                r.id, r.round_number, r.winning_item, r.multiplier, 
                r.total_bets_amount, r.total_payout_amount, 
                (r.total_bets_amount - r.total_payout_amount) as house_profit,
                r.created_at,
                (SELECT COUNT(*) FROM bets b WHERE b.round_id = r.id) as bets_count
            FROM game_rounds r
            ORDER BY r.id DESC 
            LIMIT ?
        `, [limit]);
        res.json({ success: true, rounds: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Socket.io Events
io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Admin Control Panel Room
    socket.on('admin_join', () => {
        socket.join('admin_room');
        socket.emit('admin_game_tick', gameEngine.getEngineAdminStatus());
        console.log(`[AdminSocket] Admin client ${socket.id} joined admin_room`);
    });

    socket.on('auth_user', async (data) => {
        try {
            const user = await db.loginOrSyncUser(data || {});
            socket.userId = user.id;

            // Register callbackUrl if provided in URL or credentials
            if (data && data.callbackUrl) {
                gameEngine.setUserCallbackUrl(user.id, data.callbackUrl);
            }

            const todayRanks = await db.getTodayProfitRank(20);
            const bigWinner = await db.getBigWinner();

            socket.emit('init_game_state', {
                user,
                state: gameEngine.state,
                timeLeft: gameEngine.timeLeft,
                roundNumber: gameEngine.roundNumber,
                recentResults: gameEngine.recentResults,
                podTotalBets: gameEngine.podTotalBets,
                totalRoomBets: gameEngine.getTotalRoomBets(),
                hotItem: gameEngine.hotItem,
                userBets: gameEngine.roundBets.has(user.id) ? Object.fromEntries(gameEngine.roundBets.get(user.id)) : {},
                todayRanks,
                bigWinner,
                items: ITEMS,
                comboItems: COMBO_ITEMS,
                targetIndex: gameEngine.state === 'SPINNING' ? gameEngine.targetIndex : null,
                winningItem: gameEngine.state === 'SPINNING' ? gameEngine.winningItem : null
            });
        } catch (err) {
            socket.emit('error_msg', err.message);
        }
    });

    const claimCooldowns = new Map(); // userId -> lastClaimTime

    socket.on('place_bet', async (data) => {
        try {
            if (!socket.userId) return socket.emit('error_msg', 'Not logged in!');
            const { itemId, amount } = data || {};
            const num = Number(amount);
            if (amount === null || amount === undefined || !Number.isInteger(num) || num <= 0) {
                return socket.emit('error_msg', 'Invalid bet amount! Bet must be a whole positive integer.');
            }
            const res = await gameEngine.placeBet(socket.userId, itemId, num, false);
            socket.emit('bet_response', res);
        } catch (err) {
            socket.emit('error_msg', err.message);
        }
    });

    socket.on('repeat_bet', async () => {
        try {
            if (!socket.userId) return socket.emit('error_msg', 'Not logged in!');
            const res = await gameEngine.repeatPreviousBets(socket.userId);
            socket.emit('repeat_response', res);
        } catch (err) {
            socket.emit('error_msg', err.message);
        }
    });

    socket.on('claim_free_coins', async () => {
        try {
            if (!socket.userId) return socket.emit('error_msg', 'Not logged in!');
            const now = Date.now();
            const lastClaim = claimCooldowns.get(socket.userId) || 0;
            const cooldownMs = 30000; // 30 second cooldown
            if (now - lastClaim < cooldownMs) {
                const remainingSec = Math.ceil((cooldownMs - (now - lastClaim)) / 1000);
                return socket.emit('error_msg', `Please wait ${remainingSec}s before claiming again!`);
            }
            claimCooldowns.set(socket.userId, now);

            const bonus = 10000000;
            const updated = await db.updateUserCoins(socket.userId, bonus);
            socket.emit('balance_updated', {
                coins: updated.coins,
                diamonds: updated.diamonds,
                message: '+10,000,000 Free Bonus Coins claimed!'
            });
        } catch (err) {
            socket.emit('error_msg', err.message);
        }
    });

    socket.on('convert_coins_to_diamonds', async (data) => {
        try {
            if (!socket.userId) return socket.emit('error_msg', 'Not logged in!');
            const coinsToConvert = parseInt(data && data.coins, 10);
            const rate = 10000; // 10,000 coins = 1 diamond
            if (isNaN(coinsToConvert) || coinsToConvert < rate) {
                return socket.emit('error_msg', `Minimum conversion is ${rate.toLocaleString()} coins!`);
            }
            const diamondsToAdd = Math.floor(coinsToConvert / rate);
            const actualCoins = diamondsToAdd * rate;

            const dec = await db.deductUserCoins(socket.userId, actualCoins);
            if (!dec) {
                return socket.emit('error_msg', 'Insufficient coins balance!');
            }
            const updated = await db.updateUserProfit(socket.userId, 0, diamondsToAdd);
            socket.emit('balance_updated', {
                coins: updated.coins,
                diamonds: updated.diamonds,
                message: `Converted ${actualCoins.toLocaleString()} coins into ${diamondsToAdd.toLocaleString()} diamonds!`
            });
        } catch (err) {
            socket.emit('error_msg', err.message);
        }
    });

    socket.on('get_my_record', async () => {
        try {
            if (!socket.userId) return;
            const history = await db.getUserBetHistory(socket.userId, 20);
            socket.emit('my_record_response', history);
        } catch (err) {
            socket.emit('error_msg', err.message);
        }
    });

    socket.on('get_revenue_ranks', async () => {
        try {
            const ranks = await db.getTodayProfitRank(20);
            socket.emit('revenue_ranks_response', ranks);
        } catch (err) {
            socket.emit('error_msg', err.message);
        }
    });

    socket.on('disconnect', () => {
        console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
});

// Start Server
gameEngine.init().then(() => {
    server.listen(PORT, () => {
        console.log(`===============================================`);
        console.log(`🍟 GREEDY MULTIPLAYER GAME SERVER ACTIVE 🍗`);
        console.log(`📡 URL: http://localhost:${PORT}`);
        console.log(`👤 Real Players Mode (Auto Coins / Bot Bets Disabled)`);
        console.log(`🐬 All Data Stored in MySQL (Zero Static Dummy Data)`);
        console.log(`===============================================`);
    });
});
