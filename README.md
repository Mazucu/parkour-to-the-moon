# Crossmint Megaverse Challenge – Solution by Ramón Sánchez Hevia 🚀

Hello! I’m **Ramón Sánchez Hevia**, and this repository contains **my** independent solution to the **Crossmint Megaverse** challenge. The goal is to build—and, when necessary, clean—the Crossmint universe while staying comfortably within the API’s rate limits.

---

## Highlights

- ⚖️ **Smart Rate Limiting** – Adjusts request frequency in real time based on API feedback.
- 📦 **Batch Processing** – Breaks large workloads into manageable batches.
- 🔄 **Robust Retry Strategy** – Uses exponential backoff and honours `Retry‑After` headers.
- ⏱️ **Adaptive Concurrency** – Scales the number of parallel requests according to latency and error rates.

---

## Quick Start

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Build the project**

   ```bash
   npm run build
   ```

3. **Run with your Candidate ID**

   ```bash
   # Build the Crossmint logo universe
   node dist/index.js <YOUR_CANDIDATE_ID> build

   # Clean the universe
   node dist/index.js <YOUR_CANDIDATE_ID> clean
   ```

---

## Tests

Run once:

```bash
npm test
```

Watch mode:

```bash
npm run test:watch
```

The test suite covers:

- Rate‑limiting behaviour
- Retry logic and backoff
- API client correctness
- Universe construction and cleaning
- CLI parsing

---

## Internal Design

### Rate Limiting

- **Token Bucket** – Controls the sustained request rate.
- **Dynamic Speed Control** – Slows down automatically when 429 responses appear.
- **Adaptive Concurrency** – Adjusts parallelism based on observed conditions.

### Batch Processing

- Processes up to 20 operations at a time.
- Inserts pauses between batches.
- Reduces speed if rate limits get close.

### Retry Logic

- Exponential backoff with jitter.
- Respects `Retry‑After` headers when provided.

---

## Project Structure

- `api/` – API client
- `orchestrator/` – Logic for building and cleaning the universe
- `utils/` – Rate‑limiter, retry helpers, progress tracking
- `tests/` – Unit tests

---

## Useful Commands

| Command               | Description                             |
| --------------------- | --------------------------------------- |
| `npm run build`       | Compile the TypeScript project          |
| `npm start`           | Compile and run (default action: build) |
| `npm run start:build` | Build the universe                      |
| `npm run start:clean` | Clean the universe                      |
| `npm test`            | Run the test suite once                 |
| `npm run test:watch`  | Run tests in watch mode                 |

---

## License

MIT. If you end up building something interesting with this code, I’d be glad to hear about it.
