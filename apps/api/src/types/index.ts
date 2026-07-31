export * from '@xiom/types';

// Hono context extensions
declare module 'hono' {
  interface ContextVariableMap {
    jwtPayload: Record<string, unknown>;
    requestId: string;
    userId: string;
    humanId: string;
    claims: Record<string, unknown>;
  }
}
