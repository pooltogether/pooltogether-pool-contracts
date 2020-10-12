const ethers = require('ethers')

const domainSchema = [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
];

const permitSchema = [
    { name: "holder", type: "address" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "expiry", type: "uint256" },
    { name: "allowed", type: "bool" },
];

async function signPermit(signer, domain, message) {
    let myAddr = await signer.getAddress();

    if (myAddr.toLowerCase() !== message.holder.toLowerCase()) {
        throw(`signPermit: address of signer does not match holder address in message`);
    }

    if (message.nonce === undefined) {
        let tokenAbi = [ 'function nonces(address holder) view returns (uint)', ];

        let tokenContract = new ethers.Contract(domain.verifyingContract, tokenAbi, signer);

        let nonce = await tokenContract.nonces(myAddr);

        message = { ...message, nonce: nonce.toString(), };
    }

    let typedData = {
        types: {
            EIP712Domain: domainSchema,
            Permit: permitSchema,
        },
        primaryType: "Permit",
        domain,
        message,
    };
    
    const sig = await signer.provider.send("eth_signTypedData", [myAddr, typedData])

    return { domain, message, sig, };
}

module.exports = {
    signPermit
}
