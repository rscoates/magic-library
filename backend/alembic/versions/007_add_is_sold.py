"""Add is_sold flag to containers

Adds a boolean is_sold column to the containers table.
Sold containers track cards that have been sold and are excluded
from searches and collection views by default.

Revision ID: 007_add_is_sold
Revises: 006_add_2x2_layout
Create Date: 2026-03-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '007_add_is_sold'
down_revision: Union[str, None] = '006_add_2x2_layout'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('containers', sa.Column('is_sold', sa.Boolean(), nullable=False, server_default=sa.text('false')))


def downgrade() -> None:
    op.drop_column('containers', 'is_sold')
