import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Contract, Signer } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { LCollection } from "../typechain-types/contracts/LCollection";
const { ethers } = require("hardhat");

require("chai").use(require("chai-as-promised")).should();

describe("NFTCollection tests", function () {
  let nftContract: LCollection;
  let owner: SignerWithAddress;
  let acc1: SignerWithAddress;
  let acc2: SignerWithAddress;
  let admin: SignerWithAddress;
  let feeAddress: SignerWithAddress;
  let chainId: number;
  let feePercentage: number = 275; //means 2.75

  this.beforeAll(async () => {
    const name = "LCollection";
    const symbol = "NFTC";
    const maxNftSupply = 50;
    const nftPrice = parseEther("0.0001");

    [owner, acc1, acc2, admin, feeAddress] = await ethers.getSigners();

    const NFTCollectionContract = await ethers.getContractFactory("LCollection");
    nftContract = await NFTCollectionContract.deploy(name, symbol, maxNftSupply, nftPrice, admin.address, feeAddress.address, feePercentage);
    await nftContract.deployed();

    const baseURITx = await nftContract.setBaseURI("https://www.nftCollection.com/");
    await baseURITx.wait();
    chainId = await ethers.provider.getNetwork().then((network: { chainId: any; }) => network.chainId);
    console.log("chainId: ", chainId);
  });

  it("Should match chainID between contract and environment", async function () {
    expect(await nftContract.getChainID()).to.equal(chainId);
  });

  it("Should support ERC721 Interface", async function () {
    expect(await nftContract.supportsInterface("0x80ac58cd")).is.true;
  });

  it("Should return the correct name", async function () {
    expect(await nftContract.name()).to.equal("LCollection");
  });

  it("Should return the correct symbol", async function () {
    expect(await nftContract.symbol()).to.equal("NFTC");
  });

  it("Should return the correct nftPrice", async function () {
    expect(await nftContract.nftPrice()).to.equal(parseEther("0.0001"));
  });

  it("Should return the correct maxNFTPurchase", async function () {
    expect(await nftContract.maxNFTPurchase()).to.equal(10);
  });

  it("Should return the correct MAX_NFTS", async function () {
    expect(await nftContract.MAX_NFTS()).to.equal(50);
  });

  it("Should return the correct saleIsActive", async function () {
    expect(await nftContract.saleIsActive()).is.false;
  });

  it("Should flip sale state from false to true", async function () {
    const originalSaleState = await nftContract.saleIsActive();
    const flipTx = await nftContract.flipSaleState();
    await flipTx.wait();
    const newSaleState = await nftContract.saleIsActive();

    expect(originalSaleState).to.be.false;
    expect(newSaleState).to.be.true;
  });

  it("Should flip sale state from false to true", async function () {
    const originalSalePhase = await nftContract.distributionPhase();
    const flipPahse = await nftContract.setDistributionPhase(2);
    await flipPahse.wait();
    const newSalePhase = await nftContract.distributionPhase();

    expect(originalSalePhase).eq(0); // 0 = closed
    expect(newSalePhase).eq(2); // 2 = public (sale)
  });

  it("Should sell NFT for NFTPrice ", async function () {
    const nftPrice = parseEther("0.0001");
    const numOfNFTs = 5;
    const totalNftPrice = nftPrice.toNumber() * numOfNFTs;
    const feeValue = (totalNftPrice * feePercentage) / 10000;

    const originalBalance = await ethers.provider.getBalance(nftContract.address);
    const originalFeeBalance = await ethers.provider.getBalance(feeAddress.address);
    const originalNftBalance = await nftContract.balanceOf(acc1.address);

    const sellTx = await nftContract.connect(acc1).buyNFT(numOfNFTs, { value: totalNftPrice });
    await sellTx.wait();

    const newBalance = await ethers.provider.getBalance(nftContract.address);
    const newFeeBalance = await ethers.provider.getBalance(feeAddress.address);
    const newNftBalance = await nftContract.balanceOf(acc1.address);

    let finalContractBalance = originalBalance.toNumber() + totalNftPrice;
    finalContractBalance = finalContractBalance - feeValue;

    expect(newBalance.toNumber()).eq(finalContractBalance);
    expect(newNftBalance.valueOf()).eq(originalNftBalance.valueOf() + BigInt(numOfNFTs));
    expect(newFeeBalance).eq(originalFeeBalance.add(feeValue));
  });

  it("Should return the correct TokenURI", async function () {
    const baseURI = "https://www.nftCollection.com/";
    const tokenId = 1;
    expect(await nftContract.tokenURI(tokenId)).to.equal(baseURI + tokenId.toString() + ".json");
  });

  it("Should return the NFTS from its owner", async function () { //
    const originalNftBalance = await nftContract.balanceOf(acc1.address);
    const NFTList = await nftContract.tokensOfWalletOwner(acc1.address);

    expect(NFTList.length).eq(originalNftBalance);
  });

  it("Should allow call buyNFT() just whenNotPaused", async function () {
    const nftPrice = parseEther("0.0001");
    const numOfNFTs = 5;
    const totalNftPrice = nftPrice.toNumber() * numOfNFTs;
    const originalNftBalance = await nftContract.balanceOf(acc1.address);

    let pauseTx = await nftContract.pause();
    await pauseTx.wait();

    const revMessage = "Pausable: paused"; //"VM Exception while processing transaction: reverted with reason string 'Pausable: paused'";
    let sellTx = await nftContract.connect(acc1).buyNFT(numOfNFTs, { value: totalNftPrice }).should.be.revertedWith(revMessage);

    pauseTx = await nftContract.unpause();
    await pauseTx.wait();

    sellTx = await nftContract.connect(acc1).buyNFT(numOfNFTs, { value: totalNftPrice });
    const newNftBalance = await nftContract.balanceOf(acc1.address);

    const finalValue = BigInt(originalNftBalance) + BigInt(numOfNFTs);
    expect(newNftBalance.valueOf()).eq(finalValue);
  });

  it("Should withdraw the balance from the contract", async function () {
    const originalOwnerBalance = await ethers.provider.getBalance(owner.address);

    const withdrawTx = await nftContract.withdraw();
    await withdrawTx.wait();

    const contractBalance = await ethers.provider.getBalance(nftContract.address);
    const newOwnerBalance = await ethers.provider.getBalance(owner.address);

    const balance = newOwnerBalance.sub(originalOwnerBalance);

    expect(contractBalance.toNumber()).eq(0);
    expect(balance.toNumber()).greaterThan(0);
  });

  it("Should Redeem a NFT using a voucher", async function () {

    const SIGNING_DOMAIN_NAME = "L-Voucher"
    const SIGNING_DOMAIN_VERSION = "1"

    const redeemer = acc2.address
    const price = 100
    const amount = 1
    const data = 0

    await nftContract.setPrice(price);

    const createVoucher = async () => {
      const _voucher = {
        redeemer,
        price,
        amount,
        data
      }

      const domain = {
        name: SIGNING_DOMAIN_NAME,
        version: SIGNING_DOMAIN_VERSION,
        chainId: chainId,
        verifyingContract: nftContract.address
      }

      const types = {
        NFTVoucher: [
          { name: "redeemer", type: "address" },
          { name: "price", type: "uint256" },
          { name: "amount", type: "uint256" },
          { name: "data", type: "bytes" }
        ]
      }

      const signature = await owner._signTypedData(
        domain, types, _voucher
      )

      return { ..._voucher, signature }
    }

    const voucher = await createVoucher()

    await nftContract.setDistributionPhase(1); //pre-sale
    await nftContract.connect(acc2).redeem(voucher, { value: price })

    const balance = await await nftContract.balanceOf(acc2.address)

    expect(balance).to.equal(1)
  });

});
