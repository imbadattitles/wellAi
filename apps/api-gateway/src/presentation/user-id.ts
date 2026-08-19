import { BadRequestException } from '@nestjs/common';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';

export function resolveUserId(header: string | undefined): string {
  if (!header) return DEMO_USER_ID;
  if (!uuidPattern.test(header)) throw new BadRequestException('x-user-id must be a UUID');
  return header;
}
