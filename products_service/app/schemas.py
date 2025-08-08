from pydantic import BaseModel, Field, constr, validator, conint, condecimal, HttpUrl, EmailStr
from typing import Optional
from decimal import Decimal
import re
from uuid import UUID
from datetime import datetime


# ---- Схемы для товаров (Product) ----

class ProductBase(BaseModel):
    # Название: обязательное, от 3 до 100 символов, только буквы и цифры
    name: constr(min_length=1, max_length=100)
    # Описание: необязательное, максимум 500 символов
    description: Optional[constr(max_length=500)] = None
    # Категория: необязательное, максимум 50 символов, только буквы и цифры
    category: Optional[constr(max_length=50)] = None
    # Цена: обязательное, положительное число с 2 знаками после запятой, максимум 10 цифр
    price: condecimal(gt=0, max_digits=10, decimal_places=2)
    # Количество продукта: обязательное, целое число, не меньше 0
    stock_quantity: conint(ge=0, le=2_147_483_647)
    # Поставщик: обязательное, должен быть действительным UUID
    supplier_id: UUID
    # Изображение продукта: необязательное, форматы png, jpeg, jpg, максимум 255 символов
    image_url: Optional[constr(max_length=255)] = None
    # Вес продукта: необязательное, положительное число с 2 знаками после запятой, максимум 6 цифр
    weight: Optional[condecimal(gt=0, max_digits=6, decimal_places=2)] = None
    # Габариты продукта: необязательное, максимум 100 символов, допускаются цифры и символ "х"
    dimensions: Optional[constr(max_length=100)] = None
    # Производитель: необязательное, максимум 100 символов, только буквы и цифры
    manufacturer: Optional[constr(max_length=100)] = None

    @validator("name")
    def validate_name(cls, value):
        # Разрешаем латиницу, кириллицу, цифры и пробелы между словами, но не в начале или конце
        pattern = r"^(?! )[A-Za-zА-Яа-я0-9 ]{3,100}(?<! )$"
        if not re.match(pattern, value):
            raise ValueError(
                "Name must contain only letters, digits, and spaces (no leading or trailing spaces), "
                "with a length between 3 and 100 characters."
            )
        return value

    @validator("description")
    def validate_description(cls, value):
        if value is not None:
            # Проверка длины описания
            if len(value) > 500:
                raise ValueError(
                    "Description must be 500 characters or fewer.")
        return value

    @validator("category")
    def validate_category(cls, value):
        if value is not None:
            # Регулярное выражение для букв и цифр
            pattern = r"^[A-Za-zА-Яа-я0-9]+$"
            if not re.match(pattern, value):
                raise ValueError(
                    "Category must contain only letters and digits.")
        return value

    @validator("price")
    def validate_price(cls, value):

        # Проверяем, что цена больше 0
        if value <= 0:
            raise ValueError("Price must be greater than 0.")

        # Проверяем, что цена не превышает максимум 9999999.99
        if value > 9999999.99:
            raise ValueError("Price must not exceed 9999999.99.")
        # Проверяем, что значение имеет ровно 2 знака после запятой
        if value.as_tuple().exponent != -2:
            raise ValueError("Price must have exactly two decimal places.")
        return value

    @validator("stock_quantity")
    def validate_stock_quantity(cls, value):

        max_value = 2_147_483_647
        # Проверяем, что количество является целым числом и не меньше 0
        if value < 0:
            raise ValueError("Stock quantity must be a non-negative integer.")
        if value > max_value:
            raise ValueError(f"Stock quantity must not exceed {max_value}.")
        return value

    @validator("image_url")
    def validate_image_url(cls, value):
        if value is not None:
            # Преобразование в строку перед проверкой расширения
            value_str = str(value)
            allowed_extensions = (".png", ".jpeg", ".jpg")
            if not value_str.lower().endswith(allowed_extensions):
                raise ValueError(
                    "Image URL must be in png, jpeg, or jpg format.")
        return value

    @validator("weight")
    def validate_weight(cls, value):
        # Проверяем, что значение имеет ровно 2 знака после запятой
        if value is not None:
            if value.as_tuple().exponent != -2:
                raise ValueError(
                    "Weight must have exactly two decimal places.")
            # Проверяем, что количество цифр не превышает 10
            if len(str(value).replace(".", "")) > 10:
                raise ValueError(
                    "Weight must not exceed 10 digits including decimal places.")
        return value

    @validator("dimensions")
    def validate_dimensions(cls, value):
        if value is not None:
            # Регулярное выражение для "10x20x30" или "5x5x5"
            pattern = r"^\d+x\d+x\d+$"
            if not re.fullmatch(pattern, value):
                raise ValueError(
                    "Dimensions must be in the format '10x20x30' with three numbers separated by 'x'.")
        return value

    @validator("manufacturer")
    def validate_manufacturer(cls, value):
        if value is not None:
            # Регулярное выражение для букв и цифр
            pattern = r"^[A-Za-zА-Яа-я0-9]+$"
            if not re.match(pattern, value):
                raise ValueError(
                    "Manufacturer must contain only letters and digits.")
        return value

    class Config:
        json_encoders = {
            UUID: str  # Добавляем сериализацию UUID в строку
        }


