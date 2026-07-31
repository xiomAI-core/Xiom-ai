// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IAgentPassport} from "./interfaces/IAgentPassport.sol";

/// @title AgentPassport
/// @author XIOM Team
/// @notice Soulbound ERC-721URIStorage passport binding a human owner to an agent operator.
///         Transfers are disabled (soulbound). Contract display name uses AXIOM branding.
contract AgentPassport is IAgentPassport, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId = 1;

    mapping(address => uint256) private _ownerToken;
    mapping(address => uint256) private _operatorToken;
    mapping(uint256 => address) private _tokenOperator;

    constructor(address initialOwner)
        ERC721("AXIOM Agent Passport", "AXIOM-PASS")
        Ownable(initialOwner)
    {}

    /// @notice Mint a soulbound passport to `to`, bound to `operator`
    function mint(address to, address operator, string calldata uri)
        external
        onlyOwner
        returns (uint256 tokenId)
    {
        if (to == address(0) || operator == address(0)) revert ZeroAddress();
        if (_ownerToken[to] != 0) revert AlreadyHasPassport();
        if (_operatorToken[operator] != 0) revert AlreadyHasPassport();

        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        _ownerToken[to] = tokenId;
        _operatorToken[operator] = tokenId;
        _tokenOperator[tokenId] = operator;

        emit PassportMinted(to, operator, tokenId, uri);
        emit OperatorBound(tokenId, operator);
    }

    /// @notice Rebind operator for an existing passport (owner or contract owner)
    function bindOperator(uint256 tokenId, address operator) external {
        if (operator == address(0)) revert ZeroAddress();
        address tokenOwner = ownerOf(tokenId);
        if (msg.sender != tokenOwner && msg.sender != owner()) revert Unauthorized();
        if (_operatorToken[operator] != 0 && _operatorToken[operator] != tokenId) {
            revert AlreadyHasPassport();
        }

        address previous = _tokenOperator[tokenId];
        if (previous != address(0)) {
            delete _operatorToken[previous];
        }
        _tokenOperator[tokenId] = operator;
        _operatorToken[operator] = tokenId;
        emit OperatorBound(tokenId, operator);
    }

    /// @notice Burn passport (owner or contract owner)
    function burn(uint256 tokenId) external {
        address tokenOwner = ownerOf(tokenId);
        if (msg.sender != tokenOwner && msg.sender != owner()) revert Unauthorized();

        address operator = _tokenOperator[tokenId];
        delete _ownerToken[tokenOwner];
        if (operator != address(0)) {
            delete _operatorToken[operator];
        }
        delete _tokenOperator[tokenId];
        _burn(tokenId);
        emit PassportBurned(tokenId, tokenOwner);
    }

    function hasPassport(address account) external view returns (bool) {
        return _ownerToken[account] != 0;
    }

    function getPassportByOperator(address operator)
        external
        view
        returns (uint256 tokenId, address owner_, string memory uri)
    {
        tokenId = _operatorToken[operator];
        if (tokenId == 0) revert PassportNotFound();
        owner_ = ownerOf(tokenId);
        uri = tokenURI(tokenId);
    }

    function operatorOf(uint256 tokenId) external view returns (address) {
        if (_ownerOf(tokenId) == address(0)) revert PassportNotFound();
        return _tokenOperator[tokenId];
    }

    /// @dev Soulbound: block transfers / approvals after mint
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert Soulbound();
    }
}
