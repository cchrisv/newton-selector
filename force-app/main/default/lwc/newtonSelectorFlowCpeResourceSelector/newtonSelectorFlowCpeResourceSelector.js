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
  fetchFields,
  loadErrorMessage,
  formattedValue,
  isReference,
  getDataType,
  removeFormatting,
  flowComboboxDefaults
} from "c/newtonSelectorFlowCpeUtilityHelpers";

/** Shown when allowHardCodeReference is true (CPE / manual merge fields). */
const MANUAL_REFERENCE_PLACEHOLDER = "Pick a resource or type a value";
const MERGE_FIELD_CACHE = new WeakMap();
const PROCESSED_OPTIONS_CACHE = new WeakMap();

const OUTPUTS_FROM_LABEL = "Outputs from ";

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

function coerceFlowBoolean(value) {
  if (value === true || value === "true" || value === "TRUE") {
    return true;
  }
  if (
    value === false ||
    value === "false" ||
    value === "FALSE" ||
    value === "0"
  ) {
    return false;
  }
  return Boolean(value);
}

function getIconNameByType(variableType) {
  return TYPE_ICON_MAP[String(variableType || "").toUpperCase()];
}

export default class NewtonSelectorFlowCpeResourceSelector extends LightningElement {
  @api name;
  @api label;
  @api required = false;
  @api builderContextFilterType;
  @api builderContextFilterCollectionBoolean;
  @api maxWidth;
  /** 'standard' (default) | 'label-hidden' — hides the label visually but keeps it for screen readers. */
  @api variant = "standard";

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
  allOptions;
  _options = [];
  _mergeFields = [];
  isDataSelected = false;
  _selectedObjectType;
  _selectedFieldPath;
  _RecordObject; // Used when a start element is in the flow
  hasError = false;
  loadError = "";
  isMenuOpen = false;
  isDataModified = false;
  selfEvent = false;
  key = 0;
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
      "This flow has no resource with that name. To enter plain text, leave out the {! }."
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
    {
      apiName: flowComboboxDefaults.recordCreatesType,
      label: "Variables",
      dataType: "SObject",
      objectTypeField: "object",
      isCollectionField: "getFirstRecordOnly"
    },
    {
      apiName: flowComboboxDefaults.recordUpdatesType,
      label: "Variables",
      dataType: "SObject",
      objectTypeField: "object",
      isCollectionField: "getFirstRecordOnly"
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
      apiName: "globalVariables",
      label: "Global Variables",
      dataType: flowComboboxDefaults.stringDataType
    }, // Not within Flow Metadata API but compiled to allow Global Variables to be used
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
  }

  get committedValue() {
    return this._value ? formattedValue(this._value, this._dataType) : "";
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
    this._RecordObject = builderContext?.start?.object;
    if (!builderContext || typeof builderContext !== "object") {
      return this.adjustOptions(
        this.generateMergeFieldsFromBuilderContext(builderContext)
      );
    }
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
    const selectedOption = this.selectedOption;
    return (
      this._selectedOptionLabel ||
      selectedOption?.label ||
      this.formatSelectedDisplayValue(this._value)
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
    const value = this.formatSelectedDisplayValue(this._value);
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

  get emptyMessage() {
    return this.loadError || this.labels.noDataAvailable;
  }

  formatSelectedDisplayValue(value) {
    const cleanValue = removeFormatting(value || "");
    const parts = cleanValue.split(".").filter(Boolean);
    if (parts.length === 2 && parts[0] === parts[1]) {
      return parts[0];
    }
    return cleanValue;
  }

  get dropdownExpanded() {
    return this.isMenuOpen ? "true" : "false";
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
        tempOptions.push(
          this.generateOptionLine(
            curDataType,
            curFieldData.label,
            curFieldData.apiName,
            false,
            curObjectType,
            getIconNameByType(curDataType),
            curDataType === "SObject",
            curDataType === "SObject" ? curObjectType : curDataType,
            flowComboboxDefaults.defaultKeyPrefix + this.key++
          )
        );
      });
      this.setOptions([{ type: data.label + " Fields", options: tempOptions }]);
    }
  }

  getTypes() {
    return this.typeDescriptors.map(
      (curTypeDescriptor) => curTypeDescriptor.apiName
    );
  }

  getTypeDescriptor(typeApiName) {
    return this.typeDescriptors.find(
      (curTypeDescriptor) => curTypeDescriptor.apiName === typeApiName
    );
  }

  determineSelectedType() {
    if (this._value && this.allOptions) {
      const valParts = this._value.replace(/[^a-zA-Z0-9._-]/g, "").split(".");
      if (valParts.length > 1) {
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

    this.getTypes().forEach((curType) => {
      const typeParts = curType.split("."); // e.g. 'screen.fields'
      let typeOptions = [];

      // A record-triggered flow's "start" names the $Record object.
      if (builderContext?.start) {
        this._RecordObject = builderContext.start.object;
      }

      if (typeParts.length && builderContext[typeParts[0]]) {
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
        const localType = this.getTypeDescriptor(curType);

        const curTypeOptions = this.getOptionLines(
          objectToExamine,
          "varLabel",
          "varApiName",
          "dataType",
          localType.isCollectionField
            ? localType.isCollectionField
            : flowComboboxDefaults.isCollectionField,
          localType.objectTypeField ? localType.objectTypeField : "objectType",
          localType
        );
        if (curTypeOptions.length) {
          typeOptions = [...typeOptions, ...curTypeOptions];
        }
        if (typeOptions.length) {
          if (optionsByType[localType.label]) {
            optionsByType[localType.label] = [
              ...optionsByType[localType.label],
              ...typeOptions
            ];
          } else {
            optionsByType[localType.label] = typeOptions;
          }
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

    const globalVariablesType = this.getTypeDescriptor("globalVariables").label;
    optionsByType[globalVariablesType] = [
      ...(optionsByType[globalVariablesType] || []),
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
      objectType: "objectType",
      optionIcon: icon,
      isObject: false,
      globalVariable: false,
      displayType,
      key: flowComboboxDefaults.defaultGlobalVariableKeyPrefix + this.key++,
      flowType: "reference",
      storeOutputAutomatically: false
    };
  }

  getOptionLines(
    objectArray,
    labelField,
    valueField,
    typeField,
    isCollectionField,
    objectTypeField,
    typeDescriptor
  ) {
    const typeOptions = [];
    objectArray.forEach((curObject) => {
      const isActionCall =
        typeDescriptor.apiName === flowComboboxDefaults.actionType;
      const isScreenAction =
        typeDescriptor.dataType === flowComboboxDefaults.screenActionType;
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
            : this.getTypeByDescriptor(curObject[typeField], typeDescriptor);
      const label =
        isActionCall || isScreenAction
          ? OUTPUTS_FROM_LABEL + curObject.name
          : curObject[labelField]
            ? curObject[labelField]
            : curObject[valueField];
      const curIsCollection = this.isCollection(curObject, isCollectionField);
      const storeOutputAutomatically =
        (curObject.storeOutputAutomatically &&
          typeDescriptor.dataType !== "SObject") ||
        typeDescriptor.dataType === flowComboboxDefaults.screenActionType;
      if (
        !isSection &&
        (!isScreenAction || this.automaticOutputVariables[curObject.name])
      ) {
        typeOptions.push(
          this.generateOptionLine(
            curDataType,
            label,
            // A screen component's "Screen.Component" name is offered as "Component".
            typeDescriptor.dataType === flowComboboxDefaults.screenComponentType
              ? curObject[valueField].split(".")[1]
              : curObject[valueField],
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
            null,
            storeOutputAutomatically
          )
        );
      }
    });
    return typeOptions;
  }

  isCollection(curObject, isCollectionField) {
    if (Object.prototype.hasOwnProperty.call(curObject, isCollectionField)) {
      return coerceFlowBoolean(curObject[isCollectionField]);
    }
    return coerceFlowBoolean(curObject[flowComboboxDefaults.isCollectionField]);
  }

  matchesBuilderContextFilter(option, filterType, hasCollectionFilter) {
    if (!filterType) {
      return true;
    }

    const optionType = String(option.type || "").toLowerCase();
    const optionDisplayType = String(option.displayType || "").toLowerCase();

    if (filterType === "sobject") {
      return optionType === "sobject" || option.isObject === true;
    }

    return (
      optionDisplayType === filterType ||
      optionType === filterType ||
      (option.storeOutputAutomatically === true && !hasCollectionFilter)
    );
  }

  getTypeByDescriptor(curObjectFieldType, typeDescriptor) {
    if (!typeDescriptor) {
      return flowComboboxDefaults.stringDataType;
    } else if (
      typeDescriptor.apiName === flowComboboxDefaults.recordLookupsType
    ) {
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
    flowType,
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
      key: key,
      flowType: flowType ? flowType : flowComboboxDefaults.referenceDataType,
      storeOutputAutomatically: storeOutputAutomatically
    };
  }

  handleOpenObject(event) {
    this.doOpenObject(
      event,
      event.currentTarget.dataset.optionValue,
      event.currentTarget.dataset.objectType
    );
  }

  handleOpenScreenComponent(event) {
    const screenComponentName =
      event.currentTarget.dataset.optionValue.split(".");
    this.doOpenAction(
      event,
      screenComponentName.length > 1
        ? screenComponentName[1]
        : event.currentTarget.dataset.optionValue
    );
  }

  handleSetSelectedRecord(event) {
    event.stopPropagation(); // stops the window generic click handlers from firing 2x more times
    const dataset = event.currentTarget.dataset;
    if (
      this._value &&
      this._value.endsWith(dataset.value) &&
      dataset.objectType
    ) {
      this.doOpenObject(event, dataset.value, dataset.objectType);
      return;
    }
    this._dataType = dataset.flowType;
    this._selectedOptionObjectType = dataset.objectType || "";
    this._selectedOptionIsCollection = dataset.isCollection === "true";
    this._selectedOptionLabel = dataset.label || "";
    this._selectedOptionIcon = dataset.icon || "";
    this.applyInternalValue(
      this.getFullPath(this._selectedFieldPath, dataset.value)
    );
    this.isDataModified = true;
    this.hasError = false;
    this.closeOptionDialog();
  }

  handleOpenGlobalVariable(event) {
    event.stopPropagation();
    const value = event.currentTarget.dataset.optionValue;
    this._selectedFieldPath =
      (this._selectedFieldPath ? this._selectedFieldPath + "." : "") + value;
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

    fetchFields(GLOBAL_VARIABLE_OBJECTS[value] || this._RecordObject)
      .then((fields) => {
        this.setOptions([
          {
            type: group,
            options: fields.map((field) =>
              this.globalVariableOption(
                field.label,
                field.type,
                field.name,
                getIconNameByType(field.type),
                "String"
              )
            )
          }
        ]);
      })
      .catch((error) => {
        this.setOptions([]);
        this.loadError = loadErrorMessage("fields", error);
      });
  }

  doOpenObject(event, value, objectType) {
    event.stopPropagation();
    this._selectedFieldPath =
      (this._selectedFieldPath ? this._selectedFieldPath + "." : "") + value;
    this.applyInternalValue(this._selectedFieldPath + ".");
    this._selectedObjectType = objectType;
  }

  doOpenAction(event, value) {
    event.stopPropagation();
    this._selectedFieldPath =
      (this._selectedFieldPath ? this._selectedFieldPath + "." : "") + value;
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
          undefined,
          !!this.automaticOutputVariables[path + "." + output.apiName]
        )
      );
    });
    this.setOptions([{ type: path + " Outputs", options: tempOptions }]);
  }

  dispatchValueChangedEvent() {
    this.dispatchEvent(
      new CustomEvent("valuechanged", {
        detail: {
          id: this.name,
          newValue: this.committedValue,
          objectType: this._selectedOptionObjectType || ""
        }
      })
    );
  }

  resetData() {
    this.applyInternalValue("");
    this.resetTypeOptions();
    this.closeOptionDialog();
  }

  resetTypeOptions() {
    this.isDataModified = true;
    this._selectedFieldPath = "";
    this._selectedObjectType = null;
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
    if (this._value) {
      this.isDataSelected = true;
    }
    this.isMenuOpen = false;

    if (setValueInput) {
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

    // Coerce the collection filter to a real boolean. Bare HTML attributes
    // (e.g. `<c-newton-selector-flow-cpe-resource-selector builder-context-filter-collection-boolean>`) arrive
    // as empty string `""`, which breaks the strict `isCollection === ...`
    // compare below. Treat `""` and `"true"` as `true`; explicit `{false}`
    // stays false. `undefined` means "no filter" and is preserved.
    const filterColRaw = this.builderContextFilterCollectionBoolean;
    const filterColDefined = typeof filterColRaw !== "undefined";
    const filterColBool =
      filterColRaw === "" || filterColRaw === "true" || filterColRaw === true;

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
    // The inner input's `change` is composed; keep it from leaking out as if
    // this component's value changed (its public event is `valuechanged`).
    event.stopPropagation();
    const currentText = event.target.value;
    if (!currentText || !currentText.includes(".")) {
      this.resetTypeOptions();
    }
    this._dataType = getDataType(currentText);
    this.isDataModified = true;
    this.isDataSelected = false;

    this.processOptions(currentText);
    if (this.allOptions.length) {
      this.openOptionDialog();
    }
  }

  handleSearchKeyUp(event) {
    if (event.key === "Enter" || event.key === "Tab") {
      this.toggleMenu();
    }
  }

  toggleMenu() {
    if (this.isMenuOpen) {
      this.closeOptionDialog(true);
    } else {
      this.openOptionDialog();
    }
  }

  handleKeyDown(event) {
    if (this.isMenuOpen && (event.key === "Tab" || event.key === "Escape")) {
      this.closeOptionDialog(true);
      if (event.key === "Escape") {
        event.stopPropagation();
      }
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

      if (!valueInput.checkValidity()) {
        this.hasError = true;
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
    let resultClass = "slds-form-element";
    if (this.hasError) {
      resultClass += " slds-has-error slds-m-bottom_medium";
    }
    return resultClass;
  }

  get labelClass() {
    return this.variant === "label-hidden"
      ? "slds-assistive-text"
      : "slds-form-element__label custom-width-full";
  }

  get labelClassForPill() {
    return this.variant === "label-hidden"
      ? "slds-assistive-text"
      : "slds-form-element__label slds-no-flex custom-width-full";
  }
}
