/**
 * @description Tests for NewtonSelectorFlowCpeController. Covers the AuraEnabled
 * methods exposed to the Flow CPE LWCs: object search and object field describe.
 */
@IsTest
private class NewtonSelectorFlowCpeControllerTest {
  @IsTest
  static void testGetObjectFieldsReturnsAccountFields() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      Assert.isTrue(
        Schema.SObjectType.Account.fields.BillingAddress.isAccessible(),
        'Precondition: test user can read BillingAddress'
      );

      Test.startTest();
      List<NewtonSelectorFlowCpeController.Field> fields = NewtonSelectorFlowCpeController.getObjectFields(
        'Account'
      );
      Test.stopTest();

      NewtonSelectorFlowCpeController.Field name = findField(fields, 'Name');
      Assert.areNotEqual(null, name, 'Account.Name should be returned');
      Assert.areEqual('STRING', name.type);
      Assert.isTrue(name.filterable, 'Name can be used in WHERE');
      Assert.isTrue(name.sortable, 'Name can be used in ORDER BY');
      NewtonSelectorFlowCpeController.Field description = findField(
        fields,
        'Description'
      );
      Assert.isFalse(
        description.filterable,
        'Long text areas cannot be filtered'
      );
      Assert.isFalse(description.sortable, 'Long text areas cannot be sorted');
      Assert.areEqual(
        null,
        findField(fields, 'Rating'),
        'Fields the user cannot read are omitted'
      );
      Assert.areEqual(
        null,
        findField(fields, 'BillingAddress'),
        'Compound address fields cannot be mapped and are omitted'
      );
      Assert.areNotEqual(
        null,
        findField(fields, 'BillingCity'),
        'Address component fields are still offered'
      );
    }
  }

  @IsTest
  static void testGetObjectFieldsCarryDisplayType() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      List<NewtonSelectorFlowCpeController.Field> fields = NewtonSelectorFlowCpeController.getObjectFields(
        'Account'
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
        NewtonSelectorFlowCpeController.Field field = findField(
          fields,
          fieldName
        );
        Assert.areNotEqual(null, field, fieldName + ' should be returned');
        Assert.areEqual(expectedTypes.get(fieldName), field.type, fieldName);
      }
    }
  }

  @IsTest
  static void testGetObjectFieldsRejectsUnusableObjects() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      assertGetObjectFieldsFails('', 'Object API name is required.');
      assertGetObjectFieldsFails(
        'NotAnObjectZZZ__c',
        'Unknown object: NotAnObjectZZZ__c'
      );
      assertGetObjectFieldsFails(
        'Opportunity',
        'Object not accessible: Opportunity'
      );
    }
  }

  @IsTest
  static void testObjectNamesAreCaseInsensitive() {
    User testUser = NewtonSelectorTestDataFactory.createStandardUser();
    System.runAs(testUser) {
      List<NewtonSelectorFlowCpeController.Field> fields = NewtonSelectorFlowCpeController.getObjectFields(
        'account'
      );

      Assert.areNotEqual(null, findField(fields, 'Name'));
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

  private static void assertGetObjectFieldsFails(
    String objectName,
    String expectedMessage
  ) {
    try {
      NewtonSelectorFlowCpeController.getObjectFields(objectName);
      Assert.fail('Expected failure: ' + expectedMessage);
    } catch (AuraHandledException e) {
      Assert.areEqual(expectedMessage, e.getMessage());
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
    for (NewtonSelectorFlowCpeController.ChoiceOption row : rows) {
      if (row.value == value) {
        return true;
      }
    }
    return false;
  }
}
