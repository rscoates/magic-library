from pydantic import BaseModel
from typing import List, Optional


class DecklistRequest(BaseModel):
    decklist: str


class DecklistCardResult(BaseModel):
    card_name: str
    requested_quantity: int
    owned_quantity: int
    missing_quantity: int
    locations: List["DecklistCardLocation"]
    is_sideboard: bool = False


class DecklistCardLocation(BaseModel):
    entry_id: int
    set_code: str
    card_number: str
    container_name: str
    container_path: str
    quantity: int
    finish_name: Optional[str]
    language_name: str


class DecklistResult(BaseModel):
    cards: List[DecklistCardResult]
    total_cards_requested: int
    total_cards_owned: int
    total_cards_missing: int


DecklistCardResult.model_rebuild()
