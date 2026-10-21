# 🚀 Hostinger Deployment Guide — Greedy Real-Time Game

This guide provides step-by-step instructions for deploying both the **Frontend** and **Backend** of the **Greedy Multiplayer Game** to **Hostinger**.

---

## 📋 Recommended Hosting Type

Because **Greedy** relies on persistent, low-latency **WebSockets (Socket.IO)** for real-time multiplayer spins and bets:

- **Hostinger VPS (Ubuntu 22.04 or 24.04)** is **Strongly Recommended** ($5.99/mo). It gives full root access, zero WebSocket connection limits, automatic PM2 process restarts, and free SSL.
- **Hostinger Cloud / Shared Hosting (hPanel Node.js)** can also be used if your plan supports the Node.js application manager.

---

# 🟢 Method 1: Hostinger VPS Deployment (Recommended)

### Step 1: Connect to Your VPS via SSH
Open your terminal (Mac / Linux) or PuTTY (Windows) and connect:
```bash
ssh root@<YOUR_VPS_IP>
```

---

### Step 2: Install Node.js, Git, and PM2
Update the server and install Node.js (v20 LTS) and PM2 process manager:
```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Node.js v20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx mysql-server

# Verify installation
node -v   # Should show v20.x
npm -v

# Install PM2 globally to keep the server running 24/7
sudo npm install -g pm2
```

---

### Step 3: Setup MySQL Database on VPS
```bash
# Secure MySQL installation
sudo mysql_secure_installation

# Open MySQL prompt
sudo mysql -u root -p
```
Inside MySQL, run:
```sql
CREATE DATABASE greedy_game_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'greedy_user'@'localhost' IDENTIFIED BY 'YourStrongPassword123!';
GRANT ALL PRIVILEGES ON greedy_game_db.* TO 'greedy_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

### Step 4: Upload Your Project Code to VPS
You can upload the project using Git or SFTP:

#### Option A: Using Git (Easiest)
```bash
cd /var/www
git clone <YOUR_GIT_REPO_URL> greedy
cd greedy
```

#### Option B: Using SCP / FileZilla (SFTP)
From your local Mac terminal:
```bash
scp -r "/Users/vxlm2/Documents/untitled folder/greedy" root@<YOUR_VPS_IP>:/var/www/greedy
```

---

### Step 5: Install Dependencies & Configure `.env`
On your VPS terminal:
```bash
cd /var/www/greedy/backend
npm install --production

# Create / edit production .env
nano .env
```
Paste your production configuration:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=greedy_user
DB_PASSWORD=YourStrongPassword123!
DB_NAME=greedy_game_db
```
Press `Ctrl + O` then `Enter` to save, and `Ctrl + X` to exit.

Import the database tables:
```bash
mysql -u greedy_user -p greedy_game_db < /var/www/greedy/backend/database/schema.sql
```

---

### Step 6: Start Game Server with PM2
```bash
cd /var/www/greedy
pm2 start backend/server.js --name "greedy-game"

# Enable auto-restart on VPS reboot
pm2 startup
pm2 save
```

Verify it is running:
```bash
pm2 status
curl http://localhost:3000/api/health
# Should return {"status":"ok", ...}
```

---

### Step 7: Configure Nginx as Reverse Proxy (With WebSocket Support)
Create an Nginx configuration for your domain or IP:
```bash
sudo nano /etc/nginx/sites-available/greedy
```

Paste the following configuration (replace `yourdomain.com` with your actual domain or VPS IP):

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com; # Or your VPS IP

    # Game Backend API & Static Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        
        # Essential WebSocket Upgrade Headers:
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Explicit Socket.IO WebSocket Route
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

Enable the site and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/greedy /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

### Step 8: Install Free SSL Certificate (HTTPS & WSS)
To run securely in production inside mobile WebViews, install free SSL using Certbot:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```
Certbot will automatically configure HTTPS and auto-renewals!

---

# 🟡 Method 2: Hostinger Shared / Cloud Hosting (hPanel)

If you are using Hostinger's **Cloud Startup / Business Web Hosting** with the hPanel Node.js feature:

### Step 1: Create MySQL Database in hPanel
1. Log in to **Hostinger hPanel**.
2. Go to **Databases** -> **MySQL Databases**.
3. Create a new database:
   - Database Name: `u123456_greedy`
   - Username: `u123456_greedyuser`
   - Password: `YourStrongPassword!`
4. Open **phpMyAdmin** from hPanel and import `backend/database/greedy_game_db.sql`.

---

### Step 2: Upload Files via File Manager or Git
1. In hPanel, go to **Files** -> **File Manager** (or use **Git**).
2. Upload the entire `greedy` project folder to `public_html` or a subfolder like `public_html/greedy`.

---

### Step 3: Setup Node.js in hPanel
1. In hPanel, search for **Node.js** in the left sidebar.
2. Click **Create Application**:
   - **Node.js version**: Choose `20.x` (or `18.x`).
   - **Application root**: `public_html/greedy` (or folder where code is uploaded).
   - **Application startup file**: `backend/server.js`.
   - **Application URL**: `yourdomain.com` (or subdomain `game.yourdomain.com`).
3. Click **Create**.

---

### Step 4: Configure Environment Variables
In the Node.js application management screen in hPanel:
1. Add Environment Variables:
   - `PORT`: `3000` (or leave default assigned by Hostinger)
   - `DB_HOST`: `localhost`
   - `DB_USER`: `u123456_greedyuser`
   - `DB_PASSWORD`: `YourStrongPassword!`
   - `DB_NAME`: `u123456_greedy`
2. Run **`npm install`** via the hPanel console or SSH terminal.
3. Click **Start / Restart Application**.

---

## 🎯 Verification & Testing

Once deployed, test your live server:

1. **Health Check API**:
   ```bash
   curl https://yourdomain.com/api/health
   # Returns: {"status":"ok","serverTime":"..."}
   ```

2. **Open in Browser / Mobile BottomSheet**:
   ```text
   https://yourdomain.com/?userId=9002&username=RahulVerma&avtar=avatar_queen&coins=12500000&diamonds=890&percentage=75&callbackUrl=https://your-main-app.com/api/coins-webhook
   ```

---

## 🔄 Useful Maintenance Commands (VPS)

| Command | Purpose |
| :--- | :--- |
| `pm2 status` | Check if game server is online |
| `pm2 logs greedy-game` | View real-time live game server logs |
| `pm2 restart greedy-game` | Restart game server after code updates |
| `sudo systemctl restart nginx` | Reload web server configuration |
| `sudo systemctl status mysql` | Check MySQL database health |
