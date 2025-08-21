import json
from kafka import KafkaProducer, KafkaConsumer
from app import logger
from threading import Thread
from sqlalchemy import func
from app.database import SessionLocal
from app.models import ProductWarehouse, Product, Warehouse
from datetime import datetime
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session


# Настройка Kafka продюсера
producer = KafkaProducer(
    bootstrap_servers=['kafka:9092'],  # Адрес Kafka сервера
    value_serializer=lambda v: json.dumps(v).encode(
        'utf-8')  # Сериализация данных в JSON
)

# Настройка Kafka консюмера
consumer = KafkaConsumer(
    'orders',
    bootstrap_servers=['kafka:9092'],
    value_deserializer=lambda x: json.loads(x.decode('utf-8')),
    group_id='product_service_group',
    auto_offset_reset='earliest',
    enable_auto_commit=True
)

# Пример данных для отправки


def send_to_kafka(topic: str, message: dict):
    """
    Отправляет сообщение в указанный топик Kafka.

    :param topic: Название топика Kafka.
    :param message: Сообщение для отправки (словарь).
    """
    try:
        producer.send(topic, message)
        producer.flush()  # Убедимся, что сообщение отправлено
        logger.log_message(f"The message sent to {topic}: {message}")
    except Exception as e:
        logger.log_message(
            f"An error occurred while sending the message to Kafka: {e}")


def consume_messages():
    try:
        for message in consumer:
            process_message(message.value)
    except Exception as e:
        logger.log_message(
            f"An error occurred while consuming messages from Kafka: {e}")


def process_message(message: dict):
    event_type = message.get('event_type')
    if event_type == 'OrderCreated':
        handle_order_created(message)
    elif event_type == 'OrderCancelled':
        handle_order_cancelled(message)
    else:
        logger.log_message(f"Получен неизвестный тип события: {event_type}")


def handle_order_created(message: dict):
    order_id = message.get('order_id')
    order_items = message.get('order_items', [])
    db: Session = SessionLocal()

    insufficient_stock = []
    price_mismatches = []

    try:
        # === ШАГ 1. Валидация цен и доступности (без изменений остатков) ===
        for item in order_items:
            product_id = item['product_id']
            quantity = item['quantity']
            warehouse_id = item['warehouse_id']

            # 1.a проверка цены (строгое равенство float)
            price_at_order_raw = item.get('price_at_order')
            if price_at_order_raw is None:
                price_mismatches.append({
                    'product_id': product_id,
                    'warehouse_id': warehouse_id,
                    'reason': 'price_at_order is missing'
                })
            else:
                try:
                    price_at_order = float(price_at_order_raw)
                except (TypeError, ValueError):
                    price_mismatches.append({
                        'product_id': product_id,
                        'warehouse_id': warehouse_id,
                        'reason': f'invalid price_at_order: {price_at_order_raw}'
                    })
                else:
                    product = db.query(Product).filter(
                        Product.product_id == product_id
                    ).first()
                    if not product:
                        price_mismatches.append({
                            'product_id': product_id,
                            'warehouse_id': warehouse_id,
                            'reason': 'product not found'
                        })
                    else:
                        current_price = float(product.price)
                        if price_at_order != current_price:
                            price_mismatches.append({
                                'product_id': product_id,
                                'warehouse_id': warehouse_id,
                                'expected_price': current_price,
                                'got_price_at_order': price_at_order
                            })

            # 1.b проверка наличия на складе (без списания)
            pw = db.query(ProductWarehouse).filter(
                ProductWarehouse.product_id == product_id,
                ProductWarehouse.warehouse_id == warehouse_id
            ).with_for_update().first()  # блокируем строку под резерв
            if pw:
                if pw.quantity < quantity:
                    insufficient_stock.append({
                        'product_id': product_id,
                        'warehouse_id': warehouse_id,
                        'available_quantity': pw.quantity
                    })
            else:
                insufficient_stock.append({
                    'product_id': product_id,
                    'warehouse_id': warehouse_id,
                    'reason': 'Product not found in warehouse'
                })

        if price_mismatches or insufficient_stock:
            db.rollback()
            reason = {}
            if price_mismatches:
                reason['price_mismatch'] = price_mismatches
            if insufficient_stock:
                reason['insufficient_stock'] = insufficient_stock

            order_rejected_event = {
                "event_type": "OrderRejected",
                "order_id": order_id,
                "reason": reason,
                "timestamp": datetime.utcnow().isoformat()
            }
            send_to_kafka('order_responses', order_rejected_event)
            logger.log_message(f"Заказ {order_id} отклонён. Причины: {reason}")
            return

        # === ШАГ 2. Резервирование остатков ===
        for item in order_items:
            product_id = item['product_id']
            quantity = item['quantity']
            warehouse_id = item['warehouse_id']

            pw = db.query(ProductWarehouse).filter(
                ProductWarehouse.product_id == product_id,
                ProductWarehouse.warehouse_id == warehouse_id
            ).with_for_update().first()
            # на этом этапе pw точно есть и qty достаточно
            pw.quantity -= quantity
            db.add(pw)

        # === ШАГ 3. Пересчёт current_stock по каждому складу ===
        # Собираем уникальные склады из заказа
        affected_warehouses = {item['warehouse_id'] for item in order_items}

        for wid in affected_warehouses:
            # Лочим склад на время пересчёта
            wh = db.query(Warehouse).filter(
                Warehouse.warehouse_id == wid
            ).with_for_update().first()

            # Сумма всех остатков по складу
            total_qty = db.query(
                func.coalesce(func.sum(ProductWarehouse.quantity), 0)
            ).filter(
                ProductWarehouse.warehouse_id == wid
            ).scalar()

            wh.current_stock = int(total_qty)
            db.add(wh)

        db.commit()

        order_confirmed_event = {
            "event_type": "OrderConfirmed",
            "order_id": order_id,
            "timestamp": datetime.utcnow().isoformat()
        }
        send_to_kafka('order_responses', order_confirmed_event)
        logger.log_message(
            f"Заказ {order_id} подтверждён, товары зарезервированы, current_stock пересчитан."
        )

    except SQLAlchemyError as e:
        db.rollback()
        logger.log_message(f"Ошибка при обработке заказа {order_id}: {e}")
    finally:
        db.close()


def handle_order_cancelled(message: dict):
    order_id = message.get('order_id')
    db: Session = SessionLocal()
    try:
        # Здесь можно реализовать логику восстановления зарезервированных товаров
        # Если вы храните информацию о резервировании, можно вернуть товары на склад
        logger.log_message(f"Обработка отмены заказа {order_id}")
        # Примерная реализация:
        # 1. Получить информацию о зарезервированных товарах для этого заказа
        # 2. Увеличить количество товаров на складе
        pass
    except SQLAlchemyError as e:
        db.rollback()
        logger.log_message(
            f"Ошибка при обработке отмены заказа {order_id}: {e}")
    finally:
        db.close()


def start_consumer():
    thread = Thread(target=consume_messages)
    thread.daemon = True
    thread.start()
    logger.log_message("Kafka consumer started.")
