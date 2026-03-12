# routes.py
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import APIRouter, Depends, HTTPException, Request, status, Path
import uuid
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from app import crud, schemas, database, auth, logger, kafka
from app.models import User
from fastapi.responses import JSONResponse
from app.database import get_session_local
import requests
import redis
from app.approval_queue import remove_product_from_pending


router = APIRouter()
templates = Jinja2Templates(directory="templates")
redis_client = redis.Redis(host='redis', port=6379, db=0)

# Создаем объект security для использования схемы авторизации Bearer
security = HTTPBearer()


@router.post("/remove-from-pending/")
def remove_from_pending(product: schemas.ProductIdSchema):
    """
    Удаляет product_id из очереди на одобрение в Redis.
    """
    product_id = product.product_id
    if not product_id:
        raise HTTPException(status_code=400, detail="Product ID is required")

    try:
        remove_product_from_pending(product_id)
        return {"message": f"Product ID {product_id} removed from Redis pending queue."}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error removing product from Redis: {str(e)}")


@router.get("/get-user-token/{user_id}", response_model=schemas.Token, tags=["Profile"], summary="Get user token")
def get_user_token(user_id: str, db: Session = Depends(database.get_session_local)):
    # Попробуем получить токен из базы данных
    token_record = crud.get_user_token(db, user_id=user_id)
    logger.log_message(f"Token for user {user_id} found in DB.")
    if not token_record:
        logger.log_message(f"Token for user {user_id} not found in DB.")
        raise HTTPException(status_code=404, detail="Token not found")

    return {
        "access_token": token_record.access_token,
        "token_type": "bearer"
    }


@router.post("/refresh-token", response_model=schemas.TokenResponseSchema, include_in_schema=False)
async def refresh_token_endpoint(request: Request, db: Session = Depends(get_session_local)):
    try:
        body = await request.json()
        refresh_token = body.get("refresh_token")

        if not refresh_token:
            raise HTTPException(
                status_code=422, detail="Refresh token is required")

        # Получаем новый access token
        new_token_data = auth.refresh_access_token(refresh_token, db)
        return new_token_data

    except HTTPException as e:
        return {"detail": e.detail}


# Рендеринг страницы регистрации
@router.get("/register/", include_in_schema=False)
def register_page(request: Request):
    return templates.TemplateResponse("register.html", {"request": request})


