document.addEventListener("DOMContentLoaded", async function () {

    loadCartFromStorage(); // Загружаем корзину из localStorage
    renderCartIndicator(); // Обновляем индикатор корзины


    // Синхронизация значений диапазона цен
    const minPriceInput = document.getElementById("minPriceRange");
    const maxPriceInput = document.getElementById("maxPriceRange");
    const minPriceValue = document.getElementById("minPriceValue");
    const maxPriceValue = document.getElementById("maxPriceValue");

    minPriceInput.addEventListener("input", () => {
        if (parseInt(minPriceInput.value) > parseInt(maxPriceInput.value)) {
            minPriceInput.value = maxPriceInput.value; // Не даем минимальной цене быть больше максимальной
        }
        minPriceValue.textContent = minPriceInput.value;
    });

    maxPriceInput.addEventListener("input", () => {
        if (parseInt(maxPriceInput.value) < parseInt(minPriceInput.value)) {
            maxPriceInput.value = minPriceInput.value; // Не даем максимальной цене быть меньше минимальной
        }
        maxPriceValue.textContent = maxPriceInput.value;
    });

    console.log("DOM fully loaded and parsed");

    const token = await getTokenFromDatabase();

    if (!token) {
        console.error("Токен недействителен, перенаправление на страницу логина");
        window.location.href = "/login";
        return;
    }

    await loadWarehouses(token); // Загружаем список складов

    document.getElementById("warehouseSelect").addEventListener("change", async (event) => {
        const warehouseId = event.target.value;
        const token = await getTokenFromDatabase();
        console.log("Выбран склад:", warehouseId);
        if (warehouseId && token) {
            const products = await fetchProductsFromWarehouse(warehouseId, token);
            console.log("Продукты для склада:", products);
            renderProducts(products);
        }
        else {
            console.warn("Не выбран склад или отсутствует токен");
        }
    });

    document.getElementById("searchForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const warehouseId = document.getElementById("warehouseSelect").value;
        const searchQuery = document.getElementById("searchInput").value.trim();
        if (warehouseId && searchQuery) {
            resetFilters();
            const products = await searchProductsInWarehouse(warehouseId, searchQuery, token);
            renderProducts(products);
        }
    });

    document.getElementById("filtersForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const warehouseId = document.getElementById("warehouseSelect").value;
        const minPrice = minPriceInput.value;
        const maxPrice = maxPriceInput.value;
        const inStock = document.getElementById("inStockCheckbox").checked;
        const searchQuery = document.getElementById("searchInput").value.trim();

        if (warehouseId) {
            const products = await filterProductsByWarehouse(warehouseId, { minPrice, maxPrice, inStock, searchQuery }, token);
            renderProducts(products);
        }
    });
});

let cart = [];
let products = [];

// ---- Загрузка складов ----
async function loadWarehouses(token) {
    try {
        const response = await fetch(`http://${window.location.hostname}:8002/warehouses/`, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`Ошибка загрузки складов: ${response.status}`);
        }

        const warehouses = await response.json();
        renderWarehousesTable(warehouses);
    } catch (error) {
        console.error("Ошибка при загрузке складов:", error);
    }
}

