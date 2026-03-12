// Инициализация загрузки продуктов
document.addEventListener("DOMContentLoaded", async function () {
    const token = await getTokenFromDatabase();

    if (!token) {
        // Перенаправляем на страницу логина, если токен отсутствует
        window.location.href = '/login';
        return;
    }

    const warehouseId = getWarehouseIdFromUrl();

    if (!warehouseId) {
        alert("Идентификатор склада не найден в URL.");
        return;
    }

    // Загрузка информации о складе
    loadWarehouseInfo(warehouseId);
    // Загрузка информации о продуктах на складе

    const products = await fetchProductsFromWarehouse(warehouseId, token);
    renderProductsTable(products);

    // Инициализация события для добавления продукта
    document.getElementById("add-product-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        await addProductToWarehouse(warehouseId);
    });
});

// Функция для извлечения warehouse_id из URL
function getWarehouseIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.pathname);
    const pathParts = window.location.pathname.split("/");
    return pathParts[pathParts.length - 1]; // Последний элемент пути
}

// Функция для загрузки информации о складе
async function loadWarehouseInfo(warehouseId) {
    const token = await getTokenFromDatabase();
    const response = await fetch(`http://${window.location.hostname}:8002/warehouses/${warehouseId}`, {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        alert("Ошибка загрузки информации о складе");
        return;
    }

    const warehouse = await response.json();

    // Отображение информации о складе на странице (если нужно обновить данные)
    document.querySelector("h2").textContent = `Склад: ${warehouse.location}`;
    document.getElementById("warehouse-manager-name").textContent = warehouse.manager_name || 'Не указано';
    document.getElementById("warehouse-capacity").textContent = warehouse.capacity;
    document.getElementById("warehouse-current-stock").textContent = warehouse.current_stock || 0;
    document.getElementById("warehouse-contact-number").textContent = warehouse.contact_number || 'Не указан';
    document.getElementById("warehouse-email").textContent = warehouse.email || 'Не указан';
    document.getElementById("warehouse-is-active").textContent = warehouse.is_active ? "Активен" : "Неактивен";
    document.getElementById("warehouse-area-size").textContent = warehouse.area_size || 'Не указана';
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

    const products = [];

    // Последовательно загружаем информацию о каждом продукте
    for (const productWarehouse of productsInWarehouse) {
        const productDetails = await fetchProductDetails(productWarehouse.product_id, token);
        if (productDetails) {
            products.push({
                ...productDetails,
                stock_quantity: productWarehouse.quantity, // Количество со склада
                product_warehouse_id: productWarehouse.product_warehouse_id
            });
        } else {
            console.warn("Не удалось загрузить данные для продукта:", productWarehouse.product_id);
        }
    }

    console.log("Все загруженные продукты:", products);
    return products;
}

// ---- Получение деталей продукта ----
async function fetchProductDetails(productId, token) {
    const response = await fetch(`http://${window.location.hostname}:8002/products/${productId}`, {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        console.error("Ошибка при загрузке данных продукта:", productId, response.status);
        return null;
    }

    return await response.json();
}

// Заполнение таблицы продуктов
function renderProductsTable(products) {
    const tableBody = document.querySelector("#products-table tbody");
    tableBody.innerHTML = "";

    if (products.length === 0) {
        tableBody.innerHTML = `
            <tr><td colspan="4" class="text-center">На данном складе продуктов пока нет</td></tr>
        `;
        return;
    }

    products.forEach((product) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${product.product_id}</td>
            <td>${product.name}</td>
            <td>${product.stock_quantity}</td>
            <td>
                <button class="btn btn-sm btn-warning" onclick="openEditProductModal('${product.product_warehouse_id}', '${product.product_id}')">Редактировать</button>
                <button class="btn btn-sm btn-danger" onclick="deleteProduct('${product.product_warehouse_id}', '${product.product_id}')">Удалить</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}


// Открытие модального окна добавления продукта
function openAddProductModal() {
    document.getElementById("add-product-form").reset();
    $("#addProductModal").modal("show");
}

// Обработка добавления нового продукта
async function addProductToWarehouse(warehouseId) {
    const token = await getTokenFromDatabase();
    const productId = document.getElementById("product-id").value;
    const quantity = parseInt(document.getElementById("product-quantity").value);

    const response = await fetch(`http://${window.location.hostname}:8002/productinwarehouses?warehouse_id=${warehouseId}&product_id=${productId}&quantity=${quantity}`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });

    const result = await response.json();

    if (response.ok) {
        alert("Товар успешно добавлен на склад");
        const warehouseId = getWarehouseIdFromUrl();
        const products = await fetchProductsFromWarehouse(warehouseId, token);
        renderProductsTable(products);
        $("#addProductModal").modal("hide");
    } else {
        alert(`Ошибка добавления товара: ${result.detail || "Неизвестная ошибка"}`);
    }
}

// Пагинация
function renderPagination(totalPages, currentPage) {
    const pagination = document.getElementById("pagination");
    pagination.innerHTML = "";

    for (let i = 1; i <= totalPages; i++) {
        const pageItem = document.createElement("li");
        pageItem.className = "page-item" + (i === currentPage ? " active" : "");
        pageItem.innerHTML = `<a class="page-link" href="#" onclick="loadProducts(${i})">${i}</a>`;
        pagination.appendChild(pageItem);
    }
}

// Открытие модального окна для редактирования продукта
function openEditProductModal(productWarehouseId, productId) {
    const quantity = prompt("Введите новое количество:");
    if (quantity && quantity > 0) {
        updateProductQuantity(productWarehouseId, productId, parseInt(quantity));
    }
}

// Обновление количества продукта на складе
async function updateProductQuantity(productWarehouseId, productId, quantity) {
    const token = await getTokenFromDatabase();
    const url = `http://${window.location.hostname}:8002/productinwarehouses/${productId}?product_warehouse_id=${productWarehouseId}&quantity=${quantity}`;

    const response = await fetch(url, {
        method: "PUT",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });

    const result = await response.json();

    if (response.ok) {
        alert("Количество товара успешно обновлено");
        const warehouseId = getWarehouseIdFromUrl();
        const products = await fetchProductsFromWarehouse(warehouseId, token);
        renderProductsTable(products);
    } else {
        alert(`Ошибка обновления товара: ${result.detail || "Неизвестная ошибка"}`);
    }
}

// Удаление продукта со склада
async function deleteProduct(productWarehouseId, productId) {
    const confirmed = confirm("Вы уверены, что хотите удалить этот товар?");
    if (!confirmed) return;

    const token = await getTokenFromDatabase();
    const url = `http://${window.location.hostname}:8002/productinwarehouses/${productId}?product_warehouse_id=${productWarehouseId}`;

    const response = await fetch(url, {
        method: "DELETE",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });

    if (response.ok) {
        alert("Товар успешно удален со склада");
        const warehouseId = getWarehouseIdFromUrl();
        const products = await fetchProductsFromWarehouse(warehouseId, token);
        renderProductsTable(products);
    } else if (response.status === 404) {
        alert("Продукт с указанным ID не найден. Удаление невозможно.");
    } else {
        alert("Ошибка удаления товара");
    }
}