from sqlalchemy import Column, String, Date
from app.database import Base


class Set(Base):
    __tablename__ = "sets"
    
    code = Column(String(10), primary_key=True)
    name = Column(String(200), nullable=False)
    release_date = Column(Date, nullable=True)
