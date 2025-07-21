import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { sendMessageWithFallback } from '@/utils/aiChat';
import { bodyText } from '@/constants/typography';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  error?: boolean;
}

interface AIChatToolProps {
  recipeInstructions?: string[];
  recipeSubstitutions?: string | null;
}

export default function AIChatTool({
  recipeInstructions,
  recipeSubstitutions,
}: AIChatToolProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'intro-message',
      text: "Ask me anything about cooking generally or your recipe specifically.",
      sender: 'bot',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (inputText.trim() === '' || isLoading) return;

    const newUserMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: 'user',
    };
    setMessages((prevMessages) => [newUserMessage, ...prevMessages]);
    setInputText('');
    Keyboard.dismiss();
    setIsLoading(true);

    const historyForApi = messages
      .filter((msg) => msg.id !== 'intro-message')
      .map((msg) => ({
        role: msg.sender === 'user' ? 'user' : ('model' as 'user' | 'model'),
        parts: [{ text: msg.text }],
      }))
      .reverse();

    // If we have recipe context, include it
    let messageWithContext = newUserMessage.text;
    if (recipeInstructions && recipeInstructions.length > 0) {
      const context = `
        Current Recipe Instructions:
        ---
        ${recipeInstructions.join('\n')}
        ---
      `;
      messageWithContext = `${context}\n\nUser Question: ${newUserMessage.text}`;
    }

    const botResponseText = await sendMessageWithFallback(
      messageWithContext,
      historyForApi,
      recipeInstructions ? { instructions: recipeInstructions, substitutions: recipeSubstitutions } : undefined
    );

    setIsLoading(false);

    if (botResponseText) {
      const newBotMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: botResponseText,
        sender: 'bot',
        error: botResponseText.startsWith('Error:'),
      };
      setMessages((prevMessages) => [newBotMessage, ...prevMessages]);
    } else {
      const errorBotMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I couldn't get a response. Please try again.",
        sender: 'bot',
        error: true,
      };
      setMessages((prevMessages) => [errorBotMessage, ...prevMessages]);
    }
  };

  const renderMessageItem = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageBubble,
        item.sender === 'user' ? styles.userMessage : styles.botMessage,
        item.error && styles.errorMessageBubble,
      ]}
    >
      <Text
        style={
          item.sender === 'user'
            ? styles.userMessageText
            : styles.botMessageText
        }
      >
        {item.text}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <FlatList
        data={messages}
        renderItem={renderMessageItem}
        keyExtractor={(item) => item.id}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        inverted
        showsVerticalScrollIndicator={false}
      />
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      )}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask me anything about cooking!"
          placeholderTextColor={COLORS.darkGray}
          multiline
          editable={!isLoading}
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={handleSend}
          disabled={isLoading}
        >
          <MaterialCommunityIcons
            name="send"
            size={24}
            color={isLoading ? COLORS.darkGray : COLORS.primary}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    width: '100%',
  },
  messageList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  messageListContent: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  messageBubble: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginVertical: 8,
    maxWidth: '80%',
  },
  userMessage: {
    backgroundColor: COLORS.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 6,
  },
  botMessage: {
    backgroundColor: COLORS.white,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 6,
    borderColor: COLORS.lightGray,
    borderWidth: 1,
  },
  errorMessageBubble: {
    backgroundColor: COLORS.error,
    borderColor: COLORS.error,
  },
  userMessageText: {
    ...bodyText,
    color: COLORS.white,
    fontSize: 16,
    lineHeight: 22,
  },
  botMessageText: {
    ...bodyText,
    color: COLORS.textDark,
    fontSize: 16,
    lineHeight: 22,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    backgroundColor: COLORS.background,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 14 : 12,
    paddingBottom: Platform.OS === 'ios' ? 14 : 12,
    ...bodyText,
    marginRight: 12,
    color: COLORS.textDark,
    fontSize: 16,
  },
  sendButton: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
}); 