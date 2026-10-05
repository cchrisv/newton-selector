import { api, LightningElement, track } from "lwc";

const MIN_LEFT_PERCENT = 0;
const MAX_LEFT_PERCENT = 100;
const DEFAULT_LEFT_PERCENT = 50;
// The scroll area's top padding (--slds-g-spacing-3, 0.75rem = 12px), kept
// above a jumped-to chapter so it sits where it would at the top of the list.
const SCROLL_PADDING_TOP_PX = 12;

export default class NewtonSelectorFlowCpeStudio extends LightningElement {
  @api sections = [];
  @track _leftWidth = DEFAULT_LEFT_PERCENT;
  _dragState = null;
  _chapterObserver;

  @api
  get leftWidth() {
    return this._leftWidth;
  }
  set leftWidth(value) {
    const next = Number(value);
    if (Number.isFinite(next)) this._leftWidth = this._clampLeft(next);
  }

  get gridStyle() {
    return [
      `--newton-studio-left-fr: ${this._leftWidth}fr`,
      `--newton-studio-right-fr: ${MAX_LEFT_PERCENT - this._leftWidth}fr`
    ].join("; ");
  }

  get leftAriaValueNow() {
    return this._leftWidth;
  }

  get leftAriaValueMin() {
    return MIN_LEFT_PERCENT;
  }

  get leftAriaValueMax() {
    return MAX_LEFT_PERCENT;
  }

  get tabs() {
    return (this.sections || []).map((section) => ({
      key: section.key,
      label: section.label,
      icon: section.icon,
      ariaCurrent: section.ariaCurrent,
      showStatus: section.showStatus,
      statusClass: section.statusClass,
      statusLabel:
        section.status === "error"
          ? `${section.label} has errors`
          : `${section.label} needs attention`,
      tabClass: section.active
        ? "newton-studio__tab newton-studio__tab_active"
        : "newton-studio__tab"
    }));
  }

  get hasTabs() {
    return this.tabs.length > 0;
  }

  handleTabClick(event) {
    const key = event.currentTarget.dataset.key;
    if (!key) return;
    this.dispatchEvent(new CustomEvent("sectionclick", { detail: key }));
    this._scrollToChapter(key);
  }

  handleControlsSlotChange() {
    this._setupChapterObserver();
  }

  // Assigns scrollTop rather than calling scrollTo(): Lightning's secure
  // element wrapper ignores scrollTo from component code. Smoothness (and its
  // reduced-motion opt-out) lives in CSS on .newton-studio__scroll.
  _scrollToChapter(key) {
    const scroller = this.template.querySelector(".newton-studio__scroll");
    const chapter = this._allChapters().find(
      (element) => element.getAttribute("data-chapter") === key
    );
    if (!scroller || !chapter) return;
    const offset =
      chapter.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop;
    scroller.scrollTop = Math.max(0, offset - SCROLL_PADDING_TOP_PX);
  }

  renderedCallback() {
    this._setupChapterObserver();
  }

  disconnectedCallback() {
    this._chapterObserver?.disconnect();
    this._chapterObserver = null;
  }

  handleSplitterPointerDown(event) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    this._dragState = {
      startX: event.clientX,
      startLeft: this._leftWidth,
      pointerId: event.pointerId,
      bodyWidth: this._bodyWidth()
    };
    event.preventDefault();
  }

  handleSplitterPointerMove(event) {
    const state = this._dragState;
    if (!state) return;
    if (!state.bodyWidth) return;
    const deltaPercent =
      ((event.clientX - state.startX) / state.bodyWidth) * 100;
    this._setLeftWidth(state.startLeft + deltaPercent);
  }

  handleSplitterPointerUp(event) {
    if (!this._dragState) return;
    event.currentTarget.releasePointerCapture?.(this._dragState.pointerId);
    this._dragState = null;
  }

  handleSplitterKeyDown(event) {
    const step = event.shiftKey ? 10 : 5;
    let next;
    if (event.key === "ArrowLeft") next = this._leftWidth - step;
    else if (event.key === "ArrowRight") next = this._leftWidth + step;
    else if (event.key === "Home") next = MIN_LEFT_PERCENT;
    else if (event.key === "End") next = MAX_LEFT_PERCENT;
    else return;
    this._setLeftWidth(next);
    event.preventDefault();
  }

  _setLeftWidth(value) {
    const next = this._clampLeft(value);
    if (next === this._leftWidth) return;
    this._leftWidth = next;
    this.dispatchEvent(new CustomEvent("leftwidthchange", { detail: next }));
  }

  _clampLeft(value) {
    return Math.max(
      MIN_LEFT_PERCENT,
      Math.min(MAX_LEFT_PERCENT, Math.round(value))
    );
  }

  _bodyWidth() {
    return (
      this.template.querySelector(".newton-studio__body")?.clientWidth || 0
    );
  }

  _setupChapterObserver() {
    if (this._chapterObserver) return;
    const controls = this.template.querySelector(".newton-studio__scroll");
    const chapters = this._allChapters();
    if (
      !controls ||
      chapters.length === 0 ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    this._chapterObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const key = visible[0]?.target?.getAttribute("data-chapter");
        if (key) {
          this.dispatchEvent(
            new CustomEvent("activechapterchange", { detail: key })
          );
        }
      },
      { root: controls, rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );
    chapters.forEach((chapter) => this._chapterObserver.observe(chapter));
  }

  _allChapters() {
    const slot = this.template.querySelector('slot[name="controls"]');
    return (
      slot?.assignedElements({ flatten: true }).flatMap((element) => {
        const matches = element.matches?.("[data-chapter]") ? [element] : [];
        return [
          ...matches,
          ...Array.from(element.querySelectorAll?.("[data-chapter]") || [])
        ];
      }) || []
    );
  }
}
