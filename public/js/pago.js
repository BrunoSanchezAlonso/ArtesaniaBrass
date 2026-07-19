const PAYMENT_CART_KEY = "artesanibrass-cart";

let paymentCart = [];
let continueButton;
let errorElement;
let orderItemsElement;
let totalElement;
let bizumDetails;
let transferDetails;
let tarjetaDetails;
let contactForm;
let customerNameInput;
let customerEmailInput;

function formatPaymentPrice(precio) {
    return `${Number(precio).toFixed(2).replace(".", ",")} €`;
}

function loadPaymentCart() {
    const savedCart = localStorage.getItem(PAYMENT_CART_KEY);

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

function getPaymentCartTotal() {
    return paymentCart.reduce((total, item) => total + Number(item.price), 0);
}

function getPaymentCartLineItems() {
    const grouped = {};

    paymentCart.forEach((item) => {
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

function getSelectedMethod() {
    const selected = document.querySelector('input[name="payment-method"]:checked');
    return selected ? selected.value : "tarjeta";
}

function getOfflineOrderFunctionUrl() {
    if (typeof isSupabaseConfigured !== "function" || !isSupabaseConfigured()) {
        return null;
    }

    return `${SUPABASE_URL}/functions/v1/create-offline-order`;
}

function getCheckoutReturnUrls() {
    const baseUrl = new URL("./", window.location.href).href;

    return {
        successUrl: `${baseUrl}success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${baseUrl}pago`
    };
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

function renderSummary() {
    const lineItems = getPaymentCartLineItems();

    orderItemsElement.innerHTML = lineItems.map((item) => `
        <li>
            <span>${item.productId ? `#${item.productId} · ` : ""}${item.name}</span>
            <span>${item.quantity} × ${formatPaymentPrice(item.price)}</span>
        </li>
    `).join("");

    totalElement.textContent = formatPaymentPrice(getPaymentCartTotal());
}

function updateMethodUI() {
    const method = getSelectedMethod();

    setHidden(tarjetaDetails, method !== "tarjeta");
    setHidden(bizumDetails, method !== "bizum");
    setHidden(transferDetails, method !== "transferencia");
    setHidden(contactForm, method === "tarjeta");

    if (method === "tarjeta") {
        continueButton.textContent = "Continuar al pago con tarjeta";
    } else if (method === "bizum") {
        continueButton.textContent = "Registrar pedido y he enviado el Bizum";
    } else {
        continueButton.textContent = "Registrar pedido y he transferido";
    }

    continueButton.disabled = false;
    hideError();
}

async function startCardCheckout() {
    const checkoutUrl = typeof getCheckoutFunctionUrl === "function"
        ? getCheckoutFunctionUrl()
        : null;

    if (typeof isStripeConfigured !== "function" || !isStripeConfigured() || !checkoutUrl) {
        showError("Los pagos con tarjeta aún no están configurados.");
        return;
    }

    continueButton.disabled = true;
    continueButton.textContent = "Redirigiendo a Stripe...";
    hideError();

    try {
        const { successUrl, cancelUrl } = getCheckoutReturnUrls();
        const response = await fetch(checkoutUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
                items: getPaymentCartLineItems(),
                successUrl,
                cancelUrl
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "No se pudo iniciar el pago.");
        }

        window.location.href = data.url;
    } catch (error) {
        console.error("Error en checkout:", error);
        showError(error.message || "No se pudo conectar con Stripe. Inténtalo de nuevo.");
        updateMethodUI();
    }
}

function showOfflineSuccess(order, method) {
    localStorage.removeItem(PAYMENT_CART_KEY);

    if (typeof updateCart === "function") {
        // Sincroniza el contador del header si store.js está cargado
        if (typeof loadCart === "function") {
            loadCart();
        }
        updateCart();
    }

    const methodLabel = method === "bizum" ? "Bizum" : "transferencia";

    document.querySelector(".payment-card").innerHTML = `
        <p class="checkout-status-badge cancel">Pago pendiente de confirmación</p>
        <h1>Pedido #${order.id} registrado</h1>
        <p>
            Has elegido pagar por ${methodLabel}. Cuando confirmemos el ingreso,
            prepararemos tu pedido con mucho cariño.
        </p>
        <p>
            Si tienes cualquier duda, escríbenos a
            <a href="mailto:info@artesaniabrass.es">info@artesaniabrass.es</a>
            o por Instagram
            <a href="https://www.instagram.com/artesania.brass/" target="_blank" rel="noopener noreferrer">@artesania.brass</a>.
        </p>
        <a href="index.html" class="payment-continue-button">Volver a la tienda</a>
    `;
}

async function completeOfflinePayment(method) {
    const customerName = customerNameInput.value.trim();
    const customerEmail = customerEmailInput.value.trim();
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

    if (!functionUrl) {
        showError("No hay conexión con el servidor para registrar el pedido.");
        return;
    }

    continueButton.disabled = true;
    continueButton.textContent = "Registrando pedido...";
    hideError();

    try {
        const response = await fetch(functionUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
                metodoPago: method,
                customerName,
                customerEmail,
                items: getPaymentCartLineItems()
            })
        });

        const data = await response.json();

        if (!response.ok || !data.order) {
            throw new Error(data.error || "No se pudo registrar el pedido.");
        }

        showOfflineSuccess(data.order, method);
    } catch (error) {
        console.error("Error al registrar pedido offline:", error);
        showError(error.message || "No se pudo registrar el pedido. Inténtalo de nuevo.");
        updateMethodUI();
    }
}

async function handleContinue() {
    if (paymentCart.length === 0) {
        window.location.href = "index.html";
        return;
    }

    const method = getSelectedMethod();

    if (method === "tarjeta") {
        await startCardCheckout();
        return;
    }

    await completeOfflinePayment(method);
}

function bindPaymentMethodEvents() {
    document.querySelectorAll('input[name="payment-method"]').forEach((input) => {
        input.addEventListener("change", updateMethodUI);
    });

    document.querySelectorAll(".payment-option").forEach((option) => {
        option.addEventListener("click", () => {
            const input = option.querySelector('input[name="payment-method"]');
            if (!input) return;

            if (!input.checked) {
                input.checked = true;
            }

            updateMethodUI();
        });
    });

    continueButton.addEventListener("click", handleContinue);
}

function initPaymentPage() {
    continueButton = document.getElementById("payment-continue");
    errorElement = document.getElementById("payment-error");
    orderItemsElement = document.getElementById("payment-order-items");
    totalElement = document.getElementById("payment-total");
    bizumDetails = document.getElementById("payment-details-bizum");
    transferDetails = document.getElementById("payment-details-transferencia");
    tarjetaDetails = document.getElementById("payment-details-tarjeta");
    contactForm = document.getElementById("payment-contact-form");
    customerNameInput = document.getElementById("payment-customer-name");
    customerEmailInput = document.getElementById("payment-customer-email");

    if (!continueButton || !orderItemsElement || !totalElement) {
        console.error("Faltan elementos de la página de pago.");
        return;
    }

    paymentCart = loadPaymentCart();

    if (paymentCart.length === 0) {
        window.location.href = "index.html";
        return;
    }

    renderSummary();
    bindPaymentMethodEvents();
    updateMethodUI();
}

document.addEventListener("DOMContentLoaded", initPaymentPage);
