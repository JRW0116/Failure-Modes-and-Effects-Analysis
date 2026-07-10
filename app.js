const storageKey = "aiag-vda-reference-fmea-v1";
const fields = [
  "item",
  "function",
  "failureMode",
  "effect",
  "cause",
  "prevention",
  "detection",
  "severity",
  "occurrence",
  "detectionRank",
  "action",
  "actionOwner",
  "dueDate",
  "status"
];

const defaultProject = {
  fmeaType: "Design FMEA",
  productProcess: "",
  owner: "",
  revision: "",
  preparedBy: "",
  reviewDate: new Date().toISOString().slice(0, 10)
};

const demoRows = [
  {
    item: "Example: mounting bracket",
    function: "Hold component in design position during vehicle operation",
    failureMode: "Bracket cracks at bend radius",
    effect: "Component loosens, noise, possible loss of function",
    cause: "Stress concentration and vibration load above design margin",
    prevention: "Design guideline review; finite element analysis",
    detection: "DV vibration test; dimensional inspection",
    severity: 8,
    occurrence: 4,
    detectionRank: 5,
    action: "Increase bend radius and confirm with updated validation plan",
    actionOwner: "Engineering",
    dueDate: "",
    status: "Open"
  },
  {
    item: "Example: assembly torque step",
    function: "Secure fastener to specified clamp load",
    failureMode: "Under-torque",
    effect: "Joint loosening during service",
    cause: "Tool calibration drift or skipped torque confirmation",
    prevention: "Preventive maintenance and setup verification",
    detection: "Error-proofed torque traceability",
    severity: 7,
    occurrence: 3,
    detectionRank: 3,
    action: "Add daily calibration check and escalation rule for failed trace",
    actionOwner: "Manufacturing",
    dueDate: "",
    status: "In progress"
  }
];

const state = loadState();
const rowTemplate = document.querySelector("#rowTemplate");
const rowsBody = document.querySelector("#fmeaRows");
const saveState = document.querySelector("#saveState");

document.querySelector("#addRow").addEventListener("click", () => {
  state.rows.push(createBlankRow());
  renderRows();
  persist();
});

document.querySelector("#clearDemo").addEventListener("click", () => {
  state.rows = [];
  renderRows();
  persist();
});

document.querySelector("#exportJson").addEventListener("click", exportJson);
document.querySelector("#exportCsv").addEventListener("click", exportCsv);
document.querySelector("#importJson").addEventListener("change", importJson);
document.querySelector("#searchRows").addEventListener("input", renderRows);

for (const id of Object.keys(defaultProject)) {
  const input = document.querySelector(`#${id}`);
  input.value = state.project[id] || "";
  input.addEventListener("input", () => {
    state.project[id] = input.value;
    persist();
  });
}

renderRows();
updateSummary();

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    if (stored && Array.isArray(stored.rows)) {
      return {
        project: { ...defaultProject, ...stored.project },
        rows: stored.rows
      };
    }
  } catch {
    localStorage.removeItem(storageKey);
  }

  return {
    project: defaultProject,
    rows: demoRows
  };
}

function createBlankRow() {
  return {
    item: "",
    function: "",
    failureMode: "",
    effect: "",
    cause: "",
    prevention: "",
    detection: "",
    severity: 5,
    occurrence: 5,
    detectionRank: 5,
    action: "",
    actionOwner: "",
    dueDate: "",
    status: "Open"
  };
}

