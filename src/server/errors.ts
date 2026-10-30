export class ForbiddenError extends Error {
  constructor(message = 'You do not have permission to do that.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends Error {
  constructor() {
    super('This item was changed by someone else. Refresh and try again.');
    this.name = 'ConflictError';
  }
}

export class PausedError extends Error {
  constructor(name: string) {
    super(`${name} is paused – changes are disabled until it is resumed.`);
    this.name = 'PausedError';
  }
}

/** Errors whose message is safe to show to the user. */
export const isUserError = (e: unknown): e is Error =>
  e instanceof Error && ['ForbiddenError', 'ConflictError', 'PausedError', 'ZodError', 'Error'].includes(e.name);
