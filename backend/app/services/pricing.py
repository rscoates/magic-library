"""
In-memory pricing data loaded from Scryfall default-cards JSON.

Prices are keyed by (set_code_upper, collector_number) and contain
usd, usd_foil, and usd_etched as Optional[float].
"""
import json
import glob
import os
import logging
from typing import Dict, Optional, Tuple

logger = logging.getLogger(__name__)

# Type alias for price entry
PriceEntry = Dict[str, Optional[float]]  # keys: usd, usd_foil, usd_etched

# Global price store: (SET_CODE, collector_number) -> PriceEntry
_prices: Dict[Tuple[str, str], PriceEntry] = {}
_loaded: bool = False


def get_price(set_code: str, collector_number: str) -> Optional[PriceEntry]:
    """Look up prices for a card by set code and collector number."""
    return _prices.get((set_code.upper(), collector_number))


def get_card_value(set_code: str, collector_number: str, finish_name: Optional[str]) -> Optional[float]:
    """Get the USD value for a specific card given its finish.
    
    finish_name=None means non-foil (regular).
    finish_name='foil' uses usd_foil.
    finish_name='etched' uses usd_etched.
    Any other finish falls back to usd_foil, then usd.
    """
    entry = get_price(set_code, collector_number)
    if not entry:
        return None

    if finish_name is None:
        # Non-foil
        return entry.get("usd")
    
    lower = finish_name.lower()
    if lower == "etched":
        val = entry.get("usd_etched")
        if val is not None:
            return val
        # Fall back to foil, then regular
        return entry.get("usd_foil") or entry.get("usd")
    
    if lower == "foil":
        val = entry.get("usd_foil")
        if val is not None:
            return val
        return entry.get("usd")
    
    # Unknown finish type — try foil price, then regular
    return entry.get("usd_foil") or entry.get("usd")


def is_loaded() -> bool:
    return _loaded


def load_prices(file_path: Optional[str] = None) -> int:
    """Load pricing data from a Scryfall default-cards JSON file.
    
    If file_path is None, auto-detects by looking for default-cards*.json
    in /app/data/ and the backend directory.
    
    Returns the number of cards loaded.
    """
    global _prices, _loaded

    if file_path is None:
        file_path = _find_scryfall_file()
    
    if not file_path or not os.path.exists(file_path):
        logger.warning("No Scryfall default-cards JSON found. Pricing data will be unavailable.")
        _loaded = False
        return 0

    logger.info(f"Loading pricing data from {file_path}...")
    
    count = 0
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            cards = json.load(f)
        
        new_prices: Dict[Tuple[str, str], PriceEntry] = {}
        for card in cards:
            # Only load English cards to avoid duplicates
            if card.get("lang") != "en":
                continue
            
            set_code = card.get("set", "").upper()
            collector_number = card.get("collector_number", "")
            prices = card.get("prices", {})
            
            if not set_code or not collector_number:
                continue
            
            def _parse(val: Optional[str]) -> Optional[float]:
                if val is None:
                    return None
                try:
                    return float(val)
                except (ValueError, TypeError):
                    return None
            
            new_prices[(set_code, collector_number)] = {
                "usd": _parse(prices.get("usd")),
                "usd_foil": _parse(prices.get("usd_foil")),
                "usd_etched": _parse(prices.get("usd_etched")),
            }
            count += 1
        
        _prices = new_prices
        _loaded = True
        logger.info(f"Loaded pricing data for {count} cards.")
    except Exception as e:
        logger.error(f"Failed to load pricing data: {e}")
        _loaded = False
        count = 0
    
    return count


def _find_scryfall_file() -> Optional[str]:
    """Auto-detect a Scryfall default-cards JSON file."""
    search_dirs = [
        "/app/data",
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ""),  # backend/
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), ""),  # project root
    ]
    
    for d in search_dirs:
        pattern = os.path.join(d, "default-cards*.json")
        matches = sorted(glob.glob(pattern))
        if matches:
            # Return the newest (last alphabetically, since filename includes timestamp)
            return matches[-1]
    
    return None
