const PAYMENT_CART_KEY = "artesanibrass-cart";

let paymentCart = [];
let continueButton;
let errorElement;
let orderItemsElement;
let totalElement;
let shippingNoteElement;
let tarjetaDetails;
let offlineDetails;
let zoneAutoElement;
let zoneQuoteElement;

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

async function enrichPaymentCartImages() {
    const missingIds = [...new Set(
        paymentCart
            .filter((item) => !item.image && item.productoId)
            .map((item) => item.productoId)
    )];

    if (missingIds.length === 0 || !supabaseClient) {
        return;
    }

    const { data, error } = await supabaseClient
        .from("productos")
        .select("id, imagen, alt")
        .in("id", missingIds);

    if (error || !data?.length) {
        return;
    }

    const byId = Object.fromEntries(data.map((product) => [product.id, product]));
    let changed = false;

    paymentCart = paymentCart.map((item) => {
        if (item.image || !item.productoId || !byId[item.productoId]?.imagen) {
            return item;
        }

        changed = true;
        return {
            ...item,
            image: byId[item.productoId].imagen,
            alt: byId[item.productoId].alt || ""
        };
    });

    if (changed) {
        localStorage.setItem(PAYMENT_CART_KEY, JSON.stringify(paymentCart));
    }
}

function getPaymentCartSubtotal() {
    return paymentCart.reduce((total, item) => total + Number(item.price), 0);
}

function isAutoPayZone() {
    const selected = document.querySelector('input[name="shipping-destination"]:checked');
    return selected?.value !== "QUOTE";
}

function getSelectedShippingDestination() {
    return isAutoPayZone() ? "ES" : "QUOTE";
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
                image: item.image || "",
                alt: item.alt || "",
                quantity: 0
            };
        }

        if (!grouped[key].image && item.image) {
            grouped[key].image = item.image;
            grouped[key].alt = item.alt || "";
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

    // Sin ".html": con cleanUrls, servir redirige y puede perder ?metodo / ?session_id
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
    const autoZone = isAutoPayZone();
    const itemsHtml = lineItems.map((item) => `
        <li class="order-summary-item">
            <div class="order-summary-item-main">
                ${item.image
                    ? `<img src="${item.image}" alt="${item.alt || ""}" class="order-summary-thumb" width="44" height="44" loading="lazy">`
                    : ""}
                <span>${item.productId ? `#${item.productId} · ` : ""}${item.name}</span>
            </div>
            <span>${item.quantity} × ${formatPaymentPrice(item.price)}</span>
        </li>
    `).join("");

    const shippingHtml = autoZone
        ? `
        <li class="order-summary-item order-summary-shipping">
            <span>Envío (península y Baleares)</span>
            <span>Gratis</span>
        </li>
    `
        : `
        <li class="order-summary-item order-summary-shipping">
            <span>Envío</span>
            <span>A calcular</span>
        </li>
    `;

    orderItemsElement.innerHTML = itemsHtml + shippingHtml;
    totalElement.textContent = autoZone
        ? formatPaymentPrice(getPaymentCartSubtotal())
        : `${formatPaymentPrice(getPaymentCartSubtotal())} + envío`;

    if (shippingNoteElement) {
        shippingNoteElement.textContent = autoZone
            ? "Envío gratis a península y Baleares."
            : "El envío se calcula a mano según el destino.";
    }
}

function updateMethodUI() {
    if (!isAutoPayZone()) {
        return;
    }

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
    renderSummary();
}

function updateZoneUI() {
    const autoZone = isAutoPayZone();

    setHidden(zoneAutoElement, !autoZone);
    setHidden(zoneQuoteElement, autoZone);

    if (autoZone) {
        updateMethodUI();
    } else {
        hideError();
        renderSummary();
    }
}

async function startCardCheckout() {
    if (!isAutoPayZone()) {
        showError("Para este destino necesitamos calcular el envío a mano. Escríbenos por email o Instagram.");
        return;
    }

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
                shippingDestination: "ES",
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
        window.location.href = "./";
        return;
    }

    if (!isAutoPayZone()) {
        return;
    }

    const method = getSelectedMethod();

    if (method === "tarjeta") {
        await startCardCheckout();
        return;
    }

    window.location.href = `pedido-offline?metodo=${encodeURIComponent(method)}`;
}

function bindPaymentMethodEvents() {
    document.querySelectorAll('input[name="payment-method"]').forEach((input) => {
        input.addEventListener("change", updateMethodUI);
    });

    document.querySelectorAll('input[name="shipping-destination"]').forEach((input) => {
        input.addEventListener("change", updateZoneUI);
    });

    document.querySelectorAll(".payment-option").forEach((option) => {
        option.addEventListener("click", () => {
            const methodInput = option.querySelector('input[name="payment-method"]');
            const shippingInput = option.querySelector('input[name="shipping-destination"]');
            const input = methodInput || shippingInput;
            if (!input) return;

            if (!input.checked) {
                input.checked = true;
            }

            if (shippingInput) {
                updateZoneUI();
            } else if (methodInput) {
                updateMethodUI();
            }
        });
    });

    continueButton.addEventListener("click", handleContinue);
}

async function initPaymentPage() {
    continueButton = document.getElementById("payment-continue");
    errorElement = document.getElementById("payment-error");
    orderItemsElement = document.getElementById("payment-order-items");
    totalElement = document.getElementById("payment-total");
    shippingNoteElement = document.getElementById("payment-shipping-note");
    tarjetaDetails = document.getElementById("payment-details-tarjeta");
    offlineDetails = document.getElementById("payment-details-offline");
    zoneAutoElement = document.getElementById("payment-zone-auto");
    zoneQuoteElement = document.getElementById("payment-zone-quote");

    if (!continueButton || !orderItemsElement || !totalElement) {
        console.error("Faltan elementos de la página de pago.");
        return;
    }

    paymentCart = loadPaymentCart();

    if (paymentCart.length === 0) {
        window.location.href = "index.html";
        return;
    }

    await enrichPaymentCartImages();
    bindPaymentMethodEvents();
    updateZoneUI();
}

document.addEventListener("DOMContentLoaded", initPaymentPage);
