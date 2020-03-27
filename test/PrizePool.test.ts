import { deployContract } from 'ethereum-waffle';
import { waffle } from "@nomiclabs/buidler";
import PrizePool from "../build/PrizePool.json";
import CTokenMock from "../build/CTokenMock.json";
import chai from 'chai'

const provider = waffle.provider;
const [wallet, otherWallet] = provider.getWallets();

// Vanilla Mocha test. Increased compatibility with tools that integrate Mocha.
describe("PrizePool contract", function() {
  describe("Deployment", function() {
    it("Should deploy with the right greeting", async function() {
      const prizePool = await deployContract(wallet, PrizePool, ["Hello, world!"]);
      chai.assert.equal(await prizePool.greet(), "Hello, world!");
    });
  });
});
