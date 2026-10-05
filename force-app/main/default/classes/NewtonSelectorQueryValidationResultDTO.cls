/** @description Validation result returned to the Flow CPE query validator. */
public class NewtonSelectorQueryValidationResultDTO {
  @AuraEnabled
  public Boolean valid;
  @AuraEnabled
  public String message;

  /**
   * @description Creates a validation result.
   * @param valid True when the query ran successfully.
   * @param message Admin-facing result or error message.
   */
  public NewtonSelectorQueryValidationResultDTO(Boolean valid, String message) {
    this.valid = valid;
    this.message = message;
  }
}
