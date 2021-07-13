const { deployMockContract } = require("ethereum-waffle");
const { deploy1820 } = require("deploy-eip-1820");

const { expect } = require("chai");
const hardhat = require("hardhat");
const { constants } = require("ethers");
const { AddressZero, Zero, One } = require("ethers").constants;

const now = () => (new Date().getTime() / 1000) | 0;
const toWei = (val) => ethers.utils.parseEther("" + val);
const debug = require("debug")("ptv3:PrizeSplit.test");

let overrides = { gasLimit: 9500000 };

describe("PrizeSplit", function() {
  let wallet, wallet2, wallet3, wallet4, wallet5, wallet6;

  let externalERC20Award, externalERC721Award;

  let prizePool, prizeSplitHarness;

  let ticket, sponsorship, rng, rngFeeToken;

  let prizePeriodStart = now();
  let prizePeriodSeconds = 1000;

  beforeEach(async () => {
    [
      wallet,
      wallet2,
      wallet3,
      wallet4,
      wallet5,
      wallet6,
    ] = await hardhat.ethers.getSigners();

    debug({
      wallet: wallet.address,
      wallet2: wallet2.address,
      wallet3: wallet3.address,
      wallet4: wallet4.address,
    });

    debug("mocking tokens...");
    const Ticket = await hre.artifacts.readArtifact("ControlledToken");
    ticket = await deployMockContract(wallet, Ticket.abi, overrides);

    const ControlledToken = await hre.artifacts.readArtifact("ControlledToken");
    sponsorship = await deployMockContract(
      wallet,
      ControlledToken.abi,
      overrides
    );

    debug("deploying prizePool...");
    const PrizePool = await hre.artifacts.readArtifact("PrizePool");
    prizePool = await deployMockContract(wallet, PrizePool.abi, overrides);

    debug("deploying prizeSplit...");
    const PrizeSplitHarness = await hre.ethers.getContractFactory(
      "PrizeSplitHarness",
      wallet,
      overrides
    );

    prizeSplitHarness = await PrizeSplitHarness.deploy();
    await prizeSplitHarness.initialize([])

    debug("initialized!");
  });


  describe("setPrizeSplits()", () => {
    it("should revert when calling setPrizeSplits from a non-owner address", async () => { 
      const prizeSplitConfig = [
        {
          target: wallet5.address,
          percentage: 55,
          token: 1,
        },
        {
          target: wallet6.address,
          percentage: 120,
          token: 0,
        },
      ];

      prizeSplitHarness = await prizeSplitHarness.connect(wallet5);
      await expect(prizeSplitHarness.setPrizeSplits(prizeSplitConfig))
      .to.be.revertedWith("Ownable: caller is not the owner");
    })
    
    it("should revert when calling setPrizeSplit from a non-owner address", async () => { 
      const prizeSplitsConfig = [
        {
          target: wallet5.address,
          percentage: 55,
          token: 1,
        },
        {
          target: wallet6.address,
          percentage: 120,
          token: 0,
        },
      ];

      await prizeSplitHarness.setPrizeSplits(prizeSplitsConfig)
      
      const prizeSplitConfig ={
        target: wallet6.address,
        percentage: 500,
        token: 0,
      }
      prizeSplitHarness = await prizeSplitHarness.connect(wallet5);
      await expect(prizeSplitHarness.setPrizeSplit(prizeSplitConfig, 0))
      .to.be.revertedWith('Ownable: caller is not the owner');
    })

    it("should revert with invalid prize split target address", async () => {
      await expect(
        prizeSplitHarness.setPrizeSplits([
          {
            target: constants.AddressZero,
            percentage: 100,
            token: 0,
          },
        ])
      ).to.be.revertedWith(
        "MultipleWinners/invalid-prizesplit-target"
      );
    });

    it("should revert with single prize split config is equal to or above 100% percent", async () => {
      await expect(
        prizeSplitHarness.setPrizeSplits([
          {
            target: wallet5.address,
            percentage: "1005",
            token: 0,
          },
        ])
      ).to.be.revertedWith(
        "MultipleWinners/invalid-prizesplit-percentage"
      );
    });

    it("should revert when multuple prize split configs is above 100% percent", async () => {
      await expect(
        prizeSplitHarness.setPrizeSplits([
          {
            target: wallet5.address,
            percentage: 500,
            token: 0,
          },
          {
            target: wallet6.address,
            percentage: 501,
            token: 0,
          },
        ])
      ).to.be.revertedWith("MultipleWinners/invalid-prizesplit-percentage-total");
    });

    it("should revert with invalid prize split token enum", async () => {
      await expect(
        prizeSplitHarness.setPrizeSplits([
          {
            target: wallet5.address,
            percentage: 500,
            token: 2,
          },
          {
            target: wallet6.address,
            percentage: 200,
            token: 0,
          },
        ])
      ).to.be.revertedWith('MultipleWinners/invalid-prizesplit-token')
    });

    it("should revert when setting a non-existent prize split config", async () => {
      await prizeSplitHarness.setPrizeSplits([
        {
          target: wallet5.address,
          percentage: 500,
          token: 0,
        },
      ])

      await expect(
        prizeSplitHarness.setPrizeSplit(
          {
            target: wallet5.address,
            percentage: 300,
            token: 0,
          },
          1
      )
      ).to.be.revertedWith(
        "MultipleWinners/nonexistent-prizesplit"
      );
    });

    it("should set two split prize winners using valid percentages", async () => {
      await expect(prizeSplitHarness.setPrizeSplits([
        {
          target: wallet5.address,
          percentage: 50,
          token: 0,
        },
        {
          target: wallet6.address,
          percentage: 500,
          token: 1,
        },
      ]))
      .to.emit(prizeSplitHarness, "PrizeSplitSet")

      const prizeSplits = await prizeSplitHarness.prizeSplits();

      // First Prize Split
      expect(prizeSplits[0].target)
      .to.equal(wallet5.address)
      expect(prizeSplits[0].percentage)
      .to.equal(50)
      expect(prizeSplits[0].token)
      .to.equal(0)
      
      // Second Prize Split
      expect(prizeSplits[1].target)
      .to.equal(wallet6.address)
      expect(prizeSplits[1].percentage)
      .to.equal(500)
      expect(prizeSplits[1].token)
      .to.equal(1)
    });

    it("should set two split prize configs and update the first prize split config", async () => {
      await prizeSplitHarness.setPrizeSplits([
        {
          target: wallet5.address,
          percentage: 50,
          token: 0,
        },
        {
          target: wallet6.address,
          percentage: 500,
          token: 0,
        },
      ]);      
      await prizeSplitHarness.setPrizeSplit(
        {
          target: wallet5.address,
          percentage: 150,
          token: 1,
        }, 
        0
      );

      const prizeSplits = await prizeSplitHarness.prizeSplits();
      
      // First Prize Split
      expect(prizeSplits[0].target)
      .to.equal(wallet5.address)
      expect(prizeSplits[0].percentage)
      .to.equal(150)
      expect(prizeSplits[0].token)
      .to.equal(1)

      // Second Prize Split
      expect(prizeSplits[1].target)
      .to.equal(wallet6.address)
      expect(prizeSplits[1].percentage)
      .to.equal(500)
      expect(prizeSplits[1].token)
      .to.equal(0)
    });

    it("should set two split prize config and add a third prize split config", async () => {
      await prizeSplitHarness.setPrizeSplits([
        {
          target: wallet5.address,
          percentage: 50,
          token: 0,
        },
        {
          target: wallet6.address,
          percentage: 500,
          token: 0,
        },
      ]);

      await prizeSplitHarness.setPrizeSplits([
        {
          target: wallet5.address,
          percentage: 50,
          token: 0,
        },
        {
          target: wallet6.address,
          percentage: 500,
          token: 0,
        },
        {
          target: wallet5.address,
          percentage: 150,
          token: 1,
        },
      ])

      const prizeSplits = await prizeSplitHarness.prizeSplits();
      
      // First Prize Split
      expect(prizeSplits[0].target)
      .to.equal(wallet5.address)
      expect(prizeSplits[0].percentage)
      .to.equal(50)
      expect(prizeSplits[0].token)
      .to.equal(0)

      // Second Prize Split
      expect(prizeSplits[1].target)
      .to.equal(wallet6.address)
      expect(prizeSplits[1].percentage)
      .to.equal(500)
      expect(prizeSplits[1].token)
      .to.equal(0)

      // Third Prize Split
      expect(prizeSplits[2].target)
      .to.equal(wallet5.address)
      expect(prizeSplits[2].percentage)
      .to.equal(150)
      expect(prizeSplits[2].token)
      .to.equal(1)

    });

    it("should set two split prize config, update the second prize split config and add a third prize split config", async () => {
      await prizeSplitHarness.setPrizeSplits([
        {
          target: wallet5.address,
          percentage: 50,
          token: 0,
        },
        {
          target: wallet6.address,
          percentage: 500,
          token: 0,
        },
      ]);

      await prizeSplitHarness.setPrizeSplits([
        {
          target: wallet5.address,
          percentage: 50,
          token: 0,
        },
        {
          target: wallet6.address,
          percentage: 300,
          token: 0,
        },
        {
          target: wallet5.address,
          percentage: 150,
          token: 1,
        },
      ])

      const prizeSplits = await prizeSplitHarness.prizeSplits();
      // First Prize Split
      expect(prizeSplits[0].target)
      .to.equal(wallet5.address)
      expect(prizeSplits[0].percentage)
      .to.equal(50)
      expect(prizeSplits[0].token)
      .to.equal(0)

      // Second Prize Split
      expect(prizeSplits[1].target)
      .to.equal(wallet6.address)
      expect(prizeSplits[1].percentage)
      .to.equal(300)
      expect(prizeSplits[1].token)
      .to.equal(0)

      // Third Prize Split
      expect(prizeSplits[2].target)
      .to.equal(wallet5.address)
      expect(prizeSplits[2].percentage)
      .to.equal(150)
      expect(prizeSplits[2].token)
      .to.equal(1)
    });

    it("should set two split prize configs, update the first and remove the second prize split config", async () => {
      await prizeSplitHarness.setPrizeSplits([
        {
          target: wallet5.address,
          percentage: 50,
          token: 0,
        },
        {
          target: wallet6.address,
          percentage: 500,
          token: 0,
        },
      ]);

      await expect(prizeSplitHarness.setPrizeSplits([
        {
          target: wallet5.address,
          percentage: 400,
          token: 0,
        },
      ])).to.emit(prizeSplitHarness, "PrizeSplitRemoved")

      const prizeSplits = await prizeSplitHarness.prizeSplits();
      expect(prizeSplits.length)
      .to.equal(1)

      // First Prize Split
      expect(prizeSplits[0].target)
      .to.equal(wallet5.address)
      expect(prizeSplits[0].percentage)
      .to.equal(400)
      expect(prizeSplits[0].token)
      .to.equal(0)
    });

    it("should set two split prize configs and a remove all prize split configs", async () => {
      await prizeSplitHarness.setPrizeSplits([
        {
          target: wallet5.address,
          percentage: 50,
          token: 0,
        },
        {
          target: wallet6.address,
          percentage: 500,
          token: 0,
        },
      ]);
      await expect(prizeSplitHarness.setPrizeSplits([]))
      .to.emit(prizeSplitHarness, "PrizeSplitRemoved").withArgs(0)

      const prizeSplits = await prizeSplitHarness.prizeSplits();
      expect(prizeSplits.length)
      .to.equal(0)
    });
  });

  describe("simulates distribute() using tickets and sponsorship tokens", () => {
    beforeEach(async () => {

      const Ticket = await hre.ethers.getContractFactory(
        "Ticket",
        wallet,
        overrides
      );
      
      const Sponsorship = await hre.ethers.getContractFactory(
        "ControlledToken",
        wallet,
        overrides
        );
        
      ticket = await Ticket.deploy();
      sponsorship = await Sponsorship.deploy();
      
      debug("deploying prizeSplit...");
      const PrizeSplitHarness = await hre.ethers.getContractFactory(
        "PrizeSplitHarness",
        wallet,
        overrides
      );

      prizeSplitHarness = await PrizeSplitHarness.deploy();
      prizeSplitHarness.initialize([ticket.address, sponsorship.address]);
      await ticket.initialize("Ticket", "TICK", 18, prizeSplitHarness.address);
      await sponsorship.initialize("Sponsorship", "SPON", 18, prizeSplitHarness.address);
    })

    it("should distribute 100% of award prize splits to individual targets", async () => {
      const prizeSplitConfig = [
        {
          target: wallet5.address,
          percentage: "1000",
          token: 0,
        },
      ];

      // Set Split Prize Configuration
      await prizeSplitHarness.setPrizeSplits(prizeSplitConfig);

      const distributePrizeAmount = toWei('100')
      const remainingPrizeAmount = await prizeSplitHarness.callStatic.distribute(distributePrizeAmount);

      // Validate remaining prize amount after distribution.
      expect(remainingPrizeAmount)
        .to.equal(toWei('0'))
      
      // Distribute Prize Amount
      await prizeSplitHarness.distribute(distributePrizeAmount);
      const balanceWallet5 = await ticket.balanceOf(wallet5.address)
      const balanceWallet6 = await sponsorship.balanceOf(wallet6.address)

      // Validate prize split distribution amounts.
      expect(balanceWallet5)
        .to.equal(toWei('100'))
      
    });

    it("should distribute 17.5% of total award to multiple prize splits targets", async () => {
      const prizeSplitConfig = [
        {
          target: wallet5.address,
          percentage: 55,
          token: 0,
        },
        {
          target: wallet6.address,
          percentage: 120,
          token: 1,
        },
      ];

      // Set Split Prize Configuration
      await prizeSplitHarness.setPrizeSplits(prizeSplitConfig);

      const distributePrizeAmount = toWei('100')
      const remainingPrizeAmount = await prizeSplitHarness.callStatic.distribute(distributePrizeAmount);

      // Validate remaining prize amount after distribution.
      expect(remainingPrizeAmount)
        .to.equal(toWei('82.5'))
      
      // Distribute Prize Amount
      await prizeSplitHarness.distribute(distributePrizeAmount);
      const balanceWallet5 = await ticket.balanceOf(wallet5.address)
      const balanceWallet6 = await sponsorship.balanceOf(wallet6.address)

      // Validate prize split distribution amounts.
      expect(balanceWallet5)
        .to.equal(toWei('5.5'))
      
      expect(balanceWallet6)
        .to.equal(toWei('12'))
    });
  });
});
