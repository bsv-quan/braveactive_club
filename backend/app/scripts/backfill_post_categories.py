"""Run the AI category backfill for existing community posts and sources."""

import argparse
import asyncio

from app.db.session import SessionFactory, engine
from app.services.post_category_migration import backfill_post_categories


async def main(*, allow_fallback: bool = False) -> None:
    try:
        async with SessionFactory() as db:
            processed, categorized = await backfill_post_categories(
                db,
                allow_fallback=allow_fallback,
            )
        print(
            f"Checked {processed} posts; "
            f"assigned categories for {categorized}."
        )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Backfill community post categories using OpenAI (with optional heuristic fallback)."
    )
    parser.add_argument(
        "--fallback",
        action="store_true",
        help="Fall back to deterministic source/content rules if OPENAI_API_KEY is unavailable.",
    )
    args = parser.parse_args()
    asyncio.run(main(allow_fallback=args.fallback))
