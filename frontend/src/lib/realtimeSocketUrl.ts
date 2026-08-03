export function realtimeServerOrigin(
  configuredUrl: string | undefined,
  baseUrl: string
): string | undefined {
  if (!configuredUrl) {
    return undefined;
  }
  return new URL(configuredUrl, baseUrl).origin;
}
