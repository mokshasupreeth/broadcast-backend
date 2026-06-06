import { LinearGradient } from 'expo-linear-gradient';
//import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, FlatList,
    RefreshControl, StyleSheet, Text,
    TextInput, TouchableOpacity, View
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { getMyMessages, markRead } from '../../services/api';
import { registerForPushNotifications } from '../../services/notifications';
import { disconnectSocket } from '../../services/socket';
import { clearAuth, getAuth } from '../../store/authStore';

export default function Inbox() {
  const { colors, isDark, toggle } = useTheme();
  const [messages, setMessages] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
    fetchMessages();
    registerForPushNotifications();
    const sub = Notifications.addNotificationReceivedListener(() => fetchMessages());
    return () => sub.remove();
  }, []);

  const loadUser = async () => {
    const { user } = await getAuth();
    setUser(user);
  };

  const fetchMessages = async () => {
    try {
      const res = await getMyMessages();
      setMessages(res.data);
      setFiltered(res.data);
    } catch {
      Alert.alert('Error', 'Could not load messages');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSearch = (text) => {
    setSearch(text);
    if (!text) { setFiltered(messages); return; }
    const q = text.toLowerCase();
    setFiltered(messages.filter(m =>
      m.title?.toLowerCase().includes(q) || m.body?.toLowerCase().includes(q)
    ));
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMessages();
  }, []);

  const handleOpen = async (msg) => {
    if (!msg.is_read) {
      try {
        await markRead(msg.id);
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: 1 } : m));
        setFiltered(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: 1 } : m));
      } catch (_) {}
    }
    router.push({
      pathname: '/(member)/message',
      params: { id: msg.id, title: msg.title, body: msg.body, date: msg.created_at }
    });
  };

  const handleLogout = async () => {
    disconnectSocket();
    await clearAuth();
    router.replace('/(auth)/login');
  };

  const unreadCount = messages.filter(m => !m.is_read).length;

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card },
        !item.is_read && { borderLeftColor: colors.primary, borderLeftWidth: 4, backgroundColor: colors.unread }
      ]}
      onPress={() => handleOpen(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardInner}>
        <View style={[styles.avatar, { backgroundColor: !item.is_read ? colors.primary : colors.lightGray }]}>
          <Text style={styles.avatarText}>{item.title?.[0]?.toUpperCase() || '📢'}</Text>
        </View>
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
            {!item.is_read && (
              <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.unreadBadgeText}>New</Text>
              </View>
            )}
          </View>
          <Text style={[styles.cardBody, { color: colors.textLight }]} numberOfLines={2}>{item.body}</Text>
          <Text style={[styles.cardDate, { color: colors.gray }]}>
            🕐 {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={isDark ? ['#1E3A8A', '#1E293B'] : ['#1D4ED8', '#7C3AED']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerGreeting}>Hello, {user?.name?.split(' ')[0] || 'there'} 👋</Text>
            <Text style={styles.headerTitle}>📡 Broadcasts</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={toggle} style={styles.iconBtn}>
              <Text>{isDark ? '☀️' : '🌙'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
        {unreadCount > 0 && (
          <View style={styles.unreadBanner}>
            <Text style={styles.unreadBannerText}>🔵 {unreadCount} unread message{unreadCount > 1 ? 's' : ''}</Text>
          </View>
        )}
      </LinearGradient>

      <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search messages..."
          placeholderTextColor={colors.gray}
          value={search}
          onChangeText={handleSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Text style={[styles.clearText, { color: colors.gray }]}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>{search ? '🔍' : '📭'}</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{search ? 'No results' : 'All caught up!'}</Text>
              <Text style={[styles.emptyText, { color: colors.textLight }]}>{search ? 'Try different keywords' : 'No messages yet. Pull to refresh.'}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerGreeting: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 10 },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  logoutText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  unreadBanner: { marginTop: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 10 },
  unreadBannerText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', margin: 16, borderRadius: 14, paddingHorizontal: 14, borderWidth: 1 },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 13, fontSize: 14 },
  clearText: { fontSize: 16, padding: 4 },
  card: { borderRadius: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, overflow: 'hidden' },
  cardInner: { flexDirection: 'row', padding: 14, alignItems: 'center' },
  avatar: { width: 46, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  cardContent: { flex: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 14, fontWeight: '700', flex: 1, marginRight: 8 },
  unreadBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  unreadBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  cardBody: { fontSize: 12, lineHeight: 17, marginBottom: 6 },
  cardDate: { fontSize: 11 },
  emptyBox: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});