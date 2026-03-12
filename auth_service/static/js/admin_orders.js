document.addEventListener("DOMContentLoaded", async function () {
    const ordersContainer = document.getElementById("ordersContainer");
    const filtersForm = document.getElementById("filtersForm");

    const token = await getTokenFromDatabase();
    if (!token) {
        alert("Вы не авторизованы!");
        window.location.href = "/login";
        return;
    }

    const isAdmin = await checkAdmin(token);
    if (!isAdmin) {
        document.body.innerHTML = "<h2>Доступ запрещён</h2>";
        return;
    }


    loadOrders();

    filtersForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        loadOrders();
    });

    async function checkAdmin(token) {
        try {
            const response = await fetch("/check-superadmin", {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });

            if (!response.ok) {
                return false;
            }

            const data = await response.json();
            return data.is_superadmin;
        } catch (error) {
            console.error("Ошибка проверки статуса администратора:", error);
            return false;
        }
    }

    async function loadOrders() {
        const status = document.getElementById("statusFilter").value;
        const date = document.getElementById("dateFilter").value;

        let query = `
            query {
                listAllOrders {
                    orderId
                    userId
                    status
                    createdAt
                    orderItems {
                        productId
                        quantity
                        priceAtOrder
                    }
                }
            }
        `;

        const response = await fetch(`http://${window.location.hostname}:8003/graphql`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ query })
        });

        const result = await response.json();
        let orders = result.data.listAllOrders;

        if (status) {
            orders = orders.filter(order => order.status === status);
        }

        if (date) {
            orders = orders.filter(order => order.createdAt.startsWith(date));
        }

        renderOrders(orders);
    }

    function renderOrders(orders) {
        ordersContainer.innerHTML = "";

        if (orders.length === 0) {
            ordersContainer.innerHTML = `<div class="alert alert-info">Заказы не найдены</div>`;
            return;
        }

        orders.forEach(order => {
            const itemsHTML = order.orderItems.map(item => `
                <li>Товар: ${item.productId}, Количество: ${item.quantity}, Цена: ${item.priceAtOrder} ₽</li>
            `).join("");

            ordersContainer.innerHTML += `
                <div class="card mb-3 shadow-sm">
                    <div class="card-body">
                        <h5 class="card-title">Заказ №${order.orderId}</h5>
                        <p>Пользователь: ${order.userId}</p>
                        <p>Статус: ${order.status}</p>
                        <p>Дата создания: ${new Date(order.createdAt).toLocaleString()}</p>
                        <ul>${itemsHTML}</ul>
                        <select class="form-select mb-2" id="status-${order.orderId}">
                            <option value="pending" ${order.status === "pending" ? "selected" : ""}>Ожидание</option>
                            <option value="completed" ${order.status === "completed" ? "selected" : ""}>Завершён</option>
                            <option value="cancelled" ${order.status === "cancelled" ? "selected" : ""}>Отменён</option>
                        </select>
                        <button class="btn btn-primary btn-sm" onclick="updateOrderStatus('${order.orderId}')">Обновить статус</button>
                    </div>
                </div>
            `;
        });
    }

    window.updateOrderStatus = async function (orderId) {
        const token = await getTokenFromDatabase();
        const newStatus = document.getElementById(`status-${orderId}`).value;

        const query = `
            mutation {
                updateOrderStatus(input: { orderId: "${orderId}", status: ${newStatus} }) {
                    orderId
                    status
                }
            }
        `;

        try {
            const response = await fetch(`http://${window.location.hostname}:8003/graphql`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ query })
            });

            const result = await response.json();

            if (result.errors) {
                alert("Ошибка при изменении статуса: " + result.errors[0].message);
            } else {
                alert("Статус заказа обновлён!");
                loadOrders();
            }
        } catch (error) {
            console.error("Ошибка изменения статуса:", error);
            alert("Ошибка при изменении статуса заказа.");
        }
    };
});