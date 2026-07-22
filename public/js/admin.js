let adminProducts = [];
let adminOrders = [];
let editingProductId = null;
let activeAdminTab = "products";
let pendingExtraImages = [];

const loginSection = document.getElementById("login-section");
const adminSection = document.getElementById("admin-section");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const adminMessage = document.getElementById("admin-message");
const ordersMessage = document.getElementById("orders-message");
const productsTableBody = document.getElementById("products-table-body");
const ordersTableBody = document.getElementById("orders-table-body");
const productModal = document.getElementById("product-modal");
const orderModal = document.getElementById("order-modal");
const productForm = document.getElementById("product-form");

document.addEventListener("DOMContentLoaded", initAdmin);

function initAdmin() {
    bindEvents();

    if (!isSupabaseConfigured() || !supabaseClient) {
        showLoginError("Error de configuración: revisa supabase-config.js con tu URL y clave de Supabase.");
        return;
    }

    checkSession();
}

function bindEvents() {
    loginForm.addEventListener("submit", handleLogin);
    document.getElementById("logout-button").addEventListener("click", handleLogout);
    document.getElementById("add-product-button").addEventListener("click", () => openProductModal());
    document.getElementById("close-modal").addEventListener("click", closeProductModal);
    document.getElementById("cancel-form").addEventListener("click", closeProductModal);
    document.getElementById("tab-products").addEventListener("click", () => switchAdminTab("products"));
    document.getElementById("tab-orders").addEventListener("click", () => switchAdminTab("orders"));
    document.getElementById("refresh-orders-button").addEventListener("click", loadAdminOrders);
    document.getElementById("close-order-modal").addEventListener("click", closeOrderModal);
    productForm.addEventListener("submit", handleSaveProduct);

    productModal.addEventListener("click", (event) => {
        if (event.target === productModal) {
            closeProductModal();
        }
    });

    orderModal.addEventListener("click", (event) => {
        if (event.target === orderModal) {
            closeOrderModal();
        }
    });
}

async function checkSession() {
    const { data } = await supabaseClient.auth.getSession();

    if (data.session) {
        showAdminPanel(data.session.user.email);
        await loadAdminProducts();
        await loadAdminOrders();
    } else {
        showLoginPanel();
    }
}

async function handleLogin(event) {
    event.preventDefault();
    hideLoginError();

    if (!supabaseClient) {
        showLoginError("No hay conexión con Supabase. Revisa supabase-config.js.");
        return;
    }

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const submitButton = loginForm.querySelector('button[type="submit"]');

    submitButton.disabled = true;
    submitButton.textContent = "Iniciando sesión...";

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    submitButton.disabled = false;
    submitButton.textContent = "Iniciar sesión";

    if (error) {
        console.error("Error de login:", error.message);
        showLoginError("Correo o contraseña incorrectos.");
        return;
    }

    showAdminPanel(data.user.email);
    await loadAdminProducts();
    await loadAdminOrders();
}

async function handleLogout() {
    await supabaseClient.auth.signOut();
    adminProducts = [];
    showLoginPanel();
    loginForm.reset();
}

function showLoginPanel() {
    loginSection.classList.remove("hidden");
    adminSection.classList.add("hidden");
}

function showAdminPanel(email) {
    loginSection.classList.add("hidden");
    adminSection.classList.remove("hidden");
    document.getElementById("admin-user-email").textContent = email;
}

function showLoginError(message) {
    loginError.textContent = message;
    loginError.classList.remove("hidden");
}

function hideLoginError() {
    loginError.classList.add("hidden");
}

function showAdminMessage(message, type = "success") {
    adminMessage.textContent = message;
    adminMessage.className = `admin-message ${type}`;
    adminMessage.classList.remove("hidden");

    setTimeout(() => {
        adminMessage.classList.add("hidden");
    }, 4000);
}

function showOrdersMessage(message, type = "success") {
    ordersMessage.textContent = message;
    ordersMessage.className = `admin-message ${type}`;
    ordersMessage.classList.remove("hidden");

    setTimeout(() => {
        ordersMessage.classList.add("hidden");
    }, 4000);
}

function switchAdminTab(tab) {
    activeAdminTab = tab;

    document.getElementById("tab-products").classList.toggle("active", tab === "products");
    document.getElementById("tab-orders").classList.toggle("active", tab === "orders");
    document.getElementById("products-panel").classList.toggle("hidden", tab !== "products");
    document.getElementById("orders-panel").classList.toggle("hidden", tab !== "orders");
}

