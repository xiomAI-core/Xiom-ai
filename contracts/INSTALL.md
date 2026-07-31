# XIOM Contracts — Dependency Install

Forge is required. Install Foundry: https://book.getfoundry.sh/getting-started/installation

```bash
cd contracts
forge install OpenZeppelin/openzeppelin-contracts@v5.0.2 --no-commit
forge install foundry-rs/forge-std --no-commit
forge install eth-infinitism/account-abstraction@v0.7.0 --no-commit
forge build
forge test
```

ERC-4337 EntryPoint v0.7: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`

Robinhood Chain IDs: mainnet `4663`, testnet `46630`.
