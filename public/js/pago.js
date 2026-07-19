const PAYMENT_CART_KEY = "artesanibrass-cart";

let paymentCart = [];
let continueButton;
let errorElement;
let orderItemsElement;
let totalElement;
let tarjetaDetails;
let offlineDetails;

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
    const isOffline = method === "bizum" || method === "transferencia";

    setHidden(tarjetaDetails, method !== "tarjeta");
    setHidden(offlineDetails, !isOffline);

    if (method === "tarjeta") {
        continueButton.textContent = "Continuar al pago con tarjeta";
    } else if (method === "bizum") {
        continueButton.textContent = "Continuar con Bizum";
    } else {
        continueButton.textContent = "Continuar con transferencia";
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

    window.location.href = `pedido-offline.html?metodo=${encodeURIComponent(method)}`;
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
    tarjetaDetails = document.getElementById("payment-details-tarjeta");
    offlineDetails = document.getElementById("payment-details-offline");

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
