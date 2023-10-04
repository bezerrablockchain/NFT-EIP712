// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, run } from "hardhat";
import { KmsEthersSigner, KmsEthersSignerConfig } from "aws-kms-ethers-signer";
import type { KMSClientConfig } from "@aws-sdk/client-kms";
import dotenv from "dotenv";

dotenv.config();

const region = "us-east-1";

const { AWS_KMS_KEY_ID, POLYGON_ALCHEMY_URL } = process.env;

const delay = (ms: number | undefined) => new Promise((res) => setTimeout(res, ms));

async function main() {

  const configRegion: KMSClientConfig = {
    region: "us-east-1"
  }
  const config:KmsEthersSignerConfig = {
    keyId: "0e454c9f-34a2-4d22-8684-5d787e358886",
    kmsClientConfig: configRegion
  }

  const provider = new ethers.providers.JsonRpcProvider(POLYGON_ALCHEMY_URL);
  const signer = new KmsEthersSigner(config).connect(provider);
  
  const name = "LCollection";
  const symbol = "LMT";
  const maxNftSupply = 1000;
  const _nftPrice = 1000;
  const saleStart = 0;
  const provenanceHash = "";
  const daysUntilReveal = 0;

  console.log(await signer.getAddress());

  const LCollection = await ethers.getContractFactory("LCollection", signer);
  const LCollection = await LCollection.deploy(name, symbol, maxNftSupply, _nftPrice, saleStart, provenanceHash, daysUntilReveal);

  await LCollection.deployed();

  console.log("L deployed to:", LCollection.address);

  console.log("⏰ Waiting confirmations");
  await delay(240000);

  console.log("🪄  Verifying contracts");

  await run("verify:verify", {
    address: LCollection.address,
    constructorArguments:
      [
        name,
        symbol,
        maxNftSupply,
        _nftPrice,
        saleStart,
        provenanceHash,
        daysUntilReveal
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
