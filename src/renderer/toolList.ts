import { elements } from "./elements";
import { runnerStore } from "./store";

export function renderToolList(onSelect: (index: number) => void): void {
  const { filteredScripts, selectedIndex } = runnerStore.getState();
  const listEl = elements.toolListEl;
  listEl.textContent = "";

  filteredScripts.forEach((script, idx) => {
    const li = document.createElement("li");
    li.className = `tool-item${idx === selectedIndex ? " active" : ""}`;

    const hasParams =
      Array.isArray(script.paramsSchema) && script.paramsSchema.length > 0;

    const iconDiv = document.createElement("div");
    iconDiv.className = "tool-icon";
    iconDiv.textContent = script.icon || "⌘";

    const infoDiv = document.createElement("div");
    infoDiv.className = "tool-info";

    const nameRow = document.createElement("div");
    nameRow.className = "tool-name-row";

    const nameSpan = document.createElement("span");
    nameSpan.className = "tool-name";
    nameSpan.textContent = script.name;
    nameRow.appendChild(nameSpan);

    if (hasParams) {
      const paramTag = document.createElement("span");
      paramTag.className = "tool-param-tag";
      paramTag.textContent = "⇥ Params";
      nameRow.appendChild(paramTag);
    } else if (script.isCustom) {
      const customTag = document.createElement("span");
      customTag.className = "tool-param-tag";
      customTag.textContent = "Custom";
      nameRow.appendChild(customTag);
    }

    const descDiv = document.createElement("div");
    descDiv.className = "tool-desc";
    descDiv.textContent = script.description;

    infoDiv.appendChild(nameRow);
    infoDiv.appendChild(descDiv);
    li.appendChild(iconDiv);
    li.appendChild(infoDiv);

    li.addEventListener("click", () => {
      onSelect(idx);
    });

    listEl.appendChild(li);
  });

  const activeEl = listEl.querySelector(".tool-item.active");
  if (activeEl) {
    activeEl.scrollIntoView({ block: "nearest" });
  }
}
