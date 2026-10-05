/*
 * Adapted from UnofficialSF fsc_flowCombobox (Apache-2.0). See repo LICENSE
 * and NOTICE.
 *
 * Known limitation: Flow Builder doesn't expose enough metadata here to resolve
 * Filter and Transform output parameters, so CPEs can allow a manually entered
 * merge field (allowHardCodeReference).
 */

import { LightningElement, wire, api } from "lwc";
import { getObjectInfo } from "lightning/uiObjectInfoApi";
import {
  TYPE_ICON_MAP,
  loadErrorMessage,
  formattedValue,
  isReference,
  getDataType,
  removeFormatting,
  flowComboboxDefaults
} from "c/newtonSelectorFlowCpeUtilityHelpers";
import getObjectFields from "@salesforce/apex/NewtonSelectorFlowCpeController.getObjectFields";

/** Shown when allowHardCodeReference is true (CPE / manual merge fields). */
const MANUAL_REFERENCE_PLACEHOLDER = "Pick a resource or type a value";
const MERGE_FIELD_CACHE = new WeakMap();
const PROCESSED_OPTIONS_CACHE = new WeakMap();

// The option's meta line: "ApiName — Type", without the name when it repeats
// the label.
function optionSubtitle(value, label, displayType) {
  return [value && value !== label ? value : "", displayType]
    .filter(Boolean)
    .join(" — ");
}

// UI API data types that hold text; a text picker lists fields of any of them.
const TEXT_DATA_TYPES = new Set([
  "string",
  "textarea",
  "picklist",
  "combobox",
  "email",
  "phone",
  "url",
  "encryptedstring"
]);

const OUTPUTS_FROM_LABEL = "Outputs from ";
const GLOBAL_VARIABLES_TYPE = "Global Variables";
const OPTION_CLASS =
  "slds-media slds-listbox__option slds-listbox__option_entity slds-listbox__option_has-meta newton-selector-flow-cpe-resource-selector__option";

const GLOBAL_VARIABLE_ICONS = Object.freeze({
  $Flow: "workflow",
  $User: "user-round",
  $UserRole: "building-2",
  $Profile: "settings",
  $System: "settings"
});
const RECORD_GLOBAL_VARIABLE_ICONS = Object.freeze({
  $Record: "database",
  $Record__Prior: "database"
});
// Fields offered under $Flow and $System, as [name, data type].
const GLOBAL_VARIABLE_FIELDS = Object.freeze({
  $Flow: [
    ["ActiveStages", "String"],
    ["CurrentStage", "String"],
    ["CurrentDate", "Date"],
    ["CurrentDateTime", "DateTime"],
    ["CurrentRecord", "String"],
    ["FaultMessage", "String"],
    ["InterviewGuid", "String"],
    ["InterviewStartTime", "Time"]
  ],
  $System: [["OriginDateTime", "String"]]
});
// Objects whose fields are offered under the other globals.
const GLOBAL_VARIABLE_OBJECTS = Object.freeze({
  $User: "User",
  $Profile: "Profile",
  $UserRole: "UserRole"
});

function getIconNameByType(variableType) {
  return TYPE_ICON_MAP[String(variableType || "").toUpperCase()];
}

function isDrillable(row) {
  return row.isObject || row.storeOutputAutomatically || row.globalVariable;
}

export default class NewtonSelectorFlowCpeResourceSelector extends LightningElement {
  @api name;
  @api label;
  @api required = false;
  @api maxWidth;
  /** 'standard' (default) | 'label-hidden' — hides the label visually but keeps it for screen readers. */
  @api variant = "standard";

  @api
  get builderContextFilterType() {
    return this._builderContextFilterType;
  }
  set builderContextFilterType(value) {
    this._builderContextFilterType = value;
    this.processOptions();
  }
  _builderContextFilterType;

  @api
  get builderContextFilterCollectionBoolean() {
    return this._builderContextFilterCollectionBoolean;
  }
  set builderContextFilterCollectionBoolean(value) {
    this._builderContextFilterCollectionBoolean = value;
    this.processOptions();
  }
  _builderContextFilterCollectionBoolean;

  // An owner-supplied error (for example a value this field can't take),
  // shown under the field and linked to it.
  @api
  get errorMessage() {
    return this._errorMessage;
  }
  set errorMessage(value) {
    this._errorMessage = value || "";
  }
  _errorMessage = "";

  @api
  get allowHardCodeReference() {
    return this._allowHardCodeReference;
  }
  set allowHardCodeReference(value) {
    this._allowHardCodeReference = value;
    this.placeholderText = value ? MANUAL_REFERENCE_PLACEHOLDER : "";
  }
  _allowHardCodeReference = false; // Set to true in the CPE to allow the user to hard code a reference like {!Filter_Element} or {!Transform_Output}
  placeholderText;

