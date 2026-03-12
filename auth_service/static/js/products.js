//products.js
document.addEventListener("DOMContentLoaded", async function () {
    console.log("DOM fully loaded and parsed");
    const token = await getTokenFromDatabase();

    if (!token) {
        // Если токен недействителен, перенаправление на страницу логина уже выполнено
        return;
    }

    initializeProducts();

    document.querySelector("#add-new-product-btn").addEventListener("click", openAddProductModal);

    document.getElementById("add-product-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        console.log("Form submit intercepted");

        // Сброс сообщений об ошибках
        const errorFields = ["nameError", "descriptionError", "categoryError", "priceError", "stockQuantityError", "supplierError", "imageError", "weightError", "dimensionsError", "manufacturerError"];
        errorFields.forEach(id => document.getElementById(id).style.display = 'none');

        let valid = true;

        // Название продукта
        let name = document.getElementById("add-name").value.trim();
        if (!/^[а-яА-Яa-zA-Z0-9\s]{3,100}$/.test(name)) {
            console.log("Invalid name input");  // Лог ошибки имени
            document.getElementById("nameError").style.display = 'block';
            valid = false;
        }

        // Описание
        let description = document.getElementById("add-description").value.trim();
        if (description.length > 500) {
            console.log("Invalid description input");  // Лог ошибки описания
            document.getElementById("descriptionError").style.display = 'block';
            valid = false;
        }

        // Категория
        let category = document.getElementById("add-category").value.trim();
        if (category && (category.length > 50 || !/^[а-яА-Яa-zA-Z0-9]{1,50}$/.test(category))) {
            console.log("Invalid category input");  // Лог ошибки категории
            document.getElementById("categoryError").style.display = 'block';
            valid = false;
        }

        // Цена
        let price = document.getElementById("add-price").value.trim();
        price = price.replace(',', '.'); // Заменяем запятую на точку

        if (!price || isNaN(price) || parseFloat(price) <= 0 || parseFloat(price) > 1000000 || !/^\d{1,7}\.\d{2}$/.test(price)) {
            console.log("Invalid price input");  // Лог ошибки цены
            document.getElementById("priceError").style.display = 'block';
            valid = false;
        }

        // Количество продукта
        let stockQuantity = document.getElementById("add-stock-quantity").value;
        if (!/^\d+$/.test(stockQuantity) || parseInt(stockQuantity) < 0) {
            console.log("Invalid stock quantity input");  // Лог ошибки количества
            document.getElementById("stockQuantityError").style.display = 'block';
            valid = false;
        }

        // Изображение
        let imageUrl = document.getElementById("add-image-url").value;
        if (imageUrl && !/\.(png|jpeg|jpg)$/i.test(imageUrl)) {
            console.log("Invalid image input");  // Лог ошибки изображения
            document.getElementById("imageError").style.display = 'block';
            valid = false;
        }

        // Вес продукта
        let weight = document.getElementById("add-weight").value;
        weight = weight.replace(',', '.'); // Заменяем запятую на точку
        if (weight) {
            if (!/^\d{1,4}(\.\d{1,2})?$/.test(weight) || parseFloat(weight) <= 0 || parseFloat(price) > 1000000 || !/^\d{1,7}\.\d{2}$/.test(price)) {
                console.log("Invalid weight input");  // Лог ошибки веса
                document.getElementById("weightError").style.display = 'block';
                valid = false;
            }
        }

        // Габариты
        let dimensions = document.getElementById("add-dimensions").value.trim();
        if (dimensions) {
            if (dimensions.length > 100 || !/^\d+(\s*[xхXХ]\s*\d+){2}$/.test(dimensions)) {
                console.log("Invalid dimensions input");  // Лог ошибки габаритов
                document.getElementById("dimensionsError").style.display = 'block';
                valid = false;
            }
        }

        // Производитель
        let manufacturer = document.getElementById("add-manufacturer").value.trim();
        if (manufacturer && (!/^[а-яА-Яa-zA-Z0-9]{1,100}$/.test(manufacturer))) {
            console.log("Invalid manufacturer input");  // Лог ошибки производителя
            document.getElementById("manufacturerError").style.display = 'block';
            valid = false;
        }

        // Если все проверки пройдены, отправляем данные на сервер
        if (valid) {
            createProduct();
        } else {
            console.log("Form validation failed");
        }
    });

    document.getElementById("edit-product-form").addEventListener("submit", async (event) => {
        event.preventDefault();

        // Сброс сообщений об ошибках
        const errorFields = ["editnameError", "editdescriptionError", "editcategoryError", "editpriceError", "editstockQuantityError", "editimageError", "editweightError", "editdimensionsError", "editmanufacturerError"];
        errorFields.forEach(id => document.getElementById(id).style.display = 'none');

        let valid = true;

        // Название продукта
        let name = document.getElementById("edit-name").value.trim();
        if (!/^[а-яА-Яa-zA-Z0-9\s]{3,100}$/.test(name)) {
            console.log("Invalid name input");  // Лог ошибки имени
            document.getElementById("editnameError").style.display = 'block';
            valid = false;
        }

        // Описание
        let description = document.getElementById("edit-description").value.trim();
        if (description.length > 500) {
            console.log("Invalid description input");  // Лог ошибки описания
            document.getElementById("editdescriptionError").style.display = 'block';
            valid = false;
        }

        // Категория
        let category = document.getElementById("edit-category").value.trim();
        if (category && (category.length > 50 || !/^[а-яА-Яa-zA-Z0-9\s]*$/.test(category))) {
            console.log("Invalid category input");  // Лог ошибки категории
            document.getElementById("editcategoryError").style.display = 'block';
            valid = false;
        }

        // Цена
        let price = document.getElementById("edit-price").value.trim();
        price = price.replace(',', '.'); // Заменяем запятую на точку

        if (!price || isNaN(price) || parseFloat(price) <= 0 || parseFloat(price) > 1000000 || !/^\d{1,7}\.\d{2}$/.test(price)) {
            console.log("Invalid price input");  // Лог ошибки цены
            document.getElementById("editpriceError").style.display = 'block';
            valid = false;
        }

        // Количество продукта
        let stockQuantity = document.getElementById("edit-stock-quantity").value;
        if (!/^\d+$/.test(stockQuantity) || parseInt(stockQuantity) < 0) {
            console.log("Invalid stock quantity input");  // Лог ошибки количества
            document.getElementById("editstockQuantityError").style.display = 'block';
            valid = false;
        }

        // Изображение
        let imageUrl = document.getElementById("edit-image-url").value;
        if (imageUrl && !/\.(png|jpeg|jpg)$/i.test(imageUrl)) {
            console.log("Invalid image input");  // Лог ошибки изображения
            document.getElementById("editimageError").style.display = 'block';
            valid = false;
        }

        // Вес продукта
        let weight = document.getElementById("add-weight").value;
        weight = weight.replace(',', '.'); // Заменяем запятую на точку
        if (weight) {
            if (!/^\d{1,4}(\.\d{1,2})?$/.test(weight) || parseFloat(weight) <= 0 || parseFloat(price) > 1000000 || !/^\d{1,7}\.\d{2}$/.test(price)) {
                console.log("Invalid weight input");  // Лог ошибки веса
                document.getElementById("weightError").style.display = 'block';
                valid = false;
            }
        }

        // Габариты
        let dimensions = document.getElementById("edit-dimensions").value.trim();
        if (dimensions && !/^\d+(\s*[xхXХ]\s*\d+){2}$/.test(dimensions)) {
            console.log("Invalid dimensions input");  // Лог ошибки габаритов
            document.getElementById("dimensionsError").style.display = 'block';
            valid = false;
        }

        // Производитель
        let manufacturer = document.getElementById("edit-manufacturer").value.trim();
        if (manufacturer && !/^[а-яА-Яa-zA-Z0-9\s]{1,100}$/.test(manufacturer)) {
            console.log("Invalid manufacturer input");  // Лог ошибки производителя
            document.getElementById("editmanufacturerError").style.display = 'block';
            valid = false;
        }

        if (valid) {
            const productId = document.getElementById("edit-product-id").value;
            await updateProduct(productId);
        } else {
            console.log("Edit form validation failed");
        }
    });


    document.getElementById("products-table").addEventListener("click", (event) => {
        const target = event.target;
        const productId = target.dataset.id;

        if (target.classList.contains("btn-outline-warning")) {
            openEditProductModal(productId);
        } else if (target.classList.contains("btn-outline-danger")) {
            const confirmed = confirm("Вы уверены, что хотите удалить продукт?");
            if (confirmed) deleteProduct(productId);
        }
    });
});

