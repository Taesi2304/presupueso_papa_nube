
const SUPABASE_URL = 'https://wjnsfxpmndbkyytlynjk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqbnNmeHBtbmRia3l5dGx5bmprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MjQ1NTksImV4cCI6MjA5MTIwMDU1OX0.lUreFgivwsa3hG3rHNObschcuXa2nQPR3fMhAOzkqqA';

// Inicializamos el cliente (Le cambiamos el nombre a clienteSupabase para evitar el error)
const clienteSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let presupuestoActual = [];
let conceptoTemporal = null;
let mapaAreas = {};


// --- NUEVA LÓGICA DE SEGURIDAD (LOGIN) ---
async function verificarSesion() {
    const { data: { session } } = await clienteSupabase.auth.getSession();

    if (session) {
        // Si hay sesión, ocultar login y mostrar app
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        inicializarDatos(); // Cargar los datos de la base
    } else {
        // Si no hay sesión, mostrar login y ocultar app
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
    }

}

async function iniciarSesion() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorMsg = document.getElementById('loginError');

    errorMsg.style.display = 'none';

    if (!email || !password) {
        errorMsg.innerText = "Ingresa correo y contraseña.";
        errorMsg.style.display = 'block';
        return;
    }

    const { data, error } = await clienteSupabase.auth.signInWithPassword({ email, password });

    if (error) {
        errorMsg.innerText = "Credenciales incorrectas.";
        errorMsg.style.display = 'block';
    } else {
        // Login exitoso, borrar campos y verificar
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
        verificarSesion();
    }
}

async function cerrarSesion() {
    await clienteSupabase.auth.signOut();
    verificarSesion();
}

// 2. INICIO DE LA APLICACIÓN (Súper Optimizado)
async function inicializarDatos() {
    // 1. Hacemos UN SOLO VIAJE a la nube para traer las áreas
    const { data: areas, error } = await clienteSupabase.from('areas').select('*').order('id', { ascending: true });

    if (error) { alert("Error de conexión: " + error.message); return; }

    // 2. Guardamos en la memoria rápida
    mapaAreas = {};
    areas.forEach(a => mapaAreas[a.id] = a.nombre);

    // 3. Llenamos los 3 menús al mismo tiempo, sin usar internet
    llenarMenuDesplegable('selArea', areas, 'Seleccione Área...');
    llenarMenuDesplegable('catArea', areas, 'Seleccione Área...');
    llenarMenuDesplegable('filtroAreaCatalogo', areas, 'Todas las Áreas...');

    document.getElementById('fechaPresupuesto').valueAsDate = new Date();

    // 4. Traemos los conceptos para la tabla
    await cargarTablaCatalogo();
}

// Función auxiliar que recicla los datos para que cargue instantáneo
function llenarMenuDesplegable(selectId, areas, textoDefault) {
    const select = document.getElementById(selectId);
    select.innerHTML = `<option value="">${textoDefault}</option>`;
    areas.forEach(a => select.innerHTML += `<option value="${a.id}">${a.nombre}</option>`);
}



// --- FUNCIONES DE PESTAÑAS ---
function cambiarPestana(pestana) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('tab-' + pestana).classList.add('active');
    event.currentTarget.classList.add('active');
}

// --- LÓGICA DE ÁREAS Y CONCEPTOS ---
async function cargarAreas(selectId) {
    const { data: areas, error } = await clienteSupabase.from('areas').select('*').order('id', { ascending: true });

    if (error) { alert("Error al cargar áreas: " + error.message); return; }

    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">Seleccione Área...</option>';

    areas.forEach(a => {
        select.innerHTML += `<option value="${a.id}">${a.nombre}</option>`;
        mapaAreas[a.id] = a.nombre;
    });
}

async function cargarFiltroCatalogo() {
    const { data: areas } = await clienteSupabase.from('areas').select('*').order('id', { ascending: true });
    const select = document.getElementById('filtroAreaCatalogo');
    select.innerHTML = '<option value="">Mostrar Todas las Áreas...</option>';
    areas.forEach(a => select.innerHTML += `<option value="${a.id}">${a.nombre}</option>`);
}