  _dataType;
  _value;
  // The last value received or reported; Back returns to it.
  _committedRaw = "";
  _committedType;
  allOptions;
  _options = [];
  _mergeFields = [];
  isDataSelected = false;
  _selectedObjectType;
  _selectedFieldPath;
  _RecordObject; // Used when a start element is in the flow
  hasError = false;
  loadError = "";
  loadingOptions = false;
  isMenuOpen = false;
  isDataModified = false;
  selfEvent = false;
  key = 0;
  _activeIndex = -1;
  _scrollActivePending = false;
  _focusTriggerPending = false;
  _selectedOptionObjectType = "";
  _selectedOptionIsCollection = false;
  _selectedOptionLabel = "";
  _selectedOptionIcon = "";
  _builderContext;
  _automaticOutputVariables;
  labels = {
    noDataAvailable:
      "No matching resources. Check the spelling, or create the resource in the Toolbox.",
    invalidReferenceError:
      "This flow has no resource with that name. To enter plain text, leave out the {! }.",
    loading: "Loading fields…",
    back: "Back",
    drillHint: "Press Right Arrow to open."
  };

  typeDescriptors = [
    {
      apiName: "variables",
      label: "Variables",
      dataType: "dataType",
      objectTypeField: "objectType",
      isCollectionField: flowComboboxDefaults.isCollectionField
    },
    {
      apiName: "constants",
      label: "Global Constants",
      dataType: flowComboboxDefaults.stringDataType
    },
    {
      apiName: "textTemplates",
      label: "Variables",
      dataType: flowComboboxDefaults.stringDataType
    },
    {
      apiName: "stages",
      label: "Variables",
      dataType: flowComboboxDefaults.stringDataType
    },
    {
      apiName: "screens.fields",
      label: "Screen Components",
      dataType: flowComboboxDefaults.screenComponentType
    },
    {
      apiName: "screens.fields.fields.fields",
      label: "Screen Components",
      dataType: flowComboboxDefaults.screenComponentType
    },
    {
      apiName: flowComboboxDefaults.recordLookupsType,
      label: "Variables",
      dataType: "SObject",
      objectTypeField: "object",
      isCollectionField: "getFirstRecordOnly"
    },
    // An automatically stored Create Records element holds the new record's Id.
    {
      apiName: flowComboboxDefaults.recordCreatesType,
      label: "Variables",
      dataType: flowComboboxDefaults.stringDataType
    },
    {
      apiName: "formulas",
      label: "Formulas",
      dataType: flowComboboxDefaults.stringDataType
    },
    {
      apiName: "actionCalls",
      label: "Actions",
      dataType: flowComboboxDefaults.actionType
    },
    {
      apiName: "screens.actions",
      label: "Screen Actions",
      dataType: flowComboboxDefaults.screenActionType
    }
  ];

  /** Plain text as typed, or a Flow resource as "{!Name}". */
  @api
  get value() {
    return this.committedValue;
  }

  set value(value) {
    this._dataType = getDataType(value);
    this.applyInternalValue(removeFormatting(value));
    this._committedRaw = this._value;
    this._committedType = this._dataType;
  }

  get committedValue() {
    return this._value ? formattedValue(this._value, this._dataType) : "";
  }

  get inputValue() {
    return this._value || "";
  }

  /**
   * Update displayed value from internal navigation (avoid @api self-reassign lint).
   */
  applyInternalValue(value) {
    this.isDataSelected = !!value;
    this._value = value;
    this.determineSelectedType();
  }

  @api get builderContext() {
    return this._builderContext;
  }

  set builderContext(value) {
    this._builderContext = value;
    if (this._automaticOutputVariables) {
      this.initFromBuilderContextAndAutomaticOutputVariables();
    }
  }

  @api get automaticOutputVariables() {
    return this._automaticOutputVariables;
  }

  set automaticOutputVariables(value) {
    this._automaticOutputVariables = value;
    if (this._builderContext) {
      this.initFromBuilderContextAndAutomaticOutputVariables();
    }
  }

  initFromBuilderContextAndAutomaticOutputVariables() {
    this._mergeFields = this.getCachedMergeFields(this._builderContext);
    if (!this._selectedObjectType) {
      this.setOptions(this._mergeFields);
      this.determineSelectedType();
    }
  }

  getCachedMergeFields(builderContext) {
    this._RecordObject = builderContext.start?.object;
    let cached = MERGE_FIELD_CACHE.get(builderContext);
    if (!cached) {
      cached = this.adjustOptions(
        this.generateMergeFieldsFromBuilderContext(builderContext)
      );
      MERGE_FIELD_CACHE.set(builderContext, cached);
    }
    return cached;
  }

  get displayPill() {
    return (
      this.isDataSelected &&
      this._dataType === flowComboboxDefaults.referenceDataType
    );
  }

