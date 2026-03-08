# Fern AI — Hospital Bill Auditor

Mobile app: scan or upload a hospital bill (photo/PDF). Backend extracts line items with Groq vision, validates CPT codes via RAG, flags overcharges, and generates a dispute letter.

## Quick start

**Terminal 1 — Backend (must be running first):**
```bash
./run_backend.sh
```
Leave this running. You should see: `Starting backend at http://0.0.0.0:8000`

**Terminal 2 — Mobile app:**
```bash
./run_mobile.sh
```
Then press **i** (iOS simulator), **a** (Android emulator), or **w** (web). Scan or upload a bill to run the audit.

## First-time backend setup

- The script creates `fernai/.venv` and installs dependencies.
- It also creates `fernai/backend/.env` from `.env.example` if missing.
- **Add your Groq API key** so bill parsing works: edit `fernai/backend/.env` and set  
  `GROQ_API_KEY=your_key_here`  
  Get a key at: https://console.groq.com

## Physical device (Expo Go)

1. Ensure the backend is running on your computer (`./run_backend.sh`).
2. In `fernai/fernai-mobile/.env`, set your computer’s LAN IP and port:
   ```env
   EXPO_PUBLIC_API_BASE_URL=http://YOUR_IP:8000
   ```
   (e.g. `http://192.168.1.5:8000`). Find your IP: Mac → System Settings → Network → Wi‑Fi → Details, or `ipconfig getifaddr en0`.
3. Restart Expo (`./run_mobile.sh`), then scan the QR code with Expo Go.

## Project layout

- `fernai/backend/` — FastAPI server (parser, validator, price auditor, letter gen)
- `fernai/fernai-mobile/` — Expo (React Native) app
- `fernai/run_backend.py` — Backend entry point (correct Python path)
- `run_backend.sh` — Run backend (venv + deps + server)
- `run_mobile.sh` — Run mobile app (nvm + npm + Expo)
