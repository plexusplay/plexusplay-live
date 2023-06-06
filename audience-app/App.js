// Standard libraries
import { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';

// Third-party libraries
import ReconnectingWebSocket from 'reconnecting-websocket';
import { uniqueNamesGenerator, adjectives, colors, animals } from 'unique-names-generator';
import { useFonts } from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Svg, Path, Text } from 'react-native-svg';


// const WS_BACKEND = "ws://rumpus:8080";
const WS_BACKEND = "wss://voting-socket.rumpus.club";
// const WS_BACKEND = "ws://localhost:8080";

const App = () => {
  const [ballot, setBallot] = useState({
    choices: ["Choice 1", "Choice 2", "Choice 3", "Choice 4"],
    question: "Loading...",
    expires: undefined,
    duration: 0,
  });

  const [votes, setVotes] = useState([]);

  const [choice, setChoice] = useState(-1);
  const [winner, setWinner] = useState(-1);

  const [userId, setUserId] = useState("userId");

  const [timeLeft, setTimeLeft] = useState(0);
  const [timeLeftRatio, setTimeLeftRatio] = useState(0);


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
        getWinner();
        setTimeLeft(0);
        setTimeLeftRatio(0);
        clearInterval(interval);
      } else {
        setTimeLeft(secondsRemaining);
        const ratio = millisRemaining / (ballot.duration*1000);
        setTimeLeftRatio(ratio);
      }
    }, 10);
    return () => clearInterval(interval);
  }, [ballot.expires, votes]);

  const receiveMessage = (msg_event) => {
    const message = JSON.parse(msg_event.data);
    const code = message['code'];
    const data = message['data'];
    if (code === 'setBallot') {
      setBallot(data);
      // When the ballot changes, reset client vote
      setChoice(-1);
      setWinner(-1);
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

  const visualTimerHeight = () => {
    if (timeLeftRatio <= 0) return '0%';
    const percent = (timeLeftRatio * 100).toFixed(2);
    return '' + percent + '%';
  }

  const visualTimerStyle = () => {
    return {
            position: 'absolute',
            backgroundColor: '#590100',
            width: '100%',
            height: visualTimerHeight(),
            zIndex: -1,
            pointerEvents: 'none',
            bottom: 0,
            left: 0,
          }
  };

  const buttonsDisabled = () => {
    return (timeLeft <= 0);
  }

  const fillStyle = (i) => {
    if (i === winner) return 'purple';
    if (i === choice) return 'green';
    return 'black';
  }

  function findMaxWithHigherIndex(numbers) {
    let max = -Infinity;
    let maxIndex = -1;
    for (let i = 0; i < numbers.length; i++) {
      if (numbers[i] > max) {
        max = numbers[i];
        maxIndex = i;
      } else if (numbers[i] === max && i > maxIndex) {
        maxIndex = i;
      }
    }
    return maxIndex;
  }

  const getWinner = () => {
    if (votes.every((v) => v === 0)) return -1;
    setWinner(findMaxWithHigherIndex(votes));
  }

  return (
    <View style={styles.container}>
      <View style={{ flex: 1, backgroundColor: 'gray' }}>
        <View style={visualTimerStyle()}></View>
        <View style={styles.header}>
          <Text style={[styles.big, styles.question]}>{ballot.question}</Text>
          <View style={styles.buttonContainer}>
            <View style={styles.triangle} />
            {ballot.choices.map((curChoice, i, _) => {
              return(
                <TouchableOpacity disabled={buttonsDisabled()} onPress={() => choose(i)}>
                  <Svg width='340' height='100'>
                    <Path d='M 20,0 L 320,0 L 340,30 L 320,60 L 20,60 L 0,30 Z' fill={fillStyle(i)}/>
                    <Text x="25" y="30" textAnchor="left" alignmentBaseline="middle" fill='white' style={[styles.big, styles.choiceText]}>
                      {curChoice}
                    </Text>
                    <Text x="290" y="30" textAnchor="right" alignmentBaseline="middle" fill='white' style={[styles.big, styles.choiceText]}>
                      ({votes[i]})
                    </Text>
                  </Svg>
                </TouchableOpacity>
              )
            })}
          </View>
          <Text style={[styles.verybig, styles.timeLeft]}>{isNaN(timeLeft) ? 0 : timeLeft}</Text>
        </View>
      </View>
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    userSelect: 'none',
  },
  big: {
    fontSize: '1.2rem',
    fontFamily: 'LemonMilk',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  verybig: {
    fontSize: '3.2rem',
    fontFamily: 'LemonMilk',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  question: {
    marginTop: 0,
    borderColor: 'black',
    paddingVertical: '1rem',
    borderRadius: '1rem',
    width: '66%',
    textAlign: 'center',
    backgroundColor: 'black',
    color: 'white',
  },
  choiceText: {
    marginTop: 'auto',
    marginBottom: 'auto',
    color: 'white'
  },
  selectedText: {
    fontWeight: 'bold',
  },
  unselectedText: {
    fontWeight: 'normal',
  },
  buttonContainer: {
    marginTop: 50,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  button: {
    borderRadius: 5,
    overflow: 'hidden',
    width: 200,
    height: 50,
    backgroundColor: 'white',
    marginBottom: 50,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  buttonContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeLeft: {
    textShadowColor: 'white',
    textShadowRadius: '1rem',
  },
});

export default App;
