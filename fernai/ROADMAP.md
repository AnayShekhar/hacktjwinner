# Fern AI — Problems, Fixes & Feature Roadmap

This doc lists **problems**, **what to do to fix them**, and **features that can be implemented in code** (by you or with AI assistance).

---

## 1. Problems

### 1.1 Security & config

| Problem | Where | Severity |
|--------|--------|----------|
| **`.env` is not ignored** | `.gitignore` only has `.env*.local`, so `.env` (with `EXPO_PUBLIC_API_BASE_URL` and possibly secrets) can be committed. | High |
| **CORS allows all origins** | `backend/main.py`: `allow_origins=["*"]` is fine for dev but unsafe for production. | Medium |
| **No request size limit** | `AnalyzeRequest.image_base64` has no max length; huge payloads can DoS the server or blow memory. | Medium |
| **No API key / auth** | `/analyze` is open; anyone who can reach the backend can use it. | Medium (for production) |

### 1.2 Backend

| Problem | Where | Severity |
|--------|--------|----------|
| **No error handling in pipeline** | `main.py`: if parser, validator, auditor, or letter_gen raises, the whole request returns 500 with no structured error or agent status. | High |
| **Parser ignores input** | `parser.py` always returns dummy data; real image/PDF is never used. | High (product) |
| **Validator is a no-op** | `validator.py` does nothing; RAG/CPT validation not wired. | High (product) |
| **Price auditor mutates Pydantic models in place** | `price_auditor.py` mutates `bill.line_items` and `bill.total_recoverable`; can cause subtle bugs and makes reasoning about state harder. | Low |
| **No file_type validation** | Backend accepts any string for `file_type`; only "image" and "pdf" are meaningful. | Low |
| **No timeout for /analyze** | Long-running pipeline can hang clients; no explicit timeout. | Medium |

### 1.3 Mobile app

| Problem | Where | Severity |
|--------|--------|----------|
| **Letter passed via URL params** | `analysis.tsx` → `router.push({ pathname: '/letter', params: { letter } })`. Long letters can hit URL length limits and break deep linking. | High |
| **API base URL fallback wrong on iOS** | Fallback is `http://10.0.2.2:8000` (Android emulator). On iOS simulator it should be `http://localhost:8000`; on real device, user must set `.env`. | Medium |
| **No loading state when opening camera/picker** | After tapping Scan or Upload, there’s no spinner; user might tap again. | Low |
| **No retry on analysis failure** | On error, user can only “Go Back”; no “Try again” with same file. | Medium |
| **Explore tab is template content** | `explore.tsx` still shows Expo template text, not Fern AI–specific content. | Low |
| **No share/copy for dispute letter** | Letter screen has no “Share” or “Copy to clipboard”; users can’t easily send it. | Medium |
| **Possible duplicate analysis** | `useEffect` runs on mount; if `uri`/`fileType` change (e.g. back then forward), analysis runs again. May be intentional but worth being aware of. | Low |

### 1.4 Data & validation

| Problem | Where | Severity |
|--------|--------|----------|
| **No response validation on client** | `analysis.tsx` casts `json.bill` and `json.agents`; malformed backend response can crash or render wrong. | Medium |
| **Backend doesn’t validate line_items non-empty** | Empty `line_items` can produce a weird letter and UI. | Low |
| **total_billed not enforced** | Backend never checks that `sum(item.billed_price)` matches `total_billed`. | Low |

---

## 2. What to do to fix them

### 2.1 Do first (quick wins)

1. **Ignore `.env`**  
   Add `.env` to `fernai-mobile/.gitignore` (keep using `.env.example` for docs). If `.env` was already committed, remove it from history and rotate any secrets.

2. **Don’t pass letter in URL**  
   Store the letter in React state/context or a small in-memory store (e.g. a module-level variable or context), and pass only an id or nothing to the letter screen. Letter screen reads from that store. This avoids URL length limits and keeps sensitive text out of navigation.