function formatDate(dateString) {
    return new Intl.DateTimeFormat("es-ES", {
        dateStyle: "short",
        timeStyle: "short"
    }).format(new Date(dateString));
}

function formatAddress(address) {
    if (!address) return "No indicada";

    if (typeof address === "string") {
        try {
            address = JSON.parse(address);
        } catch {
            return address;
        }
    }

    const parts = [
        address.line1,
        address.line2,
        [address.postal_code, address.city].filter(Boolean).join(" "),
        address.state,
        address.country
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(", ") : "No indicada";
}

async function loadAdminOrders() {
    ordersTableBody.innerHTML = `
        <tr>
            <td colspan="7" class="loading-cell">Cargando pedidos...</td>
        </tr>
    `;

    const { data, error } = await supabaseClient
        .from("pedidos")
        .select(`
            id,
            created_at,
            customer_email,
            customer_name,
            total_amount,
            status,
            metodo_pago,
            pago_confirmado,
            shipping_address,
            pedido_items (
                producto_id,
                nombre,
                precio_unitario,
                cantidad
            )
        `)
        .order("created_at", { ascending: false });

    if (error) {
        ordersTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="loading-cell">Error al cargar pedidos. ¿Has ejecutado la migración SQL?</td>
            </tr>
        `;
        showOrdersMessage("No se pudieron cargar los pedidos.", "error");
        return;
    }

    adminOrders = data;
    renderAdminOrders();
}

function getMetodoPagoLabel(metodoPago) {
    if (metodoPago === "bizum") return "Bizum";
    if (metodoPago === "transferencia") return "Transferencia";
    return "Tarjeta";
}

function getPagoConfirmadoBadge(pedido) {
    if (pedido.pago_confirmado) {
        return '<span class="status-badge status-active">Confirmado</span>';
    }

    return '<span class="status-badge status-pending">Pendiente</span>';
}

function renderAdminOrders() {
    if (adminOrders.length === 0) {
        ordersTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="loading-cell">Todavía no hay pedidos registrados.</td>
            </tr>
        `;
        return;
    }

    ordersTableBody.innerHTML = adminOrders.map((pedido) => `
        <tr>
            <td>#${pedido.id}</td>
            <td>${formatDate(pedido.created_at)}</td>
            <td>
                <strong>${pedido.customer_name ?? "Sin nombre"}</strong><br>
                <span class="table-subtext">${pedido.customer_email ?? "Sin email"}</span>
            </td>
            <td>${formatPrice(pedido.total_amount)}</td>
            <td>${getMetodoPagoLabel(pedido.metodo_pago)}</td>
            <td>${getPagoConfirmadoBadge(pedido)}</td>
            <td>
                <div class="table-actions">
                    <button class="btn-secondary btn-small" data-action="view-order" data-id="${pedido.id}">
                        Ver detalle
                    </button>
                    ${!pedido.pago_confirmado ? `
                        <button class="btn-primary btn-small" data-action="confirm-payment" data-id="${pedido.id}">
                            Confirmar pago
                        </button>
                    ` : ""}
                </div>
            </td>
        </tr>
    `).join("");

    ordersTableBody.querySelectorAll("[data-action='view-order']").forEach((button) => {
        button.addEventListener("click", () => {
            const pedido = adminOrders.find((item) => item.id === Number(button.dataset.id));
            openOrderModal(pedido);
        });
    });

    ordersTableBody.querySelectorAll("[data-action='confirm-payment']").forEach((button) => {
        button.addEventListener("click", () => {
            confirmOrderPayment(Number(button.dataset.id));
        });
    });
}

function formatOrderItemLabel(item) {
    if (item.producto_id) {
        return `#${item.producto_id} · ${item.nombre}`;
    }

    return item.nombre;
}

function openOrderModal(pedido) {
    if (!pedido) return;

    const confirmButtonHtml = !pedido.pago_confirmado
        ? `<button class="btn-primary" type="button" id="confirm-payment-modal" data-id="${pedido.id}">
                Confirmar pago
           </button>`
        : "";

    document.getElementById("order-modal-title").textContent = `Pedido #${pedido.id}`;
    document.getElementById("order-modal-body").innerHTML = `
        <p><strong>Fecha:</strong> ${formatDate(pedido.created_at)}</p>
        <p><strong>Cliente:</strong> ${pedido.customer_name ?? "Sin nombre"}</p>
        <p><strong>Email:</strong> ${pedido.customer_email ?? "Sin email"}</p>
        <p><strong>Método de pago:</strong> ${getMetodoPagoLabel(pedido.metodo_pago)}</p>
        <p><strong>Estado del pago:</strong> ${pedido.pago_confirmado ? "Confirmado" : "Pendiente de confirmar"}</p>
        <p><strong>Total:</strong> ${formatPrice(pedido.total_amount)}</p>
        <p><strong>Dirección de envío:</strong><br>${formatAddress(pedido.shipping_address)}</p>
        <h3>Productos</h3>
        <ul class="order-detail-list">
            ${(pedido.pedido_items ?? []).map((item) => `
                <li>
                    ${formatOrderItemLabel(item)}
                    <span>${item.cantidad} × ${formatPrice(item.precio_unitario)}</span>
                </li>
            `).join("")}
        </ul>
        <div class="order-modal-actions">
            ${confirmButtonHtml}
        </div>
    `;

    const confirmButton = document.getElementById("confirm-payment-modal");
    if (confirmButton) {
        confirmButton.addEventListener("click", () => {
            confirmOrderPayment(Number(confirmButton.dataset.id));
        });
    }

    orderModal.classList.remove("hidden");
}

async function confirmOrderPayment(orderId) {
    const pedido = adminOrders.find((item) => item.id === orderId);
    if (!pedido || pedido.pago_confirmado) return;

    const methodLabel = getMetodoPagoLabel(pedido.metodo_pago).toLowerCase();
    const confirmed = confirm(
        `¿Confirmas que has recibido el pago del pedido #${orderId} (${methodLabel})?`
    );
    if (!confirmed) return;

    const { error } = await supabaseClient
        .from("pedidos")
        .update({
            pago_confirmado: true,
            status: "pagado"
        })
        .eq("id", orderId);

    if (error) {
        showOrdersMessage("No se pudo confirmar el pago.", "error");
        return;
    }

    closeOrderModal();
    showOrdersMessage(`Pago del pedido #${orderId} confirmado.`);
    await loadAdminOrders();
}

function closeOrderModal() {
    orderModal.classList.add("hidden");
}

async function loadAdminProducts() {
        productsTableBody.innerHTML = `
            <tr>
                <td colspan="8" class="loading-cell">Cargando productos...</td>
            </tr>
        `;

    const { data, error } = await supabaseClient
        .from("productos")
        .select("*")
        .order("orden", { ascending: true })
        .order("id", { ascending: false });

    if (error) {
        productsTableBody.innerHTML = `
            <tr>
                <td colspan="8" class="loading-cell">Error al cargar productos.</td>
            </tr>
        `;
        showAdminMessage("No se pudieron cargar los productos.", "error");
        return;
    }

    adminProducts = data;
    renderAdminProducts();
}

function renderAdminProducts() {
    if (adminProducts.length === 0) {
        productsTableBody.innerHTML = `
            <tr>
                <td colspan="8" class="loading-cell">No hay productos. Añade el primero.</td>
            </tr>
        `;
        return;
    }

    productsTableBody.innerHTML = adminProducts.map((producto, index) => `
        <tr>
            <td>
                <div class="order-controls">
                    <button
                        class="btn-icon"
                        type="button"
                        data-action="move-up"
                        data-id="${producto.id}"
                        aria-label="Subir ${producto.nombre}"
                        ${index === 0 ? "disabled" : ""}
                    >↑</button>
                    <button
                        class="btn-icon"
                        type="button"
                        data-action="move-down"
                        data-id="${producto.id}"
                        aria-label="Bajar ${producto.nombre}"
                        ${index === adminProducts.length - 1 ? "disabled" : ""}
                    >↓</button>
                </div>
            </td>
            <td><strong>#${producto.id}</strong></td>
            <td>
                <img src="${producto.imagen}" alt="${producto.alt}" class="table-image">
            </td>
            <td>${producto.nombre}</td>
            <td>${producto.categoria}</td>
            <td>${formatPrice(producto.precio)}</td>
            <td>
                <span class="status-badge ${producto.activo ? "status-active" : "status-inactive"}">
                    ${producto.activo ? "Visible" : "Oculto"}
                </span>
            </td>
            <td>
                <div class="table-actions">
                    <button class="btn-secondary btn-small" data-action="edit" data-id="${producto.id}">
                        Editar
                    </button>
                    <button class="btn-danger btn-small" data-action="delete" data-id="${producto.id}">
                        Eliminar
                    </button>
                </div>
            </td>
        </tr>
    `).join("");

    productsTableBody.querySelectorAll("[data-action='move-up']").forEach((button) => {
        button.addEventListener("click", () => moveProduct(Number(button.dataset.id), "up"));
    });

    productsTableBody.querySelectorAll("[data-action='move-down']").forEach((button) => {
        button.addEventListener("click", () => moveProduct(Number(button.dataset.id), "down"));
    });

    productsTableBody.querySelectorAll("[data-action='edit']").forEach((button) => {
        button.addEventListener("click", () => {
            const producto = adminProducts.find((item) => item.id === Number(button.dataset.id));
            openProductModal(producto);
        });
    });

    productsTableBody.querySelectorAll("[data-action='delete']").forEach((button) => {
        button.addEventListener("click", () => deleteProduct(Number(button.dataset.id)));
    });
}

async function moveProduct(productId, direction) {
    const currentIndex = adminProducts.findIndex((item) => item.id === productId);

    if (currentIndex === -1) {
        return;
    }

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= adminProducts.length) {
        return;
    }

    const currentProduct = adminProducts[currentIndex];
    const targetProduct = adminProducts[targetIndex];

    const [{ error: currentError }, { error: targetError }] = await Promise.all([
        supabaseClient
            .from("productos")
            .update({ orden: targetProduct.orden })
            .eq("id", currentProduct.id),
        supabaseClient
            .from("productos")
            .update({ orden: currentProduct.orden })
            .eq("id", targetProduct.id)
    ]);

    if (currentError || targetError) {
        showAdminMessage("No se pudo cambiar el orden del producto.", "error");
        return;
    }

    await loadAdminProducts();
}

