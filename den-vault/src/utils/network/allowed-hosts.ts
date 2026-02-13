const ALLOWED_HOSTS = ["api.hiro.so", "api.testnet.hiro.so", "api.platform.hiro.so"];
const LOCALHOST_PATTERNS = [/^http:\/\/localhost(:\d+)?(\/|$)/, /^http:\/\/127\.0\.0\.1(:\d+)?(\/|$)/];

export function isAllowedApiHost(url: string): boolean {
  if (LOCALHOST_PATTERNS.some((p) => p.test(url))) return true;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}
