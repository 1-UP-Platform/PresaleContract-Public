//SPDX-License-Identifier: Unlicensed
pragma solidity 0.8.4;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './MockLiquidityToken.sol';


contract MockUniswap {
    MockLiquidityToken public lpToken;

    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity){
      require(amountTokenDesired != 0 && amountETHMin != 0 && to != address(0) && deadline > 0, 'Invalid entry data!');

      // Receive 1-UP tokens from initiator address
      IERC20(token).transferFrom(msg.sender, address(this), amountTokenMin);

      // Deploy LP token
      lpToken = new MockLiquidityToken();

      // Mint and send back to Liquidity provider address
      lpToken.mint(msg.sender, 100 ether);

      // Return just demo values
      return (0, 0, 0);
    }
}