3. **Add backend error handling**  
   Wrap the pipeline in `try/except`; on failure set the current agent’s status to `"failed"` and return a 422 or 500 with a clear message and `agents` array so the app can show “Parser failed” instead of a generic error.

4. **Validate `file_type`**  
   In `AnalyzeRequest`, restrict `file_type` to `Literal["image", "pdf"]` (e.g. with Pydantic) and return 422 for invalid values.

5. **Add “Try again” on analysis screen**  
   In the error state, add a button that re-runs the same `uri`/`fileType` through the analysis (same `useEffect` logic) so users don’t have to go back and re-scan.

### 2.2 Next (important)

6. **Request size limit**  
   In FastAPI, add a max body size (e.g. 10–20 MB) or validate `len(image_base64)` (after base64 decode) and reject with 413 if too large.

7. **API base URL by platform**  
   In the app, set default `API_BASE_URL` by platform: e.g. `localhost:8000` for iOS simulator, `10.0.2.2:8000` for Android emulator, and `EXPO_PUBLIC_API_BASE_URL` for real device (from `.env`). Document in README.

8. **Share / copy letter**  
   On the letter screen, add “Share” (Expo Sharing API or share sheet) and “Copy to clipboard” so users can send the letter to their provider or email.

9. **Optional: timeouts**  
   Backend: set a reasonable timeout for the `/analyze` handler or for each agent. Mobile: set `AbortController` + `signal` on `fetch` with a timeout (e.g. 60–120 s) and show a “Request timed out” error.

### 2.3 Later (product & scale)

10. **Real parser**  
    Use `parsers/image_parser.py` to decode base64, then call Gemini Vision (or similar) with a structured prompt to extract patient, provider, date, and line items (CPT, description, price) into `BillJSON`. Replace dummy in `parser.py`.

11. **Wire RAG into validator and auditor**  
    Validator: use `rag/retriever.retrieve_cpt_matches()` to validate CPT codes and descriptions; set `flagged`/`flag_reason` when invalid or mismatched. Auditor: use RAG to fill `cms_price` where missing, then run existing 20% rule; optionally use `ml/anomaly.score_bill_anomalies()` to flag outliers.

12. **Tighten CORS**  
    For production, set `allow_origins` to your app’s origin(s) (e.g. expo deep link scheme or web URL).

13. **Auth / API key**  
    If you expose the backend, add an API key header or auth and check it in a FastAPI dependency; reject 401 when missing or invalid.

---

## 3. Features you can add (that can be coded)

These are concrete features that can be implemented in the repo.

### 3.1 Fixes (implementable now)

| # | Feature | Where | What to do |
|---|--------|--------|------------|
| A | Add `.env` to `.gitignore` | `fernai-mobile/.gitignore` | Add line `.env` (and keep `.env.example` documented). |
| B | Store letter in memory, not URL params | `analysis.tsx`, `letter.tsx`, optional small store | Create a simple store (e.g. `stores/letterStore.ts` with `letter: string \| null` and set/read). After analysis, set store and navigate to `/letter` with no letter param. Letter screen reads from store. |
| C | Backend try/except and agent failure status | `backend/main.py` | Wrap each agent call in try/except; on exception set that agent’s status to `"failed"`, set `detail` to error message, and either return 200 with partial data or 422/500 with message and `agents` list. |
| D | Validate `file_type` | `backend/schemas.py` | Use `Literal["image", "pdf"]` for `file_type` (and optionally a validator that lowercases). Return 422 for invalid. |
| E | “Try again” button on analysis error | `fernai-mobile/app/analysis.tsx` | In error UI, add a button that calls the same analysis logic again (e.g. extract `runAnalysis` and call it on press). |
| F | Request body size limit | `backend/main.py` | Use a custom middleware or FastAPI body limit to reject requests with body larger than e.g. 15 MB. |
| G | Platform-specific API base URL | `fernai-mobile` (e.g. `constants/api.ts`) | Use `expo-constants` / `Platform` to choose default: iOS simulator `localhost:8000`, Android emulator `10.0.2.2:8000`, else `process.env.EXPO_PUBLIC_API_BASE_URL`. |
| H | Share and copy letter | `fernai-mobile/app/letter.tsx` | Add “Share” (e.g. `expo-sharing` or React Native Share API) and “Copy” (expo-clipboard or RN Clipboard) so users can share or copy the letter text. |

