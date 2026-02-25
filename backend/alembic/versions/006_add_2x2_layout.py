"""Add 2x2 layout option for binders

Updates the binder_columns constraint to allow 2 columns.
When columns is 2, rows will also be 2 for a 2x2 = 4 slot layout.

Revision ID: 006_add_2x2_layout
Revises: 005_sets_positions
Create Date: 2026-02-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '006_add_2x2_layout'
down_revision: Union[str, None] = '005_sets_positions'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the old constraint and add new one that allows 2, 3, or 4
    op.drop_constraint('binder_columns_check', 'containers', type_='check')
    op.create_check_constraint('binder_columns_check', 'containers', 'binder_columns IN (2, 3, 4)')


def downgrade() -> None:
    # Revert to old constraint (only 3 or 4)
    # First update any 2-column binders to 3
    op.execute("UPDATE containers SET binder_columns = 3 WHERE binder_columns = 2")
    op.drop_constraint('binder_columns_check', 'containers', type_='check')
    op.create_check_constraint('binder_columns_check', 'containers', 'binder_columns IN (3, 4)')
