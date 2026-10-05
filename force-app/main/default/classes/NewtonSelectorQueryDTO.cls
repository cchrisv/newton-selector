/** @description Query configuration used by the Newton Selector runtime Apex service. Defaults live in NewtonSelectorQueryBuilder. */
public class NewtonSelectorQueryDTO {
  @AuraEnabled
  public String sObjectApiName;
  @AuraEnabled
  public String whereClause;
  @AuraEnabled
  public String orderByField;
  @AuraEnabled
  public String orderByDirection;
  @AuraEnabled
  public Integer queryLimit;

  @AuraEnabled
  public String labelField;
  @AuraEnabled
  public String valueField;
  @AuraEnabled
  public String sublabelField;
  @AuraEnabled
  public String iconField;
  @AuraEnabled
  public String badgeField;
  @AuraEnabled
  public String helpField;
}
