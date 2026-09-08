type AppUrlEnvironment = {
  NEXT_PUBLIC_APP_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL_URL?: string;
};

function normalizeUrl(value: string) {
  const candidate = value.includes("://") ? value : `https://${value}`;
  const url = new URL(candidate);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Application URL must use HTTP or HTTPS");
  return url.origin;
}

export function resolveAppUrl(
  environment: AppUrlEnvironment = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    VERCEL_URL: process.env.VERCEL_URL,
  },
) {
  const configured = environment.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return normalizeUrl(configured);
  const production = environment.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return normalizeUrl(production);
  const deployment = environment.VERCEL_URL?.trim();
  if (deployment) return normalizeUrl(deployment);
  return null;
}
