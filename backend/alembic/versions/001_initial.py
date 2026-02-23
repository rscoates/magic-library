"""Initial schema and card data import

Revision ID: 001_initial
Revises: 
Create Date: 2026-02-22

"""
from typing import Sequence, Union
import json
import os

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('username', sa.String(100), nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('username')
    )
    
    # Create languages table
    op.create_table(
        'languages',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('code', sa.String(20), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    
    # Create finishes table
    op.create_table(
        'finishes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    
    # Create cards table
    op.create_table(
        'cards',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('set_code', sa.String(10), nullable=False),
        sa.Column('number', sa.String(20), nullable=False),
        sa.Column('name', sa.String(500), nullable=False),
        sa.Column('rarity', sa.String(50), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_cards_set_number', 'cards', ['set_code', 'number'], unique=True)
    op.create_index('ix_cards_name', 'cards', ['name'])
    
    # Create container_types table
    op.create_table(
        'container_types',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    
    # Create containers table
    op.create_table(
        'containers',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('type_id', sa.Integer(), nullable=False),
        sa.Column('parent_id', sa.Integer(), nullable=True),
        sa.Column('depth', sa.Integer(), nullable=False, default=0),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['type_id'], ['container_types.id']),
        sa.ForeignKeyConstraint(['parent_id'], ['containers.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('depth <= 10', name='max_depth_check')
    )
    
    # Create collection_entries table
    op.create_table(
        'collection_entries',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('set_code', sa.String(10), nullable=False),
        sa.Column('card_number', sa.String(20), nullable=False),
        sa.Column('container_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False, default=1),
        sa.Column('finish_id', sa.Integer(), nullable=True),
        sa.Column('language_id', sa.Integer(), nullable=False),
        sa.Column('comments', sa.Text(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['container_id'], ['containers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['finish_id'], ['finishes.id']),
        sa.ForeignKeyConstraint(['language_id'], ['languages.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('set_code', 'card_number', 'container_id', 'finish_id', 'language_id', name='uq_collection_entry')
    )
    
    # Insert default container types
    op.execute("INSERT INTO container_types (name) VALUES ('box'), ('file'), ('deck')")
    
    # Load and insert card data, languages, and finishes from JSON
    json_path = os.environ.get('CARD_DATA_JSON', '/app/data/AllPrintings.json')
    
    if os.path.exists(json_path):
        print(f"Loading card data from {json_path}...")
        
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Extract unique languages and finishes from all cards
        languages_set = set()
        finishes_set = set()
        
        for set_code, set_data in data.get('data', {}).items():
            for card in set_data.get('cards', []):
                # Get language
                lang = card.get('language', 'English')
                languages_set.add(lang)
                
                # Get finishes
                for finish in card.get('finishes', []):
                    if finish != 'nonfoil':  # nonfoil is represented by NULL
                        finishes_set.add(finish)
        
        # Insert languages
        print(f"Inserting {len(languages_set)} languages...")
        connection = op.get_bind()
        for lang in sorted(languages_set):
            # Create a simple code from the language name
            code = lang[:3].upper() if len(lang) >= 3 else lang.upper()
            connection.execute(
                sa.text("INSERT INTO languages (code, name) VALUES (:code, :name) ON CONFLICT (code) DO NOTHING"),
                {"code": code, "name": lang}
            )
        
        # Insert finishes
        print(f"Inserting {len(finishes_set)} finishes...")
        for finish in sorted(finishes_set):
            connection.execute(
                sa.text("INSERT INTO finishes (name) VALUES (:name) ON CONFLICT (name) DO NOTHING"),
                {"name": finish}
            )
        
        # Insert cards
        cards_data = []
        seen_cards = set()
        
        for set_code, set_data in data.get('data', {}).items():
            for card in set_data.get('cards', []):
                key = (set_code, card.get('number', ''))
                if key in seen_cards:
                    continue
                seen_cards.add(key)
                
                cards_data.append({
                    'set_code': set_code,
                    'number': card.get('number', ''),
                    'name': card.get('name', ''),
                    'rarity': card.get('rarity', 'common')
                })
        
        print(f"Inserting {len(cards_data)} cards...")
        
        # Batch insert cards
        batch_size = 5000
        for i in range(0, len(cards_data), batch_size):
            batch = cards_data[i:i + batch_size]
            connection.execute(
                sa.text("""
                    INSERT INTO cards (set_code, number, name, rarity) 
                    VALUES (:set_code, :number, :name, :rarity)
                    ON CONFLICT (set_code, number) DO NOTHING
                """),
                batch
            )
            print(f"  Inserted batch {i // batch_size + 1}/{(len(cards_data) + batch_size - 1) // batch_size}")
        
        print("Card data import complete!")
    else:
        print(f"Warning: Card data JSON not found at {json_path}")
        print("You can run the import manually later.")


def downgrade() -> None:
    op.drop_table('collection_entries')
    op.drop_table('containers')
    op.drop_table('container_types')
    op.drop_index('ix_cards_name', 'cards')
    op.drop_index('ix_cards_set_number', 'cards')
    op.drop_table('cards')
    op.drop_table('finishes')
    op.drop_table('languages')
    op.drop_table('users')
