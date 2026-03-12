document.addEventListener("DOMContentLoaded", async function () {
    const ordersContainer = document.getElementById("ordersContainer");

    const token = await getTokenFromDatabase();
    if (!token) {
        alert("Вы не авторизованы!");
        window.location.href = "/login";
        return;
    }

    const query = `
        query {
            listOrders {
                orderId
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
            console.error("Ошибка загрузки заказов:", result.errors);
            ordersContainer.innerHTML = `
                <div class="alert alert-danger" role="alert">
                    Ошибка при загрузке заказов.
                </div>
            `;
            return;
        }

        const orders = result.data.listOrders;
        renderOrders(orders);
    } catch (error) {
        console.error("Ошибка запроса:", error);
        ordersContainer.innerHTML = `
            <div class="alert alert-danger" role="alert">
                Ошибка при загрузке заказов.
            </div>
        `;
    }
});

function renderOrders(orders) {
    const ordersContainer = document.getElementById("ordersContainer");
    ordersContainer.innerHTML = "";

    if (orders.length === 0) {
        ordersContainer.innerHTML = `
            <div class="alert alert-info text-center" role="alert">
                У вас пока нет заказов.
            </div>
        `;
        return;
    }

    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    orders.forEach(order => {
        const itemsHTML = order.orderItems.map(item => `
            <li>
                Товар: ${item.productId}, Количество: ${item.quantity}, Цена: ${item.priceAtOrder} ₽
            </li>
        `).join("");

        ordersContainer.innerHTML += `
            <div class="card mb-3 shadow-sm">
                <div class="card-body">
                    <h5 class="card-title">Заказ №${order.orderId}</h5>
                    <p class="card-text">
                        Статус: <span class="badge bg-${getStatusColor(order.status)}">${order.status}</span><br>
                        Дата создания: ${new Date(order.createdAt).toLocaleString()}
                    </p>
                    <ul>${itemsHTML}</ul>
                    ${order.status === "pending" ? `
                        <button class="btn btn-danger btn-sm" onclick="cancelOrder('${order.orderId}')">Отменить заказ</button>
                    ` : ""}
                </div>
            </div>
        `;
    });
}

function getStatusColor(status) {
    switch (status) {
        case "pending": return "warning";
        case "completed": return "success";
        case "cancelled": return "danger";
        default: return "secondary";
    }
}

async function cancelOrder(orderId) {
    const token = await getTokenFromDatabase();
    const query = `
        mutation {
            updateOrderStatus(input: { orderId: "${orderId}", status: cancelled }) {
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
            alert("Ошибка при отмене заказа: " + result.errors[0].message);
        } else {
            alert("Заказ успешно отменен!");
            location.reload();
        }
    } catch (error) {
        console.error("Ошибка отмены заказа:", error);
        alert("Ошибка при отмене заказа.");
    }
}