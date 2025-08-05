from sqlalchemy.orm import Session
from sqlalchemy import func
from uuid import uuid4
from . import models, logger
from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime
from app.kafka import send_to_kafka
from uuid import UUID

# ---- CRUD операции для товаров (Products) ----


def create_product(db: Session, user_id: str, name: str, description: str, category: str, price: float, stock_quantity: int, supplier_id: str, image_url: str, weight: float, dimensions: str, manufacturer: str):
    try:
        # Проверка существования поставщика
        supplier = db.query(models.Supplier).filter(
            models.Supplier.supplier_id == supplier_id).first()
        if not supplier:
            raise HTTPException(status_code=404, detail="Supplier not found")

        product_id = str(uuid4())
        new_product = models.Product(
            product_id=product_id,
            user_id=user_id,
            name=name,
            description=description,
            category=category,
            price=price,
            stock_quantity=stock_quantity,
            supplier_id=supplier_id,
            is_available=False,  # Или по умолчанию, если нужно
            created_at=datetime.utcnow(),  # Установка текущего времени
            updated_at=datetime.utcnow(),  # Установка текущего времени
            # Преобразование image_url к строке
            image_url=str(image_url) if image_url else None,
            weight=weight,
            dimensions=dimensions,
            manufacturer=manufacturer
        )

        logger.log_message(f"Received supplier_id: {supplier_id}")
        db.add(new_product)
        db.commit()
        db.refresh(new_product)

        send_to_kafka("product_topic", {"product_id": product_id})

        new_product.supplier_id = str(new_product.supplier_id)

        return new_product
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


def get_all_products(db: Session):
    try:
        products = db.query(models.Product).filter(
            models.Product.is_available == True).all()

        # Преобразуем UUID поля в строки для каждого продукта
        for product in products:
            product.product_id = str(product.product_id)
            product.supplier_id = str(product.supplier_id)

        return products
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


