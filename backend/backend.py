# Standard libraries
import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta
import json
from time import sleep
import threading
from typing import NamedTuple

# Third-party libraries
import websockets
from websockets.server import WebSocketServerProtocol

ADDRESS = '0.0.0.0'
PORT = 8080

NUM_QUESTIONS = 4

CLIENT_TIMEOUT_SECS = 10

class Message(NamedTuple):
    code: str
    data: dict

    def serialize(self):
        return json.dumps({'code': self.code, 'data': self.data})


@dataclass
class Client:
    path: str
    ws: WebSocketServerProtocol
    last_seen: datetime
    vote: int = -1

    def __eq__(self, __value: object) -> bool:
        if not hasattr(__value, 'ws'):
            return False
        return self.ws is __value.ws

    def __hash__(self) -> int:
        return self.ws.__hash__()


class Voting:
    def __init__(self):
        self.ballot = {
            "choices": ["Choice 1 from server", "Choice 2 from server", "Choice 3 from server", "Choice 4 from server"],
            "question": "Question from server",
        }
        self._clients = set()
        self._prune_thread = threading.Thread(target=self.prune_clients_thread, daemon=True)
        self._prune_thread.start()

    def prune_clients_thread(self):
        max_diff = timedelta(seconds=CLIENT_TIMEOUT_SECS)
        while True:
            now = datetime.now()
            self._clients = set(c for c in self._clients if now - c.last_seen < max_diff)
            sleep(CLIENT_TIMEOUT_SECS)

    @property
    def clients(self):
        return set(c.ws for c in self._clients)

    @property
    def votes(self):
        return [len([c for c in self._clients if c.vote == x]) for x in range(NUM_QUESTIONS)]

    async def send_votes(self):
        code, data = 'setVotes', self.votes
        await self.send_to_all(code, data)

    async def send_to_all(self, code, data):
        message = Message(code, data).serialize()
        # Do this asynchronously so a bad client doesn't freeze everyone
        websockets.broadcast(self.clients, message)

    async def handle_message(self, client: Client, message):
        message = json.loads(message)
        code, data = message['code'], message['data']
        client.last_seen = datetime.now()
        if code == 'vote':
            client.vote = data
            await self.send_votes()
        elif code == 'setBallot':
            ballot = data
            await self.send_to_all('setBallot', ballot)

    async def handle_ws(self, websocket, path):
        if path != '/':
            return
        client = Client(path=path, ws=websocket, last_seen=datetime.now())
        self._clients.add(client)
        await self.send_votes()
        await self.send_to_all('setBallot', self.ballot)
        async for message in websocket:
            await self.handle_message(client, message)
        # websocket closes
        await self.send_votes()

    async def start(self):
        print(f'running websocket server at {ADDRESS}:{PORT}')
        async with websockets.serve(self.handle_ws, ADDRESS, PORT):
            await asyncio.Future()  # run forever

voting = Voting()
asyncio.run(voting.start())