const ethers = require('ethers')
const debug = require('debug')('ptv3:signPermit.js')

const domainSchema = [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
];

const permitSchema = [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
];

async function signPermit(signer, domain, message) {
    let myAddr = await signer.getAddress();

    debug(`signPermit(): ${myAddr}`)

    if (myAddr.toLowerCase() !== message.owner.toLowerCase()) {
        throw(`signPermit: address of signer does not match holder address in message`);
    }

    if (message.nonce === undefined) {
        let tokenAbi = [ 'function nonces(address holder) view returns (uint)', ];

        let tokenContract = new ethers.Contract(domain.verifyingContract, tokenAbi, signer);

        let nonce = await tokenContract.nonces(myAddr);

        debug(`signPermit(): nonce: ${nonce}`)

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
    
    debug(`signPermit(): typedData: `, JSON.stringify(typedData, null, 2))

    let sig 
    try {
        sig = await signer.provider.send("eth_signTypedData", [myAddr, typedData])
    } catch (e) {
        if (/is not supported/.test(e.message)) {
            sig = await signer.provider.send("eth_signTypedData_v4", [myAddr, typedData])
        }
    }

    debug(`signPermit() sig signed`)

    return { domain, message, sig, };
}

module.exports = {
    signPermit
}
