from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models.collection import CollectionEntry
from app.models.card import Card
from app.models.metadata import Finish
from app.models.container import Container
from app.models.user import User
from app.auth import get_current_user
from app.services.pricing import get_card_value, is_loaded, load_prices

router = APIRouter(prefix="/pricing", tags=["pricing"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class PricedCard(BaseModel):
    """A single collection entry with its resolved price."""
    entry_id: int
    card_name: str
    set_code: str
    card_number: str
    finish_name: Optional[str]
    quantity: int
    unit_price: Optional[float]
    total_price: Optional[float]
    container_name: str
    container_id: int


class CollectionValueSummary(BaseModel):
    """Overall value summary for the collection (or a container)."""
    total_value: float
    total_cards: int          # sum of quantities
    total_unique: int         # distinct entries
    priced_cards: int         # entries that have a price
    unpriced_cards: int       # entries with no price data
    pricing_available: bool   # whether the pricing engine is loaded


class TopCardsResponse(BaseModel):
    summary: CollectionValueSummary
    cards: List[PricedCard]


class PricingStatusResponse(BaseModel):
    loaded: bool
    message: str


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/status", response_model=PricingStatusResponse)
def pricing_status():
    """Check whether pricing data is loaded."""
    if is_loaded():
        return PricingStatusResponse(loaded=True, message="Pricing data is loaded.")
    return PricingStatusResponse(loaded=False, message="Pricing data is not available. Place a Scryfall default-cards JSON in the data directory and restart.")


@router.post("/reload", response_model=PricingStatusResponse)
def reload_pricing(user: User = Depends(get_current_user)):
    """Reload pricing data from disk."""
    count = load_prices()
    if count > 0:
        return PricingStatusResponse(loaded=True, message=f"Reloaded pricing data for {count} cards.")
    return PricingStatusResponse(loaded=False, message="Failed to load pricing data. Check server logs.")


@router.get("/collection", response_model=TopCardsResponse)
def collection_value(
    container_id: Optional[int] = Query(None, description="Filter by container (omit for entire collection)"),
    include_sold: bool = Query(False, description="Include cards in sold containers"),
    limit: int = Query(250, ge=1, le=1000, description="Number of top cards to return"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get collection value summary and top cards by value.
    
    Uses the Scryfall pricing data to calculate values.
    Foil status is resolved from the entry's finish_id:
    - NULL finish → regular (usd)
    - 'foil' finish → usd_foil
    - 'etched' finish → usd_etched
    """
    # Build query for all collection entries
    query = db.query(CollectionEntry).filter(CollectionEntry.user_id == user.id)
    if container_id is not None:
        query = query.filter(CollectionEntry.container_id == container_id)
    elif not include_sold:
        # Exclude entries in sold containers
        sold_ids = db.query(Container.id).filter(
            Container.user_id == user.id,
            Container.is_sold == True
        ).subquery()
        query = query.filter(~CollectionEntry.container_id.in_(sold_ids))
    
    entries = query.all()
    
    # Resolve prices for each entry
    priced_cards: list[PricedCard] = []
    total_value = 0.0
    total_cards = 0
    priced_count = 0
    unpriced_count = 0
    
    # Cache lookups to avoid repeated DB hits
    card_cache: dict[tuple[str, str], Optional[Card]] = {}
    finish_cache: dict[Optional[int], Optional[str]] = {None: None}
    container_cache: dict[int, str] = {}
    
    for entry in entries:
        # Resolve card name
        card_key = (entry.set_code, entry.card_number)
        if card_key not in card_cache:
            card_cache[card_key] = db.query(Card).filter(
                Card.set_code == entry.set_code,
                Card.number == entry.card_number
            ).first()
        card = card_cache[card_key]
        card_name = card.name if card else "Unknown"
        
        # Resolve finish name
        if entry.finish_id not in finish_cache:
            finish = db.query(Finish).filter(Finish.id == entry.finish_id).first()
            finish_cache[entry.finish_id] = finish.name if finish else None
        finish_name = finish_cache[entry.finish_id]
        
        # Resolve container name
        if entry.container_id not in container_cache:
            container = db.query(Container).filter(Container.id == entry.container_id).first()
            container_cache[entry.container_id] = container.name if container else "Unknown"
        container_name = container_cache[entry.container_id]
        
        # Get price
        unit_price = get_card_value(entry.set_code, entry.card_number, finish_name)
        total_price = (unit_price * entry.quantity) if unit_price is not None else None
        
        total_cards += entry.quantity
        if unit_price is not None:
            priced_count += 1
            total_value += total_price  # type: ignore
        else:
            unpriced_count += 1
        
        priced_cards.append(PricedCard(
            entry_id=entry.id,
            card_name=card_name,
            set_code=entry.set_code,
            card_number=entry.card_number,
            finish_name=finish_name,
            quantity=entry.quantity,
            unit_price=unit_price,
            total_price=total_price,
            container_name=container_name,
            container_id=entry.container_id,
        ))
    
    # Sort by total_price descending (None values last)
    priced_cards.sort(key=lambda c: (c.total_price is not None, c.total_price or 0), reverse=True)
    
    top_cards = priced_cards[:limit]
    
    summary = CollectionValueSummary(
        total_value=round(total_value, 2),
        total_cards=total_cards,
        total_unique=len(entries),
        priced_cards=priced_count,
        unpriced_cards=unpriced_count,
        pricing_available=is_loaded(),
    )
    
    return TopCardsResponse(summary=summary, cards=top_cards)
