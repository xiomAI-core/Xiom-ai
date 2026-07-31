/**
 * Wagmi connectors used by the app — avoids @wagmi/connectors barrel, which
 * pulls Coinbase/Base x402 deps we do not use in the browser bundle.
 */
export { injected } from '@wagmi/core';
export { walletConnect } from '@xiom/wagmi-wallet-connect';
