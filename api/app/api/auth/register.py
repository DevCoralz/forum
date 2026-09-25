from fastapi import APIRouter

from app.schemas.auth import RegisterRequest, RegisterResponse
from app.services.auth_service import auth_service

router = APIRouter()


@router.post("/register", response_model=RegisterResponse, status_code=201)
def register(body: RegisterRequest):
    return auth_service.register(body)
