//SPDX-License-Identifier: Unlicensed
pragma solidity 0.8.0;


interface IPublicSale {
    function addLiquidity() external;
    function recoverLpEth() external;
    function endPublicSale() external;
    function endPrivateSale() external;
    function recoverERC20(address tokenAddress) external;
    function recoverLpToken(address lPTokenAddress) external;
    function addPrivateAllocations(address[] memory investors, uint256[] memory amounts) external;
    function lockCompanyTokens(address marketing, address reserve, address development) external;
}