import { deployContract } from 'ethereum-waffle';
import { waffle } from "@nomiclabs/buidler";
import PrizePoolFactory from "../build/PrizePoolFactory.json";
import PrizePool from "../build/PrizePool.json";
import ERC20Mintable from "../build/ERC20Mintable.json";
import CTokenMock from "../build/CTokenMock.json";
import TicketToken from "../build/TicketToken.json";
import SingleRandomWinnerPrizeStrategy from "../build/SingleRandomWinnerPrizeStrategy.json";
import chai from 'chai'
import { ethers } from 'ethers'

const provider = waffle.provider;
const [wallet, otherWallet] = provider.getWallets();

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe("PrizePool contract", function() {

  beforeEach(async () => {
    const prizePoolFactory = await deployContract(wallet, PrizePoolFactory, []);
    const prizePool = await deployContract(wallet, PrizePool, []);
    // const token = await deployContract(wallet, ERC20Mintable, [])
    // const cTokenMock = await deployContract(wallet, CTokenMock, [token.address, ethers.utils.parseEther('0.01')])
    // const ticketToken = await deployContract(wallet, TicketToken, [
    //   prizePool.address,
    //   "Token",
    //   "TOK",
    //   []
    // ]);
    // const prizeStrategy = await deployContract(wallet, SingleRandomWinnerPrizeStrategy, [
    //   prizePool.address,
    //   1
    // ])
    // await prizePool.initialize(
    //   prizeStrategy.address,
    //   prizePoolFactory.address,
    //   cTokenMock.address,
    //   ticketToken.address,
    //   ethers.utils.parseEther('0.1'),
    //   '0'
    // )
  })

  describe("Deployment", function() {
    it("Should work", async function() {
      // const prizePool = await deployContract(wallet, PrizePool, ["Hello, world!"]);
      // chai.assert.equal(await prizePool.greet(), "Hello, world!");
    });
  });
});
