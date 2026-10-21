// Main Application Controller for Greedy Game
class GreedyApp {
    constructor() {
        this.userData = {
            id: null,
            username: 'Player',
            avatar: 'avatar1',
            coins: 25000000,
            diamonds: 0,
            todayProfit: 0
        };

        this.gameState = 'BETTING';
        this.timeLeft = 15;
        this.roundNumber = 730;
        this.selectedChip = 500;
        this.userBets = {}; // itemId -> amount
        this.podTotals = {};
        this.items = [];
        this.recentResults = [];
        this.hotItem = 'hotdog';

        // Spin animation variables
        this.isSpinning = false;
        this.currentSpinIndex = 0;
        this.spinTimeout = null;
        this.targetIndex = 0;

        // Podium countdown
        this.podiumTimer = null;
        this.podiumSecondsLeft = 4;

        // Sound state
        this.soundEnabled = true;
    }

    init() {
        this.initBottomSheetHeightMode();
        this.initSplashScreen();
        this.bindEvents();
        this.initPods();
        window.gameSocket.connect();
    }

    updateResponsiveScale() {
        const wrapper = document.getElementById('wheelStageWrapper');
        const wheel = document.querySelector('.wheel-stage');
        if (!wrapper || !wheel) return;

        const availW = wrapper.clientWidth;
        const availH = wrapper.clientHeight;

        if (availW <= 0 || availH <= 0) return;

        // Base unscaled dimensions of wheel-stage: 360px wide x 376px high
        const scaleH = (availH - 4) / 376;
        const scaleW = (availW - 4) / 360;

        // Take tighter constraint so wheel is never clipped
        let scale = Math.min(scaleH, scaleW);

        // Clamp between 0.50 (for extreme small sheets) and 1.05 (for tall screens)
        scale = Math.max(0.50, Math.min(1.05, scale));

        wheel.style.transform = `scale(${scale.toFixed(3)})`;
        wheel.style.transformOrigin = 'center center';
        document.documentElement.style.setProperty('--current-wheel-scale', scale);
    }

    initBottomSheetHeightMode() {
        const applyMode = () => {
            const urlParams = new URLSearchParams(window.location.search);
            const rawParam = urlParams.get('percentage') || 
                             urlParams.get('percent') || 
                             urlParams.get('height') || 
                             urlParams.get('h') || 
                             urlParams.get('sheetHeight') || 
                             urlParams.get('bottomSheet') ||
                             urlParams.get('sheet') ||
                             localStorage.getItem('greedy_sheet_pct');

            let pct = 100;
            let isParamExplicit = false;

            if (rawParam) {
                isParamExplicit = true;
                const clean = String(rawParam).trim().toLowerCase().replace('%', '');
                if (clean === 'full') {
                    pct = 100;
                } else {
                    const parsed = parseFloat(clean);
                    if (!isNaN(parsed)) {
                        pct = (parsed <= 1 && parsed > 0) ? Math.round(parsed * 100) : Math.round(parsed);
                    }
                }
                localStorage.setItem('greedy_sheet_pct', pct);
            }

            const frame = document.querySelector('.mobile-frame');
            const body = document.body;
            const handle = document.getElementById('sheetDragHandle');

            if (frame) {
                frame.setAttribute('data-sheet-pct', pct);

                if (pct < 100) {
                    if (window.innerHeight > 700) {
                        frame.style.setProperty('--sheet-height', `${pct}dvh`);
                        if (body) body.classList.add('in-bottomsheet');
                    } else {
                        frame.style.setProperty('--sheet-height', '100%');
                        if (body) body.classList.remove('in-bottomsheet');
                    }
                    if (handle) handle.style.display = 'flex';
                } else {
                    frame.style.removeProperty('--sheet-height');
                    if (body) body.classList.remove('in-bottomsheet');
                    if (handle) handle.style.display = 'none';
                }

                // Apply compact console classes based on actual frame clientHeight
                const frameH = frame.clientHeight || window.innerHeight;
                if (frameH <= 540) {
                    frame.classList.add('compact-console-ultra');
                    frame.classList.remove('compact-console');
                } else if (frameH <= 640) {
                    frame.classList.add('compact-console');
                    frame.classList.remove('compact-console-ultra');
                } else {
                    frame.classList.remove('compact-console', 'compact-console-ultra');
                }
            }

            this.updateResponsiveScale();
            console.log(`[BottomSheet] Applied height=${pct}%, explicit=${isParamExplicit}`);
        };

        applyMode();
        window.addEventListener('resize', applyMode);

        setTimeout(() => {
            applyMode();
            const wrapper = document.getElementById('wheelStageWrapper');
            if (wrapper && window.ResizeObserver) {
                const ro = new ResizeObserver(() => {
                    this.updateResponsiveScale();
                });
                ro.observe(wrapper);
            }
        }, 50);
    }

    initSplashScreen() {
        const splash = document.getElementById('gameSplashScreen');
        if (!splash) return;

        const statusText = document.getElementById('splashStatusText');
        const percentText = document.getElementById('splashPercentText');
        const progressBarFill = document.getElementById('splashProgressBarFill');

        const SPLASH_DURATION_MS = 5000; // Exactly 5 seconds
        const startTime = performance.now();
        let isDone = false;
        let animFrameId = null;

        const updateUI = (val) => {
            const clamped = Math.max(0, Math.min(100, Math.round(val)));
            if (percentText) percentText.textContent = `${clamped}%`;
            if (progressBarFill) progressBarFill.style.width = `${clamped}%`;

            if (statusText) {
                if (clamped < 25) {
                    statusText.textContent = 'Entering Carnival Arena...';
                } else if (clamped < 55) {
                    statusText.textContent = 'Loading 3D Feast & Sound FX...';
                } else if (clamped < 80) {
                    statusText.textContent = 'Connecting Live Feast Standings...';
                } else if (clamped < 99) {
                    statusText.textContent = 'Synchronizing Wallet & Table...';
                } else {
                    statusText.textContent = 'Ready to Feast! Good Luck! 🎡';
                }
            }
        };

        const finishSplash = () => {
            if (isDone) return;
            isDone = true;
            if (animFrameId) cancelAnimationFrame(animFrameId);

            updateUI(100);

            // Brief pause at 100% so user sees full bar with coin head pin
            setTimeout(() => {
                splash.classList.add('splash-exit');
                setTimeout(() => {
                    splash.style.display = 'none';
                    this.updateResponsiveScale();
                }, 520);
            }, 300);
        };

        // When backend game state arrives, mark ready
        this.onGameStateReady = () => {
            // Handled as part of the 5-second display sequence
        };

        const step = (now) => {
            if (isDone) return;

            const elapsed = now - startTime;
            const progressRatio = Math.min(1, elapsed / SPLASH_DURATION_MS);
            const percentVal = progressRatio * 100;

            if (progressRatio < 1) {
                updateUI(percentVal);
                animFrameId = requestAnimationFrame(step);
            } else {
                updateUI(100);
                finishSplash();
            }
        };

        animFrameId = requestAnimationFrame(step);
    }