  get selectedDisplayLabel() {
    return (
      this._selectedOptionLabel ||
      this.selectedOption?.label ||
      removeFormatting(this._value || "")
    );
  }

  get selectedResourceIconName() {
    if (this._selectedOptionIsCollection) {
      return "layers";
    }
    return (
      this._selectedOptionIcon || this.selectedOption?.optionIcon || "layers"
    );
  }

  get selectedOption() {
    const value = removeFormatting(this._value || "");
    const parts = value.split(".").filter(Boolean);
    const candidates = new Set(
      [value, parts[0], parts[parts.length - 1]].filter(Boolean)
    );
    return this.flattenedOptions.find((option) => candidates.has(option.value));
  }

  get flattenedOptions() {
    const optionGroups = Array.isArray(this.allOptions) ? this.allOptions : [];
    return optionGroups.flatMap((group) => {
      return Array.isArray(group.options) ? group.options : [];
    });
  }

  // The rows the menu shows, in display order.
  get visibleRows() {
    return this._options.flatMap((group) => group.options);
  }

  get activeRow() {
    return this.isMenuOpen && this._activeIndex >= 0
      ? this.visibleRows[this._activeIndex]
      : undefined;
  }

  get optionGroups() {
    let index = 0;
    return this._options.map((group, groupIndex) => ({
      ...group,
      headingId: `resource-group-${groupIndex}`,
      options: group.options.map((option) => {
        const optionIndex = index++;
        const isActive = optionIndex === this._activeIndex;
        return {
          ...option,
          index: optionIndex,
          optionId: `resource-option-${optionIndex}`,
          ariaSelected: isActive ? "true" : "false",
          optionClass: isActive
            ? `${OPTION_CLASS} newton-selector-flow-cpe-resource-selector__option_active`
            : OPTION_CLASS,
          isDrillable: isDrillable(option)
        };
      })
    }));
  }

  get hasNoOptions() {
    return !this._options.length;
  }

  get isDrilledIn() {
    return !!this._selectedFieldPath;
  }

  get emptyMessage() {
    if (this.loadingOptions) {
      return this.labels.loading;
    }
    return this.loadError || this.labels.noDataAvailable;
  }

  get dropdownExpanded() {
    return this.isMenuOpen ? "true" : "false";
  }

  get listboxId() {
    return this.isMenuOpen ? "resource-listbox" : null;
  }

  get activeOptionId() {
    return this.activeRow ? `resource-option-${this._activeIndex}` : null;
  }

  get errorText() {
    return (
      this._errorMessage ||
      (this.hasError ? this.labels.invalidReferenceError : "")
    );
  }

  get ariaInvalid() {
    return this.errorText ? "true" : "false";
  }

  get errorDescribedBy() {
    return this.errorText ? "resource-help" : null;
  }

  setOptions(value) {
    this.loadError = "";
    this._options = value || [];
    this.allOptions = this._options;
    this.processOptions();
  }

  adjustOptions(mergeFields) {
    const sObjectSingleList = [];
    const sObjectCollectionList = [];
    mergeFields.forEach((optionList) => {
      for (let i = 0; i < optionList.options.length; i++) {
        if (optionList.options[i].isObject) {
          if (optionList.options[i].isCollection) {
            sObjectCollectionList.push(optionList.options[i]);
          } else {
            sObjectSingleList.push(optionList.options[i]);
          }
          optionList.options.splice(i, 1);
          i--;
        }
      }
    });

    mergeFields.push({
      type: "Record Collection Variables",
      options: sObjectCollectionList
    });

    mergeFields.push({
      type: "Record Variables",
      options: sObjectSingleList
    });

    return mergeFields;
  }

  getTypeOption(value) {
    if (value) {
      const parentVar = value.split(".")[0];
      if (parentVar && this._mergeFields && this._mergeFields.length) {
        for (let i = 0; i < this._mergeFields.length; i++) {
          const localOption = this._mergeFields[i].options.find(
            (curTypeOption) => {
              const result =
                curTypeOption.value.toLowerCase() === parentVar.toLowerCase() ||
                curTypeOption.value.toLowerCase() === value.toLowerCase();
              return result;
            }
          );
          if (localOption) {
            return localOption;
          }
        }
      }
    }
    return undefined;
  }

