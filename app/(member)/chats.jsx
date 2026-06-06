import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, FlatList, Modal,
  Platform,
  RefreshControl, StatusBar, StyleSheet, Text, TextInput,
  TouchableOpacity, View
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { connectSocket } from '../../services/socket';
import { getAuth } from '../../store/authStore';

const { width } = Dimensions.get('window');

const AVATAR_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899',
  '#10b981', '#f59e0b', '#ef4444',
];

// ─── Theme tokens ──────────────────────────────────────────────────────────────
const DARK = {
  bg:        '#111111',
  surface:   '#1c1c1e',
  card:      '#1c1c1e',
  border:    '#2c2c2e',
  text:      '#f5f5f5',
  muted:     '#8e8e93',
  accent:    '#3b82f6',
  tabActive: '#3b82f6',
  separator: '#2c2c2e',
};
const LIGHT = {
  bg:        '#f2f2f7',
  surface:   '#ffffff',
  card:      '#ffffff',
  border:    '#e5e5ea',
  text:      '#111111',
  muted:     '#8e8e93',
  accent:    '#2563eb',
  tabActive: '#2563eb',
  separator: '#e5e5ea',
};

// ─── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, colorIndex, isOnline, size = 46 }) {
  const color = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length];
  const initials = name?.[0]?.toUpperCase() || '?';
  return (
    <View style={{ position: 'relative', marginRight: 13 }}>
      <View style={[styles.avatar, {
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: color + '18',
        borderColor: color + '35',
      }]}>
        <Text style={[styles.avatarText, { color, fontSize: size * 0.38 }]}>{initials}</Text>
      </View>
      {isOnline && (
        <View style={[styles.onlineDot, {
          width: 10, height: 10, borderRadius: 5,
          bottom: 0, right: 0,
        }]} />
      )}
    </View>
  );
}

