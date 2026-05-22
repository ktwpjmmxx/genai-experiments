"""
MyRecipeBook - FastAPI バックエンド Phase 1
起動: uvicorn main:app --reload

変更履歴（コードレビュー反映）:
  ① 画像アップロード: shutil.copyfileobj によるストリーミング書き込みに変更
  ② ChromaDB: アプリ起動時に一度だけ初期化 + logging によるエラー記録
  ④ datetime: utcnow() → datetime.now(timezone.utc) に変更
"""
from __future__ import annotations
import os, uuid, json, shutil, logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import (
    Column, Integer, String, Text, DateTime,
    JSON, Float, Boolean, create_engine, select
)
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

# ── ロガー設定 ────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATABASE_URL   = os.getenv("DATABASE_URL", "sqlite:///./recipes.db")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
UPLOAD_DIR     = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# ── DB ───────────────────────────────────────
engine       = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase): pass

class RecipeORM(Base):
    __tablename__ = "recipes"
    id               = Column(Integer, primary_key=True, index=True)
    title            = Column(String(255), nullable=False, index=True)
    category         = Column(String(100), nullable=False, index=True)
    description      = Column(Text, default="")
    base_servings    = Column(Float, default=2.0)
    prep_time        = Column(Integer, default=0)
    cook_time        = Column(Integer, default=0)
    image_url        = Column(String(512), nullable=True)
    is_favorite      = Column(Boolean, default=False)
    is_ai_generated  = Column(Boolean, default=False)
    ingredients      = Column(JSON, default=list)
    steps            = Column(JSON, default=list)
    created_at       = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at       = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                              onupdate=lambda: datetime.now(timezone.utc))

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:    yield db
    finally: db.close()

# ── ② ChromaDB: アプリ起動時に一度だけ初期化 ──
_chroma_collection = None

def _get_chroma_collection():
    """ChromaDBコレクションをシングルトンで返す。未インストール時はNoneを返す。"""
    global _chroma_collection
    if _chroma_collection is not None:
        return _chroma_collection
    try:
        import chromadb
        client = chromadb.PersistentClient(path="./chroma_data")
        _chroma_collection = client.get_or_create_collection("recipes")
        logger.info("ChromaDB initialized successfully")
    except ImportError:
        logger.warning("chromadb not installed. Vector indexing disabled.")
    except Exception as e:
        logger.warning(f"ChromaDB initialization failed: {e}")
    return _chroma_collection

# ── Pydantic ─────────────────────────────────
class IngredientIn(BaseModel):
    name:        str
    amount:      Optional[float] = None
    unit:        str = ""
    amount_text: Optional[str]  = None

class StepIn(BaseModel):
    order:       int
    description: str
    tip:         Optional[str] = None

class RecipeCreate(BaseModel):
    title:           str   = Field(..., min_length=1)
    category:        str   = Field(..., min_length=1)
    description:     str   = ""
    base_servings:   float = Field(2.0, gt=0)
    prep_time:       int   = Field(0, ge=0)
    cook_time:       int   = Field(0, ge=0)
    is_ai_generated: bool  = False
    ingredients:     list[IngredientIn] = []
    steps:           list[StepIn]       = []

class RecipeUpdate(BaseModel):
    title:         Optional[str]   = None
    category:      Optional[str]   = None
    description:   Optional[str]   = None
    base_servings: Optional[float] = None
    prep_time:     Optional[int]   = None
    cook_time:     Optional[int]   = None
    is_favorite:   Optional[bool]  = None
    ingredients:   Optional[list[IngredientIn]] = None
    steps:         Optional[list[StepIn]]       = None

class RecipeOut(BaseModel):
    id:              int
    title:           str
    category:        str
    description:     str
    base_servings:   float
    prep_time:       int
    cook_time:       int
    image_url:       Optional[str] = None
    is_favorite:     bool
    is_ai_generated: bool
    ingredients:     list[dict]
    steps:           list[dict]
    created_at:      datetime
    updated_at:      datetime
    class Config: from_attributes = True

class AIRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)

class AIResponse(BaseModel):
    answer:  str
    is_mock: bool = True

class DiscoverRequest(BaseModel):
    mood:     Optional[str] = None
    max_time: Optional[int] = None
    category: Optional[str] = None

class DiscoverItem(BaseModel):
    title:       str
    category:    str
    description: str
    cook_time:   int
    servings:    int

class DiscoverResponse(BaseModel):
    items:   list[DiscoverItem]
    is_mock: bool = True

