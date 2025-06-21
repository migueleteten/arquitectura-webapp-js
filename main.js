let allExpedientes = [];
let currentSort = { column: "codigo", order: "desc" };
let currentExpedienteId = null;

// --- INICIALIZACIÓN ---
document.addEventListener("DOMContentLoaded", () => {
  google.script.run
    .withSuccessHandler(onDataReceived)
    .withFailureHandler(onError)
    .getExpedientesParaListado();

  document.getElementById("search-box").addEventListener("input", handleSearch);
  document
    .querySelectorAll("th[data-column]")
    .forEach((th) => th.addEventListener("click", handleSort));

  // Event listener para la edición inline (delegación de eventos)
  document
    .getElementById("detail-panel-content")
    .addEventListener("click", handlePanelClick);
    document.querySelectorAll('.js-close-modal').forEach(button => {
        button.addEventListener('click', closeModal);
    });
});

// --- RENDERIZADO DE LA TABLA PRINCIPAL ---
function onDataReceived(data) {
  allExpedientes = data;
  sortData();
  renderTable(allExpedientes);
}

function renderTable(data) {
  const tbody = document.getElementById("expedientes-tbody");
  tbody.innerHTML = "";
  if (data.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6">No se encontraron expedientes.</td></tr>';
    return;
  }
  data.forEach((exp) => {
    const row = document.createElement("tr");
    row.dataset.id = exp.id_expediente;
    row.onclick = (e) => {
      // Prevenir que el click en un posible botón dentro de la fila abra el panel
      if (e.target.tagName !== "BUTTON") openDetailPanel(exp.id_expediente);
    };
    row.innerHTML = `
          <td>${exp.codigo || ""}</td>
          <td>${exp.encargo || ""}</td>
          <td>${exp.direccion || ""}</td>
          <td>${exp.nombre_cliente || ""}</td>
          <td>${exp.telefono || ""}</td>
          <td><span class="badge ${
            "badge-" + (exp.estado || "").toLowerCase().replace(/\s+/g, "-")
          }">${exp.estado || ""}</span></td>
        `;
    tbody.appendChild(row);
  });
}

// --- BÚSQUEDA Y ORDENACIÓN ---
function handleSearch(event) {
  const searchTerm = event.target.value.toLowerCase();
  const filteredData = allExpedientes.filter((exp) =>
    Object.values(exp).some((value) =>
      String(value).toLowerCase().includes(searchTerm)
    )
  );
  renderTable(filteredData);
}

function handleSort(event) {
  const column = event.target.dataset.column;
  if (currentSort.column === column) {
    currentSort.order = currentSort.order === "asc" ? "desc" : "asc";
  } else {
    currentSort.column = column;
    currentSort.order = "asc";
  }
  sortData();
  renderTable(allExpedientes);
}

function sortData() {
  allExpedientes.sort((a, b) => {
    const valA = a[currentSort.column] || "";
    const valB = b[currentSort.column] || "";
    if (valA < valB) return currentSort.order === "asc" ? -1 : 1;
    if (valA > valB) return currentSort.order === "asc" ? 1 : -1;
    return 0;
  });
}

// --- PANEL LATERAL Y EDICIÓN INLINE ---
function openDetailPanel(expedienteId) {
  currentExpedienteId = expedienteId;
  const panel = document.getElementById("detail-panel");
  const panelContent = document.getElementById("detail-panel-content");
  panelContent.innerHTML = '<p class="loader">Cargando detalles...</p>';
  panel.classList.add("open");
  document.querySelector(".main-container").classList.add("panel-open");

  google.script.run
    .withSuccessHandler(renderDetailPanel)
    .withFailureHandler(
      (error) => (panelContent.innerHTML = `<p>Error: ${error.message}</p>`)
    )
    .getExpedienteDetails(expedienteId);
}

function closeDetailPanel() {
  document.getElementById("detail-panel").classList.remove("open");
  document.querySelector(".main-container").classList.remove("panel-open");
}

