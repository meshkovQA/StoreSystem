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

        if (!price ||
            isNaN(price) ||
            parseFloat(price) <= 0 ||
            parseFloat(price) > 9999999.99) {

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
            let pattern = /^\d+x\d+x\d+$/;
            if (dimensions.length > 100 || !pattern.test(dimensions)) {
                console.log("Invalid dimensions input");  // Лог ошибки габаритов
                document.getElementById("dimensionsError").style.display = 'block';
                valid = false;
            } else {
                document.getElementById("dimensionsError").style.display = 'none';
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

        if (!price ||
            isNaN(price) ||
            parseFloat(price) <= 0 ||
            parseFloat(price) > 9999999.99) {

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
        let weight = document.getElementById("edit-weight").value;
        weight = weight.replace(',', '.'); // Заменяем запятую на точку
        if (weight) {
            if (!/^\d{1,4}(\.\d{1,2})?$/.test(weight) || parseFloat(weight) <= 0 || parseFloat(price) > 1000000 || !/^\d{1,7}\.\d{2}$/.test(price)) {
                console.log("Invalid weight input");  // Лог ошибки веса
                document.getElementById("editweightError").style.display = 'block';
                valid = false;
            }
        }

        // Габариты
        let dimensions = document.getElementById("edit-dimensions").value.trim();
        if (dimensions) {
            let pattern = /^\d+x\d+x\d+$/;
            if (dimensions.length > 100 || !pattern.test(dimensions)) {
                console.log("Invalid dimensions input");  // Лог ошибки габаритов
                document.getElementById("editdimensionsError").style.display = 'block';
                valid = false;
            } else {
                document.getElementById("editdimensionsError").style.display = 'none';
            }
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
    const response = await fetch(`http://localhost:8002/products/${productId}`, {
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
    const response = await fetch("http://localhost:8002/products/", {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });

    const products = await response.json();
    renderProductsTable(products);
}

async function uploadImage(imageFile) {
    const token = await getTokenFromDatabase();
    const formData = new FormData();
    formData.append("file", imageFile);
    console.log("Форма данных для загрузки изображения:", formData);

    const response = await fetch("http://localhost:8002/upload", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`
        },
        body: formData
    });

    if (!response.ok) {
        throw new Error("Ошибка загрузки изображения");
    }

    const data = await response.json();
    console.log("Данные изображения:", data);

    return data.imageUrl; // Возвращаем URL изображения
}

async function createProduct() {
    const token = await getTokenFromDatabase();
    const supplierId = document.getElementById("add-supplier-id").value;
    const imageFile = document.getElementById("add-image-url").files[0];
    console.log("Получен файл изображения:", imageFile);

    let imageUrl = null;
    if (imageFile) {
        try {
            imageUrl = await uploadImage(imageFile);
            console.log(imageUrl);
        } catch (error) {
            console.error(error);
            showNotification("Ошибка загрузки изображения", "danger");
            return;
        }
    }

    const productData = {
        name: document.getElementById("add-name").value.trim(),
        description: document.getElementById("add-description").value.trim() || null,
        category: document.getElementById("add-category").value.trim() || null,
        price: document.getElementById("add-price").value.trim(),
        stock_quantity: parseInt(document.getElementById("add-stock-quantity").value),
        supplier_id: supplierId,  // Передаем выбранный supplier_id
        image_url: imageUrl || null,  // Передаем URL изображения
        weight: document.getElementById("add-weight").value || null,
        dimensions: document.getElementById("add-dimensions").value.trim() || null,
        manufacturer: document.getElementById("add-manufacturer").value.trim() || null,
    };

    try {
        const response = await fetch("http://localhost:8002/products/", {
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
    const imageFile = document.getElementById("edit-image-url").files[0];

    let imageUrl = null;
    if (imageFile) {
        try {
            imageUrl = await uploadImage(imageFile);
        } catch (error) {
            console.error(error);
            showNotification("Ошибка загрузки изображения", "danger");
            return;
        }
    }

    const productData = {
        name: document.getElementById("edit-name").value.trim(),
        description: document.getElementById("edit-description").value.trim() || null,
        category: document.getElementById("edit-category").value.trim() || null,
        price: document.getElementById("edit-price").value.trim(),
        stock_quantity: parseInt(document.getElementById("edit-stock-quantity").value),
        supplier_id: document.getElementById("edit-supplier-id").value,
        image_url: imageUrl || null,
        weight: document.getElementById("edit-weight").value || null,
        dimensions: document.getElementById("edit-dimensions").value.trim() || null,
        manufacturer: document.getElementById("edit-manufacturer").value.trim() || null,
    };

    await fetch(`http://localhost:8002/products/${productId}`, {
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
    await fetch(`http://localhost:8002/products/${productId}`, {
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
            <td><a href="#" class="product-name" data-id="${product.product_id}">${product.name}</a></td>
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

    // Добавляем обработчик клика на название продукта
    document.querySelectorAll(".product-name").forEach((link) => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            const productId = link.dataset.id;
            openProductDetailsModal(productId);
        });
    });
}

async function loadSuppliers(selectorId, selectedSupplierId = null) {
    const token = await getTokenFromDatabase();
    const response = await fetch("http://localhost:8002/suppliers/", {
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

    const response = await fetch(`http://localhost:8002/search_products/?name=${encodeURIComponent(searchQuery)}`, {
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

async function openProductDetailsModal(productId) {
    const token = await getTokenFromDatabase();

    // Удаляем существующее модальное окно, если оно есть
    const existingModal = document.getElementById("productDetailsModal");
    if (existingModal) {
        existingModal.remove();
    }

    // Удаляем backdrop, если остался
    const existingBackdrop = document.querySelector(".modal-backdrop");
    if (existingBackdrop) {
        existingBackdrop.remove();
    }

    const response = await fetch(`http://localhost:8002/products/${productId}`, {
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

    // Создаем модальное окно с подробной информацией о продукте
    const modalContent = `
        <div class="modal fade" id="productDetailsModal" tabindex="-1" aria-labelledby="productDetailsModalLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="productDetailsModalLabel">${product.name}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p><strong>Описание:</strong> ${product.description || "Нет описания"}</p>
                        <p><strong>Категория:</strong> ${product.category || "Нет категории"}</p>
                        <p><strong>Цена:</strong> ${product.price} руб</p>
                        <p><strong>Количество на складе:</strong> ${product.stock_quantity}</p>
                        <p><strong>Поставщик:</strong> ${product.supplier_id}</p>
                        <p><strong>Вес:</strong> ${product.weight || "Нет данных"} кг</p>
                        <p><strong>Габариты:</strong> ${product.dimensions || "Нет данных"}</p>
                        <p><strong>Производитель:</strong> ${product.manufacturer || "Нет данных"}</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Вставляем модальное окно в DOM
    document.body.insertAdjacentHTML("beforeend", modalContent);

    // Открываем модальное окно
    const productDetailsModalElement = document.getElementById("productDetailsModal");
    const productDetailsModal = new bootstrap.Modal(productDetailsModalElement);
    productDetailsModal.show();

    // Добавляем обработчик события для закрытия модального окна
    productDetailsModalElement.addEventListener("hidden.bs.modal", () => {
        productDetailsModalElement.remove();
        // Удаляем backdrop после закрытия
        const backdrop = document.querySelector(".modal-backdrop");
        if (backdrop) {
            backdrop.remove();
        }
        document.body.classList.remove("modal-open");
        document.body.style.removeProperty("padding-right");
    });
}