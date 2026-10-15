FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /srv

RUN useradd --create-home --uid 1000 app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app/ ./app/

USER app
EXPOSE 8000

# --proxy-headers: client IP and https scheme from the load balancer's X-Forwarded-* headers,
# trusted only from FORWARDED_ALLOW_IPS (uvicorn reads that env variable; default 127.0.0.1).
# --no-access-log: the app writes its own JSON access line (app/observability.py).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--no-access-log"]
