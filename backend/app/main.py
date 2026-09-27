"""BOLI Personal Backend — FastAPI application entrypoint."""

import os
os.environ["TOKENIZERS_PARALLELISM"] = "false"

import logging
from contextlib import asynccontextmanager
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.db import db
from app.translation import warmup as translation_warmup
from app.speech.tts import warmup as tts_warmup
from app.speech.asr import warmup as asr_warmup
from app.api import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init()
    translation_warmup()
    tts_warmup()
    asr_warmup()
    yield


app = FastAPI(
    title="BOLI Personal",
    description="Multilingual Tribal Classroom Bridge for Jharkhand & Bihar",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-Target-Text",
        "x-target-text",
        "X-Phrase-Bank-Match",
        "x-phrase-bank-match",
    ],
)

_AUDIO_DIR = Path(__file__).resolve().parent.parent / "static" / "audio"
_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/audio", StaticFiles(directory=_AUDIO_DIR), name="audio")

app.include_router(api_router)


@app.get("/health")
def health():
    return {"ok": True, "service": "boli-personal", "version": "1.0.0"}