class ProductResponse(BaseModel):
    product_id: str
    user_id: str
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    price: Decimal
    stock_quantity: int
    supplier_id: str  # Преобразуем UUID в строку
    is_available: bool
    created_at: datetime
    updated_at: datetime
    image_url: Optional[str] = None
    weight: Optional[Decimal] = None
    dimensions: Optional[str] = None
    manufacturer: Optional[str] = None

    class Config:
        orm_mode = True


class ProductCreate(ProductBase):
    pass


class ProductUpdate(ProductBase):
    pass


class Product(ProductBase):
    product_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class ProductAvailabilityUpdate(BaseModel):
    is_available: bool


class ProductPatchResponse(BaseModel):
    product_id: str  # Строка, а не UUID
    is_available: bool
    updated_at: datetime


# ---- Схемы для поставщиков (Supplier) ----

class SupplierBase(BaseModel):
    # Название: обязательное, от 3 до 100 символов
    name: constr(min_length=3, max_length=100)
    # Контактное лицо: обязательное, максимум 100 символов
    contact_name: constr(max_length=100)
    # Email контактного лица: обязательное, максимум 100 символов, валидный формат email
    contact_email: EmailStr
    # Номер телефона: необязательное, максимум 15 символов, только цифры и символ "+"
    phone_number: Optional[constr(max_length=15)] = None
    # Адрес: необязательное, максимум 200 символов, только буквы и цифры
    address: Optional[constr(max_length=200)] = None
    # Страна: необязательное, максимум 50 символов, только буквы
    country: Optional[constr(max_length=50)] = None
    # Город: необязательное, максимум 50 символов, только буквы
    city: Optional[constr(max_length=50)] = None
    # Веб-сайт: необязательное, максимум 255 символов, валидный URL
    website: Optional[HttpUrl] = None

    @validator("name")
    def validate_name(cls, value):
        # Проверяем, что нет пробелов в начале или конце
        if value != value.strip():
            raise ValueError("Name cannot have leading or trailing spaces.")

        # Проверяем, что после удаления пробелов строка не пустая
        if not value.strip():
            raise ValueError("Name cannot be empty or contain only spaces.")

        # Проверка длины и содержимого: только буквы и цифры
        pattern = r"^[A-Za-zА-Яа-я0-9\s]{3,100}$"
        if not re.match(pattern, value):
            raise ValueError(
                "Name must contain only letters, digits, and spaces, and be 3-100 characters long.")
        return value

    @validator("contact_name")
    def validate_contact_name(cls, value):

        if not value.strip():
            raise ValueError(
                "Contact name cannot be empty or contain only spaces.")

        # Проверяем на пробелы в начале или конце
        if value != value.strip():
            raise ValueError(
                "Contact name cannot have leading or trailing spaces.")

        return value

    @validator("contact_email")
    def validate_contact_email(cls, value):
        # Pydantic уже проверяет формат email через EmailStr, так что дополнительная валидация не требуется.
        if len(value) > 100:
            raise ValueError("Email must be up to 100 characters long.")
        local_part = value.split('@')[0]  # Часть email до первого "@"
        if len(local_part) > 20:
            raise ValueError(
                "Email must have less tham 20 characters before '@'.")
        return value

    @validator("phone_number")
    def validate_phone_number(cls, value):
        if value is not None:
            # Проверка допустимого формата телефона: цифры и символ "+"
            pattern = r"^\+?\d{1,14}$"
            if not re.match(pattern, value):
                raise ValueError(
                    "Phone number must contain only digits and optional '+' at the beginning.")
        return value

    @validator("address")
    def validate_address(cls, value):
        if value is not None:
            if value.strip() == "":
                raise ValueError("Address cannot contain only spaces.")
            # Проверка адреса: только буквы, цифры и пробелы
            pattern = r"^[A-Za-zА-Яа-я0-9\s]{0,200}$"
            if not re.match(pattern, value):
                raise ValueError(
                    "Address must contain only letters, digits, and spaces, and be up to 200 characters long.")
        return value

    @validator("country")
    def validate_country(cls, value):
        if value is not None:
            if value.strip() == "":
                raise ValueError("Country cannot contain only spaces.")
            # Проверка страны: только буквы
            pattern = r"^[A-Za-zА-Яа-я]{0,50}$"
            if not re.match(pattern, value):
                raise ValueError(
                    "Country must contain only letters, and be up to 50 characters long.")
        return value

    @validator("city")
    def validate_city(cls, value):
        if value is not None:
            if value.strip() == "":
                raise ValueError("Country cannot contain only spaces.")
            # Проверка города: только буквы
            pattern = r"^[A-Za-zА-Яа-я\s-]{0,50}$"
            if not re.match(pattern, value):
                raise ValueError(
                    "City must contain only letters, spaces, and hyphens, and be up to 50 characters long.")
        return value

    @validator("website")
    def validate_website(cls, value):
        if value is not None:
            host = value.host

            # Проверяем на пустой хост или хост состоящий только из точек
            if not host or host.replace('.', '') == '':
                raise ValueError(
                    'Domain name cannot be empty or contain only dots')

            # Проверяем, что домен не начинается с точки
            if host.startswith('.'):
                raise ValueError('Domain name cannot start with a dot')

            # Проверяем, что домен не заканчивается точкой
            if host.endswith('.'):
                raise ValueError('Domain name cannot end with a dot')

            # Проверяем на consecutive dots
            if '..' in host:
                raise ValueError('Domain name cannot contain consecutive dots')

            # Проверяем, что домен содержит хотя бы одну точку (есть TLD)
            if '.' not in host:
                raise ValueError('Domain name must contain at least one dot')

            # Разбиваем на части и проверяем каждую
            parts = host.split('.')

            # Проверяем, что нет пустых частей
            if any(part == '' for part in parts):
                raise ValueError('Domain name parts cannot be empty')

            # Проверяем минимальную длину TLD
            tld = parts[-1]
            if len(tld) < 2:
                raise ValueError('TLD must contain at least 2 characters')

            # Проверяем, что есть хотя бы одна часть перед TLD
            if len(parts) < 2:
                raise ValueError(
                    'Domain name must have at least subdomain and TLD')

        return value


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    # Все поля Optional, чтобы не требовалось передавать их в PATCH
    name: Optional[constr(min_length=3, max_length=100)] = None
    contact_name: Optional[constr(max_length=100)] = None
    contact_email: Optional[EmailStr] = None
    phone_number: Optional[constr(max_length=15)] = None
    address: Optional[constr(max_length=200)] = None
    country: Optional[constr(max_length=50)] = None
    city: Optional[constr(max_length=50)] = None
    website: Optional[HttpUrl] = None

    @validator("name")
    def validate_name(cls, value):
        # Проверяем, что нет пробелов в начале или конце
        if value != value.strip():
            raise ValueError("Name cannot have leading or trailing spaces.")

        # Проверяем, что после удаления пробелов строка не пустая
        if not value.strip():
            raise ValueError("Name cannot be empty or contain only spaces.")

        # Проверка длины и содержимого: только буквы и цифры
        pattern = r"^[A-Za-zА-Яа-я0-9\s]{3,100}$"
        if not re.match(pattern, value):
            raise ValueError(
                "Name must contain only letters, digits, and spaces, and be 3-100 characters long.")
        return value

    @validator("contact_name")
    def validate_contact_name(cls, value):
        if not value.strip():
            raise ValueError(
                "Contact name cannot be empty or contain only spaces.")

        # Проверяем на пробелы в начале или конце
        if value != value.strip():
            raise ValueError(
                "Contact name cannot have leading or trailing spaces.")

        return value

    @validator("contact_email")
    def validate_contact_email(cls, value):
        # Pydantic уже проверяет формат email через EmailStr, так что дополнительная валидация не требуется.
        if len(value) > 100:
            raise ValueError("Email must be up to 100 characters long.")
        local_part = value.split('@')[0]  # Часть email до первого "@"
        if len(local_part) > 20:
            raise ValueError(
                "Email must have at least 20 characters before '@'.")
        return value

    @validator("phone_number")
    def validate_phone_number(cls, value):
        if value is None:
            return value
        pattern = r"^\+?\d{1,14}$"
        if not re.match(pattern, value):
            raise ValueError(
                "Phone number must contain only digits and optional '+' at the beginning."
            )
        return value

    @validator("address")
    def validate_address(cls, value):
        if value is None:
            return value
        if value.strip() == "":
            raise ValueError("Address cannot contain only spaces.")
        pattern = r"^[A-Za-zА-Яа-я0-9\s]+$"
        if not re.match(pattern, value):
            raise ValueError(
                "Address must contain only letters, digits, and spaces.")
        return value

    @validator("country")
    def validate_country(cls, value):
        if value is None:
            return value
        if value.strip() == "":
            raise ValueError("Country cannot contain only spaces.")
        pattern = r"^[A-Za-zА-Яа-я]+$"
        if not re.match(pattern, value):
            raise ValueError("Country must contain only letters.")
        return value

    @validator("city")
    def validate_city(cls, value):
        if value is None:
            return value
        if value.strip() == "":
            raise ValueError("City cannot contain only spaces.")
        pattern = r"^[A-Za-zА-Яа-я\s-]+$"
        if not re.match(pattern, value):
            raise ValueError(
                "City must contain only letters, spaces, and hyphens.")
        return value

    @validator("website")
    def validate_website(cls, value):
        if value is not None:
            # Проверка URL уже обеспечена HttpUrl, поэтому дополнительная проверка не требуется.
            return value

    # Для contact_email и website дополнительные проверки не нужны —
    # EmailStr и HttpUrl уже сделают проверку формата, если поле не None.