function openProductModal(producto = null) {
    editingProductId = producto ? producto.id : null;
    productForm.reset();
    pendingExtraImages = normalizeExtraImages(producto?.imagenes_extra);

    document.getElementById("modal-title").textContent = producto ? "Editar producto" : "Añadir producto";
    document.getElementById("product-id").value = producto ? producto.id : "";

    const productIdDisplay = document.getElementById("product-id-display");
    const productIdValue = document.getElementById("product-id-value");

    if (producto) {
        productIdDisplay.classList.remove("hidden");
        productIdValue.textContent = `#${producto.id}`;
    } else {
        productIdDisplay.classList.add("hidden");
        productIdValue.textContent = "";
    }

    document.getElementById("product-nombre").value = producto ? producto.nombre : "";
    document.getElementById("product-descripcion").value = producto ? producto.descripcion : "";
    document.getElementById("product-precio").value = producto ? producto.precio : "";
    document.getElementById("product-categoria").value = producto ? producto.categoria : "Pendientes";
    document.getElementById("product-medidas").value = producto?.medidas ?? "";
    document.getElementById("product-alt").value = producto ? producto.alt : "";
    document.getElementById("product-activo").checked = producto ? producto.activo : true;
    document.getElementById("product-imagen").required = !producto;

    const currentImageHint = document.getElementById("current-image-hint");
    currentImageHint.textContent = producto
        ? "Imagen actual: se mantiene si no eliges una nueva."
        : "Sube una imagen en formato JPG o PNG.";

    renderExtraImagesList();
    productModal.classList.remove("hidden");
}

