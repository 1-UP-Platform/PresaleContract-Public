//SPDX-License-Identifier: Unlicensed
pragma solidity 0.8.4;

import '@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol';


contract MockLiquidityToken is ERC20PresetMinterPauser {
    constructor () ERC20PresetMinterPauser('LP-UNI', 'LP-UNI') {
        // Silence
    }
}