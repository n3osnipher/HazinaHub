from datetime import datetime
from beanie import Document, PydanticObjectId
from pydantic import Field


class ChatMessage(Document):
    user_id: PydanticObjectId
    thread_id: str = "default"
    sender: str  # "user" or "ai"
    text: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "chat_messages"
        indexes = ["user_id", "created_at"]
