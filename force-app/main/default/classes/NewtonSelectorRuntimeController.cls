/** @description AuraEnabled runtime and query-validation controller for the Flow screen LWC. */
public with sharing class NewtonSelectorRuntimeController {
  /**
   * @description Queries runtime selector items from a serialized NewtonSelectorQueryDTO.
   * Failures surface as AuraHandledException carrying the validation or database message.
   * @param configJson Serialized NewtonSelectorQueryDTO.
   * @return Runtime selector item DTOs.
   */
  @AuraEnabled(cacheable=true)
  public static List<NewtonSelectorItemDTO> queryItems(String configJson) {
    try {
      return NewtonSelectorService.fetchItems(parseConfig(configJson));
    } catch (NewtonSelectorException e) {
      throw auraException(e.getMessage());
    } catch (QueryException e) {
      throw auraException(e.getMessage());
    }
  }

  /**
   * @description Validates a serialized query configuration by running it with LIMIT 1.
   * @param configJson Serialized NewtonSelectorQueryDTO.
   * @return Validation status and the validation or database message.
   */
  @AuraEnabled(cacheable=false)
  public static NewtonSelectorQueryValidationResultDTO validateQuery(
    String configJson
  ) {
    try {
      NewtonSelectorQueryDTO config = parseConfig(configJson);
      config.queryLimit = 1;
      NewtonSelectorRecordQuery.query(config);
      return new NewtonSelectorQueryValidationResultDTO(
        true,
        'Query validated successfully.'
      );
    } catch (NewtonSelectorException e) {
      return new NewtonSelectorQueryValidationResultDTO(false, e.getMessage());
    } catch (QueryException e) {
      return new NewtonSelectorQueryValidationResultDTO(false, e.getMessage());
    }
  }

  private static NewtonSelectorQueryDTO parseConfig(String configJson) {
    if (String.isBlank(configJson)) {
      throw new NewtonSelectorException('Selector configuration is required.');
    }

    NewtonSelectorQueryDTO config;
    try {
      config = (NewtonSelectorQueryDTO) JSON.deserialize(
        configJson,
        NewtonSelectorQueryDTO.class
      );
    } catch (JSONException e) {
      throw new NewtonSelectorException('Invalid selector configuration.');
    }
    if (config == null) {
      throw new NewtonSelectorException('Selector configuration is required.');
    }
    return config;
  }

  private static AuraHandledException auraException(String message) {
    AuraHandledException e = new AuraHandledException(message);
    e.setMessage(message);
    return e;
  }
}
