"""Outgoing email.

Configure ``SMTP_*`` and ``MAIL_FROM`` in ``backend/.env`` to enable delivery. For Gmail:
``SMTP_HOST=smtp.gmail.com``, ``SMTP_PORT=587``, ``SMTP_USER=<address>`` and
``SMTP_PASSWORD=<16-char app password>``. While unconfigured, email bodies are never
written to logs because they may contain credentials or password-reset links.
"""

import logging
from email.message import EmailMessage

import aiosmtplib

from app.core.config import get_settings

logger = logging.getLogger("app.mail")


async def send_mail(to: str, subject: str, text: str, html: str | None = None) -> None:
    settings = get_settings()
    if not settings.mail_enabled:
        if settings.environment.lower() == "development":
            logger.warning("Mail not configured; development-only message omitted for %s | %s", to, subject)
            return
        logger.error("Mail delivery requested while SMTP is not configured")
        raise RuntimeError("SMTP must be configured before sending account credentials.")

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


async def send_password_reset_email(to: str, display_name: str, reset_url: str, ttl_minutes: int) -> None:
    text = (
        f"Xin chào {display_name},\n\n"
        "Bạn vừa yêu cầu đặt lại mật khẩu Brave Active.\n"
        f"Nhấn vào liên kết sau (hiệu lực {ttl_minutes} phút, chỉ dùng được một lần):\n{reset_url}\n\n"
        "Nếu bạn không yêu cầu, hãy bỏ qua email này."
    )
    html = (
        f"<p>Xin chào {_escape(display_name)},</p>"
        "<p>Bạn vừa yêu cầu đặt lại mật khẩu Brave Active.</p>"
        f'<p><a href="{_escape(reset_url)}">Đặt lại mật khẩu</a> '
        f"(hiệu lực {ttl_minutes} phút, chỉ dùng được một lần)</p>"
        "<p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>"
    )
    await send_mail(to, "Đặt lại mật khẩu Brave Active", text, html)


async def send_temporary_password_email(to: str, display_name: str, password: str) -> None:
    text = (
        f"Xin chào {display_name},\n\n"
        "Mật khẩu tạm thời cho tài khoản Brave Active của bạn là:\n"
        f"{password}\n\n"
        "Vì lý do bảo mật, bạn sẽ được yêu cầu đổi mật khẩu ngay sau lần đăng nhập đầu tiên.\n"
        "Nếu bạn không yêu cầu email này, hãy liên hệ quản trị viên."
    )
    html = (
        f"<p>Xin chào {_escape(display_name)},</p>"
        "<p>Mật khẩu tạm thời cho tài khoản Brave Active của bạn là:</p>"
        f"<p><strong>{_escape(password)}</strong></p>"
        "<p>Vì lý do bảo mật, bạn sẽ được yêu cầu đổi mật khẩu ngay sau lần đăng nhập đầu tiên.</p>"
        "<p>Nếu bạn không yêu cầu email này, hãy liên hệ quản trị viên.</p>"
    )
    await send_mail(to, "Mật khẩu tạm thời Brave Active", text, html)


def _escape(value: str) -> str:
    from html import escape

    return escape(value, quote=True)
