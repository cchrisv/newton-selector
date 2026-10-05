import { LightningElement, api, track } from "lwc";
import getObjectFields from "@salesforce/apex/NewtonSelectorFlowCpeController.getObjectFields";
import {
  loadErrorMessage,
  fieldsToOptions,
  filterFieldOptions
} from "c/newtonSelectorFlowCpeUtilityHelpers";

/**
 * Newton Selector Flow CPE | Field Selector.
 *
 * A searchable list of an SObject's fields with type icons. Field metadata
 * comes from the cacheable `getObjectFields` Apex method.
 *
 * @fires fieldchange — `{ detail: { fieldApiName } }`.
 */
export default class NewtonSelectorFlowCpeFieldSelector extends LightningElement {
  @track _allOptions = [];
  _loadedObject = "";
  _connected = false;
  loadError = "";

  /** @type {string} */ @api label = "";
  /** @type {boolean} */ @api required = false;
  /** Comma-separated Schema.DisplayType names to include (e.g. 'PICKLIST,MULTIPICKLIST'). Empty string = all types. */
  @api fieldTypeFilter = "";
  /** Only offer fields that can be used in ORDER BY. */
  @api sortableOnly = false;
  /** @type {string} */ @api value = "";

  _objectApiName = "";

  @api
  get objectApiName() {
    return this._objectApiName;
  }
  set objectApiName(v) {
    const next = v == null ? "" : String(v).trim();
    if (next === this._objectApiName) return;
    this.loadError = "";
    this._objectApiName = next;
    this._allOptions = [];
    this._loadedObject = "";
    if (this._connected && next) this._loadFields();
  }

  get selection() {
    if (!this.value) return null;
    const found = this._allOptions.find((o) => o.id === this.value);
    return (
      found || {
        id: this.value,
        title: this.value,
        subtitle: "",
        icon: "type"
      }
    );
  }

  connectedCallback() {
    this._connected = true;
    if (this._objectApiName && !this._loadedObject) this._loadFields();
  }

  disconnectedCallback() {
    this._connected = false;
  }

  _loadFields() {
    const obj = this._objectApiName;
    this.loadError = "";
    getObjectFields({ objectName: obj })
      .then((fields) => {
        if (!this._connected || this._objectApiName !== obj) return;
        const usable = this.sortableOnly
          ? fields.filter((field) => field.sortable)
          : fields;
        this._allOptions = this._applyTypeFilter(fieldsToOptions(usable));
        this._loadedObject = obj;
      })
      .catch((error) => {
        if (this._objectApiName === obj) {
          this.loadError = loadErrorMessage("fields", error);
        }
      });
  }

  _applyTypeFilter(opts) {
    if (!this.fieldTypeFilter) return opts;
    const allowed = new Set(
      this.fieldTypeFilter
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean)
    );
    return opts.filter((o) => allowed.has((o.type || "").toUpperCase()));
  }

  handleSearch(event) {
    const lu = event.currentTarget;
    if (!this._objectApiName) {
      lu.setSearchResults([]);
      return;
    }
    const term = event.detail.rawSearchTerm || "";
    lu.setSearchResults(filterFieldOptions(this._allOptions, term));
  }

  handleSelectionChange(event) {
    const row = event.currentTarget.getSelection()[0];
    this.dispatchEvent(
      new CustomEvent("fieldchange", {
        detail: { fieldApiName: row?.id ? String(row.id) : "" }
      })
    );
  }
}
