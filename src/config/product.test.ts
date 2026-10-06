import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { product } from '@/config/product';

describe('product config', () => {
  it('names the product Footnote', () => {
    expect(product.name).toBe('Footnote');
  });

  it('runs property tests', () => {
    fc.assert(fc.property(fc.string(), (s) => (product.name + s).startsWith(product.name)));
  });
});
