
const hre = require("hardhat");
const ethers = hre.ethers;

async function main() {
  // Change with prod addresses before deployment
  const preSaleFundAddr = "" // <-- Address who should receive part oF the Public Sale investments

  const OneUp = await ethers.getContractFactory("OneUp");
  const PublicSale = await ethers.getContractFactory("PublicSale");
  const uniswapRouter = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"; // Unique address for all networks

  oneUp = await OneUp.deploy();
  await oneUp.deployed();
  console.log("1) 1-UP contract:", oneUp.address);

  publicSale = await PublicSale.deploy(oneUp.address, preSaleFundAddr, uniswapRouter);
  await publicSale.deployed()
  console.log("2) Public sale contract:", publicSale.address);

  vestingAddr = await publicSale.vesting();
  console.log("3) Vesting contract:", vestingAddr);

  lpProviderAddr = await publicSale.lpProvider();
  console.log("4) Liquidity contract:", lpProviderAddr);

  minterRoleHash = await oneUp.MINTER_ROLE();
  await oneUp.grantRole(minterRoleHash, vestingAddr);
  console.log("5) Vesting as minter saved!");

  await oneUp.grantRole(minterRoleHash, lpProviderAddr);
  console.log("6) Liquidity as minter saved!");

  await oneUp.grantRole(minterRoleHash, publicSale.address);
  console.log("7) Public sale as minter saved!");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
