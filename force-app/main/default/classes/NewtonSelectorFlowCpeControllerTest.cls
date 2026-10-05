/**
 * @description Tests for NewtonSelectorFlowCpeController. Covers the AuraEnabled
 * methods exposed to the Flow CPE LWCs: object search, field search, and object describe.
 */
@IsTest
private class NewtonSelectorFlowCpeControllerTest {
  @IsTest
  static void testGetObjectFieldsReturnsAccountFields() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      Test.startTest();
      List<NewtonSelectorFlowCpeController.Field> fields = NewtonSelectorFlowCpeController.getObjectFields(
        'Account'
      );
      Test.stopTest();

      NewtonSelectorFlowCpeController.Field name = findField(fields, 'Name');
      Assert.areNotEqual(null, name, 'Account.Name should be returned');
      Assert.areEqual('STRING', name.type);
      Assert.areEqual(
        null,
        findField(fields, 'Rating'),
        'Fields the user cannot read are omitted'
      );
    }
  }

  @IsTest
  static void testGetObjectFieldsBlankNameReturnsEmpty() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      Assert.areEqual(
        0,
        NewtonSelectorFlowCpeController.getObjectFields(null).size()
      );
      Assert.areEqual(
        0,
        NewtonSelectorFlowCpeController.getObjectFields('').size()
      );
      Assert.areEqual(
        0,
        NewtonSelectorFlowCpeController.getObjectFields('   ').size()
      );
    }
  }

  @IsTest
  static void testGetObjectFieldsInvalidTypeReturnsEmpty() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      Assert.areEqual(
        0,
        NewtonSelectorFlowCpeController.getObjectFields('NotARealObjectZZZ999')
          .size()
      );
    }
  }

  @IsTest
  static void testGetObjectFieldsIncludesRelationshipName() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      Test.startTest();
      List<NewtonSelectorFlowCpeController.Field> fields = NewtonSelectorFlowCpeController.getObjectFields(
        'Contact'
      );
      Test.stopTest();

      NewtonSelectorFlowCpeController.Field accountLookup = findField(
        fields,
        'AccountId'
      );
      Assert.areNotEqual(null, accountLookup);
      Assert.areEqual('Account', accountLookup.relationshipName);
    }
  }

  @IsTest
  static void testSearchSObjectTypesReturnsAccount() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      List<NewtonSelectorFlowCpeController.ChoiceOption> rows = NewtonSelectorFlowCpeController.searchSObjectTypes(
        'accoun'
      );

      Assert.isTrue(containsChoice(rows, 'Account'));
      Assert.isFalse(
        containsChoice(rows, 'Opportunity'),
        'Objects the user cannot read are omitted'
      );
    }
  }

  @IsTest
  static void testSearchSObjectTypesBlankReturnsRows() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      List<NewtonSelectorFlowCpeController.ChoiceOption> rows = NewtonSelectorFlowCpeController.searchSObjectTypes(
        ''
      );
      Assert.isTrue(containsChoice(rows, 'Account'));
      Assert.isTrue(containsChoice(rows, 'Contact'));
    }
  }

  @IsTest
  static void testSearchSObjectTypesNoMatchReturnsEmpty() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      List<NewtonSelectorFlowCpeController.ChoiceOption> rows = NewtonSelectorFlowCpeController.searchSObjectTypes(
        'zzzzzznomatchobject99999'
      );
      Assert.areEqual(0, rows.size());
    }
  }

  @IsTest
  static void testSearchSObjectTypesNullSafe() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      Assert.isTrue(
        containsChoice(
          NewtonSelectorFlowCpeController.searchSObjectTypes(null),
          'Account'
        )
      );
    }
  }

  @IsTest
  static void testSearchLookupDatasetFieldsForAccount() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      List<NewtonSelectorFlowCpeController.ChoiceOption> rows = NewtonSelectorFlowCpeController.searchLookupDatasetFieldsForObject(
        'Account',
        ''
      );

      Assert.isTrue(
        containsChoice(rows, 'Name'),
        'Account.Name should be present in the field lookup'
      );
      Assert.isFalse(
        containsChoice(rows, 'Rating'),
        'Fields the user cannot read are omitted'
      );
    }
  }

  @IsTest
  static void testFieldChoicesCarryDisplayType() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      List<NewtonSelectorFlowCpeController.ChoiceOption> rows = NewtonSelectorFlowCpeController.searchLookupDatasetFieldsForObject(
        'Account',
        ''
      );

      Map<String, String> expectedTypes = new Map<String, String>{
        'Id' => 'ID',
        'Name' => 'STRING',
        'Industry' => 'PICKLIST',
        'AnnualRevenue' => 'CURRENCY',
        'NumberOfEmployees' => 'INTEGER',
        'CreatedDate' => 'DATETIME',
        'ParentId' => 'REFERENCE'
      };
      for (String fieldName : expectedTypes.keySet()) {
        NewtonSelectorFlowCpeController.ChoiceOption row = findChoice(
          rows,
          fieldName
        );
        Assert.areNotEqual(null, row, fieldName + ' should be returned');
        Assert.areEqual(expectedTypes.get(fieldName), row.type, fieldName);
      }
    }
  }

  @IsTest
  static void testObjectNamesAreCaseInsensitive() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      List<NewtonSelectorFlowCpeController.ChoiceOption> rows = NewtonSelectorFlowCpeController.searchLookupDatasetFieldsForObject(
        'ACCOUNT',
        'name'
      );
      List<NewtonSelectorFlowCpeController.Field> fields = NewtonSelectorFlowCpeController.getObjectFields(
        'account'
      );

      Assert.isTrue(containsChoice(rows, 'Name'));
      Assert.areEqual('Account', rows[0].sObjectType);
      Assert.areNotEqual(null, findField(fields, 'Name'));
    }
  }

  @IsTest
  static void testSearchLookupDatasetFieldsBlankObjectReturnsEmpty() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      Assert.areEqual(
        0,
        NewtonSelectorFlowCpeController.searchLookupDatasetFieldsForObject(
            '',
            'x'
          )
          .size()
      );
      Assert.areEqual(
        0,
        NewtonSelectorFlowCpeController.searchLookupDatasetFieldsForObject(
            null,
            'x'
          )
          .size()
      );
    }
  }

  @IsTest
  static void testSearchLookupDatasetFieldsBogusObjectReturnsEmpty() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      Assert.areEqual(
        0,
        NewtonSelectorFlowCpeController.searchLookupDatasetFieldsForObject(
            'NotAnObjectZZZ__c',
            ''
          )
          .size()
      );
    }
  }

  @IsTest
  static void testSearchLookupDatasetFieldsFiltersByKey() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      List<NewtonSelectorFlowCpeController.ChoiceOption> rows = NewtonSelectorFlowCpeController.searchLookupDatasetFieldsForObject(
        'Account',
        'name'
      );

      Assert.isTrue(containsChoice(rows, 'Name'));
      for (NewtonSelectorFlowCpeController.ChoiceOption row : rows) {
        Assert.isTrue(
          row.value.toLowerCase().contains('name') ||
          row.label.toLowerCase().contains('name')
        );
      }
    }
  }

  private static NewtonSelectorFlowCpeController.Field findField(
    List<NewtonSelectorFlowCpeController.Field> fields,
    String fieldName
  ) {
    for (NewtonSelectorFlowCpeController.Field field : fields) {
      if (field.name == fieldName) {
        return field;
      }
    }
    return null;
  }

  private static Boolean containsChoice(
    List<NewtonSelectorFlowCpeController.ChoiceOption> rows,
    String value
  ) {
    return findChoice(rows, value) != null;
  }

  private static NewtonSelectorFlowCpeController.ChoiceOption findChoice(
    List<NewtonSelectorFlowCpeController.ChoiceOption> rows,
    String value
  ) {
    for (NewtonSelectorFlowCpeController.ChoiceOption row : rows) {
      if (row.value == value) {
        return row;
      }
    }
    return null;
  }
}
