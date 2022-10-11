import path from "path";
import fs from "fs";

interface TemplateManifest {
  root: string;
  extend?: string;
  devDependencies?: string[];
  files?: string[];
}

interface FileMapping {
  sourcePath: string;
  localPath: string;
}

interface TemplatePlan {
  devDependencies: string[];
  fileMappings: FileMapping[];
}

async function loadTemplateManifest(templateName: string) {
  const templateRoot = path.join(__dirname, "..", "templates", templateName);
  const templateManifestPath = path.join(templateRoot, "manifest.json");
  try {
    const templateManifest: TemplateManifest = {
      ...JSON.parse(await fs.promises.readFile(templateManifestPath, "utf-8")),
      root: templateRoot,
    };
    return templateManifest;
  } catch (err) {
    throw new Error(`Unable to load template: ${templateName}`);
  }
}

function applyManifest(
  plan: TemplatePlan,
  manifest: TemplateManifest
): TemplatePlan {
  return {
    devDependencies: [
      ...plan.devDependencies,
      ...(manifest.devDependencies ?? []),
    ],
    fileMappings: [
      ...plan.fileMappings,
      ...(manifest.files?.map((filePath) => {
        return {
          sourcePath: path.join(manifest.root, filePath),
          localPath: filePath,
        };
      }) ?? []),
    ],
  };
}

export async function loadTemplatePlan(templateName: string) {
  let generatedPlan: TemplatePlan = {
    devDependencies: [],
    fileMappings: [],
  };
  const targetManifest = await loadTemplateManifest(templateName);

  if (targetManifest.extend) {
    const baseManifest = await loadTemplateManifest(targetManifest.extend);

    generatedPlan = applyManifest(generatedPlan, baseManifest);
  }

  return applyManifest(generatedPlan, targetManifest);
}