function renderRows() {
  const query = document.querySelector("#searchRows").value.trim().toLowerCase();
  rowsBody.innerHTML = "";

  state.rows.forEach((row, index) => {
    const searchable = fields.map((field) => row[field]).join(" ").toLowerCase();
    if (query && !searchable.includes(query)) {
      return;
    }

    const clone = rowTemplate.content.cloneNode(true);
    const tr = clone.querySelector("tr");
    tr.dataset.index = index;

    for (const field of fields) {
      const input = clone.querySelector(`[data-field="${field}"]`);
      input.value = row[field] ?? "";
      input.addEventListener("input", () => {
        const value = input.type === "number" ? clampRank(input.value) : input.value;
        row[field] = value;
        if (input.type === "number") input.value = value;
        updateActionPriority(tr, row);
        updateSummary();
        persist();
      });
    }

    clone.querySelector(".delete-row").addEventListener("click", () => {
      state.rows.splice(index, 1);
      renderRows();
      persist();
    });

    updateActionPriority(tr, row);
    rowsBody.appendChild(clone);
  });

  updateSummary();
}

function clampRank(value) {
  const numeric = Number.parseInt(value, 10);
  if (Number.isNaN(numeric)) return "";
  return Math.min(10, Math.max(1, numeric));
}

function actionPriority(row) {
  const severity = Number(row.severity) || 1;
  const occurrence = Number(row.occurrence) || 1;
  const detection = Number(row.detectionRank) || 1;
  const riskScore = severity * occurrence * detection;

  if (severity >= 9 || riskScore >= 280 || (severity >= 7 && occurrence >= 6)) return "H";
  if (riskScore >= 100 || severity >= 7 || occurrence >= 6) return "M";
  return "L";
}

function updateActionPriority(tr, row) {
  const pill = tr.querySelector(".ap-pill");
  const ap = actionPriority(row);
  pill.textContent = ap;
  pill.className = `ap-pill ap-${ap === "H" ? "high" : ap === "M" ? "medium" : "low"}`;
  pill.title = `Calculated working Action Priority: ${ap}`;
}

function updateSummary() {
  const highPriority = state.rows.filter((row) => actionPriority(row) === "H").length;
  const openActions = state.rows.filter((row) => row.action && row.status !== "Complete").length;
  document.querySelector("#rowCount").textContent = state.rows.length;
  document.querySelector("#highPriorityCount").textContent = highPriority;
  document.querySelector("#openActionCount").textContent = openActions;
}

function persist() {
  localStorage.setItem(storageKey, JSON.stringify(state));
  saveState.textContent = "Saved locally";
  window.clearTimeout(persist.timeout);
  persist.timeout = window.setTimeout(() => {
    saveState.textContent = "Autosave ready";
  }, 1300);
}

function exportJson() {
  download(
    JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2),
    "fmea-project.json",
    "application/json"
  );
}

function exportCsv() {
  const headers = [
    "FMEA Type",
    "Product / Process",
    "Revision",
    "Item / Step",
    "Function",
    "Failure Mode",
    "Effect",
    "Cause",
    "Prevention Control",
    "Detection Control",
    "Severity",
    "Occurrence",
    "Detection",
    "Action Priority",
    "Recommended Action",
    "Owner",
    "Due",
    "Status"
  ];

  const csvRows = state.rows.map((row) => [
    state.project.fmeaType,
    state.project.productProcess,
    state.project.revision,
    row.item,
    row.function,
    row.failureMode,
    row.effect,
    row.cause,
    row.prevention,
    row.detection,
    row.severity,
    row.occurrence,
    row.detectionRank,
    actionPriority(row),
    row.action,
    row.actionOwner,
    row.dueDate,
    row.status
  ]);

  const csv = [headers, ...csvRows]
    .map((line) => line.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");

  download(csv, "fmea-worksheet.csv", "text/csv");
}

function importJson(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported.rows)) throw new Error("Missing rows");
      state.project = { ...defaultProject, ...imported.project };
      state.rows = imported.rows;
      for (const id of Object.keys(defaultProject)) {
        document.querySelector(`#${id}`).value = state.project[id] || "";
      }
      renderRows();
      persist();
    } catch {
      alert("That file could not be imported. Please choose a JSON export from this app.");
    } finally {
      event.target.value = "";
    }
  });
  reader.readAsText(file);
}

function download(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
