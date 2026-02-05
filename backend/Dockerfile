FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install deps first (better layer caching)
COPY backend/requirements.txt /app/backend-requirements.txt
RUN python -m pip install --no-cache-dir -U pip && \
    python -m pip install --no-cache-dir -r /app/backend-requirements.txt

# App code + model artifacts (scripts/models)
COPY backend /app/backend
COPY scripts /app/scripts

EXPOSE 9000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "9000"]

