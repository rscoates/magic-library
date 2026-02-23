from pydantic import BaseModel


class CardBase(BaseModel):
    set_code: str
    number: str
    name: str
    rarity: str


class CardResponse(CardBase):
    id: int
    
    class Config:
        from_attributes = True


class CardSearch(BaseModel):
    query: str
    limit: int = 20
