/**
Copyright 2019 PoolTogether LLC

This file is part of PoolTogether.

PoolTogether is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation under version 3 of the License.

PoolTogether is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with PoolTogether.  If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity 0.5.12;

import "./UniformRandomNumber.sol";
import "@kleros/kleros/contracts/data-structures/SortitionSumTreeFactory.sol";
import "@openzeppelin/contracts/contracts/math/SafeMath.sol";

/**
 * @author Brendan Asselstine
 * @notice Tracks committed and open balances for addresses.  Affords selection of an address by indexing all committed balances.
 *
 * Balances are tracked in Draws.  There is always one open Draw.  Deposits are always added to the open Draw.
 * When a new draw is opened, the previous opened draw is committed.
 *
 * The committed balance for an address is the total of their balances for committed Draws.
 * An address's open balance is their balance in the open Draw.
 */
library DrawManager {
    using SortitionSumTreeFactory for SortitionSumTreeFactory.SortitionSumTrees;
    using SafeMath for uint256;

    /**
     * The ID to use for the selection tree.
     */
    bytes32 public constant TREE_OF_DRAWS = "TreeOfDraws";

    uint8 public constant MAX_LEAVES = 10;

    /**
     * Stores information for all draws.
     */
    struct State {
        /**
         * Each Draw stores it's address balances in a sortitionSumTree.  Draw trees are indexed using the Draw index.
         * There is one root sortitionSumTree that stores all of the draw totals.  The root tree is indexed using the constant TREE_OF_DRAWS.
         */
        SortitionSumTreeFactory.SortitionSumTrees sortitionSumTrees;

        /**
         * Stores the first Draw index that an address deposited to.
         */
        mapping(address => uint256) usersFirstDrawIndex;

        /**
         * Stores the last Draw index that an address deposited to.
         */
        mapping(address => uint256) usersSecondDrawIndex;

        /**
         * Stores a mapping of Draw index => Draw total
         */
        mapping(uint256 => uint256) __deprecated__drawTotals;

        /**
         * The current open Draw index
         */
        uint256 openDrawIndex;

        /**
         * The total of committed balances
         */
        uint256 __deprecated__committedSupply;
    }

    /**
     * @notice Opens the next Draw and commits the previous open Draw (if any).
     * @param self The drawState this library is attached to
     * @return The index of the new open Draw
     */
    function openNextDraw(State storage self) public returns (uint256) {
        if (self.openDrawIndex == 0) {
            // If there is no previous draw, we must initialize
            self.sortitionSumTrees.createTree(TREE_OF_DRAWS, MAX_LEAVES);
        } else {
            // else add current draw to sortition sum trees
            bytes32 drawId = bytes32(self.openDrawIndex);
            uint256 drawTotal = openSupply(self);
            self.sortitionSumTrees.set(TREE_OF_DRAWS, drawTotal, drawId);
        }
        // now create a new draw
        uint256 drawIndex = self.openDrawIndex.add(1);
        self.sortitionSumTrees.createTree(bytes32(drawIndex), MAX_LEAVES);
        self.openDrawIndex = drawIndex;

        return drawIndex;
    }

    /**
     * @notice Deposits the given amount into the current open draw by the given user.
     * @param self The DrawManager state
     * @param _addr The address to deposit for
     * @param _amount The amount to deposit
     */
    function deposit(State storage self, address _addr, uint256 _amount) public requireOpenDraw(self) onlyNonZero(_addr) {
        bytes32 userId = bytes32(uint256(_addr));
        uint256 openDrawIndex = self.openDrawIndex;

        // update the current draw
        uint256 currentAmount = self.sortitionSumTrees.stakeOf(bytes32(openDrawIndex), userId);
        currentAmount = currentAmount.add(_amount);
        drawSet(self, openDrawIndex, currentAmount, _addr);

        uint256 firstDrawIndex = self.usersFirstDrawIndex[_addr];
        uint256 secondDrawIndex = self.usersSecondDrawIndex[_addr];

        // if this is the users first draw, set it
        if (firstDrawIndex == 0) {
            self.usersFirstDrawIndex[_addr] = openDrawIndex;
        // otherwise, if the first draw is not this draw
        } else if (firstDrawIndex != openDrawIndex) {
            // if a second draw does not exist
            if (secondDrawIndex == 0) {
                // set the second draw to the current draw
                self.usersSecondDrawIndex[_addr] = openDrawIndex;
            // otherwise if a second draw exists but is not the current one
            } else if (secondDrawIndex != openDrawIndex) {
                // merge it into the first draw, and update the second draw index to this one
                uint256 firstAmount = self.sortitionSumTrees.stakeOf(bytes32(firstDrawIndex), userId);
                uint256 secondAmount = self.sortitionSumTrees.stakeOf(bytes32(secondDrawIndex), userId);
                drawSet(self, firstDrawIndex, firstAmount.add(secondAmount), _addr);
                drawSet(self, secondDrawIndex, 0, _addr);
                self.usersSecondDrawIndex[_addr] = openDrawIndex;
            }
        }
    }

    /**
     * @notice Deposits into a user's committed balance, thereby bypassing the open draw.
     * @param self The DrawManager state
     * @param _addr The address of the user for whom to deposit
     * @param _amount The amount to deposit
     */
    function depositCommitted(State storage self, address _addr, uint256 _amount) public requireOpenDraw(self) onlyNonZero(_addr) {
        bytes32 userId = bytes32(uint256(_addr));
        uint256 firstDrawIndex = self.usersFirstDrawIndex[_addr];

        // if they have a committed balance
        if (firstDrawIndex != 0 && firstDrawIndex != self.openDrawIndex) {
            uint256 firstAmount = self.sortitionSumTrees.stakeOf(bytes32(firstDrawIndex), userId);
            drawSet(self, firstDrawIndex, firstAmount.add(_amount), _addr);
        } else { // they must not have any committed balance
            self.usersSecondDrawIndex[_addr] = firstDrawIndex;
            self.usersFirstDrawIndex[_addr] = self.openDrawIndex.sub(1);
            drawSet(self, self.usersFirstDrawIndex[_addr], _amount, _addr);
        }
    }

    /**
     * @notice Withdraws a user's committed and open draws.
     * @param self The DrawManager state
     * @param _addr The address whose balance to withdraw
     */
    function withdraw(State storage self, address _addr) public requireOpenDraw(self) onlyNonZero(_addr) {
        uint256 firstDrawIndex = self.usersFirstDrawIndex[_addr];
        uint256 secondDrawIndex = self.usersSecondDrawIndex[_addr];

        if (firstDrawIndex != 0) {
            drawSet(self, firstDrawIndex, 0, _addr);
            delete self.usersFirstDrawIndex[_addr];
        }

        if (secondDrawIndex != 0) {
            drawSet(self, secondDrawIndex, 0, _addr);
            delete self.usersSecondDrawIndex[_addr];
        }
    }

    /**
     * @notice Withdraw's from a user's committed balance.  Fails if the user attempts to take more than available.
     * @param self The DrawManager state
     * @param _addr The user to withdraw from
     * @param _amount The amount to withdraw.
     */
    function withdrawCommitted(State storage self, address _addr, uint256 _amount) public requireOpenDraw(self) onlyNonZero(_addr) {
        bytes32 userId = bytes32(uint256(_addr));
        uint256 firstDrawIndex = self.usersFirstDrawIndex[_addr];
        uint256 secondDrawIndex = self.usersSecondDrawIndex[_addr];

        uint256 firstAmount = 0;
        uint256 secondAmount = 0;
        uint256 total = 0;

        if (secondDrawIndex != 0 && secondDrawIndex != self.openDrawIndex) {
            secondAmount = self.sortitionSumTrees.stakeOf(bytes32(secondDrawIndex), userId);
            total = total.add(secondAmount);
        }

        if (firstDrawIndex != 0 && firstDrawIndex != self.openDrawIndex) {
            firstAmount = self.sortitionSumTrees.stakeOf(bytes32(firstDrawIndex), userId);
            total = total.add(firstAmount);
        }

        require(_amount <= total, "cannot withdraw more than available");

        uint256 remaining = total.sub(_amount);

        // if there was a second amount that needs to be updated
        if (remaining > firstAmount) {
            uint256 secondRemaining = remaining.sub(firstAmount);
            drawSet(self, secondDrawIndex, secondRemaining, _addr);
        } else if (secondAmount > 0) { // else delete the second amount if it exists
            delete self.usersSecondDrawIndex[_addr];
            drawSet(self, secondDrawIndex, 0, _addr);
        }

        // if the first amount needs to be destroyed
        if (remaining == 0) {
            delete self.usersFirstDrawIndex[_addr];
            drawSet(self, firstDrawIndex, 0, _addr);
        } else if (remaining < firstAmount) {
            drawSet(self, firstDrawIndex, remaining, _addr);
        }
    }

    /**
     * @notice Returns the total balance for an address, including committed balances and the open balance.
     */
    function balanceOf(State storage drawState, address _addr) public view returns (uint256) {
        return committedBalanceOf(drawState, _addr).add(openBalanceOf(drawState, _addr));
    }

    /**
     * @notice Returns the total committed balance for an address.
     * @param self The DrawManager state
     * @param _addr The address whose committed balance should be returned
     * @return The total committed balance
     */
    function committedBalanceOf(State storage self, address _addr) public view returns (uint256) {
        uint256 balance = 0;

        uint256 firstDrawIndex = self.usersFirstDrawIndex[_addr];
        uint256 secondDrawIndex = self.usersSecondDrawIndex[_addr];

        if (firstDrawIndex != 0 && firstDrawIndex != self.openDrawIndex) {
            balance = balance.add(self.sortitionSumTrees.stakeOf(bytes32(firstDrawIndex), bytes32(uint256(_addr))));
        }

        if (secondDrawIndex != 0 && secondDrawIndex != self.openDrawIndex) {
            balance = balance.add(self.sortitionSumTrees.stakeOf(bytes32(secondDrawIndex), bytes32(uint256(_addr))));
        }

        return balance;
    }

    /**
     * @notice Returns the open balance for an address
     * @param self The DrawManager state
     * @param _addr The address whose open balance should be returned
     * @return The open balance
     */
    function openBalanceOf(State storage self, address _addr) public view returns (uint256) {
        if (self.openDrawIndex == 0) {
            return 0;
        } else {
            return self.sortitionSumTrees.stakeOf(bytes32(self.openDrawIndex), bytes32(uint256(_addr)));
        }
    }

    /**
     * @notice Returns the open Draw balance for the DrawManager
     * @param self The DrawManager state
     * @return The open draw total balance
     */
    function openSupply(State storage self) public view returns (uint256) {
        return self.sortitionSumTrees.total(bytes32(self.openDrawIndex));
    }

    /**
     * @notice Returns the committed balance for the DrawManager
     * @param self The DrawManager state
     * @return The total committed balance
     */
    function committedSupply(State storage self) public view returns (uint256) {
        return self.sortitionSumTrees.total(TREE_OF_DRAWS);
    }

    /**
     * @notice Updates the Draw balance for an address.
     * @param self The DrawManager state
     * @param _drawIndex The Draw index
     * @param _amount The new balance
     * @param _addr The address whose balance should be updated
     */
    function drawSet(State storage self, uint256 _drawIndex, uint256 _amount, address _addr) internal {
        bytes32 drawId = bytes32(_drawIndex);
        bytes32 userId = bytes32(uint256(_addr));
        uint256 oldAmount = self.sortitionSumTrees.stakeOf(drawId, userId);

        if (oldAmount != _amount) {
            // If the amount has changed

            // Update the Draw's balance for that address
            self.sortitionSumTrees.set(drawId, _amount, userId);

            // Get the new draw total
            uint256 newDrawTotal = self.sortitionSumTrees.total(drawId);

            // if the draw is committed
            if (_drawIndex != self.openDrawIndex) {
                // update the draw in the committed tree
                self.sortitionSumTrees.set(TREE_OF_DRAWS, newDrawTotal, drawId);
            }
        }
    }

   /**
     * @notice Selects an address by indexing into the committed tokens using the passed token
     * @param self The DrawManager state
     * @param _token The token index to select
     * @return The selected address
     */
    function draw(State storage self, uint256 _token) public view returns (address) {
        // If there is no one to select, just return the zero address
        if (committedSupply(self) == 0) {
            return address(0);
        }
        require(_token < committedSupply(self), "token is beyond the eligible supply");
        uint256 drawIndex = uint256(self.sortitionSumTrees.draw(TREE_OF_DRAWS, _token));
        uint256 drawSupply = self.sortitionSumTrees.total(bytes32(drawIndex));
        uint256 drawToken = _token % drawSupply;
        return address(uint256(self.sortitionSumTrees.draw(bytes32(drawIndex), drawToken)));
    }

    /**
     * @notice Selects an address using the entropy as an index into the committed tokens
     * The entropy is passed into the UniformRandomNumber library to remove modulo bias.
     * @param self The DrawManager state
     * @param _entropy The random entropy to use
     * @return The selected address
     */
    function drawWithEntropy(State storage self, bytes32 _entropy) public view returns (address) {
        return draw(self, UniformRandomNumber.uniform(uint256(_entropy), committedSupply(self)));
    }

    modifier requireOpenDraw(State storage self) {
        require(self.openDrawIndex > 0, "there is no open draw");
        _;
    }

    modifier onlyNonZero(address _addr) {
        require(_addr != address(0), "address cannot be zero");
        _;
    }
}