function renderDetailPanel(data) {
  // VERSIÓN CORREGIDA Y MÁS SEGURA
  // Primero comprobamos si 'data' es nulo o si 'data' contiene una propiedad de error.
  if (!data || data.error) {
    const errorMessage = data
      ? data.error
      : "No se recibieron datos del servidor.";
    document.getElementById(
      "detail-panel-content"
    ).innerHTML = `<p>Error al cargar los detalles: ${errorMessage}</p>`;
    return;
  }

  const { expediente, cliente } = data;
  const content = document.getElementById("detail-panel-content");

  // El resto de la función sigue igual...
  content.innerHTML = `
        <div class="detail-group">
          <h3>Expediente: ${expediente.ID_Expediente}</h3>
          <div class="detail-field special-edit" data-field-name="Encargo" data-sheet-name="Expedientes">
              <span class="field-label">Encargo:</span>
              <span class="field-value">${
                expediente.Encargo || "<i>No establecido</i>"
              }</span>
          </div>
          ${createEditableSelect(
            "Estado",
            expediente.Estado,
            ["Sin presupuestar", "Presupuestado", "Aceptado", "No aceptado"],
            "Expedientes"
          )}
        </div>
        
        <div class="detail-group">
          <h3>Cliente: ${cliente.Nombre} ${cliente.Apellido1}</h3>
          ${createEditableField("Nombre", cliente.Nombre, "Clientes")}
          ${createEditableField(
            "Apellido1",
            cliente.Apellido1,
            "Clientes",
            "Primer Apellido"
          )}
          ${createEditableField(
            "Apellido2",
            cliente.Apellido2,
            "Clientes",
            "Segundo Apellido"
          )}
          ${createEditableField("Telefono", cliente.Telefono, "Clientes")}
          ${createEditableField("Email", cliente.Email, "Clientes")}
          ${createEditableField("NIF", cliente.NIF, "Clientes")}
        </div>

        <div class="detail-group">
          <h3>Dirección</h3>
          ${createEditableField(
            "DireccionCompleta",
            expediente.DireccionCompleta,
            "Expedientes",
            "Dirección Completa"
          )}
        </div>

        <div class="detail-group">
          <h3>Presupuestos</h3>
          <p>Aún no hay ningún presupuesto creado.</p>
          <button class="btn-primary">Nuevo Presupuesto de Honorarios</button>
        </div>
      `;
}

// --- FUNCIONES AUXILIARES PARA RENDERIZAR Y EDITAR ---

function createEditableField(fieldName, value, sheetName, label) {
  label = label || fieldName;
  return `
        <div class="detail-field" data-field-name="${fieldName}" data-sheet-name="${sheetName}">
          <span class="field-label">${label}:</span>
          <span class="field-value">${value || "<i>No establecido</i>"}</span>
          <input type="text" class="field-input" style="display:none;" value="${
            value || ""
          }">
        </div>
      `;
}

function createEditableSelect(fieldName, value, options, sheetName, label) {
  label = label || fieldName;
  let optionsHtml = options
    .map(
      (opt) =>
        `<option value="${opt}" ${
          opt === value ? "selected" : ""
        }>${opt}</option>`
    )
    .join("");
  return `
            <div class="detail-field" data-field-name="${fieldName}" data-sheet-name="${sheetName}">
                <span class="field-label">${label}:</span>
                <span class="field-value"><span class="badge ${
                  "badge-" + (value || "").toLowerCase().replace(/\s+/g, "-")
                }">${value}</span></span>
                <select class="field-input" style="display:none;">${optionsHtml}</select>
            </div>
        `;
}

function handlePanelClick(e) {
  // Buscamos el contenedor del campo en el que se ha hecho clic
  const fieldDiv = e.target.closest(".detail-field");
  if (!fieldDiv) return; // Si no se encontró un campo, no hacemos nada

  // Si es un campo de edición especial como "Encargo"
  if (fieldDiv.classList.contains("special-edit")) {
    const fieldName = fieldDiv.dataset.fieldName;
    if (fieldName === "Encargo") {
      const currentValue = fieldDiv.querySelector(".field-value").textContent;
      openEncargoModal(currentValue);
    }
    // Aquí podríamos añadir más casos 'else if' para otros campos especiales en el futuro
  }
  // Si es un campo normal de edición inline
  else if (e.target.classList.contains("field-value")) {
    const valueSpan = fieldDiv.querySelector(".field-value");
    const inputEl = fieldDiv.querySelector(".field-input");
    valueSpan.style.display = "none";
    inputEl.style.display = "inline-block";
    inputEl.focus();

    const saveChange = () => {
      // ... (el resto de la lógica de guardado inline que ya tenías)
      inputEl.disabled = true;
      inputEl.style.opacity = 0.5;
      const newValue = inputEl.value;
      const fieldName = fieldDiv.dataset.fieldName;
      const sheetName = fieldDiv.dataset.sheetName;
      google.script.run
        .withSuccessHandler((response) => {
          inputEl.disabled = false;
          inputEl.style.opacity = 1;
          inputEl.style.display = "none";
          if (fieldName === "Estado") {
            valueSpan.innerHTML = `<span class="badge ${
              "badge-" + (newValue || "").toLowerCase().replace(/\s+/g, "-")
            }">${newValue}</span>`;
          } else {
            valueSpan.textContent = newValue || "No establecido";
          }
          valueSpan.style.display = "inline";
          if (response.refreshList) {
            google.script.run
              .withSuccessHandler(onDataReceived)
              .getExpedientesParaListado();
          }
        })
        .withFailureHandler(onError)
        .updateExpedienteField(
          currentExpedienteId,
          sheetName,
          fieldName,
          newValue
        );
    };

    inputEl.onblur = saveChange;
    inputEl.onkeydown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        inputEl.blur();
      } else if (event.key === "Escape") {
        inputEl.onblur = null;
        inputEl.style.display = "none";
        valueSpan.style.display = "inline";
      }
    };
  }
}

