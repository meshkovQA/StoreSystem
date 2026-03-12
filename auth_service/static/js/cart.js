//cart.js
document.addEventListener("DOMContentLoaded", () => {
    loadCartFromStorage();
    renderCart();
});

// Рендеринг корзины
function renderCart() {
    const cartContainer = document.getElementById("cartContainer");
    const cartTotal = document.getElementById("cartTotal");
    const checkoutBtn = document.getElementById("checkoutBtn");
    cartContainer.innerHTML = "";

    if (cart.length === 0) {
        cartContainer.innerHTML = `
            <div class="alert alert-info text-center" role="alert">
                Корзина пуста
            </div>
        `;
        cartTotal.textContent = "";
        checkoutBtn.disabled = true;
        return;
    }
    let total = 0;

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const imageHost = "http://${window.location.hostname}:8002";

        cartContainer.innerHTML += `
            <div class="col-md-12 mb-3">
                <div class="card shadow-sm">
                    <div class="row g-0 align-items-center">
                        <div class="col-md-2 text-center">
                            <img src="${imageHost}${item.image_url || '/default-image.jpg'}" class="img-fluid rounded-start" alt="${item.name}">
                        </div>
                        <div class="col-md-6">
                            <div class="card-body">
                                <h5 class="card-title">${item.name}</h5>
                                <p class="card-text">Цена: ${item.price} ₽</p>
                                <p class="card-text">Количество: 
                                    <button class="btn btn-outline-primary btn-sm me-2" onclick="changeQuantity('${item.product_id}', -1)">-</button>
                                    <span class="fw-bold">${item.quantity}</span>
                                    <button class="btn btn-outline-primary btn-sm ms-2" onclick="changeQuantity('${item.product_id}', 1)">+</button>
                                </p>
                            </div>
                        </div>
                        <div class="col-md-3 text-center">
                            <p class="fs-5 fw-bold">${itemTotal.toFixed(2)} ₽</p>
                        </div>
                        <div class="col-md-1 text-end pe-3">
                            <button class="btn btn-danger btn-sm" onclick="removeFromCart('${item.product_id}')">
                                Удалить
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    cartTotal.textContent = `Итого: ${total.toFixed(2)} ₽`;
    checkoutBtn.disabled = false;
}

// Изменение количества товаров
function changeQuantity(productId, delta) {
    const item = cart.find(item => item.product_id === productId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
        cart = cart.filter(item => item.product_id !== productId);
    } else if (item.quantity > item.max_quantity) {
        alert("Достигнуто максимальное количество на складе");
        item.quantity = item.max_quantity;
    }
    saveCartToStorage();
    renderCart();
}

// Удаление товара из корзины
function removeFromCart(productId) {
    cart = cart.filter(item => item.product_id !== productId);
    saveCartToStorage();
    renderCart();
}

// Оформление заказа
async function checkout() {
    const token = await getTokenFromDatabase();

    const orderItems = cart.map(item => ({
        productId: item.product_id, // Обратите внимание на название
        quantity: item.quantity,
        priceAtOrder: parseFloat(item.price), // Преобразуем цену
        warehouseId: item.warehouse_id
    }));

    const query = `
        mutation CreateOrder($input: CreateOrderInput!) {
            createOrder(input: $input) {
                orderId
                createdAt
                status
                orderItems {
                    productId
                    quantity
                    priceAtOrder
                    warehouseId
                }
            }
        }
    `;

    const variables = { input: { orderItems } };

    const response = await fetch(`http://${window.location.hostname}:8003/graphql`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ query, variables })
    });

    const result = await response.json();

    if (result.errors) {
        alert("Ошибка при оформлении заказа: " + result.errors[0].message);
    } else {
        alert("Заказ успешно оформлен!");
        cart = [];
        saveCartToStorage();
        renderCart();
    }
}

// Загрузка корзины из localStorage
function loadCartFromStorage() {
    const savedCart = localStorage.getItem("cart");
    cart = savedCart ? JSON.parse(savedCart) : [];
}

// Сохранение корзины в localStorage
function saveCartToStorage() {
    localStorage.setItem("cart", JSON.stringify(cart));
}