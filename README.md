# 🎡 Greedy - Real-Time Multiplayer Wheel Game

A real-time multiplayer arcade game (inspired by Chamet / Poppo Live Greedy Baby Wheel) engineered for mobile apps, bottom sheets, and WebViews.

- **Frontend:** Vanilla HTML5, CSS3, ES6 JavaScript, Web Audio API (Synthesized SFX), Dynamic BottomSheet Auto-Scaling.
- **Backend:** Node.js, Express, Socket.IO (WebSockets), Server-to-Server Webhook Callbacks.
- **Database:** MySQL + phpMyAdmin compatible schema & migration dump.

---

## 📚 Complete Documentation Guides

| Guide | Description |
| :--- | :--- |
| 📱 [**docs/URL_INTEGRATION_GUIDE.md**](docs/URL_INTEGRATION_GUIDE.md) | **How to launch the game using URL parameters**, BottomSheet heights (60%, 75%, 100%), Webhook coin updates, and Mobile WebView bridge samples (Android, iOS, Flutter, React Native). |
| 🎨 [**docs/FRONTEND_DOCS.md**](docs/FRONTEND_DOCS.md) | **Frontend architecture**: 5-second carnival splash screen, horizontal progress bar, flying chip physics, Web Audio API sound system, and responsive scale engine. |
| ⚙️ [**docs/SERVER_API_DOCS.md**](docs/SERVER_API_DOCS.md) | **Backend & Database architecture**: 28-second game loop state machine, MySQL schema, REST APIs, Socket.IO event protocol, and webhook dispatching. |
| 🚀 [**docs/HOSTINGER_DEPLOYMENT_GUIDE.md**](docs/HOSTINGER_DEPLOYMENT_GUIDE.md) | **Hostinger deployment guide**: Step-by-step VPS & hPanel deployment, PM2 daemon manager, Nginx reverse proxy with WebSocket upgrade, and free SSL certbot. |

---

## 🚀 Quick Launch (Using Full URL)

Launch the game in your mobile app WebView or desktop browser:

```text
http://192.168.1.187:3000/?userId=9002&username=RahulVerma&avtar=avatar_queen&coins=12500000&diamonds=890&percentage=75&callbackUrl=https://your-main-app.com/api/coins-webhook
```

### URL Query Parameters

| Parameter | Required | Purpose |
| :--- | :---: | :--- |
| `userId` | **Yes** | Your main app's unique user ID (alphanumeric/integer). |
| `username` | Optional | Display name in game header and winner ticker. |
| `avtar` | Optional | Avatar ID (e.g. `avatar_queen`, `avatar_king`, `avatar1` to `avatar12`). |
| `coins` | Optional | Starting coins wallet balance. |
| `diamonds` | Optional | Diamonds balance. |
| `percentage` | Optional | Viewport height for BottomSheet (`60`, `70`, `75`, `80`, `100`). |
| `callbackUrl` | Optional | Webhook URL to receive HTTP POST coin update notifications. |

---

## 🔔 How Coin Updates Work

Whenever a round finishes or bets are placed, both the server and frontend automatically send an HTTP POST request to your `callbackUrl`:

```json
{
  "event": "ROUND_RESULT",
  "userId": "9002",
  "username": "RahulVerma",
  "previousCoins": 12500000,
  "newCoins": 12750000,
  "delta": 250000,
  "userTotalBet": 50000,
  "userTotalPayout": 300000,
  "diamondsEarned": 71428,
  "roundNumber": 2025,
  "winningItem": "hotdog",
  "multiplier": 10,
  "timestamp": 1773489283000
}
```

### Updating Your Main Application Database:
```sql
UPDATE users SET coins = :newCoins WHERE id = :userId;
```

---

## 🎮 Game Multipliers & Odds

| Dish | Index | Multiplier | Category |
| :--- | :---: | :---: | :--- |
| 🍅 **Tomato** | 4 | **5x** | Vegetable |
| 🌽 **Sweet Corn** | 5 | **5x** | Vegetable |
| 🥬 **Cabbage** | 6 | **5x** | Vegetable |
| 🥕 **Carrot** | 7 | **5x** | Vegetable |
| 🌭 **Hot Dog** | 0 | **10x** | Meat |
| 🍢 **Kebab Skewer** | 1 | **15x** | Meat |
| 🍗 **Roast Chicken** | 2 | **25x** | Meat |
| 🥩 **Beef Steak** | 3 | **45x** | Meat |
| 🥗 **Veg Basket** | — | **1.25x** | Lower Base Combo |
| 🥗 **Salad Bowl** | — | **2.0x** | Lower Base Combo |
| 🍕 **Pizza Platter**| — | **2.5x** | Lower Base Combo |
| 🥩 **Meat Basket** | — | **4.37x** | Lower Base Combo |

---

## 🛠️ Server Management Commands

### 1. Start MySQL Service
```bash
brew services start mysql
```

### 2. Start phpMyAdmin (Port 8080)
```bash
php -S 0.0.0.0:8080 -t /opt/homebrew/share/phpmyadmin
```
- Open: [http://localhost:8080](http://localhost:8080)
- User: `root` | Password: `Test@1313V` | Database: `greedy_game_db`

### 3. Start Greedy Game Server (Port 3000)
```bash
node backend/server.js
```
- Open: [http://localhost:3000](http://localhost:3000)
- Health check: [http://localhost:3000/api/health](http://localhost:3000/api/health)
