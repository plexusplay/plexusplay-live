// Standard libraries
import { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';

// Third-party libraries
import ReconnectingWebSocket from 'reconnecting-websocket';
import { uniqueNamesGenerator, adjectives, colors, animals } from 'unique-names-generator';
import AsyncStorage from '@react-native-async-storage/async-storage';


// const WS_BACKEND = "ws://rumpus:8080";
const WS_BACKEND = "wss://voting-socket.rumpus.club";

const App = () => {
  const [ballot, setBallot] = useState({
    choices: ["Choice 1", "Choice 2", "Choice 3", "Choice 4"],
    question: "Question",
  });

  const [votes, setVotes] = useState([]);

  const [choice, setChoice] = useState(-1);

  const [userId, setUserId] = useState("userId");

  const ws = useRef(null);

  //  Set up unique name
  useEffect(() => {
    AsyncStorage.getItem('userId').then((maybeUserId) => {
      if (maybeUserId !== null) {
        setUserId(maybeUserId);
      } else { // No userId exists
        const uniqueUserId = uniqueNamesGenerator({
          dictionaries: [adjectives, colors, animals],
        });
        AsyncStorage.setItem('userId', uniqueUserId).then(() => {
          setUserId(uniqueUserId);
        });
      }
    });
  }, []);

  // Set up WebSocket
  useEffect(() => {
    const sock = new ReconnectingWebSocket(WS_BACKEND);
    sock.onmessage = receiveMessage;
    ws.current = sock;
    return () => sock.close();
  }, []);

  // Set up heartbeat
  useEffect(() => {
    const heartbeatFunc = setInterval(() => {
      sendMessage('heartbeat', null);
    // every 5 seconds
    }, 5000);
    // clear this timer when the component is unmounted
    return () => {
      clearInterval(heartbeatFunc);
    };
  });

  const receiveMessage = (msg_event) => {
    const message = JSON.parse(msg_event.data);
    const code = message['code'];
    const data = message['data'];
    if (code === 'setBallot') {
      const oldBallot = {...ballot};
      const merged = Object.assign(oldBallot, data);
      setBallot(merged);
    } else if (code === 'setVotes') {
      setVotes(data);
    }
  }

  const sendMessage = (code, data) => {
    const message = JSON.stringify({
      code: code,
      data: data,
      userId: userId,
    });
    if (ws.current !== null) {
      ws.current.send(message);
    }
  }

  const choose = (chosen) => {
    setChoice(chosen);
    sendMessage('vote', chosen);
  }

  return (
    <View
      style={styles.container}>
      <View style={{ flex: 1, backgroundColor: 'red' }} >
        <Text style={[styles.big, styles.question]}>{ballot.question}</Text>
      </View>
      {ballot.choices.map((curChoice, i, _) => {
        const isSelected = choice === i;
        return <Pressable style={[styles.choice, isSelected ? styles.selectedChoice : styles.unselectedChoice]} onPress={() => choose(i)} key={i}>
        <Text style={[styles.big, styles.choiceText, isSelected ? styles.selectedText : styles.unselectedText]}>
            {curChoice} ({votes[i]})
        </Text>
      </Pressable>
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
  choice: {
    flex: 3,
    borderWidth: 1,
  },
  unselectedChoice: {
    backgroundColor: 'grey',
  },
  selectedChoice: {
    backgroundColor: 'lightblue',
  },
  big: {
    fontSize: 24,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  question: {
    marginTop: 'auto',
  },
  choiceText: {
    marginTop: 'auto',
    marginBottom: 'auto',
  },
  selectedText: {
    fontWeight: 'bold',
  },
  unselectedText: {
    fontWeight: 'normal',
  },
});


export default App;
