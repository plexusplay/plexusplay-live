import { StyleSheet, View, Text, Pressable } from 'react-native';

export default function App() {
  return (
    <View
      style={[
        styles.container,
        {
          // Try setting `flexDirection` to `"row"`.
          flexDirection: 'column',
        },
      ]}>
      <Pressable style={{ flex: 1, backgroundColor: 'red' }} >
        <Text>Voting App</Text>
      </Pressable>
      <Pressable style={{ flex: 3, backgroundColor: 'darkorange' }}
        onPress={() => alert('You pressed orange')}  >
        <Text>Choice 1</Text>
      </Pressable>
      <Pressable style={{ flex: 3, backgroundColor: 'green' }} 
        onPress={() => alert('You pressed green')}  >
        <Text>Choice 2</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
});