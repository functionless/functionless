import { loadProject } from "../load-project";
import { synthesizeProject } from "../synthesize";

export async function cdkSynth() {
  const project = await loadProject(process.cwd());

  await synthesizeProject(project);
}
