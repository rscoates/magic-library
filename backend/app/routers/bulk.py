"""Bulk import/export endpoints for collection data.

Supports multiple CSV formats:
- MTGGoldfish: Card,Set ID,Set Name,Quantity,Foil,Variation
- Deckbox: Count,Tradelist Count,Name,Edition,Card Number,Condition,Language,Foil
- Simple: Quantity,Name,Set,Number,Foil,Language
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from enum import Enum
import csv
import io

from app.database import get_db
from app.models.collection import CollectionEntry
from app.models.container import Container, ContainerType
from app.models.card import Card
from app.models.metadata import Language, Finish
from app.models.user import User
from app.auth import get_current_user

router = APIRouter(prefix="/bulk", tags=["bulk"])


class ExportFormat(str, Enum):
    MTGGOLDFISH = "mtggoldfish"
    DECKBOX = "deckbox"
    SIMPLE = "simple"


class ImportFormat(str, Enum):
    MTGGOLDFISH = "mtggoldfish"
    DECKBOX = "deckbox"
    SIMPLE = "simple"
    AUTO = "auto"  # Auto-detect format


class ImportResult(BaseModel):
    success: bool
    imported_count: int
    skipped_count: int
    error_count: int
    errors: List[str]
    warnings: List[str]


class ExportRequest(BaseModel):
    container_id: Optional[int] = None  # None = export all
    format: ExportFormat = ExportFormat.SIMPLE


def get_finish_name(finish_id: Optional[int], db: Session) -> Optional[str]:
    if not finish_id:
        return None
    finish = db.query(Finish).filter(Finish.id == finish_id).first()
    return finish.name if finish else None


def get_language_name(language_id: int, db: Session) -> str:
    language = db.query(Language).filter(Language.id == language_id).first()
    return language.name if language else "English"


def find_language_id(name: str, db: Session) -> Optional[int]:
    """Find language ID by name (case-insensitive)."""
    if not name:
        name = "English"
    language = db.query(Language).filter(
        func.lower(Language.name) == name.lower()
    ).first()
    return language.id if language else None


def find_finish_id(name: str, db: Session) -> Optional[int]:
    """Find finish ID by name (case-insensitive)."""
    if not name or name.lower() in ('no', 'regular', '', 'normal'):
        return None
    # Map common names
    name_lower = name.lower()
    if name_lower in ('yes', 'foil', 'true', '1'):
        name = 'foil'
    elif name_lower == 'foil_etched':
        name = 'etched'
    
    finish = db.query(Finish).filter(
        func.lower(Finish.name) == name.lower()
    ).first()
    return finish.id if finish else None


def find_card_by_name_and_set(name: str, set_code: Optional[str], db: Session) -> Optional[Card]:
    """Find a card by name and optional set code."""
    query = db.query(Card).filter(func.lower(Card.name) == name.lower())
    if set_code:
        query = query.filter(func.upper(Card.set_code) == set_code.upper())
    return query.first()


def detect_format(header: List[str]) -> ImportFormat:
    """Auto-detect CSV format based on header."""
    header_lower = [h.lower().strip() for h in header]
    
    if 'set id' in header_lower or 'set name' in header_lower:
        return ImportFormat.MTGGOLDFISH
    if 'tradelist count' in header_lower or 'card number' in header_lower:
        return ImportFormat.DECKBOX
    return ImportFormat.SIMPLE


@router.post("/export")
def export_collection(
    request: ExportRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Export collection to CSV format."""
    # Build query
    query = db.query(CollectionEntry).filter(CollectionEntry.user_id == user.id)
    if request.container_id:
        query = query.filter(CollectionEntry.container_id == request.container_id)
    
    entries = query.all()
    
    # Create CSV in memory
    output = io.StringIO()
    
    if request.format == ExportFormat.MTGGOLDFISH:
        writer = csv.writer(output)
        writer.writerow(['Card', 'Set ID', 'Set Name', 'Quantity', 'Foil', 'Variation'])
        
        for entry in entries:
            card = db.query(Card).filter(
                Card.set_code == entry.set_code,
                Card.number == entry.card_number
            ).first()
            finish_name = get_finish_name(entry.finish_id, db)
            foil_str = finish_name.upper() if finish_name else 'REGULAR'
            
            writer.writerow([
                card.name if card else 'Unknown',
                entry.set_code,
                entry.set_code,  # Set Name - we could look this up from sets table
                entry.quantity,
                foil_str,
                ''  # Variation
            ])
    
    elif request.format == ExportFormat.DECKBOX:
        writer = csv.writer(output)
        writer.writerow(['Count', 'Tradelist Count', 'Name', 'Edition', 'Card Number', 
                         'Condition', 'Language', 'Foil'])
        
        for entry in entries:
            card = db.query(Card).filter(
                Card.set_code == entry.set_code,
                Card.number == entry.card_number
            ).first()
            finish_name = get_finish_name(entry.finish_id, db)
            language_name = get_language_name(entry.language_id, db)
            foil_str = 'foil' if finish_name and 'foil' in finish_name.lower() else ''
            
            writer.writerow([
                entry.quantity,
                0,  # Tradelist count
                card.name if card else 'Unknown',
                entry.set_code,
                entry.card_number,
                'Near Mint',
                language_name,
                foil_str
            ])
    
    else:  # SIMPLE format
        writer = csv.writer(output)
        writer.writerow(['Quantity', 'Name', 'Set', 'Number', 'Foil', 'Language', 'Container'])
        
        for entry in entries:
            card = db.query(Card).filter(
                Card.set_code == entry.set_code,
                Card.number == entry.card_number
            ).first()
            container = db.query(Container).filter(Container.id == entry.container_id).first()
            finish_name = get_finish_name(entry.finish_id, db)
            language_name = get_language_name(entry.language_id, db)
            
            writer.writerow([
                entry.quantity,
                card.name if card else 'Unknown',
                entry.set_code,
                entry.card_number,
                finish_name or '',
                language_name,
                container.name if container else ''
            ])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=collection_{request.format.value}.csv"}
    )


