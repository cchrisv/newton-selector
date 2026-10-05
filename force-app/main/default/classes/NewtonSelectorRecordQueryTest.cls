@IsTest
private class NewtonSelectorRecordQueryTest {
  private static final Integer BULK_RECORD_COUNT = 251;

  @IsTest
  static void queryReturnsRecordsInOrder() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorTestDataFactory.createAccounts(10, 'Technology');
      NewtonSelectorTestDataFactory.createAccounts(5, 'Finance');
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();

      Test.startTest();
      List<SObject> results = NewtonSelectorRecordQuery.query(config);
      Test.stopTest();

      Assert.areEqual(15, results.size(), 'Should return all 15 accounts');
      Assert.isTrue(
        ((String) results[0].get('Name'))
          .compareTo((String) results[1].get('Name')) <= 0,
        'Should be ordered ASC by Name'
      );
    }
  }

  @IsTest
  static void queryFiltersByWhereClause() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorTestDataFactory.createAccounts(10, 'Technology');
      NewtonSelectorTestDataFactory.createAccounts(5, 'Finance');
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();
      config.whereClause = 'Industry = \'Technology\'';

      Test.startTest();
      List<SObject> results = NewtonSelectorRecordQuery.query(config);
      Test.stopTest();

      Assert.areEqual(10, results.size(), 'Should only return Tech accounts');
      for (SObject record : results) {
        Assert.areEqual('Technology', record.get('Industry'));
      }
    }
  }

  @IsTest
  static void queryFiltersByWhereClauseInList() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorTestDataFactory.createAccounts(10, 'Technology');
      NewtonSelectorTestDataFactory.createAccounts(5, 'Finance');
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();
      config.whereClause = 'Industry IN (\'Technology\', \'Finance\')';

      Test.startTest();
      List<SObject> results = NewtonSelectorRecordQuery.query(config);
      Test.stopTest();

      Assert.areEqual(
        15,
        results.size(),
        'WHERE IN should include both industries'
      );
    }
  }

  @IsTest
  static void queryHonorsGroupedWhere() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      insert new List<Account>{
        new Account(Name = 'A', Industry = 'Technology'),
        new Account(Name = 'A', Industry = 'Finance'),
        new Account(Name = 'B', Industry = 'Healthcare')
      };
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();
      config.whereClause = 'Name = \'A\' AND (Industry = \'Technology\' OR Industry = \'Healthcare\')';

      Test.startTest();
      List<SObject> results = NewtonSelectorRecordQuery.query(config);
      Test.stopTest();

      Assert.areEqual(1, results.size(), 'Parentheses must group the OR');
      Assert.areEqual('Technology', results[0].get('Industry'));
    }
  }

  @IsTest
  static void queryFiltersByIncludesOnMultiPicklist() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      insert new List<Contact>{
        new Contact(LastName = 'Champion', BuyerAttributes = 'Champion;Buyer'),
        new Contact(LastName = 'Evaluator', BuyerAttributes = 'Evaluator'),
        new Contact(LastName = 'Blank')
      };
      NewtonSelectorQueryDTO config = contactConfig();
      config.whereClause = 'BuyerAttributes INCLUDES (\'Champion\', \'Detractor\')';

      Test.startTest();
      List<SObject> results = NewtonSelectorRecordQuery.query(config);
      Test.stopTest();

      Assert.areEqual(1, results.size());
      Assert.areEqual('Champion', results[0].get('LastName'));
    }
  }

  @IsTest
  static void queryRejectsMultipicklistOperatorOnSinglePicklistWhereClause() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();
      config.whereClause = 'Industry INCLUDES (\'Technology\')';

      Test.startTest();
      assertQueryFails(
        config,
        'INCLUDES is only supported for multi-select picklist fields.'
      );
      Test.stopTest();
    }
  }

  @IsTest
  static void queryRejectsUnsafeWhereClause() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();
      config.whereClause = 'Industry = \'Technology\' ORDER BY CreatedDate';

      Test.startTest();
      assertQueryFails(
        config,
        'Unsupported WHERE clause near: ORDER BY CreatedDate'
      );
      Test.stopTest();
    }
  }

  @IsTest
  static void queryParsesAdditionalComparisonOperators() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorTestDataFactory.createAccounts(2, 'Technology');
      List<String> whereClauses = new List<String>{
        'Name LIKE \'Test%\'',
        'NumberOfEmployees != 0',
        'NumberOfEmployees >= 50',
        'AnnualRevenue < 2000000',
        'AnnualRevenue <= 2000000',
        'AnnualRevenue > 0',
        'Industry NOT IN (\'Finance\')'
      };

      Test.startTest();
      for (String whereClause : whereClauses) {
        NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();
        config.whereClause = whereClause;
        List<SObject> results = NewtonSelectorRecordQuery.query(config);
        Assert.areEqual(
          2,
          results.size(),
          'Expected two records for WHERE: ' + whereClause
        );
      }
      Test.stopTest();
    }
  }

  @IsTest
  static void queryRejectsUnsupportedNotLikeWhereClause() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();
      config.whereClause = 'Name NOT LIKE \'Missing%\'';

      Test.startTest();
      assertQueryFails(config, 'Unsupported WHERE operator.');
      Test.stopTest();
    }
  }

  @IsTest
  static void queryTreatsQuotedNullAsText() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      insert new List<Account>{
        new Account(Name = 'null'),
        new Account(Name = 'Other')
      };
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();

      Test.startTest();
      config.whereClause = 'Name = \'null\'';
      List<SObject> equalsResults = NewtonSelectorRecordQuery.query(config);
      config.whereClause = 'Name IN (\'NULL\', \'Missing\')';
      List<SObject> inResults = NewtonSelectorRecordQuery.query(config);
      Test.stopTest();

      Assert.areEqual(1, equalsResults.size(), 'Quoted null is the text null');
      Assert.areEqual('null', equalsResults[0].get('Name'));
      Assert.areEqual(1, inResults.size(), 'Quoted NULL in IN is text');
    }
  }

  @IsTest
  static void queryTreatsBareNullAsNull() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorTestDataFactory.createAccounts(2, 'Technology');
      insert new Account(Name = 'No Industry');
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();

      Test.startTest();
      config.whereClause = 'Industry = NULL';
      List<SObject> nullResults = NewtonSelectorRecordQuery.query(config);
      config.whereClause = 'Industry != null';
      List<SObject> notNullResults = NewtonSelectorRecordQuery.query(config);
      Test.stopTest();

      Assert.areEqual(1, nullResults.size());
      Assert.areEqual('No Industry', nullResults[0].get('Name'));
      Assert.areEqual(2, notNullResults.size());
    }
  }

  @IsTest
  static void queryRejectsLiteralsThatDoNotMatchFieldType() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      Map<String, String> expectedByWhere = new Map<String, String>{
        'NumberOfEmployees = abc' => 'Invalid value for NumberOfEmployees (INTEGER): abc',
        'AnnualRevenue > lots' => 'Invalid value for AnnualRevenue (CURRENCY): lots',
        'LastActivityDate = soon' => 'Invalid value for LastActivityDate (DATE): soon',
        'CreatedDate > yesterday' => 'Invalid value for CreatedDate (DATETIME): yesterday',
        'IsDeleted = yes' => 'Invalid value for IsDeleted (BOOLEAN): yes',
        'NumberOfEmployees IN (1, x)' => 'Invalid value for NumberOfEmployees (INTEGER): x'
      };

      Test.startTest();
      for (String whereClause : expectedByWhere.keySet()) {
        NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();
        config.whereClause = whereClause;
        assertQueryFails(config, expectedByWhere.get(whereClause));
      }
      Test.stopTest();
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
      Object dateTimeValue = NewtonSelectorQueryValueUtil.coerceValue(
        Account.CreatedDate.getDescribe(),
        '2026-04-27 12:00:00'
      );
      Test.stopTest();

      Assert.areEqual(true, booleanValue);
      Assert.areEqual(42, integerValue);
      Assert.areEqual(Decimal.valueOf('123.45'), decimalValue);
      Assert.areEqual(Date.valueOf('2026-04-27'), dateValue);
      Assert.areEqual(Datetime.valueOf('2026-04-27 12:00:00'), dateTimeValue);
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
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();
      config.queryLimit = 5000;

      Test.startTest();
      String soql = NewtonSelectorQueryBuilder.build(config).soql;
      Test.stopTest();

      Assert.isTrue(soql.endsWith(' LIMIT 2000'), soql);
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
  static void queryHandlesBulkVolume() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorTestDataFactory.createAccounts(
        BULK_RECORD_COUNT,
        'Healthcare'
      );
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();
      config.whereClause = 'Industry = \'Healthcare\'';
      config.queryLimit = 500;

      Test.startTest();
      List<SObject> results = NewtonSelectorRecordQuery.query(config);
      Test.stopTest();

      Assert.areEqual(
        BULK_RECORD_COUNT,
        results.size(),
        'Should return all healthcare accounts under the 500 limit'
      );
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
      List<SObject> results = NewtonSelectorRecordQuery.query(contactConfig());
      Test.stopTest();

      Assert.areEqual(1, results.size(), 'Hidden contact must be excluded');
      Assert.areEqual('Visible', results[0].get('LastName'));
    }
  }

  private static NewtonSelectorQueryDTO contactConfig() {
    NewtonSelectorQueryDTO config = new NewtonSelectorQueryDTO();
    config.sObjectApiName = 'Contact';
    config.labelField = 'LastName';
    config.orderByField = 'LastName';
    return config;
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
