"""Add cupboard and drawer container types

Revision ID: 002_add_container_types
Revises: 001_initial
Create Date: 2026-02-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '002_add_container_types'
down_revision: Union[str, None] = '001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("INSERT INTO container_types (name) VALUES ('cupboard'), ('drawer')")


def downgrade() -> None:
    op.execute("DELETE FROM container_types WHERE name IN ('cupboard', 'drawer')")
