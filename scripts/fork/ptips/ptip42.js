const hardhat = require('hardhat');
const chalk = require('chalk');

function dim() {
    console.log(chalk.dim.call(chalk, ...arguments));
}

function yellow() {
    console.log(chalk.yellow.call(chalk, ...arguments));
}

function green() {
    console.log(chalk.green.call(chalk, ...arguments));
}

async function run() {
    const { ethers } = hardhat;
    const { provider, utils } = ethers;

    const ethereumMultiSigAddress = '0xDa63D70332139E6A8eCA7513f4b6E2E0Dc93b693';
    await hre.ethers.provider.send('hardhat_impersonateAccount',[ethereumMultiSigAddress]);
    const ethereumMultiSig = provider.getUncheckedSigner(ethereumMultiSigAddress);

    console.log('getting ether rick signer');
    await hre.ethers.provider.send('hardhat_impersonateAccount',['0xDf9Eb223bAFBE5c5271415C75aeCD68C21fE3D7F']);

    const etherRichSigner = provider.getUncheckedSigner('0xDf9Eb223bAFBE5c5271415C75aeCD68C21fE3D7F');
    console.log('impersonated');

    console.log('balance of ether rich: ', await ethers.provider.getBalance('0xDf9Eb223bAFBE5c5271415C75aeCD68C21fE3D7F'));
    await etherRichSigner.sendTransaction({ to: ethereumMultiSig._address, value: ethers.utils.parseEther('10') });

    green(`sent!`);

    // now approve ERC20Predicate for all amounts 4,200 + 4,200 + 5000 = 13,400 POOL
    const ERC20PredicateContractAddress = '0x40ec5B33f54e0E8A33A975908C5BA1c14e5BbbDf';
    const uSDCContract = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    const AMOUNT = '500000';

    const priizePoolContract = '0xde9ec95d7708B8319CCca4b8BC92c0a3B70bf416';
    const prizePool = await ethers.getContractAt('PrizePool', priizePoolContract, ethereumMultiSig);

    await prizePool.withdrawInstantlyFrom(
      ethereumMultiSig._address,
      ethers.utils.parseUnits(AMOUNT, 6),
      '0x391a437196c81eEa7BBbBd5ED4DF6b49De4F5c96',
      1
    );

    const usdcTokenContract = await ethers.getContractAt("ERC20Upgradeable", uSDCContract, ethereumMultiSig);
    await usdcTokenContract.approve(ERC20PredicateContractAddress, ethers.utils.parseUnits(AMOUNT, 6));

    console.log(ethers.utils.parseEther("500000").toString());

    green(`approved!`);

    // now call depositFor() for each amount
    const rootChainManagerAddress ='0xA0c68C638235ee32657e8f720a23ceC1bFc77C77';
    const rootChainManagerContract = await ethers.getContractAt(
      rootChainManagerImplementationAbi,
      rootChainManagerAddress,
      ethereumMultiSig,
    );

    const abiEncoder = ethers.utils.defaultAbiCoder;
    const usdcAmount = utils.parseUnits(AMOUNT, 6);
    const encodedUSDCAmount = abiEncoder.encode(["uint256"], [usdcAmount]);

    console.log('usdc encoded amount', encodedUSDCAmount);

    const polygonSafe = '0x3feE50d2888F2F7106fcdC0120295EBA3ae59245';

    await rootChainManagerContract.depositFor(polygonSafe, uSDCContract, encodedUSDCAmount); // user, rootToken, depositData(abi encoded deposit amount)

    green('done!');
}

run()

const rootChainManagerImplementationAbi = [{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"userAddress","type":"address"},{"indexed":false,"internalType":"address payable","name":"relayerAddress","type":"address"},{"indexed":false,"internalType":"bytes","name":"functionSignature","type":"bytes"}],"name":"MetaTransactionExecuted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"tokenType","type":"bytes32"},{"indexed":true,"internalType":"address","name":"predicateAddress","type":"address"}],"name":"PredicateRegistered","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"previousAdminRole","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"newAdminRole","type":"bytes32"}],"name":"RoleAdminChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleGranted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleRevoked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"rootToken","type":"address"},{"indexed":true,"internalType":"address","name":"childToken","type":"address"},{"indexed":true,"internalType":"bytes32","name":"tokenType","type":"bytes32"}],"name":"TokenMapped","type":"event"},{"inputs":[],"name":"DEFAULT_ADMIN_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DEPOSIT","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ERC712_VERSION","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ETHER_ADDRESS","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"MAPPER_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"MAP_TOKEN","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"checkpointManagerAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"childChainManagerAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"childToRootToken","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"rootToken","type":"address"},{"internalType":"address","name":"childToken","type":"address"}],"name":"cleanMapToken","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"depositEtherFor","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"},{"internalType":"address","name":"rootToken","type":"address"},{"internalType":"bytes","name":"depositData","type":"bytes"}],"name":"depositFor","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"userAddress","type":"address"},{"internalType":"bytes","name":"functionSignature","type":"bytes"},{"internalType":"bytes32","name":"sigR","type":"bytes32"},{"internalType":"bytes32","name":"sigS","type":"bytes32"},{"internalType":"uint8","name":"sigV","type":"uint8"}],"name":"executeMetaTransaction","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"bytes","name":"inputData","type":"bytes"}],"name":"exit","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"getChainId","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"getDomainSeperator","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getNonce","outputs":[{"internalType":"uint256","name":"nonce","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleAdmin","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"uint256","name":"index","type":"uint256"}],"name":"getRoleMember","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleMemberCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"grantRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"hasRole","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_owner","type":"address"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"initializeEIP712","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"rootToken","type":"address"},{"internalType":"address","name":"childToken","type":"address"},{"internalType":"bytes32","name":"tokenType","type":"bytes32"}],"name":"mapToken","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"processedExits","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"tokenType","type":"bytes32"},{"internalType":"address","name":"predicateAddress","type":"address"}],"name":"registerPredicate","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"rootToken","type":"address"},{"internalType":"address","name":"childToken","type":"address"},{"internalType":"bytes32","name":"tokenType","type":"bytes32"}],"name":"remapToken","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"renounceRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"revokeRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"rootToChildToken","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"newCheckpointManager","type":"address"}],"name":"setCheckpointManager","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newChildChainManager","type":"address"}],"name":"setChildChainManagerAddress","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newStateSender","type":"address"}],"name":"setStateSender","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"setupContractId","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"stateSenderAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"tokenToType","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"typeToPredicate","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"stateMutability":"payable","type":"receive"}]
