from sqlalchemy import Column, String, Integer, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base


class CollectionEntry(Base):
    __tablename__ = "collection_entries"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    set_code = Column(String(10), nullable=False)
    card_number = Column(String(20), nullable=False)
    container_id = Column(Integer, ForeignKey("containers.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    finish_id = Column(Integer, ForeignKey("finishes.id"), nullable=True)  # NULL = non-foil
    language_id = Column(Integer, ForeignKey("languages.id"), nullable=False)
    comments = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    position = Column(Integer, nullable=True)  # Binder slot position for file containers
    
    container = relationship("Container", back_populates="collection_entries")
    finish = relationship("Finish")
    language = relationship("Language")
    
    __table_args__ = (
        UniqueConstraint(
            "set_code", "card_number", "container_id", "finish_id", "language_id",
            name="uq_collection_entry"
        ),
    )
