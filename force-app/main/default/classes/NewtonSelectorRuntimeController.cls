/** @description AuraEnabled runtime and query-validation controller for the Flow screen LWC. */
public with sharing class NewtonSelectorRuntimeController {
  // Both entry points catch Exception: the database also fails with types other
  // than QueryException, e.g. ExternalObjectException for FlexQueueItem without
  // a JobType filter. System.UnexpectedException ("field ... can not be sorted")
  // is uncatchable; the NewtonSelectorQueryFieldAccess checks prevent it.

  /**
   * @description Queries runtime selector items from a serialized NewtonSelectorQueryDTO.
   * Failures surface as AuraHandledException carrying the validation or database message.
   * Not cacheable: a revisited Flow screen must show records changed earlier in the Flow.
   * @param configJson Serialized NewtonSelectorQueryDTO.
   * @return Runtime selector item DTOs.
   */
  @AuraEnabled(cacheable=false)
  public static List<NewtonSelectorItemDTO> queryItems(String configJson) {
    try {
      return NewtonSelectorService.fetchItems(parseConfig(configJson));
    } catch (Exception e) {
      throw NewtonSelectorException.toAuraException(e.getMessage());
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
    } catch (Exception e) {
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
      throw new NewtonSelectorException(
        'Invalid selector configuration: ' + e.getMessage()
      );
    }
    if (config == null) {
      throw new NewtonSelectorException('Selector configuration is required.');
    }
    return config;
  }
}
