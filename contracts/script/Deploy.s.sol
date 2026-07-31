// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";

import {BidWall} from "../src/BidWall.sol";
import {AgentPassport} from "../src/AgentPassport.sol";
import {AxiomPaymaster, IEntryPoint} from "../src/AxiomPaymaster.sol";

/// @title DeployAxiom
/// @notice Deploys BidWall, AgentPassport, and AxiomPaymaster; writes deployments/{chainId}.json
contract DeployAxiom is Script {
    using stdJson for string;

    // ERC-4337 EntryPoint v0.7 (canonical)
    address constant ENTRY_POINT_V07 = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    function run() external {
        uint256 deployerKey = vm.envUint("XIOM_SIGNER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address swapRouter = vm.envAddress("RH_SWAP_ROUTER");
        address weth = vm.envAddress("RH_WETH_ADDRESS");
        address axai = vm.envAddress("XIOM_TOKEN_ADDRESS");
        address treasury = vm.envOr("XIOM_TREASURY_ADDRESS", deployer);
        address usdg = vm.envOr("USDG_ADDRESS", address(0));
        uint24 poolFee = uint24(vm.envOr("RH_POOL_FEE", uint256(3000)));
        uint256 minBuy = vm.envOr("BIDWALL_MIN_BUY", uint256(0.01 ether));
        uint256 minAxaiForGas = vm.envOr("PAYMASTER_MIN_AXAI", uint256(1 ether));

        console.log("Deployer:", deployer);
        console.log("ChainId:", block.chainid);

        vm.startBroadcast(deployerKey);

        BidWall bidwall = new BidWall(
            deployer, swapRouter, weth, axai, treasury, poolFee, minBuy
        );
        console.log("BidWall:", address(bidwall));

        AgentPassport passport = new AgentPassport(deployer);
        console.log("AgentPassport:", address(passport));

        AxiomPaymaster paymaster =
            new AxiomPaymaster(IEntryPoint(ENTRY_POINT_V07), axai, deployer, minAxaiForGas);
        console.log("AxiomPaymaster:", address(paymaster));

        vm.stopBroadcast();

        string memory obj = "deployment";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeAddress(obj, "bidWall", address(bidwall));
        vm.serializeAddress(obj, "agentPassport", address(passport));
        vm.serializeAddress(obj, "axiomPaymaster", address(paymaster));
        vm.serializeAddress(obj, "axai", axai);
        vm.serializeAddress(obj, "usdg", usdg);
        vm.serializeAddress(obj, "weth", weth);
        vm.serializeAddress(obj, "swapRouter", swapRouter);
        vm.serializeAddress(obj, "treasury", treasury);
        vm.serializeAddress(obj, "entryPoint", ENTRY_POINT_V07);
        string memory finalJson =
            vm.serializeUint(obj, "deployedAt", block.timestamp);

        string memory path = string.concat(
            "deployments/",
            vm.toString(block.chainid),
            ".json"
        );
        vm.writeJson(finalJson, path);
        console.log("Wrote", path);
    }
}
