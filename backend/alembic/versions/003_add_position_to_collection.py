"""Add position field to collection_entries for binder view

Revision ID: 003_add_position
Revises: 002_add_container_types
Create Date: 2026-02-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '003_add_position'
down_revision: Union[str, None] = '002_add_container_types'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('collection_entries', sa.Column('position', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('collection_entries', 'position')