  @wire(getObjectInfo, { objectApiName: "$_selectedObjectType" })
  _getObjectInfo({ error, data }) {
    if (error) {
      this.loadingOptions = false;
      this.setOptions([]);
      this.loadError = loadErrorMessage("fields", error);
    } else if (data) {
      const tempOptions = [];
      Object.keys(data.fields).forEach((curField) => {
        const curFieldData = data.fields[curField];
        const curDataType =
          curFieldData.dataType === "Reference"
            ? "SObject"
            : curFieldData.dataType;
        const curObjectType = curFieldData.referenceToInfos.length
          ? curFieldData.referenceToInfos[0].apiName
          : null;
        // Flow walks a lookup by its relationship name ({!acc.Owner.Name}).
        // Polymorphic lookups need a typed segment, so they are not opened.
        const drillable =
          curDataType === "SObject" &&
          !!curFieldData.relationshipName &&
          curFieldData.referenceToInfos.length === 1;
        tempOptions.push({
          ...this.generateOptionLine(
            curDataType,
            curFieldData.label,
            curFieldData.apiName,
            false,
            curObjectType,
            getIconNameByType(curDataType),
            drillable,
            curDataType === "SObject" ? curObjectType : curDataType,
            flowComboboxDefaults.defaultKeyPrefix + this.key++
          ),
          relationshipName: drillable
            ? curFieldData.relationshipName
            : undefined
        });
      });
      this.loadingOptions = false;
      this.setOptions([{ type: data.label + " Fields", options: tempOptions }]);
    }
  }

  // A saved one-hop path ("acc.Name") reopens on that record's fields.
  determineSelectedType() {
    if (this._value && this.allOptions) {
      const valParts = this._value.replace(/[^a-zA-Z0-9._-]/g, "").split(".");
      if (valParts.length === 2) {
        this.allOptions.forEach((curOption) => {
          const localOptions = curOption.options;
          const selectedOption = localOptions.find(
            (curSelectedOption) => curSelectedOption.value === valParts[0]
          );
          if (selectedOption && selectedOption.isObject) {
            this._selectedObjectType = selectedOption.displayType;
            valParts.pop();
            this._selectedFieldPath = valParts.join(".");
          }
        });
      }
    }
  }

  generateMergeFieldsFromBuilderContext(builderContext) {
    const optionsByType = {};

    this.typeDescriptors.forEach((localType) => {
      const typeParts = localType.apiName.split("."); // e.g. 'screen.fields'

      if (builderContext[typeParts[0]]) {
        let objectToExamine = builderContext;
        let parentNodeLabel = "";
        typeParts.forEach((curTypePart) => {
          if (objectToExamine[curTypePart]) {
            objectToExamine = objectToExamine[curTypePart].map((curItem) => {
              parentNodeLabel = curItem.label ? curItem.label : curItem.name;
              return {
                ...curItem,
                varApiName: curItem.name,
                varLabel: parentNodeLabel
              };
            });
          } else {
            if (Array.isArray(objectToExamine)) {
              let allObjectToExamine = [];
              objectToExamine.forEach((curObjToExam) => {
                const nestedItems = curObjToExam[curTypePart];
                if (
                  !curObjToExam.storeOutputAutomatically &&
                  Array.isArray(nestedItems)
                ) {
                  allObjectToExamine = [
                    ...allObjectToExamine,
                    ...nestedItems.map((curItem) => {
                      return {
                        ...curItem,
                        varApiName: curObjToExam.name + "." + curItem.name,
                        varLabel:
                          (curObjToExam.label
                            ? curObjToExam.label
                            : parentNodeLabel) +
                          ": " +
                          curItem.name
                      };
                    })
                  ];
                }
              });
              objectToExamine = allObjectToExamine;
            }
          }
        });

        const typeOptions = this.getOptionLines(objectToExamine, localType);
        if (typeOptions.length) {
          optionsByType[localType.label] = [
            ...(optionsByType[localType.label] || []),
            ...typeOptions
          ];
        }
      }
    });

    const globalVariableIcons = this._RecordObject
      ? { ...GLOBAL_VARIABLE_ICONS, ...RECORD_GLOBAL_VARIABLE_ICONS }
      : GLOBAL_VARIABLE_ICONS;
    const globalVariables = Object.entries(globalVariableIcons).map(
      ([name, icon]) => ({
        ...this.globalVariableOption(name, "String", name, icon),
        globalVariable: true
      })
    );

    optionsByType[GLOBAL_VARIABLES_TYPE] = [
      ...(optionsByType[GLOBAL_VARIABLES_TYPE] || []),
      ...globalVariables
    ];

    return Object.keys(optionsByType).map((curKey) => ({
      type: curKey,
      options: optionsByType[curKey]
    }));
  }

  globalVariableOption(label, type, value, icon, displayType = type) {
    return {
      type,
      label,
      value,
      isCollection: false,
      objectType: null,
      optionIcon: icon,
      isObject: false,
      globalVariable: false,
      displayType,
      subtitle: optionSubtitle(value, label, displayType),
      key: flowComboboxDefaults.defaultGlobalVariableKeyPrefix + this.key++,
      storeOutputAutomatically: false
    };
  }

