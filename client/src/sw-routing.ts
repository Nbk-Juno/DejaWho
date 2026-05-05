export type CacheStrategy = "cache-first" | "network-first";

export function routingStrategy(pathname: string): CacheStrategy {
  if (pathname.startsWith("/api/")) {
    return "network-first";
  }
  return "cache-first";
}
