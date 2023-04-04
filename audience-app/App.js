import { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';


const WS_BACKEND = "wss://live-voting-socket.onrender.com";

const App = () => {

  const [ballot, setBallot] = useState({
    choices: ["Choice 1", "Choice 2"],
    question: "Question",
  });

  const [votes, setVotes] = useState([]);

  const [choice, setChoice] = useState(-1);

  const ws = useRef(null);

  // Set up WebSocket
  useEffect(() => {
    ws.current = new WebSocket(WS_BACKEND);
    ws.current.onmessage = receiveMessage;
    return () => ws.current.close();
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
    });
    ws.current.send(message);
  }

  const sendVote = (choice) => {
    setChoice(choice);
    sendMessage('vote', choice);
  }

  return (
    <View
      style={styles.container}>
      <View style={{ flex: 1, backgroundColor: 'red' }} >
        <Text style={[styles.big, styles.question]}>{ballot.question}</Text>
      </View>
      <Pressable style={{ flex: 3, backgroundColor: 'darkorange' }}
        onPress={() => sendVote(0)}  >
        <Text style={[styles.big, styles.choice, choice === 0 ? styles.selected : styles.unSelected]}>
            {ballot.choices[0]} ({votes[0]})
        </Text>
      </Pressable>
      <Pressable style={{ flex: 3, backgroundColor: 'green' }} 
        onPress={() => sendVote(1)}  >
        <Text style={[styles.big, styles.choice, choice === 1 ? styles.selected : styles.unSelected]}>
          {ballot.choices[1]} ({votes[1]})
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
  big: {
    fontSize: 24,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  question: {
    marginTop: 'auto',
  },
  choice: {
    marginTop: 'auto',
    marginBottom: 'auto',
  },
  selected: {
    fontWeight: 'bold',
  },
  unSelected: {
    fontWeight: 'normal',
  },
});


export default App;
