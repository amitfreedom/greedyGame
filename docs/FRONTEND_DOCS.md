# 🎨 Greedy Game — Frontend Architecture & UI Documentation

The frontend of the **Greedy Real-Time Wheel Game** is engineered with lightweight, high-performance **Vanilla HTML5, CSS3, and ES6 JavaScript**. It requires zero heavy client frameworks (React/Vue/Angular), ensuring instant load times (<100ms) inside mobile WebViews and bottom sheets.

---

## 📁 Frontend Directory Layout

```text
frontend/
├── index.html            # Core DOM structure, splash screen, wheel stage, modals
├── css/
│   └── style.css         # Complete styling, 3D typography, keyframe animations, media queries
├── js/
│   ├── app.js            # Main application controller, game loop, UI renderer, mobile bridges
│   ├── socket.js         # Socket.io client, auth credential parser, event router
│   └── audio.js          # Web Audio API sound synthesis (zero external audio files required)
└── assets/
    ├── icons/            # SVG vector food dishes (hotdog, pizza, chicken, steak, tomato, etc.)
    └── avatars/          # SVG cartoon avatars for player profiles and leaderboard
```

---

## 🎡 Screen Components & Layout Hierarchy

### 1. 5-Second Luxury Carnival Splash Screen (`#gameSplashScreen`)
Before entering the arena, users are greeted with an arcade-themed loading splash screen:
- **Rotating Sunburst Rays**: Continuous conic radial gradient spinning behind the content (`@keyframes spinSunburst`).
- **Sparkling Golden Stars**: Randomly floating twinkling stars (`@keyframes sparkleStar`).
- **Floating 3D Food Treats**: Hot Dog, Pizza, Chicken Leg, and Beef Steak floating with bobbing rotation around the logo.
- **Center Emblem**: Flashing carnival marquee bulbs surrounding a rotating food plate.
- **3D Extruded Typography**: Multi-layered extruded cartoon title for `GREEDY` with a red carnival ribbon (`🍗 CARNIVAL FEAST 🍕`).
- **Horizontal Progress Bar & Animated Coin Pin**:
  - Gradient progress track (green to gold) with a moving sheen animation.
  - A 3D golden coin pin at the progress head spins continuously (`@keyframes coinHeadSpin`) as it glides from 0% to 100%.
  - Status messages update dynamically across the 5 seconds:
    - `0% - 24%`: *"Entering Carnival Arena..."*
    - `25% - 54%`: *"Loading 3D Feast & Sound FX..."*
    - `55% - 79%`: *"Connecting Live Feast Standings..."*
    - `80% - 98%`: *"Synchronizing Wallet & Table..."*
    - `100%`: *"Ready to Feast! Good Luck! 🎡"*
  - **Exit Transition**: At 5 seconds, `#gameSplashScreen` smoothly scales up, blurs, and fades out (`.splash-exit`) into the game screen.

---

### 2. Top Header & Navigation Bar (`.game-header`)
- **Home Button (`#homeBtn`)**: Sends exit message (`CLOSE_GAME`) to native Android/iOS/Flutter app to dismiss the bottom sheet.
- **User Profile Pill**: Displays the user's avatar and truncated username.
- **Round Number Badge (`#roundNumberText`)**: Displays the active round (e.g. `Round:2025`).
- **Diamonds Pill (`#userDiamondsText`)**: Live diamond balance.
- **Sound Settings Dropdown (`#soundSettingsDropdown`)**:
  - Speaker icon toggle button.
  - Opens a small dropdown with a volume slider (0% to 100%) and a quick Mute/Unmute button.
- **Game Rules Button (`#rulesBtn`)**: Opens the game payout and odds guide modal.
- **Latency Indicator (`#pingValueText`)**: Displays live WebSocket roundtrip ping (e.g. `195ms`).

---

### 3. Central Ferris Wheel Stage (`.wheel-stage`)
Constructed with authentic arcade aesthetics matching reference images:
- **8 Food Pods**:
  - 4 Meats: Hot Dog (10x), Kebab Skewer (15x), Roast Chicken (25x), Beef Steak (45x).
  - 4 Veggies: Tomato (5x), Sweet Corn (5x), Cabbage (5x), Carrot (5x).
  - Each pod displays its item icon, payout multiplier, total pool bet, and the user's personal bet badge.
- **Dynamic "HOT" Badge**: Real-time fire badge highlighting the most popular or trending food item.
- **Central Countdown Hub (`#wheelCenter`)**:
  - **Betting Phase**: Displays big countdown seconds (e.g., `15s`, `14s`...) with dish icon.
  - **Spinning Phase**: Displays glowing countdown and *"The Result is Coming"*.
  - **Result Phase**: Displays the winning dish SVG and winning multiplier (e.g. `WIN 10X`).

