@IsTest
private class NewtonSelectorRecordQueryTest {
  @IsTest
  static void queryReturnsRecordsInOrder() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      insert new List<Account>{
        new Account(Name = 'Charlie', Industry = 'Technology'),
        new Account(Name = 'Alpha', Industry = 'Finance'),
        new Account(Name = 'Bravo', Industry = 'Technology')
      };
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();

      Test.startTest();
      List<SObject> ascResults = NewtonSelectorRecordQuery.query(config);
      config.orderByDirection = 'DESC';
      List<SObject> descResults = NewtonSelectorRecordQuery.query(config);
      Test.stopTest();

      Assert.areEqual(
        new List<String>{ 'Alpha', 'Bravo', 'Charlie' },
        names(ascResults),
        'ASC should sort by Name'
      );
      Assert.areEqual(
        new List<String>{ 'Charlie', 'Bravo', 'Alpha' },
        names(descResults),
        'DESC should reverse the order'
      );
    }
  }

  @IsTest
  static void queryValueUtilCoercesPrimitiveFieldTypes() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      Test.startTest();
      Object booleanValue = NewtonSelectorQueryValueUtil.coerceValue(
        User.IsActive.getDescribe(),
        'true'
      );
      Object integerValue = NewtonSelectorQueryValueUtil.coerceValue(
        Account.NumberOfEmployees.getDescribe(),
        '42'
      );
      Object decimalValue = NewtonSelectorQueryValueUtil.coerceValue(
        Account.AnnualRevenue.getDescribe(),
        '123.45'
      );
      Object dateValue = NewtonSelectorQueryValueUtil.coerceValue(
        Task.ActivityDate.getDescribe(),
        '2026-04-27'
      );
      Object utcDatetimeValue = NewtonSelectorQueryValueUtil.coerceValue(
        Account.CreatedDate.getDescribe(),
        '2026-04-27T12:00:00Z'
      );
      Object offsetDatetimeValue = NewtonSelectorQueryValueUtil.coerceValue(
        Account.CreatedDate.getDescribe(),
        '2026-04-27T14:00:00+02:00'
      );
      Object timeValue = NewtonSelectorQueryValueUtil.coerceValue(
        BusinessHours.MondayStartTime.getDescribe(),
        '14:30:00'
      );
      Object utcTimeValue = NewtonSelectorQueryValueUtil.coerceValue(
        BusinessHours.MondayStartTime.getDescribe(),
        '14:30:05.250Z'
      );
      Test.stopTest();

      Assert.areEqual(true, booleanValue);
      Assert.areEqual(42, integerValue);
      Assert.areEqual(Decimal.valueOf('123.45'), decimalValue);
      Assert.areEqual(Date.valueOf('2026-04-27'), dateValue);
      Assert.areEqual(
        Datetime.newInstanceGmt(2026, 4, 27, 12, 0, 0),
        utcDatetimeValue
      );
      Assert.areEqual(
        Datetime.newInstanceGmt(2026, 4, 27, 12, 0, 0),
        offsetDatetimeValue
      );
      Assert.areEqual(Time.newInstance(14, 30, 0, 0), timeValue);
      Assert.areEqual(Time.newInstance(14, 30, 5, 250), utcTimeValue);
    }
  }

  @IsTest
  static void queryValueUtilRejectsMalformedTime() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      Test.startTest();
      for (String rawValue : new List<String>{ '14:30', '24:00:00', 'noon' }) {
        try {
          NewtonSelectorQueryValueUtil.coerceValue(
            BusinessHours.MondayStartTime.getDescribe(),
            rawValue
          );
          Assert.fail('Expected failure for TIME value: ' + rawValue);
        } catch (NewtonSelectorException e) {
          Assert.areEqual(
            'Invalid value for MondayStartTime (TIME): ' + rawValue,
            e.getMessage()
          );
        }
      }
      Test.stopTest();
    }
  }

  @IsTest
  static void queryAppliesLimit() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorTestDataFactory.createAccounts(10, 'Technology');
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();
      config.queryLimit = 3;

      Test.startTest();
      List<SObject> results = NewtonSelectorRecordQuery.query(config);
      Test.stopTest();

      Assert.areEqual(3, results.size(), 'Limit should cap results');
    }
  }

  @IsTest
  static void queryUsesDefaultLimitForNonPositiveLimit() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorTestDataFactory.createAccounts(55, 'Technology');
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();

      Test.startTest();
      config.queryLimit = 0;
      Integer zeroLimitCount = NewtonSelectorRecordQuery.query(config).size();
      config.queryLimit = -5;
      Integer negativeLimitCount = NewtonSelectorRecordQuery.query(config)
        .size();
      Test.stopTest();

      Assert.areEqual(50, zeroLimitCount, 'Zero limit falls back to 50');
      Assert.areEqual(
        50,
        negativeLimitCount,
        'Negative limit falls back to 50'
      );
    }
  }

  @IsTest
  static void queryCapsLimitAtMaximum() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorTestDataFactory.createAccounts(2001, 'Technology');
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();
      config.queryLimit = 5000;

      Test.startTest();
      List<SObject> results = NewtonSelectorRecordQuery.query(config);
      Test.stopTest();

      Assert.areEqual(
        2000,
        results.size(),
        'A limit above the maximum is clamped to 2000'
      );
    }
  }

  @IsTest
  static void queryRejectsInvalidSortDirection() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();
      config.orderByDirection = 'sideways';

      Test.startTest();
      assertQueryFails(
        config,
        'Invalid sort direction: sideways. Use ASC or DESC.'
      );
      Test.stopTest();
    }
  }

  @IsTest
  static void queryRejectsUnsortableOrderByField() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();
      config.orderByField = 'Description';

      Test.startTest();
      assertQueryFails(config, 'Field not sortable on Account: Description');
      Test.stopTest();
    }
  }

  @IsTest
  static void queryRejectsBlankObject() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorQueryDTO config = new NewtonSelectorQueryDTO();
      config.sObjectApiName = '';

      Test.startTest();
      assertQueryFails(config, 'Object API name is required.');
      Test.stopTest();
    }
  }

  @IsTest
  static void queryRejectsUnknownObject() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorQueryDTO config = new NewtonSelectorQueryDTO();
      config.sObjectApiName = 'DoesNotExist__c';

      Test.startTest();
      assertQueryFails(config, 'Unknown object: DoesNotExist__c');
      Test.stopTest();
    }
  }

  @IsTest
  static void queryRejectsInaccessibleObject() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorQueryDTO config = new NewtonSelectorQueryDTO();
      config.sObjectApiName = 'Opportunity';

      Test.startTest();
      assertQueryFails(config, 'Object not accessible: Opportunity');
      Test.stopTest();
    }
  }

  @IsTest
  static void queryRejectsUnknownField() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();
      config.labelField = 'NotARealField__c';

      Test.startTest();
      assertQueryFails(config, 'Unknown field on Account: NotARealField__c');
      Test.stopTest();
    }
  }

  @IsTest
  static void queryRejectsInaccessibleField() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();
      config.badgeField = 'Rating';

      Test.startTest();
      assertQueryFails(config, 'Field not accessible on Account: Rating');
      Test.stopTest();
    }
  }

  @IsTest
  static void queryRejectsNonFilterableField() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();
      config.whereClause = 'Description = \'x\'';

      Test.startTest();
      assertQueryFails(config, 'Field not filterable on Account: Description');
      Test.stopTest();
    }
  }

  @IsTest
  static void queryExcludesRecordsHiddenBySharing() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    // A contact without an account is private to its owner (here: the test runner).
    insert new Contact(LastName = 'Hidden');
    System.runAs(testUser) {
      insert new Contact(LastName = 'Visible');

      Test.startTest();
      List<SObject> results = NewtonSelectorRecordQuery.query(
        NewtonSelectorTestDataFactory.buildSimpleContactConfig()
      );
      Test.stopTest();

      Assert.areEqual(1, results.size(), 'Hidden contact must be excluded');
      Assert.areEqual('Visible', results[0].get('LastName'));
    }
  }

  private static List<String> names(List<SObject> records) {
    List<String> result = new List<String>();
    for (SObject record : records) {
      result.add((String) record.get('Name'));
    }
    return result;
  }

  private static void assertQueryFails(
    NewtonSelectorQueryDTO config,
    String expectedMessage
  ) {
    try {
      NewtonSelectorRecordQuery.query(config);
      Assert.fail('Expected failure: ' + expectedMessage);
    } catch (NewtonSelectorException e) {
      Assert.areEqual(expectedMessage, e.getMessage());
    }
  }
}
