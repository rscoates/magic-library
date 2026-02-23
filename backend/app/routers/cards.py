from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List

from app.database import get_db
from app.models.card import Card
from app.schemas.card import CardResponse
from app.auth import get_current_user

router = APIRouter(prefix="/cards", tags=["cards"])


@router.get("/search", response_model=List[CardResponse])
def search_cards(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: None = Depends(get_current_user),
):
    """Search cards by name, set code, or number."""
    query = q.strip().lower()
    
    cards = db.query(Card).filter(
        or_(
            Card.name.ilike(f"%{query}%"),
            Card.set_code.ilike(f"%{query}%"),
            Card.number.ilike(f"{query}%"),
        )
    ).limit(limit).all()
    
    return cards


@router.get("/by-set/{set_code}/{number}", response_model=CardResponse)
def get_card_by_set_number(
    set_code: str,
    number: str,
    db: Session = Depends(get_db),
    _: None = Depends(get_current_user),
):
    """Get a specific card by set code and number."""
    card = db.query(Card).filter(
        Card.set_code == set_code.upper(),
        Card.number == number
    ).first()
    
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    return card


@router.get("/sets", response_model=List[str])
def list_sets(
    db: Session = Depends(get_db),
    _: None = Depends(get_current_user),
):
    """List all available set codes."""
    sets = db.query(Card.set_code).distinct().order_by(Card.set_code).all()
    return [s[0] for s in sets]


@router.get("/set/{set_code}/numbers", response_model=List[str])
def list_numbers_in_set(
    set_code: str,
    db: Session = Depends(get_db),
    _: None = Depends(get_current_user),
):
    """List all card numbers in a set."""
    numbers = db.query(Card.number).filter(
        Card.set_code == set_code.upper()
    ).order_by(Card.number).all()
    
    if not numbers:
        raise HTTPException(status_code=404, detail="Set not found")
    
    return [n[0] for n in numbers]
