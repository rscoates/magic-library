from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import cards, containers, collection, auth, metadata, decklist

app = FastAPI(
    title="Magic: The Gathering Collection Tracker",
    description="Track your MTG card collection across boxes, files, and decks",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(cards.router, prefix="/api")
app.include_router(containers.router, prefix="/api")
app.include_router(collection.router, prefix="/api")
app.include_router(metadata.router, prefix="/api")
app.include_router(decklist.router, prefix="/api")


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}
