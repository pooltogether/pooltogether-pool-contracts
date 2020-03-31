pragma solidity 0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "./compound/ICToken.sol";
import "./PrizePoolFactory.sol";
import "./IPrizeStrategy.sol";
import "./ControlledToken.sol";
import "./IComptroller.sol";

contract PrizePool is Initializable, IComptroller {
    using SafeMath for uint256;

    IPrizeStrategy public prizeStrategy;
    PrizePoolFactory public factory;
    ControlledToken public ticketToken;
    ControlledToken public sponsorshipToken;
    ICToken public cToken;

    uint256 public feeFraction;
    uint256 public reserveRateMantissa;
    uint256 public lastPrizeExchangeRate;

    uint256 public totalMissingInterest;
    mapping(address => uint256) public balanceOfMissingInterest;

    mapping(address => uint256) cTokenBalanceOf;

    function initialize (
        IPrizeStrategy _prizeStrategy,
        PrizePoolFactory _factory,
        ICToken _cToken,
        ControlledToken _ticketToken,
        ControlledToken _sponsorshipToken,
        uint256 _reserveRateMantissa,
        uint256 _feeFraction
    ) external initializer {
        require(address(_prizeStrategy) != address(0), "prize strategy cannot be zero");
        require(address(_factory) != address(0), "factory cannot be zero");
        require(address(_cToken) != address(0), "cToken cannot be zero");
        require(address(_ticketToken) != address(0), "ticket token cannot be zero");
        require(address(_ticketToken.comptroller()) == address(this), "ticket token comptroller must be this contract");
        require(_ticketToken.totalSupply() == 0, "ticket token has previously minted");
        require(address(_sponsorshipToken) != address(0), "sponsorship token cannot be zero");
        require(address(_sponsorshipToken.comptroller()) == address(this), "sponsorship token comptroller must be this contract");
        require(_sponsorshipToken.totalSupply() == 0, "sponsorship token has previously minted");
        require(_reserveRateMantissa > 0, "reserve rate must be greater than zero");
        require(_reserveRateMantissa < 1 ether, "reserve rate must be less than one");
        prizeStrategy = _prizeStrategy;
        factory = _factory;
        reserveRateMantissa = _reserveRateMantissa;
        feeFraction = _feeFraction;
        ticketToken = _ticketToken;
        sponsorshipToken = _sponsorshipToken;
        cToken = _cToken;
        lastPrizeExchangeRate = cToken.exchangeRateCurrent();
    }

    function calculatePrizeCurrent() public returns (uint256) {
        uint256 balance = cToken.balanceOfUnderlying(address(this));
        uint256 totalAccrued = balance.sub(ticketToken.totalSupply()).sub(sponsorshipToken.totalSupply());
        uint256 reserve = FixedPoint.multiplyUintByMantissa(totalAccrued, reserveRateMantissa);
        uint256 reserveForPrize;
        // if the total missing interest is less than the reserve, just capture the missing interest
        if (totalMissingInterest < reserve) {
            reserveForPrize = totalMissingInterest;
        } else { // otherwise max out the reserveForPrize
            reserveForPrize = reserve;
        }

        uint256 prize = totalAccrued.sub(reserve).add(reserveForPrize);
        return prize;
    }

    function awardPrize() external onlyPrizeStrategy {
        uint256 prize = calculatePrizeCurrent();
        sponsorshipToken.mint(address(prizeStrategy), prize, "", "");
        lastPrizeExchangeRate = cToken.exchangeRateCurrent();
    }

    function deposit(uint256 amount) public {
        // Mint cTokens
        IERC20 uToken = underlyingToken();
        uToken.transferFrom(msg.sender, address(this), amount);
        uToken.approve(address(cToken), amount);
        cToken.mint(amount);

        // Mint tickets
        ticketToken.mint(msg.sender, amount, "", "");
    }

    function reserveInterestOf(address user) public returns (uint256) {
        uint256 underlyingBalance = FixedPoint.divideUintByMantissa(cTokenBalanceOf[user], cToken.exchangeRateCurrent());
        return underlyingBalance.sub(ticketToken.balanceOf(user));
    }

    function calculateCurrentPrizeInterest(uint256 _deposit) public view returns (uint256) {
        // calculate their missing interest
        // D = T * (1 - R) * (1 - I/F)

        // if AD = T * (1 - R) = T - TR
        uint256 depositLessReserve = _deposit.sub(FixedPoint.multiplyUintByMantissa(_deposit, reserveRateMantissa));

        uint256 iDivFMantissa = FixedPoint.calculateMantissa(
            exchangeRateCurrent(),
            lastPrizeExchangeRate
        );

        // // then D = AD * (1 - I/F)
        return FixedPoint.multiplyUintByMantissa(
            depositLessReserve,
            iDivFMantissa.sub(FixedPoint.SCALE)
        );
    }

    function beforeTransfer(address, address from, address to, uint256 tokenAmount) external override onlyTicketOrSponsorshipTokens {
        // ignore the sponsorship tokens
        if (msg.sender != address(ticketToken)) {
            return;
        }

        // if it's from a user
        if (from != address(0)) {
            // Check to see that missing interest is covered
            uint256 prizeInterest = calculateCurrentPrizeInterest(ticketToken.balanceOf(from));
            uint256 totalInterest = prizeInterest.add(reserveInterestOf(from));
            require(totalInterest > balanceOfMissingInterest[from], "missing interest must be paid");

            // Capture missing interest
            totalMissingInterest = totalMissingInterest.sub(balanceOfMissingInterest[from]);
            balanceOfMissingInterest[from] = 0;
            uint256 remainingInterest = totalInterest.sub(balanceOfMissingInterest[from]);
            uint256 newTicketBalance = ticketToken.balanceOf(from).sub(tokenAmount);
            uint256 newCTokenBalance = cTokenValueOf(newTicketBalance.add(remainingInterest));
            cTokenBalanceOf[from] = newCTokenBalance;

            // update chances
            prizeStrategy.afterBalanceChanged(from, newTicketBalance);
        }

        if (to != address(0)) {
            // update their missing prize interest
            uint256 missingPrizeInterest = calculateCurrentPrizeInterest(tokenAmount);
            balanceOfMissingInterest[to] = balanceOfMissingInterest[to].add(missingPrizeInterest);
            totalMissingInterest = totalMissingInterest.add(missingPrizeInterest);

            // add to their balance the ctokens
            uint256 cTokens = cTokenValueOf(tokenAmount);
            cTokenBalanceOf[to] = cTokenBalanceOf[to].add(cTokens);

            uint256 newTicketBalance = ticketToken.balanceOf(to).add(tokenAmount);
            prizeStrategy.afterBalanceChanged(to, newTicketBalance);
        }
    }

    function convertSponsorshipToTickets(address to, uint256 amount) public {
        sponsorshipToken.burn(msg.sender, amount, "", "");
        ticketToken.mint(to, amount, "", "");
    }

    function cTokenValueOf(uint256 underlyingAmount) internal returns (uint256) {
        return FixedPoint.multiplyUintByMantissa(underlyingAmount, cToken.exchangeRateCurrent());
    }

    function exchangeRateCurrent() public view returns (uint256) {
        (bool success, bytes memory data) = address(cToken).staticcall(abi.encodeWithSignature("exchangeRateCurrent()", ""));
        require(success, "exchange rate failed");
        return abi.decode(data, (uint256));
    }

    function underlyingToken() internal returns (IERC20) {
        return IERC20(cToken.underlying());
    }

    modifier onlyPrizeStrategy() {
        require(msg.sender == address(prizeStrategy), "only prize strategy");
        _;
    }

    modifier onlyTicketOrSponsorshipTokens() {
        require(msg.sender == address(ticketToken) || msg.sender == address(sponsorshipToken), "only ticket or sponsorship tokens");
        _;
    }
}
