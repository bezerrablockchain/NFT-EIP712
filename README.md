# NFT-EIP712
This repository show how to use a ERC721 in addition of EIP712 in oder to mint new NFTs during a specific project sales phase
Highlights are:
* Usage of `contracts/NFTBase.sol` contract to hold all ERC721 logic
* NFT Marketplace implemented in `contracts/LCollection.sol`
  
   Marketplace with:
   Support to redeem NFT using a voucher (EIP-712) - only autorized wallets can execute the `redeem` function call
   Good usage of Authorization by using Ownable standard contract (OZ)
   Sales with different phases
  
* A number of unit tests can be found at `test/NFTCollection.test.ts`
* A good usage of plug-ins like code coverage
* Deployment script using AWS-KMS service
