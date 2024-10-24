function getRequiredElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Required DOM element with id "${id}" was not found.`);
  }
  return el as T;
}

export const elements = {
  get searchInput(): HTMLInputElement {
    return getRequiredElement<HTMLInputElement>("tool-search");
  },
  get accessibilityBtn(): HTMLButtonElement {
    return getRequiredElement<HTMLButtonElement>("accessibility-btn");
  },
  get toggleInputBtn(): HTMLButtonElement {
    return getRequiredElement<HTMLButtonElement>("toggle-input-btn");
  },
  get sourceLabel(): HTMLElement {
    return getRequiredElement<HTMLElement>("source-label");
  },
  get toggleSettingsBtn(): HTMLButtonElement {
    return getRequiredElement<HTMLButtonElement>("toggle-settings-btn");
  },
  get settingsDrawer(): HTMLElement {
    return getRequiredElement<HTMLElement>("settings-drawer");
  },
  get settingsMeta(): HTMLElement {
    return getRequiredElement<HTMLElement>("settings-meta");
  },
  get customScriptsDirInput(): HTMLInputElement {
    return getRequiredElement<HTMLInputElement>("custom-scripts-dir-input");
  },
  get browseScriptsDirBtn(): HTMLButtonElement {
    return getRequiredElement<HTMLButtonElement>("browse-scripts-dir-btn");
  },
  get saveSettingsBtn(): HTMLButtonElement {
    return getRequiredElement<HTMLButtonElement>("save-settings-btn");
  },
  get openSettingsFileBtn(): HTMLButtonElement {
    return getRequiredElement<HTMLButtonElement>("open-settings-file-btn");
  },
  get inputDrawer(): HTMLElement {
    return getRequiredElement<HTMLElement>("input-drawer");
  },
  get inputSummary(): HTMLElement {
    return getRequiredElement<HTMLElement>("input-summary");
  },
  get inputTextarea(): HTMLTextAreaElement {
    return getRequiredElement<HTMLTextAreaElement>("input-textarea");
  },
  get toolListEl(): HTMLUListElement {
    return getRequiredElement<HTMLUListElement>("tool-list");
  },
  get paramsContainer(): HTMLElement {
    return getRequiredElement<HTMLElement>("params-container");
  },
  get paramsFields(): HTMLElement {
    return getRequiredElement<HTMLElement>("params-fields");
  },
  get previewTitle(): HTMLElement {
    return getRequiredElement<HTMLElement>("preview-title");
  },
  get previewBadge(): HTMLElement {
    return getRequiredElement<HTMLElement>("preview-badge");
  },
  get previewBody(): HTMLElement {
    return getRequiredElement<HTMLElement>("preview-body");
  },
  get btnReplace(): HTMLButtonElement {
    return getRequiredElement<HTMLButtonElement>("btn-replace");
  },
  get btnCopy(): HTMLButtonElement {
    return getRequiredElement<HTMLButtonElement>("btn-copy");
  },
  get replaceKbd(): HTMLElement {
    return getRequiredElement<HTMLElement>("replace-kbd");
  },
  get replaceLabel(): HTMLElement {
    return getRequiredElement<HTMLElement>("replace-label");
  },
  get copyKbd(): HTMLElement {
    return getRequiredElement<HTMLElement>("copy-kbd");
  },
  get copyLabel(): HTMLElement {
    return getRequiredElement<HTMLElement>("copy-label");
  }
};
