export type InboxClaim = 'acquired' | 'completed' | 'busy';

export interface CommandInboxPort {
  claim(messageId: string, messageType: string): Promise<InboxClaim>;
  complete(messageId: string): Promise<void>;
  fail(messageId: string, errorCode: string): Promise<void>;
}

export const COMMAND_INBOX = Symbol('COMMAND_INBOX');
