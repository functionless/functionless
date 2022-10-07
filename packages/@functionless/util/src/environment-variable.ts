export function getEnvironmentVariableName(resourceId: string): string {
  return resourceId.replaceAll(/[^A-Za-z_0-9]/g, "_");
}
