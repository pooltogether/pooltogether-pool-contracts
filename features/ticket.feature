Feature: Purchase Tickets

  Scenario: Purchase tickets
    Given a pool with a period of 10 seconds
    When user 1 buys 100 tickets
    And user 2 buys 50 tickets
    Then user 1 should have 100 tickets
    And user 2 should have 50 tickets

  Scenario: Win tickets
    Given a pool with a period of 10 seconds
    When user 1 buys 100 tickets
    And the pool accrues 100 tickets
    And the prize is awarded to token 1
    Then user 1 should have 200 tickets
