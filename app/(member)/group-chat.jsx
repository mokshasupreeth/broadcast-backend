import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert, FlatList, Image, KeyboardAvoidingView,
  Platform, StyleSheet, Text, TextInput,
  TouchableOpacity, View
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { connectSocket, getSocket } from '../../services/socket';
import { getAuth } from '../../store/authStore';

export default function GroupChat() {
  const { colors, isDark } = useTheme();
  const { groupId, groupName } = useLocalSearchParams();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [myId, setMyId] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [replyTo, setReplyTo] = useState(null);

  // ── Media states ────────────────────────────────────────────────────────────
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sound, setSound] = useState(null);
  const [playingId, setPlayingId] = useState(null);

  const flatRef = useRef(null);
  const typingTimeout = useRef(null);
  const myIdRef = useRef(null);

  const BASE_URL = 'https://broadcast-backend-mxyr.onrender.com'; // 🔧 Change to your server IP

  useEffect(() => {
    init();
    return () => {
      const socket = getSocket();
      if (socket) {
        socket.off('group_message');
        socket.off('typing');
        socket.off('stop_typing');
        socket.off('group_message_deleted');
      }
    };
  }, []);

  const init = async () => {
    const { user } = await getAuth();
    setMyId(user.id);
    myIdRef.current = user.id;

    await loadMessages(user.id);

    const socket = await connectSocket();
    if (socket) {
      socket.emit('join_group', { groupId });

      socket.on('group_message', (data) => {
        if (data.groupId === groupId) {
          setMessages(prev => {
            if (prev.find(m => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
          if (data.message.sender_id !== myIdRef.current) {
            api.post(`/api/chat/groups/${groupId}/messages/${data.message.id}/read`).catch(() => {});
          }
          setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
        }
      });

      socket.on('typing', (data) => {
        if (data.chatId === groupId && data.userId !== myIdRef.current) {
          setTypingUsers(prev => [...new Set([...prev, data.userId])]);
          setTimeout(() => {
            setTypingUsers(prev => prev.filter(id => id !== data.userId));
          }, 3000);
        }
      });

      socket.on('stop_typing', (data) => {
        if (data.chatId === groupId) {
          setTypingUsers(prev => prev.filter(id => id !== data.userId));
        }
      });

      socket.on('group_message_deleted', (data) => {
        if (data.groupId === groupId) {
          setMessages(prev => prev.filter(m => m.id !== data.messageId));
        }
      });
    }
  };

  const loadMessages = async (userId) => {
    try {
      const res = await api.get(`/api/chat/groups/${groupId}/messages`);
      const msgs = res.data || [];
      setMessages(msgs);
      const uid = userId || myIdRef.current;
      const unreadMsgs = msgs.filter(m => m.sender_id !== uid && !m.read_at);
      for (const msg of unreadMsgs) {
        api.post(`/api/chat/groups/${groupId}/messages/${msg.id}/read`).catch(() => {});
      }
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 100);
    } catch (e) {
      console.log('Load group messages error:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTyping = (val) => {
    setText(val);
    const socket = getSocket();
    if (socket) {
      socket.emit('typing', { chatId: groupId, chatType: 'group' });
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        socket.emit('stop_typing', { chatId: groupId, chatType: 'group' });
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
      await api.post(`/api/chat/groups/${groupId}/messages`, {
        body: msgText,
        replyTo: replyTo?.id || null,
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to send');
      setText(msgText);
    } finally {
      setSending(false);
    }
  };

  // ── Image Picker ────────────────────────────────────────────────────────────
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled) {
      const file = result.assets[0];
      const formData = new FormData();
      formData.append('file', { uri: file.uri, name: 'image.jpg', type: 'image/jpeg' });
      formData.append('body', '📷 Photo');
      try {
        await api.post(`/api/chat/groups/${groupId}/messages`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } catch (e) {
        Alert.alert('Error', 'Failed to send image');
      }
    }
  };

  // ── Voice Recording ─────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (e) {
      Alert.alert('Error', 'Could not start recording');
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    const formData = new FormData();
    formData.append('file', { uri, name: 'voice.m4a', type: 'audio/m4a' });
    formData.append('body', '🎤 Voice message');
    try {
      await api.post(`/api/chat/groups/${groupId}/messages`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to send voice message');
    }
  };

  // ── Audio Playback ──────────────────────────────────────────────────────────
  const playAudio = async (fileUrl, msgId) => {
    try {
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
        setPlayingId(null);
      }
      const { sound: newSound } = await Audio.Sound.createAsync({ uri: `${BASE_URL}${fileUrl}` });
      setSound(newSound);
      setPlayingId(msgId);
      await newSound.playAsync();
      newSound.setOnPlaybackStatusUpdate(status => {
        if (status.didJustFinish) {
          setPlayingId(null);
          newSound.unloadAsync();
        }
      });
    } catch (e) {
      Alert.alert('Error', 'Could not play audio');
    }
  };

  // ── Long Press ──────────────────────────────────────────────────────────────
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
            await api.delete(`/api/chat/group-messages/${msg.id}`, { data: { deleteFor: 'everyone' } });
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
      onPress: () => setMessages(prev => prev.filter(m => m.id !== msg.id))
    });
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Message', '', options);
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // ── Render Message ──────────────────────────────────────────────────────────
  const renderMessage = ({ item, index }) => {
    const isMe = item.sender_id === myIdRef.current;
    const prevMsg = messages[index - 1];
    const showName = !isMe && item.sender_name !== prevMsg?.sender_name;
    const isImage = item.file_mime?.startsWith('image/');
    const isAudio = item.file_mime?.startsWith('audio/');

    return (
      <TouchableOpacity
        onLongPress={() => handleLongPress(item)}
        activeOpacity={0.8}
        style={[styles.msgRow, isMe && styles.msgRowMe]}
      >
        {showName && (
          <Text style={[styles.senderName, { color: colors.primary }]}>
            {item.sender_name}
          </Text>
        )}
        {item.reply_to && (
          <View style={[styles.replyBox, {
            backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : colors.lightGray
          }]}>
            <Text style={[styles.replyText, { color: isMe ? '#fff' : colors.textLight }]} numberOfLines={1}>
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
          {/* Image */}
          {isImage && item.file_url && (
            <Image
              source={{ uri: `${BASE_URL}${item.file_url}` }}
              style={styles.imageMsg}
              resizeMode="cover"
            />
          )}

          {/* Audio */}
          {isAudio && item.file_url && (
            <TouchableOpacity
              style={styles.audioMsg}
              onPress={() => playAudio(item.file_url, item.id)}
            >
              <Text style={styles.audioIcon}>
                {playingId === item.id ? '⏸️' : '▶️'}
              </Text>
              <View style={styles.audioWave}>
                {[12, 18, 10, 22, 14, 20, 8, 16].map((h, i) => (
                  <View key={i} style={[
                    styles.audioBar,
                    { height: h, backgroundColor: isMe ? '#fff' : colors.primary }
                  ]} />
                ))}
              </View>
              <Text style={[styles.audioDuration, { color: isMe ? '#fff' : colors.text }]}>
                {playingId === item.id ? 'Playing...' : 'Voice'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Other file */}
          {!isImage && !isAudio && item.file_url && (
            <View style={styles.fileBox}>
              <Text style={styles.fileEmoji}>📎</Text>
              <Text style={[styles.fileName, { color: isMe ? '#fff' : colors.text }]} numberOfLines={1}>
                {item.file_name || 'File'}
              </Text>
            </View>
          )}

          {/* Text body — hide if image only */}
          {!!item.body && !isImage && (
            <Text style={[styles.bubbleText, { color: isMe ? '#fff' : colors.text }]}>
              {item.body}
            </Text>
          )}

          <View style={styles.bubbleFooter}>
            <Text style={[styles.bubbleTime, { color: isMe ? 'rgba(255,255,255,0.7)' : colors.gray }]}>
              {formatTime(item.created_at)}
            </Text>
            {isMe && (
              <Text style={[styles.tickText, { color: item.read_at ? '#60A5FA' : 'rgba(255,255,255,0.7)' }]}>
                {item.read_at ? ' ✓✓' : ' ✓'}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Main Render ─────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <LinearGradient
        colors={isDark ? ['#1E3A8A', '#1E293B'] : ['#7C3AED', '#2563EB']}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.replace('/(member)/chats')} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={[styles.headerAvatar, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
            <Text style={styles.headerAvatarText}>
              {groupName?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
          <View>
            <Text style={styles.headerName}>{groupName}</Text>
            <Text style={styles.headerStatus}>
              {typingUsers.length > 0 ? '✍️ Someone is typing...' : 'Group Chat'}
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
          keyExtractor={(item) => String(item.id)}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>👥</Text>
              <Text style={[styles.emptyText, { color: colors.textLight }]}>
                No messages yet. Say hi!
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
            <Text style={[styles.replyLabel, { color: colors.primary }]}>
              Replying to {replyTo.sender_name}
            </Text>
            <Text style={[styles.replyText2, { color: colors.textLight }]} numberOfLines={1}>
              {replyTo.body || 'File'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Text style={[styles.replyClose, { color: colors.gray }]}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input Row */}
      <View style={[styles.inputRow, {
        backgroundColor: colors.card,
        borderTopColor: colors.border
      }]}>
        {/* 📷 Image Button */}
        <TouchableOpacity onPress={pickImage} style={styles.toolBtn}>
          <Text style={styles.toolIcon}>📷</Text>
        </TouchableOpacity>

        <TextInput
          style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
          placeholder="Message..."
          placeholderTextColor={colors.gray}
          value={text}
          onChangeText={handleTyping}
          multiline
        />

        {/* Send or Mic */}
        {text.trim() ? (
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: colors.primary }]}
            onPress={sendMessage}
            disabled={sending}
          >
            <Text style={styles.sendBtnText}>{sending ? '...' : '➤'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: isRecording ? '#EF4444' : colors.primary }]}
            onPressIn={startRecording}
            onPressOut={stopRecording}
          >
            <Text style={styles.sendBtnText}>{isRecording ? '⏹' : '🎤'}</Text>
          </TouchableOpacity>
        )}
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
    justifyContent: 'center', alignItems: 'center', marginRight: 10
  },
  headerAvatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  headerName: { color: '#fff', fontWeight: '700', fontSize: 16 },
  headerStatus: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 1 },
  messagesList: { padding: 16, paddingBottom: 8 },
  msgRow: { flexDirection: 'column', alignItems: 'flex-start', marginBottom: 8 },
  msgRowMe: { alignItems: 'flex-end' },
  senderName: { fontSize: 11, fontWeight: '700', marginBottom: 2, marginLeft: 4 },
  replyBox: { borderRadius: 8, padding: 6, marginBottom: 4, maxWidth: '80%' },
  replyText: { fontSize: 11 },
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 10 },
  bubbleMe: { borderBottomRightRadius: 4 },
  bubbleThem: { borderBottomLeftRadius: 4 },
  imageMsg: { width: 200, height: 150, borderRadius: 12, marginBottom: 4 },
  audioMsg: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, paddingVertical: 4, minWidth: 150
  },
  audioIcon: { fontSize: 20 },
  audioWave: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  audioBar: { width: 3, borderRadius: 2 },
  audioDuration: { fontSize: 11 },
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
  replyLabel: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  replyText2: { fontSize: 13 },
  replyClose: { fontSize: 18, padding: 4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: 10, borderTopWidth: 1, gap: 8
  },
  toolBtn: { padding: 8 },
  toolIcon: { fontSize: 22 },
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