    bindEvents() {
        // 0. Close Game / Exit Button (Mobile App BottomSheet Bridge)
        const homeBtn = document.getElementById('homeBtn');
        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                this.closeGameBottomSheet();
            });
        }

        // BottomSheet Drag Handle click to close
        const sheetHandle = document.getElementById('sheetDragHandle');
        if (sheetHandle) {
            sheetHandle.addEventListener('click', () => {
                this.closeGameBottomSheet();
            });
        }

        // 1. Chip Selection (500, 1K, 5K, 10K, 50K)
        document.querySelectorAll('.chip-card-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const val = parseInt(btn.dataset.val);
                this.selectChip(val, btn);
            });
        });

        // 2. Repeat Bet Button
        const repeatBtn = document.getElementById('repeatBetBtn');
        if (repeatBtn) {
            repeatBtn.addEventListener('click', () => {
                if (this.gameState !== 'BETTING') {
                    this.showToast('Betting is closed for this round!', 'warning');
                    return;
                }
                window.gameSocket.repeatBet();
            });
        }

        // 3. Popular Recommendation Button
        const popularRecomBtn = document.getElementById('popularRecomBtn');
        if (popularRecomBtn) {
            popularRecomBtn.addEventListener('click', () => {
                this.handlePopularRecommendation();
            });
        }

        // 4. Trophy Button (Opens Today's Revenue Rank)
        const trophyBtn = document.getElementById('trophyBtn');
        if (trophyBtn) {
            trophyBtn.addEventListener('click', () => {
                window.gameSocket.getRevenueRanks();
                this.openModal('revenueRankModal');
            });
        }

        // 5. Big Winner Footer Bar (Opens Today's Revenue Rank)
        const bigWinnerBar = document.getElementById('bigWinnerBar');
        if (bigWinnerBar) {
            bigWinnerBar.addEventListener('click', () => {
                window.gameSocket.getRevenueRanks();
                this.openModal('revenueRankModal');
            });
        }

        // 6. Rules Modal Button
        const rulesBtn = document.getElementById('rulesBtn');
        if (rulesBtn) {
            rulesBtn.addEventListener('click', () => this.openModal('rulesModal'));
        }

        // 7. Recharge / Free Coins Button
        const rechargeBtn = document.getElementById('rechargeModalBtn');
        if (rechargeBtn) {
            rechargeBtn.addEventListener('click', () => this.openModal('rechargeModal'));
        }

        const balancePill = document.getElementById('balancePill');
        if (balancePill) {
            balancePill.addEventListener('click', () => this.openModal('rechargeModal'));
        }

        const profitPill = document.getElementById('profitPill');
        if (profitPill) {
            profitPill.addEventListener('click', () => {
                window.gameSocket.getRevenueRanks();
                this.openModal('revenueRankModal');
            });
        }

        // 8. Claim Free Bonus Coins
        const claimFreeBtn = document.getElementById('claimFreeBtn');
        if (claimFreeBtn) {
            claimFreeBtn.addEventListener('click', () => {
                window.gameSocket.claimFreeCoins();
            });
        }

        // 9. Sound Controls & Volume Seekbar Dropdown
        this.initSoundControls();

        // 10. Close Modals
        document.querySelectorAll('.modal-close, .revenue-close-btn, .modal-backdrop').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.classList.contains('modal-backdrop') || 
                    e.target.classList.contains('modal-close') || 
                    e.target.classList.contains('revenue-close-btn')) {
                    this.closeAllModals();
                }
            });
        });
    }

    initPods() {
        // 8 Food Wheel Pods
        document.querySelectorAll('.wheel-pod').forEach(pod => {
            pod.addEventListener('click', () => {
                const itemId = pod.dataset.id;
                this.onPodClick(itemId, pod);
            });
        });

        // 4 Lower Base Combo Dishes - Auto distribute coins to related wheel pots
        document.querySelectorAll('.combo-dish-btn').forEach(combo => {
            combo.addEventListener('click', () => {
                const itemId = combo.dataset.id;
                this.onComboClick(itemId, combo);
            });
        });
    }

    initSoundControls() {
        const soundBtn = document.getElementById('soundBtn');
        const dropdown = document.getElementById('soundSettingsDropdown');
        const closeBtn = document.getElementById('closeSettingsDropdownBtn');
        const seekbar = document.getElementById('volumeSeekbar');
        const percentText = document.getElementById('volumePercentText');
        const muteToggleBtn = document.getElementById('muteToggleBtn');
        const muteIcon = document.getElementById('soundMuteIcon');
        const muteBtnIcon = document.getElementById('muteBtnIcon');
        const muteBtnLabel = document.getElementById('muteBtnLabel');

        const updateSoundUI = () => {
            if (!window.soundFx) return;
            const vol = window.soundFx.getVolume();
            const isMuted = window.soundFx.isMuted;

            if (seekbar) seekbar.value = isMuted ? 0 : vol;
            if (percentText) percentText.textContent = isMuted ? 'Muted' : `${vol}%`;

            if (isMuted || vol === 0) {
                if (soundBtn) soundBtn.style.opacity = '0.5';
                if (muteIcon) muteIcon.textContent = '🔇';
                if (muteBtnIcon) muteBtnIcon.textContent = '🔊';
                if (muteBtnLabel) muteBtnLabel.textContent = 'Unmute';
                if (muteToggleBtn) muteToggleBtn.classList.add('muted');
            } else {
                if (soundBtn) soundBtn.style.opacity = '1';
                if (muteIcon) muteIcon.textContent = vol > 50 ? '🔊' : (vol > 0 ? '🔉' : '🔈');
                if (muteBtnIcon) muteBtnIcon.textContent = '🔇';
                if (muteBtnLabel) muteBtnLabel.textContent = 'Mute';
                if (muteToggleBtn) muteToggleBtn.classList.remove('muted');
            }
        };

        // Sync initial sound state
        updateSoundUI();

        if (soundBtn && dropdown) {
            soundBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('show');
                updateSoundUI();
                if (window.soundFx) window.soundFx.ensureContext();
            });
        }

        if (closeBtn && dropdown) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.remove('show');
            });
        }

        // Close on clicking outside dropdown
        document.addEventListener('click', (e) => {
            if (dropdown && dropdown.classList.contains('show')) {
                const wrapper = document.querySelector('.settings-dropdown-wrapper');
                if (wrapper && !wrapper.contains(e.target)) {
                    dropdown.classList.remove('show');
                }
            }
        });

        // Volume Seekbar Drag / Input
        if (seekbar) {
            seekbar.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10);
                if (window.soundFx) {
                    window.soundFx.setVolume(val);
                }
                updateSoundUI();
            });
            seekbar.addEventListener('change', () => {
                if (window.soundFx) window.soundFx.playChipSelect();
            });
        }

        // Mute button toggle
        if (muteToggleBtn) {
            muteToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!window.soundFx) return;
                const isMuted = window.soundFx.toggleMute();
                updateSoundUI();
                this.showToast(isMuted ? 'Sound Muted' : 'Sound Restored', 'info');
                if (!isMuted) window.soundFx.playChipSelect();
            });
        }

        // Preset buttons (Max, 50%)
        document.querySelectorAll('.preset-pill').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!window.soundFx) return;
                const vol = parseInt(btn.dataset.vol, 10);
                window.soundFx.setVolume(vol);
                updateSoundUI();
                this.showToast(`Volume: ${vol}%`, 'info');
                window.soundFx.playChipSelect();
            });
        });
    }

    selectChip(value, btnElement) {
        this.selectedChip = value;
        document.querySelectorAll('.chip-card-btn').forEach(b => b.classList.remove('active'));
        if (btnElement) btnElement.classList.add('active');
        window.soundFx.playChipSelect();
    }

    onPodClick(itemId, element) {
        if (this.gameState !== 'BETTING') {
            this.showToast('Betting is closed for this round!', 'warning');
            return;
        }

        if (this.userData.coins < this.selectedChip) {
            this.showToast('Not enough coins! Recharge to continue.', 'warning');
            this.openModal('rechargeModal');
            return;
        }

        // Spawn flying chip animation from active chip to pod
        this.spawnFlyingChip(this.selectedChip, element);

        // Play coin sound
        window.soundFx.playCoinDrop();

        // Emit bet to backend
        window.gameSocket.placeBet(itemId, this.selectedChip);
    }

    // Auto distribute coins to related wheel pots only when a combo dish is clicked
    onComboClick(comboId, comboElement) {
        if (this.gameState !== 'BETTING') {
            this.showToast('Betting is closed for this round!', 'warning');
            return;
        }

        // Exact mapping of combo dishes to their related wheel pots ONLY
        const COMBO_MAP = {
            'veg_combo': ['tomato', 'corn', 'cabbage', 'carrot'],
            'salad': ['tomato', 'corn', 'cabbage', 'carrot'],
            'pizza': ['hotdog', 'kebab', 'chicken', 'steak'],
            'meat_combo': ['hotdog', 'kebab', 'chicken', 'steak']
        };

        const relatedPots = COMBO_MAP[comboId];
        if (!relatedPots || relatedPots.length === 0) {
            this.onPodClick(comboId, comboElement);
            return;
        }

        const chipVal = this.selectedChip;
        const totalNeeded = chipVal * relatedPots.length;

        if (this.userData.coins < totalNeeded) {
            this.showToast(`Not enough coins! Need ${this.formatCompact(totalNeeded)} coins for combo bet.`, 'warning');
            this.openModal('rechargeModal');
            return;
        }

        // Visual ripple feedback on the clicked combo button
        if (comboElement) {
            comboElement.classList.add('coin-impact-ripple');
            setTimeout(() => comboElement.classList.remove('coin-impact-ripple'), 300);
        }

        // Track and display combo dish total & badge on the combo dish itself
        this.comboBets = this.comboBets || {};
        this.comboBets[comboId] = (this.comboBets[comboId] || 0) + totalNeeded;
        this.renderUserBetBadge(comboId, this.comboBets[comboId]);

        const comboTotalEl = document.getElementById(`podTotal_${comboId}`);
        if (comboTotalEl) {
            this.comboTotals = this.comboTotals || {};
            this.comboTotals[comboId] = (this.comboTotals[comboId] || 0) + totalNeeded;
            comboTotalEl.textContent = `Total:${this.formatCompact(this.comboTotals[comboId])}`;
        }

        // Automatically distribute coins to each related wheel pot ONLY (not for all!)
        relatedPots.forEach((potId, index) => {
            const podElement = document.querySelector(`.wheel-pod[data-id="${potId}"]`);

            setTimeout(() => {
                if (podElement) {
                    this.spawnFlyingChip(chipVal, podElement, comboElement);
                }
                if (window.soundFx) {
                    window.soundFx.playCoinDrop();
                }
                window.gameSocket.placeBet(potId, chipVal);
            }, index * 70);
        });

        const isVegCombo = comboId.includes('veg') || comboId === 'salad';
        const label = isVegCombo ? 'Veg Combo' : 'Meat Combo';
        this.showToast(`${label}: ${this.formatCompact(chipVal)} distributed to 4 pots!`, 'info');
    }

    handlePopularRecommendation() {
        if (this.gameState !== 'BETTING') {
            this.showToast('Betting is closed for this round!', 'warning');
            return;
        }
        // Recommended bet: 500 on Hotdog + Veggies combo package
        const amount = 500;
        const totalNeeded = amount + amount * 4; // 1 hotdog (500) + 4 veggies (2000) = 2500
        if (this.userData.coins < totalNeeded) {
            this.showToast('Not enough coins for recommendation package!', 'warning');
            this.openModal('rechargeModal');
            return;
        }

        const hotdogPod = document.querySelector('.wheel-pod[data-id="hotdog"]');
        const vegBtn = document.getElementById('vegComboBtn');

        if (hotdogPod) this.spawnFlyingChip(amount, hotdogPod);
        window.gameSocket.placeBet('hotdog', amount);

        setTimeout(() => {
            if (vegBtn) {
                this.onComboClick('veg_combo', vegBtn);
            }
        }, 150);

        this.showToast('Popular recommendation package placed!', 'success');
    }

    // Flying chip for real user bet (supports flying from active chip or from combo dish)
    spawnFlyingChip(value, targetElement, fromElement = null) {
        const sourceElement = fromElement || document.querySelector(`.chip-card-btn[data-val="${value}"]`) || document.querySelector('.chip-card-btn.active');
        if (!sourceElement || !targetElement) return;

        const startRect = sourceElement.getBoundingClientRect();
        const endRect = targetElement.getBoundingClientRect();

        const startX = startRect.left + startRect.width / 2 - 14;
        const startY = startRect.top + startRect.height / 2 - 14;
        const endX = endRect.left + endRect.width / 2 - 14;
        const endY = endRect.top + endRect.height / 2 - 14;

        const flyer = document.createElement('div');
        flyer.className = 'flying-chip';
        flyer.textContent = this.formatCompact(value);
        flyer.style.left = `${startX}px`;
        flyer.style.top = `${startY}px`;

        document.body.appendChild(flyer);

        const deltaX = endX - startX;
        const deltaY = endY - startY;

        const anim = flyer.animate([
            { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
            { transform: `translate(${deltaX}px, ${deltaY}px) scale(0.65)`, opacity: 0.85 }
        ], {
            duration: 440,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            fill: 'forwards'
        });

        anim.onfinish = () => {
            flyer.remove();
            targetElement.classList.add('coin-impact-ripple');
            setTimeout(() => targetElement.classList.remove('coin-impact-ripple'), 300);
        };
    }

    // Guest / System Bet Coin flying from TOP-RIGHT side into pots
    spawnFlyingCoinFromTopRight(itemId, amount) {
        const targetElement = document.querySelector(`.wheel-pod[data-id="${itemId}"]`) || 
                              document.querySelector(`.combo-dish-btn[data-id="${itemId}"]`);
        if (!targetElement) return;

        const frame = document.querySelector('.mobile-frame');
        const frameRect = frame ? frame.getBoundingClientRect() : { right: window.innerWidth, top: 0 };
        
        // Origin: Near top right of the screen (under header)
        const startX = frameRect.right - 44;
        const startY = frameRect.top + 38;

        const endRect = targetElement.getBoundingClientRect();
        // Target: Center of destination pot
        const endX = endRect.left + endRect.width / 2 - 14;
        const endY = endRect.top + endRect.height / 2 - 14;

        const deltaX = endX - startX;
        const deltaY = endY - startY;

        const flyer = document.createElement('div');
        flyer.className = 'flying-coin-guest';
        flyer.style.left = `${startX}px`;
        flyer.style.top = `${startY}px`;
        flyer.innerHTML = `
            <div class="coin-spin-disc">
                <img src="assets/icons/coin.svg" class="flying-coin-svg" alt="coin">
            </div>
        `;

        document.body.appendChild(flyer);

        const anim = flyer.animate([
            { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
            { transform: `translate(${deltaX}px, ${deltaY}px) scale(0.6)`, opacity: 0.95 }
        ], {
            duration: 520,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            fill: 'forwards'
        });

        anim.onfinish = () => {
            flyer.remove();
            if (window.soundFx) window.soundFx.playCoinDrop();
            targetElement.classList.add('coin-impact-ripple');
            setTimeout(() => targetElement.classList.remove('coin-impact-ripple'), 350);
        };
    }

    // Winnings Coins Flight Animation from winning wheel pot to user Balance pill
    spawnWinningCoinsBurstToBalance(winningItemId, amount) {
        const sourcePod = document.querySelector(`.wheel-pod[data-id="${winningItemId}"]`) ||
                          document.getElementById('centerWheelResult');
        const targetPill = document.getElementById('balancePill');
        if (!sourcePod || !targetPill) return;

        const startRect = sourcePod.getBoundingClientRect();
        const endRect = targetPill.getBoundingClientRect();

        const startX = startRect.left + startRect.width / 2 - 11;
        const startY = startRect.top + startRect.height / 2 - 11;
        const endX = endRect.left + endRect.width / 2 - 11;
        const endY = endRect.top + endRect.height / 2 - 11;

        const coinCount = Math.min(8, Math.max(4, Math.floor(Math.log10(Number(amount) + 1) * 2)));

        for (let i = 0; i < coinCount; i++) {
            setTimeout(() => {
                const coin = document.createElement('div');
                coin.className = 'flying-win-coin';
                coin.innerHTML = '<img src="assets/icons/coin.svg" alt="coin">';

                // Spread offset at start
                const spreadX = (Math.random() - 0.5) * 36;
                const spreadY = (Math.random() - 0.5) * 36;

                coin.style.left = `${startX + spreadX}px`;
                coin.style.top = `${startY + spreadY}px`;
                document.body.appendChild(coin);

                const deltaX = endX - (startX + spreadX);
                const deltaY = endY - (startY + spreadY);

                const anim = coin.animate([
                    { transform: 'translate(0px, 0px) scale(0.5)', opacity: 0 },
                    { transform: `translate(${spreadX * 1.2}px, -20px) scale(1.3)`, opacity: 1, offset: 0.25 },
                    { transform: `translate(${deltaX}px, ${deltaY}px) scale(0.85)`, opacity: 0.95, offset: 0.9 },
                    { transform: `translate(${deltaX}px, ${deltaY}px) scale(0.5)`, opacity: 0 }
                ], {
                    duration: 600 + i * 45,
                    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
                    fill: 'forwards'
                });

                anim.onfinish = () => {
                    coin.remove();
                    if (i === coinCount - 1) {
                        if (window.soundFx) window.soundFx.playCoinDrop();
                    }
                };
            }, i * 50);
        }
    }

    // Smooth balance counter interpolation and pill pulse animation
    animateBalance(targetCoins, isWinning = false) {
        const coinsEl = document.getElementById('userCoinsText');
        const pill = document.getElementById('balancePill');
        if (!coinsEl) return;

        const currentVal = (this.currentAnimatedCoins !== undefined) ? 
            this.currentAnimatedCoins : 
            (Number(String(coinsEl.textContent).replace(/,/g, '')) || 0);

        const targetVal = Number(targetCoins) || 0;
        this.currentAnimatedCoins = targetVal;

        if (pill) {
            pill.classList.remove('pulse-win', 'pulse-bet');
            void pill.offsetWidth;
            pill.classList.add(isWinning ? 'pulse-win' : 'pulse-bet');
            setTimeout(() => pill.classList.remove('pulse-win', 'pulse-bet'), 600);
        }

        if (currentVal === targetVal) {
            coinsEl.textContent = targetVal.toLocaleString();
            return;
        }

        const duration = isWinning ? 700 : 380;
        const startTime = performance.now();

        const step = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(1, elapsed / duration);
            const ease = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(currentVal + (targetVal - currentVal) * ease);
            coinsEl.textContent = current.toLocaleString();

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                coinsEl.textContent = targetVal.toLocaleString();
            }
        };

        requestAnimationFrame(step);
    }

    updateConnectionStatus(connected) {
        const pingVal = document.getElementById('pingValueText');
        if (pingVal) {
            pingVal.textContent = connected ? `${Math.floor(180 + Math.random() * 50)}ms` : 'Offline';
            pingVal.parentElement.style.borderColor = connected ? '#2E7D32' : '#C62828';
        }
    }

    // ==================== SOCKET EVENT HANDLERS ====================

    handleInitGameState(data) {
        this.userData = data.user;
        if (this.userData) {
            if (this.userData.coins !== undefined) {
                localStorage.setItem('greedy_coins', this.userData.coins);
            }
            if (this.userData.diamonds !== undefined) {
                localStorage.setItem('greedy_diamonds', this.userData.diamonds);
            }
        }
        this.gameState = data.state;
        this.timeLeft = data.timeLeft;
        this.roundNumber = data.roundNumber;
        this.items = data.items || [];
        this.recentResults = data.recentResults || [];
        this.podTotals = data.podTotalBets || {};
        this.userBets = data.userBets || {};
        this.hotItem = data.hotItem || 'hotdog';

        this.renderUserWallet();
        this.renderRoundHeader();
        this.renderRecentResults();
        this.renderAllPodTotals();

        // Render any active bets placed by this user
        Object.entries(this.userBets).forEach(([itemId, amount]) => {
            if (amount > 0) this.renderUserBetBadge(itemId, amount);
        });
        this.updateMyTotalBet();

        const roomTotalEl = document.getElementById('totalRoomBetsText');
        if (roomTotalEl) {
            roomTotalEl.textContent = (data.totalRoomBets !== undefined ? data.totalRoomBets : 0).toLocaleString();
        }

        this.renderBigWinner(data.bigWinner);
        this.updateWheelCenterUI();
        this.updateHotBadge();
        this.renderMultipliers(data.items, data.comboItems);

        const wheelStage = document.querySelector('.wheel-stage');
        if (this.gameState === 'SPINNING') {
            if (wheelStage) wheelStage.classList.add('phase-spinning');
            this.setSpinningStateUI();
            if (data.targetIndex !== undefined && data.targetIndex !== null) {
                const remMs = Math.max(2000, (data.timeLeft || 4) * 1000);
                this.runSpinAnimation(data.targetIndex, remMs);
            }
        } else {
            if (wheelStage) wheelStage.classList.remove('phase-spinning');
        }

        if (this.onGameStateReady) {
            this.onGameStateReady();
        }
    }

    handleGameTick(data) {
        this.gameState = data.state;
        this.timeLeft = data.timeLeft;
        this.roundNumber = data.roundNumber;
        if (data.hotItem) this.hotItem = data.hotItem;

        this.renderRoundHeader();
        this.updateWheelCenterUI();

        if (this.gameState === 'BETTING' && this.timeLeft <= 5 && this.timeLeft > 0) {
            window.soundFx.playCountdownTick();
        }
    }

    handleItemsUpdated(data) {
        if (!data) return;
        if (data.items) this.items = data.items;
        if (data.comboItems) this.comboItems = data.comboItems;
        this.renderMultipliers(data.items, data.comboItems);
    }

    renderMultipliers(items = [], comboItems = []) {
        if (items && Array.isArray(items)) {
            items.forEach(item => {
                const podMulti = document.querySelector(`.wheel-pod[data-id="${item.id}"] .pod-multi-text`);
                if (podMulti) {
                    podMulti.textContent = `${item.multiplier}X`;
                }
                document.querySelectorAll('.rule-food-item').forEach(rf => {
                    const nameEl = rf.querySelector('.rule-name');
                    if (nameEl && nameEl.textContent.trim().toLowerCase() === item.name.toLowerCase()) {
                        const mEl = rf.querySelector('.rule-multi');
                        if (mEl) mEl.textContent = `${item.multiplier}X`;
                    }
                });
            });
        }
        if (comboItems && Array.isArray(comboItems)) {
            comboItems.forEach(combo => {
                const comboBadge = document.querySelector(`button[data-id="${combo.id}"] .combo-badge-tag`);
                if (comboBadge) {
                    comboBadge.textContent = `${combo.multiplier}x`;
                }
            });
            const comboRules = document.querySelector('.combo-rules-note');
            if (comboRules) {
                const vegCombo = comboItems.find(c => c.id === 'veg_combo')?.multiplier || 1.25;
                const salad = comboItems.find(c => c.id === 'salad')?.multiplier || 2;
                const pizza = comboItems.find(c => c.id === 'pizza')?.multiplier || 2.5;
                const meatCombo = comboItems.find(c => c.id === 'meat_combo')?.multiplier || 4.37;
                comboRules.innerHTML = `
                    <strong>Combos:</strong><br>
                    🥗 <strong>Veg Combo (${vegCombo}x):</strong> Bets on all 4 vegetables.<br>
                    🥗 <strong>Salad (${salad}x):</strong> Pays ${salad}x on vegetables.<br>
                    🍕 <strong>Pizza (${pizza}x):</strong> Pays ${pizza}x on meats.<br>
                    🍖 <strong>Meat Combo (${meatCombo}x):</strong> Bets on all 4 meats.
                `;
            }
        }
    }

    handleRoundStart(data) {
        this.gameState = 'BETTING';
        this.roundNumber = data.roundNumber;
        this.timeLeft = data.timeLeft;
        this.userBets = {};
        this.podTotals = {};
        this.isSpinning = false;
        if (this.spinTimeout) clearTimeout(this.spinTimeout);
        if (this.podiumTimer) clearInterval(this.podiumTimer);

        // Close round podium modal
        this.closeModal('roundResultModal');

        // Remove grayout spinning phase
        const wheelStage = document.querySelector('.wheel-stage');
        if (wheelStage) wheelStage.classList.remove('phase-spinning');

        // Clear pod bet badges and highlights
        document.querySelectorAll('.wheel-pod').forEach(pod => {
            pod.classList.remove('winner-highlight', 'active-spin-focus');
            const myBet = pod.querySelector('.pod-my-bet-pill');
            if (myBet) myBet.remove();
        });

        // Clear combo badges and reset combo totals
        this.comboBets = {};
        this.comboTotals = {};
        document.querySelectorAll('.combo-dish-btn').forEach(combo => {
            combo.classList.remove('winner-highlight');
            const myBet = combo.querySelector('.combo-my-bet-pill');
            if (myBet) myBet.remove();
        });
        ['veg_combo', 'salad', 'pizza', 'meat_combo'].forEach(id => {
            const el = document.getElementById(`podTotal_${id}`);
            if (el) el.textContent = 'Total:0';
        });

        // Reset totals to 0
        this.renderAllPodTotals();
        this.updateMyTotalBet();

        const roomTotalEl = document.getElementById('totalRoomBetsText');
        if (roomTotalEl) {
            roomTotalEl.textContent = '0';
        }

        if (data.hotItem) this.hotItem = data.hotItem;
        this.updateHotBadge();
        if (data.bigWinner) this.renderBigWinner(data.bigWinner);

        this.renderRoundHeader();
        this.updateWheelCenterUI();
    }

    handleBetBroadcast(data) {
        this.podTotals[data.itemId] = data.podTotal;
        this.renderPodTotal(data.itemId, data.podTotal);

        // Update combo dish totals based on each combo's distinct bet total
        if (this.comboTotals) {
            ['veg_combo', 'salad', 'pizza', 'meat_combo'].forEach(cId => {
                const amt = this.comboTotals[cId] || 0;
                this.renderPodTotal(cId, amt);
            });
        }

        // Update room total
        const roomTotalEl = document.getElementById('totalRoomBetsText');
        if (roomTotalEl && data.totalRoomBets !== undefined) {
            roomTotalEl.textContent = data.totalRoomBets.toLocaleString();
        }

        // When another real player places a bet, fly a coin into that pot
        if (data.userId && data.userId !== this.userData.id) {
            this.spawnFlyingCoinFromTopRight(data.itemId, data.chipAmount);
        }

        // Ticker broadcast for real players' high roller bets
        if (data.chipAmount >= 10000) {
            const userTag = (data.userId === this.userData.id) ? 'You' : (data.username || 'Player');
            this.updateTickerMessage(`🔥 High Roller ${userTag} placed ${this.formatCompact(data.chipAmount)} on ${data.itemId.toUpperCase()}!`);
        }

        // If current user bet
        if (data.userId === this.userData.id) {
            this.userBets[data.itemId] = data.userTotalOnItem;
            this.renderUserBetBadge(data.itemId, data.userTotalOnItem);
            this.updateMyTotalBet();
        }
    }

    handleBetResponse(data) {
        if (data.success) {
            this.userData.coins = data.newBalance;
            localStorage.setItem('greedy_coins', data.newBalance);
            this.renderUserWallet(true, false);
            this.notifyCoinsUpdate({
                event: 'BET_PLACED',
                roundNumber: this.roundNumber,
                newCoins: data.newBalance,
                timestamp: Date.now()
            });
        } else {
            this.showToast(data.message, 'warning');
        }
    }

    handleRepeatResponse(data) {
        if (data.success) {
            this.userData.coins = data.newBalance;
            localStorage.setItem('greedy_coins', data.newBalance);
            this.renderUserWallet(true, false);
            this.showToast('Previous bets repeated successfully!', 'success');
            this.notifyCoinsUpdate({
                event: 'BET_REPEATED',
                roundNumber: this.roundNumber,
                newCoins: data.newBalance,
                timestamp: Date.now()
            });
        } else {
            this.showToast(data.message || 'Cannot repeat bet', 'warning');
        }
    }

    handleBalanceUpdated(data) {
        if (data.coins !== undefined) {
            this.userData.coins = data.coins;
            localStorage.setItem('greedy_coins', data.coins);
        }
        if (data.diamonds !== undefined) {
            this.userData.diamonds = data.diamonds;
            localStorage.setItem('greedy_diamonds', data.diamonds);
        }
        this.renderUserWallet(true, true);
        if (data.message) this.showToast(data.message, 'success');
        this.closeAllModals();
        this.notifyCoinsUpdate({
            event: 'BALANCE_CLAIMED',
            newCoins: this.userData.coins,
            newDiamonds: this.userData.diamonds,
            timestamp: Date.now()
        });
    }

    handleSpinStart(data) {
        if (this.spinTimeout) {
            clearTimeout(this.spinTimeout);
            this.spinTimeout = null;
        }

        this.gameState = 'SPINNING';
        this.targetIndex = data.targetIndex;

        // Grayout all pods
        const wheelStage = document.querySelector('.wheel-stage');
        if (wheelStage) wheelStage.classList.add('phase-spinning');

        // Clear any previous highlights
        document.querySelectorAll('.wheel-pod').forEach(p => {
            p.classList.remove('active-spin-focus', 'winner-highlight');
        });

        this.runSpinAnimation(data.targetIndex, data.duration || 8000);
    }

    runSpinAnimation(targetIdx, totalDuration = 8000) {
        if (this.spinTimeout) {
            clearTimeout(this.spinTimeout);
            this.spinTimeout = null;
        }

        this.isSpinning = true;
        this.setSpinningStateUI();

        const pods = document.querySelectorAll('.wheel-pod');
        const podCount = pods.length || 8;

        // Normalize targetIdx to integer 0..7
        const normalizedTarget = Math.max(0, Math.min(podCount - 1, parseInt(targetIdx) || 0));

        // Start from wherever the wheel was last resting, or 0
        const startIdx = (typeof this.currentSpinIndex === 'number' && this.currentSpinIndex >= 0)
            ? this.currentSpinIndex
            : 0;

        // Calculate exact number of steps to reach targetIdx
        const stepsToTarget = ((normalizedTarget - startIdx) % podCount + podCount) % podCount || podCount;
        const laps = 6; // 6 full exciting laps
        const totalSteps = laps * podCount + stepsToTarget;

        // Target animation duration: finish at ~7200ms so it lands and holds locked on winner before round_result (8000ms)
        const animDuration = Math.max(2000, Math.min(totalDuration - 800, 7200));

        // Precompute delays with cubic curve for realistic wheel friction deceleration
        const rawWeights = [];
        for (let i = 0; i < totalSteps; i++) {
            const progress = i / (totalSteps - 1);
            // Fast spin initially (weight ~35), smooth progressive deceleration up to ~450ms at final steps
            const w = 35 + 430 * Math.pow(progress, 3.2);
            rawWeights.push(w);
        }
        const sumRaw = rawWeights.reduce((a, b) => a + b, 0);
        const factor = animDuration / sumRaw;
        const delays = rawWeights.map(w => Math.max(25, Math.round(w * factor)));

        let stepIndex = 0;
        let currIdx = startIdx;

        const executeStep = () => {
            if (!this.isSpinning) return;

            currIdx = (currIdx + 1) % podCount;
            this.currentSpinIndex = currIdx;

            // Highlight current step pod
            document.querySelectorAll('.wheel-pod').forEach(p => p.classList.remove('active-spin-focus'));
            const currentPod = document.querySelector(`.wheel-pod[data-idx="${currIdx}"]`);
            if (currentPod) {
                currentPod.classList.add('active-spin-focus');
            }

            if (window.soundFx) {
                window.soundFx.playWheelTick();
            }

            stepIndex++;

            if (stepIndex >= totalSteps) {
                // Land PRECISELY on the target pod!
                this.isSpinning = false;
                this.currentSpinIndex = normalizedTarget;

                document.querySelectorAll('.wheel-pod').forEach(p => p.classList.remove('active-spin-focus'));
                const winnerPod = document.querySelector(`.wheel-pod[data-idx="${normalizedTarget}"]`);
                if (winnerPod) {
                    winnerPod.classList.add('active-spin-focus', 'winner-highlight');
                }
                return;
            }

            const nextDelay = delays[stepIndex] || 150;
            this.spinTimeout = setTimeout(executeStep, nextDelay);
        };

        const firstDelay = delays[0] || 35;
        this.spinTimeout = setTimeout(executeStep, firstDelay);
    }

    handleRoundResult(data) {
        if (this.spinTimeout) {
            clearTimeout(this.spinTimeout);
            this.spinTimeout = null;
        }
        this.isSpinning = false;

        this.gameState = 'RESULT';
        this.recentResults = data.recentResults || [];
        this.renderRecentResults();

        // Keep wheel in grayout phase with winning pod highlighted
        const wheelStage = document.querySelector('.wheel-stage');
        if (wheelStage) wheelStage.classList.add('phase-spinning');

        // Clean any active-spin-focus from all pods
        document.querySelectorAll('.wheel-pod').forEach(p => {
            p.classList.remove('active-spin-focus', 'winner-highlight');
        });

        // Ensure winning pod is highlighted
        const winningPod = document.querySelector(`.wheel-pod[data-id="${data.winningItem}"]`);
        if (winningPod) {
            winningPod.classList.add('active-spin-focus', 'winner-highlight');
            const idx = parseInt(winningPod.dataset.idx);
            if (!isNaN(idx)) {
                this.currentSpinIndex = idx;
            }
        }

        // Highlight winning combo dishes
        document.querySelectorAll('.combo-dish-btn').forEach(combo => {
            combo.classList.remove('winner-highlight');
        });
        const winningId = data.winningItem;
        const isVeg = ['tomato', 'corn', 'cabbage', 'carrot'].includes(winningId);
        const isMeat = ['hotdog', 'kebab', 'chicken', 'steak'].includes(winningId);
        if (isVeg) {
            const vegBtn = document.getElementById('vegComboBtn');
            const saladBtn = document.getElementById('saladComboBtn');
            if (vegBtn) vegBtn.classList.add('winner-highlight');
            if (saladBtn) saladBtn.classList.add('winner-highlight');
        } else if (isMeat) {
            const pizzaBtn = document.getElementById('pizzaComboBtn');
            const meatBtn = document.getElementById('meatComboBtn');
            if (pizzaBtn) pizzaBtn.classList.add('winner-highlight');
            if (meatBtn) meatBtn.classList.add('winner-highlight');
        }

        // Show Center Result UI
        this.setResultStateUI(data.winningItem, data.multiplier);

        // Update Big Winner bar
        if (data.bigWinner) this.renderBigWinner(data.bigWinner);

        // Calculate User Round Stats
        let myEarnings = 0;
        let myBets = 0;
        if (data.userResults && data.userResults.length > 0) {
            const myResult = data.userResults.find(r => r.userId === this.userData.id);
            if (myResult) {
                this.userData.coins = myResult.newCoins;
                this.userData.todayProfit = myResult.todayProfit;
                if (myResult.newDiamonds !== undefined) {
                    this.userData.diamonds = myResult.newDiamonds;
                    localStorage.setItem('greedy_diamonds', myResult.newDiamonds);
                }
                localStorage.setItem('greedy_coins', myResult.newCoins);
                myEarnings = myResult.userTotalPayout;
                myBets = myResult.userTotalBet;

                if (myEarnings > 0) {
                    this.spawnWinningCoinsBurstToBalance(data.winningItem, myEarnings);
                    setTimeout(() => {
                        this.renderUserWallet(true, true);
                    }, 350);
                } else {
                    this.renderUserWallet(false, false);
                }

                // Notify parent app of new balance & round earnings
                this.notifyCoinsUpdate({
                    event: 'ROUND_RESULT',
                    roundNumber: data.roundNumber,
                    winningItem: data.winningItem,
                    multiplier: data.multiplier,
                    userTotalBet: myResult.userTotalBet,
                    userTotalPayout: myResult.userTotalPayout,
                    delta: myResult.netProfit,
                    diamondsEarned: myResult.diamondsEarned || 0,
                    newCoins: myResult.newCoins,
                    newDiamonds: this.userData.diamonds,
                    timestamp: Date.now()
                });
            }
        }

        if (myEarnings > 0) {
            window.soundFx.playWinFanfare();
        }

        // Announce Round Result on Room Ticker
        if (data.roundRankings && data.roundRankings.length > 0 && data.roundRankings[0].total_payout > 0) {
            const topWinner = data.roundRankings[0];
            this.updateTickerMessage(`🏆 Winner: ${topWinner.username} won ${this.formatCompact(topWinner.total_payout)} on ${data.winningItem.toUpperCase()} (${data.multiplier}X)! 🎉`);
        } else {
            this.updateTickerMessage(`🎯 Round ${this.roundNumber} Result: ${data.winningItem.toUpperCase()} (${data.multiplier}X)! Place your bets!`);
        }

        // Display Round Podium Modal (Media 1)
        this.showRoundPodiumModal(data, myEarnings, myBets);
    }

    showRoundPodiumModal(data, myEarnings, myBets) {
        const modal = document.getElementById('roundResultModal');
        if (!modal) return;

        // Winning hero dish
        const heroDish = document.getElementById('podiumDishImg');
        const miniWinner = document.getElementById('podiumMiniWinner');
        if (heroDish) heroDish.src = `assets/icons/${data.winningItem}.svg`;
        if (miniWinner) miniWinner.src = `assets/icons/${data.winningItem}.svg`;

        // Round number
        const roundNumEl = document.getElementById('podiumRoundNum');
        if (roundNumEl) roundNumEl.textContent = `${this.roundNumber}'s`;

        // Earnings and Bets
        const earningsEl = document.getElementById('podiumEarnings');
        const betsEl = document.getElementById('podiumBets');
        if (earningsEl) earningsEl.textContent = myEarnings.toLocaleString();
        if (betsEl) betsEl.textContent = myBets.toLocaleString();

        // Render Top 3 Winners Podium
        this.renderPodiumWinners(data.roundRankings);

        // Countdown timer (4s)
        this.podiumSecondsLeft = 4;
        const countdownEl = document.getElementById('podiumCountdown');
        if (countdownEl) countdownEl.textContent = `${this.podiumSecondsLeft}s`;

        if (this.podiumTimer) clearInterval(this.podiumTimer);
        this.podiumTimer = setInterval(() => {
            this.podiumSecondsLeft--;
            if (countdownEl) countdownEl.textContent = `${this.podiumSecondsLeft}s`;
            if (this.podiumSecondsLeft <= 0) {
                clearInterval(this.podiumTimer);
                this.closeModal('roundResultModal');
            }
        }, 1000);

        this.openModal('roundResultModal');
    }

    renderPodiumWinners(rankings) {
        const container = document.getElementById('roundPodiumWinners');
        if (!container) return;

        const validWinners = (rankings || []).filter(r => r && Number(r.total_payout) > 0);

        if (validWinners.length === 0) {
            container.innerHTML = `
                <div class="podium-no-winners" style="grid-column: 1 / -1; width: 100%; text-align: center; color: #FFF; padding: 18px 0; font-size: 13px;">
                    <div style="font-size: 26px; margin-bottom: 4px;">🎯</div>
                    <div style="font-weight: 700; color: #FFD54F;">No Winners This Round</div>
                    <div style="font-size: 11px; color: rgba(255,255,255,0.7); margin-top: 2px;">Place your bets to win next round!</div>
                </div>
            `;
            return;
        }

        // Single winner
        if (validWinners.length === 1) {
            const r1 = validWinners[0];
            container.innerHTML = `
                <div class="podium-winner-col rank-1-col" style="order: 1; margin: 0 auto;">
                    <div class="avatar-crown-wrap">
                        <img src="${this.getAvatarSrc(r1.avatar || 'avatar_queen')}" class="podium-avatar" onerror="this.src='assets/avatars/avatar_queen.svg'">
                        <span class="rank-tag rank-1-tag">1</span>
                    </div>
                    <div class="podium-user-name">${r1.username}</div>
                    <div class="podium-user-score"><img src="assets/icons/coin.svg" class="mini-coin-egg"> ${this.formatCompact(r1.total_payout)}</div>
                </div>
            `;
            return;
        }

        // Two winners
        if (validWinners.length === 2) {
            const r1 = validWinners[0];
            const r2 = validWinners[1];
            container.innerHTML = `
                <div class="podium-winner-col rank-2-col">
                    <div class="avatar-crown-wrap">
                        <img src="${this.getAvatarSrc(r2.avatar || 'avatar_tiger')}" class="podium-avatar" onerror="this.src='assets/avatars/avatar_tiger.svg'">
                        <span class="rank-tag rank-2-tag">2</span>
                    </div>
                    <div class="podium-user-name">${r2.username}</div>
                    <div class="podium-user-score"><img src="assets/icons/coin.svg" class="mini-coin-egg"> ${this.formatCompact(r2.total_payout)}</div>
                </div>
                <div class="podium-winner-col rank-1-col">
                    <div class="avatar-crown-wrap">
                        <img src="${this.getAvatarSrc(r1.avatar || 'avatar_queen')}" class="podium-avatar" onerror="this.src='assets/avatars/avatar_queen.svg'">
                        <span class="rank-tag rank-1-tag">1</span>
                    </div>
                    <div class="podium-user-name">${r1.username}</div>
                    <div class="podium-user-score"><img src="assets/icons/coin.svg" class="mini-coin-egg"> ${this.formatCompact(r1.total_payout)}</div>
                </div>
            `;
            return;
        }

        // 3 or more winners
        const r1 = validWinners[0];
        const r2 = validWinners[1];
        const r3 = validWinners[2];

        container.innerHTML = `
            <!-- Rank 2 (Left) -->
            <div class="podium-winner-col rank-2-col">
                <div class="avatar-crown-wrap">
                    <img src="${this.getAvatarSrc(r2.avatar || 'avatar_tiger')}" class="podium-avatar" onerror="this.src='assets/avatars/avatar_tiger.svg'">
                    <span class="rank-tag rank-2-tag">2</span>
                </div>
                <div class="podium-user-name">${r2.username}</div>
                <div class="podium-user-score"><img src="assets/icons/coin.svg" class="mini-coin-egg"> ${this.formatCompact(r2.total_payout)}</div>
            </div>

            <!-- Rank 1 (Center) -->
            <div class="podium-winner-col rank-1-col">
                <div class="avatar-crown-wrap">
                    <img src="${this.getAvatarSrc(r1.avatar || 'avatar_queen')}" class="podium-avatar" onerror="this.src='assets/avatars/avatar_queen.svg'">
                    <span class="rank-tag rank-1-tag">1</span>
                </div>
                <div class="podium-user-name">${r1.username}</div>
                <div class="podium-user-score"><img src="assets/icons/coin.svg" class="mini-coin-egg"> ${this.formatCompact(r1.total_payout)}</div>
            </div>

            <!-- Rank 3 (Right) -->
            <div class="podium-winner-col rank-3-col">
                <div class="avatar-crown-wrap">
                    <img src="${this.getAvatarSrc(r3.avatar || 'avatar1')}" class="podium-avatar" onerror="this.src='assets/avatars/avatar1.svg'">
                    <span class="rank-tag rank-3-tag">3</span>
                </div>
                <div class="podium-user-name">${r3.username}</div>
                <div class="podium-user-score"><img src="assets/icons/coin.svg" class="mini-coin-egg"> ${this.formatCompact(r3.total_payout)}</div>
            </div>
        `;
    }

    handleRevenueRanksResponse(ranks) {
        const list = document.getElementById('revenueRankList');
        if (!list) return;

        // Ensure only positive revenue entries are displayed in the Revenue Leaderboard
        const validRanks = (ranks || []).filter(u => u && Number(u.today_profit) > 0);

        if (validRanks.length === 0) {
            list.innerHTML = `<div style="text-align:center; padding: 24px; color: #757575; font-size: 13px;">🎯 No revenue records yet today.<br><span style="font-size: 11px; opacity: 0.8;">Place bets to claim top rank!</span></div>`;
            return;
        }

        list.innerHTML = validRanks.map((u, i) => {
            let rankBadgeHtml = `<span class="revenue-rank-badge">${i + 1}</span>`;
            if (i === 0) rankBadgeHtml = `<span class="revenue-rank-badge top-1">👑 1</span>`;
            else if (i === 1) rankBadgeHtml = `<span class="revenue-rank-badge top-2">🥈 2</span>`;
            else if (i === 2) rankBadgeHtml = `<span class="revenue-rank-badge top-3">🥉 3</span>`;

            const isMe = this.userData && (u.id === this.userData.id || u.username === this.userData.username);
            const rowClass = isMe ? 'revenue-row is-me' : 'revenue-row';

            return `
                <div class="${rowClass}">
                    ${rankBadgeHtml}
                    <img src="${this.getAvatarSrc(u.avatar || 'avatar1')}" class="revenue-avatar" onerror="this.src='assets/avatars/avatar1.svg'">
                    <div class="revenue-name">${u.username} ${isMe ? '<span style="color:#2E7D32; font-weight:700;">(You)</span>' : ''}</div>
                    <div class="revenue-val">
                        <img src="assets/icons/coin.svg" style="width:13px;height:13px;">
                        ${this.formatCompact(u.today_profit || 0)}
                    </div>
                </div>
            `;
        }).join('');
    }

    handleMyRecordResponse(data) {
        console.log('[GreedyApp] User bet records response:', data);
        this.userRecords = Array.isArray(data) ? data : [];
        const event = new CustomEvent('greedy_my_records', { detail: this.userRecords });
        window.dispatchEvent(event);
    }

    handleLeaderboardUpdate(data) {
        if (data.bigWinner) this.renderBigWinner(data.bigWinner);
    }

    // Helper to resolve avatar source (supports built-in SVGs and external URLs)
    getAvatarSrc(avatar) {
        if (!avatar) return 'assets/avatars/avatar1.svg';
        const str = String(avatar).trim();
        if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('data:') || str.startsWith('/')) {
            return str;
        }
        if (str.endsWith('.svg') || str.endsWith('.png') || str.endsWith('.jpg') || str.endsWith('.webp')) {
            return str.startsWith('assets/') ? str : `assets/avatars/${str}`;
        }
        return `assets/avatars/${str}.svg`;
    }

    // Bridge call to close mobile bottomSheet when running inside app WebView
    closeGameBottomSheet() {
        console.log('[MobileBridge] Requesting bottomSheet close...');
        const payload = { 
            type: 'CLOSE_GAME', 
            action: 'close',
            userId: this.userData ? this.userData.id : null,
            coins: this.userData ? this.userData.coins : 0,
            todayProfit: this.userData ? (this.userData.today_profit !== undefined ? this.userData.today_profit : this.userData.todayProfit) : 0
        };

        // 1. React Native WebView
        if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
        // 2. Flutter InAppWebView
        if (window.flutter_inappwebview && typeof window.flutter_inappwebview.callHandler === 'function') {
            window.flutter_inappwebview.callHandler('closeGame', payload);
        }
        // 3. Android Native WebView JavascriptInterface
        if (window.AndroidBridge && typeof window.AndroidBridge.closeGame === 'function') {
            try { window.AndroidBridge.closeGame(JSON.stringify(payload)); } catch(e) { window.AndroidBridge.closeGame(); }
        }
        // 4. iOS WebKit messageHandler
        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.closeGame) {
            window.webkit.messageHandlers.closeGame.postMessage(payload);
        }
        // 5. Parent window / iframe postMessage
        if (window.parent && window.parent !== window) {
            window.parent.postMessage(payload, '*');
        }

        this.showToast('Exiting Game...', 'info');
    }

    // Bridge call to notify parent app about coin balance updates
    notifyCoinsUpdate(eventData) {
        if (!this.userData) return;
        const payload = {
            type: 'COINS_UPDATE',
            userId: this.userData.id,
            username: this.userData.username,
            coins: this.userData.coins,
            todayProfit: this.userData.today_profit !== undefined ? this.userData.today_profit : (this.userData.todayProfit || 0),
            diamonds: this.userData.diamonds || 0,
            ...eventData
        };

        console.log('[MobileBridge] Broadcasting coins update to main app:', payload);

        // 1. React Native WebView
        if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
        // 2. Flutter InAppWebView
        if (window.flutter_inappwebview && typeof window.flutter_inappwebview.callHandler === 'function') {
            window.flutter_inappwebview.callHandler('onCoinsUpdate', payload);
        }
        // 3. Android Native WebView JavascriptInterface
        if (window.AndroidBridge && typeof window.AndroidBridge.onCoinsUpdate === 'function') {
            try { window.AndroidBridge.onCoinsUpdate(JSON.stringify(payload)); } catch(e) { console.error(e); }
        }
        // 4. iOS WebKit messageHandler
        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.onCoinsUpdate) {
            window.webkit.messageHandlers.onCoinsUpdate.postMessage(payload);
        }
        // 5. Global JavaScript function callback on window
        if (typeof window.onCoinsUpdate === 'function') {
            try { window.onCoinsUpdate(payload); } catch (e) { console.error(e); }
        }
        // 6. Parent window / iframe postMessage
        if (window.parent && window.parent !== window) {
            window.parent.postMessage(payload, '*');
        }

        // 7. If callbackUrl is provided in URL query param:
        const urlParams = new URLSearchParams(window.location.search);
        const callbackUrl = urlParams.get('callbackUrl') || urlParams.get('callback') || urlParams.get('webhook') || localStorage.getItem('greedy_callback_url');
        if (callbackUrl && typeof fetch === 'function') {
            fetch(callbackUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(res => {
                console.log('[MobileBridge] Callback URL response status:', res.status);
            }).catch(err => {
                console.warn('[MobileBridge] Client callbackUrl fetch failed:', err.message);
            });
        }
    }

    // ==================== UI RENDER HELPERS ====================

    renderRoundHeader() {
        const roundEl = document.getElementById('roundNumberText');
        if (roundEl) roundEl.textContent = `Round:${this.roundNumber}`;
    }

    renderUserWallet(animate = false, isWinning = false) {
        if (!this.userData) return;

        const targetCoins = Number(this.userData.coins || 0);
        if (animate) {
            this.animateBalance(targetCoins, isWinning);
        } else {
            const coinsEl = document.getElementById('userCoinsText');
            if (coinsEl) coinsEl.textContent = targetCoins.toLocaleString();
            this.currentAnimatedCoins = targetCoins;
        }

        const profitEl = document.getElementById('userProfitsText');
        if (profitEl) {
            const rawProfit = this.userData.today_profit !== undefined ? this.userData.today_profit : (this.userData.todayProfit || 0);
            const profit = Math.max(0, Number(rawProfit) || 0);
            profitEl.textContent = profit.toLocaleString();
        }

        const diamondsEl = document.getElementById('userDiamondsText');
        if (diamondsEl) diamondsEl.textContent = Number(this.userData.diamonds || 0).toLocaleString();

        const usernameEl = document.getElementById('headerUsernameText');
        if (usernameEl && this.userData.username) {
            usernameEl.textContent = this.userData.username;
        }

        const avatarEl = document.getElementById('headerUserAvatar');
        if (avatarEl && this.userData.avatar) {
            avatarEl.src = this.getAvatarSrc(this.userData.avatar);
        }
    }

    renderAllPodTotals() {
        const wheelItems = ['hotdog', 'kebab', 'chicken', 'steak', 'tomato', 'corn', 'cabbage', 'carrot'];
        wheelItems.forEach(id => {
            const amt = this.podTotals[id] || 0;
            this.renderPodTotal(id, amt);
        });

        ['veg_combo', 'salad', 'pizza', 'meat_combo'].forEach(comboId => {
            const amt = (this.comboTotals && this.comboTotals[comboId]) || this.podTotals[comboId] || 0;
            this.renderPodTotal(comboId, amt);
        });
    }

    renderPodTotal(itemId, amount) {
        const el = document.getElementById(`podTotal_${itemId}`);
        if (el) {
            el.textContent = amount > 0 ? `Total:${this.formatCompact(amount)}` : `Total:0`;
        }
    }

    renderUserBetBadge(itemId, amount) {
        let pod = document.querySelector(`.wheel-pod[data-id="${itemId}"]`);
        if (!pod) {
            pod = document.querySelector(`.combo-dish-btn[data-id="${itemId}"]`);
        }
        if (!pod) return;

        const isCombo = pod.classList.contains('combo-dish-btn');
        const badgeClass = isCombo ? 'combo-my-bet-pill' : 'pod-my-bet-pill';

        let badge = pod.querySelector(`.${badgeClass}`);
        if (!badge) {
            badge = document.createElement('div');
            badge.className = badgeClass;
            pod.appendChild(badge);
        }
        badge.textContent = `🪙 ${this.formatCompact(amount)}`;
    }

    updateMyTotalBet() {
        const total = Object.values(this.userBets).reduce((a, b) => a + b, 0);
        const myTotalEl = document.getElementById('myTotalBetText');
        if (myTotalEl) myTotalEl.textContent = total.toLocaleString();
    }

    updateHotBadge() {
        document.querySelectorAll('.hot-badge').forEach(b => b.remove());
        const hotPod = document.querySelector(`.wheel-pod[data-id="${this.hotItem}"]`);
        if (hotPod) {
            const badge = document.createElement('span');
            badge.className = 'hot-badge';
            badge.textContent = 'HOT';
            hotPod.appendChild(badge);
        }
    }

    renderBigWinner(bigWinner) {
        if (!bigWinner) return;
        const nameEl = document.getElementById('bigWinnerName');
        const amtEl = document.getElementById('bigWinnerAmount');
        const avatarEl = document.getElementById('bigWinnerAvatar');

        if (nameEl) nameEl.textContent = bigWinner.username || '✪R.AGENC...';
        if (amtEl) amtEl.textContent = this.formatCompact(bigWinner.today_profit || 34920000);
        if (avatarEl) avatarEl.src = this.getAvatarSrc(bigWinner.avatar || 'avatar_king');
    }

    renderRecentResults() {
        const container = document.getElementById('resultsRow');
        if (!container) return;

        container.innerHTML = this.recentResults.map((r, index) => `
            <div class="ribbon-result-item">
                <div class="ribbon-food-badge">
                    <img src="assets/icons/${r.winningItem}.svg" alt="${r.winningItem}" onerror="this.src='assets/icons/hotdog.svg'">
                </div>
                ${index === 0 ? '<span class="new-badge-tag">NEW</span>' : ''}
            </div>
        `).join('');
    }

    updateWheelCenterUI() {
        const centerHub = document.getElementById('wheelCenter');
        if (!centerHub) return;

        if (this.gameState === 'BETTING') {
            centerHub.innerHTML = `
                <div class="hub-betting">
                    <div class="hub-food-banner">
                        <img src="assets/icons/salad.svg" class="hub-plate-icon" alt="Plate">
                    </div>
                    <div class="hub-select-time">Select Time</div>
                    <div class="hub-countdown-sec">${this.timeLeft}s</div>
                </div>
            `;
        } else if (this.gameState === 'SPINNING') {
            centerHub.innerHTML = `
                <div class="hub-spinning">
                    <div class="hub-spin-number">${this.timeLeft}</div>
                    <div class="hub-spin-subtext">The Result is<br>Coming</div>
                </div>
            `;
        }
    }

    setSpinningStateUI() {
        const centerHub = document.getElementById('wheelCenter');
        if (!centerHub) return;
        centerHub.innerHTML = `
            <div class="hub-spinning">
                <div class="hub-spin-number">${this.timeLeft}</div>
                <div class="hub-spin-subtext">The Result is<br>Coming</div>
            </div>
        `;
    }

    setResultStateUI(winnerId, multiplier) {
        const centerHub = document.getElementById('wheelCenter');
        if (!centerHub) return;
        centerHub.innerHTML = `
            <div class="hub-result">
                <img src="assets/icons/${winnerId}.svg" class="hub-winner-img">
                <div class="hub-winner-title">WIN ${multiplier}X</div>
            </div>
        `;
    }

    openModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.add('open');
    }

    closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove('open');
    }

    closeAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
    }

    updateTickerMessage(text) {
        const ticker = document.getElementById('tickerText');
        if (ticker) {
            ticker.textContent = text;
            ticker.style.animation = 'none';
            void ticker.offsetWidth;
            ticker.style.animation = 'tickerMarquee 15s linear infinite';
        }
    }

    showToast(msg, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `game-toast toast-${type}`;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 20);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2200);
    }

    formatCompact(num) {
        if (!num) return '0';
        const n = Number(num);
        if (isNaN(n) || n === 0) return '0';

        if (Math.abs(n) >= 1000000) {
            const val = n / 1000000;
            const formatted = parseFloat(val.toFixed(2));
            return `${formatted}M`;
        }
        if (Math.abs(n) >= 1000) {
            const val = n / 1000;
            const formatted = parseFloat(val.toFixed(2));
            return `${formatted}K`;
        }
        return n.toLocaleString();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.app = new GreedyApp();
    window.app.init();
});
