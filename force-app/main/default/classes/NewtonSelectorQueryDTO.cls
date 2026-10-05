/** @description Query configuration used by the Newton Selector runtime Apex service. Defaults live in NewtonSelectorQueryBuilder. */
public class NewtonSelectorQueryDTO {
  public String sObjectApiName;
  public String whereClause;
  public String orderByField;
  public String orderByDirection;
  public Integer queryLimit;

  public String labelField;
  public String valueField;
  public String sublabelField;
  public String iconField;
  public String badgeField;
  public String helpField;
}
