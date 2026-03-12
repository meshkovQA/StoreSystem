document.addEventListener("DOMContentLoaded", async function () {
    const token = await getTokenFromDatabase();

    if (!token) {
        // Перенаправляем на страницу логина, если токен отсутствует
        window.location.href = '/login';
        return;
    }

    initializeWarehouses();

    // Открытие модального окна создания нового склада
    document.querySelector("#add-new-warehouse-btn").addEventListener("click", openAddWarehouseModal);

    // Обработчик для создания нового склада
    document.getElementById("add-warehouse-form").addEventListener("submit", async (event) => {
        event.preventDefault();

        // Сброс сообщений об ошибках
        const errorFields = ["addLocationError", "addManagerNameError", "addCapacityError", "addContactNumberError", "addEmailError", "addIsActiveError", "addAreaSizeError"];
        errorFields.forEach(id => document.getElementById(id).style.display = 'none');

        let valid = true;

        // Местоположение склада (location)
        let location = document.getElementById("add-location").value.trim();
        if (!location || location.length > 255) {
            document.getElementById("addLocationError").style.display = 'block';
            valid = false;
        }

        // Имя управляющего (manager_name)
        let managerName = document.getElementById("add-manager-name").value.trim();
        if (managerName && (managerName.length > 100 || !/^[A-Za-zА-Яа-я\s]+$/.test(managerName))) {
            document.getElementById("addManagerNameError").style.display = 'block';
            valid = false;
        }

        // Вместимость склада (capacity)
        let capacity = document.getElementById("add-capacity").value.trim();
        if (!capacity || isNaN(capacity) || parseFloat(capacity) <= 0) {
            document.getElementById("addCapacityError").style.display = 'block';
            valid = false;
        }

        // Контактный телефон (contact_number)
        let contactNumber = document.getElementById("add-contact-number").value.trim();
        if (contactNumber && (contactNumber.length > 15 || !/^\+?\d+$/.test(contactNumber))) {
            document.getElementById("addContactNumberError").style.display = 'block';
            valid = false;
        }

        // Контактный email (email)
        let email = document.getElementById("add-email").value.trim();
        if (email && (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
            document.getElementById("addEmailError").style.display = 'block';
            valid = false;
        }

        // Активность склада (is_active)
        let isActive = document.getElementById("add-is-active").value;
        if (isActive !== "active" && isActive !== "inactive") {
            document.getElementById("addIsActiveError").style.display = 'block';
            valid = false;
        }

        // Площадь склада (area_size)
        let areaSize = document.getElementById("add-area-size").value.trim();
        areaSize = areaSize.replace(',', '.'); // Заменяем запятую на точку


        if (areaSize && (isNaN(areaSize) || parseFloat(areaSize) <= 0 || parseFloat(areaSize) > 1000000 || !/^\d{1,7}\.\d{2}$/.test(areaSize))) {
            document.getElementById("addAreaSizeError").style.display = 'block';
            valid = false;
        }

        if (valid) {
            await createWarehouse();
            $("#addWarehouseModal").modal("hide");
        }
    });

    // Обработчик для редактирования склада
    document.getElementById("edit-warehouse-form").addEventListener("submit", async (event) => {
        event.preventDefault();

        // Сброс сообщений об ошибках
        const errorFields = ["editLocationError", "editManagerNameError", "editCapacityError", "editContactNumberError", "editEmailError", "editIsActiveError", "editAreaSizeError"];
        errorFields.forEach(id => document.getElementById(id).style.display = 'none');

        let valid = true;

        // Местоположение склада (location)
        let location = document.getElementById("edit-location").value.trim();
        if (!location || location.length > 255) {
            document.getElementById("editLocationError").style.display = 'block';
            valid = false;
        }

        // Имя управляющего (manager_name)
        let managerName = document.getElementById("edit-manager-name").value.trim();
        if (managerName && (managerName.length > 100 || !/^[A-Za-zА-Яа-я\s]+$/.test(managerName))) {
            document.getElementById("editManagerNameError").style.display = 'block';
            valid = false;
        }

        // Вместимость склада (capacity)
        let capacity = document.getElementById("edit-capacity").value.trim();
        if (!capacity || isNaN(capacity) || parseFloat(capacity) <= 0) {
            document.getElementById("editCapacityError").style.display = 'block';
            valid = false;
        }

        // Контактный телефон (contact_number)
        let contactNumber = document.getElementById("edit-contact-number").value.trim();
        if (contactNumber && (contactNumber.length > 15 || !/^\+?\d+$/.test(contactNumber))) {
            document.getElementById("editContactNumberError").style.display = 'block';
            valid = false;
        }

        // Контактный email (email)
        let email = document.getElementById("edit-email").value.trim();
        if (email && (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
            document.getElementById("editEmailError").style.display = 'block';
            valid = false;
        }

        // Активность склада (is_active)
        let isActive = document.getElementById("edit-is-active").value;
        if (isActive !== "active" && isActive !== "inactive") {
            document.getElementById("editIsActiveError").style.display = 'block';
            valid = false;
        }

        // Площадь склада (area_size)
        let editAreaSize = document.getElementById("edit-area-size").value.trim();
        editAreaSize = editAreaSize.replace(',', '.'); // Заменяем запятую на точку


        if (editAreaSize && (isNaN(editAreaSize) || parseFloat(editAreaSize) <= 0 || parseFloat(editAreaSize) > 1000000 || !/^\d{1,7}\.\d{2}$/.test(editAreaSize))) {
            document.getElementById("editAreaSizeError").style.display = 'block';
            valid = false;
        }

        if (valid) {
            const warehouseId = document.getElementById("edit-warehouse-id").value;
            await updateWarehouse(warehouseId);
            $("#editWarehouseModal").modal("hide");
        }
    });

    // Добавляем обработчик для кнопок "Посмотреть", "Редактировать" и "Удалить" в таблице
    document.getElementById("warehouses-table").addEventListener("click", (event) => {
        const target = event.target;
        const warehouseId = target.getAttribute("data-id");

        if (target.classList.contains("btn-outline-info")) {
            // Открытие модального окна для просмотра информации о складе
            openViewWarehouseModal(warehouseId);
        } else if (target.classList.contains("btn-outline-warning")) {
            // Открытие модального окна для редактирования склада
            openEditWarehouseModal(warehouseId);
        } else if (target.classList.contains("btn-outline-danger")) {
            // Запрос на подтверждение удаления склада
            const confirmed = confirm("Вы уверены, что хотите удалить склад?");
            if (confirmed) deleteWarehouse(warehouseId);
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

// Открытие модального окна для просмотра информации о складе
async function openViewWarehouseModal(warehouseId) {
    const token = await getTokenFromDatabase();
    const response = await fetch(`http://${window.location.hostname}:8002/warehouses/${warehouseId}`, {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });

    const warehouse = await response.json();

    document.getElementById("view-warehouse-id").value = warehouse.warehouse_id;
    document.getElementById("view-location").value = warehouse.location;
    document.getElementById("view-manager-name").value = warehouse.manager_name || "";
    document.getElementById("view-capacity").value = warehouse.capacity;
    document.getElementById("view-current-stock").value = warehouse.current_stock || 0;
    document.getElementById("view-contact-number").value = warehouse.contact_number || "";
    document.getElementById("view-email").value = warehouse.email || "";
    document.getElementById("view-is-active").value = warehouse.is_active ? "Активен" : "Неактивен";
    document.getElementById("view-area-size").value = warehouse.area_size || "";

    // Открытие модального окна
    $("#viewWarehouseModal").modal("show");
}

// Открытие модального окна для добавления нового склада
function openAddWarehouseModal() {
    document.getElementById("add-warehouse-form").reset();
    $("#addWarehouseModal").modal("show");
}

// Открытие модального окна для редактирования склада
async function openEditWarehouseModal(warehouseId) {
    const token = await getTokenFromDatabase();
    const response = await fetch(`http://${window.location.hostname}:8002/warehouses/${warehouseId}`, {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });

    const warehouse = await response.json();

    // Заполняем поля формы редактирования данными склада
    document.getElementById("edit-warehouse-id").value = warehouse.warehouse_id;
    document.getElementById("edit-location").value = warehouse.location;
    document.getElementById("edit-manager-name").value = warehouse.manager_name || "";
    document.getElementById("edit-capacity").value = warehouse.capacity;
    document.getElementById("edit-current-stock").value = warehouse.current_stock || 0;
    document.getElementById("edit-contact-number").value = warehouse.contact_number || "";
    document.getElementById("edit-email").value = warehouse.email || "";
    document.getElementById("edit-is-active").value = warehouse.is_active ? "active" : "inactive";
    document.getElementById("edit-area-size").value = warehouse.area_size || "";

    // Открываем модальное окно для редактирования
    $("#editWarehouseModal").modal("show");
}

// Инициализация складов с использованием токена
async function initializeWarehouses() {
    const token = await getTokenFromDatabase();
    await loadWarehouses(token);
}

// Загрузка складов
async function loadWarehouses(token) {
    const response = await fetch(`http://${window.location.hostname}:8002/warehouses/`, {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });

    const warehouses = await response.json();
    renderWarehousesTable(warehouses);
}

// Создание склада
async function createWarehouse() {
    const token = await getTokenFromDatabase();
    const warehouseData = {
        location: document.getElementById("add-location").value.trim(),
        manager_name: document.getElementById("add-manager-name").value.trim() || null,
        capacity: parseInt(document.getElementById("add-capacity").value.trim()),
        current_stock: parseInt(document.getElementById("add-current-stock").value.trim()) || 0,
        contact_number: document.getElementById("add-contact-number").value.trim() || null,
        email: document.getElementById("add-email").value.trim() || null,
        is_active: document.getElementById("add-is-active").value === "active",
        area_size: parseFloat(document.getElementById("add-area-size").value.trim()) || null,
    };

    try {
        const response = await fetch(`http://${window.location.hostname}:8002/warehouses/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(warehouseData)
        });

        if (response.ok) {
            // Закрываем модальное окно
            $("#addWarehouseModal").modal("hide");

            // Очищаем форму
            document.getElementById("add-warehouse-form").reset();

            // Обновляем список складов
            await loadWarehouses(token);

            // Показываем уведомление об успешном добавлении
            showNotification("Склад успешно добавлен!");
        } else {
            // Обработка ошибки
            const errorData = await response.json();
            console.error("Ошибка при добавлении склада:", errorData);
            showNotification("Ошибка при добавлении склада", "danger");
        }
    } catch (error) {
        console.error("Ошибка при выполнении запроса:", error);
        showNotification("Ошибка при добавлении склада", "danger");
    }
}

// Обновление склада
async function updateWarehouse(warehouseId) {
    const token = await getTokenFromDatabase();
    const warehouseData = {
        location: document.getElementById("edit-location").value.trim(),
        manager_name: document.getElementById("edit-manager-name").value.trim() || null,
        capacity: parseInt(document.getElementById("edit-capacity").value.trim()),
        current_stock: parseInt(document.getElementById("edit-current-stock").value.trim()),
        contact_number: document.getElementById("edit-contact-number").value.trim() || null,
        email: document.getElementById("edit-email").value.trim() || null,
        is_active: document.getElementById("edit-is-active").value === "active",
        area_size: parseFloat(document.getElementById("edit-area-size").value.trim()) || null,
    };

    try {
        const response = await fetch(`http://${window.location.hostname}:8002/warehouses/${warehouseId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(warehouseData)
        });

        if (response.ok) {
            // Закрываем модальное окно и обновляем список складов
            $("#editWarehouseModal").modal("hide");
            await loadWarehouses(token);
            showNotification("Склад успешно обновлен!");
        } else {
            const errorData = await response.json();
            let errorMessage = "Ошибка при обновлении склада";
            if (errorData.detail) {
                errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
            }
            showNotification(errorMessage, "danger", 5000);
        }
    } catch (error) {
        console.error("Ошибка при выполнении запроса:", error);
        showNotification("Ошибка при обновлении склада", "danger");
    }
}

// Удаление склада
async function deleteWarehouse(warehouseId) {
    const token = await getTokenFromDatabase();
    try {
        const response = await fetch(`http://${window.location.hostname}:8002/warehouses/${warehouseId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!response.ok) {
            const error = await response.json();
            showNotification(error.detail || "Ошибка при удалении склада", "danger");
            return;
        }

        showNotification("Склад успешно удален", "success");
        loadWarehouses(token);
    } catch (error) {
        showNotification("Ошибка подключения к серверу", "danger");
    }
}

// Заполнение таблицы складов
function renderWarehousesTable(warehouses) {
    const tableBody = document.querySelector("#warehouses-table tbody");
    tableBody.innerHTML = "";

    warehouses.forEach((warehouse) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${warehouse.location}</td>
            <td>${warehouse.manager_name || ""}</td>
            <td>${warehouse.capacity + " куб.м"}</td>
            <td>${warehouse.current_stock || 0}</td>
            <td>${warehouse.is_active ? "Активен" : "Неактивен"}</td>
            <td>${warehouse.area_size + " кв.м" || ""}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-info" data-id="${warehouse.warehouse_id}">Посмотреть</button>
                <button class="btn btn-sm btn-outline-warning" data-id="${warehouse.warehouse_id}">Редактировать</button>
                <button class="btn btn-sm btn-outline-danger" data-id="${warehouse.warehouse_id}">Удалить</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function viewWarehouseProducts() {
    const warehouseId = document.getElementById("view-warehouse-id").value;
    window.open(`/warehouses_detail/${warehouseId}`, '_blank');
}