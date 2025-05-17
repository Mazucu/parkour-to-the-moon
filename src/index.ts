import { MegaverseApiClient } from "./api/MegaverseApiClient";
import { MegaverseBuilder } from "./orchestrator/MegaverseBuilder";

export async function main(): Promise<void> {
  // Get candidate ID from either environment variable, command line arg, or default
  const candidateId =
    process.env.CANDIDATE_ID ??
    (process.argv[2] ? process.argv[2] : "YOUR_CANDIDATE_ID_HERE");

  if (candidateId === "YOUR_CANDIDATE_ID_HERE") {
    console.error(
      "⚠ Please provide a valid candidate ID via CANDIDATE_ID env var or as first argument"
    );
    console.error("Example: node dist/index.js your-candidate-id");
    process.exit(1);
  }

  console.log(`🔑 Using candidate ID: ${candidateId}`);
  const client = new MegaverseApiClient(candidateId);
  const builder = new MegaverseBuilder(client);

  // Determine action from command line args
  const action = process.argv[3]?.toLowerCase() || "build";
  console.log(`🚀 Action: ${action}`);

  try {
    switch (action) {
      case "clean":
        console.log("🧹 Cleaning universe...");
        await builder.resetUniverseToBlue();
        break;

      case "build":
      default:
        console.log(
          "🔨 Building complete universe (Crossmint logo)..."
        );
        await builder.buildUniverse();
        break;
    }

    console.log("✅ Operation completed successfully");
  } catch (error) {
    console.error(
      "💥 Unhandled error in main():",
      (error as Error).message
    );
    process.exit(1);
  } finally {
    // Make sure to stop any timers
    builder.stopAdjusting();
  }
}

// Run if this is the main module (not imported)
if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
