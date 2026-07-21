# Prava Pro backend (FastAPI) — production image
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8000

# Bitta worker — slowapi in-memory rate-limit ANIQ bo'lishi uchun.
# Ko'p worker (gunicorn) kerak bo'lsa: DEPLOY.md "Masshtablash" bo'limi (Redis + Postgres).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