class Supplier(SupplierBase):
    supplier_id: UUID

    class Config:
        orm_mode = True


class SupplierSearch(BaseModel):
    name: Optional[constr(min_length=1, max_length=100)] = None

# ---- Схемы для складов (Warehouse) ----


class WarehouseBase(BaseModel):
    # Местоположение склада: обязательное, максимум 255 символов
    location: constr(min_length=1, max_length=255)
    # Имя управляющего склада: необязательное, максимум 100 символов, только буквы
    manager_name: Optional[constr(max_length=100)] = None
    # Вместимость склада: обязательное, положительное целое число
    capacity: conint(gt=0)
    # Текущее количество продуктов: заполняется значением 0, целое число не меньше 0
    current_stock: conint(ge=0)
    # Номер телефона: необязательное, максимум 15 символов, только цифры и символ "+"
    contact_number: Optional[constr(max_length=15)] = None
    # Контактный email: необязательное, максимум 255 символов, проверка на валидный email
    email: Optional[EmailStr] = None
    # Активность склада: обязательное булево значение
    is_active: bool
    # Площадь склада: необязательное, положительное число с двумя знаками после запятой, максимум 7 цифр
    area_size: Optional[Decimal] = None

    @validator("location")
    def validate_location(cls, value):
        if value.strip() == "":
            raise ValueError("Location cannot contain only spaces.")
        if len(value) > 255:
            raise ValueError("Location must be 255 characters or fewer.")
        return value

    @validator("manager_name")
    def validate_manager_name(cls, value):
        if value is None:
            return value  # Если значение None, валидатор пропускает его как валидное

        if value.strip() == "":
            raise ValueError("Manager name cannot contain only spaces.")

            # Проверка: только буквы и пробелы
        pattern = r"^[A-Za-zА-Яа-я\s]+$"
        if not re.match(pattern, value.strip()):
            raise ValueError(
                "Manager name must contain only letters and spaces.")

        return value

    @validator("capacity")
    def validate_capacity(cls, value):
        if value <= 0:
            raise ValueError("Capacity must be a positive integer.")
        return value

    @validator("current_stock")
    def validate_current_stock(cls, value):
        if value < 0:
            raise ValueError(
                "Current stock must be zero or a positive integer.")
        return value

    @validator("contact_number")
    def validate_contact_number(cls, value):
        if value is None:
            return value  # Если значение None, валидатор пропускает его как валидное

        if value.strip() == "":
            raise ValueError("Contact_numbe cannot contain only spaces.")
        if value is not None:
            # Проверка допустимого формата телефона: цифры и символ "+"
            pattern = r"^\+?\d{1,14}$"
            if not re.match(pattern, value):
                raise ValueError(
                    "Contact number must contain only digits and optional '+' at the beginning.")
        return value

    @validator('email', pre=True, always=True)
    def validate_email(cls, value):
        if not value:
            return None
        return value

    @validator("is_active")
    def validate_is_active(cls, value):
        if not isinstance(value, bool):
            raise ValueError("is_active must be a boolean value.")
        return value

    @validator("area_size")
    def validate_area_size(cls, value):
        if value is not None:  # Проверяем, если значение передано
            if value <= Decimal("0"):
                raise ValueError(
                    "Area size must be a positive number greater than zero.")
            if value > Decimal("1000000.00"):
                raise ValueError("Area size must not exceed 1,000,000.00.")
        return value


