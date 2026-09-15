import { ItemView, Notice, setIcon } from "obsidian";
import { ChartManager, chartTokens } from "./charts";
import { calculateHealth, type HealthIssueKey } from "./health";
import { icon, PROJECT_ICON_ID, type IconName } from "./icons";
import { t } from "./i18n/i18n";
import {
  calculateMetrics,
  dateKey,
  getRangeBounds,
  startOfDay,
  type Metrics,
} from "./metrics";
import { createDefaultViewConfig, type Tab, type ViewConfig } from "./settings";
import {
  scanVault,
  type MarkdownRecord,
  type VaultSnapshot,
} from "./scan/vault-scanner";
import { renderContentPane } from "./tabs/content-pane";
import type { ChartRequest, PaneContext } from "./tabs/context";
import { renderHealthPane } from "./tabs/health-pane";
import { renderOverviewPane } from "./tabs/overview-pane";
import { renderRhythmPane } from "./tabs/rhythm-pane";
import { renderYearbookPane } from "./tabs/yearbook-pane";
import { ACCENTS, ISSUE_ROWS, TABS } from "./ui/constants";
import {
  dropdown,
  el,
  fmt,
  fmtW,
  iconButton,
  md,
  panelBox,
  settingItem,
  text,
} from "./ui/dom";
import { availableYears } from "./yearbook";
import dashboardStyles from "../styles.css";

export const VIEW_TYPE_YEARBOOK = "awesome-yearbook";

/* ==========================================================================
   The view
   ========================================================================= */

export class YearbookView extends ItemView {
  private config: ViewConfig | null = null;
  private snapshot: VaultSnapshot | null = null;
  private scanController: AbortController | null = null;
  private scanGeneration = 0;
  private chartManager = new ChartManager();
  private root: HTMLElement | null = null;
  private page: HTMLElement | null = null;
  private pending: ChartRequest[] = [];
  private statusText = "";
  private noticeTimer: number | null = null;
  private removeResize: (() => void) | null = null;

  override getViewType(): string {
    return VIEW_TYPE_YEARBOOK;
  }

  override getDisplayText(): string {
    return t("Awesome Yearbook");
  }

  protected override async onOpen(): Promise<void> {
    this.config = createDefaultViewConfig();
    this.chartManager = new ChartManager();
    this.contentEl.replaceChildren();
    const shadow =
      this.contentEl.shadowRoot ??
      this.contentEl.attachShadow({ mode: "open" });
    this.root = el("div", "awesome-yearbook-view");
    shadow.replaceChildren(el("style", undefined, dashboardStyles), this.root);
    this.buildShell();
    const resize = () => this.chartManager.resize();
    window.addEventListener("resize", resize);
    this.removeResize = () => window.removeEventListener("resize", resize);
    await this.runScan();
  }

  protected override async onClose(): Promise<void> {
    this.scanController?.abort();
    this.scanController = null;
    this.chartManager.destroy();
    this.removeResize?.();
    this.removeResize = null;
    if (this.noticeTimer) window.clearTimeout(this.noticeTimer);
    this.noticeTimer = null;
    this.root?.removeEventListener("click", this.handleClick);
    this.root?.removeEventListener("change", this.handleChange);
    this.contentEl.shadowRoot?.replaceChildren();
    this.root = null;
    this.page = null;
    this.pending = [];
    this.snapshot = null;
    this.config = null;
  }

  /* ---------- shell ---------------------------------------------------- */

