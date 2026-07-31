// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title IBidWall
/// @notice ETH → AXAI Uniswap V3 buyback wall for the XIOM / AXIOM protocol
interface IBidWall {
    event EthReceived(address indexed from, uint256 amount);
    event BuybackExecuted(
        address indexed caller,
        uint256 ethSpent,
        uint256 axaiBought,
        uint256 timestamp
    );
    event TreasuryUpdated(address indexed previous, address indexed next);
    event PoolFeeUpdated(uint24 previous, uint24 next);
    event MinBuyAmountUpdated(uint256 previous, uint256 next);
    event Swept(address indexed token, address indexed to, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error InsufficientBalance();
    error BuybackTooSmall();
    error SwapFailed();

    function deposit() external payable;
    function executeBuyback(uint256 amountIn, uint256 amountOutMinimum)
        external
        returns (uint256 amountOut);
    function getStats()
        external
        view
        returns (
            uint256 ethBalance,
            uint256 totalEthIn,
            uint256 totalAxaiBought,
            uint24 poolFee,
            uint256 minBuyAmount
        );
}
