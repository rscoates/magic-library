from sqlalchemy import Column, String, Integer
from app.database import Base


class Language(Base):
    __tablename__ = "languages"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(20), unique=True, nullable=False)
    name = Column(String(100), nullable=False)


class Finish(Base):
    __tablename__ = "finishes"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), unique=True, nullable=False)
