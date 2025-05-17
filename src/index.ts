import { MegaverseApiClient } from "./api/MegaverseApiClient";
import { MegaverseBuilder } from "./orchestrator/MegaverseBuilder";

export async function main(): Promise<void> {
  // Get candidate ID from environment or command line
  const candidateId =
    process.env.CANDIDATE_ID ??
    (process.argv[2] ? process.argv[2] : "YOUR_CANDIDATE_ID_HERE");

  if (candidateId === "YOUR_CANDIDATE_ID_HERE") {
    console.error("⚠ Please provide your candidate ID:");
    console.error(
      "- As environment variable: CANDIDATE_ID=your-id npm start"
    );
    console.error(
      "- Or as argument: node dist/index.js your-id [build|clean]"
    );
    process.exit(1);
  }

  console.log(`🔑 Using candidate ID: ${candidateId}`);

  // Create API client and builder
  const client = new MegaverseApiClient(candidateId);
  const builder = new MegaverseBuilder(client);

  // Determine what action to perform (build or clean)
  const action = process.argv[3]?.toLowerCase() || "build";
  console.log(`🚀 Action: ${action}`);

  try {
    switch (action) {
      case "clean":
        console.log("🧹 Cleaning universe...");
        await builder.cleanUniverse();
        break;

      case "build":
      default:
        console.log("🔨 Building Crossmint logo universe...");
        await builder.buildUniverse();
        break;
    }

    console.log("✅ Done!");
  } catch (error) {
    console.error("💥 Error:", (error as Error).message);
    process.exit(1);
  } finally {
    // Always clean up by stopping the concurrency timer
    builder.stopAdjusting();
  }
}

// Run the main function if this file is executed directly
if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
