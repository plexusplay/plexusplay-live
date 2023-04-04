import { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uniqueNamesGenerator, adjectives, colors, animals } from 'unique-names-generator';


const WS_BACKEND = "wss://live-voting-socket.onrender.com";

const App = () => {

  const [ballot, setBallot] = useState({
    choice1: "Choice 1",
    choice2: "Choice 2",
    question: "Question",
  });

  const [votes, setVotes] = useState({
    choice1: 0,
    choice2: 0,
  });

  const [choice, setChoice] = useState("");

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
    ws.current = new WebSocket(WS_BACKEND);
    ws.current.onmessage = receiveMessage;
    return () => ws.current.close();
  }, []);

  const receiveMessage = (msg_event) => {
    console.log(msg_event);
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
      userId: userId,
      code: code,
      data: data,
    });
    console.log('sending ' + message + ' to server');
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
        <Text>{userId}</Text>
        <Text style={[styles.big, styles.question]}>{ballot.question}</Text>
      </View>
      <Pressable style={{ flex: 3, backgroundColor: 'darkorange' }}
        onPress={() => sendVote('choice1')}  >
        <Text style={[styles.big, styles.choice, choice === 'choice1' ? styles.selected : styles.unSelected]}>
            {ballot.choice1} ({votes.choice1})
        </Text>
      </Pressable>
      <Pressable style={{ flex: 3, backgroundColor: 'green' }} 
        onPress={() => sendVote('choice2')}  >
        <Text style={[styles.big, styles.choice, choice === 'choice2' ? styles.selected : styles.unSelected]}>
          {ballot.choice2} ({votes.choice2})
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