export default function Chats() {
  const { isDark, toggle } = useTheme();
  const C = isDark ? DARK : LIGHT;

  const [privateChats, setPrivateChats] = useState([]);
  const [groupChats, setGroupChats] = useState([]);
  const [archivedIds, setArchivedIds] = useState([]);
  const [pinnedIds, setPinnedIds] = useState([]);
  const [lockedChats, setLockedChats] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [user, setUser] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [lockModal, setLockModal] = useState(false);
  const [lockPin, setLockPin] = useState('');
  const [lockChatId, setLockChatId] = useState(null);
  const [unlockModal, setUnlockModal] = useState(false);
  const [unlockPin, setUnlockPin] = useState('');
  const [pendingChat, setPendingChat] = useState(null);
  const userRef = useRef(null);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { user } = await getAuth();
    setUser(user);
    userRef.current = user;
    await loadChats();
    await loadLockedChats();
    const socket = await connectSocket();
    if (socket) {
      socket.off('private_message');
      socket.off('group_message');
      socket.off('user_online');
      socket.on('private_message', () => loadChats());
      socket.on('group_message', () => loadChats());
      socket.on('user_online', () => loadChats());
    }
  };

  const loadLockedChats = async () => {
    try {
      const data = await AsyncStorage.getItem('locked_chats');
      if (data) setLockedChats(JSON.parse(data));
    } catch (e) {}
  };

  const saveLockedChats = async (chats) => {
    await AsyncStorage.setItem('locked_chats', JSON.stringify(chats));
    setLockedChats(chats);
  };

  const loadChats = async () => {
    try {
      const [privRes, grpRes, archRes] = await Promise.all([
        api.get('/api/chat/chats'),
        api.get('/api/chat/groups'),
        api.get('/api/chat/archived'),
      ]);
      setPrivateChats(privRes.data || []);
      setGroupChats(grpRes.data || []);
      setArchivedIds((archRes.data || []).map(a => a.chat_id));
    } catch (e) {
      console.log('Chat load error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadChats();
  }, []);

  const allChats = [
    ...privateChats.map(c => ({ ...c, type: 'private' })),
    ...groupChats.map(c => ({ ...c, type: 'group' })),
  ].sort((a, b) => {
    const aPinned = pinnedIds.includes(a.id) ? 1 : 0;
    const bPinned = pinnedIds.includes(b.id) ? 1 : 0;
    if (bPinned !== aPinned) return bPinned - aPinned;
    const aTime = a.lastMessage?.created_at || a.created_at;
    const bTime = b.lastMessage?.created_at || b.created_at;
    return new Date(bTime) - new Date(aTime);
  });

  const visibleChats = allChats.filter(c => {
    const isArchived = archivedIds.includes(c.id);
    if (showArchived) return isArchived;
    const name = c.type === 'private' ? c.other_name : c.name;
    const matchSearch = name?.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (isArchived) return false;
    if (activeTab === 'groups') return c.type === 'group';
    if (activeTab === 'personal') return c.type === 'private';
    return true;
  });

  const totalUnread = allChats
    .filter(c => !archivedIds.includes(c.id))
    .reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  const archivedCount = archivedIds.length;

  const openChat = (chat) => {
    if (lockedChats[chat.id]) {
      setPendingChat(chat);
      setUnlockPin('');
      setUnlockModal(true);
      return;
    }
    navigateToChat(chat);
  };

  const navigateToChat = (chat) => {
    if (chat.type === 'private') {
      router.push({ pathname: '/(member)/private-chat', params: { chatId: chat.id, otherName: chat.other_name, otherId: chat.other_id } });
    } else {
      router.push({ pathname: '/(member)/group-chat', params: { groupId: chat.id, groupName: chat.name } });
    }
  };

  const handleLongPress = (chat) => {
    const name = chat.type === 'private' ? chat.other_name : chat.name;
    const isArchived = archivedIds.includes(chat.id);
    const isPinned = pinnedIds.includes(chat.id);
    const isLocked = !!lockedChats[chat.id];
    Alert.alert(name, 'Choose an action', [
      {
        text: isPinned ? '📌 Unpin' : '📌 Pin',
        onPress: async () => {
          if (isPinned) {
            await api.delete('/api/chat/pin', { data: { chatId: chat.id } });
            setPinnedIds(prev => prev.filter(id => id !== chat.id));
          } else {
            await api.post('/api/chat/pin', { chatId: chat.id, chatType: chat.type });
            setPinnedIds(prev => [...prev, chat.id]);
          }
        }
      },
      {
        text: isArchived ? '📂 Unarchive' : '🗃️ Archive',
        onPress: async () => {
          if (isArchived) {
            await api.delete('/api/chat/archive', { data: { chatId: chat.id } });
            setArchivedIds(prev => prev.filter(id => id !== chat.id));
          } else {
            await api.post('/api/chat/archive', { chatId: chat.id, chatType: chat.type });
            setArchivedIds(prev => [...prev, chat.id]);
          }
        }
      },
      {
        text: isLocked ? '🔓 Unlock Chat' : '🔒 Lock Chat',
        onPress: () => {
          if (isLocked) {
            const n = { ...lockedChats };
            delete n[chat.id];
            saveLockedChats(n);
          } else {
            setLockChatId(chat.id);
            setLockPin('');
            setLockModal(true);
          }
        }
      },
      { text: 'Cancel', style: 'cancel' }
    ]);
  };

  const setLock = async () => {
    if (lockPin.length !== 4) { Alert.alert('Error', 'PIN must be 4 digits'); return; }
    await saveLockedChats({ ...lockedChats, [lockChatId]: lockPin });
    setLockModal(false);
    Alert.alert('Locked', 'Chat is now locked with PIN');
  };

  const verifyUnlock = () => {
    if (unlockPin === lockedChats[pendingChat.id]) {
      setUnlockModal(false);
      navigateToChat(pendingChat);
    } else {
      Alert.alert('Wrong PIN', 'Incorrect PIN');
      setUnlockPin('');
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const TABS = [
    { key: 'all',      label: `All` },
    { key: 'personal', label: `Personal` },
    { key: 'groups',   label: `Groups` },
  ];

  const renderItem = ({ item, index }) => {
    const name = item.type === 'private' ? item.other_name : item.name;
    const isOnline = item.type === 'private' ? !!item.otherProfile?.is_online : false;
    const lastMsg = item.lastMessage;
    const unread = item.unreadCount || 0;
    const isPinned = pinnedIds.includes(item.id);
    const isLocked = !!lockedChats[item.id];

    const preview = isLocked
      ? '🔒  Locked'
      : lastMsg
        ? lastMsg.file_url ? '📎  Attachment' : lastMsg.body || ''
        : 'Tap to message';

    return (
      <TouchableOpacity
        style={[styles.row, { backgroundColor: C.card }]}
        onPress={() => openChat(item)}
        onLongPress={() => handleLongPress(item)}
        activeOpacity={0.6}
      >
        <Avatar name={name} colorIndex={index} isOnline={isOnline} />

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.rowTop}>
            <View style={styles.nameRow}>
              {isPinned && <Text style={styles.miniIcon}>📌</Text>}
              {isLocked && <Text style={styles.miniIcon}>🔒</Text>}
              <Text style={[styles.name, { color: C.text }]} numberOfLines={1}>{name || 'Unknown'}</Text>
            </View>
            <Text style={[styles.time, { color: C.muted }]}>{formatTime(lastMsg?.created_at)}</Text>
          </View>
          <View style={styles.rowBottom}>
            <Text style={[styles.preview, { color: C.muted }]} numberOfLines={1}>{preview}</Text>
            {unread > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: C.accent }]}>
                <Text style={styles.unreadText}>{unread > 99 ? '99+' : String(unread)}</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={[styles.chevron, { color: C.border }]}>›</Text>
      </TouchableOpacity>
    );
  };

  // ── PIN Modal ────────────────────────────────────────────────────────────────
  const PinModal = ({ visible, title, subtitle, value, onChange, onConfirm, onCancel, confirmLabel }) => (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[styles.modalTitle, { color: C.text }]}>{title}</Text>
          <Text style={[styles.modalSub, { color: C.muted }]}>{subtitle}</Text>
          <TextInput
            style={[styles.pinInput, {
              backgroundColor: C.bg,
              color: C.text,
              borderColor: value.length === 4 ? C.accent : C.border,
            }]}
            placeholder="••••"
            placeholderTextColor={C.muted}
            value={value}
            onChangeText={onChange}
            keyboardType="number-pad"
            maxLength={4}
            secureTextEntry
            textAlign="center"
          />
          <View style={styles.modalBtns}>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: C.bg, borderColor: C.border }]}
              onPress={onCancel}
            >
              <Text style={[styles.modalBtnText, { color: C.muted }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtnPrimary, { backgroundColor: C.accent }]}
              onPress={onConfirm}
            >
              <Text style={styles.modalBtnPrimaryText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.screen, { backgroundColor: C.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <View style={[styles.topbar, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <View>
          <Text style={[styles.topbarTitle, { color: C.text }]}>
            {totalUnread > 0 ? `${totalUnread} New` : 'Messages'}
          </Text>
          <Text style={[styles.topbarSub, { color: C.muted }]}>
            Hello, {user?.name?.split(' ')[0] || 'there'} 👋
          </Text>
        </View>
        <View style={styles.topbarActions}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: C.bg, borderColor: C.border }]}
            onPress={toggle}
          >
            <Text style={{ fontSize: 16 }}>{isDark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: C.accent + '15', borderColor: C.accent + '30' }]}
            onPress={() => router.push('/(member)/members')}
          >
            <Text style={[styles.iconBtnLabel, { color: C.accent }]}>✏️ New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Search ───────────────────────────────────────────────────────────── */}
      <View style={[styles.searchWrap, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <View style={[styles.searchBox, { backgroundColor: C.bg, borderColor: C.border }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: C.text }]}
            placeholder="Search conversations..."
            placeholderTextColor={C.muted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: C.muted, fontSize: 15 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter tabs */}
        <View style={styles.tabs}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[
                styles.tab,
                { borderColor: C.border },
                activeTab === t.key && !showArchived && { backgroundColor: C.accent, borderColor: C.accent }
              ]}
              onPress={() => { setActiveTab(t.key); setShowArchived(false); }}
            >
              <Text style={[
                styles.tabText,
                { color: activeTab === t.key && !showArchived ? '#fff' : C.muted }
              ]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── List ─────────────────────────────────────────────────────────────── */}
      {loading ? (
        <ActivityIndicator size="large" color={C.accent} style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={visibleChats}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]} />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: C.separator, marginLeft: 72 }]} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 48, marginBottom: 14 }}>{showArchived ? '🗃️' : '💬'}</Text>
              <Text style={[styles.emptyTitle, { color: C.text }]}>
                {showArchived ? 'No archived chats' : 'No conversations yet'}
              </Text>
              <Text style={[styles.emptyText, { color: C.muted }]}>
                {showArchived ? 'Long press a chat to archive it' : 'Tap ✏️ New to start chatting'}
              </Text>
            </View>
          }
          ListFooterComponent={
            archivedCount > 0 && !showArchived ? (
              <TouchableOpacity
                style={[styles.archiveRow, { backgroundColor: C.surface, borderTopColor: C.border }]}
                onPress={() => setShowArchived(true)}
              >
                <Text style={{ fontSize: 18, marginRight: 12 }}>🗃️</Text>
                <Text style={[styles.archiveText, { color: C.muted }]}>
                  {`Archived Chats  ·  ${archivedCount}`}
                </Text>
                <Text style={{ color: C.border, fontSize: 20 }}>›</Text>
              </TouchableOpacity>
            ) : showArchived ? (
              <TouchableOpacity
                style={[styles.archiveRow, { backgroundColor: C.surface, borderTopColor: C.border }]}
                onPress={() => setShowArchived(false)}
              >
                <Text style={[styles.archiveText, { color: C.accent }]}>← Back to Chats</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      <PinModal
        visible={lockModal}
        title="Lock Chat"
        subtitle="Set a 4-digit PIN to secure this chat"
        value={lockPin}
        onChange={setLockPin}
        onConfirm={setLock}
        onCancel={() => setLockModal(false)}
        confirmLabel="Lock"
      />
      <PinModal
        visible={unlockModal}
        title="Unlock Chat"
        subtitle="Enter your PIN to open this chat"
        value={unlockPin}
        onChange={setUnlockPin}
        onConfirm={verifyUnlock}
        onCancel={() => setUnlockModal(false)}
        confirmLabel="Unlock"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  // Topbar
  topbar: {
    paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 28) + 12,
    paddingBottom: 12, paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
  },
  topbarTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  topbarSub:   { fontSize: 12, marginTop: 2 },
  topbarActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconBtn: { borderWidth: 0.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtnLabel: { fontSize: 13, fontWeight: '600' },

  // Search / Tabs
  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 0.5 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 0.5, borderRadius: 10, paddingHorizontal: 12, marginBottom: 10 },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 6, borderWidth: 0.5 },
  tabText: { fontSize: 12, fontWeight: '500' },

  // Row
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  avatar: { borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontWeight: '700' },
  onlineDot: { position: 'absolute', backgroundColor: '#22c55e', borderWidth: 2, borderColor: '#fff' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 5, marginRight: 8 },
  miniIcon: { fontSize: 11 },
  name: { fontSize: 15, fontWeight: '600', flex: 1 },
  time: { fontSize: 11, fontWeight: '500' },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  preview: { fontSize: 13, flex: 1, marginRight: 8 },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  unreadText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  chevron: { fontSize: 22, fontWeight: '300', marginLeft: 6 },
  separator: { height: 0.5 },

  // Archive row
  archiveRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderTopWidth: 0.5, marginTop: 4 },
  archiveText: { flex: 1, fontSize: 14, fontWeight: '600' },

  // Empty
  empty: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginBottom: 6 },
  emptyText: { fontSize: 14, textAlign: 'center' },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 28 },
  modalCard: { borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 0.5 },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  modalSub: { fontSize: 13, marginBottom: 20, textAlign: 'center' },
  pinInput: { width: '100%', borderRadius: 10, padding: 14, fontSize: 28, fontWeight: '800', borderWidth: 1.5, marginBottom: 20, letterSpacing: 12 },
  modalBtns: { flexDirection: 'row', gap: 12, width: '100%' },
  modalBtn: { flex: 1, borderRadius: 10, padding: 13, alignItems: 'center', borderWidth: 0.5 },
  modalBtnText: { fontWeight: '600', fontSize: 14 },
  modalBtnPrimary: { flex: 1, borderRadius: 10, padding: 13, alignItems: 'center' },
  modalBtnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});