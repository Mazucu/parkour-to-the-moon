/**
 * Creates a function to track and display progress
 *
 * @param label    What you're tracking ("created", "deleted", etc.)
 * @param total    Total number of items to process
 * @param interval How often to log progress (e.g. 10 = every 10 items)
 * @returns        A function to call after each item is processed
 */
export function createProgressLogger(
  label: string,
  total: number,
  interval = 10
): () => void {
  let count = 0;

  return () => {
    count++;
    // Log progress at intervals or when complete
    if (count % interval === 0 || count === total) {
      const percent = Math.round((count / total) * 100);
      console.log(`🚀 ${label}: ${count}/${total} (${percent}%)`);
    }
  };
}
