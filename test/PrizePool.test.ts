import { deployContract, link } from 'ethereum-waffle';
import { waffle } from "@nomiclabs/buidler";
import PrizePoolFactory from "../build/PrizePoolFactory.json";
import PrizePool from "../build/PrizePool.json";
import ERC20Mintable from "../build/ERC20Mintable.json";
import CTokenMock from "../build/CTokenMock.json";
import TicketToken from "../build/TicketToken.json";
import SortitionSumTreeFactory from '../build/SortitionSumTreeFactory.json';
import SingleRandomWinnerPrizeStrategy from "../build/SingleRandomWinnerPrizeStrategy.json";
import { expect } from 'chai'
import { ethers, Contract } from 'ethers'
import { deploy1820 } from 'deploy-eip-1820'
import { linkLibraries } from './helpers/link'

const provider = waffle.provider;
const [wallet, otherWallet] = provider.getWallets();

const toWei = ethers.utils.parseEther

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe("PrizePool contract", function() {
  
  let prizePool: Contract
  let token: Contract
  let ticketToken: Contract
  let prizeStrategy: Contract
  let prizePoolFactory: Contract
  let cToken: Contract

  beforeEach(async () => {
    await deploy1820(wallet)
    prizePoolFactory = await deployContract(wallet, PrizePoolFactory, []);
    prizePool = await deployContract(wallet, PrizePool, []);
    token = await deployContract(wallet, ERC20Mintable, [])
    cToken = await deployContract(wallet, CTokenMock, [])
    await cToken.initialize(token.address, ethers.utils.parseEther('0.01'))
    ticketToken = await deployContract(wallet, TicketToken, [
      prizePool.address,
      "Token",
      "TOK",
      []
    ]);
    const sumTreeFactory = await deployContract(wallet, SortitionSumTreeFactory)
    SingleRandomWinnerPrizeStrategy.bytecode = linkLibraries(SingleRandomWinnerPrizeStrategy.bytecode, [
      { name: 'SortitionSumTreeFactory.sol', address: sumTreeFactory.address }
    ])
    prizeStrategy = await deployContract(wallet, SingleRandomWinnerPrizeStrategy, [
      prizePool.address,
      1
    ])
    await prizePool.initialize(
      prizeStrategy.address,
      prizePoolFactory.address,
      cToken.address,
      ticketToken.address,
      ethers.utils.parseEther('0.1'),
      '0'
    )

    await token.mint(wallet.address, ethers.utils.parseEther('100000'))
  })

  describe("Deployment", function() {
    it('should set all the vars', async () => {
      expect(await prizePool.prizeStrategy()).to.equal(prizeStrategy.address)
      expect(await prizePool.factory()).to.equal(prizePoolFactory.address)
      expect(await prizePool.ticketToken()).to.equal(ticketToken.address)
      expect(await prizePool.cToken()).to.equal(cToken.address)
    })
  })

  describe("Deployment", function() {
    it("Should work", async function () {
      await token.approve(prizePool.address, toWei('1'))
      await prizePool.deposit(toWei('1'))

      expect(await ticketToken.balanceOf(wallet.address)).to.equal(toWei('1'))
    });
  });
});