  getOptionLines(objectArray, typeDescriptor) {
    const isCollectionField =
      typeDescriptor.isCollectionField ||
      flowComboboxDefaults.isCollectionField;
    const objectTypeField = typeDescriptor.objectTypeField || "objectType";
    const isActionCall =
      typeDescriptor.apiName === flowComboboxDefaults.actionType;
    const isScreenAction =
      typeDescriptor.dataType === flowComboboxDefaults.screenActionType;
    // Get and Create Records are resources only when they store their output
    // automatically.
    const isRecordElement =
      typeDescriptor.apiName === flowComboboxDefaults.recordLookupsType ||
      typeDescriptor.apiName === flowComboboxDefaults.recordCreatesType;
    const typeOptions = [];
    objectArray.forEach((curObject) => {
      const isScreenComponent =
        typeDescriptor.dataType === flowComboboxDefaults.screenComponentType &&
        curObject.storeOutputAutomatically;
      const isSection = curObject.name?.startsWith(
        flowComboboxDefaults.regionContainerName
      );
      const curDataType = isScreenAction
        ? flowComboboxDefaults.screenActionType
        : isActionCall
          ? flowComboboxDefaults.actionType
          : isScreenComponent
            ? flowComboboxDefaults.screenComponentType
            : this.getTypeByDescriptor(curObject.dataType, typeDescriptor);
      const label =
        isActionCall || isScreenAction
          ? OUTPUTS_FROM_LABEL + curObject.name
          : curObject.varLabel
            ? curObject.varLabel
            : curObject.varApiName;
      const curIsCollection = this.isCollection(curObject, isCollectionField);
      const storeOutputAutomatically =
        isScreenAction ||
        isScreenComponent ||
        (isActionCall && !!curObject.storeOutputAutomatically);
      if (
        !isSection &&
        (!isRecordElement || curObject.storeOutputAutomatically) &&
        (!isScreenAction || this.automaticOutputVariables[curObject.name])
      ) {
        typeOptions.push(
          this.generateOptionLine(
            curDataType,
            label,
            // A screen component's "Screen.Component" name is offered as "Component".
            typeDescriptor.dataType === flowComboboxDefaults.screenComponentType
              ? curObject.varApiName.split(".")[1]
              : curObject.varApiName,
            typeDescriptor.apiName === flowComboboxDefaults.recordLookupsType
              ? !curIsCollection
              : !!curIsCollection,
            curObject[objectTypeField],
            getIconNameByType(curDataType),
            curDataType === flowComboboxDefaults.dataTypeSObject ||
              typeDescriptor.apiName === flowComboboxDefaults.recordLookupsType,
            curDataType === flowComboboxDefaults.dataTypeSObject
              ? curObject[objectTypeField]
              : curDataType,
            flowComboboxDefaults.defaultKeyPrefix + this.key++,
            storeOutputAutomatically
          )
        );
      }
    });
    return typeOptions;
  }

  isCollection(curObject, isCollectionField) {
    return Object.prototype.hasOwnProperty.call(curObject, isCollectionField)
      ? curObject[isCollectionField]
      : curObject[flowComboboxDefaults.isCollectionField];
  }

  matchesType(option, filterType) {
    const types = [
      String(option.displayType || "").toLowerCase(),
      String(option.type || "").toLowerCase()
    ];
    if (filterType === "string") {
      return types.some((type) => TEXT_DATA_TYPES.has(type));
    }
    return types.includes(filterType);
  }

  // A text picker also lists single records, to open them and pick a field.
  matchesBuilderContextFilter(option, filterType, hasCollectionFilter) {
    if (filterType === "sobject") {
      return (
        String(option.type || "").toLowerCase() === "sobject" ||
        option.isObject === true
      );
    }

    return (
      this.matchesType(option, filterType) ||
      (option.storeOutputAutomatically === true && !hasCollectionFilter) ||
      (filterType === "string" && option.isObject && !option.isCollection)
    );
  }

  // A global variable row ($Record, $User) only opens its fields in every
  // picker; in a text picker a record row does too, since the record itself
  // is not a text value.
  isDrillOnly(row) {
    const filterType = String(
      this.builderContextFilterType || ""
    ).toLowerCase();
    return (
      row.globalVariable ||
      (filterType === "string" &&
        row.isObject &&
        !this.matchesType(row, filterType))
    );
  }

  getTypeByDescriptor(curObjectFieldType, typeDescriptor) {
    if (typeDescriptor.apiName === flowComboboxDefaults.recordLookupsType) {
      return flowComboboxDefaults.dataTypeSObject;
    }
    return curObjectFieldType
      ? curObjectFieldType
      : flowComboboxDefaults.stringDataType;
  }

  generateOptionLine(
    type,
    label,
    value,
    isCollection,
    objectType,
    optionIcon,
    isObject,
    displayType,
    key,
    storeOutputAutomatically
  ) {
    return {
      type: type,
      label: label,
      value: value,
      isCollection: isCollection,
      objectType: objectType,
      optionIcon: optionIcon,
      isObject: isObject,
      globalVariable: false,
      displayType: displayType,
      subtitle: optionSubtitle(value, label, displayType),
      key: key,
      storeOutputAutomatically: storeOutputAutomatically
    };
  }

