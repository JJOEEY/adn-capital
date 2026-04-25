export const PRIMARY_APP_ROUTES = new Set([
  "/dashboard",
  "/tin-tuc",
  "/dashboard/signal-map",
  "/art",
  "/journal",
  "/menu",
]);

export function isPrimaryAppRoute(pathname: string | null | undefined) {
  return PRIMARY_APP_ROUTES.has(pathname || "/");
}
