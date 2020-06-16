Feature: Ticket Interest

  Scenario: Held tickets earn interest
    Given a pool with a period of 10 seconds
    When user 1 buys 100 tickets at 0 seconds in
    And the pool accrues 100 tickets
    And the prize is awarded to token 1
    Then user 1 should have 100 ticket interest
    And user 1 should have 200 tickets

  Scenario: Late comers do not earn interest
    Given a pool with a period of 10 seconds
    When user 1 buys 100 tickets at 0 seconds in
    And the pool accrues 100 tickets
    And user 2 buys 100 tickets at 10 seconds in
    And the prize is awarded to token 1
    Then user 1 should have 100 ticket interest
    And user 2 should have 0 ticket interest

  Scenario: Tickets can earn partial interest
    Given a pool with a period of 10 seconds
    When user 1 buys 100 tickets at 0 seconds in
    And the pool accrues 50 tickets
    And user 2 buys 100 tickets at 5 seconds in
    And the pool accrues 50 tickets
    And the prize is awarded to token 1
    Then user 1 should have 80 ticket interest
    And user 2 should have 20 ticket interest
