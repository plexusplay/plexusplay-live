import { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import UserIdModal from "./UserIdModal"


const WS_BACKEND = "wss://voting-socket.rumpus.club";

const App = () => {

  const [data, setData] = useState({
    choice1: "Choice 1",
    choice2: "Choice 2",
    question: "Question",
  });

  const [userId, setUserId] = useState("");

  const [isModalVisible, setModalVisible] = useState(true);

//   const storeData = async (key, value) => {
//     try {
//       await AsyncStorage.setItem(key, value)
//     } catch (e) {
//       // saving error
//     }
//   }

//   const getData = async (key) => {
//   try {
//     const value = await AsyncStorage.getItem(key)
//     if(value !== null) {
//       // key found
//       return value;
//     }
//   } catch(e) {
//     // error reading value
//     console.log(e);
//   }
// }
  // Set up storage of name
  // useEffect(() => {
  //   storeData('userId', 'mr. garbage');
  // }, []);


  const ws = useRef(null);

  // Set up WebSocket
  useEffect(() => {
    ws.current = new WebSocket(WS_BACKEND);
    ws.current.onmessage = (message) => {
      console.log(message);
      const newData = JSON.parse(message.data);
      const oldData = {...data};
      const merged = Object.assign(oldData, newData);
      setData(merged);
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
        <Text style={[styles.big, styles.question]}>{data.question}</Text>
      </View>
      <Pressable style={{ flex: 3, backgroundColor: 'darkorange' }}
        onPress={() => sendMessage('choice1')}  >
        <Text style={[styles.big, styles.choice]}>{data.choice1}</Text>
      </Pressable>
      <Pressable style={{ flex: 3, backgroundColor: 'green' }} 
        onPress={() => sendMessage('choice2')}  >
        <Text style={[styles.big, styles.choice]}>{data.choice2}</Text>
      </Pressable>
      <UserIdModal isVisible={isModalVisible} onClose={modalCallback} />
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