//SPDX-License-Identifier: Unlicensed
pragma solidity 0.8.0;

import '@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol';


contract OneUp is ERC20PresetMinterPauser {
    uint256 public constant MAX_SUPPLY = 100000000 ether;

    constructor () ERC20PresetMinterPauser('1-UP', '1-UP') {
        // Silence
    }

    /**
     * @dev See {ERC20-_mint}.
     */
    function _mint(address account, uint256 amount) internal virtual override {
        require(ERC20.totalSupply() + amount <= MAX_SUPPLY, '_mint: Cap exceeded!');

        super._mint(account, amount);
    }
}