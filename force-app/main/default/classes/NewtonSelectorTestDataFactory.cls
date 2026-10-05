@IsTest
/** @description Test data helpers for Newton Selector Apex tests. */
public class NewtonSelectorTestDataFactory {
  private static final List<String> GRANTED_OBJECTS = new List<String>{
    'Account',
    'Contact'
  };
  private static final List<String> GRANTED_FIELDS = new List<String>{
    'Account.Industry',
    'Account.AnnualRevenue',
    'Account.NumberOfEmployees',
    'Account.Description',
    'Contact.AccountId',
    'Contact.BuyerAttributes'
  };
  private static Integer userCounter = 0;
  private static Id accessPermissionSetId;

  /**
   * @description Creates Account test records with the supplied industry.
   * @param count Number of Accounts to create.
   * @param industry Account Industry value.
   * @return Inserted Account records.
   */
  public static List<Account> createAccounts(Integer count, String industry) {
    List<Account> accounts = new List<Account>();
    for (Integer i = 0; i < count; i++) {
      accounts.add(
        new Account(
          Name = 'Test Account ' + i,
          Industry = industry,
          AnnualRevenue = 1000000 + (i * 1000),
          NumberOfEmployees = 50 + i
        )
      );
    }
    insert accounts;
    return accounts;
  }

  /**
   * @description Creates a non-admin user on a profile without Account access. A test
   * permission set grants read/create/edit on Account and Contact plus the fields in
   * GRANTED_FIELDS; every other object (e.g. Opportunity) and field (e.g. Account.Rating)
   * stays inaccessible. Avoids profile names, which are localized.
   * @return Inserted User.
   */
  public static User createStandardUser() {
    userCounter++;
    String uniq = String.valueOf(System.currentTimeMillis()) + userCounter;
    User u = new User(
      FirstName = 'Newton',
      LastName = 'Test',
      Alias = 'newtont',
      Email = 'newton.test+' + uniq + '@example.com',
      Username = 'newton.test+' + uniq + '@example.com.newton',
      ProfileId = profileWithoutAccountAccess(),
      TimeZoneSidKey = 'America/Los_Angeles',
      LocaleSidKey = 'en_US',
      EmailEncodingKey = 'UTF-8',
      LanguageLocaleKey = 'en_US'
    );
    // Setup-object DML runs as the current user so tests can mix in record DML.
    System.runAs(new User(Id = UserInfo.getUserId())) {
      insert u;
      insert new PermissionSetAssignment(
        AssigneeId = u.Id,
        PermissionSetId = accessPermissionSet()
      );
    }
    return u;
  }

  /**
   * @description Builds the standard Account query config used by runtime Apex tests.
   * @return Account selector query config.
   */
  public static NewtonSelectorQueryDTO buildSimpleAccountConfig() {
    NewtonSelectorQueryDTO config = new NewtonSelectorQueryDTO();
    config.sObjectApiName = 'Account';
    config.labelField = 'Name';
    config.valueField = 'Id';
    config.sublabelField = 'Industry';
    config.orderByField = 'Name';
    config.orderByDirection = 'ASC';
    config.queryLimit = 50;
    return config;
  }

  private static Id profileWithoutAccountAccess() {
    Set<Id> profilesWithAccountAccess = new Set<Id>();
    for (ObjectPermissions grant : [
      SELECT Parent.ProfileId
      FROM ObjectPermissions
      WHERE SobjectType = 'Account' AND Parent.IsOwnedByProfile = TRUE
    ]) {
      profilesWithAccountAccess.add(grant.Parent.ProfileId);
    }
    return [
      SELECT Id
      FROM Profile
      WHERE
        UserType = 'Standard'
        AND UserLicense.LicenseDefinitionKey = 'SFDC'
        AND PermissionsViewAllData = FALSE
        AND Id NOT IN :profilesWithAccountAccess
      LIMIT 1
    ]
    .Id;
  }

  private static Id accessPermissionSet() {
    if (accessPermissionSetId != null) {
      return accessPermissionSetId;
    }
    PermissionSet permissionSet = new PermissionSet(
      Name = 'Newton_Selector_Test_Access',
      Label = 'Newton Selector Test Access'
    );
    insert permissionSet;

    List<ObjectPermissions> objectGrants = new List<ObjectPermissions>();
    for (String objectName : GRANTED_OBJECTS) {
      objectGrants.add(
        new ObjectPermissions(
          ParentId = permissionSet.Id,
          SobjectType = objectName,
          PermissionsRead = true,
          PermissionsCreate = true,
          PermissionsEdit = true
        )
      );
    }
    insert objectGrants;

    List<FieldPermissions> fieldGrants = new List<FieldPermissions>();
    for (String field : GRANTED_FIELDS) {
      fieldGrants.add(
        new FieldPermissions(
          ParentId = permissionSet.Id,
          SobjectType = field.substringBefore('.'),
          Field = field,
          PermissionsRead = true,
          PermissionsEdit = true
        )
      );
    }
    insert fieldGrants;

    accessPermissionSetId = permissionSet.Id;
    return accessPermissionSetId;
  }
}
