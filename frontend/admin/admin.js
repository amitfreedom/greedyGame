/**
 * GREEDY WHEEL - GAME COMMAND CENTER CLIENT
 * Real-time monitoring, live outcome overrides, user wallet controls, and game engine configurations.
 */

(function () {
    'use strict';

    // Global Admin State
    let socket = null;
    let currentEngineState = null;
    let selectedUserForAdjust = null;
    let activeModalCurrency = 'coins';
    let activeModalAction = 'credit';

    // Current Margin Controls State
    let currentTargetMargin = 60;
    let currentHouseCommission = 5;
    let currentHouseShield = true;

    // Multiplier Presets
    const MULTIPLIER_PRESETS = {
        standard: {
            hotdog: 10, kebab: 15, chicken: 25, steak: 45,
            tomato: 5, corn: 5, cabbage: 5, carrot: 5,
            veg_combo: 1.25, salad: 2, pizza: 2.5, meat_combo: 4.37
        },
        low: {
            hotdog: 6, kebab: 10, chicken: 15, steak: 25,
            tomato: 3, corn: 3, cabbage: 3, carrot: 3,
            veg_combo: 1.1, salad: 1.5, pizza: 2.0, meat_combo: 3.5
        },
        balanced: {
            hotdog: 8, kebab: 12, chicken: 20, steak: 35,
            tomato: 4, corn: 4, cabbage: 4, carrot: 4,
            veg_combo: 1.2, salad: 1.8, pizza: 2.2, meat_combo: 4.0
        },
        high: {
            hotdog: 12, kebab: 18, chicken: 30, steak: 50,
            tomato: 5, corn: 5, cabbage: 5, carrot: 5,
            veg_combo: 1.3, salad: 2.2, pizza: 2.8, meat_combo: 4.8
        }
    };

    // DOM Elements Cache
    const el = {
        // Navbar
        engineStatusText: document.getElementById('engineStatusText'),
        navOnlineUsers: document.getElementById('navOnlineUsers'),
        navActivePool: document.getElementById('navActivePool'),
        navHouseMarginBadge: document.getElementById('navHouseMarginBadge'),
        manualRefreshBtn: document.getElementById('manualRefreshBtn'),

        // Engine Live Hero
        currentRoundPill: document.getElementById('currentRoundPill'),
        timerProgressCircle: document.getElementById('timerProgressCircle'),
        liveTimerSeconds: document.getElementById('liveTimerSeconds'),
        livePhaseBadge: document.getElementById('livePhaseBadge'),
        pausedIndicator: document.getElementById('pausedIndicator'),
        liveBettorsCount: document.getElementById('liveBettorsCount'),
        liveRoundTotalBets: document.getElementById('liveRoundTotalBets'),
        liveHotItemText: document.getElementById('liveHotItemText'),

        // Engine Quick Actions
        btnTogglePause: document.getElementById('btnTogglePause'),
        pauseIcon: document.getElementById('pauseIcon'),
        pauseBtnText: document.getElementById('pauseBtnText'),
        btnForceSpin: document.getElementById('btnForceSpin'),
        btnResetRound: document.getElementById('btnResetRound'),

        // Analytics KPIs
        kpiTotalRounds: document.getElementById('kpiTotalRounds'),
        kpiTotalBets: document.getElementById('kpiTotalBets'),
        kpiTotalPayouts: document.getElementById('kpiTotalPayouts'),
        kpiHouseProfit: document.getElementById('kpiHouseProfit'),
        kpiRtp: document.getElementById('kpiRtp'),
        kpiTotalUsers: document.getElementById('kpiTotalUsers'),

        // Outcome Control
        currentOutcomeStatusBanner: document.getElementById('currentOutcomeStatusBanner'),
        activeStrategyLabel: document.getElementById('activeStrategyLabel'),
        strategyTabs: document.querySelectorAll('.strategy-tab'),
        potsRiskGrid: document.getElementById('potsRiskGrid'),

        // Margin & Owner Profit Controls
        displayCurrentMarginVal: document.getElementById('displayCurrentMarginVal'),
        shieldStatusBadge: document.getElementById('shieldStatusBadge'),
        commStatusBadge: document.getElementById('commStatusBadge'),
        marginPresetBtns: document.querySelectorAll('.margin-preset-btn'),
        marginRangeSlider: document.getElementById('marginRangeSlider'),
        marginSliderVal: document.getElementById('marginSliderVal'),
        commPresetBtns: document.querySelectorAll('.comm-preset-btn'),
        toggleHouseShield: document.getElementById('toggleHouseShield'),
        btnApplyMarginSettings: document.getElementById('btnApplyMarginSettings'),

        // Multipliers Controls
        multipliersForm: document.getElementById('multipliersForm'),
        btnSaveMultipliers: document.getElementById('btnSaveMultipliers'),
        btnMultiPresets: document.querySelectorAll('.btn-multi-preset'),
        toggleAutoCalcCombos: document.getElementById('toggleAutoCalcCombos'),
        autoCalcStatusBadge: document.getElementById('autoCalcStatusBadge'),

        // User Management
        userSearchInput: document.getElementById('userSearchInput'),
        btnUserSearch: document.getElementById('btnUserSearch'),
        usersTableBody: document.getElementById('usersTableBody'),

        // Timing Configuration
        timingConfigForm: document.getElementById('timingConfigForm'),
        inputBettingTime: document.getElementById('inputBettingTime'),
        inputSpinTime: document.getElementById('inputSpinTime'),
        inputResultTime: document.getElementById('inputResultTime'),

        // Recent Rounds Table
        recentRoundsBody: document.getElementById('recentRoundsBody'),

        // Wallet Modal
        walletAdjustModal: document.getElementById('walletAdjustModal'),
        closeAdjustModalBtn: document.getElementById('closeAdjustModalBtn'),
        modalTargetUser: document.getElementById('modalTargetUser'),
        modalUserCoins: document.getElementById('modalUserCoins'),
        modalUserDiamonds: document.getElementById('modalUserDiamonds'),
        currencyToggleBtns: document.querySelectorAll('.currency-toggle-btn'),
        actionToggleBtns: document.querySelectorAll('.action-toggle-btn'),
        adjustAmountInput: document.getElementById('adjustAmountInput'),
        quickChipBtns: document.querySelectorAll('.quick-chip-btn'),
        btnSubmitAdjustment: document.getElementById('btnSubmitAdjustment'),

        // Toast Container
        toastContainer: document.getElementById('adminToastContainer'),

        // Sidebar Navigation & Drawer
        btnSidebarToggle: document.getElementById('btnSidebarToggle'),
        adminSidebar: document.getElementById('adminSidebar'),
        btnCloseSidebar: document.getElementById('btnCloseSidebar'),
        sidebarBackdrop: document.getElementById('sidebarBackdrop'),
        sidebarNavLinks: document.querySelectorAll('.sidebar-nav-link'),

        // Sidebar Live Status
        sidebarRoundPill: document.getElementById('sidebarRoundPill'),
        sidebarPhaseBadge: document.getElementById('sidebarPhaseBadge'),
        sidebarTimerSeconds: document.getElementById('sidebarTimerSeconds'),
        sidebarPoolVal: document.getElementById('sidebarPoolVal'),
        sidebarBtnTogglePause: document.getElementById('sidebarBtnTogglePause'),
        sidebarPauseIcon: document.getElementById('sidebarPauseIcon'),
        sidebarPauseText: document.getElementById('sidebarPauseText'),
        sidebarBtnForceSpin: document.getElementById('sidebarBtnForceSpin'),

        // Main View Sections
        viewSectionHero: document.getElementById('viewSectionHero'),
        viewSectionOutcomes: document.getElementById('viewSectionOutcomes'),
        viewSectionMultipliers: document.getElementById('viewSectionMultipliers'),
        viewSectionUsers: document.getElementById('viewSectionUsers'),
        viewSectionTimings: document.getElementById('viewSectionTimings'),
        viewSectionHistory: document.getElementById('viewSectionHistory'),
        viewSectionLowerGrid: document.getElementById('viewSectionLowerGrid')
    };

    const TIMER_CIRCUMFERENCE = 2 * Math.PI * 52; // ~326.72

    // ==================== UTILITIES ====================

    function formatNumber(num) {
        if (num === null || num === undefined) return '0';
        return Number(num).toLocaleString('en-US');
    }

    function formatDate(dateStr) {
        if (!dateStr) return '--';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function showToast(message, type = 'success') {
        if (!el.toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `admin-toast toast-${type}`;
        toast.textContent = message;
        el.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    }

    // ==================== SOCKET.IO INITIALIZATION ====================

    function initSocket() {
        socket = io();

        socket.on('connect', () => {
            console.log('[AdminPanel] Socket connected:', socket.id);
            if (el.engineStatusText) {
                el.engineStatusText.textContent = 'LIVE';
                el.engineStatusText.style.color = '#00E676';
            }
            // Register as admin to receive live engine tick broadcasts
            socket.emit('admin_join');
        });

        socket.on('disconnect', () => {
            console.warn('[AdminPanel] Socket disconnected');
            if (el.engineStatusText) {
                el.engineStatusText.textContent = 'OFFLINE';
                el.engineStatusText.style.color = '#FF3D71';
            }
        });

        // Real-time engine tick update
        socket.on('admin_game_tick', (data) => {
            currentEngineState = data;
            renderEngineTick(data);
        });

        // Multipliers update broadcast
        socket.on('items_updated', (data) => {
            if (data) {
                syncMultipliersUI(data.items, data.comboItems);
            }
        });

        // Live Round Result - refresh audit & analytics
        socket.on('round_result', (result) => {
            console.log('[AdminPanel] Round result received:', result);
            fetchRecentRounds();
            fetchOverview();
        });
    }

    // ==================== RENDER REAL-TIME ENGINE TICK ====================

    function renderEngineTick(data) {
        if (!data) return;

        // 1. Round ID
        if (el.currentRoundPill) {
            el.currentRoundPill.textContent = `Round #${data.roundNumber}`;
        }

        // 2. Timer Radial & Seconds
        const timeLeft = Math.max(0, data.timeLeft || 0);
        if (el.liveTimerSeconds) {
            el.liveTimerSeconds.textContent = timeLeft;
        }

        let totalDuration = 15;
        if (data.durations) {
            if (data.state === 'BETTING') totalDuration = data.durations.bettingTime || 15;
            else if (data.state === 'SPINNING') totalDuration = data.durations.spinTime || 8;
            else if (data.state === 'RESULT') totalDuration = data.durations.resultTime || 5;
        }

        if (el.timerProgressCircle) {
            const fraction = totalDuration > 0 ? timeLeft / totalDuration : 0;
            const offset = TIMER_CIRCUMFERENCE * (1 - fraction);
            el.timerProgressCircle.style.strokeDasharray = `${TIMER_CIRCUMFERENCE}`;
            el.timerProgressCircle.style.strokeDashoffset = `${offset}`;

            // Visual color switch
            if (data.state === 'BETTING') {
                el.timerProgressCircle.style.stroke = timeLeft <= 3 ? '#FF3D71' : '#00E676';
            } else if (data.state === 'SPINNING') {
                el.timerProgressCircle.style.stroke = '#FFB300';
            } else {
                el.timerProgressCircle.style.stroke = '#7C4DFF';
            }
        }

        // 3. Phase Badge
        if (el.livePhaseBadge) {
            el.livePhaseBadge.textContent = data.state || 'BETTING';
            el.livePhaseBadge.className = `engine-phase-badge phase-${(data.state || 'betting').toLowerCase()}`;
        }

        // 4. Pause Indicator & Button
        if (el.pausedIndicator) {
            if (data.isPaused) {
                el.pausedIndicator.classList.remove('hidden');
            } else {
                el.pausedIndicator.classList.add('hidden');
            }
        }
        if (el.pauseIcon && el.pauseBtnText) {
            if (data.isPaused) {
                el.pauseIcon.textContent = '▶';
                el.pauseBtnText.textContent = 'Resume Game';
                el.btnTogglePause.style.background = 'rgba(0, 230, 118, 0.15)';
                el.btnTogglePause.style.color = '#00E676';
            } else {
                el.pauseIcon.textContent = '⏸';
                el.pauseBtnText.textContent = 'Pause Game';
                el.btnTogglePause.style.background = 'rgba(255, 179, 0, 0.12)';
                el.btnTogglePause.style.color = '#FFB300';
            }
        }

        // 5. Mini Stats
        if (el.liveBettorsCount) {
            el.liveBettorsCount.textContent = data.activeBettorsCount || 0;
        }
        if (el.liveRoundTotalBets) {
            el.liveRoundTotalBets.textContent = `🪙 ${formatNumber(data.totalRoomBets || 0)}`;
        }
        if (el.navActivePool) {
            el.navActivePool.textContent = `🪙 ${formatNumber(data.totalRoomBets || 0)}`;
        }
        if (el.liveHotItemText) {
            el.liveHotItemText.textContent = (data.hotItem || 'HOTDOG').toUpperCase();
        }

        // 5.1 Sync Sidebar Live Status Pill Widget
        if (el.sidebarRoundPill) el.sidebarRoundPill.textContent = `Round #${data.roundNumber}`;
        if (el.sidebarPhaseBadge) {
            el.sidebarPhaseBadge.textContent = data.state || 'BETTING';
            el.sidebarPhaseBadge.className = `sl-phase phase-${(data.state || 'betting').toLowerCase()}`;
        }
        if (el.sidebarTimerSeconds) el.sidebarTimerSeconds.textContent = `${timeLeft}s`;
        if (el.sidebarPoolVal) el.sidebarPoolVal.textContent = `🪙 ${formatNumber(data.totalRoomBets || 0)}`;

        if (el.sidebarPauseIcon && el.sidebarPauseText) {
            if (data.isPaused) {
                el.sidebarPauseIcon.textContent = '▶';
                el.sidebarPauseText.textContent = 'Resume';
            } else {
                el.sidebarPauseIcon.textContent = '⏸';
                el.sidebarPauseText.textContent = 'Pause';
            }
        }

        // 6. House Margin & Settings Display
        const targetMargin = data.targetMarginPct !== undefined ? data.targetMarginPct : 60;
        const houseComm = data.houseCommissionPct !== undefined ? data.houseCommissionPct : 5;
        const shieldActive = data.houseShieldEnabled !== undefined ? data.houseShieldEnabled : true;

        currentTargetMargin = targetMargin;
        currentHouseCommission = houseComm;
        currentHouseShield = shieldActive;

        if (el.navHouseMarginBadge) {
            el.navHouseMarginBadge.textContent = `${targetMargin}% MARGIN`;
        }
        if (el.displayCurrentMarginVal) {
            el.displayCurrentMarginVal.textContent = `${targetMargin}%`;
        }
        if (el.marginSliderVal) {
            el.marginSliderVal.textContent = `${targetMargin}%`;
        }
        if (el.marginRangeSlider && document.activeElement !== el.marginRangeSlider) {
            el.marginRangeSlider.value = targetMargin;
        }

        if (el.shieldStatusBadge) {
            if (shieldActive) {
                el.shieldStatusBadge.textContent = '🛡️ Shield: Active';
                el.shieldStatusBadge.className = 'shield-badge shield-active';
            } else {
                el.shieldStatusBadge.textContent = '🛡️ Shield: Off';
                el.shieldStatusBadge.className = 'shield-badge shield-disabled';
            }
        }
        if (el.toggleHouseShield) {
            el.toggleHouseShield.checked = shieldActive;
        }

        if (el.commStatusBadge) {
            el.commStatusBadge.textContent = `🪙 Cut: ${houseComm}%`;
        }

        // Sync preset buttons active state
        el.marginPresetBtns.forEach(btn => {
            const m = parseInt(btn.dataset.margin, 10);
            if (m === targetMargin) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        el.commPresetBtns.forEach(btn => {
            const c = parseInt(btn.dataset.comm, 10);
            if (c === houseComm) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        // 7. Multipliers UI Sync
        syncMultipliersUI(data.items, data.comboItems);

        // 8. Outcome Mode & Strategy Tabs
        updateStrategyDisplay(data.outcomeMode, data.forcedWinningItem, targetMargin);

        // 9. Wheel Pots Risk Grid
        if (data.projectedOutcomes && Array.isArray(data.projectedOutcomes)) {
            renderPotsRiskGrid(data.projectedOutcomes, data.outcomeMode, data.forcedWinningItem);
        }
    }

    // ==================== SIDEBAR & VIEW SWITCHER ====================

    let currentActiveView = 'dashboard';

    function openSidebar() {
        if (el.adminSidebar) el.adminSidebar.classList.add('open');
        if (el.sidebarBackdrop) el.sidebarBackdrop.classList.add('open');
        if (window.innerWidth <= 1024) document.body.style.overflow = 'hidden';
    }

    function closeSidebar() {
        if (el.adminSidebar) el.adminSidebar.classList.remove('open');
        if (el.sidebarBackdrop) el.sidebarBackdrop.classList.remove('open');
        document.body.style.overflow = '';
    }

    function switchAdminView(viewName) {
        currentActiveView = viewName;

        // 1. Highlight active button in sidebar
        if (el.sidebarNavLinks) {
            el.sidebarNavLinks.forEach(link => {
                if (link.dataset.view === viewName) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            });
        }

        // 2. Sections mapping
        const hero = el.viewSectionHero;
        const outcomes = el.viewSectionOutcomes;
        const multis = el.viewSectionMultipliers;
        const users = el.viewSectionUsers;
        const timings = el.viewSectionTimings;
        const history = el.viewSectionHistory;
        const lowerGrid = el.viewSectionLowerGrid;

        const show = (elem) => { if (elem) elem.style.display = ''; };
        const hide = (elem) => { if (elem) elem.style.display = 'none'; };

        if (viewName === 'all') {
            // View All (Full Page)
            show(hero);
            show(outcomes);
            show(multis);
            show(users);
            show(lowerGrid);
            show(timings);
            show(history);
            if (lowerGrid) lowerGrid.style.gridTemplateColumns = '';
        } else if (viewName === 'dashboard') {
            // Main Informatic View on Home Page:
            // Live Engine Hero + Lifetime House KPIs + Outcomes Risk Grid + Recent Rounds History
            show(hero);
            show(outcomes);
            show(lowerGrid);
            hide(timings);
            show(history);
            hide(multis);
            hide(users);
            if (lowerGrid) lowerGrid.style.gridTemplateColumns = '1fr';
        } else if (viewName === 'outcomes') {
            // Outcome & Margin Focus (keeps Hero informatic view at top)
            show(hero);
            show(outcomes);
            hide(multis);
            hide(users);
            hide(lowerGrid);
        } else if (viewName === 'multipliers') {
            // Multipliers Manager Focus (keeps Hero informatic view at top)
            show(hero);
            show(multis);
            hide(outcomes);
            hide(users);
            hide(lowerGrid);
        } else if (viewName === 'users') {
            // Users & Wallets Focus (keeps Hero informatic view at top)
            show(hero);
            show(users);
            hide(outcomes);
            hide(multis);
            hide(lowerGrid);
        } else if (viewName === 'history') {
            // Rounds Audit Log Focus (keeps Hero informatic view at top)
            show(hero);
            show(lowerGrid);
            hide(timings);
            show(history);
            hide(outcomes);
            hide(multis);
            hide(users);
            if (lowerGrid) lowerGrid.style.gridTemplateColumns = '1fr';
        } else if (viewName === 'settings') {
            // Timings & Speed Focus (keeps Hero informatic view at top)
            show(hero);
            show(lowerGrid);
            show(timings);
            hide(history);
            hide(outcomes);
            hide(multis);
            hide(users);
            if (lowerGrid) lowerGrid.style.gridTemplateColumns = '1fr';
        }

        // On mobile, auto-close drawer
        closeSidebar();

        // Smooth scroll to top of view
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ==================== MULTIPLIERS UI SYNC & PRESETS ====================

    function syncMultipliersUI(items = [], comboItems = []) {
        // Prevent background tick updates from overriding fields while admin is typing
        const isEditingMultipliers = document.activeElement && document.activeElement.closest && document.activeElement.closest('#multipliersForm');
        if (isEditingMultipliers) return;

        if (items && Array.isArray(items)) {
            items.forEach(item => {
                const input = document.getElementById(`multi_${item.id}`);
                if (input && document.activeElement !== input) {
                    input.value = item.multiplier;
                }
            });
        }
        if (comboItems && Array.isArray(comboItems)) {
            comboItems.forEach(combo => {
                const input = document.getElementById(`multi_${combo.id}`);
                if (input && document.activeElement !== input) {
                    input.value = combo.multiplier;
                }
            });
        }
    }

    function autoRecalculateCombosFromPots() {
        if (el.toggleAutoCalcCombos && !el.toggleAutoCalcCombos.checked) return;

        const getVal = (id, fallback) => {
            const inp = document.getElementById(`multi_${id}`);
            if (!inp) return fallback;
            const n = parseFloat(inp.value);
            return (!isNaN(n) && n > 0) ? n : fallback;
        };

        const tomato = getVal('tomato', 5);
        const corn = getVal('corn', 5);
        const cabbage = getVal('cabbage', 5);
        const carrot = getVal('carrot', 5);

        const hotdog = getVal('hotdog', 10);
        const kebab = getVal('kebab', 15);
        const chicken = getVal('chicken', 25);
        const steak = getVal('steak', 45);

        const avgVeg = (tomato + corn + cabbage + carrot) / 4;
        const avgMeat = (hotdog + kebab + chicken + steak) / 4;

        // Auto formulas:
        // 1. Veg Basket (4 Veggies) = avgVeg / 4
        const vegComboVal = Math.round((avgVeg / 4) * 100) / 100;
        // 2. Salad Bowl (4 Veggies) = avgVeg * 0.40
        const saladVal = Math.round((avgVeg * 0.4) * 100) / 100;
        // 3. Pizza Platter (4 Meats) = hotdog / 4
        const pizzaVal = Math.round((hotdog / 4) * 100) / 100;
        // 4. Meat Basket (4 Meats) = avgMeat * (4.37 / 23.75)
        const meatComboVal = Math.round((avgMeat * (4.37 / 23.75)) * 100) / 100;

        const setComboInput = (id, val) => {
            const inp = document.getElementById(`multi_${id}`);
            if (inp && document.activeElement !== inp) {
                inp.value = val;
                inp.style.transition = 'color 0.2s';
                inp.style.color = '#00E676';
                setTimeout(() => { inp.style.color = 'var(--accent-gold)'; }, 350);
            }
        };

        setComboInput('veg_combo', vegComboVal);
        setComboInput('salad', saladVal);
        setComboInput('pizza', pizzaVal);
        setComboInput('meat_combo', meatComboVal);
    }

    function applyMultiplierPreset(presetName) {
        const preset = MULTIPLIER_PRESETS[presetName];
        if (!preset) return;

        Object.entries(preset).forEach(([id, val]) => {
            const input = document.getElementById(`multi_${id}`);
            if (input) {
                input.value = val;
            }
        });

        // If auto-calc is enabled, automatically recalculate combo baskets from pots
        if (el.toggleAutoCalcCombos && el.toggleAutoCalcCombos.checked) {
            autoRecalculateCombosFromPots();
        }

        el.btnMultiPresets.forEach(btn => {
            if (btn.dataset.preset === presetName) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        showToast(`Preset "${presetName.toUpperCase()}" loaded into fields. Click "Save & Broadcast" to apply!`, 'warning');
    }

    // ==================== STRATEGY TABS & STATUS BANNER ====================

    function updateStrategyDisplay(mode = 'smart_margin', forcedItem = null, targetMargin = 60) {
        // Update Status Banner
        if (el.activeStrategyLabel) {
            if (mode === 'manual' && forcedItem) {
                el.activeStrategyLabel.innerHTML = `🎯 Forced Pot: <span style="color:#00D2FF;text-transform:uppercase;">${forcedItem}</span>`;
            } else if (mode === 'max_owner_profit' || mode === 'min_payout') {
                el.activeStrategyLabel.innerHTML = `<span style="color:#00E676;">💎 100% Owner Margin (Zero User Payout / Empty Pot)</span>`;
            } else if (mode === 'smart_margin') {
                el.activeStrategyLabel.innerHTML = `<span style="color:#FFB300;">🏦 Smart Target Margin (${targetMargin}% Owner Retention)</span>`;
            } else if (mode === 'max_payout') {
                el.activeStrategyLabel.textContent = '⚡ Jackpot Hype Mode (High Meat Pot)';
            } else {
                el.activeStrategyLabel.textContent = '🎲 Standard Casual RNG (House Shield Active)';
            }
        }

        // Update active tab button
        el.strategyTabs.forEach(tab => {
            const tabMode = tab.dataset.mode;
            if (tabMode === mode || (tabMode === 'max_owner_profit' && mode === 'min_payout')) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    }

    // ==================== POTS RISK & OUTCOME SELECTOR GRID ====================

    function renderPotsRiskGrid(projectedOutcomes, activeMode, forcedItem) {
        if (!el.potsRiskGrid) return;

        el.potsRiskGrid.innerHTML = projectedOutcomes.map(item => {
            const isLocked = (activeMode === 'manual' && forcedItem === item.id);
            const isMeat = item.type === 'meat';
            const houseNetClass = item.houseNet >= 0 ? 'text-green' : 'text-red';
            const houseNetPrefix = item.houseNet >= 0 ? '+' : '';

            return `
                <div class="dish-card ${isMeat ? 'dish-meat' : 'dish-veg'} ${isLocked ? 'is-locked-winner' : ''}" data-item-id="${item.id}">
                    <div class="dish-top-row">
                        <img src="../assets/icons/${item.id}.svg" class="dish-img-thumb" alt="${item.name}" onerror="this.src='../assets/icons/hotdog.svg'">
                        <div class="dish-identity">
                            <div class="dish-name">${item.name}</div>
                            <span class="dish-multiplier-badge">${item.multiplier}x Multiplier</span>
                        </div>
                    </div>

                    <div class="dish-metrics-box">
                        <div class="metric-line">
                            <span class="label">Current Bets:</span>
                            <span class="val gold-text">🪙 ${formatNumber(item.potBet)}</span>
                        </div>
                        <div class="metric-line">
                            <span class="label">If Wins (Disbursed):</span>
                            <span class="val">🪙 ${formatNumber(item.projectedPayout)}</span>
                        </div>
                        <div class="metric-line">
                            <span class="label">House Net:</span>
                            <span class="val ${houseNetClass}">${houseNetPrefix}🪙 ${formatNumber(item.houseNet)} (${item.houseMarginPct}%)</span>
                        </div>
                    </div>

                    <button class="btn-lock-outcome" data-item-id="${item.id}">
                        ${isLocked ? '🔒 LOCKED WINNER' : '🎯 LOCK POT'}
                    </button>
                </div>
            `;
        }).join('');

        // Attach Lock Pot click handlers
        el.potsRiskGrid.querySelectorAll('.btn-lock-outcome').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const itemId = btn.dataset.itemId;
                // If currently locked to this pot, clicking again unlocks back to smart_margin
                if (activeMode === 'manual' && forcedItem === itemId) {
                    saveMarginSettings({ outcomeMode: 'smart_margin' });
                } else {
                    saveMarginSettings({ outcomeMode: 'manual', forcedWinningItem: itemId });
                }
            });
        });
    }

    // ==================== HOUSE MARGIN & OUTCOME API ====================

    async function saveMarginSettings(config = {}) {
        try {
            const res = await fetch('/api/admin/margin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            const data = await res.json();
            if (data.success) {
                showToast(data.message || 'Margin settings applied successfully', 'success');
            } else {
                showToast(data.message || 'Failed to apply margin settings', 'error');
            }
        } catch (err) {
            console.error('[Admin] Margin config error:', err);
            showToast('Network error while saving margin settings', 'error');
        }
    }

    // ==================== MULTIPLIERS API ====================

    async function saveMultipliersSettings(multipliers) {
        try {
            if (el.btnSaveMultipliers) {
                el.btnSaveMultipliers.disabled = true;
                el.btnSaveMultipliers.textContent = 'Saving & Broadcasting...';
            }

            const autoCalculateCombos = el.toggleAutoCalcCombos ? el.toggleAutoCalcCombos.checked : true;

            const res = await fetch('/api/admin/multipliers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ multipliers, autoCalculateCombos })
            });

            const data = await res.json();
            if (data.success) {
                showToast(data.message || 'Multipliers updated successfully!', 'success');
                if (data.items && data.comboItems) {
                    syncMultipliersUI(data.items, data.comboItems);
                }
            } else {
                showToast(data.message || 'Failed to update multipliers', 'error');
            }
        } catch (err) {
            console.error('[Admin] Multipliers save error:', err);
            showToast('Network error while updating multipliers', 'error');
        } finally {
            if (el.btnSaveMultipliers) {
                el.btnSaveMultipliers.disabled = false;
                el.btnSaveMultipliers.textContent = '💾 Save & Broadcast Multipliers to Live Game';
            }
        }
    }

    // ==================== GAME CONTROL API ====================

    async function executeGameControl(action) {
        try {
            const res = await fetch('/api/admin/game-control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });
            const data = await res.json();
            if (data.success) {
                showToast(data.message || 'Action executed successfully', 'success');
            } else {
                showToast(data.message || 'Action failed', 'error');
            }
        } catch (err) {
            console.error('[Admin] Game control error:', err);
            showToast('Network error while executing game control', 'error');
        }
    }

    // ==================== FETCH OVERVIEW & ANALYTICS ====================

    async function fetchOverview() {
        try {
            const res = await fetch('/api/admin/overview');
            const data = await res.json();
            if (!data.success) return;

            const { game, analytics } = data;

            // Online Users
            if (el.navOnlineUsers && game.onlineUsers !== undefined) {
                el.navOnlineUsers.textContent = game.onlineUsers;
            }

            // Analytics KPIs
            if (analytics) {
                if (el.kpiTotalRounds) el.kpiTotalRounds.textContent = formatNumber(analytics.totalRounds);
                if (el.kpiTotalBets) el.kpiTotalBets.textContent = `🪙 ${formatNumber(analytics.totalBets)}`;
                if (el.kpiTotalPayouts) el.kpiTotalPayouts.textContent = `🪙 ${formatNumber(analytics.totalPayouts)}`;
                if (el.kpiHouseProfit) {
                    const hp = analytics.houseProfit || 0;
                    el.kpiHouseProfit.textContent = `🪙 ${formatNumber(hp)}`;
                    el.kpiHouseProfit.className = `kpi-val ${hp >= 0 ? 'text-green' : 'text-red'}`;
                }
                if (el.kpiRtp) el.kpiRtp.textContent = analytics.rtp || '0.00%';
                if (el.kpiTotalUsers) el.kpiTotalUsers.textContent = formatNumber(analytics.totalUsers);
            }

            // Sync timing inputs with server defaults
            if (game.durations) {
                if (el.inputBettingTime) el.inputBettingTime.value = game.durations.bettingTime || 15;
                if (el.inputSpinTime) el.inputSpinTime.value = game.durations.spinTime || 8;
                if (el.inputResultTime) el.inputResultTime.value = game.durations.resultTime || 5;
            }

            // Initial tick render
            renderEngineTick(game);
        } catch (err) {
            console.error('[Admin] Fetch overview error:', err);
        }
    }

    // ==================== USER MANAGEMENT ====================

    async function fetchUsers(search = '') {
        try {
            if (el.usersTableBody) {
                el.usersTableBody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; padding: 20px; color: #9E9E9E;">
                            Fetching users...
                        </td>
                    </tr>
                `;
            }

            const url = `/api/admin/users?limit=50&search=${encodeURIComponent(search.trim())}`;
            const res = await fetch(url);
            const data = await res.json();

            if (!data.success || !Array.isArray(data.users)) {
                if (el.usersTableBody) {
                    el.usersTableBody.innerHTML = `
                        <tr>
                            <td colspan="8" style="text-align: center; padding: 20px; color: #FF3D71;">
                                Failed to load users
                            </td>
                        </tr>
                    `;
                }
                return;
            }

            if (data.users.length === 0) {
                if (el.usersTableBody) {
                    el.usersTableBody.innerHTML = `
                        <tr>
                            <td colspan="8" style="text-align: center; padding: 24px; color: #9E9E9E;">
                                No users found matching "${search}"
                            </td>
                        </tr>
                    `;
                }
                return;
            }

            el.usersTableBody.innerHTML = data.users.map(u => {
                const avatarUrl = u.avatar || '../assets/icons/hotdog.svg';
                const todayProfit = u.today_profit || 0;
                const totalProfit = u.total_profit || 0;

                return `
                    <tr>
                        <td style="font-family: var(--font-mono); color: var(--text-muted); font-size: 11.5px;">#${u.id}</td>
                        <td>
                            <div class="user-td-wrap">
                                <img src="${avatarUrl}" class="user-td-avatar" alt="${u.username}" onerror="this.src='../assets/icons/hotdog.svg'">
                                <div>
                                    <div class="user-td-name">${escapeHtml(u.username)}</div>
                                    <small style="color: var(--text-muted); font-size: 10.5px;">ID: ${escapeHtml(u.app_user_id || '--')}</small>
                                </div>
                            </div>
                        </td>
                        <td style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-gold);">🪙 ${formatNumber(u.coins)}</td>
                        <td style="font-family: var(--font-mono); font-weight: 700; color: #00D2FF;">💎 ${formatNumber(u.diamonds)}</td>
                        <td style="font-family: var(--font-mono);" class="${todayProfit >= 0 ? 'text-green' : 'text-red'}">
                            ${todayProfit >= 0 ? '+' : ''}${formatNumber(todayProfit)}
                        </td>
                        <td style="font-family: var(--font-mono);" class="${totalProfit >= 0 ? 'text-green' : 'text-red'}">
                            ${totalProfit >= 0 ? '+' : ''}${formatNumber(totalProfit)}
                        </td>
                        <td style="font-size: 11px; color: var(--text-muted);">${formatDate(u.created_at)}</td>
                        <td style="text-align: right;">
                            <button class="btn-wallet-action" data-user='${JSON.stringify({ id: u.id, username: u.username, coins: u.coins, diamonds: u.diamonds })}'>
                                ⚙️ Adjust Wallet
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

            // Attach adjust wallet modal triggers
            el.usersTableBody.querySelectorAll('.btn-wallet-action').forEach(btn => {
                btn.addEventListener('click', () => {
                    const userData = JSON.parse(btn.dataset.user);
                    openWalletModal(userData);
                });
            });

        } catch (err) {
            console.error('[Admin] Fetch users error:', err);
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // ==================== WALLET ADJUSTMENT MODAL ====================

    function openWalletModal(user) {
        selectedUserForAdjust = user;
        if (el.modalTargetUser) el.modalTargetUser.textContent = `${user.username} (#${user.id})`;
        if (el.modalUserCoins) el.modalUserCoins.textContent = `🪙 ${formatNumber(user.coins)}`;
        if (el.modalUserDiamonds) el.modalUserDiamonds.textContent = `💎 ${formatNumber(user.diamonds)}`;
        if (el.adjustAmountInput) el.adjustAmountInput.value = '';

        // Reset toggles to defaults
        setModalCurrency('coins');
        setModalAction('credit');

        if (el.walletAdjustModal) {
            el.walletAdjustModal.classList.add('open');
        }
    }

    function closeWalletModal() {
        if (el.walletAdjustModal) {
            el.walletAdjustModal.classList.remove('open');
        }
        selectedUserForAdjust = null;
    }

    function setModalCurrency(curr) {
        activeModalCurrency = curr;
        el.currencyToggleBtns.forEach(btn => {
            if (btn.dataset.currency === curr) btn.classList.add('active');
            else btn.classList.remove('active');
        });
    }

    function setModalAction(action) {
        activeModalAction = action;
        el.actionToggleBtns.forEach(btn => {
            if (btn.dataset.action === action) btn.classList.add('active');
            else btn.classList.remove('active');
        });
    }

    async function submitWalletAdjustment() {
        if (!selectedUserForAdjust) return;

        const rawAmount = el.adjustAmountInput ? el.adjustAmountInput.value.trim() : '';
        const amount = parseInt(rawAmount, 10);

        if (isNaN(amount) || amount < 0) {
            showToast('Please enter a valid amount', 'warning');
            return;
        }

        const endpoint = `/api/admin/user/${selectedUserForAdjust.id}/${activeModalCurrency}`;

        try {
            if (el.btnSubmitAdjustment) {
                el.btnSubmitAdjustment.disabled = true;
                el.btnSubmitAdjustment.textContent = 'Updating...';
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: activeModalAction,
                    amount: amount
                })
            });

            const data = await res.json();

            if (data.success) {
                showToast(data.message || 'Balance updated successfully', 'success');
                closeWalletModal();
                // Refresh users and analytics
                fetchUsers(el.userSearchInput ? el.userSearchInput.value : '');
                fetchOverview();
            } else {
                showToast(data.message || 'Failed to update balance', 'error');
            }
        } catch (err) {
            console.error('[Admin] Wallet adjustment error:', err);
            showToast('Network error while updating balance', 'error');
        } finally {
            if (el.btnSubmitAdjustment) {
                el.btnSubmitAdjustment.disabled = false;
                el.btnSubmitAdjustment.textContent = 'Confirm Balance Update';
            }
        }
    }

    // ==================== RECENT ROUNDS AUDIT LOG ====================

    async function fetchRecentRounds() {
        try {
            const res = await fetch('/api/admin/rounds?limit=15');
            const data = await res.json();

            if (!data.success || !Array.isArray(data.rounds)) return;

            if (!el.recentRoundsBody) return;

            if (data.rounds.length === 0) {
                el.recentRoundsBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 18px; color: #9E9E9E;">
                            No rounds recorded yet
                        </td>
                    </tr>
                `;
                return;
            }

            el.recentRoundsBody.innerHTML = data.rounds.map(r => {
                const profit = Number(r.house_profit) || 0;
                const profitClass = profit >= 0 ? 'text-green' : 'text-red';
                const profitPrefix = profit >= 0 ? '+' : '';
                const itemIcon = `../assets/icons/${r.winning_item}.svg`;

                return `
                    <tr>
                        <td style="font-family: var(--font-mono); font-weight: 700;">#${r.round_number}</td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <img src="${itemIcon}" style="width: 20px; height: 20px; object-fit: contain;" onerror="this.src='../assets/icons/hotdog.svg'">
                                <strong style="text-transform: capitalize;">${escapeHtml(r.winning_item)}</strong>
                                <span style="font-size: 10.5px; color: var(--accent-gold); font-weight: 800;">${r.multiplier}x</span>
                            </div>
                        </td>
                        <td style="font-family: var(--font-mono); color: var(--accent-gold);">🪙 ${formatNumber(r.total_bets_amount)}</td>
                        <td style="font-family: var(--font-mono);">🪙 ${formatNumber(r.total_payout_amount)}</td>
                        <td style="font-family: var(--font-mono); font-weight: 700;" class="${profitClass}">
                            ${profitPrefix}🪙 ${formatNumber(profit)}
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (err) {
            console.error('[Admin] Fetch rounds error:', err);
        }
    }

    // ==================== EVENT LISTENERS SETUP ====================

    function setupEventListeners() {
        // Sidebar Toggle & Close (Mobile Drawer)
        if (el.btnSidebarToggle) {
            el.btnSidebarToggle.addEventListener('click', () => {
                if (el.adminSidebar && el.adminSidebar.classList.contains('open')) {
                    closeSidebar();
                } else {
                    openSidebar();
                }
            });
        }
        if (el.btnCloseSidebar) {
            el.btnCloseSidebar.addEventListener('click', closeSidebar);
        }
        if (el.sidebarBackdrop) {
            el.sidebarBackdrop.addEventListener('click', closeSidebar);
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeSidebar();
        });

        // Sidebar Navigation Links
        if (el.sidebarNavLinks) {
            el.sidebarNavLinks.forEach(link => {
                link.addEventListener('click', () => {
                    const view = link.dataset.view;
                    if (view) switchAdminView(view);
                });
            });
        }

        // Sidebar Quick Actions
        if (el.sidebarBtnTogglePause) {
            el.sidebarBtnTogglePause.addEventListener('click', () => {
                const isCurrentlyPaused = currentEngineState && currentEngineState.isPaused;
                executeGameControl(isCurrentlyPaused ? 'resume' : 'pause');
            });
        }
        if (el.sidebarBtnForceSpin) {
            el.sidebarBtnForceSpin.addEventListener('click', () => {
                executeGameControl('force_spin');
            });
        }

        // Quick Action: Pause / Resume
        if (el.btnTogglePause) {
            el.btnTogglePause.addEventListener('click', () => {
                const isCurrentlyPaused = currentEngineState && currentEngineState.isPaused;
                executeGameControl(isCurrentlyPaused ? 'resume' : 'pause');
            });
        }

        // Quick Action: Spin Wheel Now
        if (el.btnForceSpin) {
            el.btnForceSpin.addEventListener('click', () => {
                executeGameControl('force_spin');
            });
        }

        // Quick Action: Reset Round
        if (el.btnResetRound) {
            el.btnResetRound.addEventListener('click', () => {
                if (confirm('Are you sure you want to reset the current round to BETTING phase?')) {
                    executeGameControl('reset_round');
                }
            });
        }

        // Strategy Tabs
        el.strategyTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const mode = tab.dataset.mode;
                if (mode === 'manual') {
                    showToast('Click "LOCK POT" on any of the 8 dishes below to force next outcome', 'warning');
                } else {
                    saveMarginSettings({ outcomeMode: mode });
                }
            });
        });

        // Target Margin Range Slider
        if (el.marginRangeSlider) {
            el.marginRangeSlider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10);
                currentTargetMargin = val;
                if (el.marginSliderVal) el.marginSliderVal.textContent = `${val}%`;
                if (el.displayCurrentMarginVal) el.displayCurrentMarginVal.textContent = `${val}%`;

                // Update active preset button highlight
                el.marginPresetBtns.forEach(btn => {
                    const m = parseInt(btn.dataset.margin, 10);
                    if (m === val) btn.classList.add('active');
                    else btn.classList.remove('active');
                });
            });
        }

        // Margin Preset Buttons
        el.marginPresetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const val = parseInt(btn.dataset.margin, 10);
                currentTargetMargin = val;
                if (el.marginRangeSlider) el.marginRangeSlider.value = val;
                if (el.marginSliderVal) el.marginSliderVal.textContent = `${val}%`;
                if (el.displayCurrentMarginVal) el.displayCurrentMarginVal.textContent = `${val}%`;

                el.marginPresetBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Commission Cut Preset Buttons
        el.commPresetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const cut = parseInt(btn.dataset.comm, 10);
                currentHouseCommission = cut;
                el.commPresetBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (el.commStatusBadge) el.commStatusBadge.textContent = `🪙 Cut: ${cut}%`;
            });
        });

        // House Shield Checkbox Toggle
        if (el.toggleHouseShield) {
            el.toggleHouseShield.addEventListener('change', (e) => {
                currentHouseShield = e.target.checked;
            });
        }

        // Apply Margin Settings Button
        if (el.btnApplyMarginSettings) {
            el.btnApplyMarginSettings.addEventListener('click', () => {
                saveMarginSettings({
                    targetMarginPct: currentTargetMargin,
                    houseCommissionPct: currentHouseCommission,
                    houseShieldEnabled: currentHouseShield
                });
            });
        }

        // Multipliers Presets
        el.btnMultiPresets.forEach(btn => {
            btn.addEventListener('click', () => {
                const presetName = btn.dataset.preset;
                applyMultiplierPreset(presetName);
            });
        });

        // Wheel Pots Live Multiplier Input Listeners for Auto-Calculating Combos
        const potInputIds = ['tomato', 'corn', 'cabbage', 'carrot', 'hotdog', 'kebab', 'chicken', 'steak'];
        potInputIds.forEach(id => {
            const input = document.getElementById(`multi_${id}`);
            if (input) {
                input.addEventListener('input', () => {
                    autoRecalculateCombosFromPots();
                });
                input.addEventListener('change', () => {
                    autoRecalculateCombosFromPots();
                });
            }
        });

        // Toggle Auto-Calc Combos Checkbox
        if (el.toggleAutoCalcCombos) {
            el.toggleAutoCalcCombos.addEventListener('change', (e) => {
                const isAuto = e.target.checked;
                if (el.autoCalcStatusBadge) {
                    if (isAuto) {
                        el.autoCalcStatusBadge.textContent = '⚡ AUTO-CALCULATED FROM WHEEL POTS';
                        el.autoCalcStatusBadge.className = 'badge-auto-calc badge-active';
                        autoRecalculateCombosFromPots();
                    } else {
                        el.autoCalcStatusBadge.textContent = '✏️ MANUAL OVERRIDES ACTIVE';
                        el.autoCalcStatusBadge.className = 'badge-auto-calc badge-disabled';
                    }
                }
            });
        }

        // Detect manual edits on combo inputs
        const comboInputIds = ['veg_combo', 'salad', 'pizza', 'meat_combo'];
        comboInputIds.forEach(id => {
            const input = document.getElementById(`multi_${id}`);
            if (input) {
                input.addEventListener('input', () => {
                    if (el.toggleAutoCalcCombos && el.toggleAutoCalcCombos.checked) {
                        el.toggleAutoCalcCombos.checked = false;
                        if (el.autoCalcStatusBadge) {
                            el.autoCalcStatusBadge.textContent = '✏️ MANUAL OVERRIDES ACTIVE';
                            el.autoCalcStatusBadge.className = 'badge-auto-calc badge-disabled';
                        }
                    }
                });
            }
        });

        // Multipliers Form Submission
        if (el.multipliersForm) {
            el.multipliersForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const multipliers = {};
                const dishIds = [
                    'hotdog', 'kebab', 'chicken', 'steak',
                    'tomato', 'corn', 'cabbage', 'carrot',
                    'veg_combo', 'salad', 'pizza', 'meat_combo'
                ];

                dishIds.forEach(id => {
                    const input = document.getElementById(`multi_${id}`);
                    if (input) {
                        const val = parseFloat(input.value);
                        if (!isNaN(val) && val > 0) {
                            multipliers[id] = val;
                        }
                    }
                });

                saveMultipliersSettings(multipliers);
            });
        }

        // Search Users
        if (el.btnUserSearch && el.userSearchInput) {
            el.btnUserSearch.addEventListener('click', () => {
                fetchUsers(el.userSearchInput.value);
            });
            el.userSearchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    fetchUsers(el.userSearchInput.value);
                }
            });
        }

        // Timing Configuration Form
        if (el.timingConfigForm) {
            el.timingConfigForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const bettingTime = parseInt(el.inputBettingTime.value, 10);
                const spinTime = parseInt(el.inputSpinTime.value, 10);
                const resultTime = parseInt(el.inputResultTime.value, 10);

                if (isNaN(bettingTime) || bettingTime < 5) {
                    showToast('Betting time must be at least 5 seconds', 'warning');
                    return;
                }
                if (isNaN(spinTime) || spinTime < 4) {
                    showToast('Spin time must be at least 4 seconds', 'warning');
                    return;
                }
                if (isNaN(resultTime) || resultTime < 3) {
                    showToast('Result time must be at least 3 seconds', 'warning');
                    return;
                }

                try {
                    const res = await fetch('/api/admin/config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            durations: { bettingTime, spinTime, resultTime }
                        })
                    });
                    const data = await res.json();
                    if (data.success) {
                        showToast(data.message || 'Timings saved successfully', 'success');
                    } else {
                        showToast(data.message || 'Failed to save timings', 'error');
                    }
                } catch (err) {
                    console.error('[Admin] Config save error:', err);
                    showToast('Network error while saving timings', 'error');
                }
            });
        }

        // Refresh Button
        if (el.manualRefreshBtn) {
            el.manualRefreshBtn.addEventListener('click', () => {
                showToast('Refreshing dashboard data...', 'success');
                fetchOverview();
                fetchUsers(el.userSearchInput ? el.userSearchInput.value : '');
                fetchRecentRounds();
            });
        }

        // Modal Close Button & Backdrop
        if (el.closeAdjustModalBtn) {
            el.closeAdjustModalBtn.addEventListener('click', closeWalletModal);
        }
        if (el.walletAdjustModal) {
            const backdrop = el.walletAdjustModal.querySelector('.modal-backdrop');
            if (backdrop) backdrop.addEventListener('click', closeWalletModal);
        }

        // Modal Currency Toggles
        el.currencyToggleBtns.forEach(btn => {
            btn.addEventListener('click', () => setModalCurrency(btn.dataset.currency));
        });

        // Modal Action Toggles
        el.actionToggleBtns.forEach(btn => {
            btn.addEventListener('click', () => setModalAction(btn.dataset.action));
        });

        // Quick Chip Buttons
        el.quickChipBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const addVal = parseInt(btn.dataset.val, 10) || 0;
                if (!el.adjustAmountInput) return;
                const currentVal = parseInt(el.adjustAmountInput.value, 10) || 0;
                el.adjustAmountInput.value = currentVal + addVal;
            });
        });

        // Modal Confirm Button
        if (el.btnSubmitAdjustment) {
            el.btnSubmitAdjustment.addEventListener('click', submitWalletAdjustment);
        }
    }

    // ==================== APP BOOTSTRAP ====================

    function init() {
        console.log('[AdminPanel] Initializing Game Command Center with Side Nav & Informatic Views...');
        initSocket();
        setupEventListeners();
        switchAdminView('dashboard');
        fetchOverview();
        fetchUsers();
        fetchRecentRounds();

        // Background interval to refresh table logs periodically (every 10s)
        setInterval(() => {
            fetchRecentRounds();
        }, 10000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
