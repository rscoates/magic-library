from pydantic import BaseModel


class LanguageResponse(BaseModel):
    id: int
    code: str
    name: str
    
    class Config:
        from_attributes = True


class FinishResponse(BaseModel):
    id: int
    name: str
    
    class Config:
        from_attributes = True
