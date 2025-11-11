# graphql.py

from typing import List
from datetime import datetime
from uuid import UUID
from decimal import Decimal

import strawberry
from strawberry.types import Info
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models import Order, OrderItem, OrderStatus
from app.schemas import OrderCreate, OrderItemCreate
from app.kafka import send_to_kafka
from app.crud import (
    create_order as create_order_crud,
    get_order_by_id as get_order_by_id_crud,
    get_orders_by_user_id,
    get_all_orders as get_all_orders_crud,
    update_order_status as update_order_status_crud
)
from app import auth, logger
import enum

# Определение типов данных


@strawberry.enum
class GQOrderStatus(enum.Enum):
    pending = "pending"
    completed = "completed"
    cancelled = "cancelled"


@strawberry.type
class OrderItemType:
    order_item_id: UUID
    order_id: UUID
    product_id: UUID
    warehouse_id: UUID
    quantity: int
    price_at_order: Decimal


@strawberry.type
class OrderType:
    order_id: UUID
    user_id: UUID
    status: GQOrderStatus
    created_at: datetime
    updated_at: datetime
    order_items: List[OrderItemType]

# Типы входных данных


@strawberry.input
class OrderItemInput:
    product_id: UUID
    warehouse_id: UUID
    quantity: int
    price_at_order: Decimal


@strawberry.input
class CreateOrderInput:
    order_items: List[OrderItemInput]


@strawberry.input
class UpdateOrderStatusInput:
    order_id: UUID
    status: GQOrderStatus

# Определение запросов и мутаций


def get_db_session(info: Info) -> Session:
    try:
        return info.context["db"]
    except KeyError:
        raise Exception("Session не найден в контексте")


def get_current_user_id(info: Info, require_admin: bool = False) -> tuple[UUID, bool]:
    request = info.context.get("request")
    if not request:
        raise Exception("Request не найден в контексте")

    # Извлекаем токен из заголовка Authorization
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Отсутствует заголовок Authorization")

    scheme, _, token = auth_header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Недопустимая схема аутентификации")

    # Проверяем токен
    user_data = auth.verify_token_in_other_service(
        token, require_admin=require_admin)

    # Получаем user_id и is_admin из возвращенного словаря
    user_id = user_data.get("user_id")
    is_admin = user_data.get("is_superadmin", False)

    return UUID(user_id), is_admin


@strawberry.type
class Query:
    @strawberry.field
    def get_order(self, info: Info, order_id: UUID) -> OrderType:
        db = get_db_session(info)
        user_id, is_superadmin = get_current_user_id(info)

        order = get_order_by_id_crud(db, order_id)

        if not order:
            raise Exception("Заказ не найден")

        # Проверяем, имеет ли пользователь право просматривать этот заказ
        if not is_superadmin and order.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="Нет прав для просмотра этого заказа")

        return OrderType(
            order_id=order.order_id,
            user_id=order.user_id,
            status=GQOrderStatus(order.status.value),
            created_at=order.created_at,
            updated_at=order.updated_at,
            order_items=[
                OrderItemType(
                    order_item_id=item.order_item_id,
                    order_id=item.order_id,
                    product_id=item.product_id,
                    warehouse_id=item.warehouse_id,
                    quantity=item.quantity,
                    price_at_order=Decimal(item.price_at_order),
                )
                for item in order.order_items
            ],
        )

    @strawberry.field
    def list_orders(self, info: Info) -> List[OrderType]:
        db = get_db_session(info)
        user_id, _ = get_current_user_id(info)  # ИСПРАВЛЕНО
        orders = get_orders_by_user_id(db, user_id)
        return [
            OrderType(
                order_id=order.order_id,
                user_id=order.user_id,
                status=GQOrderStatus(order.status.value),
                created_at=order.created_at,
                updated_at=order.updated_at,
                order_items=[
                    OrderItemType(
                        order_item_id=item.order_item_id,
                        order_id=item.order_id,
                        product_id=item.product_id,
                        warehouse_id=item.warehouse_id,
                        quantity=item.quantity,
                        price_at_order=Decimal(item.price_at_order),
                    )
                    for item in order.order_items
                ],
            )
            for order in orders
        ]

    @strawberry.field
    def list_all_orders(self, info: Info) -> List[OrderType]:
        db = get_db_session(info)
        user_id, _ = get_current_user_id(
            info, require_admin=True)  # ИСПРАВЛЕНО
        orders = get_all_orders_crud(db)
        return [
            OrderType(
                order_id=order.order_id,
                user_id=order.user_id,
                status=GQOrderStatus(order.status.value),
                created_at=order.created_at,
                updated_at=order.updated_at,
                order_items=[
                    OrderItemType(
                        order_item_id=item.order_item_id,
                        order_id=item.order_id,
                        product_id=item.product_id,
                        warehouse_id=item.warehouse_id,
                        quantity=item.quantity,
                        price_at_order=Decimal(item.price_at_order),
                    )
                    for item in order.order_items
                ],
            )
            for order in orders
        ]


