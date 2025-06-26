from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import motor.motor_asyncio
import os
from dotenv import load_dotenv
import openai
from datetime import datetime
import uuid
import logging

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="DraftAI API", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017/draftai")
client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
db = client.draftai
drafts_collection = db.drafts

# OpenAI configuration
openai.api_key = os.getenv("OPENAI_API_KEY")

# Pydantic models
class Draft(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    content: str
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

class DraftCreate(BaseModel):
    title: str
    content: str = ""

class DraftUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None

class AIGenerateRequest(BaseModel):
    prompt: str
    max_tokens: int = 150

class AIGenerateResponse(BaseModel):
    generated_text: str

# Health check endpoint
@app.get("/api/health")
async def health_check():
    try:
        # Test MongoDB connection
        await client.admin.command('ping')
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Service unhealthy")

# Draft endpoints
@app.post("/api/drafts", response_model=Draft)
async def create_draft(draft: DraftCreate):
    try:
        new_draft = Draft(
            title=draft.title,
            content=draft.content
        )
        draft_dict = new_draft.dict()
        result = await drafts_collection.insert_one(draft_dict)
        
        if result.inserted_id:
            return new_draft
        else:
            raise HTTPException(status_code=500, detail="Failed to create draft")
    except Exception as e:
        logger.error(f"Error creating draft: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/drafts", response_model=List[Draft])
async def get_drafts():
    try:
        drafts = []
        async for draft in drafts_collection.find():
            draft_obj = Draft(
                id=draft["id"],
                title=draft["title"],
                content=draft["content"],
                created_at=draft["created_at"],
                updated_at=draft["updated_at"]
            )
            drafts.append(draft_obj)
        return drafts
    except Exception as e:
        logger.error(f"Error fetching drafts: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/drafts/{draft_id}", response_model=Draft)
async def get_draft(draft_id: str):
    try:
        draft = await drafts_collection.find_one({"id": draft_id})
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")
        
        return Draft(
            id=draft["id"],
            title=draft["title"],
            content=draft["content"],
            created_at=draft["created_at"],
            updated_at=draft["updated_at"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching draft: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.put("/api/drafts/{draft_id}", response_model=Draft)
async def update_draft(draft_id: str, draft_update: DraftUpdate):
    try:
        draft = await drafts_collection.find_one({"id": draft_id})
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")
        
        update_data = {"updated_at": datetime.now()}
        if draft_update.title is not None:
            update_data["title"] = draft_update.title
        if draft_update.content is not None:
            update_data["content"] = draft_update.content
        
        await drafts_collection.update_one(
            {"id": draft_id},
            {"$set": update_data}
        )
        
        updated_draft = await drafts_collection.find_one({"id": draft_id})
        return Draft(
            id=updated_draft["id"],
            title=updated_draft["title"],
            content=updated_draft["content"],
            created_at=updated_draft["created_at"],
            updated_at=updated_draft["updated_at"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating draft: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.delete("/api/drafts/{draft_id}")
async def delete_draft(draft_id: str):
    try:
        result = await drafts_collection.delete_one({"id": draft_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Draft not found")
        return {"message": "Draft deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting draft: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

# AI generation endpoint
@app.post("/api/ai/generate", response_model=AIGenerateResponse)
async def generate_ai_content(request: AIGenerateRequest):
    try:
        if not openai.api_key or openai.api_key == "your_openai_api_key_here":
            # Return a mock response if no API key is configured
            return AIGenerateResponse(
                generated_text=f"Mock AI response for: '{request.prompt}'. Please configure OpenAI API key for real AI generation."
            )
        
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful writing assistant. Generate creative and engaging content based on the user's prompt."},
                {"role": "user", "content": request.prompt}
            ],
            max_tokens=request.max_tokens,
            temperature=0.7
        )
        
        generated_text = response.choices[0].message.content.strip()
        return AIGenerateResponse(generated_text=generated_text)
        
    except Exception as e:
        logger.error(f"Error generating AI content: {str(e)}")
        # Return a fallback response instead of raising an error
        return AIGenerateResponse(
            generated_text=f"AI service temporarily unavailable. Here's a placeholder response for: '{request.prompt}'"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)