FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && useradd --create-home --uid 10001 app \
    && mkdir -p /app/uploads /app/logs \
    && chown -R app:app /app

COPY --chown=app:app alembic.ini pytest.ini bootstrap_admin.py ./
COPY --chown=app:app alembic ./alembic
COPY --chown=app:app app ./app
COPY --chown=app:app tests ./tests

USER app
