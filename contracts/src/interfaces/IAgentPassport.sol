// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title IAgentPassport
/// @notice Soulbound ERC-721 agent identity passport (AXIOM / XIOM)
interface IAgentPassport {
    event PassportMinted(
        address indexed to,
        address indexed operator,
        uint256 indexed tokenId,
        string uri
    );
    event OperatorBound(uint256 indexed tokenId, address indexed operator);
    event PassportBurned(uint256 indexed tokenId, address indexed owner);

    error ZeroAddress();
    error AlreadyHasPassport();
    error PassportNotFound();
    error Soulbound();
    error Unauthorized();

    function mint(address to, address operator, string calldata uri)
        external
        returns (uint256 tokenId);

    function bindOperator(uint256 tokenId, address operator) external;
    function burn(uint256 tokenId) external;

    function hasPassport(address account) external view returns (bool);
    function getPassportByOperator(address operator)
        external
        view
        returns (uint256 tokenId, address owner, string memory uri);
    function operatorOf(uint256 tokenId) external view returns (address);
}
