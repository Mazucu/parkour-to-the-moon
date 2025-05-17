# Crossmint Megaverse Challenge

An optimized solution for the Crossmint Megaverse challenge that handles API rate limits and prevents overwhelming the Crossmint API.

## Features

- 🔄 **Adaptive Concurrency** - Dynamically adjusts request rate based on API responsiveness
- 📦 **Batch Processing** - Intelligently groups tasks to avoid rate limiting
- ⏱️ **Token Bucket Rate Limiter** - Ensures requests don't exceed API limits
- 🔁 **Smart Retry Logic** - Uses response headers to optimize retry timing
- ✨ Optimized reset function that only deletes objects that exist
- 🧩 Clean architecture with separation of concerns
- 🧪 Comprehensive test coverage
- 🚀 Ready-to-use scripts for common operations

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build the project:

   ```bash
   npm run build
   ```

3. Run with your Candidate ID:

   ```bash
   # Build the Crossmint logo universe (Phase 2)
   node dist/index.js YOUR_CANDIDATE_ID build

   # Clean the universe (reset to empty)
   node dist/index.js YOUR_CANDIDATE_ID clean
   ```

## Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Build and run the project with default action (build)
- `npm test` - Run unit tests

## Architecture

- **api/** - API client for interacting with the Crossmint API
- **domain/** - Domain models and core business logic
- **orchestrator/** - High-level orchestration of operations
- **utils/** - Utility functions for concurrency and retries
- **test/** - Comprehensive test suite

## Implementation Details

### Improved Rate Limit Handling

The solution uses several techniques to effectively handle API rate limits:

1. **Token Bucket Rate Limiter**

   - Controls the flow of requests using a token-based approach
   - Automatically adjusts when rate limits are detected
   - Provides smooth request pacing instead of hard concurrency limits

2. **Batch Processing**

   - Divides large task sets into manageable batches
   - Adds delays between batches to avoid overwhelming the API
   - Adjusts batch sizes based on observed API responses

3. **Smart Retry Logic**

   - Parses API response headers to extract rate limit information
   - Uses the `Retry-After` header when available
   - Implements exponential backoff with jitter to prevent thundering herd problem

4. **Adaptive Concurrency**
   - Dynamically adjusts concurrency based on 429 responses
   - Reduces concurrency more aggressively when multiple rate limits are hit
   - Gradually increases concurrency when API is responsive

### Results

This implementation significantly reduces 429 errors by:

- Spacing out requests using token bucket rate limiting
- Processing tasks in smaller batches with delays between them
- Using smart backoff strategies based on API response headers
- Dynamically adjusting concurrency based on observed rate limit patterns

### Optimized Reset

The reset function has been optimized to:

1. Fetch the current universe map
2. Only delete objects that actually exist
3. Use adaptive concurrency based on API responses
4. Implement proper error handling
5. Log progress with clear messages

## License

MIT