/**
 * Abre el modal de edición para el campo "Encargo", cargando todos los trabajos posibles.
 * @param {string} currentEncargoValue - El valor actual del campo, ej: "Proyecto Básico, Dirección de Obra".
 */
function openEncargoModal(currentEncargoValue) {
  const modal = document.getElementById("edit-modal");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const modalSaveButton = document.getElementById("modal-save-button");

  modalTitle.textContent = "Editar Encargo";
  modalBody.innerHTML = '<p class="loader">Cargando lista de trabajos...</p>';
  modal.style.display = "flex";

  // Obtenemos la lista de trabajos de la configuración
  google.script.run
    .withSuccessHandler((allTrabajos) => {
      // Convertimos el string de encargos actuales en un array para poder buscar fácilmente
      const selectedTrabajos = currentEncargoValue
        .split(",")
        .map((s) => s.trim());

      // Creamos los checkboxes
      let checkboxesHtml = allTrabajos
        .map((trabajo) => {
          const isChecked = selectedTrabajos.includes(trabajo) ? "checked" : "";
          return `
                        <label class="modal-checkbox-label">
                            <input type="checkbox" name="encargo-option" value="${trabajo}" ${isChecked}>
                            ${trabajo}
                        </label>
                    `;
        })
        .join("");

      modalBody.innerHTML = `<div class="checkbox-grid">${checkboxesHtml}</div>`;
      modalSaveButton.onclick = saveEncargoChanges; // Asignamos la función de guardado
    })
    .withFailureHandler((error) => {
      modalBody.innerHTML = `<p>Error: ${error.message}</p>`;
    })
    .getConfigTrabajos();
}

/**
 * Recoge los valores de los checkboxes del modal y guarda el nuevo "Encargo".
 */
function saveEncargoChanges() {
  const checkedBoxes = document.querySelectorAll(
    '#modal-body input[name="encargo-option"]:checked'
  );
  const newValues = Array.from(checkedBoxes).map((cb) => cb.value);
  const newEncargoString = newValues.join(", ");

  // Mostramos un feedback visual mientras se guarda
  const modalSaveButton = document.getElementById("modal-save-button");
  modalSaveButton.disabled = true;
  modalSaveButton.textContent = "Guardando...";

  // Usamos la misma función de actualización que los otros campos
  google.script.run
    .withSuccessHandler((response) => {
      // Reseteamos el botón
      modalSaveButton.disabled = false;
      modalSaveButton.textContent = "Guardar Cambios";
      closeModal();

      // Actualizamos el valor en el panel de detalles al instante
      const fieldDiv = document.querySelector(
        '.detail-field[data-field-name="Encargo"] .field-value'
      );
      if (fieldDiv) fieldDiv.textContent = newEncargoString || "No establecido";

      // Refrescamos la lista principal para que el cambio se vea también allí
      google.script.run
        .withSuccessHandler(onDataReceived)
        .getExpedientesParaListado();
    })
    .withFailureHandler(onError)
    .updateExpedienteField(
      currentExpedienteId,
      "Expedientes",
      "Encargo",
      newEncargoString
    );
}

// --- MANEJO DE ERRORES ---
function onError(error) {
  alert("Error: " + error.message);
}

function closeModal() {
    const modal = document.getElementById('edit-modal');
    if(modal) {
        modal.style.display = 'none';
    }
}
