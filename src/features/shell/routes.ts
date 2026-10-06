// Where each view lives. `/` is the retail briefing; every workspace view is
// /w/<workspace>/<view>. Nothing about a user's data goes in the URL (§8).

import { DEFAULT_SAMPLE } from '@/features/workspace/samples';

export const VIEWS = [
  { slug: 'briefing', label: 'Briefing' },
  { slug: 'ask', label: 'Ask' },
  { slug: 'metrics', label: 'Metrics' },
  { slug: 'health', label: 'Data health' },
  { slug: 'report', label: 'Report' },
] as const;

export type ViewSlug = (typeof VIEWS)[number]['slug'];

export function isView(slug: string): slug is ViewSlug {
  return VIEWS.some((v) => v.slug === slug);
}

export function viewHref(workspace: string, view: ViewSlug): string {
  return `/w/${workspace}/${view}`;
}

/** The workspace and view a path shows, or null outside a workspace. */
export function locate(pathname: string): { workspace: string; view: ViewSlug } | null {
  if (pathname === '/') return { workspace: DEFAULT_SAMPLE, view: 'briefing' };
  const [, w, workspace, view] = pathname.split('/');
  if (w !== 'w' || !workspace) return null;
  return { workspace, view: view && isView(view) ? view : 'briefing' };
}
