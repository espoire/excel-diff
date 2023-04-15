import { alignForComparisonInnerHelper, toRecords } from "./recordDiff.js";
import { clearChildren } from "./util.js";

/** @type {{ tokens: string[][], headers: string[], fields: string[], count: number }} */
let originalRecords;
/** @type {{ tokens: string[][], headers: string[], fields: string[], count: number }} */
let alteredRecords;
function onInputChanged() {
  const originalText = document.getElementById('original').value;
  const alteredText = document.getElementById('altered').value;

  originalRecords = toRecords(originalText);
  alteredRecords = toRecords(alteredText);

  updateCheckboxes();
}

function onClickClear() {
  for (const textarea of getInputTextareas()) {
    textarea.value = '';
  }
  onInputChanged();
}

function getInputTextareas() {
  return ['original', 'altered'].map(id => document.getElementById(id));
}

let checkboxes;
function updateCheckboxes() {
  if (!originalRecords && !alteredRecords) return;

  const options = [...(originalRecords || alteredRecords).headers];
  options.pop(); // Remove the raw TSV element.
  const renderTo = document.getElementById('checkboxesContainer');

  checkboxes = createCheckboxes(options, renderTo).checkboxes;
}

function createCheckboxes(options, container = null) {
  container = container || document.createElement("div");
  clearChildren(container);

  const checkboxes = [];
  for (let i = 0; i < options.length; i++) {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "checkbox-" + i;
    checkbox.value = options[i];
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(options[i]));
    
    container.appendChild(label);
    checkboxes.push(checkbox);
  }

  return {
    container,
    checkboxes
  };
}

function onClickCompare() {
  if (!originalRecords || !alteredRecords) return;

  const mustMatches = getMustMatches();
  if (!mustMatches.length) return;

  const {count, pasteableText} = alignForComparisonInnerHelper(originalRecords, alteredRecords, mustMatches);
  document.getElementById('compared').value = pasteableText;
}

function getMustMatches() {
  const ret = [];
  
  for (const checkbox of checkboxes) {
    if (checkbox.checked) ret.push(checkbox.value);
  }

  return ret;
}

function init() {
  for (const el of getInputTextareas()) el.oninput = onInputChanged;
  document.getElementById('clear').onclick = onClickClear;
  document.getElementById('compare').onclick = onClickCompare;
}
init();