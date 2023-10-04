// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, run } from "hardhat";

const delay = (ms: number | undefined) => new Promise((res) => setTimeout(res, ms));

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy

  const name = "LCollection";
  const symbol = "LMT";
  const maxNftSupply = 1000;
  const _nftPrice = 1000;
  const admin = "0x7d143dd23ee1aCfc415C63E40c7F2b54766166C3";
  const feeAddress = "0xeC128981Dec04435c3d024923aB9B1401853B39F";
  const feePercentage = 275; //means 2.75

  const LCollection = await ethers.getContractFactory("LCollection");
  const LmCollection = await LCollection.deploy(name, symbol, maxNftSupply, _nftPrice, admin, feeAddress, feePercentage);

  await LmCollection.deployed();

  console.log("L deployed to:", LmCollection.address);
  
  console.log("⏰ Waiting confirmations 1min...");
  await delay(60000);

  console.log("🪄  Verifying contracts");

  await run("verify:verify", {
    address: LmCollection.address,
    constructorArguments:
      [
        name, 
        symbol, 
        maxNftSupply, 
        _nftPrice, 
        admin, 
        feeAddress, 
        feePercentage
      ]
  });

  console.log("✅ L Contract verified on Etherscan");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
