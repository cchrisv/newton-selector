@IsTest
private class NewtonSelectorWhereParserTest {
  private static final String UNSUPPORTED_ESCAPE_PREFIX = 'Unsupported escape sequence \\';
  private static final String UNSUPPORTED_ESCAPE_SUFFIX = ' in WHERE value. Use \\\' or \\\\ anywhere, and \\% or \\_ only in LIKE values.';

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
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleContactConfig();
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
        'INCLUDES is only supported for multi-select picklist fields: Industry'
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
      Map<String, Integer> expectedCountByWhere = new Map<String, Integer>{
        'Name LIKE \'Test%\'' => 2,
        'NumberOfEmployees != 50' => 1,
        'NumberOfEmployees < 51' => 1,
        'NumberOfEmployees <= 51' => 2,
        'AnnualRevenue > 1000000' => 1,
        'AnnualRevenue >= 1000000' => 2,
        'Industry NOT IN (\'Finance\')' => 2
      };

      Test.startTest();
      for (String whereClause : expectedCountByWhere.keySet()) {
        NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();
        config.whereClause = whereClause;
        Assert.areEqual(
          expectedCountByWhere.get(whereClause),
          NewtonSelectorRecordQuery.query(config).size(),
          'Unexpected row count for WHERE: ' + whereClause
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
      assertQueryFails(
        config,
        'Unsupported WHERE operator after Name: NOT LIKE \'Missing%\''
      );
      Test.stopTest();
    }
  }

  @IsTest
  static void queryRejectsMalformedWhereClauses() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      Map<String, String> expectedByWhere = new Map<String, String>{
        'Name = \'x\' AND = \'y\'' => 'Expected field name in WHERE clause near: = \'y\'',
        'Name' => 'Expected WHERE operator after Name near: end of WHERE clause',
        'Name = ' => 'Expected WHERE value near: end of WHERE clause',
        '(Name = \'x\'' => 'Expected ")" in WHERE clause near: end of WHERE clause',
        'Name = \'abc' => 'Unterminated string in WHERE clause: \'abc',
        'Name <>\'Closed\'' => 'Unexpected ">" in WHERE value near: >\'Closed\'',
        'Name ==\'x\'' => 'Unexpected "=" in WHERE value near: =\'x\'',
        '(Name = (a)' => 'Unexpected "(" in WHERE value near: (a)',
        'Name = \'a\\nb\'' => UNSUPPORTED_ESCAPE_PREFIX +
        'n' +
        UNSUPPORTED_ESCAPE_SUFFIX,
        'Name = \'100\\%\'' => UNSUPPORTED_ESCAPE_PREFIX +
        '%' +
        UNSUPPORTED_ESCAPE_SUFFIX
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
  static void queryMatchesEscapedLikeWildcardLiterally() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      insert new List<Account>{
        new Account(Name = '100%'),
        new Account(Name = '1000 units')
      };
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();
      config.whereClause = 'Name LIKE \'100\\%\'';

      Test.startTest();
      List<SObject> results = NewtonSelectorRecordQuery.query(config);
      Test.stopTest();

      Assert.areEqual(
        new List<String>{ '100%' },
        names(results),
        'An escaped % in LIKE matches a literal percent sign'
      );
    }
  }

  @IsTest
  static void queryTreatsQuotedNullAsText() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorTestDataFactory.createNamedAccounts(
        new List<String>{ 'null', 'Other', 'O\'Brien', 'a\\b' }
      );
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();

      Test.startTest();
      config.whereClause = 'Name = \'null\'';
      List<SObject> equalsResults = NewtonSelectorRecordQuery.query(config);
      config.whereClause = 'Name IN (\'NULL\', \'Missing\')';
      List<SObject> inResults = NewtonSelectorRecordQuery.query(config);
      config.whereClause = 'Name = \'O\\\'Brien\'';
      List<SObject> quoteResults = NewtonSelectorRecordQuery.query(config);
      config.whereClause = 'Name = \'a\\\\b\'';
      List<SObject> backslashResults = NewtonSelectorRecordQuery.query(config);
      Test.stopTest();

      Assert.areEqual(1, equalsResults.size(), 'Quoted null is the text null');
      Assert.areEqual('null', equalsResults[0].get('Name'));
      Assert.areEqual(1, inResults.size(), 'Quoted NULL in IN is text');
      Assert.areEqual(
        new List<String>{ 'O\'Brien' },
        names(quoteResults),
        'An escaped quote matches a literal apostrophe'
      );
      Assert.areEqual(
        new List<String>{ 'a\\b' },
        names(backslashResults),
        'An escaped backslash matches a literal backslash'
      );
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
  static void queryFiltersByIsoDatetimeLiteral() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      NewtonSelectorTestDataFactory.createAccounts(2, 'Technology');
      NewtonSelectorQueryDTO config = NewtonSelectorTestDataFactory.buildSimpleAccountConfig();

      Test.startTest();
      config.whereClause = 'CreatedDate < 2999-01-01T00:00:00Z';
      Integer beforeCount = NewtonSelectorRecordQuery.query(config).size();
      config.whereClause = 'CreatedDate > 2999-01-01T00:00:00Z';
      Integer afterCount = NewtonSelectorRecordQuery.query(config).size();
      Test.stopTest();

      Assert.areEqual(2, beforeCount, 'Rows created now are before 2999');
      Assert.areEqual(0, afterCount, 'No row is created after 2999');
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