### 3.2 New features (implementable)

| # | Feature | Where | What to do |
|---|--------|--------|------------|
| I | Replace Explore with “About” or “History” | `fernai-mobile/app/(tabs)/explore.tsx` | Rename tab to “About” or “History”. About: app name, short description, link to privacy/terms if any. History: list of past analyses (requires persisting results in AsyncStorage or similar). |
| J | Loading indicator for Scan/Upload | `fernai-mobile/app/(tabs)/index.tsx` | Add `uploadingOrScanning` state; set true when opening camera/picker, false when done or cancelled. Disable buttons and show a small spinner or “Opening…” while true. |
| K | Empty state for zero line items | `fernai-mobile/app/analysis.tsx` | If `bill.line_items.length === 0`, show a message like “No line items found on this bill” and still show total recoverable and letter button if letter exists. |
| L | Basic response validation on client | `fernai-mobile/app/analysis.tsx` | Check that `json.bill`, `json.bill.line_items` (array), `json.letter` (string), `json.agents` (array) exist and have expected shape before setState; otherwise set a “Invalid response” error. |
| M | Parser: use image_parser + Gemini Vision | `backend/agents/parser.py`, `backend/parsers/image_parser.py` | Decode base64 with `image_parser.decode_base64_content`; for image send to Gemini Vision with a prompt that returns structured JSON (patient, provider, date, line_items with cpt_code, description, billed_price). Map to `BillJSON`. Handle PDF (e.g. first page as image or use a PDF→image step). |
| N | Validator: use RAG | `backend/agents/validator.py`, `backend/rag/retriever.py` | For each line item call `retrieve_cpt_matches(item.description)` or `item.cpt_code`; if no good match or code not in DB, set `flagged=True` and `flag_reason`. Ensure ChromaDB is populated via `ingest_cpt_data` (script or startup). |
| O | Auditor: use RAG for CMS price + optional anomaly | `backend/agents/price_auditor.py` | For items missing `cms_price`, query RAG for that CPT and get CMS rate; fill `cms_price`. Then run existing 20% overcharge logic. Optionally call `score_bill_anomalies(bill)` and flag items with very low anomaly score. |
| P | Letter gen: use Gemini | `backend/agents/letter_gen.py` | Send final `BillJSON` to Gemini with a prompt to draft a formal dispute letter; replace the template with the model output. |

### 3.3 Nice-to-have

| # | Feature | What to do |
|---|--------|------------|
| Q | Dark mode for Home/Analysis/Letter | Use theme from `constants/theme.ts` or existing color scheme; apply to Home, Analysis, and Letter screens so they respect system dark mode. |
| R | Pull-to-refresh on analysis | On analysis screen, add pull-to-refresh to re-run analysis with same `uri`/`fileType`. |
| S | Backend health check from app | On app launch or settings, call `GET /health`; if it fails, show “Cannot reach server” and suggest checking URL and network. |
| T | Simple history (list of past bills) | Persist each analysis result (e.g. `{ id, date, provider, totalRecoverable, letter }`) in AsyncStorage; show list on Explore/History tab; tap opens letter or a summary view. |

---

## 4. Priority summary

- **Fix first:** A (gitignore), B (letter not in URL), C (backend errors), D (file_type), E (try again).
- **Then:** G (API URL), H (share/copy), F (size limit), L (client validation), K (empty state), J (loading for scan/upload).
- **Product:** M (real parser), N (validator RAG), O (auditor RAG), P (Gemini letter).
- **Polish:** I (Explore → About/History), Q (dark mode), R (pull-to-refresh), S (health check), T (history).

Use this doc as a checklist; you can implement items in the “Features you can add” section yourself or ask to have them implemented in code (e.g. “implement A, B, and C from ROADMAP”).
