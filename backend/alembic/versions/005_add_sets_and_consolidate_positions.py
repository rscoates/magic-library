"""Add sets table and consolidate binder positions by card name

Cards with the same name in a binder now share a position.
The position is assigned to the oldest English printing (by set release date).

Revision ID: 005_sets_positions
Revises: 004_add_binder_settings
Create Date: 2026-02-24

"""
from typing import Sequence, Union
import json
import os
from datetime import datetime

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '005_sets_positions'
down_revision: Union[str, None] = '004_add_binder_settings'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create sets table
    op.create_table(
        'sets',
        sa.Column('code', sa.String(10), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('release_date', sa.Date(), nullable=True),
    )
    
    # Load set data from AllPrintings.json
    json_path = os.environ.get('CARD_DATA_JSON', '/app/data/AllPrintings.json')
    
    if os.path.exists(json_path):
        print(f"Loading set data from {json_path}...")
        
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        connection = op.get_bind()
        
        # Insert sets
        sets_data = []
        for set_code, set_data in data.get('data', {}).items():
            release_date_str = set_data.get('releaseDate')
            release_date = None
            if release_date_str:
                try:
                    release_date = datetime.strptime(release_date_str, '%Y-%m-%d').date()
                except ValueError:
                    pass
            
            sets_data.append({
                'code': set_code,
                'name': set_data.get('name', set_code),
                'release_date': release_date
            })
        
        print(f"Inserting {len(sets_data)} sets...")
        for set_info in sets_data:
            connection.execute(
                sa.text("INSERT INTO sets (code, name, release_date) VALUES (:code, :name, :release_date) ON CONFLICT (code) DO NOTHING"),
                set_info
            )
        
        # Now consolidate positions by card name within each container
        # For each container, group entries by card name and assign shared positions
        print("Consolidating binder positions by card name...")
        
        # Get all file containers (binders)
        file_type_result = connection.execute(
            sa.text("SELECT id FROM container_types WHERE LOWER(name) = 'file'")
        ).fetchone()
        
        if file_type_result:
            file_type_id = file_type_result[0]
            
            # Get all file containers
            containers = connection.execute(
                sa.text("SELECT id FROM containers WHERE type_id = :type_id"),
                {'type_id': file_type_id}
            ).fetchall()
            
            for (container_id,) in containers:
                # Get all entries in this container with their card names and set release dates
                # Join with cards to get name, join with sets to get release_date
                entries = connection.execute(
                    sa.text("""
                        SELECT ce.id, c.name as card_name, ce.language_id, s.release_date, ce.position
                        FROM collection_entries ce
                        JOIN cards c ON c.set_code = ce.set_code AND c.number = ce.card_number
                        LEFT JOIN sets s ON s.code = ce.set_code
                        WHERE ce.container_id = :container_id
                        ORDER BY c.name, 
                                 CASE WHEN ce.language_id = (SELECT id FROM languages WHERE LOWER(name) = 'english' LIMIT 1) THEN 0 ELSE 1 END,
                                 COALESCE(s.release_date, '9999-12-31'),
                                 ce.id
                    """),
                    {'container_id': container_id}
                ).fetchall()
                
                # Group by card name and assign positions
                card_positions = {}  # card_name -> position
                next_position = 1
                
                for entry_id, card_name, language_id, release_date, current_position in entries:
                    if card_name not in card_positions:
                        # This is the first (best) entry for this card name - assign new position
                        card_positions[card_name] = next_position
                        next_position += 1
                    
                    # Assign the shared position to this entry
                    new_position = card_positions[card_name]
                    connection.execute(
                        sa.text("UPDATE collection_entries SET position = :pos WHERE id = :id"),
                        {'pos': new_position, 'id': entry_id}
                    )
        
        print("Position consolidation complete.")
    else:
        print(f"Warning: {json_path} not found. Sets table will be empty.")


def downgrade() -> None:
    op.drop_table('sets')
