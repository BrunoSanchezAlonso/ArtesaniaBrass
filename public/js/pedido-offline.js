const OFFLINE_CART_KEY = "artesanibrass-cart";
const INTERNATIONAL_SHIPPING_EUR = 5;

let offlineCart = [];
let metodoPago = "bizum";
let confirmButton;
let errorElement;
let orderItemsElement;
let totalElement;
let customerNameInput;
let customerEmailInput;
let addressLine1Input;
let addressLine2Input;
let addressPostalInput;
let addressCityInput;
let addressStateInput;
let addressCountrySelect;
let shippingNoteElement;
let bizumDetails;
let transferDetails;
let bizumAmount;
let transferAmount;
let pageTitle;
let pageIntro;

function formatOfflinePrice(precio) {
    return `${Number(precio).toFixed(2).replace(".", ",")} €`;
}

function loadOfflineCart() {
    const savedCart = localStorage.getItem(OFFLINE_CART_KEY);

    if (!savedCart) {
        return [];
    }

    try {
        const parsed = JSON.parse(savedCart);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function getOfflineCartSubtotal() {
    return offlineCart.reduce((total, item) => total + Number(item.price), 0);
}

function getShippingCost() {
    const country = addressCountrySelect?.value || "ES";
    return country === "ES" ? 0 : INTERNATIONAL_SHIPPING_EUR;
}

function getOfflineCartTotal() {
    return getOfflineCartSubtotal() + getShippingCost();
}

function getOfflineCartLineItems() {
    const grouped = {};

    offlineCart.forEach((item) => {
        const key = `${item.productoId ?? item.name}`;

        if (!grouped[key]) {
            grouped[key] = {
                productId: item.productoId,
                name: item.name,
                price: item.price,
                quantity: 0
            };
        }

        grouped[key].quantity += 1;
    });

    return Object.values(grouped);
}

function getShippingAddress() {
    return {
        line1: addressLine1Input.value.trim(),
        line2: addressLine2Input.value.trim() || null,
        postal_code: addressPostalInput.value.trim(),
        city: addressCityInput.value.trim(),
        state: addressStateInput.value.trim() || null,
        country: addressCountrySelect.value
    };
}

function getMetodoFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const metodo = params.get("metodo");

    if (metodo === "bizum" || metodo === "transferencia") {
        return metodo;
    }

    return null;
}

function getOfflineOrderFunctionUrl() {
    if (typeof isSupabaseConfigured !== "function" || !isSupabaseConfigured()) {
        return null;
    }

    return `${SUPABASE_URL}/functions/v1/create-offline-order`;
}

function setHidden(element, shouldHide) {
    if (!element) return;
    element.classList.toggle("hidden", shouldHide);
    element.hidden = shouldHide;
}

function showError(message) {
    if (!errorElement) return;
    errorElement.textContent = message;
    setHidden(errorElement, false);
}

function hideError() {
    if (!errorElement) return;
    errorElement.textContent = "";
    setHidden(errorElement, true);
}

function updateShippingNote() {
    const shippingCost = getShippingCost();

    if (!shippingNoteElement) return;

    shippingNoteElement.textContent = shippingCost === 0
        ? "Envío gratis incluido."
        : `Se añadirán ${formatOfflinePrice(shippingCost)} de gastos de envío.`;
}

function renderSummary() {
    const lineItems = getOfflineCartLineItems();
    const shippingCost = getShippingCost();
    const total = formatOfflinePrice(getOfflineCartTotal());

    const itemsHtml = lineItems.map((item) => `
        <li>
            <span>${item.productId ? `#${item.productId} · ` : ""}${item.name}</span>
            <span>${item.quantity} × ${formatOfflinePrice(item.price)}</span>
        </li>
    `).join("");

    const shippingHtml = `
        <li>
            <span>Envío</span>
            <span>${shippingCost === 0 ? "Gratis" : formatOfflinePrice(shippingCost)}</span>
        </li>
    `;

    orderItemsElement.innerHTML = itemsHtml + shippingHtml;
    totalElement.textContent = total;
    updateShippingNote();

    if (bizumAmount) {
        bizumAmount.textContent = total;
    }

    if (transferAmount) {
        transferAmount.textContent = total;
    }
}

function applyMethodUI() {
    const isBizum = metodoPago === "bizum";
    const methodLabel = isBizum ? "Bizum" : "transferencia";

    pageTitle.textContent = isBizum
        ? "Pedido con Bizum"
        : "Pedido con transferencia";

    pageIntro.textContent = isBizum
        ? "Completa tus datos y dirección, revisa los datos de Bizum y confirma el pedido. Te daremos un número de pedido y quedará pendiente de pago."
        : "Completa tus datos y dirección, revisa los datos bancarios y confirma el pedido. Te daremos un número de pedido y quedará pendiente de pago.";

    document.title = `Pedido con ${methodLabel} | ArtesaniaBrass`;

    setHidden(bizumDetails, !isBizum);
    setHidden(transferDetails, isBizum);

    confirmButton.textContent = "Confirmar pedido";
}

function getPaymentDetailsHtml(orderId, total) {
    const concept = `Tu nombre + Pedido #${orderId}`;

    if (metodoPago === "bizum") {
        return `
            <section class="payment-details">
                <h2>Cómo pagar por Bizum</h2>
                <p><strong>Teléfono Bizum:</strong> +34 610 266 411</p>
                <p><strong>Importe:</strong> ${total}</p>
                <p><strong>Concepto:</strong> ${concept}</p>
                <p>
                    Cuando hayamos recibido el pago, te enviaremos un correo de
                    confirmación y prepararemos tu envío.
                </p>
            </section>
        `;
    }

    return `
        <section class="payment-details">
            <h2>Cómo pagar por transferencia</h2>
            <p><strong>Titular:</strong> Rosa Alonso García</p>
            <p><strong>IBAN:</strong> ES39 1583 0001 1990 5805 3423</p>
            <p><strong>Banco:</strong> Revolut</p>
            <p><strong>Importe:</strong> ${total}</p>
            <p><strong>Concepto:</strong> ${concept}</p>
            <p>
                Cuando hayamos recibido el pago, te enviaremos un correo de
                confirmación y prepararemos tu envío.
            </p>
        </section>
    `;
}

function showSuccess(order) {
    localStorage.removeItem(OFFLINE_CART_KEY);

    if (typeof loadCart === "function") {
        loadCart();
    }

    if (typeof updateCart === "function") {
        updateCart();
    }

    const methodLabel = metodoPago === "bizum" ? "Bizum" : "transferencia";
    const total = formatOfflinePrice(order.total_amount ?? getOfflineCartTotal());

    document.getElementById("offline-order-card").innerHTML = `
        <p class="checkout-status-badge cancel">Pago pendiente</p>
        <h1>Pedido #${order.id} creado</h1>
        <p>
            Tu pedido por ${methodLabel} ya está registrado.
            El total es <strong>${total}</strong>. Ahora solo falta realizar el pago.<br><br>
        </p>
        ${getPaymentDetailsHtml(order.id, total)}
        <p>
            Si tienes dudas, escríbenos a
            <a href="mailto:info@artesaniabrass.es">info@artesaniabrass.es</a>
            o por Instagram
            <a href="https://www.instagram.com/artesania.brass/" target="_blank" rel="noopener noreferrer">@artesania.brass</a>.<br><br>
        </p>
        <a href="index.html" class="payment-continue-button">Volver a la tienda</a>
    `;
}

function validateShippingAddress(address) {
    if (!address.line1) {
        showError("Indica la dirección de envío.");
        addressLine1Input.focus();
        return false;
    }

    if (!address.postal_code) {
        showError("Indica el código postal.");
        addressPostalInput.focus();
        return false;
    }

    if (!address.city) {
        showError("Indica la ciudad.");
        addressCityInput.focus();
        return false;
    }

    if (!address.country) {
        showError("Indica el país.");
        addressCountrySelect.focus();
        return false;
    }

    return true;
}

async function confirmOfflineOrder() {
    const customerName = customerNameInput.value.trim();
    const customerEmail = customerEmailInput.value.trim();
    const shippingAddress = getShippingAddress();
    const functionUrl = getOfflineOrderFunctionUrl();

    if (!customerName) {
        showError("Indica tu nombre para registrar el pedido.");
        customerNameInput.focus();
        return;
    }

    if (!customerEmail || !customerEmail.includes("@")) {
        showError("Indica un email válido para registrar el pedido.");
        customerEmailInput.focus();
        return;
    }

    if (!validateShippingAddress(shippingAddress)) {
        return;
    }

    if (!functionUrl) {
        showError("No hay conexión con el servidor para registrar el pedido.");
        return;
    }

    confirmButton.disabled = true;
    confirmButton.textContent = "Creando pedido...";
    hideError();

    try {
        const response = await fetch(functionUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
                metodoPago,
                customerName,
                customerEmail,
                shippingAddress,
                items: getOfflineCartLineItems()
            })
        });

        const data = await response.json();

        if (!response.ok || !data.order) {
            throw new Error(data.error || "No se pudo registrar el pedido.");
        }

        showSuccess(data.order);
    } catch (error) {
        console.error("Error al registrar pedido offline:", error);
        showError(error.message || "No se pudo registrar el pedido. Inténtalo de nuevo.");
        confirmButton.disabled = false;
        confirmButton.textContent = "Confirmar pedido";
    }
}

