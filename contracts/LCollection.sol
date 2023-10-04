// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./NFTBase.sol";

/**
 * @title NFTCollection contract
 */
contract LCollection is NFTBase, Ownable, Pausable, EIP712 {
    uint256 public nftPrice;
    uint256 public maxNFTPurchase = 10;
    uint256 public MAX_NFTS;
    bool public saleIsActive = false;
    uint256 public purchaseLimitByWallet = 10;
    mapping(address => uint256) public walletPurchaseQty;
    mapping(address => bool) public redeemedVoucher;

    // Base URI
    string private baseURI;

    // Admin address
    address public admin;

    // Fee address
    address public feeAddress;
    uint256 public feePercentage;

    //EIP712 initial settings
    string private constant SIGNING_DOMAIN = "L-Voucher";
    string private constant SIGNATURE_VERSION = "1";

    enum DistributionPhase {
        closed,
        preSale,
        sale
    }

    DistributionPhase public distributionPhase;

    struct NFTVoucher {
        address redeemer;
        uint256 price;
        uint256 amount;
        bytes data;
        bytes signature;
    }

    modifier onlyOwnerOrAdmin() {
        _checkOwnerOrAdmin();
        _;
    }

    event SetPuchaseLimitByWallet(uint256 newLimit);
    event SetPrice(uint256 value);
    event Withdraw();
    event SetDistributionPhase(DistributionPhase _phase);
    event BuyNFT(uint256 numberOfTokens);
    event Redeem(NFTVoucher voucher);

    constructor(
        string memory name,
        string memory symbol,
        uint256 maxNftSupply,
        uint256 _nftPrice,
        address _admin,
        address _feeAddress,
        uint256 _feePercentage
    ) NFTBase(name, symbol) EIP712(SIGNING_DOMAIN, SIGNATURE_VERSION) {
        MAX_NFTS = maxNftSupply;
        nftPrice = _nftPrice;
        admin = _admin;
        feeAddress = _feeAddress;
        feePercentage = _feePercentage;
    }

    function setAdmin(address _admin) public onlyOwnerOrAdmin {
        require(
            _admin != address(0),
            "Admin address cannot be the zero address"
        );
        admin = _admin;
    }

    function setFeeAddress(address _feeAddress) public onlyOwnerOrAdmin {
        require(
            _feeAddress != address(0),
            "Fee address cannot be the zero address"
        );
        feeAddress = _feeAddress;
    }

    function setFeePercentage(uint256 _feePercentage) public onlyOwnerOrAdmin {
        require(_feePercentage > 0, "Fee percentage must be greater than 0");
        feePercentage = _feePercentage;
    }

    function setPuchaseLimitByWallet(uint256 newLimit) public onlyOwnerOrAdmin {
        purchaseLimitByWallet = newLimit;
        maxNFTPurchase = newLimit;

        emit SetPuchaseLimitByWallet(newLimit);
    }

    function setPrice(uint256 value) external onlyOwnerOrAdmin {
        require(value > 0, "Set the price greater than 1 wei");
        nftPrice = value;

        emit SetPrice(value);
    }

    function setBaseURI(string memory newBaseURI) public onlyOwnerOrAdmin {
        _setBaseURI(newBaseURI);
    }

    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = msg.sender.call{value: balance}("");
        require(success, "Error: withdraw failed");

        emit Withdraw();
    }

    function setDistributionPhase(DistributionPhase _phase)
        external
        onlyOwnerOrAdmin
    {
        distributionPhase = _phase;

        emit SetDistributionPhase(_phase);
    }

    function flipSaleState() public onlyOwnerOrAdmin {
        saleIsActive = !saleIsActive;
    }

    function buyNFT(uint256 numberOfTokens) public payable whenNotPaused {
        require(saleIsActive, "Sale must be active to mint NFT");
        require(
            distributionPhase == DistributionPhase.sale,
            "Sale must be in sale phase to mint NFT"
        );
        require(
            numberOfTokens <= maxNFTPurchase,
            "Can only mint 10 tokens at once"
        );
        require(
            numberOfTokens <=
                (purchaseLimitByWallet - walletPurchaseQty[msg.sender]),
            "Purchase would exceed your limit (10 per Wallet)"
        );
        require(
            (totalSupply() + numberOfTokens) <= MAX_NFTS,
            "Purchase would exceed max supply of NFTs"
        );
        uint256 totalCost = numberOfTokens * nftPrice;
        require(totalCost <= msg.value, "Ether value sent is not correct");

        uint256 totalFee = (totalCost * feePercentage) / 1e4;

        (bool success, ) = feeAddress.call{value: totalFee}("");
        require(success, "Error: withdraw failed");

        for (uint256 i = 0; i < numberOfTokens; i++) {
            _mint(msg.sender); //This is implemented at NFTBase.sol and it is calling _safeMint(...)
        }
        walletPurchaseQty[msg.sender] += numberOfTokens;

        emit BuyNFT(numberOfTokens);
    }

    function redeem(NFTVoucher calldata voucher) public payable {
        address signer = _verify(voucher);
        address redeemer = voucher.redeemer;
        require(
            distributionPhase == DistributionPhase.preSale,
            "Sale must be in pre-sale phase to mint NFT"
        );
        require(redeemer == msg.sender, "Voucher not for you");
        require(redeemedVoucher[redeemer] == false, "Voucher already redeemed");
        require(msg.value == voucher.price, "Wrong price");

        require(owner() == signer, "Signature invalid or unauthorized");

        _mint(msg.sender);
        redeemedVoucher[redeemer] = true;

        emit Redeem(voucher);
    }

    function _hash(NFTVoucher calldata voucher)
        internal
        view
        returns (bytes32)
    {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        keccak256(
                            "NFTVoucher(address redeemer,uint256 price,uint256 amount,bytes data)"
                        ),
                        voucher.redeemer,
                        voucher.price,
                        voucher.amount,
                        keccak256(bytes(voucher.data))
                    )
                )
            );
    }

    function getChainID() public view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }

    function _verify(NFTVoucher calldata voucher)
        internal
        view
        returns (address)
    {
        bytes32 digest = _hash(voucher);
        return ECDSA.recover(digest, voucher.signature);
    }

    /**
     * @dev Pauses all methods with whenNotPaused.
     *
     * See {ERC721Pausable} and {Pausable-_pause}.
     *
     */
    function pause() public onlyOwnerOrAdmin {
        _pause();
    }

    /**
     * @dev Unpauses all methods with whenNotPaused.
     *
     * See {ERC721Pausable} and {Pausable-_unpause}.
     *
     */
    function unpause() public onlyOwnerOrAdmin {
        _unpause();
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwnerOrAdmin() internal view virtual {
        require(
            (owner() == _msgSender()) || (admin == _msgSender()),
            "Ownable: caller is not the owner"
        );
    }

    function tokensOfWalletOwner(address _owner)
        public
        view
        returns (string[] memory)
    {
        uint256 tokenCount = balanceOf(_owner);
        string[] memory tokenURIs = new string[](tokenCount);
        for (uint256 i; i < tokenCount; i++) {
            tokenURIs[i] = tokenURI(tokenOfOwnerByIndex(_owner, i));
        }
        return tokenURIs;
    }
}
