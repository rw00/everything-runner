import { elements } from "./elements";
import {
  getActiveScript,
  getParamsForScript,
  updateScriptParam
} from "./store";

export function renderParamsPanel(onChange: () => void): void {
  const script = getActiveScript();
  const fieldsContainer = elements.paramsFields;
  const container = elements.paramsContainer;
  fieldsContainer.textContent = "";

  if (
    !script ||
    !Array.isArray(script.paramsSchema) ||
    script.paramsSchema.length === 0
  ) {
    container.classList.add("hidden");
    return;
  }

  container.classList.remove("hidden");
  const currentParams = getParamsForScript(script);

  script.paramsSchema.forEach((field) => {
    const wrapper = document.createElement("label");
    wrapper.className = "param-field";

    if (field.type === "boolean") {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = "param-checkbox param-control";
      input.checked = Boolean(currentParams[field.key]);
      input.addEventListener("change", () => {
        updateScriptParam(script.id, field.key, input.checked);
        onChange();
      });
      const span = document.createElement("span");
      span.textContent = field.label;
      wrapper.appendChild(input);
      wrapper.appendChild(span);
    } else if (field.type === "select" && Array.isArray(field.options)) {
      const span = document.createElement("span");
      span.textContent = `${field.label}:`;
      const select = document.createElement("select");
      select.className = "param-select param-control";
      field.options.forEach((opt) => {
        const optionEl = document.createElement("option");
        optionEl.value = String(opt.value);
        optionEl.textContent = opt.label;
        if (currentParams[field.key] === opt.value) {
          optionEl.selected = true;
        }
        select.appendChild(optionEl);
      });
      select.addEventListener("change", () => {
        updateScriptParam(script.id, field.key, select.value);
        onChange();
      });
      wrapper.appendChild(span);
      wrapper.appendChild(select);
    } else {
      const span = document.createElement("span");
      span.textContent = `${field.label}:`;
      const input = document.createElement("input");
      input.type = field.type === "number" ? "number" : "text";
      input.className = "param-input-text param-control";
      input.value = String(currentParams[field.key] ?? "");
      input.addEventListener("input", () => {
        const value =
          field.type === "number" ? Number(input.value) : input.value;
        updateScriptParam(script.id, field.key, value);
        onChange();
      });
      wrapper.appendChild(span);
      wrapper.appendChild(input);
    }

    fieldsContainer.appendChild(wrapper);
  });
}
