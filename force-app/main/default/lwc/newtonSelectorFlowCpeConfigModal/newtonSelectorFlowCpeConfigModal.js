import { api, track } from "lwc";
import LightningModal from "lightning/modal";
import { mergeSelectorConfig } from "c/newtonSelectorUtilityConfigDefaults";
import { setConfigPath } from "c/newtonSelectorFlowCpeUtilityConfigState";
import {
  activeSectionIssueList,
  sectionIssues as buildSectionIssues,
  sectionStatus as buildSectionStatus,
  totalIssueCount
} from "c/newtonSelectorFlowCpeUtilityConfigValidation";
import { SECTIONS } from "c/newtonSelectorFlowCpeUtilityConfigOptions";

function toPlainConfig(config) {
  return config === undefined ? config : JSON.parse(JSON.stringify(config));
}

export default class NewtonSelectorFlowCpeConfigModal extends LightningModal {
  @api initialConfig;
  @api initialSourceRecordsRef;
  @api initialValueRef;
  @api initialValuesRef;
  @api builderContext;
  @api automaticOutputVariables;

  @track _config;
  @track _sourceRecordsRef = "";
  _valueRef = "";
  _valuesRef = "";
  _whereIncomplete = false;
  @track _activeSection = "data";
  @track _forcedPreviewState = "";
  @track _leftWidth = 50;
  _confirmingDiscard = false;
  _focusAfterRender = "";
  _baseline = "";

  connectedCallback() {
    this._config = mergeSelectorConfig(this.initialConfig);
    this._sourceRecordsRef = this.initialSourceRecordsRef || "";
    this._valueRef = this.initialValueRef || "";
    this._valuesRef = this.initialValuesRef || "";
    this._baseline = this.snapshot();
    document.addEventListener("keydown", this.handleKeydown);
  }

  disconnectedCallback() {
    document.removeEventListener("keydown", this.handleKeydown);
  }

  renderedCallback() {
    if (this._focusAfterRender) {
      const selector = this._focusAfterRender;
      this._focusAfterRender = "";
      this.template.querySelector(selector)?.focus();
    }
  }

  // --- Unsaved-changes guard -------------------------------------------
  // While there are unsaved changes, LightningModal's own close paths (Esc,
  // the header close button) are disabled and Cancel/Esc ask first instead.

  snapshot() {
    return JSON.stringify({
      config: this._config,
      ...this.savedRefs
    });
  }

  // The Flow resource bindings the editor saves next to the config.
  get savedRefs() {
    return {
      sourceRecordsRef: this._sourceRecordsRef,
      valueRef: this._valueRef,
      valuesRef: this._valuesRef
    };
  }

  get isDirty() {
    return this.snapshot() !== this._baseline;
  }

  get confirmingDiscard() {
    return this._confirmingDiscard;
  }

  syncCloseGuard() {
    this.disableClose = this.isDirty;
  }

  askToDiscard() {
    this._confirmingDiscard = true;
    this._focusAfterRender = ".newton-discard__keep";
  }

  keepEditing() {
    this._confirmingDiscard = false;
    this._focusAfterRender = ".newton-modal__cancel";
  }

  // Esc: ask when there are unsaved changes; Esc again keeps editing. An Esc
  // a control already handled (e.g. closing a dropdown) is left alone.
  // Listened for on document because focus is not always inside this
  // component (it sits on the dialog frame after a click on plain text),
  // and Lightning stops Esc before it reaches window.
  handleKeydown = (event) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    if (this._confirmingDiscard) {
      event.preventDefault();
      event.stopPropagation();
      this.keepEditing();
      return;
    }
    if (this.isDirty) {
      event.preventDefault();
      event.stopPropagation();
      this.askToDiscard();
    }
  };

  handleKeepEditing() {
    this.keepEditing();
  }

  handleDiscard() {
    this._confirmingDiscard = false;
    this.disableClose = false;
    this.close({ action: "cancel" });
  }

  // Chapters patch by spreading the config they were handed, so the nested
  // values in a patch are still Lightning's read-only proxies. Storing them
  // as-is re-wrapped them in another proxy layer on every change, and since
  // each layer's traps call the one beneath, every edit made the next one
  // about twice as slow (seconds after a dozen edits). The config is plain
  // JSON (it is serialized to Flow on save), so store a plain copy instead.
  handleConfigPatch(event) {
    const path = event.detail?.path;
    const value = event.detail?.value;
    const next =
      Array.isArray(path) && path.length === 0
        ? value
        : setConfigPath(this._config, path, value);
    this._config = toPlainConfig(next);
    this.syncCloseGuard();
  }

  handleRefChange(event) {
    const { name, value } = event.detail;
    if (name === "sourceRecordsRef") this._sourceRecordsRef = value;
    else if (name === "valueRef") this._valueRef = value;
    else if (name === "valuesRef") this._valuesRef = value;
    this.syncCloseGuard();
  }

  handleFilterValidityChange(event) {
    this._whereIncomplete = event.detail.incomplete;
  }

  get sectionRefs() {
    return {
      sourceRecordsRef: this._sourceRecordsRef,
      whereIncomplete: this._whereIncomplete
    };
  }

  get sections() {
    return SECTIONS.map((section) => {
      const status = this.sectionStatus(section.key);
      const active = section.key === this._activeSection;
      const showStatus = status === "warn" || status === "error";
      return {
        ...section,
        active,
        showStatus,
        status,
        statusClass: `newton-studio__nav-status newton-studio__nav-status_${status}`,
        ariaCurrent: active ? "page" : null
      };
    });
  }

  sectionStatus(key) {
    return buildSectionStatus(key, this._config, this.sectionRefs);
  }

  sectionIssues(key) {
    return buildSectionIssues(key, this._config, this.sectionRefs);
  }

  get totalErrorCount() {
    return totalIssueCount(this._config, this.sectionRefs, "errors");
  }

  get hasBlockingErrors() {
    return this.totalErrorCount > 0;
  }

  get saveDisabled() {
    return this.hasBlockingErrors;
  }

  // Why Save is disabled, beside the button: the count and the first error
  // with its chapter, e.g. "1 error to fix · Data: Add at least one option."
  get saveStatus() {
    const count = this.totalErrorCount;
    if (!count) return "";
    const first = SECTIONS.map((section) => ({
      chapter: section.label,
      message: this.sectionIssues(section.key).errors[0]
    })).find((entry) => entry.message);
    return `${count} ${count === 1 ? "error" : "errors"} to fix · ${first.chapter}: ${first.message}`;
  }

  get activeSectionIssues() {
    return activeSectionIssueList(
      this._activeSection,
      this._config,
      this.sectionRefs
    );
  }

  get hasActiveSectionIssues() {
    return this.activeSectionIssues.length > 0;
  }

  handleSectionClick(event) {
    this._activeSection = event.detail;
  }

  handleActiveChapterChange(event) {
    this._activeSection = event.detail;
  }

  handleLeftWidthChange(event) {
    this._leftWidth = event.detail;
  }

  handlePreviewStateChange(event) {
    const next = event.detail;
    this._forcedPreviewState = this._forcedPreviewState === next ? "" : next;
  }

  get previewForcedState() {
    return this._forcedPreviewState;
  }

  handleSave() {
    if (this.hasBlockingErrors) return;
    this.disableClose = false;
    this.close({
      action: "save",
      config: this._config,
      ...this.savedRefs
    });
  }

  handleCancel() {
    if (this.isDirty) {
      this.askToDiscard();
      return;
    }
    this.close({ action: "cancel" });
  }
}
