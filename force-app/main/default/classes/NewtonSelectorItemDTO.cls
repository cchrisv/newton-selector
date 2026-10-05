/** @description Runtime option DTO returned to the Newton Selector Flow screen component. */
public class NewtonSelectorItemDTO {
  @AuraEnabled
  public String id;
  @AuraEnabled
  public String label;
  @AuraEnabled
  public String sublabel;
  @AuraEnabled
  public String icon;
  @AuraEnabled
  public String badge;
  @AuraEnabled
  public String helpText;
  @AuraEnabled
  public String value;
  /** @description Queried source record; carries Id and the configured fields only. */
  @AuraEnabled
  public SObject record;
}
