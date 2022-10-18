import { localServeProject } from "../local-serve-project";
import { loadProject } from "../load-project";

export async function localServer() {
  const project = await loadProject(process.cwd());
  await localServeProject(project);
}
