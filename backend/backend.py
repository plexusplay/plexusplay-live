import asyncio
import json
import websockets

test_message = {
    "choice1": "Choice 1 from server",
    "choice2": "Choice 2 from server",
    "question": "Question from server",
}


async def echo(websocket, path):
    print('sending data to ' + str(websocket))
    await websocket.send(json.dumps(test_message))
    async for message in websocket:
        print(f'{path}: {message}')

async def main():
    async with websockets.serve(echo, "0.0.0.0", 8080):
        await asyncio.Future()  # run forever

asyncio.run(main())
