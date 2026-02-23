"""Add binder settings to containers

Revision ID: 004_add_binder_settings
Revises: 003_add_position
Create Date: 2026-02-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '004_add_binder_settings'
down_revision: Union[str, None] = '003_add_position'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add binder_columns with default 3
    op.add_column('containers', sa.Column('binder_columns', sa.Integer(), nullable=False, server_default='3'))
    # Add binder_fill_row with default False
    op.add_column('containers', sa.Column('binder_fill_row', sa.Boolean(), nullable=False, server_default='false'))
    # Add check constraint for binder_columns
    op.create_check_constraint('binder_columns_check', 'containers', 'binder_columns IN (3, 4)')


def downgrade() -> None:
    op.drop_constraint('binder_columns_check', 'containers', type_='check')
    op.drop_column('containers', 'binder_fill_row')
    op.drop_column('containers', 'binder_columns')