class GenerateRecipeRequest(BaseModel):
    title:    str = Field(..., min_length=1)
    servings: int = Field(2, gt=0)

class GenerateRecipeResponse(BaseModel):
    title:         str
    category:      str
    description:   str
    base_servings: int
    prep_time:     int
    cook_time:     int
    ingredients:   list[dict]
    steps:         list[dict]
    is_mock:       bool = True

# ── App ──────────────────────────────────────
app = FastAPI(title="MyRecipeBook API", version="4.1.0")
app.add_middleware(CORSMiddleware,
    allow_origins=["http://localhost:5173","http://localhost:3000"],
    allow_methods=["*"], allow_headers=["*"])
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

def to_out(r: RecipeORM) -> RecipeOut:
    return RecipeOut(
        id=r.id, title=r.title, category=r.category, description=r.description,
        base_servings=r.base_servings, prep_time=r.prep_time, cook_time=r.cook_time,
        image_url=r.image_url, is_favorite=r.is_favorite or False,
        is_ai_generated=r.is_ai_generated or False,
        ingredients=r.ingredients or [], steps=r.steps or [],
        created_at=r.created_at, updated_at=r.updated_at)

def not_found(): raise HTTPException(404, "レシピが見つかりません")

# ── CRUD ─────────────────────────────────────
@app.get("/api/recipes", response_model=list[RecipeOut])
def list_recipes(
    category: Optional[str] = None, sort: str = "updated_at",
    order: str = "desc", favorites_only: bool = False,
    db: Session = Depends(get_db)
):
    stmt = select(RecipeORM)
    if category:       stmt = stmt.where(RecipeORM.category == category)
    if favorites_only: stmt = stmt.where(RecipeORM.is_favorite == True)
    col = {"title": RecipeORM.title, "cook_time": RecipeORM.cook_time,
           "created_at": RecipeORM.created_at}.get(sort, RecipeORM.updated_at)
    stmt = stmt.order_by(col.desc() if order == "desc" else col.asc())
    return [to_out(r) for r in db.execute(stmt).scalars().all()]

@app.get("/api/recipes/{rid}", response_model=RecipeOut)
def get_recipe(rid: int, db: Session = Depends(get_db)):
    r = db.get(RecipeORM, rid)
    if not r: not_found()
    return to_out(r)

@app.post("/api/recipes", response_model=RecipeOut, status_code=201)
def create_recipe(body: RecipeCreate, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)  # ④ timezone.utc を明示
    r   = RecipeORM(
        title=body.title, category=body.category, description=body.description,
        base_servings=body.base_servings, prep_time=body.prep_time, cook_time=body.cook_time,
        is_ai_generated=body.is_ai_generated,
        ingredients=[i.model_dump() for i in body.ingredients],
        steps=[s.model_dump() for s in body.steps],
        created_at=now, updated_at=now)
    db.add(r); db.commit(); db.refresh(r)
    _index_vector(r)
    return to_out(r)

@app.patch("/api/recipes/{rid}", response_model=RecipeOut)
def update_recipe(rid: int, body: RecipeUpdate, db: Session = Depends(get_db)):
    r = db.get(RecipeORM, rid)
    if not r: not_found()
    for k, v in body.model_dump(exclude_unset=True).items():
        if k in ("ingredients","steps") and v is not None:
            setattr(r, k, [i.model_dump() if hasattr(i,"model_dump") else i for i in v])
        elif v is not None:
            setattr(r, k, v)
    r.updated_at = datetime.now(timezone.utc)  # ④
    db.commit(); db.refresh(r)
    _index_vector(r)
    return to_out(r)

@app.delete("/api/recipes/{rid}", status_code=204)
def delete_recipe(rid: int, db: Session = Depends(get_db)):
    r = db.get(RecipeORM, rid)
    if not r: not_found()
    db.delete(r); db.commit()

