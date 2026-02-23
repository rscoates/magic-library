from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional, List, Literal


class ContainerTypeResponse(BaseModel):
    id: int
    name: str
    
    class Config:
        from_attributes = True


class ContainerCreate(BaseModel):
    name: str
    description: Optional[str] = None
    type_id: int
    parent_id: Optional[int] = None
    binder_columns: Literal[3, 4] = 3
    binder_fill_row: bool = False
    
    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()


class ContainerUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    type_id: Optional[int] = None
    parent_id: Optional[int] = None
    binder_columns: Optional[Literal[3, 4]] = None
    binder_fill_row: Optional[bool] = None


class ContainerResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    type_id: int
    container_type: ContainerTypeResponse
    parent_id: Optional[int]
    depth: int
    created_at: datetime
    binder_columns: int = 3
    binder_fill_row: bool = False
    children: List["ContainerResponse"] = []
    
    class Config:
        from_attributes = True


ContainerResponse.model_rebuild()
