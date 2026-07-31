// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IBidWall} from "./interfaces/IBidWall.sol";
import {ISwapRouter} from "./interfaces/ISwapRouter.sol";
import {IWETH} from "./interfaces/IWETH.sol";

/// @title BidWall
/// @author XIOM Team
/// @notice Receives native ETH on Robinhood Chain and executes Uniswap V3 buybacks of AXAI.
///         Display name "AXAI" matches protocol token branding; package branding remains XIOM.
contract BidWall is IBidWall, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    ISwapRouter public immutable swapRouter;
    IWETH public immutable weth;
    IERC20 public immutable axai;

    address public treasury;
    uint24 public poolFee;
    uint256 public minBuyAmount;
    uint256 public totalEthIn;
    uint256 public totalAxaiBought;

    constructor(
        address initialOwner,
        address swapRouter_,
        address weth_,
        address axai_,
        address treasury_,
        uint24 poolFee_,
        uint256 minBuyAmount_
    ) Ownable(initialOwner) {
        if (
            swapRouter_ == address(0) || weth_ == address(0) || axai_ == address(0)
                || treasury_ == address(0)
        ) {
            revert ZeroAddress();
        }
        swapRouter = ISwapRouter(swapRouter_);
        weth = IWETH(weth_);
        axai = IERC20(axai_);
        treasury = treasury_;
        poolFee = poolFee_;
        minBuyAmount = minBuyAmount_;
    }

    receive() external payable {
        if (msg.value == 0) revert ZeroAmount();
        totalEthIn += msg.value;
        emit EthReceived(msg.sender, msg.value);
    }

    /// @notice Explicit ETH deposit into the bid wall
    function deposit() external payable whenNotPaused {
        if (msg.value == 0) revert ZeroAmount();
        totalEthIn += msg.value;
        emit EthReceived(msg.sender, msg.value);
    }

    /// @notice Wrap ETH → WETH and swap for AXAI via Uniswap V3 exactInputSingle
    /// @param amountIn ETH amount to spend (must be <= contract balance)
    /// @param amountOutMinimum Minimum AXAI expected (slippage protection)
    function executeBuyback(uint256 amountIn, uint256 amountOutMinimum)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 amountOut)
    {
        if (amountIn == 0) revert ZeroAmount();
        if (amountIn < minBuyAmount) revert BuybackTooSmall();
        if (address(this).balance < amountIn) revert InsufficientBalance();

        weth.deposit{value: amountIn}();
        bool approved = weth.approve(address(swapRouter), amountIn);
        if (!approved) revert SwapFailed();

        amountOut = swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(weth),
                tokenOut: address(axai),
                fee: poolFee,
                recipient: treasury,
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            })
        );

        if (amountOut == 0) revert SwapFailed();

        totalAxaiBought += amountOut;
        emit BuybackExecuted(msg.sender, amountIn, amountOut, block.timestamp);
    }

    function getStats()
        external
        view
        returns (
            uint256 ethBalance,
            uint256 totalEthIn_,
            uint256 totalAxaiBought_,
            uint24 poolFee_,
            uint256 minBuyAmount_
        )
    {
        return (address(this).balance, totalEthIn, totalAxaiBought, poolFee, minBuyAmount);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        address previous = treasury;
        treasury = treasury_;
        emit TreasuryUpdated(previous, treasury_);
    }

    function setPoolFee(uint24 poolFee_) external onlyOwner {
        uint24 previous = poolFee;
        poolFee = poolFee_;
        emit PoolFeeUpdated(previous, poolFee_);
    }

    function setMinBuyAmount(uint256 minBuyAmount_) external onlyOwner {
        uint256 previous = minBuyAmount;
        minBuyAmount = minBuyAmount_;
        emit MinBuyAmountUpdated(previous, minBuyAmount_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Rescue ERC-20 tokens (not intended for stuck WETH mid-swap)
    function sweepToken(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
        emit Swept(token, to, amount);
    }

    /// @notice Rescue native ETH (e.g. after pause / emergency)
    function sweepEth(address payable to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (address(this).balance < amount) revert InsufficientBalance();
        (bool ok,) = to.call{value: amount}("");
        require(ok, "ETH transfer failed");
        emit Swept(address(0), to, amount);
    }
}