@app.post("/api/recipes/{rid}/image", response_model=RecipeOut)
async def upload_image(rid: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    r = db.get(RecipeORM, rid)
    if not r: not_found()
    suffix = Path(file.filename).suffix.lower()
    if suffix not in {".jpg",".jpeg",".png",".webp"}:
        raise HTTPException(422, "jpg/png/webp のみ対応")
    path = UPLOAD_DIR / f"{uuid.uuid4()}{suffix}"

    # ① shutil.copyfileobj によるストリーミング書き込み（メモリ最適化）
    with path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    r.image_url  = f"/uploads/{path.name}"
    r.updated_at = datetime.now(timezone.utc)  # ④
    db.commit(); db.refresh(r)
    return to_out(r)

@app.patch("/api/recipes/{rid}/favorite", response_model=RecipeOut)
def toggle_favorite(rid: int, db: Session = Depends(get_db)):
    r = db.get(RecipeORM, rid)
    if not r: not_found()
    r.is_favorite = not (r.is_favorite or False)
    r.updated_at  = datetime.now(timezone.utc)  # ④
    db.commit(); db.refresh(r)
    return to_out(r)

@app.get("/api/categories", response_model=list[str])
def list_categories(db: Session = Depends(get_db)):
    rows = db.execute(select(RecipeORM.category).distinct()).scalars().all()
    return sorted(rows)

# ── AI既存 ───────────────────────────────────
@app.post("/api/recipes/{rid}/ai-assist", response_model=AIResponse)
def ai_assist(rid: int, body: AIRequest, db: Session = Depends(get_db)):
    r = db.get(RecipeORM, rid)
    if not r: not_found()
    if OPENAI_API_KEY:
        return AIResponse(answer=_llm_assist(r, body.question), is_mock=False)
    return AIResponse(answer=_mock_answer(r, body.question))

@app.post("/api/ai/suggest-menu", response_model=AIResponse)
def suggest_menu(body: AIRequest, db: Session = Depends(get_db)):
    recipes = db.execute(select(RecipeORM)).scalars().all()
    titles  = [r.title for r in recipes[:5]]
    mock    = (f"保存中のレシピ（{len(recipes)}件）から提案します。\n\n"
               f"📋 本日のおすすめ\n・メイン: {titles[0] if titles else '未登録'}\n"
               f"・副菜: {titles[1] if len(titles)>1 else 'サラダ'}\n"
               f"※ OPENAI_API_KEY を設定するとAIが本格回答します。")
    return AIResponse(answer=mock)

# ── Phase 1: AI発見・生成 ─────────────────────
@app.post("/api/ai/discover", response_model=DiscoverResponse)
def ai_discover(body: DiscoverRequest):
    if OPENAI_API_KEY:
        items = _llm_discover(body)
        return DiscoverResponse(items=items, is_mock=False)
    return DiscoverResponse(items=_mock_discover(body), is_mock=True)

@app.post("/api/ai/generate-recipe", response_model=GenerateRecipeResponse)
def ai_generate_recipe(body: GenerateRecipeRequest):
    if OPENAI_API_KEY:
        result = _llm_generate(body.title, body.servings)
        return GenerateRecipeResponse(**result, is_mock=False)
    return GenerateRecipeResponse(**_mock_generate(body.title, body.servings), is_mock=True)

# ── ② ベクトルDB: シングルトンコレクションを使用 ─
def _index_vector(r: RecipeORM):
    collection = _get_chroma_collection()
    if collection is None:
        return
    try:
        ings  = ", ".join(
            f"{i['name']} {i.get('amount_text') or str(i.get('amount',''))}{i.get('unit','')}"
            for i in (r.ingredients or []))
        steps = " ".join(f"工程{s['order']}: {s['description']}" for s in (r.steps or []))
        collection.upsert(
            ids=[str(r.id)],
            documents=[f"レシピ:{r.title} カテゴリ:{r.category} 材料:{ings} 手順:{steps}"],
            metadatas=[{"title": r.title, "category": r.category}])
    except Exception as e:
        logger.warning(f"ChromaDB upsert failed for recipe {r.id}: {e}")  # ② ログを残す

# ── LLM helpers ──────────────────────────────
def _llm_discover(body: DiscoverRequest) -> list[DiscoverItem]:
    from openai import OpenAI
    client = OpenAI(api_key=OPENAI_API_KEY)
    constraints = []
    if body.mood:     constraints.append(f"気分: {body.mood}")
    if body.max_time: constraints.append(f"調理時間: {body.max_time}分以内")
    if body.category: constraints.append(f"カテゴリ: {body.category}")
    prompt = (
        f"以下の条件に合う日本の家庭料理を3〜5品提案してください。\n"
        f"条件: {', '.join(constraints) if constraints else '特になし'}\n\n"
        f"必ずJSON配列で返してください。各要素は以下のフィールドを持ちます:\n"
        f"title(料理名), category(和食/洋食/中華/イタリアン/アジアン/副菜/その他), "
        f"description(1〜2文の説明), cook_time(調理時間分), servings(人数)\n"
        f"余分なテキストは不要。JSONのみ返してください。"
    )
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}],
        max_tokens=600, response_format={"type":"json_object"})
    data  = json.loads(resp.choices[0].message.content)
    items = data.get("recipes", data.get("items", []))
    return [DiscoverItem(**item) for item in items[:5]]