  private buildShell(): void {
    if (!this.root) return;
    const scroll = el("div", "yb-scroll");

    const header = el("header", "app-header");
    const inner = el("div", "header-inner");
    const brand = el("div", "brand");
    const mark = el("span", "brand-mark");
    setIcon(mark, PROJECT_ICON_ID);
    const brandText = el("div");
    brandText.append(el("div", "brand-name", t("Awesome Yearbook")));
    brand.append(mark, brandText);

    const actions = el("div", "header-actions");
    const field = el("div", "field");
    field.dataset.settingHost = "range";
    field.append(el("label", undefined, t("Time range")));
    field.append(
      dropdown("range", "ytd", [
        ["last7", t("Last 7 days")],
        ["last30", t("Last 30 days")],
        ["last90", t("Last 90 days")],
        ["last365", t("Last 365 days")],
        ["ytd", t("Year to date")],
        ["lastyear", t("Last year")],
        ["all", t("All time")],
        ["custom", t("Custom")],
      ]),
    );
    const custom = el("span", "range-custom");
    custom.hidden = true;
    const from = el("input");
    from.type = "date";
    from.dataset.setting = "customStart";
    from.setAttribute("aria-label", t("Custom start"));
    const to = el("input");
    to.type = "date";
    to.dataset.setting = "customEnd";
    to.setAttribute("aria-label", t("Custom end"));
    custom.append(from, to);
    field.append(custom);
    actions.append(
      field,
      el("span", "divider-v"),
      iconButton("rescan", "refresh", t("Rescan")),
      iconButton("theme", "contrast", t("Theme preference")),
      iconButton("inspector", "panel", t("Details")),
      iconButton("settings", "settings", t("View settings")),
    );

    inner.append(brand, el("div", "header-meta"), actions);
    header.append(inner);

    const nav = el("nav", "app-nav");
    nav.setAttribute("role", "tablist");
    nav.setAttribute("aria-label", t("Sections"));
    TABS.forEach((tab) => {
      const button = el("button", "tab");
      button.type = "button";
      button.id = `tab-${tab.id}`;
      button.dataset.tab = tab.id;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", `pane-${tab.id}`);
      button.setAttribute("aria-selected", "false");
      button.append(icon(tab.icon, "sm"), text(t(tab.label)));
      button.addEventListener("keydown", (event: KeyboardEvent) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const index = TABS.findIndex((item) => item.id === tab.id);
        const next =
          TABS[
            (index + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) %
              TABS.length
          ];
        if (!next) return;
        this.switchTab(next.id);
        this.root?.querySelector<HTMLButtonElement>(`#tab-${next.id}`)?.focus();
      });
      nav.append(button);
    });
    nav.append(el("span", "nav-meta"));
    header.append(nav);

    const page = el("main", "yb-page");
    this.page = page;

    const foot = el("footer", "page-foot");
    foot.append(
      el(
        "span",
        undefined,
        t(
          "Every number comes from one full scan of the current vault; nothing is stored.",
        ),
      ),
      el("span"),
    );

