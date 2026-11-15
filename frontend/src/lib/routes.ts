/**
 * Lazy route loaders, shared by `App` (React.lazy) and by prefetching. The same `import()` promise is
 * reused, so warming a route (nav hover/focus/touch, or an idle pass after first paint) means a later
 * navigation finds the chunk already loaded and never suspends (no fallback flash).
 */
const loaders = {
  "/trials": () => import("../views/DashboardView"),
  "/literature": () => import("../views/LiteratureView"),
  "/ask": () => import("../views/AskView"),
  "/guide": () => import("../views/GuideView"),
  "/about": () => import("../views/AboutView"),
} as const;

export type LazyRoute = keyof typeof loaders;

export const loadDashboard = loaders["/trials"];
export const loadLiterature = loaders["/literature"];
export const loadAsk = loaders["/ask"];
export const loadGuide = loaders["/guide"];
export const loadAbout = loaders["/about"];

/** Start loading a route's chunk now. Safe to call repeatedly; failures surface on real navigation. */
export function prefetchRoute(to: string) {
  if (to in loaders) void loaders[to as LazyRoute]().catch(() => {});
}

/** After first paint, warm every lazy route once the browser is idle. Returns a canceller. */
export function prefetchAllRoutesWhenIdle() {
  const run = () => (Object.keys(loaders) as LazyRoute[]).forEach(prefetchRoute);
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout: 2500 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(run, 1200);
  return () => window.clearTimeout(id);
}
