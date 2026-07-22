let cart = [];
let productos = [];
let categoriaActiva = "Todos";
let activeProductDetail = null;
let activeGalleryIndex = 0;

const CART_STORAGE_KEY = "artesanibrass-cart";

function formatPrice(precio) {
    return `${Number(precio).toFixed(2).replace(".", ",")} €`;
}

function normalizeExtraImages(imagenesExtra) {
    if (!Array.isArray(imagenesExtra)) {
        return [];
    }

    return imagenesExtra.filter((url) => typeof url === "string" && url.length > 0);
}

function getProductImages(producto) {
    const extraImages = normalizeExtraImages(producto.imagenes_extra);

    return [producto.imagen, ...extraImages.filter((url) => url !== producto.imagen)];
}

function renderProductMeasures(medidas) {
    if (!medidas) {
        return "";
    }

    return `Medidas: ${medidas}`;
}

async function loadProducts() {
    if (!isSupabaseConfigured() || !supabaseClient) {
        return [];
    }

    const { data, error } = await supabaseClient
        .from("productos")
        .select("*")
        .eq("activo", true)
        .order("orden", { ascending: true })
        .order("id", { ascending: false });

    if (error) {
        console.warn("No se pudieron cargar productos desde Supabase.", error);
        return [];
    }

    return data ?? [];
}

function getFilteredProducts() {
    if (categoriaActiva === "Todos") {
        return productos;
    }

    return productos.filter((producto) => producto.categoria === categoriaActiva);
}

function setActiveCategory(categoria) {
    categoriaActiva = categoria;

    document.querySelectorAll(".filter-button").forEach((button) => {
        button.classList.toggle("active", button.dataset.categoria === categoria);
    });

    renderProducts();
}

function renderProducts() {
    const productsGrid = document.getElementById("products-grid");
    if (!productsGrid) return;

    const productosFiltrados = getFilteredProducts();

    if (productosFiltrados.length === 0) {
        const mensaje = categoriaActiva === "Todos"
            ? "No hay productos disponibles en este momento."
            : `No hay productos en la categoría "${categoriaActiva}".`;

        productsGrid.innerHTML = `
            <p style="grid-column: 1 / -1; text-align: center; color: #666;">
                ${mensaje}
            </p>
        `;
        return;
    }

    productsGrid.innerHTML = productosFiltrados.map((producto) => `
        <article class="product-card" data-product-id="${producto.id}" role="button" tabindex="0" aria-label="Ver ${producto.nombre}">
            <div class="product-image-wrapper product-card-open">
                <img src="${producto.imagen}" alt="${producto.alt}" class="product-image">
            </div>
            <div class="product-info product-card-open">
                <p class="product-id">Ref. #${producto.id}</p>
                <h3>${producto.nombre}</h3>
                <p class="product-description">${producto.descripcion}</p>
                <p class="product-price">${formatPrice(producto.precio)}</p>
                <button
                    class="add-to-cart"
                    data-product-id="${producto.id}"
                    data-nombre="${producto.nombre}"
                    data-precio="${producto.precio}"
                >
                    Me lo pido!
                </button>
            </div>
        </article>
    `).join("");

    productsGrid.querySelectorAll(".product-card").forEach((card) => {
        const openDetail = () => {
            const producto = productosFiltrados.find((item) => item.id === Number(card.dataset.productId));
            if (producto) {
                openProductDetail(producto);
            }
        };

        card.addEventListener("click", (event) => {
            if (event.target.closest(".add-to-cart")) {
                return;
            }

            openDetail();
        });

        card.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                if (event.target.closest(".add-to-cart")) {
                    return;
                }

                event.preventDefault();
                openDetail();
            }
        });
    });

    productsGrid.querySelectorAll(".add-to-cart").forEach((button) => {
        button.addEventListener("click", (event) => {
            event.stopPropagation();
            addToCart(
                Number(button.dataset.productId),
                button.dataset.nombre,
                parseFloat(button.dataset.precio)
            );
        });
    });
}

function initFilters() {
    document.querySelectorAll(".filter-button").forEach((button) => {
        button.addEventListener("click", () => {
            setActiveCategory(button.dataset.categoria);
        });
    });
}

