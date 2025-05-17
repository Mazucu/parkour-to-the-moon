/**
 * Returns a function you call after each task completes.
 * It will log every `interval` calls, and also on the final one.
 *
 * @param label    Text to describe what you’re counting (“created”, “deleted”, etc.)
 * @param total    Total number of tasks
 * @param interval How often to print (e.g. 10 → every 10 items)
 */
export function createProgressLogger(
  label: string,
  total: number,
  interval = 10
): () => void {
  let count = 0;
  return () => {
    count++;
    if (count % interval === 0 || count === total) {
      const pct = Math.round((count / total) * 100);
      console.log(`🪐 ${label}: ${count}/${total} (${pct}%)`);
    }
  };
}
