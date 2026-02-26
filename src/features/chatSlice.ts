import { createSlice } from '@reduxjs/toolkit';
import { sendChatMessage, fetchChatMessages, fetchRecentMessages, ChatMessage } from './chatAPI';

interface ChatState {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  sending: boolean;
  lastMessageId: string | null;
}

const initialState: ChatState = {
  messages: [],
  loading: false,
  error: null,
  sending: false,
  lastMessageId: null,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    clearChat: (state) => {
      state.messages = [];
      state.lastMessageId = null;
    },
    addLocalMessage: (state, action) => {
      state.messages.push(action.payload);
      state.lastMessageId = action.payload.id;
    },
    addIncomingMessage: (state, action) => {
      const incoming = action.payload as ChatMessage;
      const exists = state.messages.some((message) => message.id === incoming.id);
      if (!exists) {
        state.messages.push(incoming);
        state.lastMessageId = incoming.id;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Send message
      .addCase(sendChatMessage.pending, (state) => {
        state.sending = true;
        state.error = null;
      })
      .addCase(sendChatMessage.fulfilled, (state, action) => {
        state.sending = false;
        if (action.payload && typeof action.payload === 'object' && 'message' in action.payload) {
          const msg = { ...action.payload, timestamp: String(action.payload.timestamp) };
          state.messages.push(msg as unknown as ChatMessage);
         
        }
      })
      .addCase(sendChatMessage.rejected, (state, action) => {
        state.sending = false;
        state.error = action.error.message || 'Failed to send message';
      })
      // Fetch messages
      .addCase(fetchChatMessages.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchChatMessages.fulfilled, (state, action) => {
        state.loading = false;
        state.messages = action.payload;
        if (action.payload.length > 0) {
          state.lastMessageId = action.payload[action.payload.length - 1].id;
        }
      })
      .addCase(fetchChatMessages.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch messages';
      })
      // Fetch recent messages
      .addCase(fetchRecentMessages.fulfilled, (state, action) => {
        if (action.payload.length > 0) {
          // Add only new messages
          const existingIds = new Set(state.messages.map(msg => msg.id));
          const newMessages = action.payload.filter((msg: ChatMessage) => !existingIds.has(msg.id));
          state.messages.push(...newMessages);
          state.lastMessageId = action.payload[action.payload.length - 1].id;
        }
      });
  },
});

export const { clearChat, addLocalMessage, addIncomingMessage } = chatSlice.actions;
export default chatSlice.reducer; 
