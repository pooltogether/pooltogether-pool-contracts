import { ethers } from 'ethers'

export interface Library {
    name: string,
    address: string
}

export function linkLibrary(bytecode: string, lib: Library): string {
    let hash = ethers.utils.solidityKeccak256(['string'], [lib.name])
    let key = `__$${hash.toString()}__$`

    return bytecode.replace(key, lib.address)
}

export function linkLibraries(bytecode: string, libs: [Library]): string {
    let result = bytecode
    libs.forEach(lib => {
        result = linkLibrary(result, lib)
    })
    return result
}