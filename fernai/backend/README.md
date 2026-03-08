# Fern AI Backend

API for the Fern AI hospital bill auditor: parses bills (image/PDF) with Groq vision ([Llama 4 Scout](https://console.groq.com/docs/vision)), validates CPT codes via RAG, flags overcharges, and generates dispute letters.

## Setup

1. **Create a virtualenv and install dependencies** (from repo root or `fernai`):

   ```bash
   cd fernai
   python -m venv .venv
   source .venv/bin/activate   # or .venv\Scripts\activate on Windows
   pip install -r backend/requirements.txt
   ```

2. **Set your Groq API key**

   Copy `backend/.env.example` to `backend/.env` and set:

   ```env
   GROQ_API_KEY=your_key_here
   ```

   Get a key at [Groq Console](https://console.groq.com).

3. **Run the server**

   From the `fernai` directory (so `fernai.backend` is importable):

   ```bash
   cd fernai
   uvicorn fernai.backend.main:app --host 0.0.0.0 --port 8000 --reload
   ```

   Or: `python -m fernai.backend.main` (same port).

The first time you call `POST /analyze`, the CPT RAG index is built from `backend/data/cpt_codes.csv` (lazy). Subsequent requests use the existing index.

## Endpoints

- **GET /health** — Returns `{"status": "ok"}`.
- **POST /analyze** — Body: `{ "image_base64": "<base64>", "file_type": "image" | "pdf" }`. Returns extracted bill, dispute letter, and agent statuses.

## Mobile app

In `fernai-mobile`, set `EXPO_PUBLIC_API_BASE_URL` in `.env` to your computer’s LAN IP and port, e.g. `http://192.168.1.5:8000`, when using Expo Go on a real device.
