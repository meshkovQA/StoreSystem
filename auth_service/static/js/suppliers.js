document.addEventListener("DOMContentLoaded", async function () {
    const token = await getTokenFromDatabase();

    if (!token) {
        // Перенаправляем на страницу логина, если токен отсутствует
        window.location.href = '/login';
        return;
    }

    initializeSuppliers();

    // Открытие модального окна создания нового поставщика
    document.querySelector("#add-new-supplier-btn").addEventListener("click", openAddModal);

    // Обработчик для создания нового поставщика
    document.getElementById("add-supplier-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        // Сброс сообщений об ошибках
        const errorFields = ["addNameError", "addContactNameError", "addContactEmailError", "addPhoneNumberError", "addAddressError", "addCountryError", "addCityError", "addWebsiteError"];
        errorFields.forEach(id => document.getElementById(id).style.display = 'none');

        let valid = true;

        // Название
        let name = document.getElementById("add-name").value.trim();
        if (!name || name.length < 3 || name.length > 100) {
            document.getElementById("addNameError").style.display = 'block';
            valid = false;
        }

        // Контактное лицо
        let contactName = document.getElementById("add-contact_name").value.trim();
        if (!contactName || contactName.length > 100) {
            document.getElementById("addContactNameError").style.display = 'block';
            valid = false;
        }

        // Email контактного лица
        let contactEmail = document.getElementById("add-contact_email").value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const localPart = contactEmail.split('@')[0];
        if (!contactEmail || contactEmail.length > 100 || !emailRegex.test(contactEmail) || localPart.length > 20) {
            document.getElementById("addContactEmailError").style.display = 'block';
            valid = false;
        }
        else {
            document.getElementById("addContactEmailError").style.display = 'none';
        }

        // Номер телефона
        let phoneNumber = document.getElementById("add-phone_number").value.trim();
        if (phoneNumber) {
            const phoneRegex = /^\+?\d{1,15}$/;
            if (phoneNumber.length > 15 || !phoneRegex.test(phoneNumber)) {
                document.getElementById("addPhoneNumberError").style.display = 'block';
                valid = false;
            }
        }

        // Адрес
        let address = document.getElementById("add-address").value.trim();
        if (address) {
            const addressRegex = /^[A-Za-zА-Яа-я0-9\s]{1,200}$/;
            if (address.length > 200 || !addressRegex.test(address)) {
                document.getElementById("addAddressError").style.display = 'block';
                valid = false;
            }
        }

        // Страна
        let country = document.getElementById("add-country").value.trim();
        if (country) {
            const countryRegex = /^[A-Za-zА-Яа-я\s]{1,50}$/;
            if (country.length > 50 || !countryRegex.test(country)) {
                document.getElementById("addCountryError").style.display = 'block';
                valid = false;
            }
        }

        // Город
        let city = document.getElementById("add-city").value.trim();
        if (city) {
            const cityRegex = /^[A-Za-zА-Яа-я\s-]{1,50}$/;
            if (city.length > 50 || !cityRegex.test(city)) {
                document.getElementById("addCityError").style.display = 'block';
                valid = false;
            }
        }

        // Веб-сайт
        let website = document.getElementById("add-website").value.trim();
        if (website) {
            if (website.length > 255 || !isValidURL(website)) {
                document.getElementById("addWebsiteError").style.display = 'block';
                valid = false;
            }
        }

        if (valid) {
            await createSupplier();
            $("#addSupplierModal").modal("hide");
        }
    });

    // Обработчик для редактирования поставщика
    document.getElementById("edit-supplier-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        // Сброс сообщений об ошибках
        const errorFields = ["editNameError", "editContactNameError", "editContactEmailError", "editPhoneNumberError", "editAddressError", "editCountryError", "editCityError", "editWebsiteError"];
        errorFields.forEach(id => document.getElementById(id).style.display = 'none');

        let valid = true;

        // Название
        let name = document.getElementById("edit-name").value.trim();
        if (!name || name.length < 3 || name.length > 100) {
            document.getElementById("editNameError").style.display = 'block';
            valid = false;
        }

        // Контактное лицо
        let contactName = document.getElementById("edit-contact_name").value.trim();
        if (!contactName || contactName.length > 100) {
            document.getElementById("editContactNameError").style.display = 'block';
            valid = false;
        }

        // Email контактного лица
        let contactEmail = document.getElementById("edit-contact_email").value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const localPart = contactEmail.split('@')[0];
        if (!contactEmail || contactEmail.length > 100 || !emailRegex.test(contactEmail) || localPart.length > 20) {
            document.getElementById("editContactEmailError").style.display = 'block';
            valid = false;
        }
        else {
            document.getElementById("editContactEmailError").style.display = 'none';
        }

        // Номер телефона
        let phoneNumber = document.getElementById("edit-phone_number").value.trim();
        if (phoneNumber) {
            const phoneRegex = /^\+?\d{1,15}$/;
            if (phoneNumber.length > 15 || !phoneRegex.test(phoneNumber)) {
                document.getElementById("editPhoneNumberError").style.display = 'block';
                valid = false;
            }
        }

        // Адрес
        let address = document.getElementById("edit-address").value.trim();
        if (address) {
            const addressRegex = /^[A-Za-zА-Яа-я0-9\s]{1,200}$/;
            if (address.length > 200 || !addressRegex.test(address)) {
                document.getElementById("editAddressError").style.display = 'block';
                valid = false;
            }
        }

        // Страна
        let country = document.getElementById("edit-country").value.trim();
        if (country) {
            const countryRegex = /^[A-Za-zА-Яа-я\s]{1,50}$/;
            if (country.length > 50 || !countryRegex.test(country)) {
                document.getElementById("editCountryError").style.display = 'block';
                valid = false;
            }
        }

        // Город
        let city = document.getElementById("edit-city").value.trim();
        if (city) {
            const cityRegex = /^[A-Za-zА-Яа-я\s-]{1,50}$/;
            if (city.length > 50 || !cityRegex.test(city)) {
                document.getElementById("editCityError").style.display = 'block';
                valid = false;
            }
        }

        // Веб-сайт
        let website = document.getElementById("edit-website").value.trim();
        if (website) {
            if (website.length > 255 || !isValidURL(website)) {
                document.getElementById("editWebsiteError").style.display = 'block';
                valid = false;
            }
        }

        if (valid) {
            const supplierId = document.getElementById("edit-supplier-id").value;
            await updateSupplier(supplierId);
            $("#editSupplierModal").modal("hide");
        }
    });

    // Добавляем обработчик для кнопок "Редактировать" и "Удалить" в таблице
    document.getElementById("suppliers-table").addEventListener("click", (event) => {
        const target = event.target;
        const supplierId = target.dataset.id;

        if (target.classList.contains("btn-outline-warning")) {
            openEditModal(supplierId);
        } else if (target.classList.contains("btn-outline-danger")) {
            const confirmed = confirm("Вы уверены, что хотите удалить поставщика?");
            if (confirmed) deleteSupplier(supplierId);
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

// Открытие модального окна для добавления нового поставщика
function openAddModal() {
    document.getElementById("add-supplier-form").reset();
    $("#addSupplierModal").modal("show");
}

// Открытие модального окна для редактирования поставщика
async function openEditModal(supplierId) {
    const token = await getTokenFromDatabase();
    const response = await fetch(`http://${window.location.hostname}:8002/suppliers/${supplierId}`, {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });

    const supplier = await response.json();

    // Заполняем поля формы редактирования данными поставщика
    document.getElementById("edit-supplier-id").value = supplier.supplier_id;
    document.getElementById("edit-name").value = supplier.name;
    document.getElementById("edit-contact_name").value = supplier.contact_name;
    document.getElementById("edit-contact_email").value = supplier.contact_email;
    document.getElementById("edit-phone_number").value = supplier.phone_number;
    document.getElementById("edit-address").value = supplier.address;
    document.getElementById("edit-country").value = supplier.country;
    document.getElementById("edit-city").value = supplier.city;
    document.getElementById("edit-website").value = supplier.website;

    // Открываем модальное окно для редактирования
    $("#editSupplierModal").modal("show");
}

//Использование токена для инициализации поставщиков
async function initializeSuppliers() {
    const token = await getTokenFromDatabase();
    await loadSuppliers(token);
}

//Загрузка поставщиков
async function loadSuppliers(token) {
    const response = await fetch(`http://${window.location.hostname}:8002/suppliers/`, {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });

    const suppliers = await response.json();
    renderSuppliersTable(suppliers);
}

// Поиск поставщика
async function searchSupplier() {
    const token = await getTokenFromDatabase();
    const searchQuery = document.getElementById("search-name").value.trim();

    const response = await fetch(`http://${window.location.hostname}:8002/search_suppliers?name=${encodeURIComponent(searchQuery)}`, {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });

    if (response.ok) {
        const suppliers = await response.json();
        console.log("Найденные поставщики:", suppliers); // Отладка: вывод найденных поставщиков в консоль
        renderSuppliersTable(suppliers);
    } else {
        console.error("Ошибка при поиске поставщика:", response.status);
    }
}

// Создание поставщика
async function createSupplier() {
    const token = await getTokenFromDatabase();
    const supplierData = {
        name: document.getElementById("add-name").value.trim(),
        contact_name: document.getElementById("add-contact_name").value.trim(),
        contact_email: document.getElementById("add-contact_email").value.trim(),
        phone_number: document.getElementById("add-phone_number").value.trim() || null,
        address: document.getElementById("add-address").value.trim() || null,
        country: document.getElementById("add-country").value.trim() || null,
        city: document.getElementById("add-city").value.trim() || null,
        website: document.getElementById("add-website").value.trim() || null,
    };


    try {
        const response = await fetch(`http://${window.location.hostname}:8002/suppliers/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(supplierData)
        });

        if (response.ok) {
            // Закрываем модальное окно
            $("#addSupplierModal").modal("hide");

            // Очищаем форму
            document.getElementById("add-supplier-form").reset();

            // Обновляем список поставщиков
            await loadSuppliers(token);

            // Показываем уведомление об успешном добавлении
            showNotification("Поставщик успешно добавлен!");
        } else {
            // Обработка ошибки
            const errorData = await response.json();
            console.error("Ошибка при добавлении поставщика:", errorData);
            showNotification("Ошибка при добавлении поставщика", "danger");
        }
    } catch (error) {
        console.error("Ошибка при выполнении запроса:", error);
        showNotification("Ошибка при добавлении поставщика", "danger");
    }
}

// Обновление поставщика
async function updateSupplier(supplierId) {
    const token = await getTokenFromDatabase();
    const supplierData = {
        name: document.getElementById("edit-name").value.trim(),
        contact_name: document.getElementById("edit-contact_name").value.trim(),
        contact_email: document.getElementById("edit-contact_email").value.trim(),
        phone_number: document.getElementById("edit-phone_number").value.trim() || null,
        address: document.getElementById("edit-address").value.trim() || null,
        country: document.getElementById("edit-country").value.trim() || null,
        city: document.getElementById("edit-city").value.trim() || null,
        website: document.getElementById("edit-website").value.trim() || null,
    };

    try {
        const response = await fetch(`http://${window.location.hostname}:8002/suppliers/${supplierId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(supplierData)
        });

        if (response.ok) {
            // Закрываем модальное окно и обновляем список поставщиков
            $("#editSupplierModal").modal("hide");
            await loadSuppliers(token);
            showNotification("Поставщик успешно обновлен!");
        } else {
            const errorData = await response.json();
            let errorMessage = "Ошибка при обновлении поставщика";
            if (errorData.detail) {
                errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
            }
            showNotification(errorMessage, "danger", 5000);
        }
    } catch (error) {
        console.error("Ошибка при выполнении запроса:", error);
        showNotification("Ошибка при обновлении поставщика", "danger");
    }
}

//Удаление поставщика
async function deleteSupplier(supplierId) {
    const token = await getTokenFromDatabase();
    try {
        const response = await fetch(`http://${window.location.hostname}:8002/suppliers/${supplierId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!response.ok) {
            const error = await response.json();
            showNotification(error.detail || "Ошибка при удалении поставщика", "danger");
            return;
        }

        showNotification("Поставщик успешно удален", "success");
        loadSuppliers(token);
    } catch (error) {
        showNotification("Ошибка подключения к серверу", "danger");
    }
}

//Заполнение таблицы поставщиков
function renderSuppliersTable(suppliers) {
    const tableBody = document.querySelector("#suppliers-table tbody");
    tableBody.innerHTML = "";

    suppliers.forEach((supplier) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${supplier.name}</td>
            <td>${supplier.contact_name}</td>
            <td>${supplier.contact_email}</td>
            <td>${supplier.phone_number}</td>
            <td>${supplier.address}</td>
            <td>${supplier.country}</td>
            <td>${supplier.city}</td>
            <td>${supplier.website}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-warning mt-2" data-id="${supplier.supplier_id}">Редактировать</button>
                <button class="btn btn-sm btn-outline-danger mt-2" data-id="${supplier.supplier_id}">Удалить</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function isValidURL(url) {
    // Добавим протокол, если его нет, чтобы URL можно было распарсить
    let urlToCheck = url;
    if (!/^https?:\/\//i.test(url)) {
        urlToCheck = 'http://' + url;
    }

    try {
        const parsed = new URL(urlToCheck);

        // Проверка на двойные точки в hostname
        if (parsed.hostname.includes('..')) {
            return false;
        }

        // Домен должен содержать хотя бы одну точку (tld)
        const hostnameParts = parsed.hostname.split('.');
        if (hostnameParts.length < 2) {
            return false;
        }

        // Каждая часть домена должна быть не пустой и начинаться/заканчиваться не с дефиса
        for (const part of hostnameParts) {
            if (!part || /^-/.test(part) || /-$/.test(part)) {
                return false;
            }
        }

        // Общий паттерн на домен
        const domainPattern = /^[a-zA-Z0-9-\.]+$/;
        if (!domainPattern.test(parsed.hostname)) {
            return false;
        }

        return true;
    } catch (_) {
        return false;
    }
}