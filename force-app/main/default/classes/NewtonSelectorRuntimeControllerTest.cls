@IsTest
private class NewtonSelectorRuntimeControllerTest {
  private static final String FLEX_QUEUE_FILTER_ERROR = 'data.api.DataSourceUnsupportedQueryException: The WHERE clause must contain a JobType field expression.';

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
      String message;
      Test.startTest();
      try {
        NewtonSelectorRuntimeController.queryItems('{ not valid json');
        Assert.fail('Expected failure for malformed JSON');
      } catch (AuraHandledException e) {
        message = e.getMessage();
      }
      Test.stopTest();

      assertNamesParserError(message);
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
  static void validateQueryReportsExternalDataSourceError() {
    User testUser = NewtonSelectorTestDataFactory.createViewSetupUser();
    System.runAs(testUser) {
      Test.startTest();
      NewtonSelectorQueryValidationResultDTO result = NewtonSelectorRuntimeController.validateQuery(
        JSON.serialize(buildUnfilteredFlexQueueConfig())
      );
      Test.stopTest();

      Assert.areEqual(false, result.valid);
      Assert.areEqual(FLEX_QUEUE_FILTER_ERROR, result.message);
    }
  }

  @IsTest
  static void queryItemsReportsExternalDataSourceError() {
    User testUser = NewtonSelectorTestDataFactory.createViewSetupUser();
    System.runAs(testUser) {
      Test.startTest();
      assertQueryItemsFails(
        JSON.serialize(buildUnfilteredFlexQueueConfig()),
        FLEX_QUEUE_FILTER_ERROR
      );
      Test.stopTest();
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
      assertNamesParserError(result.message);
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

  // FlexQueueItem is served by a platform data source that rejects a query
  // without a JobType filter with System.ExternalObjectException, not QueryException.
  private static NewtonSelectorQueryDTO buildUnfilteredFlexQueueConfig() {
    NewtonSelectorQueryDTO config = new NewtonSelectorQueryDTO();
    config.sObjectApiName = 'FlexQueueItem';
    config.labelField = 'JobType';
    return config;
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

  // The parser's own detail (token, line, column) must reach the admin.
  private static void assertNamesParserError(String message) {
    String prefix = 'Invalid selector configuration: ';
    Assert.isTrue(message.startsWith(prefix), message);
    Assert.isTrue(message.length() > prefix.length(), message);
  }
}
