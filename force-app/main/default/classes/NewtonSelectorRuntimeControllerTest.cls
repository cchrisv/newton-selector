@IsTest
private class NewtonSelectorRuntimeControllerTest {
  private static final Integer BULK_RECORD_COUNT = 251;

  @IsTest
  static void queryItemsSuccess() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorTestDataFactory.createAccounts(3, 'Technology');
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();
      String configJson = JSON.serialize(config);

      Test.startTest();
      List<NewtonSelectorItemDTO> dtos = NewtonSelectorRuntimeController.queryItems(
        configJson
      );
      Test.stopTest();

      Assert.areEqual(3, dtos.size());
    }
  }

  @IsTest
  static void queryItemsRejectsBlankConfig() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      Test.startTest();
      assertQueryItemsFails('', 'Selector configuration is required.');
      Test.stopTest();
    }
  }

  @IsTest
  static void queryItemsRejectsMalformedJson() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      Test.startTest();
      assertQueryItemsFails(
        '{ not valid json',
        'Invalid selector configuration.'
      );
      Test.stopTest();
    }
  }

  @IsTest
  static void queryItemsReportsInvalidWhereValue() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();
      config.whereClause = 'NumberOfEmployees = abc';

      Test.startTest();
      assertQueryItemsFails(
        JSON.serialize(config),
        'Invalid value for NumberOfEmployees (INTEGER): abc'
      );
      Test.stopTest();
    }
  }

  @IsTest
  static void queryItemsAppliesWhereClause() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorTestDataFactory.createAccounts(3, 'Technology');
      NewtonSelectorTestDataFactory.createAccounts(2, 'Banking');
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();
      config.whereClause = 'Industry = \'Technology\'';
      String configJson = JSON.serialize(config);

      Test.startTest();
      List<NewtonSelectorItemDTO> techOnly = NewtonSelectorRuntimeController.queryItems(
        configJson
      );
      Test.stopTest();

      Assert.areEqual(
        3,
        techOnly.size(),
        'WHERE should filter to Technology only'
      );
    }
  }

  @IsTest
  static void queryItemsBulk() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorTestDataFactory.createAccounts(BULK_RECORD_COUNT, 'Bulk');
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();
      config.whereClause = 'Industry = \'Bulk\'';
      config.queryLimit = 500;
      String configJson = JSON.serialize(config);

      Test.startTest();
      List<NewtonSelectorItemDTO> dtos = NewtonSelectorRuntimeController.queryItems(
        configJson
      );
      Test.stopTest();

      Assert.areEqual(BULK_RECORD_COUNT, dtos.size());
    }
  }

  @IsTest
  static void validateQueryAcceptsValidConfig() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorTestDataFactory.createAccounts(1, 'Technology');
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();
      config.whereClause = 'Industry = \'Technology\'';

      Test.startTest();
      NewtonSelectorQueryValidationResultDTO result = NewtonSelectorRuntimeController.validateQuery(
        JSON.serialize(config)
      );
      Test.stopTest();

      Assert.areEqual(true, result.valid);
      Assert.areEqual('Query validated successfully.', result.message);
    }
  }

  @IsTest
  static void validateQueryRejectsBadWhereClause() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();
      config.whereClause = 'DefinitelyMissing__c = \'Nope\'';

      Test.startTest();
      NewtonSelectorQueryValidationResultDTO result = NewtonSelectorRuntimeController.validateQuery(
        JSON.serialize(config)
      );
      Test.stopTest();

      Assert.areEqual(false, result.valid);
      Assert.areEqual(
        'Unknown field on Account: DefinitelyMissing__c',
        result.message
      );
    }
  }

  @IsTest
  static void validateQueryReportsDatabaseError() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();
      config.whereClause = 'NumberOfEmployees LIKE 5';

      Test.startTest();
      NewtonSelectorQueryValidationResultDTO result = NewtonSelectorRuntimeController.validateQuery(
        JSON.serialize(config)
      );
      Test.stopTest();

      Assert.areEqual(false, result.valid);
      Assert.isTrue(
        result.message.containsIgnoreCase('LIKE'),
        'The database error should be reported: ' + result.message
      );
    }
  }

  @IsTest
  static void validateQueryRejectsBlankConfig() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      Test.startTest();
      NewtonSelectorQueryValidationResultDTO result = NewtonSelectorRuntimeController.validateQuery(
        ''
      );
      Test.stopTest();

      Assert.areEqual(false, result.valid);
      Assert.areEqual('Selector configuration is required.', result.message);
    }
  }

  @IsTest
  static void validateQueryRejectsMalformedJson() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      Test.startTest();
      NewtonSelectorQueryValidationResultDTO result = NewtonSelectorRuntimeController.validateQuery(
        '{ not valid json'
      );
      Test.stopTest();

      Assert.areEqual(false, result.valid);
      Assert.areEqual('Invalid selector configuration.', result.message);
    }
  }

  @IsTest
  static void validateQueryRejectsNullJson() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      Test.startTest();
      NewtonSelectorQueryValidationResultDTO result = NewtonSelectorRuntimeController.validateQuery(
        'null'
      );
      Test.stopTest();

      Assert.areEqual(false, result.valid);
      Assert.areEqual('Selector configuration is required.', result.message);
    }
  }

  private static void assertQueryItemsFails(
    String configJson,
    String expectedMessage
  ) {
    try {
      NewtonSelectorRuntimeController.queryItems(configJson);
      Assert.fail('Expected failure: ' + expectedMessage);
    } catch (AuraHandledException e) {
      Assert.areEqual(expectedMessage, e.getMessage());
    }
  }
}
