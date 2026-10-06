import { expect, test } from 'vitest';
import { locate, viewHref } from './routes';

test('the home page is the retail briefing', () => {
  expect(locate('/')).toEqual({ workspace: 'retail', view: 'briefing' });
});

test('workspace paths give the workspace and view', () => {
  expect(locate('/w/saas/health')).toEqual({ workspace: 'saas', view: 'health' });
  expect(locate('/w/support')).toEqual({ workspace: 'support', view: 'briefing' });
});

test('pages outside a workspace give null', () => {
  expect(locate('/accuracy')).toBeNull();
  expect(locate('/about')).toBeNull();
});

test('links are built from workspace and view', () => {
  expect(viewHref('saas', 'ask')).toBe('/w/saas/ask');
});