async function cargarConceptos(origenId, destinoId) {
    const idArea = parseInt(document.getElementById(origenId).value);
    const select = document.getElementById(destinoId);
    select.innerHTML = '<option value="">Seleccione Concepto...</option>';
    limpiarInputsPresupuesto();

    if (!idArea) return;

    const { data: conceptos, error } = await clienteSupabase
        .from('conceptos')
        .select('*')
        .eq('id_area', idArea)
        .order('orden', { ascending: true });

    if (error) { console.error(error); return; }

    conceptos.forEach(c => select.innerHTML += `<option value="${c.id}">${c.concepto}</option>`);
}

async function prepararConcepto() {
    const idCon = parseInt(document.getElementById('selConcepto').value);
    if (!idCon) { limpiarInputsPresupuesto(); return; }

    const { data, error } = await clienteSupabase.from('conceptos').select('*').eq('id', idCon).single();

    if (error || !data) return;

    conceptoTemporal = data;
    document.getElementById('txtUnidad').value = conceptoTemporal.unidad;
    document.getElementById('txtPrecio').value = conceptoTemporal.precio_total;
    document.getElementById('txtCantidad').focus();
}

function limpiarInputsPresupuesto() {
    conceptoTemporal = null;
    document.getElementById('txtUnidad').value = 'm2';
    document.getElementById('txtPrecio').value = '';
    document.getElementById('txtCantidad').value = '';
}

// --- LÓGICA DEL PRESUPUESTO ---
function agregarAlPresupuesto() {
    const conceptoSelect = document.getElementById('selConcepto');
    const textoConcepto = conceptoSelect.options[conceptoSelect.selectedIndex].text;
    const unidad = document.getElementById('txtUnidad').value;
    const precioUnitario = parseFloat(document.getElementById('txtPrecio').value);
    const cantidad = parseFloat(document.getElementById('txtCantidad').value);

    if (!conceptoTemporal || isNaN(cantidad) || isNaN(precioUnitario) || cantidad <= 0) {
        alert("Asegúrate de seleccionar un concepto y poner cantidad y precio válidos.");
        return;
    }

    presupuestoActual.push({
        id: Date.now(),
        concepto: textoConcepto,
        unidad: unidad,
        cantidad: cantidad,
        precioUnitario: precioUnitario,
        importe: cantidad * precioUnitario
    });

    limpiarInputsPresupuesto();
    document.getElementById('selConcepto').value = '';
    actualizarTabla();
}

function eliminarFila(id) {
    presupuestoActual = presupuestoActual.filter(item => item.id !== id);
    actualizarTabla();
}

function actualizarTabla() {
    const tbody = document.getElementById('tablaPresupuesto');
    tbody.innerHTML = '';
    let subtotalPuro = 0;

    presupuestoActual.forEach(item => {
        subtotalPuro += item.importe;
        tbody.innerHTML += `
            <tr>
                <td>${item.concepto}</td>
                <td>${item.unidad}</td>
                <td>${item.cantidad}</td>
                <td>$${item.precioUnitario.toFixed(2)}</td>
                <td>$${item.importe.toFixed(2)}</td>
                <td class="no-print"><button class="btn-danger" onclick="eliminarFila(${item.id})">X</button></td>
            </tr>
        `;
    });

    let importeHerramienta = 0;
    if (document.getElementById('checkDesgaste').checked && subtotalPuro > 0) {
        importeHerramienta = subtotalPuro * 0.05;
        tbody.innerHTML += `
            <tr class="fila-herramienta">
                <td>Cargo por Herramienta Menor (5% de M.O.)</td>
                <td>lote</td>
                <td>1</td>
                <td>$${importeHerramienta.toFixed(2)}</td>
                <td>$${importeHerramienta.toFixed(2)}</td>
                <td class="no-print">Auto</td>
            </tr>
        `;
    }

    const granTotal = subtotalPuro + importeHerramienta;
    document.getElementById('lblTotal').innerText = granTotal.toFixed(2);
}

