Feature: Authenticate internal calls
  As a service that exposes routes for other Google services
  I want to accept only callers with a token issued by Google for my service
  So that a job or another service can call me and nobody else can

  Scenario: An allowed caller is accepted
    Given the service lists the account of the scheduler as an allowed caller
    When the scheduler calls with a token issued for the service
    Then the call is accepted

  Scenario: A caller that is not allowed is rejected
    Given the service lists the account of the scheduler as an allowed caller
    When another account calls with a valid token
    Then the call is rejected

  Scenario: A token for another service is rejected
    When a caller sends a token issued for another audience
    Then the call is rejected

  Scenario: A call without a token is rejected
    When a caller sends no token
    Then the call is rejected

  Scenario: Nothing configured rejects everything
    Given the service has no audience or no allowed callers configured
    When any caller calls
    Then the call is rejected

  Scenario: Local development against emulators
    Given an emulator is configured
    When any caller calls
    Then the call is accepted, since there is no Google token against the emulators
