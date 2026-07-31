// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {AgentPassport} from "../src/AgentPassport.sol";
import {IAgentPassport} from "../src/interfaces/IAgentPassport.sol";

contract AgentPassportTest is Test {
    AgentPassport public passport;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address operator = makeAddr("operator");

    function setUp() public {
        vm.prank(owner);
        passport = new AgentPassport(owner);
    }

    function test_Mint() public {
        vm.prank(owner);
        uint256 tokenId = passport.mint(alice, operator, "ipfs://passport/1");
        assertEq(tokenId, 1);
        assertTrue(passport.hasPassport(alice));
        assertEq(passport.ownerOf(tokenId), alice);
        assertEq(passport.operatorOf(tokenId), operator);
    }

    function test_GetPassportByOperator() public {
        vm.prank(owner);
        passport.mint(alice, operator, "ipfs://passport/1");

        (uint256 tokenId, address owner_, string memory uri) =
            passport.getPassportByOperator(operator);
        assertEq(tokenId, 1);
        assertEq(owner_, alice);
        assertEq(uri, "ipfs://passport/1");
    }

    function test_DuplicateMintReverts() public {
        vm.prank(owner);
        passport.mint(alice, operator, "ipfs://a");

        vm.prank(owner);
        vm.expectRevert(IAgentPassport.AlreadyHasPassport.selector);
        passport.mint(alice, makeAddr("op2"), "ipfs://b");
    }

    function test_SoulboundTransferReverts() public {
        vm.prank(owner);
        uint256 tokenId = passport.mint(alice, operator, "ipfs://a");

        vm.prank(alice);
        vm.expectRevert(IAgentPassport.Soulbound.selector);
        passport.transferFrom(alice, bob, tokenId);
    }

    function test_BindOperator() public {
        vm.prank(owner);
        uint256 tokenId = passport.mint(alice, operator, "ipfs://a");

        address newOp = makeAddr("newOp");
        vm.prank(alice);
        passport.bindOperator(tokenId, newOp);
        assertEq(passport.operatorOf(tokenId), newOp);
    }

    function test_Burn() public {
        vm.prank(owner);
        uint256 tokenId = passport.mint(alice, operator, "ipfs://a");

        vm.prank(alice);
        passport.burn(tokenId);
        assertFalse(passport.hasPassport(alice));
    }

    function test_ApproveReverts() public {
        vm.prank(owner);
        uint256 tokenId = passport.mint(alice, operator, "ipfs://a");

        vm.prank(alice);
        vm.expectRevert(IAgentPassport.Soulbound.selector);
        passport.approve(bob, tokenId);
    }
}
