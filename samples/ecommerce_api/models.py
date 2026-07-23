"""In-memory data models for the EcommerceAPI demo (no ORM -- keeps the sample
runnable without a real database, since it exists purely for Atlas to analyze)."""

from dataclasses import dataclass, field


@dataclass
class User:
    id: int
    username: str
    email: str
    password_hash: str
    is_admin: bool = False


@dataclass
class Product:
    id: int
    name: str
    description: str
    price: float
    stock: int


@dataclass
class Order:
    id: int
    user_id: int
    product_id: int
    quantity: int
    status: str = "pending"


USERS: dict[int, User] = {}
PRODUCTS: dict[int, Product] = {}
ORDERS: dict[int, Order] = {}
_next_ids = {"user": 1, "product": 1, "order": 1}


def next_id(kind: str) -> int:
    value = _next_ids[kind]
    _next_ids[kind] += 1
    return value
