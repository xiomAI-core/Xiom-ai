// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IAxiomPaymaster} from "./interfaces/IAxiomPaymaster.sol";

/// @dev Minimal ERC-4337 UserOperation view used by the local BasePaymaster stub.
///      Prefer replacing with eth-infinitism account-abstraction@v0.7 when forge install is available.
struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    bytes32 accountGasLimits;
    uint256 preVerificationGas;
    bytes32 gasFees;
    bytes paymasterAndData;
    bytes signature;
}

interface IEntryPoint {
    function balanceOf(address account) external view returns (uint256);
    function depositTo(address account) external payable;
    function withdrawTo(address payable withdrawAddress, uint256 withdrawAmount) external;
}

/// @dev Local stub of account-abstraction BasePaymaster (v0.7-compatible shape).
///      Install real dep: forge install eth-infinitism/account-abstraction@v0.7.0 --no-commit
abstract contract BasePaymaster is Ownable {
    IEntryPoint public immutable entryPoint;

    constructor(IEntryPoint entryPoint_, address initialOwner) Ownable(initialOwner) {
        entryPoint = entryPoint_;
    }

    modifier onlyEntryPoint() {
        require(msg.sender == address(entryPoint), "not EntryPoint");
        _;
    }

    function deposit() public payable {
        entryPoint.depositTo{value: msg.value}(address(this));
    }

    function getDeposit() public view returns (uint256) {
        return entryPoint.balanceOf(address(this));
    }

    function withdrawTo(address payable withdrawAddress, uint256 amount) public onlyOwner {
        entryPoint.withdrawTo(withdrawAddress, amount);
    }

    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external onlyEntryPoint returns (bytes memory context, uint256 validationData) {
        return _validatePaymasterUserOp(userOp, userOpHash, maxCost);
    }

    function postOp(
        uint8 mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) external onlyEntryPoint {
        _postOp(mode, context, actualGasCost, actualUserOpFeePerGas);
    }

    function _validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) internal virtual returns (bytes memory context, uint256 validationData);

    function _postOp(
        uint8 mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) internal virtual {}
}

/// @title AxiomPaymaster
/// @notice ERC-4337 paymaster that sponsors gas when the UserOp sender holds enough AXAI
contract AxiomPaymaster is BasePaymaster, IAxiomPaymaster {
    IERC20 public immutable axai;
    uint256 public minAxaiBalance;

    constructor(
        IEntryPoint entryPoint_,
        address axai_,
        address initialOwner,
        uint256 minAxaiBalance_
    ) BasePaymaster(entryPoint_, initialOwner) {
        require(axai_ != address(0), "zero axai");
        axai = IERC20(axai_);
        minAxaiBalance = minAxaiBalance_;
    }

    function setMinAxaiBalance(uint256 minBalance) external onlyOwner {
        uint256 previous = minAxaiBalance;
        minAxaiBalance = minBalance;
        emit MinBalanceUpdated(previous, minBalance);
    }

    function withdrawDepositTo(address payable to, uint256 amount) external onlyOwner {
        withdrawTo(to, amount);
        emit DepositWithdrawn(to, amount);
    }

    function _validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32, /* userOpHash */
        uint256 /* maxCost */
    ) internal view override returns (bytes memory context, uint256 validationData) {
        uint256 bal = axai.balanceOf(userOp.sender);
        if (bal < minAxaiBalance) revert InsufficientTokenBalance();
        context = abi.encode(userOp.sender);
        validationData = 0; // valid indefinitely (sigSuccess)
    }

    function _postOp(
        uint8, /* mode */
        bytes calldata context,
        uint256 actualGasCost,
        uint256 /* actualUserOpFeePerGas */
    ) internal override {
        address sender = abi.decode(context, (address));
        emit HolderSponsored(sender, actualGasCost);
    }
}
