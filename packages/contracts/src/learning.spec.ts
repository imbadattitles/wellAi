import { describe, expect, it } from 'vitest';
import { learningProgramStatusChangedSchema } from './learning';

describe('learningProgramStatusChangedSchema', () => {
  it('accepts terminal program statuses only', () => {
    const base = {
      programId: 'ea5655d4-248b-4f9d-a846-d6eab73f03ff',
      sourceId: 'a65f7855-14b3-4ce4-bc86-5fe472527a4d',
      failureCode: null,
    };

    expect(learningProgramStatusChangedSchema.parse({ ...base, status: 'ready' })).toEqual({
      ...base,
      status: 'ready',
    });
    expect(() =>
      learningProgramStatusChangedSchema.parse({ ...base, status: 'processing' }),
    ).toThrow();
  });
});
