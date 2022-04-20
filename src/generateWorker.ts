import { runAsWorker } from "synckit";
import fs from "fs";

runAsWorker(async (outputPath: string) => {
  console.log("Start generate to " + outputPath);
  try {
    await fs.promises.access(outputPath);
    return true;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return false;
  }
});
