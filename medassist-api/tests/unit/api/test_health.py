"""Tests for /health and the global error shape."""


def test_health_returns_ok(client):
    res = client.get("/health")

    assert res.status_code == 200
    assert res.json() == {"status": "ok", "version": "0.0.0-test", "env": "dev"}


def test_unknown_route_uses_error_shape(client):
    res = client.get("/does-not-exist")

    assert res.status_code == 404
    assert res.json() == {"status": 404, "message": "Not Found"}


def test_missing_settings_raise_clear_error(monkeypatch):
    from app import config

    monkeypatch.delenv("GROQ_API_KEY")
    config.get_settings.cache_clear()
    try:
        config.get_settings()
    except RuntimeError as exc:
        assert "GROQ_API_KEY" in str(exc)
        assert "test-groq-key" not in str(exc)
    else:
        raise AssertionError("expected RuntimeError")
    finally:
        config.get_settings.cache_clear()
