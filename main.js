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
  document.querySelector('.js-close-panel').addEventListener('click', closeDetailPanel);
  document
    .getElementById("detail-panel-content").addEventListener('change', handlePanelChange);
});

// --- RENDERIZADO DE LA TABLA PRINCIPAL ---
function onDataReceived(data) {
  allExpedientes = data;
  sortData();
  renderTable(allExpedientes);
}

function renderTable(data) {
  const tbody = document.getElementById('expedientes-tbody');
  tbody.innerHTML = '';
  if (data.length === 0) {
    // Añadimos el colspan="7" para que ocupe la nueva columna
    tbody.innerHTML = '<tr><td colspan="7">No se encontraron expedientes.</td></tr>';
    return;
  }
  
  data.forEach(exp => {
    const row = document.createElement('tr');
    row.dataset.id = exp.id_expediente;
    row.onclick = (e) => { 
      if(e.target.closest('a')) return; // Si se hace clic en el link, no abras el panel
      if(e.target.tagName !== 'BUTTON') openDetailPanel(exp.id_expediente);
    };
    
    const driveUrl = `https://drive.google.com/drive/folders/${exp.driveFolderId}`;
    
    row.innerHTML = `
      <td>${exp.codigo || ''}</td>
      <td>${exp.encargo || ''}</td>
      <td>${exp.direccion || ''}</td>
      <td>${exp.nombre_cliente || ''}</td>
      <td>${exp.telefono || ''}</td>
      <td><span class="badge ${'badge-' + (exp.estado || '').toLowerCase().replace(/\s+/g, '-')}">${exp.estado || ''}</span></td>
      <td class="actions-cell">
        <a href="${driveUrl}" target="_blank" rel="noopener noreferrer" class="row-action-icon" title="Abrir carpeta en Drive">
          <svg xmlns="http://www.w3.org/2000/svg" height="18" width="18" viewBox="0 0 512 512"><path fill="currentColor" d="M64 480H448c35.3 0 64-28.7 64-64V160c0-35.3-28.7-64-64-64H288c-10.1 0-19.6-4.7-25.6-12.8L243.2 57.6C231.1 41.5 212.1 32 192 32H64C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64z"/></svg>
        </a>
      </td>
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
  document.getElementById('panel-header-actions').innerHTML = '';
}

function renderDetailPanel(data) {
    if (!data || data.error) {
        const errorMessage = data ? data.error : "No se recibieron datos del servidor.";
        document.getElementById('detail-panel-content').innerHTML = `<p>Error al cargar los detalles: ${errorMessage}</p>`;
        return;
    }
    const { expediente, cliente, presupuestos } = data;
    const content = document.getElementById('detail-panel-content');
    const actionsContainer = document.getElementById('panel-header-actions');
    const driveUrl = `https://drive.google.com/drive/folders/${expediente.ID_Carpeta_Drive}`;
    actionsContainer.innerHTML = `<a href="${driveUrl}" target="_blank" rel="noopener noreferrer" class="panel-action-icon" title="Abrir carpeta en Drive"><svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" viewBox="0 0 512 512"><path fill="currentColor" d="M64 480H448c35.3 0 64-28.7 64-64V160c0-35.3-28.7-64-64-64H288c-10.1 0-19.6-4.7-25.6-12.8L243.2 57.6C231.1 41.5 212.1 32 192 32H64C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64z"/></svg></a>`;

    // Guardamos los datos completos en el panel para poder acceder a ellos fácilmente
    content.dataset.expediente = JSON.stringify(expediente);
    
    // Generamos la sección del cliente dinámicamente
    let clienteHtml = '';
    if (cliente.TipoPersona === 'Jurídica') {
        clienteHtml = `
            ${createEditableField('RazonSocial', cliente.RazonSocial, 'Clientes', 'Razón Social')}
            ${createEditableField('CIF', cliente.CIF, 'Clientes')}
            ${createEditableField('DireccionFiscal', cliente.DireccionFiscal, 'Clientes', 'Dirección Fiscal')}
            <h4 class="contact-person-header">Persona de Contacto</h4>
            ${createEditableField('Nombre', cliente.Nombre, 'Clientes')}${createEditableField('Apellido1', cliente.Apellido1, 'Clientes', 'Primer Apellido')}${createEditableField('Apellido2', cliente.Apellido2, 'Clientes', 'Segundo Apellido')}${createEditableField('Telefono', cliente.Telefono, 'Clientes')}${createEditableField('Email', cliente.Email, 'Clientes')}${createEditableField('NIF', cliente.NIF, 'Clientes')}
        `;
    } else { // Persona Física
        clienteHtml = `
            ${createEditableField('Nombre', cliente.Nombre, 'Clientes')}${createEditableField('Apellido1', cliente.Apellido1, 'Clientes', 'Primer Apellido')}${createEditableField('Apellido2', cliente.Apellido2, 'Clientes', 'Segundo Apellido')}${createEditableField('Telefono', cliente.Telefono, 'Clientes')}${createEditableField('Email', cliente.Email, 'Clientes')}${createEditableField('NIF', cliente.NIF, 'Clientes')}
        `;
    }

    let presupuestosHtml = '<p>Aún no hay ningún presupuesto creado.</p>';
    if (presupuestos && presupuestos.length > 0) {
        presupuestosHtml = '<ul class="presupuestos-list">';
        presupuestos.sort((a, b) => b.Version.localeCompare(a.Version)); // Ordenar de más nuevo a más viejo
        presupuestos.forEach(ppto => {
            const pdfUrl = `https://drive.google.com/file/d/${ppto.ID_PDF_Drive}/view`;
            presupuestosHtml += `
                <li>
                    <a href="${pdfUrl}" target="_blank" title="Abrir PDF">
                        <svg class="file-icon" xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 384 512"><path fill="currentColor" d="M0 64C0 28.7 28.7 0 64 0H224V128c0 17.7 14.3 32 32 32H384V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V64zm384 64H256V0L384 64z"/></svg>
                        Presupuesto Versión ${ppto.Version} (${ppto.FechaCreacion})
                    </a>
                </li>
            `;
        });
        presupuestosHtml += '</ul>';
    }

    // Componemos todo el HTML final del panel
    content.innerHTML = `
        <div class="detail-group">
            <h3>Expediente: ${expediente.ID_Expediente}</h3>
            <div class="detail-field special-edit" data-field-name="Encargo"><span class="field-label">Encargo:</span><span class="field-value">${expediente.Encargo || '<i>No establecido</i>'}</span></div>
            ${createEditableSelect('Estado', expediente.Estado, ['Sin presupuestar', 'Presupuestado', 'Aceptado', 'No aceptado'], 'Expedientes')}
        </div>
        <div class="detail-group">
            <h3>Cliente</h3>
            <div class="tipo-persona-selector-panel">
                <label><input type="radio" name="tipoPersonaPanel" value="Física" ${cliente.TipoPersona !== 'Jurídica' ? 'checked' : ''}> Persona Física</label>
                <label><input type="radio" name="tipoPersonaPanel" value="Jurídica" ${cliente.TipoPersona === 'Jurídica' ? 'checked' : ''}> Persona Jurídica</label>
            </div>
            <div class="client-fields-container">${clienteHtml}</div>
        </div>
        <div class="detail-group">
            <h3>Dirección</h3>
            <div class="detail-field special-edit" data-type="direccion-modal" data-field-name="DireccionCompleta"><span class="field-label">Dirección Completa:</span><span class="field-value">${expediente.DireccionCompleta || '<i>No establecido</i>'}</span></div>
        </div>
        <div class="detail-group">
            <h3>Presupuestos</h3>
            ${presupuestosHtml}
            <button class="btn-primary" onclick="iniciarNuevoPresupuesto()">Nuevo Presupuesto de Honorarios</button>
        </div>
    `;
}

function handlePanelChange(e) {
    if (e.target.name === 'tipoPersonaPanel') {
        const nuevoTipo = e.target.value;
        const panelContent = document.getElementById('detail-panel-content');
        
        // Mostramos un feedback visual inmediato
        panelContent.style.opacity = 0.5;
        panelContent.style.pointerEvents = 'none';

        // Llamamos al servidor para guardar el cambio
        google.script.run
            .withSuccessHandler(response => {
                // Una vez guardado, forzamos la recarga completa del panel para que se actualice la estructura
                openDetailPanel(currentExpedienteId);
                panelContent.style.opacity = 1;
                panelContent.style.pointerEvents = 'auto';
            })
            .withFailureHandler(error => {
                onError(error);
                // Si falla, también recargamos para volver al estado anterior
                openDetailPanel(currentExpedienteId);
                panelContent.style.opacity = 1;
                panelContent.style.pointerEvents = 'auto';
            })
            .updateExpedienteField(currentExpedienteId, 'Clientes', 'TipoPersona', nuevoTipo);
    }
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

async function handlePanelClick(e) {
    const fieldDiv = e.target.closest('.detail-field');
    if (!fieldDiv) return;

  const expedienteData = JSON.parse(document.getElementById('detail-panel-content').dataset.expediente || '{}');

    // Lógica para el modal de "Encargo" (no cambia)
    if (fieldDiv.classList.contains('special-edit')) {
        const fieldName = fieldDiv.dataset.fieldName;
        if (fieldName === 'Encargo') {
            const currentValue = fieldDiv.querySelector('.field-value').textContent;
            openEncargoModal(currentValue);
        } else if (fieldDiv.dataset.type === 'direccion-modal') {
            openDireccionModal(expedienteData);
        }
        return; // Salimos para no ejecutar la lógica de edición inline
    } 
    
    // Lógica para la edición inline normal
    if (e.target.classList.contains('field-value')) {
        const fieldName = fieldDiv.dataset.fieldName;
        const valueSpan = fieldDiv.querySelector('.field-value');
        const inputEl = fieldDiv.querySelector('.field-input');
        
        valueSpan.style.display = 'none';
        inputEl.style.display = 'inline-block';
        inputEl.focus();

        const originalValue = (fieldName === 'Estado') ? inputEl.value : valueSpan.textContent.trim();

        const saveChange = async () => {
            // Evitar guardar si no hay cambios
            if (inputEl.value.trim() === originalValue) {
                inputEl.style.display = 'none';
                valueSpan.style.display = 'inline';
                return;
            }
            
            inputEl.disabled = true;
            inputEl.style.opacity = 0.5;

            const newValue = inputEl.value;
            const sheetName = fieldDiv.dataset.sheetName;

            try {
                // Hacemos la llamada a google.script.run y la envolvemos en una Promesa para poder usar await
                const response = await new Promise((resolve, reject) => {
                    google.script.run
                        .withSuccessHandler(resolve)
                        .withFailureHandler(reject)
                        .updateExpedienteField(currentExpedienteId, sheetName, fieldName, newValue);
                });
                
                if(response.status === 'error') throw new Error(response.message);

                // Si todo va bien, actualizamos la UI
                inputEl.disabled = false;
                inputEl.style.opacity = 1;
                inputEl.style.display = 'none';

                if (fieldName === 'Estado') {
                    valueSpan.innerHTML = `<span class="badge ${'badge-' + (newValue || '').toLowerCase().replace(/\s+/g, '-')}">${newValue}</span>`;
                } else {
                    valueSpan.textContent = newValue || '<i>No establecido</i>';
                }
                valueSpan.style.display = 'inline';

                // Si la respuesta del servidor nos pide refrescar, lo hacemos
                if (response.refreshList) {
                    const data = await new Promise((resolve, reject) => {
                        google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getExpedientesParaListado();
                    });
                    onDataReceived(data);
                }

            } catch (error) {
                // Si hay un error, lo mostramos y revertimos la UI
                onError(error);
                inputEl.disabled = false;
                inputEl.style.opacity = 1;
                inputEl.style.display = 'none';
                
                // Devolvemos el valor original al span
                if (fieldName === 'Estado') {
                    valueSpan.innerHTML = `<span class="badge ${'badge-' + (originalValue || '').toLowerCase().replace(/\s+/g, '-')}">${originalValue}</span>`;
                } else {
                    valueSpan.textContent = originalValue;
                }
                valueSpan.style.display = 'inline';
            }
        };

        inputEl.onblur = saveChange;
        inputEl.onkeydown = (event) => {
            if (event.key === 'Enter') { event.preventDefault(); inputEl.blur(); } 
            else if (event.key === 'Escape') {
                inputEl.onblur = null;
                inputEl.style.display = 'none';
                valueSpan.style.display = 'inline';
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

function openDireccionModal(expediente) {
    const modal = document.getElementById('edit-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalSaveButton = document.getElementById('modal-save-button');

    modalTitle.textContent = 'Editar Dirección';
    modalBody.innerHTML = `
        <form id="form-direccion" class="config-form">
            <input type="text" name="TipoVia" placeholder="Tipo de Vía" value="${expediente.TipoVia || ''}" list="tipos-via-list" required>
            <datalist id="tipos-via-list"></datalist>
            <input type="text" name="NombreVia" placeholder="Nombre de la Vía" value="${expediente.NombreVia || ''}" required>
            <input type="text" name="Numero" placeholder="Nº" value="${expediente.Numero || ''}" required>
            <input type="text" name="PisoPuerta" placeholder="Piso, Puerta, Esc." value="${expediente.PisoPuerta || ''}">
            <input type="text" name="CP" placeholder="Código Postal" value="${expediente.CP || ''}" required>
            <input type="text" name="Localidad" placeholder="Localidad" value="${expediente.Localidad || ''}" required>
            <input type="text" name="Provincia" placeholder="Provincia" value="${expediente.Provincia || ''}" required>
        </form>
    `;
    
    populateTiposVia(); // Llenamos el datalist

    modalSaveButton.onclick = saveDireccionChanges;
    modal.style.display = 'flex';
}

async function saveDireccionChanges() {
    const form = document.getElementById('form-direccion');
    const addressData = {
        TipoVia: form.TipoVia.value,
        NombreVia: form.NombreVia.value,
        Numero: form.Numero.value,
        PisoPuerta: form.PisoPuerta.value,
        CP: form.CP.value,
        Localidad: form.Localidad.value,
        Provincia: form.Provincia.value
    };

    const modalSaveButton = document.getElementById('modal-save-button');
    modalSaveButton.disabled = true;
    modalSaveButton.textContent = 'Guardando...';

    try {
        const response = await new Promise((resolve, reject) => {
            google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).updateAddress(currentExpedienteId, addressData);
        });

        if (response.status === 'error') throw new Error(response.message);

        modalSaveButton.disabled = false;
        modalSaveButton.textContent = 'Guardar Cambios';
        closeModal();
        
        // Forzamos una recarga completa de los datos para ver los cambios en todos lados
        const data = await new Promise((resolve, reject) => {
            google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getExpedientesParaListado();
        });
        onDataReceived(data); // Refresca la tabla
        openDetailPanel(currentExpedienteId); // Refresca el panel

    } catch (error) {
        onError(error);
        modalSaveButton.disabled = false;
        modalSaveButton.textContent = 'Guardar Cambios';
    }
}

function populateTiposVia() {
    const tipos = ['Calle', 'Avenida', 'Plaza', 'Paseo', 'Carretera', 'Ronda', 'Travesía', 'Camino', 'Bulevar', 'Glorieta'];
    const datalist = document.getElementById('tipos-via-list');
    if(datalist) {
        datalist.innerHTML = '';
        tipos.forEach(tipo => {
            const option = document.createElement('option');
            option.value = tipo;
            datalist.appendChild(option);
        });
    }
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

/**
 * Inicia el proceso para crear un nuevo presupuesto. Llama al backend para obtener los datos del form.
 */
function iniciarNuevoPresupuesto() {
    const modal = document.getElementById('edit-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    modalTitle.textContent = 'Nuevo Presupuesto de Honorarios';
    modalBody.innerHTML = '<p class="loader">Cargando configuración...</p>';
    modal.style.display = 'flex';

    google.script.run
        .withSuccessHandler(openPresupuestoModal)
        .withFailureHandler(onError)
        .getDatosParaNuevoPresupuesto(currentExpedienteId);
}

/**
 * Construye y muestra el formulario de nuevo presupuesto con los datos recibidos del servidor.
 * @param {Object} data - El objeto con los datos de trabajos y formas de pago.
 */
function openPresupuestoModal(data) {
    if (data.error) {
        onError(new Error(data.error));
        return;
    }

    const modalBody = document.getElementById('modal-body');
    const modalSaveButton = document.getElementById('modal-save-button');
    
    // Construimos los fieldsets para los conceptos incluidos y no incluidos
    let trabajosHtml = data.trabajos.map(trabajo => {
        let incluidosCheckboxes = trabajo.incluidos.map(concepto => `
            <label class="modal-checkbox-label"><input type="checkbox" name="incluido_${trabajo.nombre}" value="${concepto}" checked> ${concepto}</label>
        `).join('');
        
        let noIncluidosCheckboxes = trabajo.noIncluidos.map(concepto => `
            <label class="modal-checkbox-label"><input type="checkbox" name="no_incluido_${trabajo.nombre}" value="${concepto}" checked> ${concepto}</label>
        `).join('');

        return `
            <fieldset class="trabajo-fieldset">
                <legend>${trabajo.nombre}</legend>
                <h4>Conceptos Incluidos</h4>
                <div class="checkbox-grid">${incluidosCheckboxes}</div>
                <h4 style="margin-top: 1rem;">Conceptos NO Incluidos</h4>
                <div class="checkbox-grid">${noIncluidosCheckboxes}</div>
            </fieldset>
        `;
    }).join('');

    // Construimos las opciones para el select de forma de pago
    let formasPagoOptions = data.formasDePago.map(forma => `<option value="${forma}">${forma}</option>`).join('');

    // Montamos el formulario completo
    modalBody.innerHTML = `
        <form id="form-presupuesto" class="config-form">
            <label for="tipologia">Tipología del encargo:</label>
            <input type="text" id="tipologia" name="tipologia" placeholder="Ej: Vivienda unifamiliar, reforma de local..." required>
            
            <label for="descripcion" style="margin-top:1rem;">Descripción del presupuesto:</label>
            <textarea id="descripcion" name="descripcion" required></textarea>

            <div style="margin-top:1rem;">${trabajosHtml}</div>

            <label for="formaDePago" style="margin-top:1rem;">Forma de Pago:</label>
            <select id="formaDePago" name="formaDePago">${formasPagoOptions}</select>
        </form>
    `;

    modalSaveButton.textContent = 'Generar Presupuesto';
    modalSaveButton.onclick = handleGenerarPresupuesto; // Esta función la crearemos en el siguiente paso
}

/**
 * Placeholder para la función que generará el presupuesto.
 */
async function handleGenerarPresupuesto() {
    const form = document.getElementById('form-presupuesto');
    if (!form.reportValidity()) return;

    const modalSaveButton = document.getElementById('modal-save-button');
    modalSaveButton.disabled = true;
    modalSaveButton.textContent = 'Generando...';

    // 1. Recoger datos simples del formulario
    const tipologia = form.tipologia.value;
    const descripcion = form.descripcion.value;
    const formaDePago = form.formaDePago.value;
    
    // 2. --- ¡NUEVA LÓGICA! Recoger conceptos de forma estructurada ---
    const conceptosPorEncargo = [];
    const trabajoFieldsets = form.querySelectorAll('.trabajo-fieldset');
    
    trabajoFieldsets.forEach(fieldset => {
        const encargoNombre = fieldset.querySelector('legend').textContent;
        const incluidos = Array.from(fieldset.querySelectorAll('input[name^="incluido_"]:checked')).map(cb => cb.value);
        const noIncluidos = Array.from(fieldset.querySelectorAll('input[name^="no_incluido_"]:checked')).map(cb => cb.value);
        
        // Solo añadimos el encargo si tiene algún concepto seleccionado
        if (incluidos.length > 0 || noIncluidos.length > 0) {
            conceptosPorEncargo.push({
                nombre: encargoNombre,
                incluidos: incluidos,
                noIncluidos: noIncluidos
            });
        }
    });

    // El objeto que enviamos al backend ahora contiene la nueva estructura
    const formData = { 
        idExpediente: currentExpedienteId, 
        tipologia, 
        descripcion, 
        conceptos: conceptosPorEncargo, // Usamos la nueva estructura
        formaDePago 
    };

    // 3. Llamar al backend (sin cambios en esta parte)
    try {
        const response = await new Promise((resolve, reject) => {
            google.script.run
                .withSuccessHandler(resolve)
                .withFailureHandler(reject)
                .crearPresupuestoYGenerarPDF(formData);
        });

        if (response.status === 'error') throw new Error(response.message);
        
        alert(response.message);
        window.open(response.pdfUrl, '_blank');
        closeModal();
        openDetailPanel(currentExpedienteId);

    } catch (error) {
        onError(error);
    } finally {
        modalSaveButton.disabled = false;
        modalSaveButton.textContent = 'Generar Presupuesto';
    }
}