function initCategoryCards() {
    document.querySelectorAll(".category-card").forEach((card) => {
        const activateCategory = () => {
            setActiveCategory(card.dataset.categoria);
            document.getElementById("productos").scrollIntoView({ behavior: "smooth" });
        };

        card.addEventListener("click", activateCategory);
        card.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                activateCategory();
            }
        });
    });
}

function loadCart() {
    const savedCart = localStorage.getItem(CART_STORAGE_KEY);

    if (!savedCart) {
        cart = [];
        return;
    }

    try {
        cart = JSON.parse(savedCart);
    } catch {
        cart = [];
    }
}

function saveCart() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

function getCartTotal() {
    return cart.reduce((total, item) => total + item.price, 0);
}

function openCart() {
    document.getElementById("cart-sidebar").classList.add("active");
}

function closeCart() {
    document.getElementById("cart-sidebar").classList.remove("active");
}

function setProductDetailImage(index) {
    if (!activeProductDetail) return;

    const images = getProductImages(activeProductDetail);
    activeGalleryIndex = index;

    const mainImage = document.getElementById("product-detail-main-image");
    mainImage.src = images[index];
    mainImage.alt = activeProductDetail.alt;

    document.querySelectorAll(".product-detail-thumb").forEach((thumb, thumbIndex) => {
        thumb.classList.toggle("active", thumbIndex === index);
    });
}

function openProductDetail(producto) {
    activeProductDetail = producto;
    activeGalleryIndex = 0;

    const modal = document.getElementById("product-detail-modal");
    const images = getProductImages(producto);
    const thumbsContainer = document.getElementById("product-detail-thumbs");

    document.getElementById("product-detail-title").textContent = `#${producto.id} · ${producto.nombre}`;
    document.getElementById("product-detail-description").textContent = producto.descripcion;

    const measuresElement = document.getElementById("product-detail-measures");
    if (producto.medidas) {
        measuresElement.textContent = renderProductMeasures(producto.medidas);
        measuresElement.classList.remove("hidden");
    } else {
        measuresElement.textContent = "";
        measuresElement.classList.add("hidden");
    }

    document.getElementById("product-detail-price").textContent = formatPrice(producto.precio);

    setProductDetailImage(0);

    if (images.length > 1) {
        thumbsContainer.innerHTML = images.map((url, index) => `
            <button
                type="button"
                class="product-detail-thumb ${index === 0 ? "active" : ""}"
                data-index="${index}"
                aria-label="Ver fotografía ${index + 1}"
            >
                <img src="${url}" alt="">
            </button>
        `).join("");

        thumbsContainer.classList.remove("hidden");

        thumbsContainer.querySelectorAll(".product-detail-thumb").forEach((thumb) => {
            thumb.addEventListener("click", () => {
                setProductDetailImage(Number(thumb.dataset.index));
            });
        });
    } else {
        thumbsContainer.innerHTML = "";
        thumbsContainer.classList.add("hidden");
    }

    const addButton = document.getElementById("product-detail-add-to-cart");
    addButton.onclick = () => {
        addToCart(producto.id, producto.nombre, producto.precio);
        closeProductDetail();
    };

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("product-detail-open");
}

function closeProductDetail() {
    const modal = document.getElementById("product-detail-modal");
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("product-detail-open");
    activeProductDetail = null;
    activeGalleryIndex = 0;
}

function initProductDetail() {
    const modal = document.getElementById("product-detail-modal");
    if (!modal) return;

    modal.querySelectorAll("[data-close-product-detail]").forEach((element) => {
        element.addEventListener("click", closeProductDetail);
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !modal.classList.contains("hidden")) {
            closeProductDetail();
        }
    });
}

function addToCart(productoId, productName, productPrice) {
    cart.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        productoId,
        name: productName,
        price: productPrice
    });

    saveCart();
    updateCart();
    openCart();
}

function removeFromCart(itemId) {
    cart = cart.filter((item) => item.id !== itemId);
    saveCart();
    updateCart();
}

function clearCart() {
    cart = [];
    saveCart();
    updateCart();
}

async function handleCheckout() {
    if (cart.length === 0) return;

    window.location.href = "pago.html";
}

