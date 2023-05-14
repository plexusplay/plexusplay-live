// Standard libraries
import { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';

// Third-party libraries
import ReconnectingWebSocket from 'reconnecting-websocket';
import { uniqueNamesGenerator, adjectives, colors, animals } from 'unique-names-generator';
import { useFonts } from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';


// const WS_BACKEND = "ws://rumpus:8080";
const WS_BACKEND = "wss://voting-socket.rumpus.club";
// const WS_BACKEND = "ws://localhost:8080";

const App = () => {
  const [ballot, setBallot] = useState({
    choices: ["Choice 1", "Choice 2", "Choice 3", "Choice 4"],
    question: "Question",
    expires: undefined,
    duration: 0,
  });

  const [votes, setVotes] = useState([]);

  const [choice, setChoice] = useState(-1);

  const [userId, setUserId] = useState("userId");

  const [timeLeft, setTimeLeft] = useState(0);
  const [timeLeftRatio, setTimeLeftRatio] = useState(0);

  const [buttonsDisabled, setButtonsDisabled] = useState(false);


  const ws = useRef(null);

  const [fontsLoaded] = useFonts({
    'LemonMilk': require('./assets/fonts/lemonmilk-regular.otf'),
  });

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

  // Set up timer
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const millisRemaining = ballot.expires*1000 - now;
      const secondsRemaining = Math.floor(millisRemaining / 1000);
      // on expiration stop the timer, and disable vote buttons
      if (millisRemaining <= 0) {
        setTimeLeft(0);
        clearInterval(interval);
        setButtonsDisabled(true);
      } else {
        setTimeLeft(secondsRemaining);
        const ratio = millisRemaining / (ballot.duration*1000);
        setTimeLeftRatio(ratio);
      }
    }, 10);
    return () => clearInterval(interval);
  }, [ballot.expires]);

  const receiveMessage = (msg_event) => {
    const message = JSON.parse(msg_event.data);
    const code = message['code'];
    const data = message['data'];
    if (code === 'setBallot') {
      setBallot(data);
      setButtonsDisabled(false);
      // When the ballot changes, reset client vote
      setChoice(-1);
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

  const backgroundColor = () => {
    if (timeLeft <= 10) return 'red'
    if (timeLeft <= 30 && timeLeft > 10) return 'yellow'
    return 'green'
  }

  const visualTimerHeight = () => {
    const percent = (timeLeftRatio * 100).toFixed(2);
    return '' + percent + '%';
  }

  const visualTimerStyle = () => {
    return {
            position: 'absolute',
            backgroundColor: 'orange',
            width: '100%',
            height: visualTimerHeight(),
            zIndex: 1,
            opacity: '50%',
            pointerEvents: 'none',
            bottom: 0,
            left: 0,
          }
  };

  return (
    <View style={styles.container}>
      <View style={visualTimerStyle()}></View>
      <View style={{ flex: 1, backgroundColor: backgroundColor()  }}>
        <View style={styles.header}>
          <Text style={[styles.big, styles.timeLeft]}>{timeLeft}</Text>
          <Text style={[styles.big, styles.question]}>{ballot.question}</Text>
        </View>
      </View>
      {ballot.choices.map((curChoice, i, _) => {
        const isSelected = choice === i;
        return <Pressable disabled={buttonsDisabled} style={[styles.choice, isSelected ? styles.selectedChoice : styles.unselectedChoice]} onPress={() => choose(i)} key={i}>
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
    userSelect: 'none',
  },
  choice: {
    flex: 2,
    borderWidth: 1,
  },
  unselectedChoice: {
    backgroundColor: 'grey',
  },
  selectedChoice: {
    backgroundColor: 'lightblue',
  },
  big: {
    fontSize: '1.2rem',
    fontFamily: 'LemonMilk',
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
