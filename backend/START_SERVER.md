# 🚀 How to Start Backend Server

## Quick Start

```bash
cd backend
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

---

## Troubleshooting

### Error: "Unable to connect to the remote server"

**Cause:** Backend server is not running.

**Solution:**
1. Open a new terminal
2. Navigate to backend folder:
   ```bash
   cd backend
   ```
3. Start the server:
   ```bash
   npm start
   ```

---

## Expected Output

When server starts successfully, you should see:

```
🚀 Server running on port 3000
📡 Socket.io server ready
💾 Cache middleware enabled
🛡️  Rate limiting enabled
🗜️  Compression enabled (threshold: 1024 bytes)
🌍 CORS enabled for: http://localhost:5173,...
📊 Environment: development

🔍 Initializing Upstash Redis...
✅ Upstash Redis initialized

🔍 Checking database connections...
✅ Database connections: 3/3 healthy

✅ Upstash Redis connected (latency: XXms)
🔄 Snapshot engine started
```

---

## Verify Server is Running

### Option 1: Check Port
```bash
netstat -ano | findstr :3000
```

### Option 2: Test Endpoint
```bash
curl http://localhost:3000/health
```

Or in PowerShell:
```powershell
Invoke-WebRequest -Uri http://localhost:3000/health
```

### Option 3: Check Metrics
```bash
curl http://localhost:3000/api/utils/metrics
```

---

## Common Issues

### Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3000`

**Solution:**
1. Find process using port 3000:
   ```bash
   netstat -ano | findstr :3000
   ```
2. Kill the process:
   ```bash
   taskkill /PID <process_id> /F
   ```
3. Or change port in `.env`:
   ```env
   PORT=3001
   ```

### Missing Dependencies

**Error:** `Cannot find module '@upstash/redis'`

**Solution:**
```bash
cd backend
npm install
```

### Environment Variables Not Loaded

**Error:** `Upstash Redis not configured`

**Solution:**
1. Check `.env` file exists in `backend/` folder
2. Verify credentials are set:
   ```env
   UPSTASH_REDIS_REST_URL=https://oriented-sunfish-20537.upstash.io
   UPSTASH_REDIS_REST_TOKEN=AVA5AAIncDJjOTcyMTEyNDVjYzU0YTgzOWRmMzEyMTZjNThhZGZmNnAyMjA1Mzc
   ```

---

## Running in Background (Windows)

### Option 1: Start-Job
```powershell
cd backend
Start-Job -ScriptBlock { npm start }
```

### Option 2: Start Process
```powershell
cd backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm start"
```

---

## Running in Background (Linux/Mac)

```bash
cd backend
nohup npm start > server.log 2>&1 &
```

---

*Server should be running on http://localhost:3000*

