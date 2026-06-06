import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList,
  RefreshControl, StyleSheet, Text,
  TextInput, TouchableOpacity, View
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { getAuth } from '../../store/authStore';

const AVATAR_COLORS = [
  { bg: '#E6F1FB', text: '#0C447C' },
  { bg: '#EEEDFE', text: '#3C3489' },
  { bg: '#E1F5EE', text: '#085041' },
  { bg: '#FAECE7', text: '#712B13' },
  { bg: '#FBEAF0', text: '#72243E' },
];

export default function Members() {
  const { colors, isDark } = useTheme();
  const [members, setMembers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myId, setMyId] = useState(null);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { user } = await getAuth();
    setMyId(user.id);
    fetchMembers();
  };

  const fetchMembers = async () => {
    try {
      const res = await api.get('/api/chat/users');
      setMembers(res.data || []);
      setFiltered(res.data || []);
    } catch {
      Alert.alert('Error', 'Could not load members');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMembers();
  }, []);

  const handleSearch = (val) => {
    setSearch(val);
    if (!val.trim()) { setFiltered(members); return; }
    const q = val.toLowerCase();
    setFiltered(members.filter(m => m.name?.toLowerCase().includes(q)));
  };

  const startChat = async (member) => {
    try {
      const res = await api.post('/api/chat/chats', { otherUserId: member.id });
      router.push({
        pathname: '/(admin)/private-chat',
        params: { chatId: res.data.id, otherName: member.name, otherId: member.id }
      });
    } catch (e) {
      Alert.alert('Error', 'Could not start chat');
    }
  };

  const getAvatarColor = (index) => AVATAR_COLORS[index % AVATAR_COLORS.length];

  const visibleMembers = filtered.filter(m => m.id !== myId);
  const onlineMembers  = visibleMembers.filter(m => m.is_online);
  const offlineMembers = visibleMembers.filter(m => !m.is_online);

  // Build a flat list of section headers + member items for FlatList
  const listData = [];
  if (onlineMembers.length > 0) {
    listData.push({ type: 'header', id: 'header-online',   title: 'Online now' });
    onlineMembers.forEach((m, i)  => listData.push({ type: 'member', id: m.id, item: m, index: i }));
  }
  if (offlineMembers.length > 0) {
    listData.push({ type: 'header', id: 'header-offline',  title: 'All members' });
    offlineMembers.forEach((m, i) => listData.push({ type: 'member', id: m.id, item: m, index: i }));
  }
  if (visibleMembers.length === 0) {
    listData.push({ type: 'empty', id: 'empty' });
  }

  const renderItem = ({ item: row }) => {
    if (row.type === 'header') {
      return (
        <Text style={[styles.sectionLabel, { color: colors.gray }]}>
          {row.title}
        </Text>
      );
    }

    if (row.type === 'empty') {
      return (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>{'👥'}</Text>
          <Text style={[styles.emptyText, { color: colors.gray }]}>{'No members found'}</Text>
        </View>
      );
    }

    const { item, index } = row;
    const av       = getAvatarColor(index);
    const initials = item.name
      ? item.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
      : '?';
    const statusLabel = item.is_online ? 'Online' : 'Offline';
    const aboutText   = item.about || 'Hey there! I am using Broadcast.';

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => startChat(item)}
        activeOpacity={0.75}
      >
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, { backgroundColor: av.bg }]}>
            <Text style={[styles.avatarText, { color: av.text }]}>{initials}</Text>
          </View>
          {item.is_online
            ? <View style={[styles.onlineDot, { borderColor: colors.card }]} />
            : null}
        </View>

        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.about, { color: colors.gray }]} numberOfLines={1}>
            {aboutText}
          </Text>
          <View style={styles.statusRow}>
            <View style={[
              styles.statusDot,
              { backgroundColor: item.is_online ? '#22C55E' : colors.gray }
            ]} />
            <Text style={[styles.statusText, { color: colors.gray }]}>
              {statusLabel}
            </Text>
          </View>
        </View>

        <View style={[
          styles.chatBtn,
          { backgroundColor: isDark ? 'rgba(12,68,124,0.3)' : '#E6F1FB' }
        ]}>
          <Text style={styles.chatBtnIcon}>{'💬'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={isDark ? ['#1E3A8A', '#1E293B'] : ['#1D4ED8', '#2563EB']}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerSub}>{'Directory'}</Text>
            <Text style={styles.headerTitle}>{'Members'}</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{`${members.length} total`}</Text>
          </View>
        </View>
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>{'🔍'}</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search members..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={search}
            onChangeText={handleSearch}
          />
        </View>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(row) => row.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header:       { paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20 },
  headerTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  headerSub:    { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 2 },
  headerTitle:  { fontSize: 22, fontWeight: '700', color: '#fff' },
  countBadge:   { backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginTop: 4 },
  countText:    { fontSize: 12, color: 'rgba(255,255,255,0.9)' },
  searchWrap:   { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 2 },
  searchIcon:   { fontSize: 14, marginRight: 8 },
  searchInput:  { flex: 1, fontSize: 14, color: '#fff', paddingVertical: 10 },
  list:         { padding: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 4 },
  card:         { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 0.5, padding: 14, marginBottom: 10, gap: 12 },
  avatarWrap:   { position: 'relative' },
  avatar:       { width: 46, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  avatarText:   { fontSize: 17, fontWeight: '600' },
  onlineDot:    { position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: 6, backgroundColor: '#22C55E', borderWidth: 2 },
  info:         { flex: 1, minWidth: 0 },
  name:         { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  about:        { fontSize: 12, marginBottom: 3 },
  statusRow:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot:    { width: 6, height: 6, borderRadius: 3 },
  statusText:   { fontSize: 11 },
  chatBtn:      { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  chatBtnIcon:  { fontSize: 18 },
  emptyBox:     { alignItems: 'center', marginTop: 60 },
  emptyEmoji:   { fontSize: 52, marginBottom: 12 },
  emptyText:    { fontSize: 14 },
});