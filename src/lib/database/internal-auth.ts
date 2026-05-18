import type { NextRequest } from "next/server";

export function isDatabaseInternalAuthorized(req: NextRequest) {
  const expected = (process.env.INTERNAL_API_KEY ?? process.env.CRON_SECRET ?? "").trim();
  if (!expected) return false;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const provided = (req.headers.get("x-internal-key") ?? req.headers.get("x-cron-secret") ?? bearer ?? "").trim();
  return Boolean(provided && provided === expected);
}