---

### 4. Lower Base Stand & Combo Dishes (`.wheel-lower-base`)
The lower structural base of the Ferris wheel houses 4 combination betting dishes:
1. 🥗 **Vegetable Basket (`veg_combo`) — 1.25x**: Wins if Tomato, Corn, Cabbage, or Carrot hits.
2. 🥗 **Salad Bowl (`salad`) — 2.0x**: Wins on any vegetable outcome.
3. 🍕 **Pizza Platter (`pizza`) — 2.5x**: Wins if Hot Dog, Kebab, Chicken, or Steak hits.
4. 🥩 **Meat Basket (`meat_combo`) — 4.37x**: High-payout meat group combo.

---

### 5. Betting Dashboard & Controls
- **Chip Selector**: 5 chip values (`500`, `1K`, `5K`, `10K`, `50K`).
- **Popular Recommendation Package (`#popularRecomBtn`)**: Places smart combo bets (Hotdog + Salad) with a single tap.
- **Balance & Profit Cards**:
  - Live Coins balance (formatted e.g. `12,500,000`).
  - Today's net profit badge (green for positive, red for negative).
- **Repeat Bet Button (`#repeatBetBtn`)**: Replays the exact bet distribution from the previous round with one click.

---

### 6. Live Winner Ticker & Footer Ribbon
- **Marquee Ticker (`#tickerText`)**: Displays real-time rolling announcements for high-roller bets and round winners with confetti emojis.
- **Results Ribbon (`#recentResultsList`)**: Shows the last 11 winning food items with a flashing `NEW` badge on the latest outcome.
- **Big Winner Bar (`#bigWinnerBar`)**: Displays the day's top earner avatar, name, and total coin score. Tapping opens the Revenue Rank Modal.

---

## 💫 Animation & Particle Systems

### 1. Real User Bet Chip Flight (`spawnFlyingChip`)
When a player taps any food pod or combo plate:
1. A 3D coin element spawns at the exact screen position of the active chip button.
2. Animate using `Element.animate()` along an ease-out trajectory directly into the destination pod.
3. On arrival, a coin drop sound effect plays and an impact ripple effect (`coin-impact-ripple`) triggers on the target pod.

### 2. Auto Guest/System Bets Flying From Top-Right (`spawnFlyingCoinFromTopRight`)
To ensure high room energy even with few live human players:
1. The server simulates other room participants placing bets.
2. Gold coins spawn outside the viewport at the **top-right** (`top: 15px, right: 15px`).
3. The coin flies in an arc across the screen straight into the destination pot, adding to the total room bets.

---

## 🔊 Web Audio API Sound System (`frontend/js/audio.js`)

All sound effects are **synthesized in real-time** using the HTML5 Web Audio API (`AudioContext`). No MP3 or WAV files are downloaded, ensuring 100% reliability, instant playback, and zero bandwidth overhead.

| Sound Method | Audio Synthesis Description |
| :--- | :--- |
| `playChipSelect()` | High-frequency sine wave click (`800Hz -> 1200Hz`) with soft decay. |
| `playCoinDrop()` | Dual-frequency metallic ping (`1400Hz + 2100Hz`) imitating gold coins clinking. |
| `playCountdownTick()` | Woodblock / digital tick (`600Hz`) alerting players during the final 5 seconds of betting. |
| `playSpinTick()` | Fast percussive clicks (`300Hz`) accelerating and decelerating with the wheel. |
| `playWinFanfare()` | 4-tone triumphant arpeggio (`C5 -> E5 -> G5 -> C6`) celebrating winning rounds. |

---

## 📐 Responsive Scaling Engine (`updateResponsiveScale`)

To fit smoothly across **any mobile screen height** and inside **compact bottom sheets** (60%, 75%, 80%, 100%):

1. **`ResizeObserver`**:
   Attached to `#wheelStageWrapper`. Whenever the container height changes (due to device orientation, keyboard, or bottom sheet drag), the scale recalculates immediately.

2. **Proportional Clamp Formula**:
   ```javascript
   const scaleH = (availableHeight - 4) / 376;
   const scaleW = (availableWidth - 4) / 360;
   let scale = Math.min(scaleH, scaleW);
   scale = Math.max(0.50, Math.min(1.05, scale));
   wheel.style.transform = `scale(${scale.toFixed(3)})`;
   ```

3. **Adaptive CSS Classes**:
   - `.compact-console` (height <= 640px): Reduces chip sizes and compresses padding.
   - `.compact-console-ultra` (height <= 520px): Streamlines header text and hides non-essential decor to ensure zero content clipping.
