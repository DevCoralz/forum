"""Run once locally to create TG_SESSION_STRING:  python scripts/make_tg_session.py
Keep the printed string secret — it grants full access to the Telegram account."""
from telethon.sync import TelegramClient
from telethon.sessions import StringSession

api_id = int(input("API ID: "))
api_hash = input("API hash: ")
with TelegramClient(StringSession(), api_id, api_hash) as client:
    print("\nTG_SESSION_STRING=" + client.session.save())
