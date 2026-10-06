import { describe } from 'vitest';
import { demoSuite } from '../demo-suite';
import { RETAIL } from './index';

describe('retail sample', () => {
  demoSuite(RETAIL, ['R1', 'R5', 'R7']);
});