// ---- Поиск по складу ----
async function searchProductsInWarehouse(warehouseId, query, token) {
    const response = await fetch(`http://${window.location.hostname}:8002/productinwarehouses/${warehouseId}/products?name=${encodeURIComponent(query)}`, {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        console.error("Ошибка при поиске продуктов:", response.status);
        return [];
    }

    const products = await response.json(); // Теперь API уже возвращает нужные данные
    console.log("✅ Найденные продукты на складе:", products);

    return products; // Возвращаем напрямую, без fetchProductDetails
}

// ---- Фильтрация по складу ----
async function filterProductsByWarehouse(warehouseId, filters, token) {
    let url = `http://${window.location.hostname}:8002/productinwarehouses/${warehouseId}/products?`;

    if (filters.minPrice) {
        url += `min_price=${filters.minPrice}&`;
    }
    if (filters.maxPrice) {
        url += `max_price=${filters.maxPrice}&`;
    }
    if (filters.inStock) {
        url += `in_stock=true&`;
    }
    if (filters.searchQuery) url += `name=${encodeURIComponent(filters.searchQuery)}&`;

    const response = await fetch(url, {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        console.error("Ошибка при фильтрации продуктов:", response.status);
        return [];
    }

    const products = await response.json();
    console.log("Фильтрованные продукты на складе:", products);

    return products;
}

// ---- Получение информации о складах ----
function renderWarehousesTable(warehouses) {
    const warehouseSelect = document.getElementById("warehouseSelect");
    warehouseSelect.innerHTML = `<option value="" disabled selected>Выберите склад</option>`;

    warehouses.forEach((warehouse) => {
        const option = document.createElement("option");
        option.value = warehouse.warehouse_id;
        option.textContent = warehouse.location;
        warehouseSelect.appendChild(option);
    });

    console.log("Склады успешно загружены:", warehouses);
}

// ---- Получение информации о продукте ----
async function fetchProductDetails(productId, token) {
    const response = await fetch(`http://${window.location.hostname}:8002/products/${productId}`, {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        console.error(`Ошибка при получении информации о продукте: ${productId}`);
        return null;
    }

    return await response.json();
}



// ---- Получение продуктов со склада ----
async function fetchProductsFromWarehouse(warehouseId, token) {
    const response = await fetch(`http://${window.location.hostname}:8002/productinwarehouses/${warehouseId}`, {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        console.error("Ошибка при загрузке товаров со склада:", response.status);
        return [];
    }

    const productsInWarehouse = await response.json();
    console.log("Продукты на складе:", productsInWarehouse);

    products = [];

    for (const productWarehouse of productsInWarehouse) {
        const productDetails = await fetchProductDetails(productWarehouse.product_id, token);
        if (productDetails) {
            products.push({
                ...productDetails,
                stock_quantity: productWarehouse.quantity // Количество со склада
            });
        }
        else {
            console.warn("Не удалось загрузить данные для продукта:", productWarehouse.product_id);
        }
    }
    console.log("Все загруженные продукты:", products);
    return products;
}

// ---- Формирование списка продуктов ----
async function renderProducts(products) {
    console.log("Рендеринг продуктов:", products);
    const container = document.getElementById("productsContainer");
    container.innerHTML = "";

    if (products.length === 0) {
        container.innerHTML = "<p>Нет доступных товаров на складе</p>";
        return;
    }

    // Загружаем токен заранее
    const token = await getTokenFromDatabase();
    const imageHost = "http://${window.location.hostname}:8002";

    for (const product of products) {

        const inStock = product.stock_quantity > 0;
        const supplierName = await fetchSupplierName(product.supplier_id, token);

        const imageUrl = product.image_url && product.image_url.trim() !== ""
            ? (product.image_url.startsWith("http")
                ? product.image_url
                : `${imageHost}${product.image_url}`)
            : `${imageHost}/default-image.jpg`;

        const card = `
            <div class="card mb-3">
                <div class="row g-0">
                    <div class="col-md-4">
                        <img src="${imageUrl}" class="img-fluid rounded-start" alt="${product.name}">
                    </div>
                    <div class="col-md-8">
                        <div class="card-body">
                            <h5 class="card-title">${product.name}</h5>
                            <p class="card-text">${product.description?.substring(0, 200) || "Нет описания"}...</p>
                            <p class="card-text"><small class="text-muted">Поставщик: ${supplierName}</small></p>
                            <p class="card-text"><small class="text-muted">Цена: ${product.price} ₽</small></p>
                            <p class="card-text"><small class="text-muted">Количество на складе: ${product.stock_quantity}</small></p>
                            <button class="btn btn-primary" ${!inStock ? "disabled" : ""}
                                onclick="addToCart('${product.product_id}')">
                                ${inStock ? "Добавить в корзину" : "Нет в наличии"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML += card;
    };
}

function addToCart(productId) {
    console.log("Добавление в корзину:", productId);
    const product = products.find(p => p.product_id === productId);
    const warehouseId = document.getElementById("warehouseSelect").value;
    if (!product) {
        console.error("Продукт не найден:", productId);
        return;
    }

    if (!warehouseId) {
        console.error("Склад не выбран.");
        alert("Пожалуйста, выберите склад перед добавлением товара в корзину.");
        return;
    }

    const existingItem = cart.find(item => item.product_id === productId && item.warehouse_id === warehouseId);
    if (existingItem) {
        if (existingItem.quantity < existingItem.max_quantity) {
            existingItem.quantity++;
        } else {
            alert("Достигнуто максимальное количество на складе");
        }
    } else {
        cart.push({
            product_id: product.product_id,
            name: product.name,
            price: product.price,
            quantity: 1,
            max_quantity: product.stock_quantity,
            warehouse_id: warehouseId,
            image_url: product.image_url
        });
    }
    console.log("Корзина обновлена:", cart);
    saveCartToStorage();
    renderCartIndicator(); // Обновляем индикатор корзины
}

// Сохранение корзины в localStorage
function saveCartToStorage() {
    localStorage.setItem("cart", JSON.stringify(cart));
}

// Загрузка корзины из localStorage
function loadCartFromStorage() {
    const savedCart = localStorage.getItem("cart");
    cart = savedCart ? JSON.parse(savedCart) : [];
}

function renderCartIndicator() {
    const cartButton = document.querySelector(".cart-button"); // Используем более специфичный селектор
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartButton) {
        cartButton.textContent = `Корзина (${totalItems})`;
    } else {
        console.warn("Кнопка корзины не найдена");
    }
}
// Функция сброса фильтров
function resetFilters() {
    console.log("Сбрасываем фильтры...");
    document.getElementById("minPriceRange").value = 0;
    document.getElementById("maxPriceRange").value = 10000;
    document.getElementById("inStockCheckbox").checked = false;
    document.getElementById("minPriceValue").textContent = "0";
    document.getElementById("maxPriceValue").textContent = "10000";
}

// ---- Получение информации о поставщике ----
async function fetchSupplierName(supplierId, token) {
    if (!supplierId) return "Неизвестен"; // Если нет ID, возвращаем "Неизвестен"

    try {
        const response = await fetch(`http://${window.location.hostname}:8002/suppliers/${supplierId}`, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            console.error(`Ошибка при получении имени поставщика: ${response.status}`);
            return "Неизвестен";
        }

        const supplierData = await response.json();
        return supplierData.name || "Неизвестен";
    } catch (error) {
        console.error("Ошибка при загрузке имени поставщика:", error);
        return "Неизвестен";
    }
}