function showNotification(message, type = "success", duration = 3000) {
    const notification = document.getElementById("notification");
    notification.textContent = message;

    // Устанавливаем класс в зависимости от типа уведомления
    notification.className = `alert alert-${type}`;
    notification.style.display = "block";

    // Прячем уведомление через `duration` миллисекунд
    setTimeout(() => {
        notification.style.display = "none";
    }, duration);
}

function openAddProductModal() {
    document.getElementById("add-product-form").reset();
    loadSuppliers("#add-supplier-id");  // Загрузка списка поставщиков для выбора
    $("#addProductModal").modal("show");
}

async function openEditProductModal(productId) {
    const token = await getTokenFromDatabase();
    const response = await fetch(`http://${window.location.hostname}:8002/products/${productId}`, {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        console.error("Ошибка при получении данных продукта:", response.status);
        return;
    }

    const product = await response.json();

    document.getElementById("edit-product-id").value = product.product_id;
    document.getElementById("edit-name").value = product.name;
    document.getElementById("edit-description").value = product.description || "";
    document.getElementById("edit-category").value = product.category || "";
    document.getElementById("edit-price").value = product.price;
    document.getElementById("edit-stock-quantity").value = product.stock_quantity;
    loadSuppliers("#edit-supplier-id", product.supplier_id);  // Загрузка списка поставщиков с текущим значением
    document.getElementById("edit-weight").value = product.weight || "";
    document.getElementById("edit-dimensions").value = product.dimensions || "";
    document.getElementById("edit-manufacturer").value = product.manufacturer || "";

    $("#editProductModal").modal("show");
}

async function initializeProducts() {
    const token = await getTokenFromDatabase();
    await loadProducts(token);
}

async function loadProducts(token) {
    const response = await fetch(`http://${window.location.hostname}:8002/products/`, {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });

    const products = await response.json();
    renderProductsTable(products);
}

async function createProduct() {
    const token = await getTokenFromDatabase();
    const supplierId = document.getElementById("add-supplier-id").value;

    const productData = {
        name: document.getElementById("add-name").value.trim(),
        description: document.getElementById("add-description").value.trim() || null,
        category: document.getElementById("add-category").value.trim() || null,
        price: document.getElementById("add-price").value.trim() || null,
        stock_quantity: parseInt(document.getElementById("add-stock-quantity").value) || null,
        supplier_id: supplierId,  // Передаем выбранный supplier_id
        weight: document.getElementById("add-weight").value || null,
        dimensions: document.getElementById("add-dimensions").value.trim() || null,
        manufacturer: document.getElementById("add-manufacturer").value.trim() || null,
    };

    try {
        const response = await fetch(`http://${window.location.hostname}:8002/products/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(productData)
        });

        if (response.ok) {
            // Закрываем всплывающее окно
            $("#addProductModal").modal("hide");

            // Очищаем форму
            document.getElementById("add-product-form").reset();

            // Загружаем обновленный список продуктов
            await loadProducts(token);

            // Показываем уведомление об успешном добавлении
            showNotification("Продукт успешно добавлен!");
        } else {
            // Обработка ошибки
            const errorData = await response.json();
            console.error("Ошибка при добавлении продукта:", errorData);
            showNotification("Ошибка при добавлении продукта", "danger");
        }
    } catch (error) {
        console.error("Ошибка при выполнении запроса:", error);
        showNotification("Ошибка при добавлении продукта", "danger");
    }
}

async function updateProduct(productId) {
    const token = await getTokenFromDatabase();
    const productData = {
        name: document.getElementById("edit-name").value.trim(),
        description: document.getElementById("edit-description").value.trim() || null,
        category: document.getElementById("edit-category").value.trim() || null,
        price: document.getElementById("edit-price").value.trim() || null,
        stock_quantity: parseInt(document.getElementById("edit-stock-quantity").value) || null,
        supplier_id: document.getElementById("edit-supplier-id").value,
        weight: document.getElementById("edit-weight").value || null,
        dimensions: document.getElementById("edit-dimensions").value.trim() || null,
        manufacturer: document.getElementById("edit-manufacturer").value.trim() || null,
    };

    await fetch(`http://${window.location.hostname}:8002/products/${productId}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(productData)
    });

    $("#editProductModal").modal("hide");
    loadProducts(token);
}

async function deleteProduct(productId) {
    const token = await getTokenFromDatabase();
    await fetch(`http://${window.location.hostname}:8002/products/${productId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
    });
    loadProducts(token);
}

function renderProductsTable(products) {
    const tableBody = document.querySelector("#products-table tbody");
    tableBody.innerHTML = "";

    products.forEach((product) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${product.product_id}</td>
            <td>${product.name}</td>
            <td>${product.description || ""}</td>
            <td>${product.category || ""}</td>
            <td>${product.price + " руб" || ""}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-warning mt-2" data-id="${product.product_id}">Редактировать</button>
                <button class="btn btn-sm btn-outline-danger mt-2" data-id="${product.product_id}">Удалить</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

async function loadSuppliers(selectorId, selectedSupplierId = null) {
    const token = await getTokenFromDatabase();
    const response = await fetch(`http://${window.location.hostname}:8002/suppliers/`, {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });

    const suppliers = await response.json();
    const select = document.querySelector(selectorId);
    select.innerHTML = `<option value="" disabled selected>Выберите поставщика</option>`;

    suppliers.forEach((supplier) => {
        const option = document.createElement("option");
        option.value = supplier.supplier_id;
        option.textContent = supplier.name;
        if (supplier.id === selectedSupplierId) option.selected = true;
        select.appendChild(option);
    });
    console.log("Поставщики загружены в выпадающий список:", suppliers);
}

async function searchProduct() {
    const token = await getTokenFromDatabase();
    const searchQuery = document.getElementById("search-name").value.trim();

    const response = await fetch(`http://${window.location.hostname}:8002/search_products/?name=${encodeURIComponent(searchQuery)}`, {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });

    if (response.ok) {
        const products = await response.json();
        renderProductsTable(products);
    } else {
        console.error("Ошибка при поиске продукта:", response.status);
    }
}