import re
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Tuple
from collections import defaultdict

from app.database import get_db
from app.models.collection import CollectionEntry
from app.models.container import Container
from app.models.card import Card
from app.models.metadata import Language, Finish
from app.models.user import User
from app.schemas.decklist import DecklistRequest, DecklistResult, DecklistCardResult, DecklistCardLocation
from app.auth import get_current_user

router = APIRouter(prefix="/decklist", tags=["decklist"])


def parse_decklist(decklist: str) -> List[Tuple[str, int, bool]]:
    """Parse MTGO format decklist into (card_name, quantity, is_sideboard) tuples."""
    lines = decklist.strip().split("\n")
    cards = []
    is_sideboard = False
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        if line.lower() in ("sideboard", "sideboard:"):
            is_sideboard = True
            continue
        
        # Match patterns like "4 Lightning Bolt" or "4x Lightning Bolt"
        match = re.match(r"^(\d+)x?\s+(.+)$", line)
        if match:
            quantity = int(match.group(1))
            card_name = match.group(2).strip()
            cards.append((card_name, quantity, is_sideboard))
    
    return cards


def get_container_path(container: Container, db: Session) -> str:
    """Build the full path of a container."""
    path_parts = []
    current = container
    
    while current is not None:
        path_parts.insert(0, current.name)
        if current.parent_id:
            current = db.query(Container).filter(Container.id == current.parent_id).first()
        else:
            current = None
    
    return " > ".join(path_parts)


def score_locations(
    locations: List[Dict],
    requested_qty: int
) -> List[Dict]:
    """
    Score and sort locations for optimal card selection.
    Prioritizes:
    1. Same set and language groupings
    2. Minimizing different sets/languages
    """
    if not locations:
        return []
    
    # Group by (set_code, language_id)
    groups = defaultdict(list)
    for loc in locations:
        key = (loc["set_code"], loc["language_id"])
        groups[key].append(loc)
    
    # Score groups by total quantity available
    scored_groups = []
    for key, locs in groups.items():
        total_qty = sum(l["quantity"] for l in locs)
        # Prefer groups that can satisfy the full request
        can_satisfy = total_qty >= requested_qty
        scored_groups.append((can_satisfy, total_qty, key, locs))
    
    # Sort: groups that can satisfy first, then by total quantity descending
    scored_groups.sort(key=lambda x: (-x[0], -x[1]))
    
    # Flatten back to location list
    result = []
    for _, _, _, locs in scored_groups:
        result.extend(locs)
    
    return result


@router.post("/check", response_model=DecklistResult)
def check_decklist(
    data: DecklistRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Check a decklist against the collection and return owned cards."""
    parsed_cards = parse_decklist(data.decklist)
    
    # Get sold container IDs to exclude
    sold_container_ids = set(
        c[0] for c in db.query(Container.id).filter(
            Container.user_id == user.id,
            Container.is_sold == True
        ).all()
    )
    
    results = []
    total_requested = 0
    total_owned = 0
    total_missing = 0
    
    for card_name, quantity, is_sideboard in parsed_cards:
        total_requested += quantity
        
        # Find all cards with this name
        cards = db.query(Card).filter(
            func.lower(Card.name) == card_name.lower()
        ).all()
        
        if not cards:
            # Card not found in database
            results.append(DecklistCardResult(
                card_name=card_name,
                requested_quantity=quantity,
                owned_quantity=0,
                missing_quantity=quantity,
                locations=[],
                is_sideboard=is_sideboard
            ))
            total_missing += quantity
            continue
        
        # Find all collection entries for these cards
        all_locations = []
        for card in cards:
            entries = db.query(CollectionEntry).filter(
                CollectionEntry.set_code == card.set_code,
                CollectionEntry.card_number == card.number,
                CollectionEntry.user_id == user.id
            ).all()
            
            for entry in entries:
                # Skip entries in sold containers
                if entry.container_id in sold_container_ids:
                    continue
                
                container = db.query(Container).filter(Container.id == entry.container_id).first()
                language = db.query(Language).filter(Language.id == entry.language_id).first()
                finish = db.query(Finish).filter(Finish.id == entry.finish_id).first() if entry.finish_id else None
                
                all_locations.append({
                    "entry_id": entry.id,
                    "set_code": entry.set_code,
                    "card_number": entry.card_number,
                    "container_name": container.name if container else "Unknown",
                    "container_path": get_container_path(container, db) if container else "Unknown",
                    "quantity": entry.quantity,
                    "finish_name": finish.name if finish else None,
                    "language_name": language.name if language else "Unknown",
                    "language_id": entry.language_id
                })
        
        # Score and sort locations
        sorted_locations = score_locations(all_locations, quantity)
        
        owned_qty = sum(loc["quantity"] for loc in sorted_locations)
        actual_owned = min(owned_qty, quantity)
        missing_qty = max(0, quantity - owned_qty)
        
        total_owned += actual_owned
        total_missing += missing_qty
        
        results.append(DecklistCardResult(
            card_name=card_name,
            requested_quantity=quantity,
            owned_quantity=owned_qty,
            missing_quantity=missing_qty,
            locations=[
                DecklistCardLocation(
                    entry_id=loc["entry_id"],
                    set_code=loc["set_code"],
                    card_number=loc["card_number"],
                    container_name=loc["container_name"],
                    container_path=loc["container_path"],
                    quantity=loc["quantity"],
                    finish_name=loc["finish_name"],
                    language_name=loc["language_name"]
                )
                for loc in sorted_locations
            ],
            is_sideboard=is_sideboard
        ))
    
    return DecklistResult(
        cards=results,
        total_cards_requested=total_requested,
        total_cards_owned=total_owned,
        total_cards_missing=total_missing
    )
