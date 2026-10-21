# 📱 Greedy Game — URL Integration & Mobile BottomSheet Guide

This guide explains how to embed and integrate the **Greedy Real-Time Multiplayer Wheel Game** inside any mobile app (Android, iOS, Flutter, React Native, or Web) via a URL inside a BottomSheet or WebView.

---

## 📌 Table of Contents
1. [Full URL Structure](#1-full-url-structure)
2. [URL Parameters Reference](#2-url-parameters-reference)
3. [Ready-to-Use URL Examples](#3-ready-to-use-url-examples)
4. [BottomSheet Height & Responsiveness](#4-bottomsheet-height--responsiveness)
5. [Coin Balance Updates & Webhook Callback](#5-coin-balance-updates--webhook-callback)
6. [Mobile App WebView Code Samples](#6-mobile-app-webview-code-samples)
7. [Closing the BottomSheet (Exit Bridge)](#7-closing-the-bottomsheet-exit-bridge)

---

## 1. Full URL Structure

To launch the game with user authentication and automatic coin syncing, construct the URL with query parameters:

```text
http://<SERVER_HOST>:3000/?userId=<USER_ID>&username=<NAME>&avtar=<AVATAR_ID>&coins=<COINS>&diamonds=<DIAMONDS>&percentage=<SHEET_HEIGHT>&callbackUrl=<CALLBACK_URL>
```

### Complete Live Example:
```text
http://192.168.1.187:3000/?userId=9002&username=RahulVerma&avtar=avatar_queen&coins=12500000&diamonds=890&percentage=75&callbackUrl=https://your-main-app.com/api/coins-webhook
```

---

## 2. URL Parameters Reference

| Parameter | Aliases | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `userId` | `user_id`, `uid`, `id` | **Yes** | Your main app's unique user ID (alphanumeric or integer). Persisted in MySQL as `app_user_id`. | `userId=9002` |
| `username` | `name`, `user` | Optional | Player display name shown in header, rankings, and win ticker. | `username=RahulVerma` |
| `avtar` | `avatar` | Optional | Avatar ID or image filename (e.g. `avatar_queen`, `avatar_king`, `avatar1` to `avatar12`). | `avtar=avatar_queen` |
| `coins` | `coin`, `balance` | Optional | Starting coins balance credited from your app wallet. Default is `10,000,000`. | `coins=12500000` |
| `diamonds` | `diamond` | Optional | Player diamonds balance shown in top header. Default is `0`. | `diamonds=890` |
| `percentage` | `percent`, `height`, `h`, `sheet` | Optional | Sets viewport height for BottomSheet (`60`, `70`, `75`, `80`, `100`). Scales elements cleanly without cutoffs. | `percentage=75` |
| `callbackUrl` | `callback`, `webhook` | Optional | Your main server webhook URL. Receives HTTP POST every time coins change or a round completes. | `callbackUrl=https://api.myapp.com/coins` |

> [!NOTE]
> All parameters are automatically cached in `localStorage`. If the user loses network or refreshes the WebView, credentials and balances are preserved.

---

## 3. Ready-to-Use URL Examples

### A. Real Mobile Devices (Over Wi-Fi / Local Network)
```text
http://192.168.1.187:3000/?userId=9002&username=RahulVerma&avtar=avatar_queen&coins=12500000&diamonds=890&callbackUrl=https://your-main-app.com/api/coins-webhook
```

### B. With 75% BottomSheet Mode
```text
http://192.168.1.187:3000/?percentage=75&userId=9002&username=RahulVerma&avtar=avatar_queen&coins=12500000&diamonds=890&callbackUrl=https://your-main-app.com/api/coins-webhook
```

### C. Android Studio Emulator
*(Android emulators use `10.0.2.2` to access host machine localhost)*
```text
http://10.0.2.2:3000/?userId=9002&username=RahulVerma&avtar=avatar_queen&coins=12500000&diamonds=890&callbackUrl=https://your-main-app.com/api/coins-webhook
```

### D. Local Browser / Desktop Testing
```text
http://localhost:3000/?userId=9002&username=RahulVerma&avtar=avatar_queen&coins=12500000&diamonds=890&callbackUrl=http://localhost:3000/api/callback/test
```

---

## 4. BottomSheet Height & Responsiveness

When opening the game inside a native bottom sheet at different heights, pass `percentage`:

- `percentage=100` (or omitted): Full screen mode with phone bezel preview on desktop.
- `percentage=80`: 80% screen height bottom sheet.
- `percentage=75`: 75% screen height bottom sheet.
- `percentage=60`: 60% compact bottom sheet.

### Dynamic Viewport Behavior:
1. **Top Rounded Corners**: Automatically displays a 20px rounded corner sheet style with a gray drag indicator handle (`sheetDragHandle`).
2. **Auto-Scaled Ferris Wheel**: A `ResizeObserver` monitors available height and automatically scales the Ferris wheel down (from `1.0x` down to `0.55x`), ensuring the header, wheel, chips, and footer are **never cut off**.
3. **No Bottom Gap**: Negative space between chips and footer is dynamically absorbed to ensure visual balance.

---

## 5. Coin Balance Updates & Webhook Callback

### How It Works:
When the user places a bet or the wheel spin finishes with round payouts, the Greedy Game Server sends an HTTP POST request to your `callbackUrl`.

### Webhook JSON Payload:
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

### Events Dispatched:
- `ROUND_RESULT`: Fired when wheel stops and winnings are credited. `newCoins` is the post-round balance, `delta` is net profit (positive or negative).
- `BET_PLACED`: Fired when user places chips on a food item or combo dish. `delta` is negative (deduction).

### Database Update Query in Your Main App Backend:
```sql
UPDATE users 
SET coins = :newCoins, 
    diamonds = diamonds + :diamondsEarned 
WHERE id = :userId;
```

#### Node.js / Express Example:
```javascript
app.post('/api/coins-webhook', async (req, res) => {
    const { userId, newCoins, delta, event, roundNumber } = req.body;
    console.log(`[Webhook] User ${userId} updated coins: ${newCoins} (delta: ${delta})`);

    await db.query('UPDATE users SET coins = ? WHERE id = ?', [newCoins, userId]);
    res.json({ success: true });
});
```

#### PHP / Laravel Example:
```php
public function handleCoinsWebhook(Request $request) {
    $userId   = $request->input('userId');
    $newCoins = $request->input('newCoins');
    
    DB::table('users')->where('id', $userId)->update(['coins' => $newCoins]);
    return response()->json(['success' => true]);
}
```

---

## 6. Mobile App WebView Code Samples

### A. Android Native (Kotlin)
```kotlin
val webView = findViewById<WebView>(R.id.gameWebView)
webView.settings.javaScriptEnabled = true
webView.settings.domStorageEnabled = true

// Native Bridge for immediate updates:
webView.addJavascriptInterface(object {
    @JavascriptInterface
    fun onCoinsUpdate(jsonStr: String) {
        val data = JSONObject(jsonStr)
        val newCoins = data.getLong("coins")
        runOnUiThread {
            myUserViewModel.updateCoins(newCoins)
        }
    }

    @JavascriptInterface
    fun closeGame(jsonStr: String?) {
        runOnUiThread {
            // Dismiss BottomSheetDialog
            bottomSheetDialog.dismiss()
        }
    }
}, "AndroidBridge")

webView.loadUrl("http://192.168.1.187:3000/?userId=9002&username=RahulVerma&avtar=avatar_queen&coins=12500000&diamonds=890&percentage=75&callbackUrl=https://your-main-app.com/api/coins-webhook")
```

### B. Flutter (`flutter_inappwebview`)
```dart
InAppWebView(
  initialUrlRequest: URLRequest(
    url: WebUri("http://192.168.1.187:3000/?userId=9002&username=RahulVerma&avtar=avatar_queen&coins=12500000&diamonds=890&percentage=75&callbackUrl=https://your-main-app.com/api/coins-webhook"),
  ),
  initialSettings: InAppWebViewSettings(
    javaScriptEnabled: true,
    domStorageEnabled: true,
    transparentBackground: true,
  ),
  onWebViewCreated: (controller) {
    // 1. Coin balance update handler
    controller.addJavaScriptHandler(
      handlerName: 'onCoinsUpdate',
      callback: (args) {
        final data = args[0];
        final int newCoins = data['coins'];
        userProvider.setCoins(newCoins);
      },
    );

    // 2. Close bottomSheet handler
    controller.addJavaScriptHandler(
      handlerName: 'closeGame',
      callback: (args) {
        Navigator.pop(context);
      },
    );
  },
)
```

### C. React Native (`react-native-webview`)
```jsx
import React from 'react';
import { WebView } from 'react-native-webview';

export default function GameBottomSheet({ onClose, onUpdateCoins }) {
  const gameUrl = 'http://192.168.1.187:3000/?userId=9002&username=RahulVerma&avtar=avatar_queen&coins=12500000&diamonds=890&percentage=75&callbackUrl=https://your-main-app.com/api/coins-webhook';

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'COINS_UPDATE') {
        onUpdateCoins(data.coins);
      } else if (data.type === 'CLOSE_GAME') {
        onClose();
      }
    } catch (e) {
      console.warn('Bridge parse error', e);
    }
  };

  return (
    <WebView
      source={{ uri: gameUrl }}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      onMessage={handleMessage}
    />
  );
}
```

---

## 7. Closing the BottomSheet (Exit Bridge)

When the user taps the top-left **Home Button** (`#homeBtn`) or pulls down the **Top Drag Handle** (`#sheetDragHandle`), the game emits:

1. **React Native**: `window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CLOSE_GAME', action: 'close', userId, coins }))`
2. **Flutter**: `window.flutter_inappwebview.callHandler('closeGame', { action: 'close', userId, coins })`
3. **Android Native**: `window.AndroidBridge.closeGame(jsonPayload)`
4. **iOS WebKit**: `window.webkit.messageHandlers.closeGame.postMessage(jsonPayload)`
5. **Parent Window / iframe**: `window.parent.postMessage({ type: 'CLOSE_GAME', action: 'close', userId, coins }, '*')`

Your app listens to this event and simply dismisses the BottomSheet dialog.
