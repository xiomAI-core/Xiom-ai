/**
 * Ambient stubs so TypeScript typechecks without optional ZeroDev packages installed.
 * Real types come from @zerodev/sdk when added as a dependency.
 */
declare module '@zerodev/sdk' {
  export const createKernelAccount: unknown;
  export const createKernelAccountClient: unknown;
}

declare module '@zerodev/ecdsa-validator' {
  export const signerToEcdsaValidator: unknown;
}
