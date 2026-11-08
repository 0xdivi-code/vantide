// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Vantide Operator Treasury Vault
/// @notice Holds operator-owned native assets and ERC-20 protocol revenue.
/// @dev This is not an Orderly broker contract, a user-funds vault, or an
///      upgradeable proxy. Orderly/broker fee routing must send revenue here
///      through a separately configured, supported integration.
contract OperatorTreasuryVault {
    string public constant VERSION = "1.0.0";

    address public owner;
    address public pendingOwner;
    bool public paused;

    uint256 private _entered;

    error ZeroAddress();
    error ZeroAmount();
    error Unauthorized();
    error InvalidToken();
    error TransferFailed();
    error InsufficientBalance();
    error ReentrantCall();
    error PauseActive();
    error PauseNotActive();
    error UnsupportedCall();

    event NativeDeposited(address indexed from, uint256 amount);
    event TokenDeposited(
        address indexed token,
        address indexed from,
        uint256 requestedAmount,
        uint256 receivedAmount
    );
    event NativeWithdrawn(address indexed to, uint256 amount);
    event TokenWithdrawn(address indexed token, address indexed to, uint256 amount);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event VaultPaused(address indexed account);
    event VaultUnpaused(address indexed account);

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert PauseActive();
        _;
    }

    modifier nonReentrant() {
        if (_entered != 0) revert ReentrantCall();
        _entered = 1;
        _;
        _entered = 0;
    }

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    /// @notice Plain native transfers are accepted as operator/revenue funding.
    receive() external payable whenNotPaused {
        if (msg.value == 0) revert ZeroAmount();
        emit NativeDeposited(msg.sender, msg.value);
    }

    /// @notice Reject accidental calls to unknown functions instead of silently funding.
    fallback() external payable {
        revert UnsupportedCall();
    }

    function depositNative() external payable whenNotPaused {
        if (msg.value == 0) revert ZeroAmount();
        emit NativeDeposited(msg.sender, msg.value);
    }

    /// @notice Pulls tokens from the caller after ERC-20 approval.
    /// @dev Uses balance deltas so the event reports the amount actually received.
    function depositToken(address token, uint256 amount)
        external
        whenNotPaused
        nonReentrant
    {
        if (token == address(0)) revert ZeroAddress();
        if (token.code.length == 0) revert InvalidToken();
        if (amount == 0) revert ZeroAmount();

        uint256 before = _tokenBalance(token, address(this));
        _callToken(
            token,
            abi.encodeWithSignature("transferFrom(address,address,uint256)", msg.sender, address(this), amount)
        );
        uint256 received = _tokenBalance(token, address(this)) - before;
        if (received == 0) revert TransferFailed();

        emit TokenDeposited(token, msg.sender, amount, received);
    }

    function withdrawNative(address payable to, uint256 amount)
        external
        onlyOwner
        whenNotPaused
        nonReentrant
    {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (address(this).balance < amount) revert InsufficientBalance();

        (bool success, ) = to.call{value: amount}("");
        if (!success) revert TransferFailed();
        emit NativeWithdrawn(to, amount);
    }

    function withdrawToken(address token, address to, uint256 amount)
        external
        onlyOwner
        whenNotPaused
        nonReentrant
    {
        if (token == address(0) || to == address(0)) revert ZeroAddress();
        if (token.code.length == 0) revert InvalidToken();
        if (amount == 0) revert ZeroAmount();
        if (_tokenBalance(token, address(this)) < amount) revert InsufficientBalance();

        uint256 before = _tokenBalance(token, to);
        _callToken(token, abi.encodeWithSignature("transfer(address,uint256)", to, amount));
        uint256 received = _tokenBalance(token, to) - before;
        if (received == 0) revert TransferFailed();
        emit TokenWithdrawn(token, to, received);
    }

    function pause() external onlyOwner {
        if (paused) revert PauseActive();
        paused = true;
        emit VaultPaused(msg.sender);
    }

    function unpause() external onlyOwner {
        if (!paused) revert PauseNotActive();
        paused = false;
        emit VaultUnpaused(msg.sender);
    }

    /// @notice Starts two-step ownership transfer. Ownership cannot be renounced.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert Unauthorized();
        address previousOwner = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(previousOwner, msg.sender);
    }

    function _tokenBalance(address token, address account) private view returns (uint256) {
        (bool success, bytes memory data) = token.staticcall(
            abi.encodeWithSignature("balanceOf(address)", account)
        );
        if (!success || data.length != 32) revert InvalidToken();
        return abi.decode(data, (uint256));
    }

    /// @dev Supports ERC-20s that return no boolean as well as standard tokens.
    function _callToken(address token, bytes memory payload) private {
        (bool success, bytes memory data) = token.call(payload);
        if (!success) revert TransferFailed();
        if (data.length > 0 && !abi.decode(data, (bool))) revert TransferFailed();
    }
}
