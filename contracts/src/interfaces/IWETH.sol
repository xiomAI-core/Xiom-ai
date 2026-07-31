// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title IWETH
/// @notice Minimal WETH interface for BidWall wrap/unwrap + approve
interface IWETH {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}