function normalizeExtraImages(imagenesExtra) {
    if (!Array.isArray(imagenesExtra)) {
        return [];
    }

    return imagenesExtra.filter((url) => typeof url === "string" && url.length > 0);
}

function renderExtraImagesList() {
    const container = document.getElementById("extra-images-list");
    if (!container) return;

    if (pendingExtraImages.length === 0) {
        container.innerHTML = "";
        return;
    }

    container.innerHTML = pendingExtraImages.map((url, index) => `
        <div class="extra-image-item">
            <img src="${url}" alt="Fotografía adicional ${index + 1}">
            <button type="button" class="remove-extra-image" data-index="${index}" aria-label="Eliminar fotografía">×</button>
        </div>
    `).join("");

    container.querySelectorAll(".remove-extra-image").forEach((button) => {
        button.addEventListener("click", () => {
            pendingExtraImages.splice(Number(button.dataset.index), 1);
            renderExtraImagesList();
        });
    });
}

function closeProductModal() {
    productModal.classList.add("hidden");
    editingProductId = null;
    pendingExtraImages = [];
    productForm.reset();
    renderExtraImagesList();
}

function normalizeProductName(nombre) {
    return nombre.trim().toLocaleLowerCase("es");
}

function isDuplicateProductName(nombre, excludeId = null) {
    const normalizedName = normalizeProductName(nombre);

    return adminProducts.some((producto) => {
        if (excludeId !== null && producto.id === excludeId) {
            return false;
        }

        return normalizeProductName(producto.nombre) === normalizedName;
    });
}

