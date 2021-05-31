//SPDX-License-Identifier: Unlicensed
pragma solidity 0.8.0;


interface ILiquidityProvider {
    function addLiquidity() external;
    function emergencyWithdraw(address payable receiver) external;
    function recoverERC20(address lpTokenAddress, address receiver) external;
}
