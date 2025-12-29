// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.24;

import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC1155 } from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import { IERC2981 } from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import { IArtifactNFT } from "./IArtifactNFT.sol";
import { IMaterialToken } from "./IMaterialToken.sol";
import { MaterialType } from "codegen/common.sol";

/**
 * @title TokenRegistry
 * @dev Utility contract to check if a deployed contract supports both ERC721 and ERC1155
 * @notice Allows checking if an existing contract can be used for both ArtifactNFT and MaterialToken
 */
library TokenRegistry {
  // Interface IDs
  bytes4 private constant INTERFACE_ID_ERC721 = type(IERC721).interfaceId;
  bytes4 private constant INTERFACE_ID_ERC1155 = type(IERC1155).interfaceId;
  bytes4 private constant INTERFACE_ID_ERC2981 = type(IERC2981).interfaceId;

  /**
   * @notice Check if a contract supports ERC721 interface
   * @param contractAddress Address to check
   * @return true if contract supports ERC721
   */
  function supportsERC721(address contractAddress) internal view returns (bool) {
    if (contractAddress == address(0)) return false;

    (bool success, bytes memory data) = contractAddress.staticcall(
      abi.encodeWithSelector(IERC165.supportsInterface.selector, INTERFACE_ID_ERC721)
    );
    if (!success || data.length == 0) return false;
    return abi.decode(data, (bool));
  }

  /**
   * @notice Check if a contract supports ERC1155 interface
   * @param contractAddress Address to check
   * @return true if contract supports ERC1155
   */
  function supportsERC1155(address contractAddress) internal view returns (bool) {
    if (contractAddress == address(0)) return false;

    (bool success, bytes memory data) = contractAddress.staticcall(
      abi.encodeWithSelector(IERC165.supportsInterface.selector, INTERFACE_ID_ERC1155)
    );
    if (!success || data.length == 0) return false;
    return abi.decode(data, (bool));
  }

  /**
   * @notice Check if a contract supports ERC2981 (royalty) interface
   * @param contractAddress Address to check
   * @return true if contract supports ERC2981
   */
  function supportsERC2981(address contractAddress) internal view returns (bool) {
    if (contractAddress == address(0)) return false;

    (bool success, bytes memory data) = contractAddress.staticcall(
      abi.encodeWithSelector(IERC165.supportsInterface.selector, INTERFACE_ID_ERC2981)
    );
    if (!success || data.length == 0) return false;
    return abi.decode(data, (bool));
  }

  /**
   * @notice Check if a contract supports both ERC721 and ERC1155 (unified contract)
   * @param contractAddress Address to check
   * @return erc721Supported true if ERC721 is supported
   * @return erc1155Supported true if ERC1155 is supported
   * @return erc2981Supported true if ERC2981 is supported
   */
  function checkContractSupport(
    address contractAddress
  ) internal view returns (bool erc721Supported, bool erc1155Supported, bool erc2981Supported) {
    if (contractAddress == address(0)) {
      return (false, false, false);
    }

    erc721Supported = supportsERC721(contractAddress);
    erc1155Supported = supportsERC1155(contractAddress);
    erc2981Supported = supportsERC2981(contractAddress);
  }

  /**
   * @notice Check if a contract can be used as ArtifactNFT (ERC721 + ERC2981)
   * @param contractAddress Address to check
   * @return true if contract can be used as ArtifactNFT
   */
  function canUseAsArtifactNFT(address contractAddress) internal view returns (bool) {
    return supportsERC721(contractAddress) && supportsERC2981(contractAddress);
  }

  /**
   * @notice Check if a contract can be used as MaterialToken (ERC1155 + ERC2981)
   * @param contractAddress Address to check
   * @return true if contract can be used as MaterialToken
   */
  function canUseAsMaterialToken(address contractAddress) internal view returns (bool) {
    return supportsERC1155(contractAddress) && supportsERC2981(contractAddress);
  }

  /**
   * @notice Check if a contract can be used for both ArtifactNFT and MaterialToken
   * @param contractAddress Address to check
   * @return true if contract supports both ERC721 and ERC1155 with ERC2981
   */
  function canUseAsBoth(address contractAddress) internal view returns (bool) {
    return supportsERC721(contractAddress) && supportsERC1155(contractAddress) && supportsERC2981(contractAddress);
  }

  /**
   * @notice Verify contract implements IArtifactNFT interface
   * @param contractAddress Address to check
   * @return true if contract implements IArtifactNFT
   */
  function implementsIArtifactNFT(address contractAddress) internal view returns (bool) {
    if (contractAddress == address(0)) return false;

    // Check if contract has required IArtifactNFT functions
    (bool success, ) = contractAddress.staticcall(
      abi.encodeWithSelector(IArtifactNFT.getArtifact.selector, uint256(0))
    );
    return success;
  }

  /**
   * @notice Verify contract implements IMaterialToken interface
   * @param contractAddress Address to check
   * @return true if contract implements IMaterialToken
   */
  function implementsIMaterialToken(address contractAddress) internal view returns (bool) {
    if (contractAddress == address(0)) return false;

    // Check if contract has required IMaterialToken functions
    (bool success, ) = contractAddress.staticcall(
      abi.encodeWithSelector(IMaterialToken.getTokenId.selector, MaterialType.UNKNOWN)
    );
    return success;
  }
}