@strawberry.type
class Mutation:
    @strawberry.mutation
    def create_order(self, info: Info, input: CreateOrderInput) -> OrderType:
        db = get_db_session(info)
        user_id, _ = get_current_user_id(info)  # ИСПРАВЛЕНО
        logger.log_message(f"User {user_id} is creating a new order")

        # Используем функцию из crud.py
        order_data = OrderCreate(
            user_id=user_id,
            order_items=[
                OrderItemCreate(
                    product_id=item.product_id,
                    warehouse_id=item.warehouse_id,
                    quantity=item.quantity,
                    price_at_order=item.price_at_order
                )
                for item in input.order_items
            ]
        )
        new_order = create_order_crud(db, order_data)

        # Отправляем событие OrderCreated в Kafka
        order_created_event = {
            "event_type": "OrderCreated",
            "order_id": str(new_order.order_id),
            "user_id": str(new_order.user_id),
            "order_items": [
                {
                    "product_id": str(item.product_id),
                    "warehouse_id": str(item.warehouse_id),
                    "quantity": item.quantity,
                    "price_at_order": str(item.price_at_order)
                }
                for item in new_order.order_items
            ],
            "timestamp": datetime.utcnow().isoformat()
        }
        send_to_kafka('orders', order_created_event)

        # Возвращаем данные заказа
        return OrderType(
            order_id=new_order.order_id,
            user_id=new_order.user_id,
            status=GQOrderStatus(new_order.status.value),
            created_at=new_order.created_at,
            updated_at=new_order.updated_at,
            order_items=[
                OrderItemType(
                    order_item_id=item.order_item_id,
                    order_id=item.order_id,
                    product_id=item.product_id,
                    warehouse_id=item.warehouse_id,
                    quantity=item.quantity,
                    price_at_order=Decimal(item.price_at_order),
                )
                for item in new_order.order_items
            ],
        )

    @strawberry.mutation
    def update_order_status(self, info: Info, input: UpdateOrderStatusInput) -> OrderType:
        db = get_db_session(info)
        user_id, is_admin = get_current_user_id(info)  # ИСПРАВЛЕНО

        order = get_order_by_id_crud(db, input.order_id)
        if not order:
            raise Exception("Заказ не найден")

        # Проверяем, имеет ли пользователь право обновлять этот заказ
        if order.user_id != user_id and not is_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="Нет прав для обновления этого заказа")

        # Проверяем текущий статус заказа
        if order.status in [OrderStatus.completed, OrderStatus.cancelled]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot cancel this order"
            )

        # Администраторы могут изменять статус на любой, обычные пользователи - только на cancelled
        if not is_admin and input.status != GQOrderStatus.cancelled:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Недопустимое изменение статуса")

        # Преобразуем GQOrderStatus в OrderStatus
        new_status = OrderStatus[input.status.value]
        updated_order = update_order_status_crud(
            db, input.order_id, new_status)

        # Отправляем событие в Kafka
        order_event = {
            "event_type": f"Order{input.status.value.capitalize()}",
            "order_id": str(input.order_id),
            "timestamp": datetime.utcnow().isoformat()
        }
        send_to_kafka('orders', order_event)

        return OrderType(
            order_id=updated_order.order_id,
            user_id=updated_order.user_id,
            status=GQOrderStatus(updated_order.status.value),
            created_at=updated_order.created_at,
            updated_at=updated_order.updated_at,
            order_items=[
                OrderItemType(
                    order_item_id=item.order_item_id,
                    order_id=item.order_id,
                    product_id=item.product_id,
                    warehouse_id=item.warehouse_id,
                    quantity=item.quantity,
                    price_at_order=Decimal(item.price_at_order),
                )
                for item in updated_order.order_items
            ],
        )


schema = strawberry.Schema(query=Query, mutation=Mutation)
