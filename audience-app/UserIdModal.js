import { useState } from 'react';
import { KeyboardAvoidingView, Modal, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export default function UserIdModal({ isVisible, onClose }) {
    const styles = StyleSheet.create({
        modalContent: {
          height: '100%',
          width: '100%',
          bottom: 0,
          position: 'absolute',
          backgroundColor: '#25292e',
        },
        titleContainer: {
          height: '16%',
          backgroundColor: '#464C55',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        title: {
          color: '#fff',
          fontSize: 16,
        },
        nameEntry: {
            height: '100%',
            color: '#fff',
            fontSize: 24,
        },
      });

  return (
    <Modal animationType="slide" transparent={true} visible={isVisible}>
      <KeyboardAvoidingView style={styles.modalContent}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Please enter your name:</Text>
        </View>
          <TextInput
            style={styles.nameEntry}
            autoFocus={true}
            multiline={true}
            blurOnSubmit={true}
            textAlignVertical='top'
            placeholder="My Name" 
            returnKeyType='done'
            onSubmitEditing={e => onClose(e.nativeEvent.text)} />
      </KeyboardAvoidingView>
    </Modal>
  );
}
