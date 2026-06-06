import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView,
  Platform, StyleSheet, Text, TextInput,
  TouchableOpacity, View
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { connectSocket, getSocket } from '../../services/socket';
import { getAuth } from '../../store/authStore';

export default function PrivateChat() {
  const { colors, isDark } = useTheme();
  const { chatId: paramChatId, otherName, otherId } = useLocalSearchParams();
  const [messages, setMessages] = useState([]);
  const [chatId, setChatId] = useState(paramChatId);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [myId, setMyId] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const flatRef = useRef(null);
  const typingTimeout = useRef(null);
  const myIdRef = useRef(null);

  useEffect(() => {
    init();
    return () => {
      const socket = getSocket();
      if (socket) {
        socket.off('private_message');
        socket.off('typing');
        socket.off('stop_typing');
        socket.off('message_deleted');
      }
    };
  }, []);

  const init = async () => {
    const { user } = await getAuth();
    setMyId(user.id);
    myIdRef.current = user.id;

    let cId = paramChatId;
    if (!cId) {
      try {
        const res = await api.post('/api/chat/chats', { otherUserId: otherId });
        cId = res.data.id;
        setChatId(cId);
      } catch (e) {
        Alert.alert('Error', 'Could not start chat');
        router.back();
        return;
      }
    }

    await loadMessages(cId, user.id);

    const socket = await connectSocket();
    if (socket) {
      socket.on('private_message', (data) => {
        if (data.chatId === cId) {
          setMessages(prev => {
            if (prev.find(m => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
          // Mark as read immediately
          if (data.message.sender_id !== myIdRef.current) {
            api.post(`/api/chat/chats/${cId}/messages/${data.message.id}/read`).catch(() => {});
          }
          setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
        }
      });

      socket.on('typing', (data) => {
        if (data.chatId === cId && data.userId !== myIdRef.current) {
          setIsTyping(true);
        }
      });

      socket.on('stop_typing', (data) => {
        if (data.chatId === cId) setIsTyping(false);
      });

      socket.on('message_deleted', (data) => {
        if (data.chatId === cId) {
          setMessages(prev => prev.filter(m => m.id !== data.messageId));
        }
      });

      socket.on('message_read', (data) => {
        if (data.chatId === cId) {
          setMessages(prev => prev.map(m =>
            m.id === data.messageId ? { ...m, read_at: new Date().toISOString() } : m
          ));
        }
      });
    }
  };

  const loadMessages = async (cId, userId) => {
    try {
      const res = await api.get(`/api/chat/chats/${cId}/messages`);
      const msgs = res.data || [];
      setMessages(msgs);

      // Mark all unread messages as read
      const uid = userId || myIdRef.current;
      const unreadMsgs = msgs.filter(m => m.sender_id !== uid && !m.read_at);
      for (const msg of unreadMsgs) {
        api.post(`/api/chat/chats/${cId}/messages/${msg.id}/read`).catch(() => {});
      }

      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 100);
    } catch (e) {
      console.log('Load messages error:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTyping = (val) => {
    setText(val);
    const socket = getSocket();
    if (socket && otherId) {
      socket.emit('typing', { chatId, chatType: 'private', toUserId: otherId });
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        socket.emit('stop_typing', { chatId, chatType: 'private', toUserId: otherId });
      }, 1500);
    }
  };

  const sendMessage = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const msgText = text.trim();
    setText('');
    setReplyTo(null);

    try {
      await api.post(`/api/chat/chats/${chatId}/messages`, {
        body: msgText,
        replyTo: replyTo?.id || null,
      });
    } catch (e) {
      console.log('Send error:', e.response?.data || e.message);
      Alert.alert('Error', 'Failed to send message');
      setText(msgText);
    } finally {
      setSending(false);
    }
  };

  const handleLongPress = (msg) => {
    const isMe = msg.sender_id === myIdRef.current;
    const options = [
      { text: '↩ Reply', onPress: () => setReplyTo(msg) },
    ];
    if (isMe) {
      options.push({
        text: '🗑️ Delete for Everyone',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/chat/messages/${msg.id}`, { data: { deleteFor: 'everyone' } });
            setMessages(prev => prev.filter(m => m.id !== msg.id));
          } catch {
            Alert.alert('Error', 'Failed to delete');
          }
        }
      });
    }
    options.push({
      text: '🗑️ Delete for Me',
      style: 'destructive',
      onPress: async () => {
        try {
          await api.delete(`/api/chat/messages/${msg.id}`, { data: { deleteFor: 'me' } });
          setMessages(prev => prev.filter(m => m.id !== msg.id));
        } catch {
          Alert.alert('Error', 'Failed to delete');
        }
      }
    });
    options.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert('Message', '', options);
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }) => {
    const isMe = item.sender_id === myIdRef.current;

    return (
      <TouchableOpacity
        onLongPress={() => handleLongPress(item)}
        activeOpacity={0.8}
        style={[styles.msgRow, isMe && styles.msgRowMe]}
      >
        {item.reply_to && (
          <View style={[styles.replyBox, {
            backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : colors.lightGray
          }]}>
            <Text style={[styles.replyText, {
              color: isMe ? '#fff' : colors.textLight
            }]} numberOfLines={1}>
              ↩ Replied to a message
            </Text>
          </View>
        )}
        <View style={[
          styles.bubble,
          isMe
            ? [styles.bubbleMe, { backgroundColor: colors.primary }]
            : [styles.bubbleThem, { backgroundColor: colors.card }]
        ]}>
          {item.file_url && (
            <View style={styles.fileBox}>
              <Text style={styles.fileEmoji}>📎</Text>
              <Text
                style={[styles.fileName, { color: isMe ? '#fff' : colors.text }]}
                numberOfLines={1}
              >
                {item.file_name || 'File'}
              </Text>
            </View>
          )}
          {!!item.body && (
            <Text style={[styles.bubbleText, { color: isMe ? '#fff' : colors.text }]}>
              {item.body}
            </Text>
          )}
          <View style={styles.bubbleFooter}>
            <Text style={[styles.bubbleTime, {
              color: isMe ? 'rgba(255,255,255,0.7)' : colors.gray
            }]}>
              {formatTime(item.created_at)}
            </Text>
            {isMe && (
              <Text style={[styles.tickText, {
                color: item.read_at ? '#60A5FA' : 'rgba(255,255,255,0.7)'
              }]}>
                {item.read_at ? ' ✓✓' : item.delivered_at ? ' ✓✓' : ' ✓'}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <LinearGradient
        colors={isDark ? ['#1E3A8A', '#1E293B'] : ['#1D4ED8', '#7C3AED']}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>
              {otherName?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
          <View>
            <Text style={styles.headerName}>{otherName}</Text>
            <Text style={styles.headerStatus}>
              {isTyping ? '✍️ typing...' : 'tap for info'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Messages */}
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>👋</Text>
              <Text style={[styles.emptyText, { color: colors.textLight }]}>
                Say hello to {otherName}!
              </Text>
            </View>
          }
        />
      )}

      {/* Reply Preview */}
      {replyTo && (
        <View style={[styles.replyPreview, {
          backgroundColor: colors.card,
          borderLeftColor: colors.primary
        }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.replyPreviewLabel, { color: colors.primary }]}>
              Replying to
            </Text>
            <Text style={[styles.replyPreviewText, { color: colors.textLight }]} numberOfLines={1}>
              {replyTo.body || 'File'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Text style={[styles.replyClose, { color: colors.gray }]}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      <View style={[styles.inputRow, {
        backgroundColor: colors.card,
        borderTopColor: colors.border
      }]}>
        <TextInput
          style={[styles.input, {
            backgroundColor: colors.background,
            color: colors.text
          }]}
          placeholder="Type a message..."
          placeholderTextColor={colors.gray}
          value={text}
          onChangeText={handleTyping}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, {
            backgroundColor: text.trim() ? colors.primary : colors.lightGray
          }]}
          onPress={sendMessage}
          disabled={!text.trim() || sending}
        >
          <Text style={styles.sendBtnText}>{sending ? '...' : '➤'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 56, paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center'
  },
  backBtn: { marginRight: 12, padding: 4 },
  backText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  headerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center', alignItems: 'center', marginRight: 10
  },
  headerAvatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  headerName: { color: '#fff', fontWeight: '700', fontSize: 16 },
  headerStatus: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 1 },
  messagesList: { padding: 16, paddingBottom: 8 },
  msgRow: { flexDirection: 'column', alignItems: 'flex-start', marginBottom: 8 },
  msgRowMe: { alignItems: 'flex-end' },
  replyBox: { borderRadius: 8, padding: 6, marginBottom: 4, maxWidth: '80%' },
  replyText: { fontSize: 11 },
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 10 },
  bubbleMe: { borderBottomRightRadius: 4 },
  bubbleThem: { borderBottomLeftRadius: 4 },
  fileBox: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  fileEmoji: { fontSize: 16, marginRight: 6 },
  fileName: { fontSize: 13, flex: 1 },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleFooter: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'flex-end', marginTop: 4
  },
  bubbleTime: { fontSize: 10 },
  tickText: { fontSize: 10 },
  emptyBox: { alignItems: 'center', marginTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15 },
  replyPreview: {
    flexDirection: 'row', alignItems: 'center',
    padding: 10, borderLeftWidth: 4,
    marginHorizontal: 12, borderRadius: 8, marginBottom: 4
  },
  replyPreviewLabel: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  replyPreviewText: { fontSize: 13 },
  replyClose: { fontSize: 18, padding: 4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: 10, borderTopWidth: 1, gap: 8
  },
  input: {
    flex: 1, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, maxHeight: 100
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center'
  },
  sendBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});