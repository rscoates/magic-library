from pydantic import BaseModel, field_validator
from typing import Optional, List


class CollectionEntryCreate(BaseModel):
    set_code: str
    card_number: str
    container_id: int
    quantity: int = 1
    finish_id: Optional[int] = None  # NULL = non-foil
    language_id: int
    comments: Optional[str] = None
    position: Optional[int] = None  # Binder slot position for file containers
    
    @field_validator("quantity")
    @classmethod
    def quantity_positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError("Quantity must be at least 1")
        return v


class CollectionEntryUpdate(BaseModel):
    quantity: Optional[int] = None
    finish_id: Optional[int] = None
    language_id: Optional[int] = None
    comments: Optional[str] = None
    container_id: Optional[int] = None
    position: Optional[int] = None  # Binder slot position


class CollectionEntryResponse(BaseModel):
    id: int
    set_code: str
    card_number: str
    container_id: int
    quantity: int
    finish_id: Optional[int]
    finish_name: Optional[str] = None
    language_id: int
    language_name: str
    comments: Optional[str]
    card_name: str
    container_name: str
    position: Optional[int] = None  # Binder slot position
    
    class Config:
        from_attributes = True


class CollectionLocation(BaseModel):
    container_id: int
    container_name: str
    container_path: str  # Full path like "Box A > File 1"
    quantity: int
    finish_name: Optional[str]
    language_name: str
    comments: Optional[str]
    entry_id: Optional[int] = None  # For move functionality


class CollectionMoveRequest(BaseModel):
    quantity: int
    target_container_id: int
    
    @field_validator("quantity")
    @classmethod
    def quantity_positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError("Quantity must be at least 1")
        return v


class CollectionMoveResponse(BaseModel):
    success: bool
    message: str
    source_entry_id: int
    source_remaining_quantity: int
    target_entry_id: int
    target_quantity: int
    target_container_name: str
    target_container_path: str


class CollectionSummary(BaseModel):
    set_code: str
    card_number: str
    card_name: str
    rarity: str
    total_quantity: int
    locations: List[CollectionLocation]
