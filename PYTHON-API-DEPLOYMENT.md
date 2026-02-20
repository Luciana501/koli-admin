# Python API Deployment Guide (For Vercel Admin Panel)

## ⚠️ Problem
Your admin panel is deployed on Vercel, but the Python KYC validation API is running on `localhost` (your computer). When you access the Vercel site from another device, it can't connect to your local API.

## ✅ Solution
Deploy the Python API to a cloud platform, then configure Vercel to use that URL.

---

## Option 1: Deploy to Render.com (Recommended - Free Tier)

### Step 1: Create Render Account
1. Go to https://render.com
2. Sign up with GitHub

### Step 2: Create Web Service
1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository (koli-admin)
3. Configure the service:
   - **Name**: `koli-kyc-api`
   - **Region**: Choose closest to your users
   - **Root Directory**: `app`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Step 3: Add Environment Variables (Render)
```
CORS_ORIGINS=https://your-admin-site.vercel.app,http://localhost:5173
```

### Step 4: Deploy
- Click **"Create Web Service"**
- Wait 5-10 minutes for first deployment
- Copy your API URL (e.g., `https://koli-kyc-api.onrender.com`)

### Step 5: Configure Vercel Environment Variable
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add new variable:
   - **Name**: `VITE_ID_VALIDATOR_API_URL`
   - **Value**: `https://koli-kyc-api.onrender.com` (your Render URL)
   - **Environment**: Production, Preview, Development (check all)
3. **Redeploy** your Vercel site for changes to take effect

---

## Option 2: Deploy to Railway.app (Easy Alternative)

### Step 1: Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub

### Step 2: Create New Project
1. Click **"New Project"** → **"Deploy from GitHub repo"**
2. Select your `koli-admin` repository
3. Click **"Add variables"**:
   - `PORT`: `8000`
   - `CORS_ORIGINS`: `https://your-admin-site.vercel.app`

### Step 3: Configure Build
1. Go to **Settings**
2. Set **Root Directory**: `app`
3. Set **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Step 4: Get URL & Configure Vercel
1. Copy the Railway URL (e.g., `https://koli-kyc-api.up.railway.app`)
2. Add to Vercel environment variables (same as Step 5 above)

---

## ⚠️ Important Notes

### Tesseract OCR Requirement
Your Python API uses **Tesseract OCR** which needs to be installed on the server. 

**For Render.com**, add this file:

**File: `app/render.yaml`**
```yaml
services:
  - type: web
    name: koli-kyc-api
    env: python
    rootDir: app
    buildCommand: |
      apt-get update
      apt-get install -y tesseract-ocr
      pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: CORS_ORIGINS
        value: https://your-admin-site.vercel.app
```

Or add a **Dockerfile**:

**File: `app/Dockerfile`**
```dockerfile
FROM python:3.11-slim

# Install Tesseract OCR
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Testing After Deployment

1. Visit: `https://your-api-url.onrender.com/docs`
2. You should see the FastAPI Swagger documentation
3. Test the `/validate-id` endpoint
4. Go to your Vercel admin panel
5. Try KYC validation - should now work!

---

## Free Tier Limitations

### Render.com Free Tier:
- ✅ Free forever
- ⚠️ Spins down after 15 minutes of inactivity (first request takes ~30 seconds to wake up)
- ✅ 750 hours/month (enough for most use cases)

### Railway.app Free Tier:
- ✅ $5 free credit/month
- ✅ No spin-down (stays active)
- ⚠️ Credit runs out faster if high traffic

---

## Quick Test (Local Network Only)

If you just want to test on your local network temporarily:

1. **Update `.env` file**:
   ```
   VITE_ID_VALIDATOR_API_URL=http://10.5.0.2:8000
   ```

2. **Restart your dev server**:
   ```bash
   npm run dev
   ```

3. **Access admin panel via IP**:
   - From other device: `http://10.5.0.2:5173`
   - (Both devices must be on same WiFi)

But this **won't work** for your Vercel deployment - you need cloud hosting for that.

---

## Recommended: Use Render.com

For your use case, I recommend **Render.com** because:
- ✅ Free tier
- ✅ Easy to set up with Docker (for Tesseract)
- ✅ Automatic deployments from GitHub
- ✅ Free SSL certificates
- ⚠️ Only downside: 30-second cold start after inactivity

Choose Railway if you need instant response times 24/7 and can afford ~$5/month.
