# Mint Bonding Curve

When purchasing tickets, they become increasingly expensive until the prize is awarded.
At which point the curve drops back down to 1:1

For example:

User A puts in 100.
Prize accrues 10 in interest
User B puts in 100 right at the award time.

User B should "lose" 10 to be fair if they sell immediately

If there were 1000 tokens with no prize, then the curve should still be 1:1

Mint Exchange Rate = TotalTickets / (TotalTickets + AccruedInterest)
Redeem Exchange Rate = 1

If 1000 tickets and no prize has accrued then the Exchange Rate = 1000 / (1000 + 0) = 1
If 1000 tickets and 1000 has accrued then the Exchange Rate = 1000 / (1000 + 1000) = 0.5



# Redeem bonding curve

When a user purchases a ticket, they get them at 1:1.  

If they entered one block before the prize then must lose that on the next.

When a user wishes to redeem their tickets, they are eligible for:

// immediately the block after a prize it should be:

TotalTickets / (TotalTickets + PreviousPrize)

// immediately before the prize it should be:

TotalTickets / (TotalTickets - CurrentPrize)

Let PeriodFraction = fraction of way through prize period

Exchange Rate = TotalTickets / (TotalTickets + (1 - PeriodFraction) * PreviousPrize - (PeriodFraction) * CurrentPrize)



# Pre-purchase Voucher for next prize

Waive the fee by pre-purchasing a Voucher for the next prize.
When the next prize starts, you can redeem the voucher for a ticket at any time for no cost.

// how would that work?
need pending / consolidated shares.  Totally possible.








# Early Exit Fee

Ensures that users don't exit the pool too early.  

Exit fee is calculated as:

Let PeriodFraction = fraction of way through prize period (i.e. 0.5 is halfway)
Exchange Rate = TotalTickets / (TotalTickets + (1 - PeriodFraction) * PreviousPrize)

If there are 1000 tickets, the previous prize was 100, and we are at the start of the period, the exchange rate for tickets is:

Exchange Rate = 1000 / (1000 + (1 - 0) * 100) = 1000 / 1100 = 0.90909

Meaning the user will be able to withdraw 909 Dai from their 1000 tickets.

However, it is possible for a user to queue the tickets for redemption.

# No Loss Exit

Sponsorship: claim on underlying asset
Voucher: interest-fair claim on underlying asset
Ticket: eligible interest-fair claim on underlying asset

User converts their tickets to vouchers.  Vouchers include:

- cToken balance
- Ticket balance

So we can determine how much interest has accrued.

When the interest offsets the exit fee, they may withdraw the full amount.

# User flow:

1. User buys tickets.  Tickets are sold at 1:1 ratio.
2. User requests no-loss withdrawal of X number of tickets.
3. Current Exit Fee for the withdrawal is recorded as debt
4. Requested tokens are converted to interest bearing token.  When interest exceeds debt the user may redeem.

Exit Fee is essentially paid for with a "loan"

# Prize Pool Mechanics

## Exit Fee

How is the exit fee defined?  The previous prize is good to use, as it may be the reason people want to exit.

What if we were triggering a prize every $100?  It's no longer about the prize period.




