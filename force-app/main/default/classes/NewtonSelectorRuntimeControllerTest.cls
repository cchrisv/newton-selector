@IsTest
private class NewtonSelectorRuntimeControllerTest {
  private static final Integer BULK_RECORD_COUNT = 251;
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
  static void validateQueryReportsExternalDataSourceError() {
    User testUser = createViewSetupUser();
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
    User testUser = createViewSetupUser();
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

  // FlexQueueItem is served by a platform data source that rejects a query
  // without a JobType filter with System.ExternalObjectException, not QueryException.
  private static NewtonSelectorQueryDTO buildUnfilteredFlexQueueConfig() {
    NewtonSelectorQueryDTO config = new NewtonSelectorQueryDTO();
    config.sObjectApiName = 'FlexQueueItem';
    config.labelField = 'JobType';
    return config;
  }

  // FlexQueueItem is readable only with View Setup and Configuration.
  private static User createViewSetupUser() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(new User(Id = UserInfo.getUserId())) {
      PermissionSet viewSetup = new PermissionSet(
        Name = 'Newton_Selector_Test_View_Setup',
        Label = 'Newton Selector Test View Setup',
        PermissionsViewSetup = true,
        PermissionsViewRoles = true
      );
      insert viewSetup;
      insert new PermissionSetAssignment(
        AssigneeId = testUser.Id,
        PermissionSetId = viewSetup.Id
      );
    }
    return testUser;
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
