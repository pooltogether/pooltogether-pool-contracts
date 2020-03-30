pragma solidity 0.6.4;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@pooltogether/fixed-point/contracts/FixedPoint.sol";

import "./compound/ICToken.sol";
import "./PrizePoolFactory.sol";
import "./IPrizeStrategy.sol";
import "./TicketToken.sol";
import "./IComptroller.sol";

contract PrizePool is Initializable, IComptroller {
    using SafeMath for uint256;

    IPrizeStrategy public prizeStrategy;
    PrizePoolFactory public factory;
    TicketToken public ticketToken;
    ICToken public cToken;

    uint256 feeFraction;
    uint256 reserveRateMantissa;
    uint256 currentPeriodStartCTokenExchangeRate;

    uint256 totalMissingInterest;
    mapping(address => uint256) missingInterestBalances;

    mapping(address => uint256) cTokenBalances;

    function initialize (
        IPrizeStrategy _prizeStrategy,
        PrizePoolFactory _factory,
        ICToken _cToken,
        TicketToken _ticketToken,
        uint256 _reserveRateMantissa,
        uint256 _feeFraction
    ) external initializer {
        require(address(_prizeStrategy) != address(0), "prize strategy cannot be zero");
        require(address(_factory) != address(0), "factory cannot be zero");
        require(address(_cToken) != address(0), "cToken cannot be zero");
        require(address(_ticketToken) != address(0), "ticket token cannot be zero");
        require(address(_ticketToken.comptroller()) == address(this), "ticket token comptroller must be this contract");
        require(_reserveRateMantissa > 0, "reserve rate must be greater than zero");
        require(_reserveRateMantissa < 1 ether, "reserve rate must be less than one");
        prizeStrategy = _prizeStrategy;
        factory = _factory;
        reserveRateMantissa = _reserveRateMantissa;
        feeFraction = _feeFraction;
        ticketToken = _ticketToken;
        cToken = _cToken;
        currentPeriodStartCTokenExchangeRate = cToken.exchangeRateCurrent();
    }

    function calculatePrize() public returns (uint256) {
        uint256 balance = cToken.balanceOfUnderlying(address(this));
        uint256 totalAccrued = balance.sub(ticketToken.totalSupply());
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
        uint256 prize = calculatePrize();
        ticketToken.mint(address(prizeStrategy), prize, "", "");
        currentPeriodStartCTokenExchangeRate = cToken.exchangeRateCurrent();
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
        uint256 underlyingBalance = FixedPoint.divideUintByMantissa(cTokenBalances[user], cToken.exchangeRateCurrent());
        return underlyingBalance.sub(ticketToken.balanceOf(user));
    }

    function calculateCurrentPrizeInterest(uint256 _deposit) public returns (uint256) {
        // calculate their missing interest
        // D = T * (1 - R) * (1 - I/F)

        // if AD = T * (1 - R) = T - TR
        uint256 depositLessReserve = _deposit.sub(FixedPoint.divideUintByMantissa(_deposit, reserveRateMantissa));

        // then D = AD - (I * AD) / F
        return depositLessReserve.sub(
            FixedPoint.divideUintByMantissa(
                FixedPoint.multiplyUintByMantissa(depositLessReserve, currentPeriodStartCTokenExchangeRate),
                cToken.exchangeRateCurrent()
            )
        );
    }

    function beforeTransfer(address, address from, address to, uint256 tokenAmount) external override {
        // if it's from a user
        if (from != address(0)) {
            // Check to see that missing interest is covered
            uint256 prizeInterest = calculateCurrentPrizeInterest(ticketToken.balanceOf(from));
            uint256 totalInterest = prizeInterest.add(reserveInterestOf(from));
            require(totalInterest > missingInterestBalances[from], "missing interest must be paid");

            // Capture missing interest
            totalMissingInterest = totalMissingInterest.sub(missingInterestBalances[from]);
            missingInterestBalances[from] = 0;
            uint256 remainingInterest = totalInterest.sub(missingInterestBalances[from]);
            uint256 newTicketBalance = ticketToken.balanceOf(from).sub(tokenAmount);
            uint256 newCTokenBalance = cTokenValueOf(newTicketBalance.add(remainingInterest));
            cTokenBalances[from] = newCTokenBalance;

            // update chances
            prizeStrategy.updateBalanceOf(from, newTicketBalance);
        }

        if (to != address(0)) {
            // update their missing prize interest
            uint256 missingPrizeInterest = calculateCurrentPrizeInterest(tokenAmount);
            missingInterestBalances[to] = missingInterestBalances[to].add(missingPrizeInterest);
            totalMissingInterest = totalMissingInterest.add(missingPrizeInterest);

            // add to their balance the ctokens
            uint256 cTokens = cTokenValueOf(tokenAmount);
            cTokenBalances[to] = cTokenBalances[to].add(cTokens);

            uint256 newTicketBalance = ticketToken.balanceOf(from).add(tokenAmount);
            prizeStrategy.updateBalanceOf(to, newTicketBalance);
        }
    }

    function cTokenValueOf(uint256 underlyingAmount) internal returns (uint256) {
        return FixedPoint.multiplyUintByMantissa(underlyingAmount, cToken.exchangeRateCurrent());
    }

    function underlyingToken() internal returns (IERC20) {
        return IERC20(cToken.underlying());
    }

    modifier onlyPrizeStrategy() {
        require(msg.sender == address(prizeStrategy), "only prize strategy");
        _;
    }
}