@router.post("/register/", response_model=schemas.RegistrationResponse, status_code=status.HTTP_201_CREATED, responses={
    201: {"description": "User successfully created", "model": schemas.RegistrationResponse},
    422: {"description": "Email already registered or invalid data"},
}, tags=["Profile"], summary="Register new user")
def register_user(user: schemas.UserCreate, db: Session = Depends(database.get_session_local)):
    try:
        user_email = user.email.lower()
        db_user = crud.get_user_by_email(db, email=user_email)
        if db_user:
            logger.log_message(f"""Registration failed: email {
                user.email} is already existed.""")
            raise HTTPException(
                status_code=422, detail="Email already registered")

        # Проверка имени пользователя
        if not user.name.strip():
            raise HTTPException(
                status_code=422, detail="Name contains invalid characters."
            )
        # Проверка пароля
        if not user.password.strip():
            raise HTTPException(
                status_code=422, detail="Password contains invalid characters."
            )
        # Проверка email
        if not user.email.strip():
            raise HTTPException(
                status_code=422, detail="Invalid email format."
            )

        # Суперадмин не может быть установлен через регистрацию
        created_user = crud.create_user(db=db, user=user.copy(
            update={"email": user_email}), is_superadmin=False)
        logger.log_message(f"User is registered: {user.email}")

        # Перенаправляем на страницу авторизации
        return {
            "message": "User successfully created",
            "user": {
                "id": created_user.id,
                "name": created_user.name,
                "email": created_user.email
            }
        }
    except HTTPException as http_exc:
        # Логируем исключение с конкретным кодом ошибки
        raise http_exc
    except Exception as e:
        logger.log_message(f"An error occurred: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


# Рендеринг страницы авторизации
@router.get("/login/", include_in_schema=False)
def register_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


# Авторизация пользователя и перенаправление на страницу store
@router.post("/login/", response_model=schemas.LoginResponse, tags=["Profile"], summary="Login in system", responses={
    200: {"description": "User successfully logged in", "model": schemas.LoginResponse},
    400: {"description": "Invalid email or password"}
})
def login_for_access_token(form_data: schemas.Login, db: Session = Depends(database.get_session_local)):
    user = crud.get_user_by_email(db, email=form_data.email)
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        logger.log_message(f"""Failed login attempt for email: {
                           form_data.email}""")
        raise HTTPException(
            status_code=400, detail="Invalid email or password")

    user_id_str = str(user.id)
    tokens = auth.create_tokens(
        data={"sub": user_id_str, "is_superadmin": user.is_superadmin}, db=db)
    logger.log_message(f"User is logged in: {form_data.email}")

    return {
        "user_id": user_id_str,
        "message": "User successfully logged in",
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "token_type": "bearer"
    }


# Повышение прав до супер-админа (только для супер-админа)
@router.put("/users/promote/{user_id}", status_code=200, tags=["Superadmin"], summary="Promote to superadmin", responses={
    200: {"description": "User successfully promoted to super admin", "content": {"application/json": {"example": {"detail": "User successfully promoted to super admin"}}}},
    400: {"description": "Bad Request - User ID is required", "content": {"application/json": {"example": {"detail": "User ID is required"}}}},
    403: {"description": "Insufficient rights", "content": {"application/json": {"example": {"detail": "Insufficient rights"}}}},
    404: {"description": "User not found", "content": {"application/json": {"example": {"detail": "User not found"}}}},
    422: {"description": "This user is already a super admin", "content": {"application/json": {"example": {"detail": "This user is already a super admin"}}}},
    422: {"description": "Invalid UUID format", "content": {"application/json": {"example": {"detail": "Invalid UUID format"}}}},
})
def promote_user_to_superadmin(user_id: str,
                               db: Session = Depends(get_session_local),
                               credentials: HTTPAuthorizationCredentials = Depends(security)):
    # Проверка, что user_id не пустой
    if not user_id.strip():
        raise HTTPException(status_code=400, detail="User ID is required")

    # Проверка, что user_id имеет корректный формат UUID
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid UUID format")

    # Получаем токен из заголовка Authorization
    token = credentials.credentials

    # Проверяем токен
    token_data = auth.verify_token(token, db=db)
    requesting_user = crud.get_user_by_id(db, uuid.UUID(token_data["sub"]))

    # Проверяем права (только супер-админ может повышать других пользователей)
    if not requesting_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Insufficient rights")

    user = crud.get_user_by_id(db, user_uuid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Проверяем, является ли изменяемый пользователь уже супер-админом
    if user.is_superadmin:
        raise HTTPException(
            status_code=422, detail="This user is already a super admin")

    # Повышаем пользователя до супер-админа
    promoted_user = crud.promote_to_superadmin(db, user_uuid)
    if not promoted_user:
        raise HTTPException(status_code=404, detail="User not found")

    logger.log_message(f"User {promoted_user.email} promoted to super admin.")
    return {"detail": "User successfully promoted to super admin"}


# Получение списка пользователей (только для супер-админа)
@router.get("/users/", response_model=list[schemas.UserResponse], tags=["Superadmin"], summary="Get users")
def get_users(db: Session = Depends(get_session_local),
              credentials: HTTPAuthorizationCredentials = Depends(security)):
    # Получаем токен из заголовка Authorization
    token = credentials.credentials

    # Проверяем токен
    token_data = auth.verify_token(token, db=db)
    requesting_user = crud.get_user_by_id(db, uuid.UUID(token_data["sub"]))

    if requesting_user.is_superadmin:
        # Если пользователь супер-админ, возвращаем список всех пользователей
        users = crud.get_users_for_superadmin(db)
    else:
        # Если пользователь не супер-админ, возвращаем только его запись
        users = [requesting_user]

    result = []
    for user in users:
        result.append({
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "role": "superadmin" if user.is_superadmin else "user"
        })

    return result


# Пример маршрута для редактирования пользователя с проверкой токена через HTTPBearer
@router.put("/users/edit/{user_id}", response_model=schemas.UserUpdateResponse, responses={
    200: {"description": "User successfully updated", "model": schemas.UserUpdateResponse},
    400: {"description": "Bad Request - User ID is required", "content": {"application/json": {"example": {"detail": "User ID is required"}}}},
    403: {"description": "Insufficient rights", "content": {"application/json": {"example": {"detail": "Insufficient rights"}}}},
    404: {"description": "User not found", "content": {"application/json": {"example": {"detail": "User not found"}}}},
    422: {"description": "Invalid UUID format", "content": {"application/json": {"example": {"detail": "Invalid UUID format"}}}},
    422: {"description": "Email already registered", "content": {"application/json": {"example": {"detail": "Email already registered"}}}},
}, tags=["Superadmin"], summary="Edit user")
def edit_user(user_id: str, form_data: schemas.UserUpdate, db: Session = Depends(get_session_local), credentials: HTTPAuthorizationCredentials = Depends(security)):

    # Проверка, что user_id не пустой
    if not user_id.strip():
        raise HTTPException(status_code=400, detail="User ID is required")

    # Проверка корректности UUID
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")

    # Получаем токен и проверяем права
    token = credentials.credentials
    token_data = auth.verify_token(token, db=db)
    requesting_user = crud.get_user_by_id(db, uuid.UUID(token_data["sub"]))

    # Проверка на права (только супер-админ может изменять пользователей)
    if not requesting_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Insufficient rights")

    # Проверяем, существует ли пользователь с таким user_id
    user = crud.get_user_by_id(db, user_uuid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Проверка на уникальность email
    if form_data.email:
        existing_user = crud.get_user_by_email(db, form_data.email)
        if existing_user and existing_user.id != user.id:
            raise HTTPException(
                status_code=422, detail="Email already registered")

    # Обновляем информацию пользователя
    updated_user = crud.edit_user(db, user_uuid, form_data)
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found")

    logger.log_message(f"User {user.email} has been updated.")

    return {
        "detail": "User successfully updated",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email
        }
    }

# Пример маршрута для удаления пользователя с проверкой токена через HTTPBearer


@router.delete("/users/delete/{user_id}", responses={
    200: {"description": "User successfully deleted", "content": {"application/json": {"example": {"detail": "User successfully deleted"}}}},
    400: {"description": "Bad Request - User ID is required", "content": {"application/json": {"example": {"detail": "User ID is required"}}}},
    403: {"description": "Insufficient rights or attempt to delete own account", "content": {"application/json": {"example": {"detail": "Insufficient rights"}}}},
    404: {"description": "User not found", "content": {"application/json": {"example": {"detail": "User not found"}}}},
    422: {"description": "Invalid UUID format", "content": {"application/json": {"example": {"detail": "Invalid UUID format"}}}},
}, tags=["Superadmin"], summary="Delete user")
def delete_user(user_id: str,
                credentials: HTTPAuthorizationCredentials = Depends(security),
                db: Session = Depends(get_session_local)):

    # Проверка, что user_id не пустой
    if not user_id.strip():
        raise HTTPException(status_code=400, detail="User ID is required")

    # Проверка корректности UUID
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")

    # Извлекаем и проверяем токен
    token = credentials.credentials
    token_data = auth.verify_token(token, db=db)

    # Проверяем права (например, только супер-админ может удалять пользователей)
    requesting_user = crud.get_user_by_id(db, uuid.UUID(token_data["sub"]))
    if not requesting_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Insufficient rights")

    # Проверяем, пытается ли супер-админ удалить свой собственный аккаунт
    if str(requesting_user.id) == user_id:
        raise HTTPException(
            status_code=403, detail="Super admin cannot delete own account")

    # Удаление пользователя
    user = crud.delete_user(db, user_uuid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    logger.log_message(
        f"Super admin {requesting_user.email} deleted user {user.email}.")
    return {"detail": "User successfully deleted"}


@router.get("/get-pending-products/", summary="Get list of products pending approval")
def get_pending_products(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(database.get_session_local)
):
    # Проверка токена и прав доступа
    token = credentials.credentials
    token_data = auth.verify_token(token, db=db)
    requesting_user = crud.get_user_by_id(db, uuid.UUID(token_data["sub"]))

    if not requesting_user.is_superadmin:
        raise HTTPException(
            status_code=403, detail="Insufficient rights to view pending products")

    products_data = []

    # Получение списка продуктов из Redis
    pending_product_ids = redis_client.smembers("pending_products")
    logger.log_message(f"""Pending product IDs retrieved from Redis: {
                       pending_product_ids}""")

    for product_id in pending_product_ids:
        product_id = product_id.decode('utf-8')
        try:
            response = requests.get(
                f"http://products_service:8000/products/{product_id}",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                },
                timeout=5
            )
            logger.log_message(f"""Making request to http://products_service:8000/products/{
                               product_id} with headers: {{'Authorization': 'Bearer {token}', 'Content-Type': 'application/json'}}""")
            if response.status_code == 200:
                products_data.append(response.json())
            else:
                logger.log_message(f"""Failed to fetch product data for ID {
                                   product_id}: {response.status_code}""")
        except requests.RequestException as e:
            logger.log_message(f"""Error fetching product data for ID {
                               product_id}: {e}""")

    return products_data


@router.get("/user_name/{user_id}")
def get_user_name(user_id: uuid.UUID, db: Session = Depends(database.get_session_local)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"name": user.name}
