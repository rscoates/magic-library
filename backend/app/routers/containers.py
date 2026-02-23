from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.container import Container, ContainerType
from app.models.user import User
from app.schemas.container import ContainerCreate, ContainerUpdate, ContainerResponse, ContainerTypeResponse
from app.auth import get_current_user

router = APIRouter(prefix="/containers", tags=["containers"])


def get_container_depth(container_id: int, db: Session) -> int:
    """Calculate the depth of a container by traversing up the tree."""
    depth = 0
    current_id = container_id
    
    while current_id is not None:
        container = db.query(Container).filter(Container.id == current_id).first()
        if container is None:
            break
        current_id = container.parent_id
        depth += 1
        if depth > 10:
            raise HTTPException(status_code=400, detail="Maximum container depth exceeded")
    
    return depth


@router.get("/types", response_model=List[ContainerTypeResponse])
def list_container_types(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """List all container types."""
    return db.query(ContainerType).all()


@router.post("/types", response_model=ContainerTypeResponse)
def create_container_type(
    name: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Create a new container type."""
    existing = db.query(ContainerType).filter(ContainerType.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Container type already exists")
    
    container_type = ContainerType(name=name)
    db.add(container_type)
    db.commit()
    db.refresh(container_type)
    return container_type


@router.get("/", response_model=List[ContainerResponse])
def list_containers(
    parent_id: int = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List containers, optionally filtered by parent."""
    query = db.query(Container).filter(Container.user_id == user.id)
    
    if parent_id is not None:
        query = query.filter(Container.parent_id == parent_id)
    else:
        query = query.filter(Container.parent_id.is_(None))
    
    return query.all()


@router.get("/all", response_model=List[ContainerResponse])
def list_all_containers(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all containers for the user (flat list)."""
    return db.query(Container).filter(Container.user_id == user.id).all()


@router.get("/{container_id}", response_model=ContainerResponse)
def get_container(
    container_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a specific container."""
    container = db.query(Container).filter(
        Container.id == container_id,
        Container.user_id == user.id
    ).first()
    
    if not container:
        raise HTTPException(status_code=404, detail="Container not found")
    
    return container


@router.post("/", response_model=ContainerResponse)
def create_container(
    data: ContainerCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new container."""
    # Verify container type exists
    container_type = db.query(ContainerType).filter(ContainerType.id == data.type_id).first()
    if not container_type:
        raise HTTPException(status_code=400, detail="Invalid container type")
    
    # Calculate depth
    depth = 0
    if data.parent_id:
        parent = db.query(Container).filter(
            Container.id == data.parent_id,
            Container.user_id == user.id
        ).first()
        if not parent:
            raise HTTPException(status_code=400, detail="Parent container not found")
        depth = parent.depth + 1
        if depth > 10:
            raise HTTPException(status_code=400, detail="Maximum container depth (10) exceeded")
    
    container = Container(
        name=data.name,
        description=data.description,
        type_id=data.type_id,
        parent_id=data.parent_id,
        depth=depth,
        user_id=user.id
    )
    
    db.add(container)
    db.commit()
    db.refresh(container)
    return container


@router.put("/{container_id}", response_model=ContainerResponse)
def update_container(
    container_id: int,
    data: ContainerUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update a container."""
    container = db.query(Container).filter(
        Container.id == container_id,
        Container.user_id == user.id
    ).first()
    
    if not container:
        raise HTTPException(status_code=404, detail="Container not found")
    
    if data.type_id is not None:
        container_type = db.query(ContainerType).filter(ContainerType.id == data.type_id).first()
        if not container_type:
            raise HTTPException(status_code=400, detail="Invalid container type")
        container.type_id = data.type_id
    
    if data.parent_id is not None:
        if data.parent_id == container_id:
            raise HTTPException(status_code=400, detail="Container cannot be its own parent")
        
        parent = db.query(Container).filter(
            Container.id == data.parent_id,
            Container.user_id == user.id
        ).first()
        if not parent:
            raise HTTPException(status_code=400, detail="Parent container not found")
        
        new_depth = parent.depth + 1
        if new_depth > 10:
            raise HTTPException(status_code=400, detail="Maximum container depth (10) exceeded")
        
        container.parent_id = data.parent_id
        container.depth = new_depth
    
    if data.name is not None:
        container.name = data.name
    
    if data.description is not None:
        container.description = data.description
    
    if data.binder_columns is not None:
        container.binder_columns = data.binder_columns
    
    if data.binder_fill_row is not None:
        container.binder_fill_row = data.binder_fill_row
    
    db.commit()
    db.refresh(container)
    return container


@router.delete("/{container_id}")
def delete_container(
    container_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a container and all its contents."""
    container = db.query(Container).filter(
        Container.id == container_id,
        Container.user_id == user.id
    ).first()
    
    if not container:
        raise HTTPException(status_code=404, detail="Container not found")
    
    # Check for children
    children = db.query(Container).filter(Container.parent_id == container_id).first()
    if children:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete container with children. Delete children first."
        )
    
    db.delete(container)
    db.commit()
    return {"message": "Container deleted"}
