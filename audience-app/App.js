import { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';


// const WS_BACKEND = "ws://rumpus:8080";
const WS_BACKEND = "wss://live-voting-socket.onrender.com";

const App = () => {

  const [ballot, setBallot] = useState({
    choices: ["Choice 1", "Choice 2", "Choice 3", "Choice 4"],
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
      {ballot.choices.map((curChoice, i, _) => {
        const isSelected = choice === i;
        return <Pressable style={[styles.choice, isSelected ? styles.selectedChoice : styles.unselectedChoice]} onPress={() => sendVote(i)} key={i}>
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