function initOfflineOrderPage() {
    metodoPago = getMetodoFromUrl();

    if (!metodoPago) {
        window.location.href = "pago";
        return;
    }

    confirmButton = document.getElementById("offline-confirm");
    errorElement = document.getElementById("offline-error");
    orderItemsElement = document.getElementById("offline-order-items");
    totalElement = document.getElementById("offline-total");
    customerNameInput = document.getElementById("offline-customer-name");
    customerEmailInput = document.getElementById("offline-customer-email");
    addressLine1Input = document.getElementById("offline-address-line1");
    addressLine2Input = document.getElementById("offline-address-line2");
    addressPostalInput = document.getElementById("offline-address-postal");
    addressCityInput = document.getElementById("offline-address-city");
    addressStateInput = document.getElementById("offline-address-state");
    addressCountrySelect = document.getElementById("offline-address-country");
    shippingNoteElement = document.getElementById("offline-shipping-note");
    bizumDetails = document.getElementById("offline-details-bizum");
    transferDetails = document.getElementById("offline-details-transferencia");
    bizumAmount = document.getElementById("offline-bizum-amount");
    transferAmount = document.getElementById("offline-transfer-amount");
    pageTitle = document.getElementById("offline-page-title");
    pageIntro = document.getElementById("offline-page-intro");

    offlineCart = loadOfflineCart();

    if (offlineCart.length === 0) {
        window.location.href = "index.html";
        return;
    }

    applyMethodUI();
    renderSummary();
    addressCountrySelect.addEventListener("change", renderSummary);
    confirmButton.addEventListener("click", confirmOfflineOrder);
}

document.addEventListener("DOMContentLoaded", initOfflineOrderPage);
