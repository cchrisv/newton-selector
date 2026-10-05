import { LightningElement, api } from "lwc";
import { resolveIconContent } from "./lucideIconPaths";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const ICON_TAG_PATTERN = /<([a-z]+)((?:\s+[a-zA-Z0-9:-]+="[^"]*")*)\s*\/?>/g;
const ATTR_PATTERN = /([a-zA-Z0-9:-]+)="([^"]*)"/g;

export default class NewtonSelectorIcon extends LightningElement {
  @api name = "";
  /** @type {'xx-small'|'x-small'|'small'|'medium'|'large'} */
  @api size = "small";
  @api alternativeText = "";
  /** @type {'input'|'button'|'option'|'tile'|''} */
  @api box = "";
  /** @type {'error'|'inverse'|undefined} */
  @api variant;

  _renderedIconContent;

  renderedCallback() {
    const svg = this.template.querySelector(".newton-selector-icon__svg");
    const iconContent = this.iconContent;
    if (svg && this._renderedIconContent !== iconContent) {
      this.replaceIconNodes(svg, iconContent);
      this._renderedIconContent = iconContent;
    }
  }

  // Locker rejects DOMParser nodes in importNode and its secure SVG wrapper
  // lacks replaceChildren, so the flat Lucide markup is rebuilt with
  // createElementNS and swapped in with removeChild/appendChild.
  replaceIconNodes(svg, iconContent) {
    const nodes = [];
    for (const [, tag, attrs] of iconContent.matchAll(ICON_TAG_PATTERN)) {
      const node = document.createElementNS(SVG_NAMESPACE, tag);
      for (const [, attrName, attrValue] of attrs.matchAll(ATTR_PATTERN)) {
        node.setAttribute(attrName, attrValue);
      }
      nodes.push(node);
    }

    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }
    nodes.forEach((node) => svg.appendChild(node));
  }

  get iconContent() {
    return resolveIconContent(this.name);
  }

  get wrapperClass() {
    const cls = [
      "newton-selector-icon",
      `newton-selector-icon_size-${this.size}`
    ];
    if (this.box) {
      cls.push(`newton-selector-icon_box-${this.box}`);
    }
    if (this.variant) {
      cls.push(`newton-selector-icon_variant-${this.variant}`);
    }
    return cls.join(" ");
  }

  get role() {
    return this.alternativeText ? "img" : null;
  }

  get ariaHidden() {
    return this.alternativeText ? null : "true";
  }
}
