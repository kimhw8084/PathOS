from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from ..database import get_db
from ..models.models import TaxonomyEnum
from ..schemas.schemas import TaxonomyRead

router = APIRouter()

@router.get("/", response_model=List[TaxonomyRead])
async def list_taxonomy(category: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    query = select(TaxonomyEnum)
    if category:
        query = query.where(TaxonomyEnum.category == category)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/categories")
async def list_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TaxonomyEnum.category).distinct())
    return result.scalars().all()