    scroll.append(header, page, foot);
    this.root.append(
      scroll,
      this.buildInspector(),
      el("div", "yb-notice"),
      this.buildModal(),
    );
    const notice = this.root.querySelector<HTMLElement>(".yb-notice");
    if (notice) {
      notice.hidden = true;
      notice.setAttribute("role", "status");
    }
    this.root.addEventListener("click", this.handleClick);
    this.root.addEventListener("change", this.handleChange);
  }

  private buildInspector(): HTMLElement {
    const aside = el("aside", "inspector");
    aside.hidden = true;
    aside.setAttribute("aria-label", t("Details"));
    const head = el("div", "inspector-head");
    head.append(
      el("h2", undefined, t("Details")),
      iconButton("detail-recent", "refresh", t("Back to recently modified")),
      iconButton("detail-close", "x", t("Close")),
    );
    aside.append(head, el("div", "inspector-body"));
    return aside;
  }

  private buildModal(): HTMLElement {
    const container = el("div", "yb-modal-container");
    container.hidden = true;
    const bg = el("div", "yb-modal-bg");
    bg.dataset.action = "close-settings";
    const modal = el("div", "yb-modal");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", t("View settings"));
    const close = el("button", "icon-btn yb-modal-close");
    close.type = "button";
    close.dataset.action = "close-settings";
    close.setAttribute("aria-label", t("Close"));
    close.append(icon("x"));
    modal.append(close, el("h2", "yb-modal-title", t("View settings")));
    container.append(bg, modal);
    return container;
  }

  private fillModal(): void {
    const config = this.config;
    const modal = this.root?.querySelector<HTMLElement>(".yb-modal");
    if (!config || !modal) return;
    modal.replaceChildren();
    const close = el("button", "icon-btn yb-modal-close");
    close.type = "button";
    close.dataset.action = "close-settings";
    close.setAttribute("aria-label", t("Close"));
    close.append(icon("x"));
    modal.append(close, el("h2", "yb-modal-title", t("View settings")));

    const goal = el("input");
    goal.type = "number";
    goal.min = "100";
    goal.max = "5000";
    goal.step = "100";
    goal.value = String(config.dailyGoal);
    goal.dataset.setting = "goal";

    modal.append(
      el("div", "yb-setting-item yb-setting-heading", t("Counting rules")),
      settingItem(
        t("Daily goal"),
        t("Used by the goal ring and the streak judgment"),
        goal,
        t("words"),
      ),
      settingItem(
        t("Week starts"),
        t("Affects the heatmap and the week numbers"),
        dropdown("weekStartsOn", String(config.weekStartsOn), [
          ["1", t("Monday")],
          ["0", t("Sunday")],
        ]),
      ),
    );

    modal.append(
      settingItem(
        t("Stale after"),
        t("Notes untouched for this long count against health"),
        dropdown("staleDays", String(config.staleDays), [
          ["90", "90"],
          ["180", "180"],
          ["365", "365"],
        ]),
      ),
      el("div", "yb-setting-item yb-setting-heading", t("Appearance")),
    );

    const swatches = el("div", "swatches");
    ACCENTS.forEach((accent) => {
      const swatch = el(
        "button",
        `swatch${config.accent.h === accent.h ? " is-active" : ""}`,
      );
      swatch.type = "button";
      swatch.title = t(accent.name);
      swatch.setAttribute("aria-label", t(accent.name));
      swatch.dataset.accent = `${accent.h}|${accent.s}|${accent.l}`;
      swatch.style.background = `hsl(${accent.h}, ${accent.s}, ${accent.l})`;
      swatches.append(swatch);
    });
    modal.append(
      settingItem(
        t("Accent color"),
        t("Shared by the interface and the charts"),
        swatches,
      ),
      settingItem(
        t("Theme preference"),
        t("The share card keeps its own palette"),
        dropdown("darkMode", config.darkMode, [
          ["system", t("Follow Obsidian")],
          ["light", t("Light")],
          ["dark", t("Dark")],
        ]),
      ),
    );
  }

  /* ---------- scan ----------------------------------------------------- */

  private async runScan(): Promise<void> {
    if (!this.config) return;
    this.scanController?.abort();
    const controller = new AbortController();
    this.scanController = controller;
    const generation = ++this.scanGeneration;
    this.setStatus(t("Scanning vault..."));
    try {
      const snapshot = await scanVault(this.app, {
        signal: controller.signal,
        onProgress: ({ processed, total }) => {
          if (generation === this.scanGeneration && !controller.signal.aborted)
            this.setStatus(`${t("Scanning vault...")} ${processed}/${total}`);
        },
      });
      if (generation !== this.scanGeneration || controller.signal.aborted)
        return;
      this.snapshot = snapshot;
      this.render();
      if (snapshot.scan.skippedCount)
        this.setStatus(`${t("Skipped files")}: ${snapshot.scan.skippedCount}`);
      else this.setStatus(t("Scan complete"));
    } catch (error) {
      if (controller.signal.aborted || generation !== this.scanGeneration)
        return;
      this.showNotice(
        `${t("Scan failed")}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private setStatus(message: string): void {
    this.statusText = message;
    const meta = this.root?.querySelector<HTMLElement>(
      ".page-foot span:last-child",
    );
    if (meta) meta.textContent = message;
    if (!this.snapshot) this.render();
  }

  private showNotice(message: string): void {
    const notice = this.root?.querySelector<HTMLElement>(".yb-notice");
    if (!notice) return;
    notice.textContent = message;
    notice.hidden = false;
    if (this.noticeTimer) window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => {
      if (notice.isConnected) notice.hidden = true;
    }, 2400);
  }

  /* ---------- render --------------------------------------------------- */

  private render(): void {
    const config = this.config;
    const root = this.root;
    const page = this.page;
    if (!config || !root || !page) return;
    root.classList.toggle("is-dark", config.darkMode === "dark");
    root.classList.toggle("is-light", config.darkMode === "light");
    root.style.setProperty("--yb-accent-h", String(config.accent.h));
    root.style.setProperty("--yb-accent-s", config.accent.s);
    root.style.setProperty("--yb-accent-l", config.accent.l);
    this.chartManager.clear();
    this.pending = [];
    page.replaceChildren();
    const rangeField = root.querySelector<HTMLElement>(
      ".field[data-setting-host=range]",
    );
    if (rangeField) {
      const select =
        rangeField.querySelector<HTMLSelectElement>(".yb-dropdown");
      if (select) select.value = config.range;
      const custom = rangeField.querySelector<HTMLElement>(".range-custom");
      const inputs = rangeField.querySelectorAll<HTMLInputElement>("input");
      if (custom) custom.hidden = config.range !== "custom";
      if (inputs[0] && config.customRange)
        inputs[0].value = dateKey(config.customRange.start);
      if (inputs[1] && config.customRange)
        inputs[1].value = dateKey(config.customRange.end);
    }
    if (!this.snapshot) {
      const waiting = panelBox(t("Awesome Yearbook"));
      waiting.append(
        el("p", "empty", this.statusText || t("Waiting for scan")),
      );
      page.append(waiting);
      this.updateTabs();
      return;
    }
    const snapshot = this.snapshot;
    const metrics = calculateMetrics(snapshot, config);
    this.renderHeader(metrics);
    const ctx: PaneContext = {
      snapshot,
      config,
      metrics,
      rangeLabel: this.rangeLabel(),
      vaultName: this.app.vault.getName(),
      addChart: (tab, cls, build, onClick) =>
        this.addChart(tab, cls, build, onClick),
      noteItem: (note, iconName, meta, sub) =>
        this.noteItem(note, iconName, meta, sub),
      recordsFor: (paths) => this.recordsFor(paths),
      showNotes: (title, sub, notes) => this.showNotes(title, sub, notes),
      pane: (tab) => this.pane(tab),
    };
    page.append(
      renderYearbookPane(ctx),
      renderOverviewPane(ctx),
      renderRhythmPane(ctx),
      renderContentPane(ctx),
      renderHealthPane(ctx),
    );
    this.updateTabs();
    this.syncCharts();
  }

  private renderHeader(metrics: Metrics): void {
    const snapshot = this.snapshot;
    if (!snapshot) return;
    const meta = this.root?.querySelector<HTMLElement>(".header-meta");
    if (!meta) return;
    const total = snapshot.notes.reduce((sum, note) => sum + note.wordCount, 0);
    const item = (value: string, unit: string): HTMLElement => {
      const span = el("span");
      span.append(el("b", undefined, value), text(` ${unit}`));
      return span;
    };
    meta.replaceChildren(
      item(fmt(snapshot.notes.length), t("notes")),
      item(fmtW(total), t("words")),
      item(fmt(metrics.today.words), t("Today")),
    );
    const foot = this.root?.querySelector<HTMLElement>(
      ".page-foot span:last-child",
    );
    if (foot)
      foot.textContent = `${t("One full scan")} · ${(snapshot.scan.elapsedMs / 1000).toFixed(2)}s · ${fmt(snapshot.scan.markdownCount)} ${t("Markdown notes")} · ${fmt(snapshot.scan.fileCount)} ${t("files")}`;
  }

  private addChart(
    tab: Tab,
    cls: string,
    build: ChartRequest["build"],
    onClick?: ChartRequest["onClick"],
  ): HTMLElement {
    const host = el("div", cls);
    host.setAttribute("role", "img");
    this.pending.push({ tab, host, build, onClick });
    return host;
  }

  private syncCharts(): void {
    if (!this.root || !this.config) return;
    const tokens = chartTokens(this.root);
    for (const item of this.pending) {
      if (item.tab !== this.config.activeTab) continue;
      const built = item.build(tokens, item.host.clientWidth || 900);
      if (built.height) item.host.style.height = `${built.height}px`;
      const rendered = this.chartManager.render(
        item.host,
        built.option,
        item.onClick ? (params) => item.onClick?.(params ?? {}) : undefined,
      );
      if (!rendered)
        item.host.replaceChildren(
          el("div", "chart-missing", t("Chart is unavailable here.")),
        );
    }
  }

  private pane(tab: Tab): HTMLElement {
    const section = el("section", "tab-pane");
    section.id = `pane-${tab}`;
    section.dataset.pane = tab;
    section.setAttribute("role", "tabpanel");
    section.setAttribute("aria-labelledby", `tab-${tab}`);
    return section;
  }

  private updateTabs(): void {
    const root = this.root;
    const config = this.config;
    if (!root || !config) return;
    root.querySelectorAll<HTMLElement>(".tab").forEach((tab) => {
      const on = tab.dataset.tab === config.activeTab;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
    });
    root.querySelectorAll<HTMLElement>("[data-pane]").forEach((pane) => {
      pane.hidden = pane.dataset.pane !== config.activeTab;
    });
    const field = root.querySelector<HTMLElement>(
      ".field[data-setting-host=range]",
    );
    if (field) field.hidden = config.activeTab === "yearbook";
    const meta = root.querySelector<HTMLElement>(".nav-meta");
    if (meta)
      meta.textContent =
        config.activeTab === "yearbook"
          ? `${config.card.year} · ${t("Calendar year")}`
          : this.rangeLabel();
    const inspectorButton = root.querySelector<HTMLElement>(
      ".icon-btn[data-action=inspector]",
    );
    const inspector = root.querySelector<HTMLElement>(".inspector");
    inspectorButton?.classList.toggle(
      "is-active",
      inspector ? !inspector.hidden : false,
    );
  }

  private switchTab(tab: Tab): void {
    if (!this.config || this.config.activeTab === tab) return;
    this.config.activeTab = tab;
    this.chartManager.clear();
    this.updateTabs();
    this.syncCharts();
  }

  private rangeLabel(): string {
    const snapshot = this.snapshot;
    const config = this.config;
    if (!snapshot || !config) return "";
    const range = getRangeBounds(snapshot, config);
    const days =
      Math.round(
        (startOfDay(range.end).getTime() - startOfDay(range.start).getTime()) /
          86_400_000,
      ) + 1;
    return `${dateKey(range.start)} → ${dateKey(range.end)} · ${days} ${t("days")}`;
  }

  /* ---------- lists and inspector --------------------------------------- */

  private recordsFor(paths: string[]): MarkdownRecord[] {
    const snapshot = this.snapshot;
    if (!snapshot) return [];
    const wanted = new Set(paths);
    return snapshot.notes.filter((note) => wanted.has(note.path));
  }

  private noteItem(
    note: MarkdownRecord,
    iconName: IconName = "file",
    meta?: string,
    sub?: string,
  ): HTMLElement {
    const button = el("button", "note-item");
    button.type = "button";
    button.dataset.path = note.path;
    button.append(icon(iconName, "sm"));
    const body = el("span", "note-item-body");
    body.append(
      el("span", "note-item-title", note.title),
      el("span", "note-item-path", note.folder || "."),
    );
    const metaBox = el("span", "note-item-meta");
    metaBox.append(
      text(meta ?? `${fmt(note.wordCount)} ${t("words")}`),
      createEl("br"),
      text(sub ?? md(note.modifiedAt)),
    );
    button.append(body, metaBox);
    return button;
  }

  private showNotes(title: string, sub: string, notes: MarkdownRecord[]): void {
    const inspector = this.root?.querySelector<HTMLElement>(".inspector");
    const body = this.root?.querySelector<HTMLElement>(".inspector-body");
    if (!inspector || !body) return;
    inspector.hidden = false;
    body.replaceChildren();
    const head = el("div", "detail-head");
    head.append(
      el("div", "detail-title", title),
      el("div", "detail-sub", `${sub} · ${notes.length} ${t("notes")}`),
    );
    body.append(head);
    if (!notes.length) {
      body.append(el("p", "empty", t("Nothing here.")));
      this.updateTabs();
      return;
    }
    const list = el("div", "note-list");
    notes
      .slice()
      .sort((a, b) => b.wordCount - a.wordCount)
      .slice(0, 60)
      .forEach((note) => list.append(this.noteItem(note)));
    body.append(list);
    this.updateTabs();
  }

  private showRecent(): void {
    const notes =
      this.snapshot?.notes
        .slice()
        .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime())
        .slice(0, 40) ?? [];
    this.showNotes(
      t("Recently modified"),
      t("Click any chart element to switch the list"),
      notes,
    );
  }

  private showIssue(key: string): void {
    const snapshot = this.snapshot;
    const config = this.config;
    if (!snapshot || !config) return;
    if (key === "attach") {
      const health = calculateHealth(snapshot, config);
      this.showNotes(
        t("Unreferenced attachments"),
        t("Counted in this scan; paths are not kept"),
        [],
      );
      const body = this.root?.querySelector<HTMLElement>(".inspector-body");
      body
        ?.querySelector(".empty")
        ?.replaceWith(
          el(
            "p",
            "empty",
            `${health.unusedAttachmentRefs} ${t("Unused attachments")}`,
          ),
        );
      return;
    }
    const notes = calculateHealth(snapshot, config).sets[key as HealthIssueKey];
    const row = ISSUE_ROWS.find((item) => item.key === key);
    this.showNotes(
      t(row?.name ?? key),
      t(row?.desc ?? ""),
      notes ? [...notes] : [],
    );
  }

  private closeInspector(): void {
    const inspector = this.root?.querySelector<HTMLElement>(".inspector");
    if (inspector) inspector.hidden = true;
    this.updateTabs();
  }

  /* ---------- card actions ---------------------------------------------- */

  private cardCanvas(): HTMLCanvasElement | null {
    return (
      this.root?.querySelector<HTMLCanvasElement>(".card-stage canvas") ?? null
    );
  }

  private downloadCard(): void {
    const canvas = this.cardCanvas();
    const config = this.config;
    if (!canvas || !config) return;
    const anchor = el("a");
    anchor.download = `yearbook-${config.card.year}-${config.card.ratio.replace(":", "x")}.png`;
    anchor.href = canvas.toDataURL("image/png");
    anchor.click();
  }

  private async copyCardImage(): Promise<void> {
    const canvas = this.cardCanvas();
    if (!canvas) return;
    if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
      new Notice(t("Image copying is unavailable in this environment."));
      return;
    }
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) {
      new Notice(t("Copy failed; use download instead."));
      return;
    }
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      new Notice(t("Image copied."));
    } catch {
      new Notice(t("Copy failed; use download instead."));
    }
  }

  private async copyCardText(): Promise<void> {
    const value =
      this.root?.querySelector<HTMLTextAreaElement>(".card-side textarea")
        ?.value ?? "";
    if (!navigator.clipboard) {
      new Notice(t("Text copying is unavailable in this environment."));
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      new Notice(t("Text copied."));
    } catch {
      new Notice(t("Copy failed."));
    }
  }

  private stepYear(delta: number): void {
    const snapshot = this.snapshot;
    const config = this.config;
    if (!snapshot || !config) return;
    const years = availableYears(snapshot);
    const index = years.indexOf(config.card.year);
    const next = years[index + delta];
    if (next === undefined) return;
    config.card.year = next;
    this.render();
  }

  /* ---------- events ---------------------------------------------------- */

  private handleClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    if (!target || !this.config) return;
    const tab = target.closest<HTMLElement>(".tab")?.dataset.tab;
    if (tab) {
      this.switchTab(tab as Tab);
      return;
    }
    const note = target.closest<HTMLElement>("[data-path]")?.dataset.path;
    if (note) {
      void this.app.workspace.openLinkText(note, "", false);
      return;
    }
    const issue = target.closest<HTMLElement>("[data-issue]")?.dataset.issue;
    if (issue) {
      this.showIssue(issue);
      return;
    }
    const ratio = target.closest<HTMLElement>("[data-ratio]")?.dataset.ratio;
    if (ratio) {
      this.config.card.ratio = ratio as ViewConfig["card"]["ratio"];
      this.render();
      return;
    }
    const palette =
      target.closest<HTMLElement>("[data-palette]")?.dataset.palette;
    if (palette) {
      this.config.card.palette = palette;
      this.render();
      return;
    }
    if (target.closest<HTMLElement>("[data-privacy]")) {
      this.config.card.privacy = !this.config.card.privacy;
      this.render();
      return;
    }
    const block = target.closest<HTMLElement>("[data-block]")?.dataset.block;
    if (block) {
      this.config.card.blocks[block] = !this.config.card.blocks[block];
      this.render();
      return;
    }
    const accent = target.closest<HTMLElement>("[data-accent]")?.dataset.accent;
    if (accent) {
      const [h, s, l] = accent.split("|");
      if (h && s && l) this.config.accent = { h: Number(h), s, l };
      this.render();
      return;
    }
    const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
    if (action) this.runAction(action);
  };

  private runAction(action: string): void {
    const config = this.config;
    if (!config) return;
    if (action === "rescan") void this.runScan();
    else if (action === "theme") {
      const order: ViewConfig["darkMode"][] = ["system", "light", "dark"];
      const next = order[(order.indexOf(config.darkMode) + 1) % order.length];
      if (next) config.darkMode = next;
      this.render();
    } else if (action === "inspector") {
      const inspector = this.root?.querySelector<HTMLElement>(".inspector");
      if (!inspector) return;
      if (inspector.hidden) this.showRecent();
      else this.closeInspector();
    } else if (action === "settings") {
      this.fillModal();
      const modal = this.root?.querySelector<HTMLElement>(
        ".yb-modal-container",
      );
      if (modal) modal.hidden = false;
    } else if (action === "close-settings") {
      const modal = this.root?.querySelector<HTMLElement>(
        ".yb-modal-container",
      );
      if (modal) modal.hidden = true;
    } else if (action === "year-prev") this.stepYear(1);
    else if (action === "year-next") this.stepYear(-1);
    else if (action === "detail-close") this.closeInspector();
    else if (action === "detail-recent") this.showRecent();
    else if (action === "download") this.downloadCard();
    else if (action === "copy-image") void this.copyCardImage();
    else if (action === "copy-text") void this.copyCardText();
  }

  private handleChange = (event: Event): void => {
    const config = this.config;
    if (!config) return;
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    const setting = input.dataset.setting;
    if (!setting) return;
    if (setting === "goal")
      config.dailyGoal = Math.max(
        100,
        Math.min(5000, Number(input.value) || 800),
      );
    if (setting === "weekStartsOn")
      config.weekStartsOn = input.value === "0" ? 0 : 1;
    if (setting === "staleDays") config.staleDays = Number(input.value) || 180;
    if (setting === "handle") config.card.handle = input.value;
    if (setting === "range") {
      config.range = input.value as ViewConfig["range"];
      if (config.range === "custom" && !config.customRange) {
        const end = new Date();
        config.customRange = {
          start: new Date(
            end.getFullYear(),
            end.getMonth(),
            end.getDate() - 59,
          ),
          end,
        };
      }
    }
    if (setting === "customStart" || setting === "customEnd") {
      const current = config.customRange ?? {
        start: new Date(),
        end: new Date(),
      };
      const parsed = new Date(`${input.value}T00:00:00`);
      if (!Number.isNaN(parsed.getTime()))
        current[setting === "customStart" ? "start" : "end"] = parsed;
      config.customRange = current;
    }
    if (setting === "darkMode")
      config.darkMode = input.value as ViewConfig["darkMode"];
    this.render();
  };
}
