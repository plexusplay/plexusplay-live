import { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uniqueNamesGenerator, adjectives, colors, animals } from 'unique-names-generator';


const WS_BACKEND = "wss://voting-socket.rumpus.club";

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
    ws.current.onmessage = (ws_message) => {
      const message = JSON.parse(ws_message);
      const code = message['code'];
      const data = message['data'];
      const oldData = {...ballot};
      const merged = Object.assign(oldData, data);
      setBallot(merged);
    };
    return () => ws.current.close();
  }, []);


  const sendMessage = (message) => {
    alert('sending ' + message + ' to server');
    ws.current.send(message);
  }

  const modalCallback = (name) => {
    setModalVisible(false);
    setUserId(name);
  }


  return (
    <View
      style={styles.container}>
      <View style={{ flex: 1, backgroundColor: 'red' }} >
        <Text>{userId}</Text>
        <Text style={[styles.big, styles.question]}>{ballot.question}</Text>
      </View>
      <Pressable style={{ flex: 3, backgroundColor: 'darkorange' }}
        onPress={() => sendMessage('choice1')}  >
        <Text style={[styles.big, styles.choice]}>{ballot.choice1}</Text>
      </Pressable>
      <Pressable style={{ flex: 3, backgroundColor: 'green' }} 
        onPress={() => sendMessage('choice2')}  >
        <Text style={[styles.big, styles.choice]}>{ballot.choice2}</Text>
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
  }
});


export default App;
