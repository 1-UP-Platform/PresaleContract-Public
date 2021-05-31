# 1-UP contracts

### Install

Clone this repository: <br>
`git clone https://github.com/1-up-platform/PresaleContract-Public.git`

Install dependencies: <br>
`cd PresaleContract-Public && npm install`

### Tests

The project uses [HardHat](https://hardhat.org/), so all additional methods and plugins can bee found on their [documentation](https://hardhat.org/getting-started/).  <br><br>
For UNIT tests run: <br>
`npx hardhat test`


### Deploy
Before running deployment you need to write out setup variables. Run `cp .env.example .env` and write down all params of `.env` file. Then go to `./scripts/deploy.js` and write down **preSaleFundAddr** address.<br> Rinkeby and Mainnet are supported, for deploy run: <br>
`npx hardhat run scripts/deploy.js --network [NETWORK]` (`rinkeby` or `mainnet`)
