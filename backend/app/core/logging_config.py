"""Daily, access-restricted file logging for backend diagnostics."""

import logging
import os
from datetime import datetime
from pathlib import Path
from typing import TextIO


class DailyFileHandler(logging.Handler):
    """Write records to one UTF-8 log file per local calendar day."""

    def __init__(self, directory: Path) -> None:
        super().__init__()
        self.directory = directory
        self.directory.mkdir(mode=0o750, parents=True, exist_ok=True)
        os.chmod(self.directory, 0o750)
        self._day: str | None = None
        self._stream: TextIO | None = None
        self._open_for_day(datetime.now().strftime("%Y-%m-%d"))

    def _open_for_day(self, day: str) -> None:
        if self._stream is not None:
            self._stream.close()
        path = self.directory / f"backend-{day}.log"
        self._stream = path.open("a", encoding="utf-8")
        os.chmod(path, 0o640)
        self._day = day

    def emit(self, record: logging.LogRecord) -> None:
        try:
            day = datetime.fromtimestamp(record.created).strftime("%Y-%m-%d")
            if day != self._day:
                self._open_for_day(day)
            self._stream.write(f"{self.format(record)}\n")
            self._stream.flush()
        except Exception:
            self.handleError(record)

    def close(self) -> None:
        if self._stream is not None:
            self._stream.close()
            self._stream = None
        super().close()


def configure_logging() -> None:
    """Configure the application logger once and fail fast if logs are unwritable."""
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    if any(isinstance(handler, DailyFileHandler) for handler in root_logger.handlers):
        return

    log_directory = Path(__file__).resolve().parents[2] / "logs"
    file_handler = DailyFileHandler(log_directory)
    file_handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
    )
    root_logger.addHandler(file_handler)
