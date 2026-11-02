import logging
from datetime import datetime
from pathlib import Path

from app.core.logging_config import DailyFileHandler


def test_daily_file_handler_writes_separate_date_files(tmp_path: Path):
    """Keep diagnostics in date-addressable files when the calendar day changes."""
    handler = DailyFileHandler(tmp_path)
    handler.setFormatter(logging.Formatter("%(message)s"))

    for day, message in (("2026-01-02", "first day"), ("2026-01-03", "next day")):
        timestamp = datetime.strptime(day, "%Y-%m-%d").timestamp()
        record = logging.LogRecord("test", logging.INFO, __file__, 1, message, (), None)
        record.created = timestamp
        handler.emit(record)

    handler.close()
    assert (tmp_path / "backend-2026-01-02.log").read_text() == "first day\n"
    assert (tmp_path / "backend-2026-01-03.log").read_text() == "next day\n"
