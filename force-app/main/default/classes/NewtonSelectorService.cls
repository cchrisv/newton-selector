/** @description Runtime service that maps queried records into selector item DTOs. */
public with sharing class NewtonSelectorService {
  /**
   * @description Fetches records using the supplied query config and normalizes them for LWC.
   * @param config Selector query configuration.
   * @return Runtime selector item DTOs.
   */
  public static List<NewtonSelectorItemDTO> fetchItems(
    NewtonSelectorQueryDTO config
  ) {
    List<NewtonSelectorItemDTO> dtos = new List<NewtonSelectorItemDTO>();
    for (SObject record : NewtonSelectorRecordQuery.query(config)) {
      dtos.add(mapSingle(record, config));
    }
    return dtos;
  }

  private static NewtonSelectorItemDTO mapSingle(
    SObject record,
    NewtonSelectorQueryDTO config
  ) {
    NewtonSelectorItemDTO dto = new NewtonSelectorItemDTO();
    dto.id = record.Id;
    dto.label = readString(record, config.labelField);
    dto.sublabel = readString(record, config.sublabelField);
    dto.icon = readString(record, config.iconField);
    dto.badge = readString(record, config.badgeField);
    dto.helpText = readString(record, config.helpField);
    dto.value = resolveValue(record, config, dto.id);
    dto.record = record;
    return dto;
  }

  private static String readString(SObject record, String fieldApiName) {
    if (String.isBlank(fieldApiName)) {
      return '';
    }
    Object raw = record.get(fieldApiName);
    return raw == null ? '' : String.valueOf(raw);
  }

  private static String resolveValue(
    SObject record,
    NewtonSelectorQueryDTO config,
    String fallbackId
  ) {
    String value = readString(record, config.valueField);
    return String.isNotBlank(value) ? value : fallbackId;
  }
}
