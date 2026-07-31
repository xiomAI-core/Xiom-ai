// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title ISwapRouter
/// @notice Minimal Uniswap V3 SwapRouter interface used by BidWall buybacks
interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);
}
