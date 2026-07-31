// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title IAxiomPaymaster
/// @notice ERC-4337 paymaster that sponsors gas for AXAI / XIOM holders
interface IAxiomPaymaster {
    event HolderSponsored(address indexed sender, uint256 gasCost);
    event MinBalanceUpdated(uint256 previous, uint256 next);
    event DepositWithdrawn(address indexed to, uint256 amount);

    error InsufficientTokenBalance();
    error Unauthorized();

    function setMinAxaiBalance(uint256 minBalance) external;
    function withdrawDepositTo(address payable to, uint256 amount) external;
    function minAxaiBalance() external view returns (uint256);
}
