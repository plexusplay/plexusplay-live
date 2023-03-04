//import React, { useState, useCallback, useEffect } from 'react';
//import useWebSocket, { ReadyState } from 'react-use-websocket';

//export const WebSocketDemo = () => {
//  //Public API that will echo messages sent to it back to the client
//  const [socketUrl, setSocketUrl] = useState('ws://localhost:8080');
//  const [messageHistory, setMessageHistory] = useState([]);

//  const { sendMessage, lastMessage, readyState } = useWebSocket(socketUrl);

//  useEffect(() => {
//    if (lastMessage !== null) {
//      setMessageHistory((prev) => prev.concat(lastMessage));
//    }
//  }, [lastMessage, setMessageHistory]);

//  const handleClickChangeSocketUrl = useCallback(
//    () => setSocketUrl('wss://demos.kaazing.com/echo'),
//    []
//  );

//  const handleClickSendMessage = useCallback(() => sendMessage('Hello'), []);

//  const connectionStatus = {
//    [ReadyState.CONNECTING]: 'Connecting',
//    [ReadyState.OPEN]: 'Open',
//    [ReadyState.CLOSING]: 'Closing',
//    [ReadyState.CLOSED]: 'Closed',
//    [ReadyState.UNINSTANTIATED]: 'Uninstantiated',
//  }[readyState];

//  return (
//    <div>
//      <button onClick={handleClickChangeSocketUrl}>
//        Click Me to change Socket Url
//      </button>
//      <button
//        onClick={handleClickSendMessage}
//        disabled={readyState !== ReadyState.OPEN}
//      >
//        Click Me to send 'Hello'
//      </button>
//      <span>The WebSocket is currently {connectionStatus}</span>
//      {lastMessage ? <span>Last message: {lastMessage.data}</span> : null}
//      <ul>
//        {messageHistory.map((message, idx) => (
//          <span key={idx}>{message ? message.data : null}</span>
//        ))}
//      </ul>
//    </div>
//  );
//};

//export default WebSocketDemo;
//
import React, { useState, useEffect } from 'react';
import useWebSocket from 'react-use-websocket';
import Cookies from 'js-cookie';

const SERVER_URL = 'ws://localhost:8000';

const App = () => {
  const [clientId, setClientId] = useState(Cookies.get('clientId') || '');

  useEffect(() => {
    if (!clientId) {
      const newClientId = Math.random().toString(36).substring(7);
      Cookies.set('clientId', newClientId);
      setClientId(newClientId);
    }
  }, [clientId]);

  const [socketUrl, setSocketUrl] = useState(`${SERVER_URL}?clientId=${clientId}`);
  const [isSocketReady, setIsSocketReady] = useState(false);
  const [option, setOption] = useState('');

  const { sendJsonMessage } = useWebSocket(socketUrl, {
    onOpen: () => {
      setIsSocketReady(true);
    },
  });

  const handleButtonClick = (option) => {
    setOption(option);
    sendJsonMessage({ option });
  };

  return (
    <div>
      <h1>Make a choice</h1>
      <button onClick={() => handleButtonClick('option1')}>Option 1</button>
      <button onClick={() => handleButtonClick('option2')}>Option 2</button>
      {isSocketReady ? (
        <p>Connected to server</p>
      ) : (
        <p>Connecting to server...</p>
      )}
    </div>
  );
};

export default App;