def get_product_by_id(db: Session, product_id: str):
    product = db.query(models.Product).filter(
        models.Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.product_id = str(product.product_id)
    product.supplier_id = str(product.supplier_id)

    return product


def update_product(db: Session, product_id: str, name: str, description: str, category: str, price: float, stock_quantity: int, supplier_id: str, image_url: str, weight: float, dimensions: str, manufacturer: str):
    try:
        product = db.query(models.Product).filter(
            models.Product.product_id == product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        # Проверка существования поставщика
        supplier = db.query(models.Supplier).filter(
            models.Supplier.supplier_id == supplier_id).first()
        if not supplier:
            raise HTTPException(status_code=404, detail="Supplier not found")

        product.name = name
        product.description = description
        product.category = category
        product.price = price
        product.stock_quantity = stock_quantity
        product.supplier_id = supplier_id
        product.image_url = str(image_url) if image_url else None
        product.weight = weight
        product.dimensions = dimensions
        product.manufacturer = manufacturer
        product.updated_at = datetime.utcnow()
        db.commit()
        return product
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


def update_product_availability(db: Session, product_id: UUID, is_available: bool):
    product = db.query(models.Product).filter(
        models.Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.is_available = is_available
    product.updated_at = datetime.utcnow()
    product.supplier_id = str(product.supplier_id)
    db.commit()
    db.refresh(product)
    return product


def delete_product(db: Session, product_id: str):
    try:
        product = db.query(models.Product).filter(
            models.Product.product_id == product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        db.delete(product)
        db.commit()
        return {"message": "Product deleted"}
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


def search_products_by_name(db: Session, name: str):
    return db.query(models.Product).filter(
        models.Product.name.ilike(f"%{name}%"),
        models.Product.is_available == True
    ).all()

# ---- CRUD операции для поставщиков (Suppliers) ----


def create_supplier(db: Session, name: str, contact_name: str, contact_email: str, phone_number: str, address: str, country: str, city: str, website: str):
    try:
        supplier_id = str(uuid4())
        new_supplier = models.Supplier(
            supplier_id=supplier_id,
            name=name,
            contact_name=contact_name,
            contact_email=contact_email,
            phone_number=phone_number,
            address=address,
            country=country,
            city=city,
            website=str(website) if website else None
        )
        db.add(new_supplier)
        db.commit()
        db.refresh(new_supplier)
        return new_supplier
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


def get_supplier_by_id(db: Session, supplier_id: str):
    supplier = db.query(models.Supplier).filter(
        models.Supplier.supplier_id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier


def get_all_suppliers(db: Session):
    suppliers = db.query(models.Supplier).all()
    return suppliers


def search_suppliers_by_name(db: Session, name: str):
    return db.query(models.Supplier).filter(models.Supplier.name.ilike(f"%{name}%")).all()


def patch_supplier(db: Session, supplier_id: str, updates: dict):
    try:
        # Получаем запись поставщика по ID
        supplier = db.query(models.Supplier).filter(
            models.Supplier.supplier_id == supplier_id).first()
        if not supplier:
            raise HTTPException(status_code=404, detail="Supplier not found")

        # Проверяем уникальность названия, если оно обновляется
        if 'name' in updates and updates['name'] is not None:
            new_name = updates['name'].strip()  # Убираем лишние пробелы

            # Проверяем, существует ли поставщик с таким названием (исключая текущего)
            existing_supplier = db.query(models.Supplier).filter(
                models.Supplier.name == new_name,
                models.Supplier.supplier_id != supplier_id
            ).first()

            if existing_supplier:
                raise HTTPException(
                    status_code=409,
                    detail=f"Supplier with name '{new_name}' already exists"
                )

        # Обновляем только те поля, которые переданы в словаре updates
        for key, value in updates.items():
            if hasattr(supplier, key):
                # Если поле 'website', преобразуем значение в строку
                if key == 'website' and value is not None:
                    setattr(supplier, key, str(value))
                else:
                    setattr(supplier, key, value)

        db.commit()
        db.refresh(supplier)
        return supplier
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


def delete_supplier(db: Session, supplier_id: str):
    try:
        supplier = db.query(models.Supplier).filter(
            models.Supplier.supplier_id == supplier_id).first()
        if not supplier:
            raise HTTPException(status_code=404, detail="Supplier not found")

            # Проверяем наличие связанных товаров
        linked_products = db.query(models.Product).filter(
            models.Product.supplier_id == supplier_id
        ).all()
        if linked_products:
            raise HTTPException(
                status_code=422,
                detail="Cannot delete supplier: there are products linked to this supplier."
            )

        db.delete(supplier)
        db.commit()
        return {"message": "Supplier deleted"}
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")

# ---- CRUD операции для складов (Warehouses) ----


def create_warehouse(db: Session, location: str, manager_name: str, capacity: int, current_stock: int, contact_number: str, email: str, is_active: bool, area_size: float):
    try:
        warehouse_id = str(uuid4())
        new_warehouse = models.Warehouse(
            warehouse_id=warehouse_id,
            location=location,
            manager_name=manager_name,
            capacity=capacity,
            current_stock=current_stock,
            contact_number=contact_number,
            email=email,
            is_active=is_active,
            area_size=area_size,
            created_at=datetime.utcnow()
        )
        db.add(new_warehouse)
        db.commit()
        db.refresh(new_warehouse)
        return new_warehouse
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


def get_warehouse_by_id(db: Session, warehouse_id: str):
    warehouse = db.query(models.Warehouse).filter(
        models.Warehouse.warehouse_id == warehouse_id).first()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    return warehouse


def get_all_warehouses(db: Session):
    warehouses = db.query(models.Warehouse).all()
    return warehouses if warehouses else []


def patch_warehouse(db: Session, warehouse_id: str, updates: dict):
    try:
        # Получаем запись склада по ID
        warehouse = db.query(models.Warehouse).filter(
            models.Warehouse.warehouse_id == warehouse_id).first()
        if not warehouse:
            raise HTTPException(status_code=404, detail="Warehouse not found")

            # Проверяем, передается ли новый location
        new_location = updates.get("location")
        if new_location:
            # Проверяем, существует ли уже склад с таким местоположением (игнорируем регистр)
            existing_warehouse = db.query(models.Warehouse).filter(
                func.lower(models.Warehouse.location) == func.lower(
                    new_location),
                models.Warehouse.warehouse_id != warehouse_id  # Исключаем текущий склад
            ).first()

            if existing_warehouse:
                raise HTTPException(
                    status_code=422, detail="This location is already in use by another warehouse."
                )

        # Обновляем только те поля, которые переданы в словаре updates
        for key, value in updates.items():
            if hasattr(warehouse, key):
                setattr(warehouse, key, value)

        db.commit()
        db.refresh(warehouse)
        return warehouse
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


def delete_warehouse(db: Session, warehouse_id: str):
    try:
        warehouse = db.query(models.Warehouse).filter(
            models.Warehouse.warehouse_id == warehouse_id).first()
        if not warehouse:
            raise HTTPException(status_code=404, detail="Warehouse not found")

         # Проверяем наличие связанных товаров в ProductWarehouse
        linked_products = db.query(models.ProductWarehouse).filter(
            models.ProductWarehouse.warehouse_id == warehouse_id
        ).all()
        if linked_products:
            raise HTTPException(
                status_code=422,
                detail="Cannot delete warehouse: there are products linked to this warehouse."
            )

        db.delete(warehouse)
        db.commit()
        return {"message": "Warehouse deleted"}
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")

# ---- CRUD операции для товаров на складах (ProductWarehouses) ----


def add_product_to_warehouse(db: Session, product_id: str, warehouse_id: str, quantity: int):
    try:
        # Проверка существования товара
        product = db.query(models.Product).filter(
            models.Product.product_id == product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        # Проверка одобренности товара (is_available должен быть True)
        if not product.is_available:
            raise HTTPException(
                status_code=400,
                detail="Cannot add unapproved product to warehouse. Product must be available"
            )

        # Проверка существования склада
        warehouse = db.query(models.Warehouse).filter(
            models.Warehouse.warehouse_id == warehouse_id).first()
        if not warehouse:
            raise HTTPException(status_code=404, detail="Warehouse not found")

        # Создание записи о товаре на складе
        product_warehouse_id = str(uuid4())
        new_record = models.ProductWarehouse(
            product_warehouse_id=product_warehouse_id,
            product_id=product_id,
            warehouse_id=warehouse_id,
            quantity=quantity
        )
        db.add(new_record)

        # Обновление количества товаров на складе
        warehouse.current_stock = (warehouse.current_stock or 0) + quantity
        warehouse.updated_at = datetime.utcnow()  # Обновляем timestamp

        db.commit()
        db.refresh(warehouse)  # Обновление экземпляра склада
        return new_record
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


def get_products_in_warehouse(db: Session, warehouse_id: str):
    try:
        # Проверка существования склада
        warehouse = db.query(models.Warehouse).filter(
            models.Warehouse.warehouse_id == warehouse_id).first()
        if not warehouse:
            raise HTTPException(status_code=404, detail="Warehouse not found")

        products = db.query(models.ProductWarehouse).filter(
            models.ProductWarehouse.warehouse_id == warehouse_id).all()
        return products
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


def update_product_in_warehouse(db: Session, product_id: str, product_warehouse_id: str, quantity: int):
    try:
        # Проверка существования продукта
        product = db.query(models.Product).filter(
            models.Product.product_id == product_id).first()
        if not product:
            raise HTTPException(
                status_code=404, detail="Продукт с указанным ID отсутствует в системе.")

        # Проверка существования записи
        record = db.query(models.ProductWarehouse).filter(
            models.ProductWarehouse.product_warehouse_id == product_warehouse_id).first()
        if not record:
            raise HTTPException(status_code=404, detail="Record not found")

            # Проверка существования склада
        warehouse = db.query(models.Warehouse).filter(
            models.Warehouse.warehouse_id == record.warehouse_id
        ).first()
        if not warehouse:
            raise HTTPException(status_code=404, detail="Склад не найден.")

        quantity_difference = quantity - record.quantity

        record.quantity = quantity

        # Обновление текущего запаса на складе
        warehouse.current_stock = max(
            (warehouse.current_stock or 0) + quantity_difference, 0)
        warehouse.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(warehouse)
        return record
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


def delete_product_from_warehouse(db: Session, product_id: str, product_warehouse_id: str):
    try:
        # Проверка существования записи
        record = db.query(models.ProductWarehouse).filter(
            models.ProductWarehouse.product_warehouse_id == product_warehouse_id,
            # Проверяем соответствие product_id
            models.ProductWarehouse.product_id == product_id
        ).first()
        if not record:
            raise HTTPException(
                status_code=404, detail="Product not found in warehouse")

            # Проверка существования склада
        warehouse = db.query(models.Warehouse).filter(
            models.Warehouse.warehouse_id == record.warehouse_id
        ).first()
        if not warehouse:
            raise HTTPException(status_code=404, detail="Склад не найден.")

            # Уменьшаем current_stock на количество удаляемого товара
        warehouse.current_stock = max(
            (warehouse.current_stock or 0) - record.quantity, 0)
        warehouse.updated_at = datetime.utcnow()

        db.delete(record)
        db.commit()
        db.refresh(warehouse)
        return {"message": "Product removed from warehouse"}
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")
