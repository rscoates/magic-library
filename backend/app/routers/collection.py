from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models.collection import CollectionEntry
from app.models.container import Container, ContainerType
from app.models.card import Card
from app.models.metadata import Language, Finish
from app.models.user import User
from app.schemas.collection import (
    CollectionEntryCreate, CollectionEntryUpdate, CollectionEntryResponse,
    CollectionSummary, CollectionLocation, CollectionMoveRequest, CollectionMoveResponse
)
from app.auth import get_current_user

router = APIRouter(prefix="/collection", tags=["collection"])


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


@router.post("/", response_model=CollectionEntryResponse)
def add_to_collection(
    data: CollectionEntryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Add a card to the collection."""
    # Verify card exists
    card = db.query(Card).filter(
        Card.set_code == data.set_code.upper(),
        Card.number == data.card_number
    ).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    # Verify container exists and belongs to user
    container = db.query(Container).filter(
        Container.id == data.container_id,
        Container.user_id == user.id
    ).first()
    if not container:
        raise HTTPException(status_code=404, detail="Container not found")
    
    # Verify language exists
    language = db.query(Language).filter(Language.id == data.language_id).first()
    if not language:
        raise HTTPException(status_code=400, detail="Invalid language")
    
    # Verify finish if provided
    finish = None
    if data.finish_id:
        finish = db.query(Finish).filter(Finish.id == data.finish_id).first()
        if not finish:
            raise HTTPException(status_code=400, detail="Invalid finish")
    
    # Check for existing entry with same characteristics
    existing = db.query(CollectionEntry).filter(
        CollectionEntry.set_code == data.set_code.upper(),
        CollectionEntry.card_number == data.card_number,
        CollectionEntry.container_id == data.container_id,
        CollectionEntry.finish_id == data.finish_id,
        CollectionEntry.language_id == data.language_id,
        CollectionEntry.user_id == user.id
    ).first()
    
    if existing:
        # Update quantity
        existing.quantity += data.quantity
        if data.comments:
            existing.comments = data.comments
        db.commit()
        db.refresh(existing)
        entry = existing
    else:
        entry = CollectionEntry(
            set_code=data.set_code.upper(),
            card_number=data.card_number,
            container_id=data.container_id,
            quantity=data.quantity,
            finish_id=data.finish_id,
            language_id=data.language_id,
            comments=data.comments,
            user_id=user.id
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
    
    return CollectionEntryResponse(
        id=entry.id,
        set_code=entry.set_code,
        card_number=entry.card_number,
        container_id=entry.container_id,
        quantity=entry.quantity,
        finish_id=entry.finish_id,
        finish_name=finish.name if finish else None,
        language_id=entry.language_id,
        language_name=language.name,
        comments=entry.comments,
        card_name=card.name,
        container_name=container.name,
        position=entry.position
    )


@router.get("/", response_model=List[CollectionEntryResponse])
def list_collection(
    container_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List collection entries, optionally filtered by container."""
    query = db.query(CollectionEntry).filter(CollectionEntry.user_id == user.id)
    
    if container_id:
        query = query.filter(CollectionEntry.container_id == container_id)
    
    entries = query.all()
    
    result = []
    for entry in entries:
        card = db.query(Card).filter(
            Card.set_code == entry.set_code,
            Card.number == entry.card_number
        ).first()
        container = db.query(Container).filter(Container.id == entry.container_id).first()
        language = db.query(Language).filter(Language.id == entry.language_id).first()
        finish = db.query(Finish).filter(Finish.id == entry.finish_id).first() if entry.finish_id else None
        
        result.append(CollectionEntryResponse(
            id=entry.id,
            set_code=entry.set_code,
            card_number=entry.card_number,
            container_id=entry.container_id,
            quantity=entry.quantity,
            finish_id=entry.finish_id,
            finish_name=finish.name if finish else None,
            language_id=entry.language_id,
            language_name=language.name if language else "Unknown",
            comments=entry.comments,
            card_name=card.name if card else "Unknown",
            container_name=container.name if container else "Unknown",
            position=entry.position
        ))
    
    return result


@router.get("/search", response_model=List[CollectionSummary])
def search_collection(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Search owned cards and show total quantities with locations."""
    query = q.strip().lower()
    
    # Find matching cards
    cards = db.query(Card).filter(Card.name.ilike(f"%{query}%")).all()
    
    results = []
    for card in cards:
        entries = db.query(CollectionEntry).filter(
            CollectionEntry.set_code == card.set_code,
            CollectionEntry.card_number == card.number,
            CollectionEntry.user_id == user.id
        ).all()
        
        if not entries:
            continue
        
        locations = []
        total_qty = 0
        
        for entry in entries:
            container = db.query(Container).filter(Container.id == entry.container_id).first()
            language = db.query(Language).filter(Language.id == entry.language_id).first()
            finish = db.query(Finish).filter(Finish.id == entry.finish_id).first() if entry.finish_id else None
            
            locations.append(CollectionLocation(
                container_id=entry.container_id,
                container_name=container.name if container else "Unknown",
                container_path=get_container_path(container, db) if container else "Unknown",
                quantity=entry.quantity,
                finish_name=finish.name if finish else None,
                language_name=language.name if language else "Unknown",
                comments=entry.comments
            ))
            total_qty += entry.quantity
        
        results.append(CollectionSummary(
            set_code=card.set_code,
            card_number=card.number,
            card_name=card.name,
            rarity=card.rarity,
            total_quantity=total_qty,
            locations=locations
        ))
    
    return results


@router.put("/{entry_id}", response_model=CollectionEntryResponse)
def update_collection_entry(
    entry_id: int,
    data: CollectionEntryUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update a collection entry."""
    entry = db.query(CollectionEntry).filter(
        CollectionEntry.id == entry_id,
        CollectionEntry.user_id == user.id
    ).first()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    if data.quantity is not None:
        if data.quantity < 1:
            raise HTTPException(status_code=400, detail="Quantity must be at least 1")
        entry.quantity = data.quantity
    
    if data.finish_id is not None:
        finish = db.query(Finish).filter(Finish.id == data.finish_id).first()
        if not finish:
            raise HTTPException(status_code=400, detail="Invalid finish")
        entry.finish_id = data.finish_id
    
    if data.language_id is not None:
        language = db.query(Language).filter(Language.id == data.language_id).first()
        if not language:
            raise HTTPException(status_code=400, detail="Invalid language")
        entry.language_id = data.language_id
    
    if data.container_id is not None:
        container = db.query(Container).filter(
            Container.id == data.container_id,
            Container.user_id == user.id
        ).first()
        if not container:
            raise HTTPException(status_code=404, detail="Container not found")
        entry.container_id = data.container_id
    
    if data.comments is not None:
        entry.comments = data.comments
    
    db.commit()
    db.refresh(entry)
    
    card = db.query(Card).filter(
        Card.set_code == entry.set_code,
        Card.number == entry.card_number
    ).first()
    container = db.query(Container).filter(Container.id == entry.container_id).first()
    language = db.query(Language).filter(Language.id == entry.language_id).first()
    finish = db.query(Finish).filter(Finish.id == entry.finish_id).first() if entry.finish_id else None
    
    return CollectionEntryResponse(
        id=entry.id,
        set_code=entry.set_code,
        card_number=entry.card_number,
        container_id=entry.container_id,
        quantity=entry.quantity,
        finish_id=entry.finish_id,
        finish_name=finish.name if finish else None,
        language_id=entry.language_id,
        language_name=language.name if language else "Unknown",
        comments=entry.comments,
        card_name=card.name if card else "Unknown",
        container_name=container.name if container else "Unknown",
        position=entry.position
    )


@router.delete("/{entry_id}")
def delete_collection_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a collection entry."""
    entry = db.query(CollectionEntry).filter(
        CollectionEntry.id == entry_id,
        CollectionEntry.user_id == user.id
    ).first()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    db.delete(entry)
    db.commit()
    return {"message": "Entry deleted"}


@router.post("/{entry_id}/move", response_model=CollectionMoveResponse)
def move_collection_entry(
    entry_id: int,
    data: CollectionMoveRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Move a quantity of cards from one container to another.
    If an entry with the same characteristics exists in the target, quantities merge.
    """
    # Get source entry
    source_entry = db.query(CollectionEntry).filter(
        CollectionEntry.id == entry_id,
        CollectionEntry.user_id == user.id
    ).first()
    
    if not source_entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    if data.quantity > source_entry.quantity:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot move {data.quantity} cards, only {source_entry.quantity} available"
        )
    
    # Verify target container exists and belongs to user
    target_container = db.query(Container).filter(
        Container.id == data.target_container_id,
        Container.user_id == user.id
    ).first()
    
    if not target_container:
        raise HTTPException(status_code=404, detail="Target container not found")
    
    if source_entry.container_id == data.target_container_id:
        raise HTTPException(status_code=400, detail="Source and target containers are the same")
    
    # Check if an entry with the same characteristics exists in the target container
    existing_target = db.query(CollectionEntry).filter(
        CollectionEntry.set_code == source_entry.set_code,
        CollectionEntry.card_number == source_entry.card_number,
        CollectionEntry.container_id == data.target_container_id,
        CollectionEntry.finish_id == source_entry.finish_id,
        CollectionEntry.language_id == source_entry.language_id,
        CollectionEntry.user_id == user.id
    ).first()
    
    if existing_target:
        # Merge into existing entry
        existing_target.quantity += data.quantity
        target_entry = existing_target
    else:
        # Create new entry in target container
        target_entry = CollectionEntry(
            set_code=source_entry.set_code,
            card_number=source_entry.card_number,
            container_id=data.target_container_id,
            quantity=data.quantity,
            finish_id=source_entry.finish_id,
            language_id=source_entry.language_id,
            comments=source_entry.comments,
            user_id=user.id
        )
        db.add(target_entry)
    
    # Reduce or delete source entry
    if data.quantity == source_entry.quantity:
        db.delete(source_entry)
        source_remaining = 0
    else:
        source_entry.quantity -= data.quantity
        source_remaining = source_entry.quantity
    
    db.commit()
    db.refresh(target_entry)
    
    return CollectionMoveResponse(
        success=True,
        message=f"Moved {data.quantity} card(s) to {target_container.name}",
        source_entry_id=entry_id,
        source_remaining_quantity=source_remaining,
        target_entry_id=target_entry.id,
        target_quantity=target_entry.quantity,
        target_container_name=target_container.name,
        target_container_path=get_container_path(target_container, db)
    )


# Binder View Endpoints

class BinderSlot(BaseModel):
    """Represents a single slot in the binder view."""
    position: int
    entry_id: Optional[int] = None
    set_code: Optional[str] = None
    card_number: Optional[str] = None
    card_name: Optional[str] = None
    quantity: int = 0
    finish_name: Optional[str] = None
    language_name: Optional[str] = None
    is_empty: bool = True
    overflow_count: Optional[int] = None  # For fill-row mode: remaining copies that didn't fit


class BinderPageResponse(BaseModel):
    """Response for a binder page view."""
    container_id: int
    container_name: str
    page: int
    total_pages: int
    slots: List[BinderSlot]  # 9 or 12 slots depending on binder_columns
    max_position: int  # Highest position used in this container
    binder_columns: int = 3
    binder_fill_row: bool = False


@router.get("/binder/{container_id}/page/{page}", response_model=BinderPageResponse)
def get_binder_page(
    container_id: int,
    page: int = 1,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a page of cards for binder view. Only works for 'file' containers."""
    container = db.query(Container).filter(Container.id == container_id).first()
    if not container:
        raise HTTPException(status_code=404, detail="Container not found")
    
    # Check if container is a 'file' type
    container_type = db.query(ContainerType).filter(ContainerType.id == container.type_id).first()
    if not container_type or container_type.name.lower() != "file":
        raise HTTPException(status_code=400, detail="Binder view is only available for 'file' containers")
    
    # Get binder settings from container
    columns = container.binder_columns or 3
    rows = 3  # Always 3 rows
    fill_row_mode = container.binder_fill_row or False
    slots_per_page = columns * rows
    
    # Calculate position range for this page
    start_position = (page - 1) * slots_per_page + 1
    end_position = start_position + slots_per_page - 1
    
    # Get entries in this container with positions
    entries = db.query(CollectionEntry).filter(
        CollectionEntry.container_id == container_id,
        CollectionEntry.user_id == user.id,
        CollectionEntry.position.isnot(None),
        CollectionEntry.position >= start_position,
        CollectionEntry.position <= end_position
    ).all()
    
    # Build a map of position -> entry
    position_map = {entry.position: entry for entry in entries}
    
    # Get the max position used in this container
    max_position_entry = db.query(CollectionEntry).filter(
        CollectionEntry.container_id == container_id,
        CollectionEntry.user_id == user.id,
        CollectionEntry.position.isnot(None)
    ).order_by(CollectionEntry.position.desc()).first()
    
    max_position = max_position_entry.position if max_position_entry else 0
    
    # Calculate total pages (at minimum 1 page, or based on max position)
    total_pages = max(1, (max_position + slots_per_page - 1) // slots_per_page)
    
    # Build slots for this page
    slots = []
    for pos in range(start_position, end_position + 1):
        entry = position_map.get(pos)
        if entry:
            card = db.query(Card).filter(
                Card.set_code == entry.set_code,
                Card.number == entry.card_number
            ).first()
            finish = db.query(Finish).filter(Finish.id == entry.finish_id).first() if entry.finish_id else None
            language = db.query(Language).filter(Language.id == entry.language_id).first()
            
            slots.append(BinderSlot(
                position=pos,
                entry_id=entry.id,
                set_code=entry.set_code,
                card_number=entry.card_number,
                card_name=card.name if card else "Unknown",
                quantity=entry.quantity,
                finish_name=finish.name if finish else None,
                language_name=language.name if language else "Unknown",
                is_empty=False
            ))
        else:
            slots.append(BinderSlot(position=pos, is_empty=True))
    
    return BinderPageResponse(
        container_id=container_id,
        container_name=container.name,
        page=page,
        total_pages=total_pages,
        slots=slots,
        max_position=max_position,
        binder_columns=columns,
        binder_fill_row=fill_row_mode
    )


class PositionUpdate(BaseModel):
    entry_id: int
    position: Optional[int]  # None to clear position


class BulkPositionUpdateRequest(BaseModel):
    updates: List[PositionUpdate]


class BulkPositionUpdateResponse(BaseModel):
    success: bool
    updated_count: int


@router.post("/binder/{container_id}/positions", response_model=BulkPositionUpdateResponse)
def update_binder_positions(
    container_id: int,
    data: BulkPositionUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Bulk update positions of entries in a binder."""
    container = db.query(Container).filter(Container.id == container_id).first()
    if not container:
        raise HTTPException(status_code=404, detail="Container not found")
    
    updated = 0
    for update in data.updates:
        entry = db.query(CollectionEntry).filter(
            CollectionEntry.id == update.entry_id,
            CollectionEntry.container_id == container_id,
            CollectionEntry.user_id == user.id
        ).first()
        
        if entry:
            entry.position = update.position
            updated += 1
    
    db.commit()
    
    return BulkPositionUpdateResponse(success=True, updated_count=updated)