  rowFromEvent(event) {
    event.stopPropagation(); // stops the window generic click handlers from firing 2x more times
    return this.visibleRows[Number(event.currentTarget.dataset.index)];
  }

  handleOptionClick(event) {
    this.chooseRow(this.rowFromEvent(event));
  }

  handleOpenObject(event) {
    this.openObject(this.rowFromEvent(event));
  }

  handleOpenScreenComponent(event) {
    this.openOutputs(this.rowFromEvent(event));
  }

  handleOpenGlobalVariable(event) {
    this.openGlobalVariable(this.rowFromEvent(event));
  }

  chooseRow(row) {
    if (this.isDrillOnly(row)) {
      this.drillInto(row);
    } else {
      this.selectOption(row);
    }
  }

  selectOption(row) {
    this._dataType = flowComboboxDefaults.referenceDataType;
    this._selectedOptionObjectType = row.objectType || "";
    this._selectedOptionIsCollection = row.isCollection === true;
    this._selectedOptionLabel = row.label || "";
    this._selectedOptionIcon = row.optionIcon || "";
    this.applyInternalValue(
      this.getFullPath(this._selectedFieldPath, row.value)
    );
    this.isDataModified = true;
    this.hasError = false;
    this.closeOptionDialog();
  }

  drillInto(row) {
    if (row.isObject) {
      this.openObject(row);
    } else if (row.storeOutputAutomatically) {
      this.openOutputs(row);
    } else {
      this.openGlobalVariable(row);
    }
  }

  openGlobalVariable(row) {
    const value = row.value;
    this._selectedFieldPath = this.getFullPath(this._selectedFieldPath, value);
    this.applyInternalValue(this._selectedFieldPath + ".");

    const group = `${value} Outputs`;
    const fixedFields = GLOBAL_VARIABLE_FIELDS[value];
    if (fixedFields) {
      this.setOptions([
        {
          type: group,
          options: fixedFields.map(([name, type]) =>
            this.globalVariableOption(name, type, name, getIconNameByType(type))
          )
        }
      ]);
      return;
    }

    this.loadingOptions = true;
    this.setOptions([]);
    getObjectFields({
      objectName: GLOBAL_VARIABLE_OBJECTS[value] || this._RecordObject
    })
      .then((fields) => {
        this.loadingOptions = false;
        this.setOptions([
          {
            type: group,
            options: fields.map((field) =>
              this.globalVariableOption(
                field.label,
                field.type,
                field.name,
                getIconNameByType(field.type)
              )
            )
          }
        ]);
      })
      .catch((error) => {
        this.loadingOptions = false;
        this.setOptions([]);
        this.loadError = loadErrorMessage("fields", error);
      });
  }

  // The root rows leave the menu while the object's fields load, so none of
  // them can be picked under the new path.
  openObject(row) {
    this._selectedFieldPath = this.getFullPath(
      this._selectedFieldPath,
      row.relationshipName || row.value
    );
    if (row.objectType !== this._selectedObjectType) {
      this.loadingOptions = true;
      this.setOptions([]);
    }
    this.applyInternalValue(this._selectedFieldPath + ".");
    this._selectedObjectType = row.objectType;
  }

  openOutputs(row) {
    const parts = row.value.split(".");
    this._selectedFieldPath = this.getFullPath(
      this._selectedFieldPath,
      parts.length > 1 ? parts[1] : row.value
    );
    this.applyInternalValue(this._selectedFieldPath + ".");
    this.getActionOutputs(this._selectedFieldPath);
  }

  getActionOutputs(path) {
    const tempOptions = [];
    this.automaticOutputVariables[path].forEach((output) => {
      const curObjectType = output.sobjectType
        ? output.sobjectType
        : output.subtype;
      const curDataType =
        output.dataType === "sobject" ? "SObject" : output.dataType;
      tempOptions.push(
        this.generateOptionLine(
          output.dataType,
          output.label ? output.label : output.apiName,
          output.apiName ? output.apiName : output.name,
          output.maxOccurs > 1,
          curObjectType,
          getIconNameByType(curDataType),
          curDataType === "SObject",
          curDataType === "SObject" ? curObjectType : curDataType,
          flowComboboxDefaults.defaultKeyPrefix + this.key++,
          !!this.automaticOutputVariables[path + "." + output.apiName]
        )
      );
    });
    this.setOptions([{ type: path + " Outputs", options: tempOptions }]);
  }

  dispatchValueChangedEvent() {
    this._committedRaw = this._value;
    this._committedType = this._dataType;
    this.dispatchEvent(
      new CustomEvent("valuechanged", {
        detail: {
          newValue: this.committedValue,
          objectType: this._selectedOptionObjectType || ""
        }
      })
    );
  }

