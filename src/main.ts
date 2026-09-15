import { Plugin, addIcon, getLanguage } from "obsidian";
import { PROJECT_ICON, PROJECT_ICON_ID } from "./icons";
import { setLanguage, t } from "./i18n/i18n";
import { VIEW_TYPE_YEARBOOK, YearbookView } from "./view";

export default class AwesomeYearbookPlugin extends Plugin {
  override async onload(): Promise<void> {
    setLanguage(getLanguage());
    addIcon(PROJECT_ICON_ID, PROJECT_ICON);
    this.registerView(VIEW_TYPE_YEARBOOK, (leaf) => new YearbookView(leaf));
    this.addRibbonIcon(
      PROJECT_ICON_ID,
      t("Awesome Yearbook"),
      () => void this.activateView(),
    );
    this.addCommand({
      id: "open-yearbook",
      name: t("Open yearbook"),
      callback: () => void this.activateView(),
    });
  }

  private async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_YEARBOOK)[0];
    const leaf = existing ?? this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_TYPE_YEARBOOK, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }
}
