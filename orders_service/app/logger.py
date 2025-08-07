# logger.py
import logging
import os
import json
from datetime import datetime
import socket

# Создаем директорию logs, если она не существуе
os.makedirs('logs', exist_ok=True)

# Создаем логгер
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Создаем обработчик, который записывает логи в файл
handler = logging.FileHandler('logs/orders_service.log')
handler.setLevel(logging.INFO)

# Получаем IP-адрес машины


def get_ip_address():
    try:
        hostname = socket.gethostname()  # Получаем имя хоста
        ip_address = socket.gethostbyname(hostname)  # Получаем IP-адрес
        return ip_address
    except Exception as e:
        return str(e)

# Создаем форматтер и добавляем его в обработчик


class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            "name": record.name,
            "class": record.levelname,  # используем уровень логирования в качестве класса
            # используем числовое значение уровня логирования в качестве состояния
            "state": record.levelno,
            # временная метка в миллисекундах
            "timestamp": int(datetime.utcnow().timestamp() * 1000),
            "message": record.getMessage(),  # добавляем текст сообщения
            "ip_address": get_ip_address(),  # добавляем IP-адрес
            "microservice": "orders_service"
        }
        return json.dumps(log_entry)


formatter = JsonFormatter()
handler.setFormatter(formatter)

# Добавляем обработчик в логгер
logger.addHandler(handler)


def log_message(message: str):
    logger.info(message)