function isUniqueConstraintError(error) {
    return error?.code === "23505";
}

async function handleSaveProduct(event) {
    event.preventDefault();

    const nombre = document.getElementById("product-nombre").value.trim();
    const descripcion = document.getElementById("product-descripcion").value.trim();
    const precio = parseFloat(document.getElementById("product-precio").value);
    const categoria = document.getElementById("product-categoria").value;
    const medidas = document.getElementById("product-medidas").value.trim();
    const alt = document.getElementById("product-alt").value.trim();
    const activo = document.getElementById("product-activo").checked;
    const imageFile = document.getElementById("product-imagen").files[0];
    const extraImageFiles = document.getElementById("product-imagenes-extra").files;

    const existingProduct = editingProductId
        ? adminProducts.find((item) => item.id === editingProductId)
        : null;

    let imagen = existingProduct ? existingProduct.imagen : "";

    if (imageFile) {
        const uploadedImage = await uploadImage(imageFile);
        if (!uploadedImage) return;
        imagen = uploadedImage;
    }

    if (!imagen) {
        showAdminMessage("Debes subir una imagen para el producto.", "error");
        return;
    }

    if (isDuplicateProductName(nombre, editingProductId)) {
        showAdminMessage("Ya existe un producto con ese nombre. Usa un nombre diferente.", "error");
        return;
    }

    for (const file of extraImageFiles) {
        const uploadedImage = await uploadImage(file);
        if (!uploadedImage) return;
        pendingExtraImages.push(uploadedImage);
    }

    const productData = {
        nombre,
        descripcion,
        precio,
        categoria,
        medidas: medidas || null,
        alt,
        imagen,
        imagenes_extra: pendingExtraImages,
        activo
    };

    let error;

    if (editingProductId) {
        ({ error } = await supabaseClient
            .from("productos")
            .update(productData)
            .eq("id", editingProductId));
    } else {
        ({ error } = await supabaseClient
            .from("productos")
            .insert([productData]));
    }

    if (error) {
        if (isUniqueConstraintError(error)) {
            showAdminMessage("Ya existe un producto con ese nombre. Usa un nombre diferente.", "error");
            return;
        }

        showAdminMessage("No se pudo guardar el producto.", "error");
        return;
    }

    closeProductModal();
    showAdminMessage(editingProductId ? "Producto actualizado." : "Producto añadido.");
    await loadAdminProducts();
}

async function deleteProduct(productId) {
    const producto = adminProducts.find((item) => item.id === productId);
    if (!producto) return;

    const confirmed = confirm(`¿Seguro que quieres eliminar "${producto.nombre}"?`);
    if (!confirmed) return;

    const { error } = await supabaseClient
        .from("productos")
        .delete()
        .eq("id", productId);

    if (error) {
        showAdminMessage("No se pudo eliminar el producto.", "error");
        return;
    }

    showAdminMessage("Producto eliminado.");
    await loadAdminProducts();
}

async function uploadImage(file) {
    const fileExtension = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExtension}`;

    const { error } = await supabaseClient.storage
        .from("productos-imagenes")
        .upload(fileName, file);

    if (error) {
        showAdminMessage("No se pudo subir la imagen.", "error");
        return null;
    }

    const { data } = supabaseClient.storage
        .from("productos-imagenes")
        .getPublicUrl(fileName);

    return data.publicUrl;
}

function formatPrice(precio) {
    return `${Number(precio).toFixed(2).replace(".", ",")} €`;
}
