const hre = require("hardhat")


async function run(){
    console.log("Impersonating accounts")
    await ethers.provider.send("hardhat_impersonateAccount", ["0x0000000000000000000000000000000000000000"])

    console.log("finished impersonating accounts")
}
run()