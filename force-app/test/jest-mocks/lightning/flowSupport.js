export class FlowAttributeChangeEvent extends CustomEvent {
  constructor(attributeName, attributeValue) {
    super("flowattributechange", {
      bubbles: true,
      composed: true,
      cancelable: false,
      detail: { attributeName, attributeValue }
    });
  }
}

export class FlowNavigationNextEvent extends CustomEvent {
  constructor() {
    super("flownavigationnext", {
      bubbles: true,
      composed: true,
      cancelable: false
    });
  }
}