def _llm_generate(title: str, servings: int) -> dict:
    from openai import OpenAI
    client = OpenAI(api_key=OPENAI_API_KEY)
    prompt = (
        f"「{title}」({servings}人前)のレシピを以下のJSON形式で返してください。\n"
        f"余分なテキストは不要。JSONのみ返してください。\n\n"
        f"{{\n"
        f'  "title": "{title}",\n'
        f'  "category": "和食/洋食/中華/イタリアン/アジアン/副菜/その他のいずれか",\n'
        f'  "description": "1〜2文の説明",\n'
        f'  "base_servings": {servings},\n'
        f'  "prep_time": 数値（分）,\n'
        f'  "cook_time": 数値（分）,\n'
        f'  "ingredients": [\n'
        f'    {{"name": "食材名", "amount": 数値またはnull, "unit": "単位", "amount_text": "大さじ1などテキストまたはnull"}}\n'
        f'  ],\n'
        f'  "steps": [\n'
        f'    {{"order": 1, "description": "手順の説明", "tip": "ヒントまたはnull"}}\n'
        f'  ]\n'
        f'}}'
    )
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}],
        max_tokens=1200, response_format={"type":"json_object"})
    return json.loads(resp.choices[0].message.content)

def _mock_discover(body: DiscoverRequest) -> list[DiscoverItem]:
    items = [
        DiscoverItem(title="豚キムチ炒め",       category="和食",     description="ピリ辛でご飯がすすむ定番の炒め物。",     cook_time=15, servings=2),
        DiscoverItem(title="ペペロンチーノ",      category="イタリアン",description="にんにくと唐辛子のシンプルで奥深いパスタ。",cook_time=20, servings=2),
        DiscoverItem(title="麻婆豆腐",           category="中華",     description="豆腐と豚ひき肉の旨辛スープが絡む一品。",   cook_time=20, servings=2),
        DiscoverItem(title="ほうれん草の胡麻和え", category="副菜",     description="栄養満点のさっぱりした副菜。",           cook_time=10, servings=4),
        DiscoverItem(title="ガパオライス",        category="アジアン",  description="バジルの香りが食欲をそそるタイ料理。",     cook_time=20, servings=2),
    ]
    if body.max_time:
        items = [i for i in items if i.cook_time <= body.max_time]
    if body.category:
        items = [i for i in items if i.category == body.category] or items
    return items[:5]

def _mock_generate(title: str, servings: int) -> dict:
    return {
        "title":         title,
        "category":      "和食",
        "description":   f"{title}の基本レシピです。",
        "base_servings": servings,
        "prep_time":     10,
        "cook_time":     20,
        "ingredients": [
            {"name": "食材A", "amount": 200.0, "unit": "g",  "amount_text": None},
            {"name": "醤油",  "amount": None,  "unit": "",   "amount_text": "大さじ2"},
            {"name": "砂糖",  "amount": None,  "unit": "",   "amount_text": "小さじ1"},
        ],
        "steps": [
            {"order": 1, "description": f"{title}を作る工程1です。", "tip": None},
            {"order": 2, "description": "調味料を加えて味を調えます。", "tip": "味見しながら調整してください。"},
            {"order": 3, "description": "盛り付けて完成です。", "tip": None},
        ],
    }

def _mock_answer(r, q):
    if "時短" in q: return "圧力鍋で煮込み時間を1/3に短縮できます。"
    if "代用" in q: return "みりん→砂糖小さじ1＋酒大さじ1で代用できます。"
    return f"「{r.title}」へのご質問ありがとうございます。「時短」「代用」などのキーワードでお試しください。"

def _llm_assist(r, q):
    from openai import OpenAI
    client = OpenAI(api_key=OPENAI_API_KEY)
    ings   = ", ".join(
        f"{i['name']} {i.get('amount_text') or str(i.get('amount',''))}{i.get('unit','')}"
        for i in (r.ingredients or []))
    resp   = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":
            f"レシピ「{r.title}」（材料: {ings}）について日本語で答えてください。\n質問: {q}"}],
        max_tokens=400)
    return resp.choices[0].message.content
