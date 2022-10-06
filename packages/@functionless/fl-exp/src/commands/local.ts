import path from "path";
import { localServeProject } from "../local-serve-project";
import { loadProject } from "../load-project";

export async function localServer() {
  const project = await loadProject(path.resolve("./src"));
  await localServeProject(project);
}
