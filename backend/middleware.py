from fastapi import Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import os

SECRET_KEY = os.environ.get("JWT_SECRET", "boma-super-secret-key-2024")
ALGORITHM = "HS256"

security = HTTPBearer()

def create_token(data: dict) -> str:
    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth.split(" ")[1]
    payload = decode_token(token)
    return payload

def require_roles(*roles):
    async def checker(request: Request):
        user = await get_current_user(request)
        if user.get("role") not in roles and user.get("role") != "superadmin":
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return checker
