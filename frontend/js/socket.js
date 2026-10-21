// Socket.io Real-time Client for Greedy Game
class GameSocket {
    constructor() {
        this.socket = null;
        this.isConnected = false;
    }

    getAuthCredentials() {
        try {
            const urlParams = new URLSearchParams(window.location.search);

            // 1. Support all query parameter variations
            // userId: userId, user_id, uid, id
            const userId = urlParams.get('userId') || urlParams.get('user_id') || urlParams.get('uid') || urlParams.get('id');
            // username: username, name, user
            const username = urlParams.get('username') || urlParams.get('name') || urlParams.get('user');
            // avatar: avtar (user request spelling), avatar
            const avatar = urlParams.get('avtar') || urlParams.get('avatar');
            // coins: coins, coin, balance
            const coins = urlParams.get('coins') || urlParams.get('coin') || urlParams.get('balance');
            // diamonds: diamonds, diamond
            const diamonds = urlParams.get('diamonds') || urlParams.get('diamond');
            // callbackUrl: callbackUrl, callback, webhook
            const callbackUrl = urlParams.get('callbackUrl') || urlParams.get('callback') || urlParams.get('webhook');

            // 2. Persist in localStorage so WebView page refresh or reconnect keeps credentials
            if (userId) localStorage.setItem('greedy_user_id', userId);
            if (username) localStorage.setItem('greedy_username', username);
            if (avatar) localStorage.setItem('greedy_avatar', avatar);
            if (coins !== null) localStorage.setItem('greedy_coins', coins);
            if (diamonds !== null) localStorage.setItem('greedy_diamonds', diamonds);
            if (callbackUrl) localStorage.setItem('greedy_callback_url', callbackUrl);

            // 3. Fallbacks
            const finalUserId = userId || localStorage.getItem('greedy_user_id') || null;
            let finalUsername = username || localStorage.getItem('greedy_username');
            if (!finalUsername) {
                finalUsername = finalUserId ? `User_${finalUserId}` : 'Player_' + Math.floor(1000 + Math.random() * 9000);
                localStorage.setItem('greedy_username', finalUsername);
            }
            const finalAvatar = avatar || localStorage.getItem('greedy_avatar') || 'avatar1';
            const storedCoins = localStorage.getItem('greedy_coins');
            const finalCoins = coins !== null ? coins : storedCoins;
            const storedDiamonds = localStorage.getItem('greedy_diamonds');
            const finalDiamonds = diamonds !== null ? diamonds : storedDiamonds;
            const finalCallbackUrl = callbackUrl || localStorage.getItem('greedy_callback_url') || null;

            return {
                userId: finalUserId,
                username: finalUsername,
                avatar: finalAvatar,
                coins: (finalCoins !== null && finalCoins !== undefined && !isNaN(parseInt(finalCoins, 10))) ? parseInt(finalCoins, 10) : undefined,
                diamonds: (finalDiamonds !== null && finalDiamonds !== undefined && !isNaN(parseInt(finalDiamonds, 10))) ? parseInt(finalDiamonds, 10) : undefined,
                callbackUrl: finalCallbackUrl
            };
        } catch (e) {
            console.error('[Socket] Failed to parse auth params:', e);
            return {
                username: 'Player_' + Math.floor(1000 + Math.random() * 9000),
                avatar: 'avatar1'
            };
        }
    }

    connect() {
        // Connect to current host or specified server port
        const serverUrl = window.location.origin;
        this.socket = io(serverUrl, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 10
        });

        this.setupListeners();
    }

    setupListeners() {
        this.socket.on('connect', () => {
            console.log('[Socket] Connected to server! ID:', this.socket.id);
            this.isConnected = true;
            window.app.updateConnectionStatus(true);

            // Authenticate with URL query parameters (userId, username, avtar, coins, diamonds)
            const creds = this.getAuthCredentials();
            console.log('[Socket] Authenticating user credentials:', creds);
            this.socket.emit('auth_user', creds);
        });

        this.socket.on('disconnect', () => {
            console.warn('[Socket] Disconnected from server');
            this.isConnected = false;
            window.app.updateConnectionStatus(false);
        });

        this.socket.on('init_game_state', (data) => {
            window.app.handleInitGameState(data);
        });

        this.socket.on('game_tick', (data) => {
            window.app.handleGameTick(data);
        });

        this.socket.on('round_start', (data) => {
            window.app.handleRoundStart(data);
        });

        this.socket.on('bet_placed_broadcast', (data) => {
            window.app.handleBetBroadcast(data);
        });

        this.socket.on('spin_start', (data) => {
            window.app.handleSpinStart(data);
        });

        this.socket.on('round_result', (data) => {
            window.app.handleRoundResult(data);
        });

        this.socket.on('bet_response', (data) => {
            window.app.handleBetResponse(data);
        });

        this.socket.on('repeat_response', (data) => {
            window.app.handleRepeatResponse(data);
        });

        this.socket.on('balance_updated', (data) => {
            window.app.handleBalanceUpdated(data);
        });

        this.socket.on('items_updated', (data) => {
            if (window.app && window.app.handleItemsUpdated) {
                window.app.handleItemsUpdated(data);
            }
        });

        this.socket.on('leaderboard_update', (data) => {
            window.app.handleLeaderboardUpdate(data);
        });

        this.socket.on('revenue_ranks_response', (data) => {
            window.app.handleRevenueRanksResponse(data);
        });

        this.socket.on('my_record_response', (data) => {
            window.app.handleMyRecordResponse(data);
        });

        this.socket.on('error_msg', (msg) => {
            window.app.showToast(msg, 'error');
        });
    }

    placeBet(itemId, amount) {
        if (!this.isConnected) {
            window.app.showToast('Reconnecting to server...', 'warning');
            return;
        }
        this.socket.emit('place_bet', { itemId, amount });
    }

    repeatBet() {
        if (!this.isConnected) {
            window.app.showToast('Reconnecting to server...', 'warning');
            return;
        }
        this.socket.emit('repeat_bet');
    }

    claimFreeCoins() {
        if (!this.isConnected) return;
        this.socket.emit('claim_free_coins');
    }

    getRevenueRanks() {
        if (!this.isConnected) return;
        this.socket.emit('get_revenue_ranks');
    }

    convertCoins(coins) {
        this.socket.emit('convert_coins_to_diamonds', { coins });
    }

    fetchMyRecord() {
        this.socket.emit('get_my_record');
    }
}

window.gameSocket = new GameSocket();
