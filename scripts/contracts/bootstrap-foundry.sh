#!/usr/bin/env bash
# Install Foundry dependencies when lib/ is not vendored in git.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${ROOT}/contracts"

# Prefer HTTPS when forge install clones via git
git config --global url."https://github.com/".insteadOf "git://github.com/" || true

install_if_missing() {
  local dir="$1"
  shift
  if [ ! -d "${dir}" ]; then
    echo "Installing ${dir}..."
    "$@"
  else
    echo "Already present: ${dir}"
  fi
}

install_if_missing "lib/forge-std" \
  forge install foundry-rs/forge-std --no-commit

install_if_missing "lib/openzeppelin-contracts" \
  forge install OpenZeppelin/openzeppelin-contracts@v5.0.2 --no-commit

install_if_missing "lib/account-abstraction" \
  forge install eth-infinitism/account-abstraction@v0.7.0 --no-commit

echo "Foundry dependencies ready."