class ImportRequest(BaseModel):
    container_id: int
    format: ImportFormat = ImportFormat.AUTO
    csv_data: str


@router.post("/import", response_model=ImportResult)
def import_collection(
    request: ImportRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Import collection from CSV data."""
    # Verify container exists
    container = db.query(Container).filter(
        Container.id == request.container_id,
        Container.user_id == user.id
    ).first()
    if not container:
        raise HTTPException(status_code=404, detail="Container not found")
    
    # Check if container is a binder (file type) for position assignment
    container_type = db.query(ContainerType).filter(ContainerType.id == container.type_id).first()
    is_binder = container_type and container_type.name.lower() == "file"
    
    # Get default language (English)
    english = db.query(Language).filter(func.lower(Language.name) == 'english').first()
    default_language_id = english.id if english else 1
    
    # Parse CSV
    reader = csv.reader(io.StringIO(request.csv_data))
    rows = list(reader)
    
    if len(rows) < 2:
        raise HTTPException(status_code=400, detail="CSV must have at least a header and one data row")
    
    header = rows[0]
    data_rows = rows[1:]
    
    # Detect format if auto
    format_to_use = request.format
    if format_to_use == ImportFormat.AUTO:
        format_to_use = detect_format(header)
    
    # Create column index map
    header_lower = {h.lower().strip(): i for i, h in enumerate(header)}
    
    imported = 0
    skipped = 0
    error_count = 0
    errors = []
    warnings = []
    
    for row_num, row in enumerate(data_rows, start=2):
        try:
            if not row or all(not cell.strip() for cell in row):
                continue  # Skip empty rows
            
            # Parse based on format
            if format_to_use == ImportFormat.MTGGOLDFISH:
                # Card,Set ID,Set Name,Quantity,Foil,Variation
                card_name = row[header_lower.get('card', 0)].strip()
                set_code = row[header_lower.get('set id', 1)].strip()
                quantity = int(row[header_lower.get('quantity', 3)].strip() or 1)
                foil_str = row[header_lower.get('foil', 4)].strip() if len(row) > 4 else ''
                
                finish_id = find_finish_id(foil_str, db)
                language_id = default_language_id
                
            elif format_to_use == ImportFormat.DECKBOX:
                # Count,Tradelist Count,Name,Edition,Card Number,Condition,Language,Foil
                quantity = int(row[header_lower.get('count', 0)].strip() or 1)
                card_name = row[header_lower.get('name', 2)].strip()
                set_code = row[header_lower.get('edition', 3)].strip()
                card_number = row[header_lower.get('card number', 4)].strip() if len(row) > 4 else ''
                language_str = row[header_lower.get('language', 6)].strip() if len(row) > 6 else 'English'
                foil_str = row[header_lower.get('foil', 7)].strip() if len(row) > 7 else ''
                
                finish_id = find_finish_id(foil_str, db)
                language_id = find_language_id(language_str, db) or default_language_id
                
            else:  # SIMPLE format
                # Quantity,Name,Set,Number,Foil,Language
                quantity = int(row[header_lower.get('quantity', 0)].strip() or 1)
                card_name = row[header_lower.get('name', 1)].strip()
                set_code = row[header_lower.get('set', 2)].strip() if len(row) > 2 else ''
                card_number = row[header_lower.get('number', 3)].strip() if len(row) > 3 else ''
                foil_str = row[header_lower.get('foil', 4)].strip() if len(row) > 4 else ''
                language_str = row[header_lower.get('language', 5)].strip() if len(row) > 5 else 'English'
                
                finish_id = find_finish_id(foil_str, db)
                language_id = find_language_id(language_str, db) or default_language_id
            
            # Find the card
            card = None
            
            # First try by set code and number if available
            if set_code and 'card_number' in locals() and card_number:
                card = db.query(Card).filter(
                    func.upper(Card.set_code) == set_code.upper(),
                    Card.number == card_number
                ).first()
            
            # Fall back to name + set
            if not card and set_code:
                card = find_card_by_name_and_set(card_name, set_code, db)
            
            # Fall back to just name
            if not card:
                card = find_card_by_name_and_set(card_name, None, db)
            
            if not card:
                errors.append(f"Row {row_num}: Card not found - '{card_name}' (set: {set_code})")
                error_count += 1
                continue
            
            # Determine position for binder
            position = None
            if is_binder:
                # Check if card name already exists in container
                existing_same_name = db.query(CollectionEntry).join(
                    Card,
                    (Card.set_code == CollectionEntry.set_code) & (Card.number == CollectionEntry.card_number)
                ).filter(
                    CollectionEntry.container_id == request.container_id,
                    CollectionEntry.user_id == user.id,
                    CollectionEntry.position.isnot(None),
                    Card.name == card.name
                ).first()
                
                if existing_same_name:
                    position = existing_same_name.position
                else:
                    max_pos = db.query(func.max(CollectionEntry.position)).filter(
                        CollectionEntry.container_id == request.container_id,
                        CollectionEntry.user_id == user.id
                    ).scalar()
                    position = (max_pos or 0) + 1
            
            # Check for existing entry
            existing = db.query(CollectionEntry).filter(
                CollectionEntry.set_code == card.set_code,
                CollectionEntry.card_number == card.number,
                CollectionEntry.container_id == request.container_id,
                CollectionEntry.finish_id == finish_id,
                CollectionEntry.language_id == language_id,
                CollectionEntry.user_id == user.id
            ).first()
            
            if existing:
                existing.quantity += quantity
                warnings.append(f"Row {row_num}: Added {quantity} to existing entry for '{card.name}'")
            else:
                entry = CollectionEntry(
                    set_code=card.set_code,
                    card_number=card.number,
                    container_id=request.container_id,
                    quantity=quantity,
                    finish_id=finish_id,
                    language_id=language_id,
                    user_id=user.id,
                    position=position
                )
                db.add(entry)
            
            imported += 1
            
        except Exception as e:
            errors.append(f"Row {row_num}: {str(e)}")
            error_count += 1
    
    db.commit()
    
    return ImportResult(
        success=error_count == 0,
        imported_count=imported,
        skipped_count=skipped,
        error_count=error_count,
        errors=errors[:50],  # Limit error messages
        warnings=warnings[:50]
    )


@router.get("/formats")
def list_formats():
    """List available import/export formats with descriptions."""
    return {
        "import_formats": [
            {
                "id": "auto",
                "name": "Auto-detect",
                "description": "Automatically detect format from CSV header"
            },
            {
                "id": "mtggoldfish",
                "name": "MTGGoldfish",
                "description": "Card,Set ID,Set Name,Quantity,Foil,Variation",
                "example": "Aether Vial,MMA,Modern Masters,1,FOIL,\"\""
            },
            {
                "id": "deckbox",
                "name": "Deckbox",
                "description": "Count,Tradelist Count,Name,Edition,Card Number,Condition,Language,Foil",
                "example": "4,0,Angel of Serenity,RTR,1,Near Mint,English,"
            },
            {
                "id": "simple",
                "name": "Simple",
                "description": "Quantity,Name,Set,Number,Foil,Language",
                "example": "4,Lightning Bolt,M10,146,,"
            }
        ],
        "export_formats": [
            {
                "id": "mtggoldfish",
                "name": "MTGGoldfish",
                "description": "Compatible with MTGGoldfish collection import"
            },
            {
                "id": "deckbox",
                "name": "Deckbox",
                "description": "Compatible with Deckbox.org collection import"
            },
            {
                "id": "simple",
                "name": "Simple",
                "description": "Simple format with container info for backup/restore"
            }
        ]
    }
