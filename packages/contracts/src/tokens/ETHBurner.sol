// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.24;

/**
 * @title ETHBurner
 * @notice Contract that permanently burns ETH by selfdestructing
 * @dev ETH sent to this contract is permanently removed from circulation.
 *      This contract can be used as a royalty recipient to burn ETH from token sales.
 *      Each time ETH is received, the contract selfdestructs, permanently burning the ETH.
 */
contract ETHBurner {
  /**
   * @notice Receive ETH and immediately burn it via selfdestruct
   * @dev This function is called when ETH is sent to the contract.
   *      The ETH is permanently removed from circulation by selfdestructing to address(0).
   *      Note: After selfdestruct, the contract is destroyed and cannot receive more ETH.
   *      For continuous burning, deploy a new instance or use ReusableETHBurner.
   */
  receive() external payable {
    // Selfdestruct sends all ETH to address(0), permanently burning it
    selfdestruct(payable(address(0)));
  }

  /**
   * @notice Fallback function for compatibility
   * @dev Handles any calls that don't match the receive function
   */
  fallback() external payable {
    selfdestruct(payable(address(0)));
  }
}

/**
 * @title ReusableETHBurner
 * @notice Contract that accumulates ETH and can be burned on demand
 * @dev This contract accumulates ETH and allows manual burning via burn() function.
 *      Useful for batching burns or accumulating ETH before burning.
 */
contract ReusableETHBurner {
  event ETHBurned(uint256 amount);

  /**
   * @notice Receive ETH and accumulate it in the contract
   * @dev ETH accumulates in the contract until burn() is called
   */
  receive() external payable {
    // ETH accumulates in contract balance
  }

  /**
   * @notice Fallback function for compatibility
   */
  fallback() external payable {
    // ETH accumulates in contract balance
  }

  /**
   * @notice Burn all accumulated ETH by selfdestructing
   * @dev Permanently removes all ETH from circulation.
   *      Can be called by anyone to burn accumulated ETH.
   *      After calling, the contract is destroyed.
   */
  function burn() external {
    uint256 balance = address(this).balance;
    if (balance > 0) {
      emit ETHBurned(balance);
      // Selfdestruct sends all ETH to address(0), permanently burning it
      selfdestruct(payable(address(0)));
    }
  }

  /**
   * @notice Get the current accumulated ETH balance
   * @return The amount of ETH accumulated in the contract
   */
  function getBalance() external view returns (uint256) {
    return address(this).balance;
  }
}