// --- LÓGICA DE ADMINISTRACIÓN DE CATÁLOGO ---
async function guardarNuevoConcepto() {
    const idArea = parseInt(document.getElementById('catArea').value);
    const nombre = document.getElementById('catNombre').value;
    const unidad = document.getElementById('catUnidad').value;
    const precio = parseFloat(document.getElementById('catPrecio').value);

    if (!idArea || !nombre || isNaN(precio)) {
        alert("Completa todos los campos para guardar el concepto.");
        return;
    }

    const { data: conceptosArea } = await clienteSupabase.from('conceptos').select('orden').eq('id_area', idArea);
    let maxOrden = 0;
    if (conceptosArea) {
        conceptosArea.forEach(c => { if (c.orden > maxOrden) maxOrden = c.orden; });
    }

    const { error } = await clienteSupabase.from('conceptos').insert([
        { id_area: idArea, concepto: nombre, unidad: unidad, precio_total: precio, orden: maxOrden + 1 }
    ]);

    if (error) { alert("Error al guardar: " + error.message); return; }

    alert("¡Concepto guardado en la nube con éxito!");
    document.getElementById('catNombre').value = '';
    document.getElementById('catPrecio').value = '';

    document.getElementById('filtroAreaCatalogo').value = idArea;
    await cargarTablaCatalogo();

    if (document.getElementById('selArea').value == idArea) {
        await cargarConceptos('selArea', 'selConcepto');
    }
}

async function moverConcepto(idConcepto, direccion) {
    const { data: conceptoActual } = await clienteSupabase.from('conceptos').select('*').eq('id', idConcepto).single();
    const { data: todosArea } = await clienteSupabase.from('conceptos').select('*').eq('id_area', conceptoActual.id_area).order('orden', { ascending: true });

    const index = todosArea.findIndex(c => c.id === idConcepto);

    if (direccion === 'arriba' && index > 0) {
        const conceptoAnterior = todosArea[index - 1];
        await clienteSupabase.from('conceptos').update({ orden: conceptoAnterior.orden }).eq('id', conceptoActual.id);
        await clienteSupabase.from('conceptos').update({ orden: conceptoActual.orden }).eq('id', conceptoAnterior.id);
    }
    else if (direccion === 'abajo' && index < todosArea.length - 1) {
        const conceptoSiguiente = todosArea[index + 1];
        await clienteSupabase.from('conceptos').update({ orden: conceptoSiguiente.orden }).eq('id', conceptoActual.id);
        await clienteSupabase.from('conceptos').update({ orden: conceptoActual.orden }).eq('id', conceptoSiguiente.id);
    }

    await cargarTablaCatalogo();
    if (document.getElementById('selArea').value == conceptoActual.id_area) {
        await cargarConceptos('selArea', 'selConcepto');
    }
}

async function cargarTablaCatalogo() {
    let query = clienteSupabase.from('conceptos').select('*').order('id_area', { ascending: true }).order('orden', { ascending: true });

    const idFiltro = parseInt(document.getElementById('filtroAreaCatalogo').value);
    if (idFiltro) {
        query = query.eq('id_area', idFiltro);
    }

    const { data: conceptos, error } = await query;
    if (error) { console.error(error); return; }

    const tbody = document.getElementById('tablaCatalogo');
    tbody.innerHTML = '';

    conceptos.forEach(c => {
        const nombreArea = mapaAreas[c.id_area] || 'Desconocido';
        tbody.innerHTML += `
            <tr>
                <td style="font-size: 0.9em; color: #666;">${nombreArea}</td>
                <td><strong>${c.concepto}</strong></td>
                <td>${c.unidad}</td>
                <td>$${c.precio_total.toFixed(2)}</td>
                <td style="display:flex; gap: 5px;">
                    <button class="btn-edit" style="background:#7f8fa6;" onclick="moverConcepto(${c.id}, 'arriba')" title="Mover Arriba">🔼</button>
                    <button class="btn-edit" style="background:#7f8fa6;" onclick="moverConcepto(${c.id}, 'abajo')" title="Mover Abajo">🔽</button>
                    <button class="btn-edit" onclick="editarPrecio(${c.id}, '${c.concepto}', ${c.precio_total})">✏️</button>
                    <button class="btn-danger" onclick="borrarConcepto(${c.id})">🗑️</button>
                </td>
            </tr>
        `;
    });
}

async function editarPrecio(id, nombre, precioViejo) {
    const nuevoPrecio = prompt(`Ingresa el nuevo precio para:\n${nombre}`, precioViejo);
    if (nuevoPrecio !== null && nuevoPrecio !== "" && !isNaN(nuevoPrecio)) {
        await clienteSupabase.from('conceptos').update({ precio_total: parseFloat(nuevoPrecio) }).eq('id', id);
        await cargarTablaCatalogo();
    }
}

async function borrarConcepto(id) {
    if (confirm("¿Estás seguro de borrar este concepto de la nube?")) {
        await clienteSupabase.from('conceptos').delete().eq('id', id);
        await cargarTablaCatalogo();
    }
}

