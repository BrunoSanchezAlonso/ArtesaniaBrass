const CART_STORAGE_KEY = "artesanibrass-cart";

const continueButton = document.getElementById("payment-continue");
const errorElement = document.getElementById("payment-error");
const orderItemsElement = document.getElementById("payment-order-items");
const totalElement = document.getElementById("payment-total");
const bizumDetails = document.getElementById("payment-details-bizum");
const transferDetails = document.getElementById("payment-details-transferencia");

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

    bizumDetails.classList.toggle("hidden", method !== "bizum");
    transferDetails.classList.toggle("hidden", method !== "transferencia");

    if (method === "tarjeta") {
        continueButton.textContent = "Continuar al pago con tarjeta";
    } else if (method === "bizum") {
        continueButton.textContent = "He enviado el Bizum";
    } else {
        continueButton.textContent = "He realizado la transferencia";
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

function completeOfflinePayment(method) {
    localStorage.removeItem(CART_STORAGE_KEY);

    const methodLabel = method === "bizum" ? "Bizum" : "transferencia";

    document.querySelector(".payment-card").innerHTML = `
        <p class="checkout-status-badge success">Pedido anotado</p>
        <h1>¡Gracias!</h1>
        <p>
            Has elegido pagar por ${methodLabel}. Cuando confirmemos el pago,
            prepararemos tu pedido con mucho cariño.
        </p>
        <p>
            Si aún no lo has hecho, escríbenos a
            <a href="mailto:info@artesaniabrass.es">info@artesaniabrass.es</a>
            o por Instagram
            <a href="https://www.instagram.com/artesania.brass/" target="_blank" rel="noopener noreferrer">@artesania.brass</a>
            con el detalle de tu compra.
        </p>
        <a href="index.html" class="payment-continue-button">Volver a la tienda</a>
    `;
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

    completeOfflinePayment(method);
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
