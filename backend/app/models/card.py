from sqlalchemy import Column, String, Integer, Float, Index
from app.database import Base


class Card(Base):
    __tablename__ = "cards"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    set_code = Column(String(10), nullable=False)
    number = Column(String(20), nullable=False)
    name = Column(String(500), nullable=False)
    rarity = Column(String(50), nullable=False)
    type_line = Column(String(500), nullable=True)
    mana_value = Column(Float, nullable=True)
    
    __table_args__ = (
        Index("ix_cards_set_number", "set_code", "number", unique=True),
        Index("ix_cards_name", "name"),
    )