  // Back only navigates: it returns to the resource list and keeps the value.
  handleBack(event) {
    event.stopPropagation();
    this.goBack();
  }

  goBack() {
    this._selectedFieldPath = "";
    this._selectedObjectType = null;
    this.loadingOptions = false;
    this._value = this._committedRaw;
    this._dataType = this._committedType;
    this.isDataSelected = !!this._value;
    this.setOptions(this._mergeFields);
  }

  resetTypeOptions() {
    this.isDataModified = true;
    this._selectedFieldPath = "";
    this._selectedObjectType = null;
    this.loadingOptions = false;
    this._selectedOptionObjectType = "";
    this._selectedOptionIsCollection = false;
    this._selectedOptionLabel = "";
    this._selectedOptionIcon = "";
    this._dataType = flowComboboxDefaults.stringDataType;
    this.setOptions(this._mergeFields);
  }

  openOptionDialog() {
    this.isMenuOpen = true;
  }

  closeOptionDialog(setValueInput) {
    // Leaving a drilled list without picking a field restores the committed
    // value instead of keeping the partial path ("rec."). The input still
    // shows that path until the next render, so it is not read back.
    const leavesPartialPath =
      setValueInput &&
      this.isDrilledIn &&
      this._value === this._selectedFieldPath + ".";
    if (leavesPartialPath) {
      this.goBack();
      this.isDataModified = false;
    }
    if (this._value) {
      this.isDataSelected = true;
    }
    this.isMenuOpen = false;
    this._activeIndex = -1;

    if (setValueInput && !leavesPartialPath) {
      this.setValueInput();
    }

    if (this.isDataModified) {
      this.dispatchValueChangedEvent();
      this.isDataModified = false;
    }
  }

  connectedCallback() {
    document.addEventListener("click", this.handleWindowClick);
  }

  renderedCallback() {
    if (this._scrollActivePending) {
      this._scrollActivePending = false;
      this.template
        .querySelector(`[role="option"][data-index="${this._activeIndex}"]`)
        ?.scrollIntoView({ block: "nearest" });
    }
    if (this._focusTriggerPending) {
      this._focusTriggerPending = false;
      this.template.querySelector('[role="combobox"]').focus();
    }
  }

  disconnectedCallback() {
    document.removeEventListener("click", this.handleWindowClick);
  }

  // Lightning's secure event wrapper can throw "Illegal invocation" from
  // composedPath() on document-level events (Flow Builder surfaces that as a
  // "Something went wrong" dialog on every click). Then rely on the
  // target-based check; clicks inside the component are already tracked by
  // `selfEvent`.
  getClickPath(event) {
    try {
      return event.composedPath();
    } catch {
      return [];
    }
  }

  handleWindowClick = (event) => {
    const path = this.getClickPath(event);
    const target = event.target;
    const clickedInside = path.length
      ? path.includes(this.template.host)
      : target === this.template.host || this.template.host.contains?.(target);

    if (!clickedInside && !this.selfEvent) {
      this.closeOptionDialog(true);
    }

    this.selfEvent = false;
  };

  processOptions(searchString) {
    this._activeIndex = -1;
    let searchLC = "";

    if (searchString) {
      const searchParts = searchString.split(".");
      searchLC = searchParts[searchParts.length - 1].toLowerCase();
    }

    const cacheKey = searchLC
      ? ""
      : `${this.builderContextFilterType || ""}|${String(
          this.builderContextFilterCollectionBoolean
        )}`;
    const cachedOptions =
      cacheKey && this.allOptions
        ? PROCESSED_OPTIONS_CACHE.get(this.allOptions)?.get(cacheKey)
        : null;
    if (cachedOptions) {
      this._options = cachedOptions;
      return;
    }

    const filterColDefined =
      typeof this.builderContextFilterCollectionBoolean !== "undefined";
    const filterColBool = this.builderContextFilterCollectionBoolean === true;

    const options = [];
    (this.allOptions || []).forEach((curOption) => {
      let localOptions = curOption.options;

      if (this.builderContextFilterType) {
        const filterType = this.builderContextFilterType.toLowerCase();
        localOptions = localOptions.filter((opToFilter) =>
          this.matchesBuilderContextFilter(
            opToFilter,
            filterType,
            filterColDefined
          )
        );
      }

      if (filterColDefined) {
        localOptions = localOptions.filter((opToFilter) => {
          return opToFilter.isCollection === filterColBool;
        });
      }

      if (searchLC) {
        localOptions = localOptions.filter(
          (opToFilter) =>
            opToFilter.label.toLowerCase().includes(searchLC) ||
            opToFilter.value.toLowerCase().includes(searchLC.replace(/\W/g, ""))
        );
      }

      if (localOptions.length) {
        options.push({ ...curOption, options: localOptions });
      }
    });
    this._options = options;

    if (cacheKey && this.allOptions) {
      let cacheForOptions = PROCESSED_OPTIONS_CACHE.get(this.allOptions);
      if (!cacheForOptions) {
        cacheForOptions = new Map();
        PROCESSED_OPTIONS_CACHE.set(this.allOptions, cacheForOptions);
      }
      cacheForOptions.set(cacheKey, options);
    }
  }

