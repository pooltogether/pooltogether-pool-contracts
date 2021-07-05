const hardhat = require('hardhat')
const toWei = ethers.utils.parseEther

async function getEvents(contract, tx) {
    let receipt = await ethers.provider.getTransactionReceipt(tx.hash);
    return receipt.logs.reduce((parsedEvents, log) => {
        try {
            parsedEvents.push(contract.interface.parseLog(log));
        } catch (e) { }
        return parsedEvents;
    }, []);
}

async function run() {
    const overrides = { gasLimit: 9500000 }
    let wallet, wallet2, wallet3, wallet4
    let usdt
    let prizePool
    let poolWithMultipleWinnersBuilder;
    let compoundPrizePoolABI;

    [wallet, wallet2, wallet3, wallet4] = await hardhat.ethers.getSigners()

    usdt = await ethers.getContractAt('IERC20Upgradeable', '0xdAC17F958D2ee523a2206206994597C13D831ec7')
    const usdtOwner = await ethers.provider.getUncheckedSigner('0xc6cde7c39eb2f0f0095f41570af89efc2c1ea828')

    await usdt.connect(usdtOwner).transfer(wallet.address, 10 ** 10)
    
    // deploy all the pool together.
    const TicketProxyFactory = await ethers.getContractFactory(
        "TicketProxyFactory"
    );
    const ticketProxyFactory = await TicketProxyFactory.deploy({
        gasLimit: 9500000,
    });

    const ControlledTokenProxyFactory = await ethers.getContractFactory(
        "ControlledTokenProxyFactory"
    );
    const controlledTokenProxyFactory = await ControlledTokenProxyFactory.deploy(
        { gasLimit: 9500000 }
    );

    const ControlledTokenBuilder = await ethers.getContractFactory(
        "ControlledTokenBuilder"
    );
    const controlledTokenBuilder = await ControlledTokenBuilder.deploy(
        ticketProxyFactory.address,
        controlledTokenProxyFactory.address,
        { gasLimit: 9500000 }
    );

    const MultipleWinnersProxyFactory = await ethers.getContractFactory(
        "MultipleWinnersProxyFactory"
    );
    const multipleWinnersProxyFactory = await MultipleWinnersProxyFactory.deploy(
        { gasLimit: 9500000 }
    );

    const MultipleWinnersBuilder = await ethers.getContractFactory(
        "MultipleWinnersBuilder"
    );
    const multipleWinnersBuilder = await MultipleWinnersBuilder.deploy(
        multipleWinnersProxyFactory.address,
        controlledTokenBuilder.address,
        { gasLimit: 9500000 }
    );

    const StakePrizePoolProxyFactory = await ethers.getContractFactory(
        "StakePrizePoolProxyFactory"
    );
    const stakePrizePoolProxyFactory = await StakePrizePoolProxyFactory.deploy({
        gasLimit: 9500000,
    });

    const YieldSourcePrizePoolProxyFactory = await ethers.getContractFactory(
        "YieldSourcePrizePoolProxyFactory"
    );
    const yieldSourcePrizePoolProxyFactory = await YieldSourcePrizePoolProxyFactory.deploy(
        { gasLimit: 9500000 }
    );

    const CompoundPrizePoolProxyFactory = await ethers.getContractFactory(
        "CompoundPrizePoolProxyFactory"
    );
    const compoundPrizePoolProxyFactory = await CompoundPrizePoolProxyFactory.deploy(
        { gasLimit: 9500000 }
    );

    const Registry = await ethers.getContractFactory("Registry");
    const registry = await Registry.deploy({ gasLimit: 9500000 });

    const PoolWithMultipleWinnersBuilder = await ethers.getContractFactory(
        "PoolWithMultipleWinnersBuilder"
    );
    poolWithMultipleWinnersBuilder = await PoolWithMultipleWinnersBuilder.deploy(
        registry.address,
        compoundPrizePoolProxyFactory.address,
        yieldSourcePrizePoolProxyFactory.address,
        stakePrizePoolProxyFactory.address,
        multipleWinnersBuilder.address,
        { gasLimit: 9500000 }
    );

    let RGNFactory = await ethers.getContractFactory("RNGServiceMock");
    let rngServiceMock = await RGNFactory.deploy({ gasLimit: 9500000 });
    let decimals = 9;

    const compoundPrizePoolConfig = {
        cToken: "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9",
        maxExitFeeMantissa: toWei("0.5")
    }
    const multipleWinnersConfig = {
        rngService: rngServiceMock.address,
        prizePeriodStart: 0,
        prizePeriodSeconds: 100,
        ticketName: "test",
        ticketSymbol: "test",
        sponsorshipName: "test",
        sponsorshipSymbol: "test",
        ticketCreditLimitMantissa: toWei("0.1"),
        ticketCreditRateMantissa: toWei("0.1"),
        externalERC20Awards: [],
        numberOfWinners: 1,
    };

    let tx = await poolWithMultipleWinnersBuilder.createCompoundMultipleWinners(compoundPrizePoolConfig, multipleWinnersConfig, decimals)
    
    let events = await getEvents(poolWithMultipleWinnersBuilder, tx);
    
    let prizePoolCreatedEvent = events.find(
        (e) => e.name == "CompoundPrizePoolWithMultipleWinnersCreated"
        );

    compoundPrizePoolABI = (
        await hre.artifacts.readArtifact("CompoundPrizePool")
      ).abi;

    prizePool = await hardhat.ethers.getContractAt(
        compoundPrizePoolABI,
        prizePoolCreatedEvent.args.prizePool,
        wallet
    );

    let [token] = await prizePool.tokens();

    await usdt.approve(prizePool.address, 10 ** 9)

    await prizePool.depositTo(
        wallet.address,
        10 ** 8,
        token,
        wallet.address
    );
    console.log("First deposit successful")

    // Make a second deposit.
    await prizePool.depositTo(
        wallet.address,
        10 ** 8,
        token,
        wallet.address
    );
    console.log("Second deposit successful")
}

run()