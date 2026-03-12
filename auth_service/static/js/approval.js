// approval.js

document.addEventListener("DOMContentLoaded", async function () {
    console.log("Document loaded. Initializing...");
    const token = await getTokenFromDatabase();

    if (!token) {
        // Перенаправляем на страницу логина, если токен отсутствует
        window.location.href = '/login';
        return;
    }

    loadPendingProducts(token);
});

// Функция для загрузки списка продуктов, ожидающих одобрения
async function loadPendingProducts(token) {
    try {
        const response = await fetch("/get-pending-products/", {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (response.ok) {
            const products = await response.json();
            console.log("Pending products loaded:", products);
            renderProductsTable(products);
        } else {
            console.error("Error fetching pending products:", response.status);
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

// Функция для рендеринга таблицы продуктов
function renderProductsTable(products) {
    console.log("Rendering products table...");
    const tableBody = document.getElementById("product-approval-table");
    tableBody.innerHTML = "";  // Очищаем таблицу перед добавлением новых данных

    products.forEach(product => {
        console.log("Rendering product:", product);
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${product.name}</td>
            <td>${product.description}</td>
            <td>${product.category}</td>
            <td>${product.price}</td>
            <td>
                <button class="btn btn-sm btn-success" onclick="approveProduct('${product.product_id}')">Одобрить</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Функция для одобрения продукта
async function approveProduct(productId) {
    console.log(`Approving product with ID: ${productId}`);
    const token = await getTokenFromDatabase();

    try {
        const response = await fetch(`http://${window.location.hostname}:8002/products/${productId}`, {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ is_available: true }) // Обновляем поле is_available на true
        });

        if (response.ok) {
            console.log(`Product ${productId} approved successfully.`);
            loadPendingProducts(token); // Обновляем список после одобрения
        } else {
            console.error("Error approving product:", response.status);
        }
    } catch (error) {
        console.error("Error:", error);
    }
}