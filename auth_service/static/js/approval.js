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
                <button class="btn btn-sm btn-danger" onclick="rejectProduct('${product.product_id}')">Отклонить</button>
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
        // Одобряем продукт (PATCH-запрос)
        const patchResponse = await fetch(`http://${window.location.hostname}:8002/products/${productId}`, {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ is_available: true }) // Обновляем поле is_available на true
        });

        if (!patchResponse.ok) {
            console.error("Error approving product:", patchResponse.status);
            return;
        }

        // Удаляем продукт из Redis
        const redisResponse = await fetch("/remove-from-pending/", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ product_id: productId })
        });

        if (!redisResponse.ok) {
            console.error("Error removing product from Redis:", redisResponse.status);
            return;
        }

        console.log(`Product ${productId} approved and removed from Redis successfully.`);
        loadPendingProducts(token); // Обновляем список после одобрения
    } catch (error) {
        console.error("Error:", error);
    }
}

// Функция для отклонения продукта
async function rejectProduct(productId) {
    console.log(`Rejecting product with ID: ${productId}`);
    const token = await getTokenFromDatabase();

    try {
        // Удаляем продукт из Redis
        const redisResponse = await fetch("/remove-from-pending/", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ product_id: productId })
        });

        if (!redisResponse.ok) {
            console.error("Error removing product from Redis:", redisResponse.status);
            return;
        }

        // Удаляем продукт из базы данных
        const dbResponse = await fetch(`http://${window.location.hostname}:8002/products/${productId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (dbResponse.ok) {
            console.log(`Product ${productId} rejected and removed successfully.`);
            loadPendingProducts(token); // Обновляем список после отклонения
        } else {
            console.error("Error deleting product from DB:", dbResponse.status);
        }
    } catch (error) {
        console.error("Error:", error);
    }
}
