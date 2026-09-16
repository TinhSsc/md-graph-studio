import { describe, expect, it } from 'vitest';
import { nextAvailableNodeTitle, uniqueNodeTitle } from '../src/model/nodeIdentity';

describe('node identity', () => {
  it('uses the first title that is actually unused', () => {
    expect(nextAvailableNodeTitle(['New node 1', 'New node 3'])).toBe('New node 2');
  });

  it('prevents a rename from reusing another node id', () => {
    expect(uniqueNodeTitle('Existing', 'Current', ['Current', 'Existing', 'Existing 2'])).toBe('Existing 3');
  });

  it('allows a node to keep its own title', () => {
    expect(uniqueNodeTitle('Current', 'Current', ['Current', 'Other'])).toBe('Current');
  });
});
