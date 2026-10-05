/** @description Domain exception for Newton Selector validation and query failures. */
public class NewtonSelectorException extends Exception {
  /**
   * @description Builds the AuraHandledException an @AuraEnabled method throws so the
   * LWC receives the message itself instead of "Script-thrown exception".
   * @param message Message to show in the editor or runtime.
   * @return AuraHandledException carrying the message.
   */
  public static AuraHandledException toAuraException(String message) {
    AuraHandledException e = new AuraHandledException(message);
    e.setMessage(message);
    return e;
  }
}
