import { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';


const WS_BACKEND = "wss://voting-socket.rumpus.club";

const App = () => {

  const [data, setData] = useState({
    choice1: "Choice 1",
    choice2: "Choice 2",
    question: "Question"
  });

  const ws = useRef(null);


  useEffect(() => {
    ws.current = new WebSocket(WS_BACKEND);
    ws.current.onmessage = (message) => {
      console.log(message)
      setData(JSON.parse(message.data));
    };
    return () => ws.current.close();
  }, []);

  const sendMessage = (message) => {
    alert('sending ' + message + ' to server');
    ws.current.send(message);
  }

  return (
    <View
      style={styles.container}>
      <View style={{ flex: 1, backgroundColor: 'red' }} >
        <Text style={styles.big}>{data.question}</Text>
      </View>
      <Pressable style={{ flex: 3, backgroundColor: 'darkorange' }}
        onPress={() => sendMessage('choice1')}  >
        <Text style={styles.big}>{data.choice1}</Text>
      </Pressable>
      <Pressable style={{ flex: 3, backgroundColor: 'green' }} 
        onPress={() => sendMessage('choice2')}  >
        <Text style={styles.big}>{data.choice2}</Text>
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
  }
});


export default App;