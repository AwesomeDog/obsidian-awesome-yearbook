/** Small DOM builders shared by the shell and every tab pane. */

import { shortNumber } from "../charts";
import { icon, type IconName } from "../icons";

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = createEl(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function text(value: string): Text {
  return document.createTextNode(value);
}

export function iconButton(
  action: string,
  name: IconName,
  title: string,
): HTMLButtonElement {
  const button = el("button", "icon-btn");
  button.type = "button";
  button.dataset.action = action;
  button.title = title;
  button.setAttribute("aria-label", title);
  button.append(icon(name));
  return button;
}

export function panelBox(
  title: string,
  desc?: string,
  extra?: string,
): HTMLElement {
  const section = el("section", extra ? `panel ${extra}` : "panel");
  const header = el("header", "panel-header");
  header.append(el("h3", "panel-title", title));
  if (desc) header.append(el("span", "panel-desc", desc));
  section.append(header);
  return section;
}

export function settingItem(
  name: string,
  desc: string,
  ...controls: (HTMLElement | string)[]
): HTMLElement {
  const item = el("div", "yb-setting-item");
  const info = el("div", "yb-setting-item-info");
  info.append(
    el("div", "yb-setting-item-name", name),
    el("div", "yb-setting-item-desc", desc),
  );
  const box = el("div", "yb-setting-item-control");
  controls.forEach((control) =>
    box.append(typeof control === "string" ? text(control) : control),
  );
  item.append(info, box);
  return item;
}

export function dropdown(
  setting: string,
  value: string,
  options: [string, string][],
): HTMLSelectElement {
  const select = el("select", "yb-dropdown");
  select.dataset.setting = setting;
  options.forEach(([optionValue, label]) => {
    const option = el("option", undefined, label);
    option.value = optionValue;
    select.append(option);
  });
  select.value = value;
  return select;
}

export function fmt(value: number): string {
  return Math.round(value).toLocaleString();
}

export function fmtW(value: number): string {
  return Math.abs(value) >= 10000 ? shortNumber(value) : fmt(value);
}

export function md(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function mdLong(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
  }).format(date);
}

export interface StatItem {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  delta?: string;
  down?: boolean;
}

export function statGrid(items: StatItem[]): HTMLElement {
  const grid = el("dl", "stat-grid");
  for (const item of items) {
    const stat = el("div", "stat");
    stat.append(el("dt", undefined, item.label));
    const value = el("dd");
    value.append(text(item.value));
    if (item.unit) value.append(el("small", undefined, item.unit));
    stat.append(value);
    if (item.sub || item.delta) {
      const sub = el("dd", "sub");
      if (item.sub) sub.append(text(item.sub));
      if (item.delta) {
        if (item.sub) sub.append(text(" "));
        sub.append(
          el("span", item.down ? "delta is-down" : "delta", item.delta),
        );
      }
      stat.append(sub);
    }
    grid.append(stat);
  }
  return grid;
}

export function kvGrid(
  rows: { label: string; value: string; note?: string }[],
) {
  const list = el("dl", "kv");
  for (const row of rows) {
    const line = el("div");
    line.append(el("dt", undefined, row.label));
    const value = el("dd");
    value.append(text(row.value));
    if (row.note) value.append(el("em", undefined, row.note));
    line.append(value);
    list.append(line);
  }
  return list;
}

export function meterRow(
  label: string,
  ratio: number,
  display: string,
  soft = false,
  mod?: string,
): HTMLElement {
  const row = el("li", mod ? `meter-row ${mod}` : "meter-row");
  row.append(el("span", "lbl", label));
  const meter = el("span", "meter");
  const fill = el("i", soft ? "is-soft" : undefined);
  fill.style.width = `${Math.max(0, Math.min(100, ratio * 100))}%`;
  meter.append(fill);
  row.append(meter, el("b", "num", display));
  return row;
}

export function callout(
  mod: string,
  iconName: IconName,
  title: string,
  content: string,
): HTMLElement {
  const box = el("div", `yb-callout ${mod}`);
  const heading = el("div", "yb-callout-title");
  heading.append(icon(iconName, "sm"), text(title));
  box.append(heading, el("div", "yb-callout-content", content));
  return box;
}
