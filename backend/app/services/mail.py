"""Outgoing email.

Configure ``SMTP_*`` and ``MAIL_FROM`` in ``backend/.env`` to enable delivery. For Gmail:
``SMTP_HOST=smtp.gmail.com``, ``SMTP_PORT=587``, ``SMTP_USER=<address>`` and
``SMTP_PASSWORD=<16-char app password>``. Verification codes are never logged.
"""

import logging
from email.message import EmailMessage

import aiosmtplib

from app.core.config import get_settings

logger = logging.getLogger("app.mail")


async def send_mail(to: str, subject: str, text: str, html: str | None = None) -> None:
    settings = get_settings()
    if not settings.mail_enabled:
        logger.error("Mail delivery requested while SMTP is not configured")
        raise RuntimeError("SMTP must be configured before sending verification codes.")

    message = EmailMessage()
    message["From"] = settings.mail_from or settings.smtp_user
    message["To"] = to
    message["Subject"] = subject
    message.set_content(text)
    if html:
        message.add_alternative(html, subtype="html")

    await aiosmtplib.send(
        message,
        hostname=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_user,
        password=settings.smtp_password,
        start_tls=settings.smtp_use_starttls,
        timeout=15,
    )


async def send_verification_email(to: str, code: str, purpose: str, ttl_minutes: int) -> None:
    """Send a one-time registration or password-recovery code, without a URL."""
    action = "đăng ký tài khoản" if purpose == "register" else "đặt lại mật khẩu"
    text = (
        f"Bạn vừa yêu cầu {action} braveActive.\n\n"
        f"Mã xác minh: {code}\n"
        f"Mã có hiệu lực {ttl_minutes} phút và chỉ dùng được một lần.\n\n"
        "Nếu bạn không yêu cầu, hãy bỏ qua email này."
    )
    await send_mail(to, "Mã xác minh braveActive", text)
