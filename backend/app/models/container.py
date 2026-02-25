from sqlalchemy import Column, String, Integer, ForeignKey, Text, DateTime, CheckConstraint, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class ContainerType(Base):
    __tablename__ = "container_types"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), unique=True, nullable=False)
    
    containers = relationship("Container", back_populates="container_type")


class Container(Base):
    __tablename__ = "containers"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    type_id = Column(Integer, ForeignKey("container_types.id"), nullable=False)
    parent_id = Column(Integer, ForeignKey("containers.id"), nullable=True)
    depth = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Binder view settings (only used for 'file' type containers)
    binder_columns = Column(Integer, nullable=False, default=3)  # 2, 3, or 4
    binder_fill_row = Column(Boolean, nullable=False, default=False)  # Fill row with copies vs badge
    
    container_type = relationship("ContainerType", back_populates="containers")
    parent = relationship("Container", remote_side=[id], backref="children")
    collection_entries = relationship("CollectionEntry", back_populates="container", cascade="all, delete-orphan")
    
    __table_args__ = (
        CheckConstraint("depth <= 10", name="max_depth_check"),
        CheckConstraint("binder_columns IN (2, 3, 4)", name="binder_columns_check"),
    )
