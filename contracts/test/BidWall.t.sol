// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {BidWall} from "../src/BidWall.sol";
import {IBidWall} from "../src/interfaces/IBidWall.sol";
import {ISwapRouter} from "../src/interfaces/ISwapRouter.sol";
import {IWETH} from "../src/interfaces/IWETH.sol";

contract MockERC20 {
    string public name = "AXAI";
    string public symbol = "AXAI";
    uint8 public decimals = 18;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract MockWETH is MockERC20 {
    function deposit() external payable {
        balanceOf[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external {
        balanceOf[msg.sender] -= amount;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "withdraw failed");
    }

    receive() external payable {
        balanceOf[msg.sender] += msg.value;
    }
}

contract MockSwapRouter is ISwapRouter {
    MockERC20 public axai;
    uint256 public outPerIn = 100; // 100 AXAI wei per 1 wei ETH (test scale)

    constructor(address axai_) {
        axai = MockERC20(axai_);
    }

    function setOutPerIn(uint256 v) external {
        outPerIn = v;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut)
    {
        // Pull WETH from caller (BidWall)
        MockERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
        amountOut = params.amountIn * outPerIn;
        require(amountOut >= params.amountOutMinimum, "slippage");
        axai.mint(params.recipient, amountOut);
    }
}

contract BidWallTest is Test {
    BidWall public bidwall;
    MockWETH public weth;
    MockERC20 public axai;
    MockSwapRouter public router;

    address owner = makeAddr("owner");
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");

    function setUp() public {
        weth = new MockWETH();
        axai = new MockERC20();
        router = new MockSwapRouter(address(axai));

        vm.prank(owner);
        bidwall = new BidWall(
            owner,
            address(router),
            address(weth),
            address(axai),
            treasury,
            3000,
            0.01 ether
        );

        vm.deal(alice, 100 ether);
    }

    function test_Deposit() public {
        vm.prank(alice);
        bidwall.deposit{value: 1 ether}();

        (uint256 ethBalance, uint256 totalEthIn,,,) = bidwall.getStats();
        assertEq(ethBalance, 1 ether);
        assertEq(totalEthIn, 1 ether);
    }

    function test_Receive() public {
        vm.prank(alice);
        (bool ok,) = address(bidwall).call{value: 0.5 ether}("");
        assertTrue(ok);
        (uint256 ethBalance,,,,) = bidwall.getStats();
        assertEq(ethBalance, 0.5 ether);
    }

    function test_Deposit_ZeroReverts() public {
        vm.prank(alice);
        vm.expectRevert(IBidWall.ZeroAmount.selector);
        bidwall.deposit{value: 0}();
    }

    function test_ExecuteBuyback() public {
        vm.prank(alice);
        bidwall.deposit{value: 1 ether}();

        vm.prank(alice);
        uint256 out = bidwall.executeBuyback(0.1 ether, 0);
        assertEq(out, 0.1 ether * 100);
        assertEq(axai.balanceOf(treasury), out);

        (,, uint256 totalBought,,) = bidwall.getStats();
        assertEq(totalBought, out);
    }

    function test_ExecuteBuyback_TooSmall() public {
        vm.prank(alice);
        bidwall.deposit{value: 1 ether}();

        vm.prank(alice);
        vm.expectRevert(IBidWall.BuybackTooSmall.selector);
        bidwall.executeBuyback(0.001 ether, 0);
    }

    function test_PauseBlocksDeposit() public {
        vm.prank(owner);
        bidwall.pause();

        vm.prank(alice);
        vm.expectRevert();
        bidwall.deposit{value: 1 ether}();
    }

    function test_OnlyOwnerSetTreasury() public {
        vm.prank(alice);
        vm.expectRevert();
        bidwall.setTreasury(alice);
    }
}