function updateCart() {
    const cartCountElement = document.getElementById("cart-count");
    const cartItemsElement = document.getElementById("cart-items");
    const cartTotalElement = document.getElementById("cart-total");
    const clearCartButton = document.getElementById("clear-cart-button");
    const checkoutButton = document.getElementById("checkout-button");

    if (!cartCountElement || !cartItemsElement || !cartTotalElement) {
        return;
    }

    cartCountElement.textContent = cart.length;
    cartTotalElement.textContent = formatPrice(getCartTotal());

    if (clearCartButton) {
        clearCartButton.disabled = cart.length === 0;
    }

    if (checkoutButton) {
        checkoutButton.disabled = cart.length === 0;
    }

    if (cart.length === 0) {
        cartItemsElement.innerHTML = '<p class="cart-empty">Tu carrito está vacío.</p>';
        return;
    }

    cartItemsElement.innerHTML = cart.map((item) => `
        <div class="cart-item">
            <div class="cart-item-info">
                <span class="cart-item-name">${item.productoId ? `#${item.productoId} · ` : ""}${item.name}</span>
                <span class="cart-item-price">${formatPrice(item.price)}</span>
            </div>
            <button
                class="remove-from-cart"
                type="button"
                data-id="${item.id}"
                aria-label="Eliminar ${item.name}"
            >×</button>
        </div>
    `).join("");

    cartItemsElement.querySelectorAll(".remove-from-cart").forEach((button) => {
        button.addEventListener("click", () => {
            removeFromCart(button.dataset.id);
        });
    });
}

function initMobileNav() {
    const navbar = document.querySelector(".navbar");
    const nav = navbar?.querySelector("nav");

    if (!navbar || !nav || navbar.querySelector(".menu-toggle")) {
        return;
    }

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "menu-toggle";
    toggle.setAttribute("aria-label", "Abrir menú");
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = "<span></span><span></span><span></span>";

    const cartButton = navbar.querySelector(".cart-button");
    if (cartButton) {
        navbar.insertBefore(toggle, cartButton);
    } else {
        navbar.appendChild(toggle);
    }

    const closeMenu = () => {
        nav.classList.remove("mobile-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Abrir menú");
    };

    toggle.addEventListener("click", () => {
        const isOpen = nav.classList.toggle("mobile-open");
        toggle.setAttribute("aria-expanded", String(isOpen));
        toggle.setAttribute("aria-label", isOpen ? "Cerrar menú" : "Abrir menú");
    });

    nav.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", closeMenu);
    });

    document.addEventListener("click", (event) => {
        if (!navbar.contains(event.target)) {
            closeMenu();
        }
    });
}

function initCart() {
    const clearCartButton = document.getElementById("clear-cart-button");
    const checkoutButton = document.getElementById("checkout-button");

    loadCart();
    updateCart();

    if (clearCartButton) {
        clearCartButton.addEventListener("click", () => {
            if (cart.length === 0) return;

            const confirmed = confirm("¿Seguro que quieres vaciar el carrito?");
            if (confirmed) {
                clearCart();
            }
        });
    }

    if (checkoutButton) {
        checkoutButton.addEventListener("click", handleCheckout);
    }
}

function initCookieNotice() {
    const storageKey = "artesanibrass-cookies-ack";

    if (localStorage.getItem(storageKey) === "1") {
        return;
    }

    if (document.getElementById("cookie-notice")) {
        return;
    }

    const notice = document.createElement("div");
    notice.id = "cookie-notice";
    notice.className = "cookie-notice";
    notice.setAttribute("role", "dialog");
    notice.setAttribute("aria-label", "Aviso de cookies");
    notice.innerHTML = `
        <p>
            Usamos almacenamiento local para el carrito y cookies técnicas
            necesarias para el pago seguro (Stripe). No usamos cookies de
            publicidad.
            <a href="cookies.html">Más información</a>
        </p>
        <button type="button" class="cookie-notice-button" id="cookie-notice-accept">
            Entendido
        </button>
    `;

    document.body.appendChild(notice);

    const acceptButton = document.getElementById("cookie-notice-accept");
    if (acceptButton) {
        acceptButton.addEventListener("click", () => {
            localStorage.setItem(storageKey, "1");
            notice.remove();
        });
    }
}

async function initStore() {
    productos = await loadProducts();
    initMobileNav();
    initCart();
    initFilters();
    initCategoryCards();
    initProductDetail();
    initCookieNotice();
    renderProducts();
}

document.addEventListener("DOMContentLoaded", initStore);
