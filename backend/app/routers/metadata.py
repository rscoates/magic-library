from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.metadata import Language, Finish
from app.schemas.metadata import LanguageResponse, FinishResponse
from app.auth import get_current_user

router = APIRouter(prefix="/metadata", tags=["metadata"])


@router.get("/languages", response_model=List[LanguageResponse])
def list_languages(
    db: Session = Depends(get_db),
    _: None = Depends(get_current_user),
):
    """List all available languages."""
    return db.query(Language).order_by(Language.name).all()


@router.get("/finishes", response_model=List[FinishResponse])
def list_finishes(
    db: Session = Depends(get_db),
    _: None = Depends(get_current_user),
):
    """List all available finishes."""
    return db.query(Finish).order_by(Finish.name).all()