window.onload = inicializarDatos;


// --- LÓGICA DE CLIENTES ---

async function cargarClientes() {
    const { data: clientes, error } = await clienteSupabase.from('clientes').select('*').order('nombre');
    if (error) return;

    // Llenar tabla de clientes
    const tbody = document.getElementById('tablaClientes');
    tbody.innerHTML = '';
    clientes.forEach(c => {
        tbody.innerHTML += `
            <tr>
                <td>${c.nombre}</td>
                <td>${c.telefono || '-'}</td>
                <td>${c.direccion || '-'}</td>
                <td><button class="btn-danger" onclick="borrarCliente(${c.id})">🗑️</button></td>
            </tr>`;
    });

    // Llenar el select en la pestaña de presupuestos
    const select = document.getElementById('selClientePresupuesto');
    select.innerHTML = '<option value="">-- Seleccionar Cliente --</option>';
    clientes.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
    });
}

async function guardarCliente() {
    const nombre = document.getElementById('cliNombre').value;
    const tel = document.getElementById('cliTelefono').value;
    const dir = document.getElementById('cliDireccion').value;

    if (!nombre) return alert("El nombre es obligatorio");

    await clienteSupabase.from('clientes').insert([{ nombre, telefono: tel, direccion: dir }]);
    document.getElementById('cliNombre').value = '';
    document.getElementById('cliTelefono').value = '';
    document.getElementById('cliDireccion').value = '';
    cargarClientes();
}

async function borrarCliente(id) {
    if (confirm("¿Borrar cliente? Se perderá su historial.")) {
        await clienteSupabase.from('clientes').delete().eq('id', id);
        cargarClientes();
    }
}

// --- LÓGICA DE HISTORIAL Y GUARDADO ---

async function guardarEImprimir() {
    const idCliente = document.getElementById('selClientePresupuesto').value;
    const fecha = document.getElementById('fechaPresupuesto').value;
    const total = parseFloat(document.getElementById('lblTotal').innerText);

    if (!idCliente || presupuestoActual.length === 0) {
        return alert("Selecciona un cliente y agrega conceptos antes de guardar.");
    }

    // 1. Guardar en la tabla 'presupuestos'
    const { error } = await clienteSupabase.from('presupuestos').insert([
        { id_cliente: idCliente, fecha: fecha, total: total, subtotal: total }
    ]);

    if (error) {
        alert("Error al guardar en el historial: " + error.message);
    } else {
        alert("¡Presupuesto guardado en el historial!");
        cargarHistorial(); // Actualizar la lista
        window.print();    // Abrir ventana de impresión
    }
}

async function cargarHistorial() {
    // Traemos presupuestos y hacemos un "join" automático con clientes para traer el nombre
    const { data: historial, error } = await clienteSupabase
        .from('presupuestos')
        .select(`id, fecha, total, clientes(nombre)`)
        .order('fecha', { ascending: false });

    if (error) return;

    const tbody = document.getElementById('tablaHistorial');
    tbody.innerHTML = '';
    historial.forEach(p => {
        tbody.innerHTML += `
            <tr>
                <td>${p.fecha}</td>
                <td>${p.clientes ? p.clientes.nombre : 'Sin nombre'}</td>
                <td>$${p.total.toFixed(2)}</td>
                <td><button class="btn-danger" onclick="borrarPresupuesto(${p.id})">🗑️</button></td>
            </tr>`;
    });
}

async function borrarPresupuesto(id) {
    if (confirm("¿Eliminar este registro del historial?")) {
        await clienteSupabase.from('presupuestos').delete().eq('id', id);
        cargarHistorial();
    }
}

// Modifica tu inicializarDatos para que cargue todo al principio
async function inicializarDatos() {
    const { data: areas } = await clienteSupabase.from('areas').select('*').order('id');
    mapaAreas = {};
    areas.forEach(a => mapaAreas[a.id] = a.nombre);

    llenarMenuDesplegable('selArea', areas, 'Seleccione Área...');
    llenarMenuDesplegable('catArea', areas, 'Seleccione Área...');
    llenarMenuDesplegable('filtroAreaCatalogo', areas, 'Todas las Áreas...');

    await cargarClientes(); // <--- Nueva
    await cargarHistorial(); // <--- Nueva
    await cargarTablaCatalogo();
    document.getElementById('fechaPresupuesto').valueAsDate = new Date();
}
