"""Add type_line and mana_value to cards

Adds type_line and mana_value columns to the cards table,
then backfills from AllPrintings.json if available.

Revision ID: 008_add_card_type_and_mana_value
Revises: 007_add_is_sold
Create Date: 2026-03-01

"""
from typing import Sequence, Union
import json
import os

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '008_add_card_type_and_mana_value'
down_revision: Union[str, None] = '007_add_is_sold'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('cards', sa.Column('type_line', sa.String(500), nullable=True))
    op.add_column('cards', sa.Column('mana_value', sa.Float(), nullable=True))

    # Backfill from AllPrintings.json
    json_path = os.environ.get('CARD_DATA_JSON', '/app/data/AllPrintings.json')

    if os.path.exists(json_path):
        print(f"Backfilling type_line and mana_value from {json_path}...")

        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        connection = op.get_bind()
        updates = []
        seen = set()

        for set_code, set_data in data.get('data', {}).items():
            for card in set_data.get('cards', []):
                key = (set_code, card.get('number', ''))
                if key in seen:
                    continue
                seen.add(key)

                type_line = card.get('type', None)
                mana_value = card.get('manaValue', None)

                if type_line is not None or mana_value is not None:
                    updates.append({
                        'sc': set_code,
                        'num': card.get('number', ''),
                        'tl': type_line,
                        'mv': mana_value,
                    })

        batch_size = 5000
        for i in range(0, len(updates), batch_size):
            batch = updates[i:i + batch_size]
            for row in batch:
                connection.execute(
                    sa.text("""
                        UPDATE cards
                        SET type_line = :tl, mana_value = :mv
                        WHERE set_code = :sc AND number = :num
                    """),
                    row
                )
            print(f"  Updated batch {i // batch_size + 1}/{(len(updates) + batch_size - 1) // batch_size}")

        print("Backfill complete!")
    else:
        print(f"Warning: {json_path} not found, skipping backfill.")


def downgrade() -> None:
    op.drop_column('cards', 'mana_value')
    op.drop_column('cards', 'type_line')
