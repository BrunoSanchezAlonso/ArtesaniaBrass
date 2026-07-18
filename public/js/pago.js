const CART_STORAGE_KEY = "artesanibrass-cart";

const continueButton = document.getElementById("payment-continue");
const errorElement = document.getElementById("payment-error");
const orderItemsElement = document.getElementById("payment-order-items");
const totalElement = document.getElementById("payment-total");
const bizumDetails = document.getElementById("payment-details-bizum");
const transferDetails = document.getElementById("payment-details-transferencia");
const contactForm = document.getElementById("payment-contact-form");
const customerNameInput = document.getElementById("payment-customer-name");
const customerEmailInput = document.getElementById("payment-customer-email");

let cart = [];

function formatPrice(precio) {
    return `${Number(precio).toFixed(2).replace(".", ",")} €`;
}

function loadCart() {
    const savedCart = localStorage.getItem(CART_STORAGE_KEY);

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

function getCartTotal() {
    return cart.reduce((total, item) => total + Number(item.price), 0);
}

function getCartLineItems() {
    const grouped = {};

    cart.forEach((item) => {
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
    if (!isSupabaseConfigured()) {
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

function showError(message) {
    errorElement.textContent = message;
    errorElement.classList.remove("hidden");
}

function hideError() {
    errorElement.textContent = "";
    errorElement.classList.add("hidden");
}

function renderSummary() {
    const lineItems = getCartLineItems();

    orderItemsElement.innerHTML = lineItems.map((item) => `
        <li>
            <span>${item.productId ? `#${item.productId} · ` : ""}${item.name}</span>
            <span>${item.quantity} × ${formatPrice(item.price)}</span>
        </li>
    `).join("");

    totalElement.textContent = formatPrice(getCartTotal());
}

function updateMethodUI() {
    const method = getSelectedMethod();
    const isOffline = method === "bizum" || method === "transferencia";

    bizumDetails.classList.toggle("hidden", method !== "bizum");
    transferDetails.classList.toggle("hidden", method !== "transferencia");
    contactForm.classList.toggle("hidden", !isOffline);

    if (method === "tarjeta") {
        continueButton.textContent = "Continuar al pago con tarjeta";
    } else if (method === "bizum") {
        continueButton.textContent = "Registrar pedido y he enviado el Bizum";
    } else {
        continueButton.textContent = "Registrar pedido y he transferido";
    }
}

async function startCardCheckout() {
    const checkoutUrl = typeof getCheckoutFunctionUrl === "function"
        ? getCheckoutFunctionUrl()
        : null;

    if (!isStripeConfigured() || !checkoutUrl) {
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
                items: getCartLineItems(),
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
        continueButton.disabled = false;
        updateMethodUI();
    }
}

function showOfflineSuccess(order, method) {
    localStorage.removeItem(CART_STORAGE_KEY);

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
                items: getCartLineItems()
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
        continueButton.disabled = false;
        updateMethodUI();
    }
}

async function handleContinue() {
    if (cart.length === 0) {
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

function initPaymentPage() {
    cart = loadCart();

    if (cart.length === 0) {
        window.location.href = "index.html";
        return;
    }

    renderSummary();
    updateMethodUI();

    document.querySelectorAll('input[name="payment-method"]').forEach((input) => {
        input.addEventListener("change", updateMethodUI);
    });

    continueButton.addEventListener("click", handleContinue);
}

document.addEventListener("DOMContentLoaded", initPaymentPage);