class WarehouseCreate(WarehouseBase):
    pass


class WarehouseUpdate(BaseModel):
    location: Optional[constr(min_length=1, max_length=255)] = None
    manager_name: Optional[constr(max_length=100)] = None
    capacity: Optional[conint(gt=0)] = None
    current_stock: Optional[conint(ge=0)] = None
    contact_number: Optional[constr(max_length=15)] = None
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = None
    area_size: Optional[Decimal] = None

    @validator("location")
    def validate_location(cls, value):
        if value.strip() == "":
            raise ValueError("Location cannot contain only spaces.")
        if len(value) > 255:
            raise ValueError("Location must be 255 characters or fewer.")
        return value

    @validator("manager_name")
    def validate_manager_name(cls, value):
        if value is None:
            return value  # Если значение None, валидатор пропускает его как валидное

        if value.strip() == "":
            raise ValueError("Manager name cannot contain only spaces.")

            # Проверка: только буквы и пробелы
        pattern = r"^[A-Za-zА-Яа-я\s]+$"
        if not re.match(pattern, value.strip()):
            raise ValueError(
                "Manager name must contain only letters and spaces.")

        return value

    @validator("capacity")
    def validate_capacity(cls, value):
        if value <= 0:
            raise ValueError("Capacity must be a positive integer.")
        return value

    @validator("current_stock")
    def validate_current_stock(cls, value):
        if value < 0:
            raise ValueError(
                "Current stock must be zero or a positive integer.")
        return value

    @validator("contact_number")
    def validate_contact_number(cls, value):
        if value is None:
            return value  # Если значение None, валидатор пропускает его как валидное

        if value.strip() == "":
            raise ValueError("Contact_numbe cannot contain only spaces.")
        if value is not None:
            # Проверка допустимого формата телефона: цифры и символ "+"
            pattern = r"^\+?\d{1,14}$"
            if not re.match(pattern, value):
                raise ValueError(
                    "Contact number must contain only digits and optional '+' at the beginning.")
        return value

    @validator('email', pre=True, always=True)
    def validate_email(cls, value):
        if not value:
            return None
        return value

    @validator("is_active")
    def validate_is_active(cls, value):
        if not isinstance(value, bool):
            raise ValueError("is_active must be a boolean value.")
        return value

    @validator("area_size")
    def validate_area_size(cls, value):
        if value is not None:  # Проверяем, если значение передано
            if value <= Decimal("0"):
                raise ValueError(
                    "Area size must be a positive number greater than zero.")
            if value > Decimal("1000000.00"):
                raise ValueError("Area size must not exceed 1,000,000.00.")
        return value

    class Config:
        orm_mode = True


class Warehouse(WarehouseBase):
    warehouse_id: UUID

    class Config:
        orm_mode = True


# ---- Схемы для товаров на складах (ProductWarehouse) ----

class ProductWarehouseBase(BaseModel):
    product_id: UUID
    warehouse_id: UUID
    quantity: conint(ge=0)


class ProductWarehouseCreate(ProductWarehouseBase):
    pass


class ProductWarehouseUpdate(BaseModel):
    quantity: conint(ge=0)


class ProductWarehouse(ProductWarehouseBase):
    product_warehouse_id: UUID

    class Config:
        orm_mode = True