  handleOpenOptions() {
    this.selfEvent = true;
    if (this.isMenuOpen) {
      this.isDataSelected = false;
      this._value = formattedValue(this._value, this._dataType);
    } else {
      this.openOptionDialog();
    }
  }

  // Pressing on the menu must not blur the text box: the blur would commit
  // the typed filter and re-render the options before the click lands.
  handleMenuMouseDown(event) {
    event.preventDefault();
  }

  handleSearchField(event) {
    // The input event is composed; keep it from leaking out as if this
    // component's value changed (its public event is `valuechanged`).
    event.stopPropagation();
    const currentText = event.target.value;
    if (!currentText || !currentText.includes(".")) {
      this.resetTypeOptions();
    }
    this._dataType = getDataType(currentText);
    // The box shows `_value`, so it follows the typing.
    this._value = currentText;
    this.isDataModified = true;
    this.isDataSelected = false;

    this.processOptions(currentText);
    if (this.allOptions.length) {
      this.openOptionDialog();
    }
  }

  toggleMenu() {
    if (this.isMenuOpen) {
      this.closeOptionDialog(true);
    } else {
      this.openOptionDialog();
    }
  }

  setActive(index) {
    this._activeIndex = index;
    this._scrollActivePending = true;
  }

  moveActive(step) {
    this.openOptionDialog();
    const count = this.visibleRows.length;
    if (!count) return;
    const from =
      this._activeIndex < 0 ? (step > 0 ? -1 : count) : this._activeIndex;
    this.setActive((from + step + count) % count);
  }

  // The editable-combobox keyboard model: arrows move through the options,
  // Enter picks the active one, Right Arrow opens it, Left Arrow goes back.
  handleKeyDown(event) {
    const row = this.activeRow;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        this.moveActive(event.key === "ArrowDown" ? 1 : -1);
        break;
      case "Home":
      case "End":
        if (row) {
          event.preventDefault();
          this.setActive(
            event.key === "Home" ? 0 : this.visibleRows.length - 1
          );
        }
        break;
      case "ArrowRight":
        if (row && isDrillable(row)) {
          event.preventDefault();
          this.drillInto(row);
        }
        break;
      case "ArrowLeft":
        if (this.isMenuOpen && this.isDrilledIn && (row || this.hasNoOptions)) {
          event.preventDefault();
          this.goBack();
        }
        break;
      case "Enter":
        event.preventDefault();
        if (row) {
          this._focusTriggerPending = true;
          this.chooseRow(row);
        } else {
          this.toggleMenu();
        }
        break;
      case "Escape":
        if (this.isMenuOpen) {
          this.closeOptionDialog(true);
          event.stopPropagation();
        }
        break;
      case "Tab":
        if (this.isMenuOpen) {
          this.closeOptionDialog(true);
        }
        break;
      default:
    }
  }

  // Typed text is committed when focus leaves the field. With the menu open,
  // closing it commits instead (an option click, Tab, Escape, or Enter).
  // Only uncommitted typing is committed here: picking an option already
  // committed (and the box may still hold the filter text typed before it).
  handleInputBlur() {
    if (this.isMenuOpen || !this.isDataModified) return;
    this.setValueInput();
    if (this._value) {
      this.isDataSelected = true;
    }
    this.dispatchValueChangedEvent();
    this.isDataModified = false;
  }

  setValueInput() {
    const valueInput = this.template.querySelector(".value-input");
    if (valueInput) {
      this.hasError = false;
      const isRef = isReference(valueInput.value);
      this._value = removeFormatting(valueInput.value);
      if (isRef) {
        const typeOption = this.getTypeOption(this._value);
        if (!typeOption && !this._allowHardCodeReference) {
          this.hasError = true;
        }
        this._dataType = flowComboboxDefaults.referenceDataType;
      } else {
        this._dataType = flowComboboxDefaults.stringDataType;
      }
    }
  }

  getFullPath(path, val) {
    return (path ? path + "." : "") + val;
  }

  get inputStyle() {
    if (this.maxWidth) {
      return "max-width: " + this.maxWidth + "px;";
    }
    return "";
  }

  get formElementClass() {
    return this.errorText
      ? "slds-form-element slds-has-error"
      : "slds-form-element";
  }

  get labelClass() {
    return this.variant === "label-hidden"
      ? "slds-assistive-text"
      : "slds-form-element__label slds-size_full";
  }

  get labelClassForPill() {
    return this.variant === "label-hidden"
      ? "slds-assistive-text"
      : "slds-form-element__label slds-no-flex slds-size_full";
  }
}
