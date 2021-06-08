const { expect } = require('chai');
const parseEther = ethers.utils.parseEther;

describe('End-to-end test', function () {

  // Contracts
  let oneUp, liquidityProvider, investorsVesting, publicSale, uniswapMock, lpTokenMock;
  // Addresses
  let owner, investor1, investor2, investor3, investor4, investor5, badActor, timelockReceiver, preSaleFundAddr;
  // Helpers
  let minterRoleHash, adminRoleHash, incrementedTime = 0;

  const second = 1;
  const minute = second * 60;
  const hour = minute * 60;
  const day = hour * 24;
  const month = day * 30;
  const year = month * 12;

  const increaseTime = async function(timeSpan, number) {
    const toIncrement = timeSpan * number;
    incrementedTime += toIncrement;
    await network.provider.send('evm_increaseTime', [toIncrement]);
    await network.provider.send('evm_mine');
  }

  before(async function () {
    const OneUp = await ethers.getContractFactory('OneUp');
    const PublicSale = await ethers.getContractFactory('PublicSale');
    const LiquidityProvider = await ethers.getContractFactory('LiquidityProvider');
    const InvestorsVesting = await ethers.getContractFactory('InvestorsVesting');
    const MockUniswap = await ethers.getContractFactory('MockUniswap');

    [owner, investor1, investor2, investor3, investor4, investor5, badActor, timelockReceiver, preSaleFundAddr] = await ethers.getSigners();

    // Deploy token
    oneUp = await OneUp.deploy();
    await oneUp.deployed();

    // Deploy mock uniswap router
    uniswapMock = await MockUniswap.deploy();
    await uniswapMock.deployed();

    // Deploy public sale
    publicSale = await PublicSale.deploy(oneUp.address, preSaleFundAddr.address, uniswapMock.address);
    await publicSale.deployed()

    // Create investors vesting contract instance
    investorsVesting = await InvestorsVesting.attach(await publicSale.vesting());

    // Create liquidity provider contract instance
    liquidityProvider = await LiquidityProvider.attach(await publicSale.lpProvider());

    // Add minters
    minterRoleHash = await oneUp.MINTER_ROLE();
    adminRoleHash = await oneUp.DEFAULT_ADMIN_ROLE();
    await oneUp.grantRole(minterRoleHash, investorsVesting.address);
    await oneUp.grantRole(minterRoleHash, liquidityProvider.address);
    await oneUp.grantRole(minterRoleHash, publicSale.address);
  })

  describe('Initial checks', async function () {
    it('Check TOKEN details', async function () {
      expect(await oneUp.name()).to.be.eq('1-UP')
      expect(await oneUp.symbol()).to.be.eq('1-UP')
      expect(await oneUp.decimals()).to.be.eq(18)
      expect(await oneUp.totalSupply()).to.be.eq(0)
      expect(await oneUp.hasRole(adminRoleHash, owner.address)).to.be.eq(true)
      expect(await oneUp.hasRole(minterRoleHash, liquidityProvider.address)).to.be.eq(true)
      expect(await oneUp.hasRole(minterRoleHash, liquidityProvider.address)).to.be.eq(true)
    })

    it('Check PUBLIC SALE details', async function () {
      expect(await publicSale.oneUpToken()).to.be.eq(oneUp.address)
      expect(await publicSale.owner()).to.be.eq(owner.address)
      expect(await publicSale.oneUpToken()).to.be.eq(oneUp.address)
      expect(await publicSale.privateSaleFinished()).to.be.eq(false)
      expect(await publicSale.totalDeposits()).to.be.eq(0)
    })

    it('Check INVESTORS VESTING details', async function () {
      expect(await investorsVesting.oneUpToken()).to.be.eq(oneUp.address)
      expect(await investorsVesting.owner()).to.be.eq(publicSale.address)
    })

    it('Check LIQUIDITY PROVIDER details', async function () {
      expect(await liquidityProvider.owner()).to.be.eq(publicSale.address)
      expect(await liquidityProvider.uniswap()).to.be.eq(uniswapMock.address)
      expect(await liquidityProvider.oneUpToken()).to.be.eq(oneUp.address)
    })
  })

  describe('Private sale checks', async function () {
    it('Add investors', async function () {
      await publicSale.addPrivateAllocations([investor1.address, investor2.address], [parseEther('1000'), parseEther('2000')])
      const investor1Data = await investorsVesting.getUserData(investor1.address)
      const investor2Data = await investorsVesting.getUserData(investor2.address)

      expect(investor1Data.tgeAmount).to.be.eq(parseEther('150'))
      expect(investor1Data.releasedLockedTokens).to.be.eq('0')
      expect(investor1Data.totalLockedTokens).to.be.eq(parseEther('850'))

      expect(investor2Data.tgeAmount).to.be.eq(parseEther('300'))
      expect(investor2Data.releasedLockedTokens).to.be.eq('0')
      expect(investor2Data.totalLockedTokens).to.be.eq(parseEther('1700'))
    })

    it('Check vesting contract and token balances', async function () {
      expect(await oneUp.balanceOf(investorsVesting.address)).to.be.eq(parseEther('0'))
      expect(await oneUp.balanceOf(investor1.address)).to.be.eq(parseEther('0'))
      expect(await oneUp.balanceOf(investor1.address)).to.be.eq(parseEther('0'))
      expect(await oneUp.totalSupply()).to.be.eq('0')
    })

    it('Private investors want to claim before time reached', async function () {
      await expect(investorsVesting.connect(investor1).claimTgeTokens()).to.be.revertedWith('claimTgeTokens: TGE tokens not available now!');
      await expect(investorsVesting.connect(investor2).claimLockedTokens()).to.be.revertedWith('claimLockedTokens: Locked tokens not available now!');
    })

    it('Public investors trying to invest during the private sale', async function () {
      await expect(investor3.sendTransaction({
          to: publicSale.address,
          value: parseEther('17')
      })).to.be.revertedWith('PublicSale: Private sale not finished yet!');
    })

    it('Hacker wants to add himself as private sale investor', async function () {
      await expect(publicSale.connect(badActor).addPrivateAllocations([investor1.address, investor2.address], [parseEther('10'), parseEther('20')])).to.be.revertedWith('Ownable: caller is not the owner');
    })
  })

  describe('Public sale checks', async function () {
    it('Finish private sale', async function () {
      await publicSale.endPrivateSale()

      expect(await publicSale.privateSaleFinished()).to.be.eq(true)
      expect(await publicSale.publicSaleStartTimestamp()).to.not.eq(0)
    })

    it('Non whitelisted user trying to send ETH', async function () {
      await expect(investor3.sendTransaction({
        to: publicSale.address,
        value: parseEther('0.5')
      })).to.be.revertedWith('PublicSale: Its time for whitelisted investors only!');
    })

    it('Whitelist users', async function () {
      expect(await publicSale.getWhitelistedAmount(investor3.address)).to.be.eq('0');
      expect(await publicSale.getWhitelistedAmount(investor4.address)).to.be.eq('0');

      await publicSale.connect(owner).whitelistUsers([investor3.address], parseEther('0.5'));
      await publicSale.connect(owner).whitelistUsers([investor4.address], parseEther('1'));
      await publicSale.connect(owner).whitelistUsers([investor5.address], parseEther('1'));

      expect(await publicSale.getWhitelistedAmount(investor3.address)).to.be.eq(parseEther('0.5'));
      expect(await publicSale.getWhitelistedAmount(investor4.address)).to.be.eq(parseEther('1'));
    })

    it('Min and max limits validation', async function () {
      await expect(investor3.sendTransaction({
        to: publicSale.address,
        value: parseEther('0.01')
      })).to.be.revertedWith('PublicSale: Limit is reached or not enough amount!');

      await expect(investor3.sendTransaction({
        to: publicSale.address,
        value: parseEther('100')
      })).to.be.revertedWith('PublicSale: Limit is reached or not enough amount!');
    })

    it('Deposit amounts and check the state', async function () {
      await investor3.sendTransaction({
        to: publicSale.address,
        value: parseEther('0.5')
      })

      await investor4.sendTransaction({
        to: publicSale.address,
        value: parseEther('0.5')
      })

      await investor5.sendTransaction({
        to: publicSale.address,
        value: parseEther('0.5')
      })

      const investor3Data = await investorsVesting.getUserData(investor3.address)
      const investor4Data = await investorsVesting.getUserData(investor4.address)

      const investor3TotalTokens = 0.5 * 151000
      expect(investor3Data.tgeAmount).to.be.eq(parseEther((investor3TotalTokens / 2).toString()))
      expect(investor3Data.releasedLockedTokens).to.be.eq('0')
      expect(investor3Data.totalLockedTokens).to.be.eq(parseEther((investor3TotalTokens / 2).toString()))
      expect(await publicSale.getWhitelistedAmount(investor3.address)).to.be.eq(0)
      expect(await publicSale.getUserDeposits(investor3.address)).to.be.eq(parseEther('0.5'))

      const investor4TotalTokens = 0.5 * 151000
      expect(investor4Data.tgeAmount).to.be.eq(parseEther((investor4TotalTokens / 2).toString()))
      expect(investor4Data.releasedLockedTokens).to.be.eq('0')
      expect(investor4Data.totalLockedTokens).to.be.eq(parseEther((investor4TotalTokens / 2).toString()))
      expect(await publicSale.getWhitelistedAmount(investor4.address)).to.be.eq(parseEther('0.5'))
      expect(await publicSale.getUserDeposits(investor4.address)).to.be.eq(parseEther('0.5'))
    })

    it('Private investors want to claim during the public sale', async function () {
      await expect(investorsVesting.connect(investor1).claimTgeTokens()).to.be.revertedWith('claimTgeTokens: TGE tokens not available now!');
      await expect(investorsVesting.connect(investor2).claimLockedTokens()).to.be.revertedWith('claimLockedTokens: Locked tokens not available now!');
    })

    it('Owner wants to add new private sale investor', async function () {
      await expect(publicSale.connect(owner).addPrivateAllocations([badActor.address], [parseEther('10'), parseEther('20')])).to.be.revertedWith('addPrivateAllocations: Private sale is ended!');
    })

    it('Check deposited ETH balance', async function () {
      // expect(await network.provider.getBalance(publicSale.address)).to.be.eq(parseEther('13'))
    })
  })

  describe('Finish public sale (time reached)', async function () {
    it('Increase time', async function () {
      await increaseTime(day, 15)
    })

    it('Close public sale', async function () {
      await publicSale.endPublicSale();
      expect(await publicSale.publicSaleFinishedAt()).to.not.eq(0);
    })

    it('Investors trying to invest after finish', async function () {
      await expect(investor3.sendTransaction({
          to: publicSale.address,
          value: parseEther('17')
      })).to.be.revertedWith('PublicSale: Public sale already ended!');
    })

    it('Owner wants to add new private sale investor', async function () {
      await expect(publicSale.connect(owner).addPrivateAllocations([badActor.address], [parseEther('10'), parseEther('20')])).to.be.revertedWith('addPrivateAllocations: Private sale is ended!');
    })

    it('Investors want to claim before time reached', async function () {
      await expect(investorsVesting.connect(investor1).claimTgeTokens()).to.be.revertedWith('claimTgeTokens: TGE tokens not available now!');
      await expect(investorsVesting.connect(investor2).claimLockedTokens()).to.be.revertedWith('claimLockedTokens: Locked tokens not available now!');
      await expect(investorsVesting.connect(investor3).claimTgeTokens()).to.be.revertedWith('claimTgeTokens: TGE tokens not available now!');
      await expect(investorsVesting.connect(investor4).claimLockedTokens()).to.be.revertedWith('claimLockedTokens: Locked tokens not available now!');
    })

    it('Trying to close public sale second time', async function() {
      await expect(publicSale.endPublicSale()).to.be.revertedWith('endPublicSale: Public sale already finished!');
    })

    it('Trying to add liquidity without waiting 7 days', async function() {
      await expect(publicSale.connect(investor1).addLiquidity()).to.be.revertedWith('addLiquidity: Time was not reached!');
    })

    it('Trying to lock company tokens before lp creation', async function() {
      await expect(publicSale.connect(owner).lockCompanyTokens(timelockReceiver.address, timelockReceiver.address, timelockReceiver.address)).to.be.revertedWith('lockCompanyTokens: Should be called after LP creation!');
    })
  })

  describe('Create liquidity pool and timelock contracts', async function () {
    it('Increase time', async function () {
      await increaseTime(day, 7)
    })

    it('Whitelist contracts for being far from token transfers limitations', async function () {
      await oneUp.whitelistAccount(publicSale.address);
      await oneUp.whitelistAccount(uniswapMock.address);
      await oneUp.whitelistAccount(liquidityProvider.address);
      await oneUp.whitelistAccount('0x0000000000000000000000000000000000000000'); // For minting new tokens this addresss is ffrom
    })

    it('Emergency withdraw test', async function () {
      // Check Investor 1 initial state before claim
      let investor5Data = await investorsVesting.getUserData(investor5.address)
      const investor5TotalTokens = 0.5 * 151000
      expect(investor5Data.tgeAmount).to.be.eq(parseEther((investor5TotalTokens / 2).toString()))
      expect(investor5Data.releasedLockedTokens).to.be.eq('0')
      expect(investor5Data.totalLockedTokens).to.be.eq(parseEther((investor5TotalTokens / 2).toString()))

      let investor5Deposits = await publicSale.getUserDeposits(investor5.address)
      expect(investor5Deposits).to.be.eq(parseEther('0.5'))

      // Increase emergency method required time (1 day)
      await increaseTime(hour, 25)

      // Call emergency exit method
      await publicSale.connect(investor5).emergencyWithdrawFunds()

      // Check Investor 1 initial state before claim
      investor5Data = await investorsVesting.getUserData(investor5.address)
      expect(investor5Data.tgeAmount).to.be.eq('0')
      expect(investor5Data.releasedLockedTokens).to.be.eq('0')
      expect(investor5Data.totalLockedTokens).to.be.eq('0')

      investor5Deposits = await publicSale.getUserDeposits(investor5.address)
      expect(investor5Deposits).to.be.eq('0')
    })

    it('Calling emergency withdraw will be failed 2nd time', async function () {
      await expect(publicSale.connect(investor5).emergencyWithdrawFunds()).to.be.revertedWith('emergencyWithdrawFunds: No funds to receive!');
    })

    it('Create liquidity pool', async function () {
      await publicSale.connect(investor1).addLiquidity()
      expect(await publicSale.liquidityPoolCreated()).to.be.eq(true);
      expect(await oneUp.balanceOf(uniswapMock.address)).to.be.eq(parseEther((0.7 * 120000).toString())) // 0.7 ETH sent to Uniswap (half of total investments), with rate 120.000 tokens per ETH

      const MockLiquidityToken = await ethers.getContractFactory('MockLiquidityToken');
      lpTokenMock = await MockLiquidityToken.attach(await uniswapMock.lpToken())
      expect(await lpTokenMock.balanceOf(liquidityProvider.address)).to.be.eq(parseEther('100')) // Locked LP tokens
    })

    it('Create timelock contracts and check the balances', async function () {
      await publicSale.lockCompanyTokens(timelockReceiver.address, timelockReceiver.address, timelockReceiver.address)
      let developerLockContract = await publicSale.developerLockContract()
      let marketingLockContract = await publicSale.marketingLockContract()
      let reserveLockContract = await publicSale.reserveLockContract()

      expect(await oneUp.balanceOf(developerLockContract)).to.be.eq(parseEther('8000000'))
      expect(await oneUp.balanceOf(marketingLockContract)).to.be.eq(parseEther('5000000'))
      expect(await oneUp.balanceOf(reserveLockContract)).to.be.eq(parseEther('1500000'))
    })

    it('Claiming LP tokens before time reach should be failed', async function () {
      await expect(publicSale.connect(owner).recoverLpToken(lpTokenMock.address)).to.be.revertedWith('recoverERC20: You can claim LP tokens after 180 days!');
    })
  })

  describe('Investors claiming TGE tokens', async function () {
    it('Investors claim TGE tokens', async function () {
      const earlierTotalSupply = parseEther((0.7 * 120000 + 8000000 + 5000000 + 1500000).toString())

      // Check Investor 1 initial state before claim
      let investor1Data = await investorsVesting.getUserData(investor1.address)
      expect(investor1Data.tgeAmount).to.be.eq(parseEther('150'))
      expect(investor1Data.releasedLockedTokens).to.be.eq('0')
      expect(investor1Data.totalLockedTokens).to.be.eq(parseEther('850'))
      expect(await oneUp.balanceOf(investor1.address)).to.be.eq('0')
      expect(await oneUp.totalSupply()).to.be.eq(earlierTotalSupply)

      // Claim
      await investorsVesting.connect(investor1).claimTgeTokens()

      // Check state after claiming
      investor1Data = await investorsVesting.getUserData(investor1.address)
      expect(investor1Data.tgeAmount).to.be.eq('0')
      expect(investor1Data.releasedLockedTokens).to.be.eq('0')
      expect(investor1Data.totalLockedTokens).to.be.eq(parseEther('850'))
      expect(await oneUp.balanceOf(investor1.address)).to.be.eq(parseEther('150'))
      expect(await oneUp.totalSupply()).to.be.eq(earlierTotalSupply.add(parseEther('150')))

      // Check Investor 2 initial state before claim
      let investor2Data = await investorsVesting.getUserData(investor2.address)
      expect(investor2Data.tgeAmount).to.be.eq(parseEther('300'))
      expect(investor2Data.releasedLockedTokens).to.be.eq('0')
      expect(investor2Data.totalLockedTokens).to.be.eq(parseEther('1700'))
      expect(await oneUp.balanceOf(investor2.address)).to.be.eq('0')
      expect(await oneUp.totalSupply()).to.be.eq(earlierTotalSupply.add(parseEther('150')))

      // Claim
      await investorsVesting.connect(investor2).claimTgeTokens()

      // Check Investor 2 state after claim
      investor2Data = await investorsVesting.getUserData(investor2.address)
      expect(investor2Data.tgeAmount).to.be.eq('0')
      expect(investor2Data.releasedLockedTokens).to.be.eq('0')
      expect(investor2Data.totalLockedTokens).to.be.eq(parseEther('1700'))
      expect(await oneUp.balanceOf(investor2.address)).to.be.eq(parseEther('300'))
      expect(await oneUp.totalSupply()).to.be.eq(earlierTotalSupply.add(parseEther('450')))
    })

    it('Claiming 2nd time will be failed', async function () {
      await expect(investorsVesting.connect(investor1).claimTgeTokens()).to.be.revertedWith('claimTgeTokens: No available tokens!');
      await expect(investorsVesting.connect(investor2).claimTgeTokens()).to.be.revertedWith('claimTgeTokens: No available tokens!');
    })

    it('Calling emergency withdraw after liquidity pool creation should be failed', async function () {
      await expect(publicSale.connect(investor1).emergencyWithdrawFunds()).to.be.revertedWith('emergencyWithdrawFunds: Liquidity pool already created!');
    })
  })

  describe('Investors claiming locked tokens', async function () {
    it('Increase time', async function () {
      await increaseTime(month, 1)
    })

    it('Investors claim locked tokens', async function () {
      let earlierTotalSupply = parseEther((0.7 * 120000 + 8000000 + 5000000 + 1500000 + 450).toString())

      // Check Investor 1 initial state before claim
      let investor1Data = await investorsVesting.getUserData(investor1.address)
      let isPrivileged = await investorsVesting.isPrivilegedInvestor(investor1.address)
      expect(investor1Data.tgeAmount).to.be.eq(parseEther('0'))
      expect(investor1Data.releasedLockedTokens).to.be.eq('0')
      expect(investor1Data.totalLockedTokens).to.be.eq(parseEther('850'))
      expect(await oneUp.balanceOf(investor1.address)).to.be.eq(parseEther('150'))
      expect(await oneUp.totalSupply()).to.be.eq(earlierTotalSupply)

      // Claim
      await investorsVesting.connect(investor1).claimLockedTokens()

      // Check state after claiming
      investor1Data = await investorsVesting.getUserData(investor1.address)
      const receivedTokens = investor1Data.releasedLockedTokens
      earlierTotalSupply = earlierTotalSupply.add(receivedTokens)

      expect(investor1Data.tgeAmount).to.be.eq('0')
      expect(investor1Data.totalLockedTokens).to.be.eq(parseEther('850'))
      expect(await oneUp.balanceOf(investor1.address)).to.be.eq(parseEther('150').add(receivedTokens))
      expect(await oneUp.totalSupply()).to.be.eq(earlierTotalSupply)
      expect(await investorsVesting.getReleasableLockedTokens(investor1.address)).to.be.eq('0')

      // Increase until lock finish
      await increaseTime(month, 3)

      // Claim
      await investorsVesting.connect(investor1).claimLockedTokens()

      // Check state after claiming
      investor1Data = await investorsVesting.getUserData(investor1.address)
      isPrivileged = await investorsVesting.isPrivilegedInvestor(investor1.address)
      expect(investor1Data.tgeAmount).to.be.eq('0')
      expect(investor1Data.totalLockedTokens).to.be.eq(parseEther('850'))
      expect(investor1Data.releasedLockedTokens).to.be.eq(parseEther('850'))
      expect(isPrivileged).to.be.eq(false)
      expect(await oneUp.balanceOf(investor1.address)).to.be.eq(parseEther('1000'))
      expect(await investorsVesting.getReleasableLockedTokens(investor1.address)).to.be.eq('0')
    })

    it('Investor who claim after finish becomes privileged', async function () {
      let isPrivileged = await investorsVesting.isPrivilegedInvestor(investor2.address)
      expect(isPrivileged).to.be.eq(false)

      // Claim
      await investorsVesting.connect(investor2).claimLockedTokens()

      isPrivileged = await investorsVesting.isPrivilegedInvestor(investor2.address)
      expect(isPrivileged).to.be.eq(true)
    })
  })

  describe('Company receives timelock tokens', async function () {
    it('Claim locked marketing tokens', async function () {
      const CliffVesting = await ethers.getContractFactory('CliffVesting');

      let marketingLockContract = CliffVesting.attach(await publicSale.marketingLockContract())

      expect(await oneUp.balanceOf(timelockReceiver.address)).to.be.eq('0')
      expect(await oneUp.balanceOf(marketingLockContract.address)).to.be.eq(parseEther('5000000'))

      await marketingLockContract.connect(badActor).release() // anyone can call this method

      expect(await oneUp.balanceOf(timelockReceiver.address)).to.be.eq(parseEther('5000000'))
      expect(await oneUp.balanceOf(marketingLockContract.address)).to.be.eq('0')
    })
  })

  describe('Owner unlock LP tokens', async function () {
    it('Increase time', async function () {
      await increaseTime(day, 90)
    })

    it('Owner claim locked LP tokens', async function () {
      expect(await lpTokenMock.balanceOf(owner.address)).to.be.eq('0')
      expect(await lpTokenMock.balanceOf(liquidityProvider.address)).to.be.eq(parseEther('100'))

      await publicSale.connect(owner).recoverLpToken(lpTokenMock.address);

      expect(await lpTokenMock.balanceOf(owner.address)).to.be.eq(parseEther('100'))
      expect(await lpTokenMock.balanceOf(liquidityProvider.address)).to.be.eq('0')
    })
  })

  describe('Check anti-bot validation', async function () {
    it('User trying to transfer tokens twice without delay', async function () {
      await oneUp.connect(investor1).transfer(investor2.address, parseEther('10'))

      // Increase time by 28 seconds, should revert
      await increaseTime(second, 28)
      await expect(oneUp.connect(investor1).transfer(investor2.address, parseEther('10'))).to.be.revertedWith('launchRestrict: Only one tx/min in restricted mode!');

      // Increase time by 2 seconds, should work then
      await increaseTime(second, 2)
      await oneUp.connect(investor1).transfer(investor2.address, parseEther('10'))
    })

    it('Decrease required time to 0', async function () {
      await oneUp.connect(owner).decreaseDelayBetweenTx(0)
      // Doing transfer twice should work without required delay
      await oneUp.connect(investor1).transfer(investor2.address, parseEther('10'))
      await oneUp.connect(investor1).transfer(investor2.address, parseEther('10'))
      await oneUp.connect(investor1).transfer(investor2.address, parseEther('10'))
      await oneUp.connect(investor1).transfer(investor2.address, parseEther('10'))
      await oneUp.connect(investor1).transfer(investor2.address, parseEther('10'))
    })
  })
});
