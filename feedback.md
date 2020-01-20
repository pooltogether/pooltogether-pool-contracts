XXX The Blocklock function does not use SafeMath . Lines 26 and 50 (in PR 4) can overflow if the duration and/or cooldown period are chosen maliciously.


XXX The BasePool.sponsorshipAndFeeBalanceOf function also doesn't use SafeMath. The contract shouldn't be able to get into a state where it underflows, but it's still advisable to use SafeMath defensively.

XXX DrawManager.withdrawOpen should have a function comment

ZZXZ A few of the comments in BasePool and DrawManager say users when they mean user's

XXX I think the overloaded BasePool.withdrawCommittedDeposit  functions are confusing. The functionality is different enough that I think they should have different names. Perhaps the second one could be withdrawCommittedDepositFrom

xxxxXX The comment about BasePool._withdrawCommittedDepositAndEmit should say emits instead of emit

XXX The BasePool.moveCommitted comment should describe the parameters

XXX In PR 21, the Blocklock.setCooldownDuration comments suggest the cooldown period starts whenever the lock is unlocked, even if it is unlocked manually. That's not true - it always starts from the scheduled unlock time.