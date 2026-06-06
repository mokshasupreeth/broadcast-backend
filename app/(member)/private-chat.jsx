import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image,
  KeyboardAvoidingView, Platform, StyleSheet,
  Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { connectSocket, getSocket } from '../../services/socket';
import { getAuth } from '../../store/authStore';

const BASE_URL = 'https://broadcast-backend-mxyr.onrender.com';

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
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const [sound, setSound] = useState(null);
  const [showAI, setShowAI] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showDisappearMenu, setShowDisappearMenu] = useState(false);
  const [disappearTimer, setDisappearTimer] = useState(0);
  const [undoMessage, setUndoMessage] = useState(null);
  const [undoTimeout, setUndoTimeout] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageCaption, setImageCaption] = useState('');
  const flatRef = useRef(null);
  const typingTimeout = useRef(null);
  const myIdRef = useRef(null);

  // ✅ FIX 1: paramChatId dependency - new chat open ainapudu re-init avutundi
  useEffect(() => {
    init();
    return () => {
      const socket = getSocket();
      if (socket) {
        socket.off('private_message');
        socket.off('typing');
        socket.off('stop_typing');
        socket.off('message_deleted');
        socket.off('message_read');
      }
      if (sound) sound.unloadAsync();
    };
  }, [paramChatId]); // ✅ KEY FIX

  const init = async () => {
    // ✅ FIX 2: Reset all state when new chat opens
    setMessages([]);
    setLoading(true);
    setIsTyping(false);
    setReplyTo(null);
    setUndoMessage(null);
    setShowDisappearMenu(false);
    setShowAI(false);

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
        router.replace('/(member)/chats');
        return;
      }
    }
    setChatId(cId);

    await loadMessages(cId, user.id);

    const socket = await connectSocket();
    if (socket) {
      // ✅ FIX 3: Remove old listeners before adding new ones
      socket.off('private_message');
      socket.off('typing');
      socket.off('stop_typing');
      socket.off('message_deleted');
      socket.off('message_read');

      socket.on('private_message', (data) => {
        if (String(data.chatId) === String(cId)) {
          setMessages(prev => {
            if (prev.find(m => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
          if (String(data.message.sender_id) !== String(myIdRef.current)) {
            api.post(`/api/chat/chats/${cId}/messages/${data.message.id}/read`).catch(() => {});
          }
          setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
        }
      });

      socket.on('typing', (data) => {
        if (String(data.chatId) === String(cId) && String(data.userId) !== String(myIdRef.current)) {
          setIsTyping(true);
        }
      });

      socket.on('stop_typing', (data) => {
        if (String(data.chatId) === String(cId)) setIsTyping(false);
      });

      socket.on('message_deleted', (data) => {
        if (String(data.chatId) === String(cId)) {
          setMessages(prev => prev.filter(m => m.id !== data.messageId));
        }
      });

      socket.on('message_read', (data) => {
        if (String(data.chatId) === String(cId)) {
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
      const uid = userId || myIdRef.current;
      const unreadMsgs = msgs.filter(m => String(m.sender_id) !== String(uid) && !m.read_at);
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
    const msgText = text.trim();
    setText('');
    setReplyTo(null);

    const tempUndoTimeout = setTimeout(async () => {
      setUndoMessage(null);
      setSending(true);
      try {
        await api.post(`/api/chat/chats/${chatId}/messages`, {
          body: msgText,
          replyTo: replyTo?.id || null,
        });
      } catch (e) {
        Alert.alert('Error', 'Failed to send message');
        setText(msgText);
      } finally {
        setSending(false);
      }
    }, 3000);

    setUndoTimeout(tempUndoTimeout);
    setUndoMessage({ text: msgText });
  };

  const handleUndo = () => {
    clearTimeout(undoTimeout);
    setText(undoMessage.text);
    setUndoMessage(null);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled) {
      setSelectedImage(result.assets[0]);
      setImageCaption('');
    }
  };

  const sendImage = async () => {
    if (!selectedImage) return;
    const formData = new FormData();
    formData.append('file', {
      uri: selectedImage.uri,
      name: 'image.jpg',
      type: 'image/jpeg',
    });
    formData.append('body', imageCaption || '📷 Photo');
    setSelectedImage(null);
    setImageCaption('');
    try {
      await api.post(`/api/chat/chats/${chatId}/messages`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to send image');
    }
  };

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
      setIsRecording(true);
    } catch (e) {
      Alert.alert('Error', 'Could not start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    const formData = new FormData();
    formData.append('file', { uri, name: 'voice.m4a', type: 'audio/m4a' });
    formData.append('body', '🎤 Voice message');
    try {
      await api.post(`/api/chat/chats/${chatId}/messages`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to send voice message');
    }
  };

  const playAudio = async (fileUrl, msgId) => {
    try {
      if (sound) { await sound.unloadAsync(); setSound(null); setPlayingId(null); }
      const { sound: newSound } = await Audio.Sound.createAsync({ uri: `${BASE_URL}${fileUrl}` });
      setSound(newSound);
      setPlayingId(msgId);
      await newSound.playAsync();
      newSound.setOnPlaybackStatusUpdate(status => {
        if (status.didJustFinish) { setPlayingId(null); newSound.unloadAsync(); }
      });
    } catch (e) {
      Alert.alert('Error', 'Could not play audio');
    }
  };

  const askAI = async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'YOUR_ANTHROPIC_API_KEY',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{ role: 'user', content: aiQuery }],
          system: 'You are a helpful assistant. Keep responses concise.'
        })
      });
      const data = await response.json();
      const answer = data.content?.[0]?.text || 'Sorry, could not process that.';
      setAiQuery('');
      setShowAI(false);
      setText(answer);
    } catch (e) {
      Alert.alert('Error', 'AI assistant failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleLongPress = (msg) => {
    const isMe = String(msg.sender_id) === String(myIdRef.current);
    const options = [{ text: '↩ Reply', onPress: () => setReplyTo(msg) }];
    if (isMe) {
      options.push({
        text: '🗑️ Delete for Everyone', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/chat/messages/${msg.id}`, { data: { deleteFor: 'everyone' } });
            setMessages(prev => prev.filter(m => m.id !== msg.id));
          } catch { Alert.alert('Error', 'Failed to delete'); }
        }
      });
    }
    options.push({
      text: '🗑️ Delete for Me', style: 'destructive',
      onPress: async () => {
        try {
          await api.delete(`/api/chat/messages/${msg.id}`, { data: { deleteFor: 'me' } });
          setMessages(prev => prev.filter(m => m.id !== msg.id));
        } catch { Alert.alert('Error', 'Failed to delete'); }
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
    const isMe = String(item.sender_id) === String(myIdRef.current);
    const isImage = item.file_mime?.startsWith('image/');
    const isAudio = item.file_mime?.startsWith('audio/');

    return (
      <TouchableOpacity
        onLongPress={() => handleLongPress(item)}
        activeOpacity={0.8}
        style={[styles.msgRow, isMe && styles.msgRowMe]}
      >
        {item.reply_to && (
          <View style={[styles.replyBox, { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : colors.lightGray }]}>
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
          {isImage && item.file_url && (
            <Image
              source={{ uri: `${BASE_URL}${item.file_url}` }}
              style={styles.imageMsg}
              resizeMode="cover"
            />
          )}
          {isAudio && item.file_url && (
            <TouchableOpacity style={styles.audioMsg} onPress={() => playAudio(item.file_url, item.id)}>
              <Text style={styles.audioIcon}>{playingId === item.id ? '⏸️' : '▶️'}</Text>
              <View style={styles.audioWave}>
                {[4, 8, 12, 16, 10, 14, 8, 6].map((h, i) => (
                  <View key={i} style={[styles.audioBar, { height: h, backgroundColor: isMe ? '#fff' : colors.primary }]} />
                ))}
              </View>
              <Text style={[styles.audioDuration, { color: isMe ? '#fff' : colors.text }]}>
                {playingId === item.id ? 'Playing...' : 'Voice'}
              </Text>
            </TouchableOpacity>
          )}
          {!isImage && !isAudio && item.file_url && (
            <View style={styles.fileBox}>
              <Text style={styles.fileEmoji}>📎</Text>
              <Text style={[styles.fileName, { color: isMe ? '#fff' : colors.text }]} numberOfLines={1}>
                {item.file_name || 'File'}
              </Text>
            </View>
          )}
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
    >
      {/* Header */}
      <LinearGradient
        colors={isDark ? ['#1E3A8A', '#1E293B'] : ['#1D4ED8', '#7C3AED']}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.replace('/(member)/chats')} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{otherName?.[0]?.toUpperCase() || '?'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerName}>{otherName}</Text>
            <Text style={styles.headerStatus}>{isTyping ? '✍️ typing...' : 'tap for info'}</Text>
          </View>
          <TouchableOpacity onPress={() => setShowDisappearMenu(!showDisappearMenu)} style={styles.disappearBtn}>
            <Text style={styles.disappearBtnText}>⏱</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Disappear Menu */}
      {showDisappearMenu && (
        <View style={[styles.disappearMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.disappearTitle, { color: colors.text }]}>⏱ Disappearing Messages</Text>
          {[
            { label: 'Off', value: 0 },
            { label: '5 minutes', value: 300 },
            { label: '1 hour', value: 3600 },
            { label: '24 hours', value: 86400 },
            { label: '7 days', value: 604800 },
          ].map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.disappearOption, disappearTimer === opt.value && { backgroundColor: colors.unread }]}
              onPress={() => {
                setDisappearTimer(opt.value);
                setShowDisappearMenu(false);
                api.post('/api/chat/settings/disappearing', { chatId, duration: opt.value }).catch(() => {});
              }}
            >
              <Text style={[styles.disappearOptionText, { color: disappearTimer === opt.value ? colors.primary : colors.text }]}>
                {opt.label} {disappearTimer === opt.value ? '✓' : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

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
              <Text style={styles.emptyEmoji}>👋</Text>
              <Text style={[styles.emptyText, { color: colors.textLight }]}>Say hello to {otherName}!</Text>
            </View>
          }
        />
      )}

      {/* Undo Toast */}
      {undoMessage && (
        <View style={[styles.undoToast, { backgroundColor: colors.text }]}>
          <Text style={[styles.undoText, { color: colors.card }]}>Message sending...</Text>
          <TouchableOpacity onPress={handleUndo} style={[styles.undoBtn, { backgroundColor: colors.primary }]}>
            <Text style={styles.undoBtnText}>UNDO</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* AI Panel */}
      {showAI && (
        <View style={[styles.aiPanel, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <Text style={[styles.aiTitle, { color: colors.text }]}>🤖 AI Assistant</Text>
          <TextInput
            style={[styles.aiInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.primary }]}
            placeholder="Ask AI anything..."
            placeholderTextColor={colors.gray}
            value={aiQuery}
            onChangeText={setAiQuery}
            autoFocus
          />
          <View style={styles.aiActions}>
            <TouchableOpacity style={[styles.aiBtn, { backgroundColor: colors.lightGray }]} onPress={() => setShowAI(false)}>
              <Text style={[styles.aiBtnText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.aiBtn, { backgroundColor: colors.primary }]} onPress={askAI} disabled={aiLoading}>
              <Text style={[styles.aiBtnText, { color: '#fff' }]}>{aiLoading ? '...' : 'Ask'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Reply Preview */}
      {replyTo && (
        <View style={[styles.replyPreview, { backgroundColor: colors.card, borderLeftColor: colors.primary }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.replyPreviewLabel, { color: colors.primary }]}>Replying to</Text>
            <Text style={[styles.replyPreviewText, { color: colors.textLight }]} numberOfLines={1}>
              {replyTo.body || 'File'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Text style={[styles.replyClose, { color: colors.gray }]}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input Row */}
      <View style={[styles.inputRow, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity onPress={pickImage} style={styles.toolBtn}>
          <Text style={styles.toolIcon}>📷</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowAI(true)} style={styles.toolBtn}>
          <Text style={styles.toolIcon}>🤖</Text>
        </TouchableOpacity>
        <TextInput
          style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
          placeholder="Type a message..."
          placeholderTextColor={colors.gray}
          value={text}
          onChangeText={handleTyping}
          multiline
        />
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

      {/* Image Preview */}
      {selectedImage && (
        <View style={styles.imagePreviewOverlay}>
          <View style={[styles.imagePreviewHeader, { backgroundColor: colors.card }]}>
            <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.imagePreviewClose}>
              <Text style={[styles.imagePreviewCloseText, { color: colors.text }]}>✕</Text>
            </TouchableOpacity>
            <Text style={[styles.imagePreviewTitle, { color: colors.text }]}>Send Photo</Text>
            <View style={{ width: 40 }} />
          </View>
          <Image source={{ uri: selectedImage.uri }} style={styles.imagePreviewImg} resizeMode="contain" />
          <View style={[styles.imagePreviewFooter, { backgroundColor: colors.card }]}>
            <TextInput
              style={[styles.imagePreviewCaption, { backgroundColor: colors.background, color: colors.text }]}
              placeholder="Add a caption..."
              placeholderTextColor={colors.gray}
              value={imageCaption}
              onChangeText={setImageCaption}
            />
            <TouchableOpacity style={[styles.imagePreviewSend, { backgroundColor: colors.primary }]} onPress={sendImage}>
              <Text style={styles.imagePreviewSendText}>➤</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 12, padding: 4 },
  backText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  headerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerAvatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  headerAvatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  headerName: { color: '#fff', fontWeight: '700', fontSize: 16 },
  headerStatus: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 1 },
  disappearBtn: { padding: 8 },
  disappearBtnText: { fontSize: 20 },
  disappearMenu: { position: 'absolute', top: 100, right: 16, zIndex: 100, borderRadius: 16, padding: 12, borderWidth: 1, width: 220, elevation: 10, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10 },
  disappearTitle: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  disappearOption: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4 },
  disappearOptionText: { fontSize: 14 },
  messagesList: { padding: 16, paddingBottom: 8 },
  msgRow: { flexDirection: 'column', alignItems: 'flex-start', marginBottom: 8 },
  msgRowMe: { alignItems: 'flex-end' },
  replyBox: { borderRadius: 8, padding: 6, marginBottom: 4, maxWidth: '80%' },
  replyText: { fontSize: 11 },
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 10 },
  bubbleMe: { borderBottomRightRadius: 4 },
  bubbleThem: { borderBottomLeftRadius: 4 },
  imageMsg: { width: 200, height: 150, borderRadius: 12, marginBottom: 4 },
  audioMsg: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, minWidth: 150 },
  audioIcon: { fontSize: 20 },
  audioWave: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  audioBar: { width: 3, borderRadius: 2 },
  audioDuration: { fontSize: 11 },
  fileBox: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  fileEmoji: { fontSize: 16, marginRight: 6 },
  fileName: { fontSize: 13, flex: 1 },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  bubbleTime: { fontSize: 10 },
  tickText: { fontSize: 10 },
  emptyBox: { alignItems: 'center', marginTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15 },
  undoToast: { position: 'absolute', bottom: 80, left: 16, right: 16, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 100 },
  undoText: { fontSize: 14, fontWeight: '500' },
  undoBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  undoBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  aiPanel: { padding: 16, borderTopWidth: 1 },
  aiTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  aiInput: { borderRadius: 12, padding: 12, fontSize: 14, borderWidth: 1, marginBottom: 12 },
  aiActions: { flexDirection: 'row', gap: 10 },
  aiBtn: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
  aiBtnText: { fontWeight: '700', fontSize: 14 },
  replyPreview: { flexDirection: 'row', alignItems: 'center', padding: 10, borderLeftWidth: 4, marginHorizontal: 12, borderRadius: 8, marginBottom: 4 },
  replyPreviewLabel: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  replyPreviewText: { fontSize: 13 },
  replyClose: { fontSize: 18, padding: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, borderTopWidth: 1, gap: 8 },
  toolBtn: { padding: 8 },
  toolIcon: { fontSize: 22 },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  sendBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  imagePreviewOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', zIndex: 200 },
  imagePreviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 56 },
  imagePreviewClose: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  imagePreviewCloseText: { fontSize: 22, fontWeight: '700' },
  imagePreviewTitle: { fontSize: 16, fontWeight: '700' },
  imagePreviewImg: { flex: 1, width: '100%' },
  imagePreviewFooter: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  imagePreviewCaption: { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14 },
  imagePreviewSend: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  imagePreviewSendText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});