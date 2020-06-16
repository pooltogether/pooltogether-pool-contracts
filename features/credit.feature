Feature: Ticket Credit

  Scenario: Held tickets earn credit
    Given a pool exists with a period of 10 seconds
    When user 1 buys 100 tickets
    And user 2 buys 50 tickets
    Then user 1 should have 100 tickets
    And user 2 should have 50 tickets