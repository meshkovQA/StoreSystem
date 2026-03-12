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
    loadProducts(warehouseId);

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

// Функция для загрузки продуктов на складе с учетом пагинации
async function loadProducts(warehouseId, page = 1) {
    const token = await getTokenFromDatabase();
    const response = await fetch(`http://${window.location.hostname}:8002/productinwarehouses/${warehouseId}?page=${page}`, {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });

    if (response.status === 404) {
        document.querySelector("#products-table tbody").innerHTML = `
            <tr><td colspan="4" class="text-center">На данном складе продуктов пока нет</td></tr>
        `;
        document.getElementById("pagination").innerHTML = ""; // Очищаем пагинацию
        return;
    }

    if (!response.ok) {
        alert("Ошибка загрузки продуктов");
        return;
    }

    const data = await response.json();
    renderProductsTable(data.products);
    renderPagination(data.total_pages, page);
}

// Заполнение таблицы продуктов
function renderProductsTable(products) {
    const tableBody = document.querySelector("#products-table tbody");
    tableBody.innerHTML = "";

    products.forEach((product) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${product.product_id}</td>
            <td>${product.name}</td>
            <td>${product.quantity}</td>
            <td>
                <button class="btn btn-sm btn-warning" onclick="openEditProductModal('${product.product_warehouse_id}')">Редактировать</button>
                <button class="btn btn-sm btn-danger" onclick="deleteProduct('${product.product_warehouse_id}')">Удалить</button>
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

    if (response.ok) {
        alert("Товар успешно добавлен на склад");
        loadProducts();
        $("#addProductModal").modal("hide");
    } else {
        alert("Ошибка добавления товара");
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
function openEditProductModal(productWarehouseId) {
    const quantity = prompt("Введите новое количество:");
    if (quantity && quantity > 0) {
        updateProductQuantity(productWarehouseId, parseInt(quantity));
    }
}

// Обновление количества продукта на складе
async function updateProductQuantity(productWarehouseId, quantity) {
    const token = await getTokenFromDatabase();
    const response = await fetch(`http://${window.location.hostname}:8002/productinwarehouses/${productWarehouseId}`, {
        method: "PUT",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ quantity })
    });

    if (response.ok) {
        alert("Количество товара успешно обновлено");
        loadProducts();
    } else {
        alert("Ошибка обновления товара");
    }
}

// Удаление продукта со склада
async function deleteProduct(productWarehouseId) {
    const confirmed = confirm("Вы уверены, что хотите удалить этот товар?");
    if (!confirmed) return;

    const token = await getTokenFromDatabase();
    const response = await fetch(`http://${window.location.hostname}:8002/productinwarehouses/${productWarehouseId}`, {
        method: "DELETE",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });

    if (response.ok) {
        alert("Товар успешно удален со склада");
        loadProducts();
    } else {
        alert("Ошибка удаления товара");
    }
}

