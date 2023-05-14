import json
import websockets
import asyncio
from datetime import datetime, timedelta

# set up the WebSocket connection
websocket_url = "ws://127.0.0.1:8080/admin"
websocket = websockets.connect(websocket_url)

# create the new ballot with a question and four answers
new_ballot = {
    "question": "What is the capital of France?",
    "choices": ["London", "Paris", "Berlin", "Madrid"],
    "expires": int((datetime.now() + timedelta(minutes=1)).timestamp())
}

# send the new ballot to the server
async def send_ballot():
    async with websocket as ws:
        message = json.dumps({"code": "setBallot", "data": new_ballot, "userId": "admin"})
        await ws.send(message)

asyncio.get_event_loop().run_until_complete(send_ballot())
